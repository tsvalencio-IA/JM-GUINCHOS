(function () {
  "use strict";

  const { $, $all, esc, money, parseMoney, dateTime, todayInput, plateKey, uidSafe, coords, callRoutePoints, routeKm, toast, statusClass } = window.JM.utils;
  const { auth, secondaryAuth, db, ts, arrayUnion, emailIsAdmin } = window.JM.firebase;
  const cfg = window.JM_CONFIG || {};
  const SYSTEM_SIGNATURE = "Powered by thIAguinho Soluções Digitais";
  const LOGIN_FLOW_VERSION = "jm-login-definitivo-v9";

  const state = {
    user: null,
    profile: null,
    vehicles: {},
    calls: {},
    users: {},
    expenses: {},
    transactions: {},
    settings: {}
  };

  const unsubscribers = [];
  const GESTOR_ROLES = ["admin", "finance", "superadmin", "gestor", "owner", "manager"];
  const DRIVER_ROLES = ["driver", "motorista"];

  function normalizedRole(role) {
    return String(role || "").toLowerCase().trim();
  }

  function isAdmin() {
    return state.profile && GESTOR_ROLES.includes(normalizedRole(state.profile.role));
  }

  function activeCloudinaryConfig() {
    return Object.assign({}, cfg.cloudinary || {}, state.settings.cloudinary || {});
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
    // Mantém a trava por lista de e-mails quando ela existir.
    // Se a lista estiver vazia/removida, o sistema permite o primeiro gestor criar o perfil.
    const list = [
      ...(authCfg.adminEmails || []),
      ...(authCfg.superadminEmails || [])
    ].map((e) => String(e).toLowerCase().trim()).filter(Boolean);
    if (!list.length) return true;
    return emailIsAdmin(user.email);
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
      throw new Error("Este usuário está inativo no cadastro da JM Guinchos.");
    }

    const baseProfile = {
      uid: user.uid,
      email: user.email,
      nome: (current && current.nome) || user.displayName || user.email.split("@")[0],
      active: true,
      updatedAt: ts()
    };

    if (current && GESTOR_ROLES.includes(normalizedRole(current.role))) {
      return { ...current, role: normalizedRole(current.role) === "finance" ? "finance" : "admin" };
    }

    if (!gestorAccessAllowedByConfig(user)) {
      throw new Error("Este e-mail não está liberado como gestor em js/config.firebase.js. Adicione o e-mail em auth.adminEmails/superadminEmails e publique novamente.");
    }

    // Correção definitiva do bug: jm.html é painel gestor.
    // Se o usuário foi criado como driver/motorista por fluxo antigo, repara para admin.
    const repairedProfile = {
      ...baseProfile,
      role: "admin",
      loginFixedAt: new Date().toISOString(),
      loginFlowVersion: LOGIN_FLOW_VERSION
    };

    try {
      return await saveGestorProfile(ref, repairedProfile, current || null);
    } catch (err) {
      if (err && err.code === "permission-denied") {
        throw new Error("O login foi aceito, mas o Firestore bloqueou a correção do perfil. Publique as novas firestore.rules deste ZIP ou altere o documento users/" + user.uid + " para role: admin.");
      }
      throw err;
    }
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
    ["vehicles", "calls", "users", "expenses", "transactions"].forEach((name) => listenCollection(name, name));
    const settingsUnsub = db.collection("settings").doc("integrations").onSnapshot((snap) => {
      state.settings = snap.exists ? snap.data() : {};
      renderAll();
    });
    unsubscribers.push(settingsUnsub);
  }

  function stopListeners() {
    unsubscribers.splice(0).forEach((fn) => fn());
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
      $("loginError").textContent = err && err.message ? err.message : "Acesso de gestor não autorizado.";
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
      return "Usuário ou senha inválidos. O acesso de gestor deve existir no Firebase Authentication.";
    }
    if (code === "auth/operation-not-allowed") {
      return "Ative o provedor E-mail/Senha no Firebase Authentication.";
    }
    if (code === "auth/too-many-requests") {
      return "Muitas tentativas. Aguarde alguns minutos ou redefina a senha no Firebase.";
    }
    return "Acesso negado: " + (err && err.message || "falha de autenticação");
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

  function renderSelects() {
    const vehicleOptions = Object.values(state.vehicles).map((v) => `<option value="${esc(v.id)}">${esc(v.placa || v.id)} - ${esc(v.apelido || v.tipo || "")}</option>`).join("");
    ["callVehicle", "expenseVehicle"].forEach((id) => { if ($(id)) $(id).innerHTML = `<option value="">Selecione</option>${vehicleOptions}`; });
    const drivers = Object.values(state.users).filter((u) => u.active !== false && ["driver", "motorista", "admin"].includes(normalizedRole(u.role)));
    if ($("callDriver")) $("callDriver").innerHTML = `<option value="">Selecione</option>` + drivers.map((u) => `<option value="${esc(u.id)}">${esc(u.nome || u.email)}</option>`).join("");
    const myCalls = Object.values(state.calls).filter((c) => c.driverId === state.user?.uid && !["Finalizado", "Cancelado"].includes(c.status));
    if ($("expenseCall")) $("expenseCall").innerHTML = `<option value="">Sem chamado</option>` + myCalls.map((c) => `<option value="${esc(c.id)}">${esc(c.protocolo || c.cliente)}</option>`).join("");
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
    $("callsTable").innerHTML = `<table><thead><tr><th>Protocolo</th><th>Cliente</th><th>Origem/Destino</th><th>Veículo</th><th>Status</th><th>Ações</th></tr></thead><tbody>` + rows.map((c) => {
      const vehicle = state.vehicles[c.vehicleId] || {};
      const driver = state.users[c.driverId] || {};
      return `<tr>
        <td><b>${esc(c.protocolo || c.id)}</b><br><span class="muted small">${dateTime(c.createdAt)}</span></td>
        <td>${esc(c.cliente || "")}<br><span class="muted small">${esc(c.phone || "")}</span></td>
        <td><span class="small">${esc(c.originLabel || "-")}</span><br><span class="muted small">→ ${esc(c.destLabel || "-")}</span><br><b>${routeKm(c)} km</b></td>
        <td>${esc(vehicle.placa || "-")}<br><span class="muted small">${esc(driver.nome || driver.email || "Sem motorista")}</span></td>
        <td><span class="badge ${statusClass(c.status)}">${esc(c.status || "Novo")}</span><br><b>${money(c.valor || 0)}</b></td>
        <td class="row-actions"><button class="btn good" onclick="JM.app.setCallStatus('${esc(c.id)}','Despachado')">Despachar</button><button class="btn primary" onclick="JM.app.setCallStatus('${esc(c.id)}','Em Atendimento')">Atender</button><button class="btn" onclick="JM.app.setCallStatus('${esc(c.id)}','Finalizado')">Finalizar</button></td>
      </tr>`;
    }).join("") + `</tbody></table>`;
  }

  $("callForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin()) return toast("Somente gestor pode registrar chamado.", "danger");
    const protocolo = "JM-" + new Date().toISOString().replace(/\D/g, "").slice(2, 14);
    const data = {
      protocolo,
      cliente: $("callClient").value.trim(),
      phone: $("callPhone").value.trim(),
      serviceType: $("callType").value,
      valor: parseMoney($("callPrice").value),
      vehicleId: $("callVehicle").value,
      driverId: $("callDriver").value,
      originLabel: $("callOriginLabel").value.trim(),
      destLabel: $("callDestLabel").value.trim(),
      origin: coords($("callOriginLat").value, $("callOriginLng").value),
      destination: coords($("callDestLat").value, $("callDestLng").value),
      status: $("callDriver").value ? "Despachado" : "Novo",
      notes: $("callNotes").value.trim(),
      createdAt: new Date().toISOString(),
      createdBy: state.user.uid,
      timeline: [{ at: new Date().toISOString(), by: state.profile.nome || state.user.email, text: "Chamado criado" }]
    };
    await db.collection("calls").add(data);
    e.target.reset();
    toast("Chamado registrado.", "ok");
  };

  async function setCallStatus(id, status) {
    if (!isAdmin()) return toast("Somente gestor pode alterar status.", "danger");
    const call = state.calls[id];
    if (!call) return;
    const updates = {
      status,
      updatedAt: new Date().toISOString(),
      timeline: arrayUnion({ at: new Date().toISOString(), by: state.profile.nome || state.user.email, text: "Status alterado para " + status })
    };
    if (status === "Finalizado" && Number(call.valor || 0) > 0 && !call.financeCreated) {
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
    $("fleetTable").innerHTML = rows.length ? `<table><thead><tr><th>Placa</th><th>Tipo</th><th>Status</th><th>Tracker</th></tr></thead><tbody>` + rows.map((v) => `<tr><td><b>${esc(v.placa || v.id)}</b><br><span class="muted small">${esc(v.apelido || "")}</span></td><td>${esc(v.tipo || "")}</td><td><span class="badge info">${esc(v.status || "")}</span></td><td>${v.location ? `${esc(v.location.lat)}, ${esc(v.location.lng)}` : "Sem posição"}</td></tr>`).join("") + `</tbody></table>` : `<p class="muted">Nenhum veículo.</p>`;

    $("vehicleCards").innerHTML = rows.length ? rows.map((v) => `<div class="card col-3"><b>${esc(v.placa || v.id)}</b><p class="muted small">${esc(v.apelido || v.tipo || "")}</p><span class="badge info">${esc(v.status || "")}</span><p class="small">${v.location ? `Lat ${esc(v.location.lat)}<br>Lng ${esc(v.location.lng)}` : "Sem posição do tracker"}</p></div>`).join("") : `<p class="muted">Sem frota cadastrada.</p>`;
  }

  $("vehicleForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin()) return toast("Somente gestor pode editar frota.", "danger");
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
    toast("Veículo salvo.", "ok");
  };

  function renderTeam() {
    const rows = Object.values(state.users).sort((a, b) => String(a.nome || a.email || "").localeCompare(String(b.nome || b.email || "")));
    $("teamTable").innerHTML = rows.length ? `<table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th></tr></thead><tbody>` +
      rows.map((u) => `<tr><td><b>${esc(u.nome || "")}</b><br><span class="muted small">${esc(u.uid || u.id)}</span></td><td>${esc(u.email || "")}</td><td><span class="badge info">${esc(u.role || "")}</span></td><td>${u.active === false ? "Inativo" : "Ativo"}</td></tr>`).join("") +
      `</tbody></table>` : `<p class="muted">Nenhum usuário.</p>`;
  }

  $("teamForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin()) return toast("Somente gestor pode editar equipe.", "danger");
    const email = $("teamEmail").value.trim().toLowerCase();
    const pass = $("teamPass").value;
    let uid = uidSafe(email);
    if (pass) {
      if (pass.length < 6) return toast("Informe uma senha inicial com pelo menos 6 caracteres para criar o motorista no Auth.", "danger");
      try {
        const cred = await secondaryAuth.createUserWithEmailAndPassword(email, pass);
        uid = cred.user.uid;
        await secondaryAuth.signOut().catch(() => {});
      } catch (err) {
        if (err && err.code === "auth/email-already-in-use") {
          return toast("Este e-mail já existe no Firebase Auth, mas ainda não há cadastro em Equipe. Cadastre manualmente pelo UID ou redefina o usuário no Firebase.", "danger");
        }
        return toast(friendlyAuthError(err), "danger");
      }
    }
    await db.collection("users").doc(uid).set({
      uid,
      nome: $("teamName").value.trim(),
      email,
      role: $("teamRole").value,
      active: $("teamActive").value === "true",
      updatedAt: new Date().toISOString(),
      updatedBy: state.user.uid
    }, { merge: true });
    e.target.reset();
    toast("Motorista salvo.", "ok");
  };

  function renderDriverPanel() {
    const myCalls = Object.values(state.calls).filter((c) => isAdmin() || c.driverId === state.user?.uid);
    $("driverCalls").innerHTML = myCalls.length ? myCalls.map((c) => {
      const route = callRoutePoints(c);
      return `<div class="card" style="margin-bottom:12px"><div class="actions"><div><b>${esc(c.protocolo || c.cliente)}</b><br><span class="muted small">${esc(c.originLabel || "")} → ${esc(c.destLabel || "")}</span></div><span class="badge ${statusClass(c.status)}">${esc(c.status || "")}</span></div><p>${esc(c.notes || "")}</p><p><b>${routeKm(c)} km</b></p>${route.origin && route.destination ? `<a class="btn primary" target="_blank" href="https://www.google.com/maps/dir/${route.origin.lat},${route.origin.lng}/${route.destination.lat},${route.destination.lng}">Abrir rota</a>` : ""}</div>`;
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
    toast("Despesa enviada para aprovação.", "ok");
  });

  function renderFinance() {
    const rows = Object.values(state.transactions).sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")));
    $("financeTable").innerHTML = `<table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Status</th><th>Valor</th></tr></thead><tbody>` +
      rows.map((t) => `<tr><td>${esc(t.date || dateTime(t.createdAt))}</td><td>${esc(t.type || "")}</td><td>${esc(t.description || "")}</td><td>${esc(t.status || "")}</td><td><b>${money(t.amount || 0)}</b></td></tr>`).join("") +
      `</tbody></table>${reportSignature()}`;
    const pending = Object.values(state.expenses).filter((e) => e.status === "pendente");
    $("expenseApproval").innerHTML = `<table><thead><tr><th>Motorista</th><th>Tipo</th><th>Valor</th><th>Obs</th><th>Ações</th></tr></thead><tbody>` +
      pending.map((e) => `<tr>
        <td>${esc(e.driverName || e.driverId)}</td><td>${esc(e.type || "")}</td><td><b>${money(e.amount || 0)}</b></td>
        <td>${esc(e.notes || "")}${e.photoUrl ? `<br><a class="info" href="${esc(e.photoUrl)}" target="_blank">Comprovante</a>` : ""}</td>
        <td><button class="btn good" onclick="JM.app.approveExpense('${esc(e.id)}')">Aprovar</button><button class="btn danger" onclick="JM.app.rejectExpense('${esc(e.id)}')">Reprovar</button></td>
      </tr>`).join("") + `</tbody></table>`;
  }

  $("financeForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin()) return toast("Somente gestor/financeiro pode lançar.", "danger");
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
    toast("Lançamento salvo.", "ok");
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
    toast("Despesa aprovada e lançada no financeiro.", "ok");
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

  function boot() {
    bindNavigation();
    $("finDate").value = todayInput();
    console.info("JM Guinchos login flow", LOGIN_FLOW_VERSION);
    registerFreshServiceWorker();
  }

  window.JM = window.JM || {};
  window.JM.app = { setCallStatus, approveExpense, rejectExpense, state };
  boot();
}());
