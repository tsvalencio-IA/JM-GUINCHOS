(function () {
  "use strict";

  const { $, $all, esc, money, parseMoney, dateTime, todayInput, plateKey, uidSafe, coords, callRoutePoints, routeKm, toast, statusClass } = window.JM.utils;
  const { auth, secondaryAuth, db, ts, arrayUnion, emailIsAdmin } = window.JM.firebase;
  const cfg = window.JM_CONFIG || {};
  const SYSTEM_SIGNATURE = "Powered by thIAguinho Soluções Digitais";

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
  let trackerTimer = null;

  function isAdmin() {
    return state.profile && ["admin", "finance"].includes(state.profile.role);
  }

  function activeTrackerConfig() {
    return Object.assign({}, cfg.tracker || {}, state.settings.tracker || {});
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

  async function ensureProfile(user) {
    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();
    if (snap.exists) return { id: user.uid, ...snap.data() };
    const role = emailIsAdmin(user.email) ? "admin" : "driver";
    const profile = {
      uid: user.uid,
      email: user.email,
      nome: user.displayName || user.email.split("@")[0],
      role,
      active: true,
      createdAt: ts(),
      updatedAt: ts()
    };
    await ref.set(profile, { merge: true });
    return { id: user.uid, ...profile };
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
    if (trackerTimer) clearInterval(trackerTimer);
    trackerTimer = null;
  }

  function applyRoleVisibility() {
    const allowed = isAdmin();
    ["financeiro", "frota", "equipe"].forEach((view) => {
      const btn = document.querySelector(`#navButtons button[data-view="${view}"]`);
      if (btn) btn.classList.toggle("hidden", !allowed);
    });
    if (!allowed) showView("motorista");
  }

  auth.onAuthStateChanged(async (user) => {
    stopListeners();
    state.user = user || null;
    if (!user) {
      $("loginView").classList.remove("hidden");
      $("appView").classList.add("hidden");
      return;
    }
    $("loginView").classList.add("hidden");
    $("appView").classList.remove("hidden");
    state.profile = await ensureProfile(user);
    if (!["admin", "finance"].includes(state.profile.role)) {
      window.location.href = "motorista.html";
      return;
    }
    $("userBox").innerHTML = `<b>${esc(state.profile.nome || user.email)}</b><br>${esc(user.email)}<br><span class="badge info">${esc(state.profile.role)}</span>`;
    applyRoleVisibility();
    startListeners();
    startTrackerPolling();
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
      return "Usuário ou senha inválidos. Se ainda não criou o usuário no Firebase Auth, use Criar primeiro acesso gestor.";
    }
    if (code === "auth/operation-not-allowed") {
      return "Ative o provedor E-mail/Senha no Firebase Authentication.";
    }
    if (code === "auth/too-many-requests") {
      return "Muitas tentativas. Aguarde alguns minutos ou redefina a senha no Firebase.";
    }
    return "Acesso negado: " + (err && err.message || "falha de autenticação");
  }

  async function createFirstAdminAccess() {
    const email = $("loginEmail").value.trim().toLowerCase();
    const pass = $("loginPass").value;
    $("loginError").textContent = "";
    if (!email || !pass) {
      $("loginError").textContent = "Informe e-mail e senha antes de criar o primeiro acesso.";
      return;
    }
    if (!emailIsAdmin(email)) {
      $("loginError").textContent = "Este e-mail não está liberado como gestor em js/config.firebase.js.";
      return;
    }
    if (pass.length < 6) {
      $("loginError").textContent = "A senha precisa ter pelo menos 6 caracteres.";
      return;
    }
    try {
      await auth.createUserWithEmailAndPassword(email, pass);
      toast("Primeiro acesso criado. Entrando no sistema.", "ok");
    } catch (err) {
      if (err && err.code === "auth/email-already-in-use") {
        $("loginError").textContent = "Este usuário já existe no Firebase Auth. Use Entrar ou redefina a senha no Firebase.";
        return;
      }
      $("loginError").textContent = friendlyAuthError(err);
    }
  }

  $("firstAccessBtn").onclick = createFirstAdminAccess;

  function startTrackerPolling() {
    const ms = Math.max(15000, Number(activeTrackerConfig().pollingMs || 30000));
    if (trackerTimer) clearInterval(trackerTimer);
    trackerTimer = setInterval(syncTracker, ms);
    syncTracker().catch(() => {});
  }

  async function syncTracker() {
    try {
      const trackerConfig = activeTrackerConfig();
      if (!trackerConfig.endpoint || !trackerConfig.token) {
        $("trackerStatus").textContent = "Tracker ainda não configurado no superadmin.";
        toast("Configure endpoint e token no superadmin para exibir posições reais.", "info");
        return;
      }
      $("trackerStatus").textContent = "Sincronizando Tracker...";
      const positions = await window.JM.tracker.syncTrackerToFirestore(trackerConfig, db, state.vehicles);
      $("trackerStatus").textContent = `${positions.length} posição(ões) sincronizada(s) do Tracker`;
      toast("Tracker sincronizado.", "ok");
    } catch (err) {
      console.error(err);
      $("trackerStatus").textContent = "Tracker indisponível: " + err.message;
      toast("Tracker indisponível: " + err.message, "danger");
    }
  }

  $("syncTrackerBtn").onclick = () => syncTracker();

  async function seedBase() {
    if (!isAdmin()) return toast("Somente gestor pode criar a base.", "danger");
    const batch = db.batch();
    const now = new Date().toISOString();
    Object.entries((cfg.tracker && cfg.tracker.vehicles) || {}).forEach(([id, vehicle], index) => {
      batch.set(db.collection("vehicles").doc(id), {
        placa: vehicle.placa || id,
        apelido: vehicle.apelido || "",
        tipo: vehicle.tipo || "",
        trackerId: vehicle.trackerId || id,
        status: "Disponível",
        updatedAt: now
      }, { merge: true });
    });
    batch.set(db.collection("settings").doc("integrations"), {
      tracker: activeTrackerConfig(),
      cloudinary: activeCloudinaryConfig(),
      updatedAt: now
    }, { merge: true });
    await batch.commit();
    toast("Base JM criada/atualizada com FHA4B30 e DAJ6J95.", "ok");
  }
  $("seedBtn").onclick = seedBase;

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
    const drivers = Object.values(state.users).filter((u) => u.active !== false && ["driver", "admin"].includes(u.role));
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
    $("timelineBox").innerHTML = calls.sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0)).slice(0, 8).map((c) => `
      <div class="timeline-item">
        <b>${esc(c.protocolo || c.id)}</b> <span class="badge ${statusClass(c.status)}">${esc(c.status || "Novo")}</span>
        <div class="muted small">${esc(c.cliente || "")} - ${esc(c.serviceType || "")}</div>
      </div>
    `).join("") || `<p class="muted">Sem eventos ainda.</p>`;
  }

  function callButtons(call) {
    if (!isAdmin()) return "";
    const id = esc(call.id);
    return `<div class="actions">
      <button class="btn warn" onclick="JM.app.setCallStatus('${id}','Despachado')">Despachar</button>
      <button class="btn primary" onclick="JM.app.setCallStatus('${id}','Em Atendimento')">Atender</button>
      <button class="btn good" onclick="JM.app.setCallStatus('${id}','Finalizado')">Finalizar</button>
      <button class="btn danger" onclick="JM.app.setCallStatus('${id}','Cancelado')">Cancelar</button>
    </div>`;
  }

  function renderCalls() {
    const calls = Object.values(state.calls).sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
    $("callsTable").innerHTML = `<table><thead><tr><th>Status</th><th>Cliente</th><th>Rota</th><th>Equipe</th><th>Valor</th><th>Ações</th></tr></thead><tbody>` +
      calls.map((c) => {
        const vehicle = state.vehicles[c.vehicleId] || {};
        const driver = state.users[c.driverId] || {};
        const pts = callRoutePoints(c, vehicle);
        return `<tr>
          <td><span class="badge ${statusClass(c.status)}">${esc(c.status || "Novo")}</span><br><span class="muted small">${esc(c.protocolo || "")}</span></td>
          <td><b>${esc(c.cliente || "")}</b><br><span class="muted small">${esc(c.telefone || "")}</span></td>
          <td>${esc(c.origem?.label || "-")}<br><span class="muted small">Destino: ${esc(c.destino?.label || "-")} | ${routeKm(pts).toFixed(1)} km estimados</span></td>
          <td>${esc(vehicle.placa || "-")}<br><span class="muted small">${esc(driver.nome || driver.email || "Sem motorista")}</span></td>
          <td><b>${money(c.valor || 0)}</b></td>
          <td>${callButtons(c)}</td>
        </tr>`;
      }).join("") + `</tbody></table>${reportSignature()}`;
  }

  $("callForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin()) return toast("Somente gestor pode registrar chamado.", "danger");
    const originCoords = coords($("callOriginLat").value, $("callOriginLng").value);
    const destCoords = coords($("callDestLat").value, $("callDestLng").value);
    const protocolo = "JM-" + new Date().toISOString().replace(/\D/g, "").slice(2, 14);
    const doc = {
      protocolo,
      cliente: $("callClient").value.trim(),
      telefone: $("callPhone").value.trim(),
      serviceType: $("callType").value,
      valor: parseMoney($("callPrice").value),
      vehicleId: $("callVehicle").value,
      driverId: $("callDriver").value,
      origem: { label: $("callOriginLabel").value.trim(), coords: originCoords },
      destino: { label: $("callDestLabel").value.trim(), coords: destCoords },
      notes: $("callNotes").value.trim(),
      status: $("callDriver").value ? "Despachado" : "Novo",
      paymentStatus: "A receber",
      createdBy: state.user.uid,
      createdAt: new Date().toISOString(),
      createdAtMs: Date.now(),
      updatedAt: Date.now(),
      timeline: [{ at: new Date().toISOString(), by: state.profile.nome || state.user.email, text: "Chamado registrado." }]
    };
    await db.collection("calls").add(doc);
    e.target.reset();
    toast("Chamado registrado.", "ok");
  };

  async function setCallStatus(id, status) {
    const call = state.calls[id];
    if (!call) return;
    const updates = {
      status,
      updatedAt: Date.now(),
      timeline: arrayUnion({ at: new Date().toISOString(), by: state.profile.nome || state.user.email, text: "Status alterado para " + status })
    };
    if (status === "Finalizado" && Number(call.valor || 0) > 0 && !call.financeCreated) {
      updates.financeCreated = true;
      await db.collection("transactions").add({
        type: "entrada",
        description: "Recebimento chamado " + (call.protocolo || id) + " - " + (call.cliente || ""),
        amount: Number(call.valor || 0),
        status: "A receber",
        callId: id,
        vehicleId: call.vehicleId || "",
        date: todayInput(),
        createdAt: new Date().toISOString(),
        createdBy: state.user.uid
      });
    }
    await db.collection("calls").doc(id).update(updates);
    toast("Chamado atualizado.", "ok");
  }

  function renderVehicles() {
    const rows = Object.values(state.vehicles).sort((a, b) => String(a.placa).localeCompare(String(b.placa)));
    $("fleetTable").innerHTML = `<table><thead><tr><th>Placa</th><th>Tipo</th><th>Status</th><th>Tracker</th><th>Última posição</th></tr></thead><tbody>` +
      rows.map((v) => `<tr>
        <td><b>${esc(v.placa || v.id)}</b><br><span class="muted small">${esc(v.apelido || "")}</span></td>
        <td>${esc(v.tipo || "")}</td>
        <td><span class="badge ${statusClass(v.status)}">${esc(v.status || "")}</span></td>
        <td>${esc(v.trackerId || "")}<br><span class="muted small">${esc(v.trackerStatus || "")}</span></td>
        <td>${v.location ? `${Number(v.location.lat).toFixed(5)}, ${Number(v.location.lng).toFixed(5)}` : "-"}<br><span class="muted small">${esc(v.lastTrackerAt || "")}</span></td>
      </tr>`).join("") + `</tbody></table>${reportSignature()}`;
    $("vehicleCards").innerHTML = rows.map((v) => `<div class="card col-3">
      <h3>${esc(v.placa || v.id)}</h3>
      <p class="muted small">${esc(v.apelido || v.tipo || "")}</p>
      <p><span class="badge ${statusClass(v.status)}">${esc(v.status || "Sem status")}</span></p>
      <p class="small">Tracker: ${esc(v.trackerId || "-")}</p>
    </div>`).join("");
  }

  $("vehicleForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin()) return toast("Somente gestor pode editar frota.", "danger");
    const id = plateKey($("vehiclePlate").value);
    if (!id) return toast("Placa obrigatória.", "danger");
    await db.collection("vehicles").doc(id).set({
      placa: id,
      apelido: $("vehicleAlias").value.trim(),
      tipo: $("vehicleType").value.trim(),
      trackerId: $("vehicleTracker").value.trim() || id,
      status: $("vehicleStatus").value,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    e.target.reset();
    toast("Veículo salvo.", "ok");
  };

  function renderTeam() {
    const rows = Object.values(state.users).sort((a, b) => String(a.nome || a.email).localeCompare(String(b.nome || b.email)));
    $("teamTable").innerHTML = `<table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th></tr></thead><tbody>` +
      rows.map((u) => `<tr><td><b>${esc(u.nome || "")}</b><br><span class="muted small">${esc(u.uid || u.id)}</span></td><td>${esc(u.email || "")}</td><td><span class="badge info">${esc(u.role || "")}</span></td><td>${u.active === false ? "Inativo" : "Ativo"}</td></tr>`).join("") +
      `</tbody></table>${reportSignature()}`;
  }

  $("teamForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin()) return toast("Somente gestor pode editar equipe.", "danger");
    const email = $("teamEmail").value.trim().toLowerCase();
    const pass = $("teamPass") ? $("teamPass").value : "";
    let id = "";
    const existing = Object.values(state.users).find((u) => String(u.email || "").toLowerCase() === email);
    if (existing) {
      id = existing.id;
    } else {
      if (!pass || pass.length < 6) return toast("Informe uma senha inicial com pelo menos 6 caracteres para criar o motorista no Auth.", "danger");
      try {
        const cred = await secondaryAuth.createUserWithEmailAndPassword(email, pass);
        id = cred.user.uid;
        await secondaryAuth.signOut().catch(() => {});
      } catch (err) {
        if (err && err.code === "auth/email-already-in-use") {
          return toast("Este e-mail já existe no Firebase Auth, mas ainda não há cadastro em Equipe. Cadastre manualmente pelo UID ou redefina o usuário no Firebase.", "danger");
        }
        return toast(friendlyAuthError(err), "danger");
      }
    }
    await db.collection("users").doc(id).set({
      uid: id,
      nome: $("teamName").value.trim(),
      email,
      role: $("teamRole").value,
      active: $("teamActive").value === "true",
      updatedAt: new Date().toISOString()
    }, { merge: true });
    e.target.reset();
    toast("Colaborador salvo.", "ok");
  };

  function renderDriverPanel() {
    const myCalls = Object.values(state.calls).filter((c) => isAdmin() || c.driverId === state.user?.uid);
    $("driverCalls").innerHTML = myCalls.length ? myCalls.map((c) => {
      const vehicle = state.vehicles[c.vehicleId] || {};
      return `<div class="card" style="margin-bottom:10px">
        <div class="actions" style="justify-content:space-between">
          <div><b>${esc(c.protocolo || c.id)}</b><br><span class="muted small">${esc(c.cliente || "")} - ${esc(vehicle.placa || "")}</span></div>
          <span class="badge ${statusClass(c.status)}">${esc(c.status || "")}</span>
        </div>
        <p class="small"><b>Origem:</b> ${esc(c.origem?.label || "-")}<br><b>Destino:</b> ${esc(c.destino?.label || "-")}</p>
        <div class="actions">
          <button class="btn primary" onclick="JM.app.setCallStatus('${esc(c.id)}','Em Atendimento')">Iniciar</button>
          <button class="btn good" onclick="JM.app.setCallStatus('${esc(c.id)}','Finalizado')">Finalizar</button>
        </div>
      </div>`;
    }).join("") + reportSignature() : `<p class="muted">Nenhum chamado vinculado ao seu usuário.</p>${reportSignature()}`;
  }

  async function uploadToCloudinary(file) {
    const cloud = activeCloudinaryConfig();
    if (!file || !cloud.cloudName || !cloud.uploadPreset) return "";
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", cloud.uploadPreset);
    form.append("folder", cloud.folder || "jm-guinchos");
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud.cloudName}/upload`, { method: "POST", body: form });
    if (!response.ok) throw new Error("Cloudinary recusou o upload.");
    const data = await response.json();
    return data.secure_url || "";
  }

  if ($("expenseForm")) $("expenseForm").onsubmit = async (e) => {
    e.preventDefault();
    const photo = $("expensePhoto").files && $("expensePhoto").files[0];
    let photoUrl = "";
    try { photoUrl = await uploadToCloudinary(photo); } catch (err) { toast("Foto não enviada: " + err.message, "danger"); }
    await db.collection("expenses").add({
      callId: $("expenseCall").value,
      vehicleId: $("expenseVehicle").value,
      type: $("expenseType").value,
      amount: parseMoney($("expenseAmount").value),
      notes: $("expenseNotes").value.trim(),
      photoUrl,
      status: "pendente",
      driverId: state.user.uid,
      driverName: state.profile.nome || state.user.email,
      createdAt: new Date().toISOString(),
      createdBy: state.user.uid
    });
    e.target.reset();
    toast("Despesa enviada para aprovação.", "ok");
  };

  function renderFinance() {
    const transactions = Object.values(state.transactions).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    $("financeTable").innerHTML = `<table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Status</th><th>Valor</th></tr></thead><tbody>` +
      transactions.map((t) => `<tr><td>${esc(t.date || dateTime(t.createdAt))}</td><td><span class="badge ${t.type === "entrada" ? "ok" : "danger"}">${esc(t.type)}</span></td><td>${esc(t.description || "")}</td><td>${esc(t.status || "")}</td><td><b>${money(t.amount || 0)}</b></td></tr>`).join("") +
      `</tbody></table>${reportSignature()}`;
    const pending = Object.values(state.expenses).filter((e) => e.status === "pendente");
    $("expenseApproval").innerHTML = `<table><thead><tr><th>Motorista</th><th>Tipo</th><th>Valor</th><th>Obs</th><th>Ações</th></tr></thead><tbody>` +
      pending.map((e) => `<tr>
        <td>${esc(e.driverName || e.driverId)}</td><td>${esc(e.type || "")}</td><td><b>${money(e.amount || 0)}</b></td>
        <td>${esc(e.notes || "")}${e.photoUrl ? `<br><a class="info" href="${esc(e.photoUrl)}" target="_blank">Comprovante</a>` : ""}</td>
        <td><button class="btn good" onclick="JM.app.approveExpense('${esc(e.id)}')">Aprovar</button> <button class="btn danger" onclick="JM.app.rejectExpense('${esc(e.id)}')">Reprovar</button></td>
      </tr>`).join("") + `</tbody></table>${reportSignature()}`;
  }

  $("financeForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin()) return toast("Somente gestor/financeiro pode lançar.", "danger");
    await db.collection("transactions").add({
      type: $("finType").value,
      date: $("finDate").value || todayInput(),
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

  function boot() {
    bindNavigation();
    $("finDate").value = todayInput();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }

  window.JM = window.JM || {};
  window.JM.app = { setCallStatus, approveExpense, rejectExpense, syncTracker, state };
  boot();
}());
