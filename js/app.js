(function () {
  "use strict";

  const { $, $all, esc, money, parseMoney, dateTime, todayInput, plateKey, uidSafe, coords, pointFrom, callRoutePoints, routeKm, mapsRouteUrl, toast, statusClass } = window.JM.utils;
  const { auth, secondaryAuth, db, ts, arrayUnion, emailIsAdmin } = window.JM.firebase;
  const cfg = window.JM_CONFIG || {};
  const SYSTEM_SIGNATURE = "Powered by thIAguinho SoluÃ§Ãµes Digitais";
  const LOGIN_FLOW_VERSION = "jm-driver-login-v15";
  let trackerTimer = null;
  let trackerBusy = false;

  const state = {
    user: null,
    profile: null,
    vehicles: {},
    calls: {},
    users: {},
    expenses: {},
    transactions: {},
    settings: {},
    addresses: { origin: null, destination: null },
    smartRoute: null
  };

  const unsubscribers = [];
  const OFFICE_ROLES = ["admin", "finance", "gestor", "owner", "manager", "gerente", "auxiliar", "atendente"];
  const MANAGER_ROLES = ["admin", "finance", "gestor", "owner", "manager", "gerente"];
  const DRIVER_ROLES = ["driver", "motorista"];

  function normalizedRole(role) {
    return String(role || "").toLowerCase().trim();
  }

  function isOffice() {
    return state.profile && OFFICE_ROLES.includes(normalizedRole(state.profile.role));
  }

  function isAdmin() {
    return state.profile && MANAGER_ROLES.includes(normalizedRole(state.profile.role));
  }

  function canManageTracker() {
    return state.profile && MANAGER_ROLES.includes(normalizedRole(state.profile.role));
  }

  function activeCloudinaryConfig() {
    return Object.assign({}, cfg.cloudinary || {}, state.settings.cloudinary || {});
  }

  function mergeNonEmpty(base, override) {
    const out = Object.assign({}, base || {});
    Object.entries(override || {}).forEach(([key, value]) => {
      if (value === "" || value == null) return;
      if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
        out[key] = Object.assign({}, out[key] || {}, value);
      } else {
        out[key] = value;
      }
    });
    return out;
  }

  function activeMapSettings() {
    return mergeNonEmpty(cfg.map || {}, state.settings.map || state.settings.googleMaps || {});
  }

  function activeTrackerSettings() {
    return mergeNonEmpty(cfg.tracker || {}, state.settings.tracker || {});
  }

  function addressStatus(id, message, type) {
    const el = $(id);
    if (!el) return;
    el.textContent = message;
    el.className = "small geo-status " + (type || "muted");
  }

  function setAddress(kind, address) {
    const isOrigin = kind === "origin";
    const labelId = isOrigin ? "callOriginLabel" : "callDestLabel";
    const latId = isOrigin ? "callOriginLat" : "callDestLat";
    const lngId = isOrigin ? "callOriginLng" : "callDestLng";
    const statusId = isOrigin ? "originGeoStatus" : "destGeoStatus";
    const point = pointFrom(address && (address.coords || address));
    const normalized = {
      label: address && address.label || $(labelId).value.trim(),
      coords: point,
      placeId: address && address.placeId || "",
      source: address && address.source || "manual",
      resolvedAt: address && address.resolvedAt || new Date().toISOString()
    };
    state.addresses[kind] = normalized;
    if (normalized.label) $(labelId).value = normalized.label;
    if (point) {
      $(latId).value = String(point.lat);
      $(lngId).value = String(point.lng);
      addressStatus(statusId, "EndereÃ§o validado: " + normalized.label + " (" + point.lat.toFixed(6) + ", " + point.lng.toFixed(6) + ")", "ok");
    } else {
      addressStatus(statusId, "EndereÃ§o ainda sem coordenadas. Cole link do mapa com coordenadas ou informe latitude/longitude.", "danger");
    }
    state.smartRoute = null;
    renderSmartRouteBox();
    return normalized;
  }

  function addressFromInputs(kind) {
    const isOrigin = kind === "origin";
    const label = $(isOrigin ? "callOriginLabel" : "callDestLabel").value.trim();
    const point = coords($(isOrigin ? "callOriginLat" : "callDestLat").value, $(isOrigin ? "callOriginLng" : "callDestLng").value);
    const existing = state.addresses[kind] || {};
    if (!label && !point) return null;
    return {
      label: label || existing.label || "",
      coords: point || existing.coords || null,
      placeId: existing.placeId || "",
      source: existing.source || (point ? "manual_coords" : "manual_text"),
      resolvedAt: existing.resolvedAt || new Date().toISOString()
    };
  }

  function initializeAddressTools() {
    const gm = window.JM.googleMaps;
    if (!gm) return;
    if (!gm.isConfigured(activeMapSettings())) {
      addressStatus("originGeoStatus", "Modo gratuito ativo: cole link compartilhado do mapa ou coordenadas. NÃ£o usa API paga.", "warn");
      return;
    }
    gm.initAutocomplete("callOriginLabel", (addr) => setAddress("origin", addr), activeMapSettings()).catch((err) => addressStatus("originGeoStatus", err.message, "danger"));
    gm.initAutocomplete("callDestLabel", (addr) => setAddress("destination", addr), activeMapSettings()).catch((err) => addressStatus("destGeoStatus", err.message, "danger"));
    addressStatus("originGeoStatus", "Modo gratuito ativo: cole link do Google Maps/Waze ou coordenadas.", "ok");
    addressStatus("destGeoStatus", "Destino pode ser link compartilhado ou coordenadas.", "ok");
  }

  async function geocodeAddress(kind) {
    const gm = window.JM.googleMaps;
    const isOrigin = kind === "origin";
    const labelId = isOrigin ? "callOriginLabel" : "callDestLabel";
    const statusId = isOrigin ? "originGeoStatus" : "destGeoStatus";
    try {
      if (!gm || !gm.isConfigured(activeMapSettings())) throw new Error("Cole um link de mapa com coordenadas visÃ­veis ou informe latitude/longitude.");
      addressStatus(statusId, "Lendo link/coordenadas...", "muted");
      const addr = await gm.geocode($(labelId).value.trim(), activeMapSettings());
      setAddress(kind, addr);
      toast((isOrigin ? "Origem" : "Destino") + " lido com coordenadas.", "ok");
    } catch (err) {
      addressStatus(statusId, err.message, "danger");
      toast(err.message, "danger");
    }
  }

  function useCurrentLocationAsOrigin() {
    if (!navigator.geolocation) return toast("Este navegador nÃ£o liberou geolocalizaÃ§Ã£o.", "danger");
    addressStatus("originGeoStatus", "Capturando localizaÃ§Ã£o do aparelho...", "muted");
    navigator.geolocation.getCurrentPosition((pos) => {
      setAddress("origin", {
        label: "LocalizaÃ§Ã£o atual do aparelho",
        coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        source: "browser_geolocation",
        resolvedAt: new Date().toISOString()
      });
      toast("LocalizaÃ§Ã£o atual aplicada como origem.", "ok");
    }, (err) => {
      addressStatus("originGeoStatus", "NÃ£o foi possÃ­vel obter localizaÃ§Ã£o: " + err.message, "danger");
    }, { enableHighAccuracy: true, timeout: 12000 });
  }

  function bestSmartRoute() {
    return state.smartRoute && state.smartRoute.rankings && state.smartRoute.rankings[0] || null;
  }

  function renderSmartRouteBox() {
    const box = $("smartRouteBox");
    if (!box) return;
    const route = state.smartRoute;
    if (!route || !route.rankings || !route.rankings.length) {
      box.innerHTML = "Informe a origem e clique em <b>TraÃ§ar rota inteligente</b>. O algoritmo usa posiÃ§Ã£o do tracker, status do veÃ­culo, distÃ¢ncia e tempo estimado.";
      return;
    }
    box.innerHTML = route.rankings.slice(0, 5).map((r, i) => {
      const v = r.vehicle || {};
      const badge = i === 0 ? '<span class="badge ok">RECOMENDADO</span>' : '<span class="badge info">OpÃ§Ã£o ' + (i + 1) + '</span>';
      const src = r.toOrigin && r.toOrigin.source === "free_leaflet_haversine" ? "mapa gratuito" : "estimativa";
      return `<div class="smart-route-card">
        <div>${badge} <b>${esc(v.placa || v.id || "VeÃ­culo")}</b> <span class="muted">${esc(v.apelido || v.tipo || "")}</span></div>
        <div>AtÃ© a origem: <b>${esc(r.toOrigin.distanceText || r.kmToOrigin.toFixed(1) + " km")}</b> Â· <b>${esc(r.toOrigin.durationTrafficText || r.toOrigin.durationText || r.minutesToOrigin + " min")}</b> Â· fonte: ${esc(src)}</div>
        ${r.serviceRoute ? `<div>Origem â†’ destino: <b>${esc(r.serviceRoute.distanceText || "")}</b> Â· <b>${esc(r.serviceRoute.durationTrafficText || r.serviceRoute.durationText || "")}</b></div>` : ""}
        <div class="actions"><button class="btn primary" type="button" onclick="JM.app.applySmartVehicle('${esc(v.id)}')">Usar este veÃ­culo</button>${r.routeUrl ? `<a class="btn" target="_blank" href="${esc(r.routeUrl)}">Abrir rota</a>` : ""}</div>
      </div>`;
    }).join("");
  }

  async function calculateSmartRoute() {
    const gm = window.JM.googleMaps;
    const origin = addressFromInputs("origin");
    let destination = addressFromInputs("destination");
    if (!origin || !origin.coords) {
      if (origin && origin.label && gm && gm.isConfigured(activeMapSettings())) {
        await geocodeAddress("origin");
      }
    }
    const finalOrigin = addressFromInputs("origin");
    if (!finalOrigin || !finalOrigin.coords) return toast("Informe a origem por link do mapa ou latitude/longitude antes da rota inteligente.", "danger");
    if (destination && destination.label && !destination.coords && gm && gm.isConfigured(activeMapSettings())) {
      await geocodeAddress("destination");
      destination = addressFromInputs("destination");
    }
    const located = Object.values(state.vehicles || {}).filter((v) => pointFrom(v.location));
    if (!located.length) return toast("Nenhum veÃ­culo tem posiÃ§Ã£o de tracker. Sincronize o tracker no superadmin primeiro.", "danger");
    $("smartRouteBox").innerHTML = "Calculando melhor veÃ­culo e tempo de rota...";
    try {
      const rankings = await gm.rankVehicles(state.vehicles, finalOrigin.coords, destination && destination.coords, activeMapSettings());
      state.smartRoute = { origin: finalOrigin, destination, rankings, calculatedAt: new Date().toISOString() };
      const best = bestSmartRoute();
      if (best && !$("callVehicle").value) $("callVehicle").value = best.vehicle.id;
      renderSmartRouteBox();
      toast("Rota inteligente calculada.", "ok");
    } catch (err) {
      $("smartRouteBox").innerHTML = `<span class="danger">${esc(err.message)}</span>`;
      toast(err.message, "danger");
    }
  }

  function applySmartVehicle(vehicleId) {
    if ($("callVehicle")) $("callVehicle").value = vehicleId || "";
    toast("VeÃ­culo aplicado ao chamado.", "ok");
  }

  function openGoogleRouteFromForm() {
    const vehicle = state.vehicles[$("callVehicle").value] || null;
    const origin = addressFromInputs("origin");
    const destination = addressFromInputs("destination");
    const points = [];
    if (vehicle && vehicle.location) points.push(vehicle.location);
    if (origin && origin.coords) points.push(origin.coords);
    if (destination && destination.coords) points.push(destination.coords);
    const url = window.JM.googleMaps && window.JM.googleMaps.routeUrl(points) || mapsRouteUrl(points);
    if (!url) return toast("Informe origem/destino e selecione veÃ­culo com posiÃ§Ã£o para abrir a rota.", "danger");
    window.open(url, "_blank");
  }

  function showView(name) {
    $all(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
    $all("#navButtons button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    const titles = {
      dashboard: "Dashboard",
      chamados: "Chamados",
      mapa: "Mapa / Tracker",
      motorista: "Painel motorista",
      financeiro: "Financeiro",
      frota: "Frota",
      equipe: "Equipe"
    };
    $("pageTitle").textContent = titles[name] || name;
    document.body.classList.remove("menu-open");
    refreshMaps();
  }

  function bindNavigation() {
    $all("#navButtons button").forEach((btn) => {
      btn.onclick = () => showView(btn.dataset.view);
    });
    $("menuBtn").onclick = () => document.body.classList.toggle("menu-open");
    $("logoutBtn").onclick = () => auth.signOut();
  }

  function reportSignature() {
    return `<div class="report-signature">${SYSTEM_SIGNATURE}</div>`;
  }

  function gestorAccessAllowedByConfig(user) {
    const authCfg = cfg.auth || {};
    // MantÃ©m a trava por lista de e-mails quando ela existir.
    // Se a lista estiver vazia/removida, o sistema permite o primeiro gestor criar o perfil.
    const list = (authCfg.adminEmails || []).map((e) => String(e).toLowerCase().trim()).filter(Boolean);
    if (!list.length) return { allowed: true, role: "admin", source: "config-empty" };
    return emailIsAdmin(user.email) ? { allowed: true, role: "admin", source: "config" } : { allowed: false };
  }

  async function gestorAccessAllowedByRegistry(user) {
    const email = String(user && user.email || "").toLowerCase().trim();
    if (!email) return { allowed: false };
    try {
      const snap = await db.collection("managerAccess").doc(email).get();
      if (!snap.exists) return { allowed: false };
      const data = snap.data() || {};
      const role = normalizedRole(data.role || "admin");
      if (data.active === false) return { allowed: false, reason: "inactive" };
      if (!OFFICE_ROLES.includes(role)) return { allowed: false, reason: "not-manager-role" };
      return { allowed: true, role, source: "managerAccess" };
    } catch (err) {
      console.warn("Falha ao verificar managerAccess", err);
      return { allowed: false, error: err };
    }
  }

  async function emailReservedForManager(email) {
    const normalized = String(email || "").toLowerCase().trim();
    if (!normalized) return false;
    if (emailIsAdmin(normalized)) return true;
    try {
      const snap = await db.collection("managerAccess").doc(normalized).get();
      return snap.exists && (snap.data() || {}).active !== false;
    } catch (err) {
      console.warn("Falha ao verificar gestor reservado", err);
      return false;
    }
  }

  async function saveGestorProfile(ref, profile, existingData) {
    const payload = existingData ? profile : Object.assign({ createdAt: ts() }, profile);
    await ref.set(payload, { merge: true });
    return { id: profile.uid, ...(existingData || {}), ...profile };
  }

  async function ensureGestorProfile(user) {
    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();
    const current = snap.exists ? { id: user.uid, ...snap.data() } : null;

    if (current && current.active === false) {
      throw new Error("Este usuÃ¡rio estÃ¡ inativo no cadastro da JM Guinchos.");
    }

    const baseProfile = {
      uid: user.uid,
      email: user.email,
      nome: (current && current.nome) || user.displayName || user.email.split("@")[0],
      active: true,
      updatedAt: ts()
    };

    if (current && OFFICE_ROLES.includes(normalizedRole(current.role))) {
      return { ...current, role: normalizedRole(current.role) };
    }

    const configAccess = gestorAccessAllowedByConfig(user);
    const registryAccess = configAccess.allowed ? configAccess : await gestorAccessAllowedByRegistry(user);
    if (!registryAccess.allowed) {
      throw new Error("Este e-mail nÃ£o estÃ¡ liberado como gestor. Crie/libere o gestor no superadmin antes de acessar o jm.html.");
    }

    // CorreÃ§Ã£o definitiva do bug: jm.html Ã© painel gestor.
    // Se o usuÃ¡rio foi criado como driver/motorista por fluxo antigo, repara para admin/financeiro
    // usando a autorizaÃ§Ã£o por e-mail gravada pelo superadmin em managerAccess/{email}.
    const repairedProfile = {
      ...baseProfile,
      role: registryAccess.role || "admin",
      loginFixedAt: new Date().toISOString(),
      loginFlowVersion: LOGIN_FLOW_VERSION,
      managerAccessSource: registryAccess.source || "unknown"
    };

    try {
      return await saveGestorProfile(ref, repairedProfile, current || null);
    } catch (err) {
      if (err && err.code === "permission-denied") {
        throw new Error("O login foi aceito, mas o Firestore bloqueou a correÃ§Ã£o do perfil. Publique as novas firestore.rules deste ZIP ou altere o documento users/" + user.uid + " para role: admin.");
      }
      throw err;
    }
  }



  function setTrackerStatus(message, type) {
    const el = $("trackerStatus");
    if (!el) return;
    el.textContent = message;
    el.className = "muted small " + (type || "");
  }

  async function syncTrackerNow(manual) {
    const tracker = activeTrackerSettings();
    if (!tracker.endpoint || !tracker.token) {
      setTrackerStatus("Tracker sem endpoint/token. Configure no superadmin.", "warn");
      if (manual) toast("Configure endpoint e token do Tracker no superadmin.", "danger");
      return [];
    }
    if (!canManageTracker()) {
      setTrackerStatus("Tracker ativo somente para gestor/gerente sincronizar.", "warn");
      return [];
    }
    if (trackerBusy) return [];
    trackerBusy = true;
    try {
      setTrackerStatus("Sincronizando Tracker RAFA...", "info");
      const positions = await window.JM.tracker.syncTrackerToFirestore(tracker, db, state.vehicles);
      const matched = positions.filter((p) => p.trackerMatched).length;
      const unmapped = positions.length - matched;
      const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const detail = unmapped > 0 ? ` (${unmapped} sem vinculo com placa; ajuste o deviceId no superadmin)` : "";
      setTrackerStatus(`Tracker RAFA sincronizado: ${positions.length} posiÃ§Ã£o(Ãµes), ${matched} vinculada(s) Ã s ${now}${detail}.`, unmapped > 0 ? "warn" : "ok");
      if (manual) toast(`${positions.length} posiÃ§Ã£o(Ãµes) sincronizada(s), ${matched} vinculada(s).${detail}`, unmapped > 0 ? "warn" : "ok");
      return positions;
    } catch (err) {
      console.error(err);
      setTrackerStatus("Falha no Tracker: " + (err && err.message || err), "danger");
      if (manual) toast("Falha no Tracker: " + (err && err.message || err), "danger");
      return [];
    } finally {
      trackerBusy = false;
    }
  }

  function restartTrackerAutoSync() {
    if (trackerTimer) {
      clearInterval(trackerTimer);
      trackerTimer = null;
    }
    const tracker = activeTrackerSettings();
    if (!tracker.endpoint || !tracker.token) {
      setTrackerStatus("Tracker aguardando endpoint/token no superadmin.", "warn");
      return;
    }
    const polling = Math.max(15000, Number(tracker.pollingMs || 30000));
    setTrackerStatus("Tracker configurado. AtualizaÃ§Ã£o automÃ¡tica a cada " + Math.round(polling / 1000) + "s.", "ok");
    syncTrackerNow(false);
    trackerTimer = setInterval(() => syncTrackerNow(false), polling);
  }


  function listenCollection(name, target) {
    const unsub = db.collection(name).onSnapshot((snap) => {
      const rows = {};
      snap.forEach((doc) => { rows[doc.id] = { id: doc.id, ...doc.data() }; });
      state[target] = rows;
      renderAll();
    }, (err) => {
      console.error(err);
      toast("Falha ao ouvir " + name + ": " + err.message, "danger");
    });
    unsubscribers.push(unsub);
  }

  function startListeners() {
    unsubscribers.splice(0).forEach((fn) => fn());
    const baseCollections = ["vehicles", "calls", "users"];
    if (isAdmin()) baseCollections.push("expenses", "transactions");
    baseCollections.forEach((name) => listenCollection(name, name));
    const settingsUnsub = db.collection("settings").doc("integrations").onSnapshot((snap) => {
      state.settings = snap.exists ? snap.data() : {};
      initializeAddressTools();
      restartTrackerAutoSync();
      renderAll();
    });
    unsubscribers.push(settingsUnsub);
  }

  function stopListeners() {
    unsubscribers.splice(0).forEach((fn) => fn());
    if (trackerTimer) { clearInterval(trackerTimer); trackerTimer = null; }
  }

  function applyRoleVisibility() {
    const allowed = isAdmin();
    ["financeiro", "frota", "equipe"].forEach((view) => {
      const btn = document.querySelector(`#navButtons button[data-view="${view}"]`);
      if (btn) btn.classList.toggle("hidden", !allowed);
    });
    // Importante: nunca redirecionar o jm.html para motorista.html.
    if (!allowed) showView("dashboard");
  }

  auth.onAuthStateChanged(async (user) => {
    stopListeners();
    state.user = user || null;
    state.profile = null;
    if (!user) {
      $("loginView").classList.remove("hidden");
      $("appView").classList.add("hidden");
      return;
    }

    try {
      state.profile = await ensureGestorProfile(user);
      $("loginView").classList.add("hidden");
      $("appView").classList.remove("hidden");
      $("userBox").innerHTML = `<b>${esc(state.profile.nome || user.email)}</b><br>${esc(user.email)}<br><span class="badge info">${esc(state.profile.role)}</span>`;
      applyRoleVisibility();
      startListeners();
    } catch (err) {
      $("appView").classList.add("hidden");
      $("loginView").classList.remove("hidden");
      $("loginError").textContent = err && err.message ? err.message : "Acesso de gestor nÃ£o autorizado.";
      await auth.signOut().catch(() => {});
    }
  });

  $("loginForm").onsubmit = async (e) => {
    e.preventDefault();
    $("loginError").textContent = "";
    try {
      await auth.signInWithEmailAndPassword($("loginEmail").value.trim(), $("loginPass").value);
    } catch (err) {
      $("loginError").textContent = friendlyAuthError(err);
    }
  };

  function friendlyAuthError(err) {
    const code = err && err.code || "";
    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      return "UsuÃ¡rio ou senha invÃ¡lidos. O acesso de gestor deve existir no Firebase Authentication.";
    }
    if (code === "auth/operation-not-allowed") {
      return "Ative o provedor E-mail/Senha no Firebase Authentication.";
    }
    if (code === "auth/too-many-requests") {
      return "Muitas tentativas. Aguarde alguns minutos ou redefina a senha no Firebase.";
    }
    return "Acesso negado: " + (err && err.message || "falha de autenticaÃ§Ã£o");
  }

  function renderAll() {
    renderSelects();
    renderDashboard();
    renderCalls();
    renderVehicles();
    renderTeam();
    if ($("driverCalls")) renderDriverPanel();
    renderFinance();
    refreshMaps();
  }

  function setOptionsPreservingValue(id, html) {
    const el = $(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = html;
    if (current && Array.from(el.options).some((opt) => opt.value === current)) el.value = current;
  }

  function renderSelects() {
    const vehicleOptions = Object.values(state.vehicles).map((v) => `<option value="${esc(v.id)}">${esc(v.placa || v.id)} - ${esc(v.apelido || v.tipo || "")}</option>`).join("");
    setOptionsPreservingValue("callVehicle", `<option value="">Selecione</option>${vehicleOptions}`);
    setOptionsPreservingValue("expenseVehicle", `<option value="">Selecione</option>${vehicleOptions}`);
    const drivers = Object.values(state.users).filter((u) => u.active !== false && DRIVER_ROLES.includes(normalizedRole(u.role)));
    setOptionsPreservingValue("callDriver", `<option value="">Selecione</option>` + drivers.map((u) => `<option value="${esc(u.id)}">${esc(u.nome || u.email)}</option>`).join(""));
    const myCalls = Object.values(state.calls).filter((c) => c.driverId === state.user?.uid && !["Finalizado", "Cancelado"].includes(c.status));
    setOptionsPreservingValue("expenseCall", `<option value="">Sem chamado</option>` + myCalls.map((c) => `<option value="${esc(c.id)}">${esc(c.protocolo || c.cliente)}</option>`).join(""));
  }

  function renderDashboard() {
    const calls = Object.values(state.calls);
    const active = calls.filter((c) => !["Finalizado", "Cancelado"].includes(c.status));
    const now = new Date();
    const revenue = Object.values(state.transactions).filter((t) => t.type === "entrada").filter((t) => {
      const d = new Date(t.date || t.createdAt || 0);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const pendingExpenses = Object.values(state.expenses).filter((e) => e.status === "pendente").reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const online = Object.values(state.vehicles).filter((v) => v.location && v.lastTrackerAt).length;
    $("kpiActiveCalls").textContent = active.length;
    $("kpiRevenue").textContent = money(revenue);
    $("kpiExpenses").textContent = money(pendingExpenses);
    $("kpiOnline").textContent = online;
    const events = calls.flatMap((c) => (c.timeline || []).map((t) => ({ ...t, call: c }))).sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))).slice(0, 10);
    $("timelineBox").innerHTML = events.length ? events.map((e) => `<div class="timeline-item"><b>${esc(e.call.protocolo || e.call.cliente || "Chamado")}</b><br><span>${esc(e.text || "")}</span><br><small>${dateTime(e.at)}</small></div>`).join("") : `<p class="muted">Sem eventos ainda.</p>`;
  }

  function renderCalls() {
    const rows = Object.values(state.calls).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    if (!rows.length) return $("callsTable").innerHTML = `<p class="muted">Nenhum chamado registrado.</p>`;
    $("callsTable").innerHTML = `<table><thead><tr><th>Protocolo</th><th>Cliente</th><th>Origem/Destino</th><th>VeÃ­culo</th><th>Status</th><th>AÃ§Ãµes</th></tr></thead><tbody>` + rows.map((c) => {
      const vehicle = state.vehicles[c.vehicleId] || {};
      const driver = state.users[c.driverId] || {};
      const url = c.routeUrl || mapsRouteUrl(c, vehicle);
      const km = routeKm(c, vehicle);
      const metric = c.routeMetrics && c.routeMetrics.bestToOrigin && c.routeMetrics.bestToOrigin.distanceText || (km ? km.toFixed(1).replace(".", ",") + " km" : "Sem rota");
      return `<tr>
        <td><b>${esc(c.protocolo || c.id)}</b><br><span class="muted small">${dateTime(c.createdAt)}</span></td>
        <td>${esc(c.cliente || "")}<br><span class="muted small">${esc(c.phone || "")}</span></td>
        <td><span class="small">${esc(c.originLabel || c.origem && c.origem.label || "-")}</span><br><span class="muted small">â†’ ${esc(c.destLabel || c.destino && c.destino.label || "-")}</span><br><b>${esc(metric)}</b>${url ? `<br><a class="info small" target="_blank" href="${esc(url)}">Abrir rota no Maps</a>` : ""}</td>
        <td>${esc(vehicle.placa || "-")}<br><span class="muted small">${esc(driver.nome || driver.email || "Sem motorista")}</span></td>
        <td><span class="badge ${statusClass(c.status)}">${esc(c.status || "Novo")}</span><br><b>${money(c.valor || 0)}</b></td>
        <td class="row-actions"><button class="btn good" onclick="JM.app.setCallStatus('${esc(c.id)}','Despachado')">Despachar</button><button class="btn primary" onclick="JM.app.setCallStatus('${esc(c.id)}','Em Atendimento')">Atender</button><button class="btn" onclick="JM.app.setCallStatus('${esc(c.id)}','Finalizado')">Finalizar</button></td>
      </tr>`;
    }).join("") + `</tbody></table>`;
  }

  $("callForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!isOffice()) return toast("Somente equipe autorizada pode registrar chamado.", "danger");
    const originAddress = addressFromInputs("origin");
    const destinationAddress = addressFromInputs("destination");
    if (!originAddress || !originAddress.coords) {
      return toast("Antes de registrar, informe a origem por link de mapa ou latitude/longitude real.", "danger");
    }
    const best = bestSmartRoute();
    const selectedVehicle = state.vehicles[$("callVehicle").value] || null;
    const routePoints = [];
    if (selectedVehicle && selectedVehicle.location) routePoints.push(selectedVehicle.location);
    routePoints.push(originAddress.coords);
    if (destinationAddress && destinationAddress.coords) routePoints.push(destinationAddress.coords);
    const protocolo = "JM-" + new Date().toISOString().replace(/\D/g, "").slice(2, 14);
    const data = {
      protocolo,
      cliente: $("callClient").value.trim(),
      phone: $("callPhone").value.trim(),
      serviceType: $("callType").value,
      valor: parseMoney($("callPrice").value),
      vehicleId: $("callVehicle").value,
      driverId: $("callDriver").value,
      originLabel: originAddress.label,
      destLabel: destinationAddress && destinationAddress.label || "",
      origin: originAddress.coords,
      destination: destinationAddress && destinationAddress.coords || null,
      origem: originAddress,
      destino: destinationAddress || null,
      routeUrl: window.JM.googleMaps && window.JM.googleMaps.routeUrl(routePoints) || mapsRouteUrl(routePoints),
      routeMetrics: best ? {
        recommendedVehicleId: best.vehicle && best.vehicle.id || "",
        recommendedVehiclePlate: best.vehicle && best.vehicle.placa || "",
        bestToOrigin: best.toOrigin || null,
        serviceRoute: best.serviceRoute || null,
        calculatedAt: state.smartRoute && state.smartRoute.calculatedAt || new Date().toISOString(),
        algorithm: "tracker_position + free_leaflet_haversine_or_fallback + status_penalty"
      } : null,
      status: $("callDriver").value ? "Despachado" : "Novo",
      notes: $("callNotes").value.trim(),
      createdAt: new Date().toISOString(),
      createdBy: state.user.uid,
      timeline: [{ at: new Date().toISOString(), by: state.profile.nome || state.user.email, text: "Chamado criado com endereÃ§o validado e rota inteligente" }]
    };
    await db.collection("calls").add(data);
    e.target.reset();
    state.addresses = { origin: null, destination: null };
    state.smartRoute = null;
    renderSmartRouteBox();
    addressStatus("originGeoStatus", "Aguardando endereÃ§o lido com coordenadas.", "muted");
    addressStatus("destGeoStatus", "Destino opcional, mas recomendado para rota completa.", "muted");
    toast("Chamado registrado com dados de rota.", "ok");
  };

  async function setCallStatus(id, status) {
    if (!isOffice()) return toast("Somente equipe autorizada pode alterar status.", "danger");
    const call = state.calls[id];
    if (!call) return;
    const updates = {
      status,
      updatedAt: new Date().toISOString(),
      timeline: arrayUnion({ at: new Date().toISOString(), by: state.profile.nome || state.user.email, text: "Status alterado para " + status })
    };
    if (status === "Finalizado" && Number(call.valor || 0) > 0 && !call.financeCreated && isAdmin()) {
      updates.financeCreated = true;
      await db.collection("transactions").add({
        type: "entrada",
        date: todayInput(),
        description: `Chamado ${call.protocolo || id} - ${call.cliente || ""}`,
        amount: Number(call.valor || 0),
        status: "A receber",
        callId: id,
        vehicleId: call.vehicleId || "",
        createdAt: new Date().toISOString(),
        createdBy: state.user.uid
      });
    }
    await db.collection("calls").doc(id).update(updates);
    toast("Status atualizado.", "ok");
  }

  function renderVehicles() {
    const rows = Object.values(state.vehicles).sort((a, b) => String(a.placa || "").localeCompare(String(b.placa || "")));
    $("fleetTable").innerHTML = rows.length ? `<table><thead><tr><th>Placa</th><th>Tipo</th><th>Status</th><th>Tracker</th></tr></thead><tbody>` + rows.map((v) => `<tr><td><b>${esc(v.placa || v.id)}</b><br><span class="muted small">${esc(v.apelido || "")}</span></td><td>${esc(v.tipo || "")}</td><td><span class="badge info">${esc(v.status || "")}</span></td><td>${v.location ? `${esc(v.location.lat)}, ${esc(v.location.lng)}` : "Sem posiÃ§Ã£o"}</td></tr>`).join("") + `</tbody></table>` : `<p class="muted">Nenhum veÃ­culo.</p>`;

    $("vehicleCards").innerHTML = rows.length ? rows.map((v) => `<div class="card col-3"><b>${esc(v.placa || v.id)}</b><p class="muted small">${esc(v.apelido || v.tipo || "")}</p><span class="badge info">${esc(v.status || "")}</span><p class="small">${v.location ? `Lat ${esc(v.location.lat)}<br>Lng ${esc(v.location.lng)}` : "Sem posiÃ§Ã£o do tracker"}</p></div>`).join("") : `<p class="muted">Sem frota cadastrada.</p>`;
  }

  $("vehicleForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin()) return toast("Somente gestor/gerente pode editar frota.", "danger");
    const placa = plateKey($("vehiclePlate").value);
    if (!placa) return toast("Informe a placa.", "danger");
    await db.collection("vehicles").doc(placa).set({
      placa,
      apelido: $("vehicleAlias").value.trim(),
      tipo: $("vehicleType").value.trim(),
      status: $("vehicleStatus").value,
      updatedAt: new Date().toISOString(),
      updatedBy: state.user.uid
    }, { merge: true });
    e.target.reset();
    toast("VeÃ­culo salvo.", "ok");
  };

  function renderTeam() {
    const rows = Object.values(state.users).sort((a, b) => String(a.nome || a.email || "").localeCompare(String(b.nome || b.email || "")));
    $("teamTable").innerHTML = rows.length ? `<table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th></tr></thead><tbody>` +
      rows.map((u) => `<tr><td><b>${esc(u.nome || "")}</b><br><span class="muted small">${esc(u.uid || u.id)}</span></td><td>${esc(u.email || "")}</td><td><span class="badge info">${esc(u.role || "")}</span></td><td>${u.active === false ? "Inativo" : "Ativo"}</td></tr>`).join("") +
      `</tbody></table>` : `<p class="muted">Nenhum usuÃ¡rio.</p>`;
  }

  function roleLabel(role) {
    const labels = {
      admin: "Gestor/Admin",
      gestor: "Gestor",
      gerente: "Gerente",
      auxiliar: "Auxiliar",
      atendente: "Atendente",
      finance: "Financeiro",
      driver: "Motorista",
      motorista: "Motorista"
    };
    return labels[normalizedRole(role)] || role || "Equipe";
  }

  function roleCanAccessJM(role) {
    return OFFICE_ROLES.includes(normalizedRole(role));
  }

  $("teamForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin()) return toast("Somente gestor/gerente pode editar equipe.", "danger");
    const email = $("teamEmail").value.trim().toLowerCase();
    const pass = $("teamPass").value;
    const selectedRole = normalizedRole($("teamRole").value || "driver");
    const isDriverRole = DRIVER_ROLES.includes(selectedRole);
    const isOfficeRole = roleCanAccessJM(selectedRole);

    if (!isDriverRole && !isOfficeRole) return toast("Perfil invÃ¡lido.", "danger");
    if (isDriverRole && await emailReservedForManager(email)) {
      return toast("Este e-mail estÃ¡ liberado como gestor/equipe interna. Ele nÃ£o pode ser salvo como motorista.", "danger");
    }

    let uid = uidSafe(email);
    if (pass) {
      if (pass.length < 6) return toast("Informe uma senha inicial com pelo menos 6 caracteres.", "danger");
      try {
        const cred = await secondaryAuth.createUserWithEmailAndPassword(email, pass);
        uid = cred.user.uid;
        await secondaryAuth.signOut().catch(() => {});
      } catch (err) {
        if (err && err.code === "auth/email-already-in-use") {
          // Para gestor/gerente/atendente, o jm.html repara users/{uid} no primeiro login usando managerAccess/{email}.
          // Para motorista, o painel motorista tambem procura por e-mail e repara o UID quando possivel.
          uid = uidSafe(email);
        } else {
          return toast(friendlyAuthError(err), "danger");
        }
      }
    }

    const payload = {
      uid,
      nome: $("teamName").value.trim(),
      email,
      role: selectedRole,
      active: $("teamActive").value === "true",
      updatedAt: new Date().toISOString(),
      updatedBy: state.user.uid,
      source: "jm-teamForm"
    };

    await db.collection("users").doc(uid).set(payload, { merge: true });
    const accessPayload = Object.assign({ createdAt: new Date().toISOString() }, payload);
    if (isOfficeRole) {
      await db.collection("managerAccess").doc(email).set(accessPayload, { merge: true });
    }
    if (isDriverRole) {
      try {
        await db.collection("driverAccess").doc(email).set(accessPayload, { merge: true });
      } catch (err) {
        toast("Motorista salvo, mas driverAccess foi bloqueado. Publique as novas firestore.rules para liberar o primeiro login.", "danger");
        return;
      }
    }
    e.target.reset();
    toast(roleLabel(selectedRole) + " salvo na equipe.", "ok");
  };

  function renderDriverPanel() {
    const myCalls = Object.values(state.calls).filter((c) => isAdmin() || c.driverId === state.user?.uid);
    $("driverCalls").innerHTML = myCalls.length ? myCalls.map((c) => {
      const route = callRoutePoints(c);
      return `<div class="card" style="margin-bottom:12px"><div class="actions"><div><b>${esc(c.protocolo || c.cliente)}</b><br><span class="muted small">${esc(c.originLabel || "")} â†’ ${esc(c.destLabel || "")}</span></div><span class="badge ${statusClass(c.status)}">${esc(c.status || "")}</span></div><p>${esc(c.notes || "")}</p><p><b>${routeKm(c)} km</b></p>${route.origin && route.destination ? `<a class="btn primary" target="_blank" href="https://www.google.com/maps/dir/${route.origin.lat},${route.origin.lng}/${route.destination.lat},${route.destination.lng}">Abrir rota</a>` : ""}</div>`;
    }).join("") : `<p class="muted">Nenhum chamado.</p>`;
  }

  $("expenseForm") && ($("expenseForm").onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      callId: $("expenseCall").value,
      vehicleId: $("expenseVehicle").value,
      type: $("expenseType").value,
      amount: parseMoney($("expenseAmount").value),
      notes: $("expenseNotes").value.trim(),
      status: "pendente",
      driverId: state.user.uid,
      driverName: state.profile.nome || state.user.email,
      createdAt: new Date().toISOString()
    };
    await db.collection("expenses").add(data);
    e.target.reset();
    toast("Despesa enviada para aprovaÃ§Ã£o.", "ok");
  });

  function renderFinance() {
    const rows = Object.values(state.transactions).sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")));
    $("financeTable").innerHTML = `<table><thead><tr><th>Data</th><th>Tipo</th><th>DescriÃ§Ã£o</th><th>Status</th><th>Valor</th></tr></thead><tbody>` +
      rows.map((t) => `<tr><td>${esc(t.date || dateTime(t.createdAt))}</td><td>${esc(t.type || "")}</td><td>${esc(t.description || "")}</td><td>${esc(t.status || "")}</td><td><b>${money(t.amount || 0)}</b></td></tr>`).join("") +
      `</tbody></table>${reportSignature()}`;
    const pending = Object.values(state.expenses).filter((e) => e.status === "pendente");
    $("expenseApproval").innerHTML = `<table><thead><tr><th>Motorista</th><th>Tipo</th><th>Valor</th><th>Obs</th><th>AÃ§Ãµes</th></tr></thead><tbody>` +
      pending.map((e) => `<tr>
        <td>${esc(e.driverName || e.driverId)}</td><td>${esc(e.type || "")}</td><td><b>${money(e.amount || 0)}</b></td>
        <td>${esc(e.notes || "")}${e.photoUrl ? `<br><a class="info" href="${esc(e.photoUrl)}" target="_blank">Comprovante</a>` : ""}</td>
        <td><button class="btn good" onclick="JM.app.approveExpense('${esc(e.id)}')">Aprovar</button><button class="btn danger" onclick="JM.app.rejectExpense('${esc(e.id)}')">Reprovar</button></td>
      </tr>`).join("") + `</tbody></table>`;
  }

  $("financeForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin()) return toast("Somente gestor/financeiro pode lanÃ§ar.", "danger");
    await db.collection("transactions").add({
      type: $("finType").value,
      date: $("finDate").value,
      description: $("finDesc").value.trim(),
      amount: parseMoney($("finAmount").value),
      status: $("finStatus").value,
      createdAt: new Date().toISOString(),
      createdBy: state.user.uid
    });
    e.target.reset();
    $("finDate").value = todayInput();
    toast("LanÃ§amento salvo.", "ok");
  };

  async function approveExpense(id) {
    const expense = state.expenses[id];
    if (!expense || !isAdmin()) return;
    await db.collection("expenses").doc(id).update({ status: "aprovado", approvedAt: new Date().toISOString(), approvedBy: state.user.uid });
    await db.collection("transactions").add({
      type: "saida",
      date: todayInput(),
      description: `Despesa ${expense.type || ""} - ${expense.driverName || ""}`,
      amount: Number(expense.amount || 0),
      status: "Pendente",
      expenseId: id,
      callId: expense.callId || "",
      vehicleId: expense.vehicleId || "",
      createdAt: new Date().toISOString(),
      createdBy: state.user.uid
    });
    toast("Despesa aprovada e lanÃ§ada no financeiro.", "ok");
  }

  async function rejectExpense(id) {
    if (!isAdmin()) return;
    await db.collection("expenses").doc(id).update({ status: "reprovado", rejectedAt: new Date().toISOString(), rejectedBy: state.user.uid });
    toast("Despesa reprovada.", "ok");
  }

  function refreshMaps() {
    const active = document.querySelector(".view.active");
    if (!active) return;
    if (active.id === "view-dashboard") window.JM.mapa.renderFleetMap("dashboardMap", state.vehicles, state.calls);
    if (active.id === "view-mapa") window.JM.mapa.renderFleetMap("fleetMap", state.vehicles, state.calls);
  }

  function registerFreshServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("service-worker.js?v=" + LOGIN_FLOW_VERSION).catch(() => {});
  }

  function bindRouteButtons() {
    if ($("btnGeocodeOrigin")) $("btnGeocodeOrigin").onclick = () => geocodeAddress("origin");
    if ($("btnGeocodeDest")) $("btnGeocodeDest").onclick = () => geocodeAddress("destination");
    if ($("btnUseCurrentLocation")) $("btnUseCurrentLocation").onclick = useCurrentLocationAsOrigin;
    if ($("btnSmartRoute")) $("btnSmartRoute").onclick = calculateSmartRoute;
    if ($("btnOpenGoogleRoute")) $("btnOpenGoogleRoute").onclick = openGoogleRouteFromForm;
    if ($("btnSyncTrackerNow")) $("btnSyncTrackerNow").onclick = () => syncTrackerNow(true);
  }

  function boot() {
    bindNavigation();
    bindRouteButtons();
    renderSmartRouteBox();
    initializeAddressTools();
    $("finDate").value = todayInput();
    console.info("JM Guinchos login flow", LOGIN_FLOW_VERSION);
    registerFreshServiceWorker();
  }

  window.JM = window.JM || {};
  window.JM.app = { setCallStatus, approveExpense, rejectExpense, applySmartVehicle, calculateSmartRoute, syncTrackerNow, state };
  boot();
}());
