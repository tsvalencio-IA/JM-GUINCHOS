(function () {
  "use strict";

  const { $, esc, toast } = window.JM.utils;
  const { auth, secondaryAuth, db, ts, emailIsSuperAdmin } = window.JM.firebase;
  const cfg = window.JM_CONFIG || {};
  let settings = {};
  let vehicles = {};

  function friendlyAuthError(err) {
    const code = err && err.code || "";
    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") return "Usuário ou senha inválidos.";
    if (code === "auth/email-already-in-use") return "Este e-mail já existe no Firebase Auth.";
    if (code === "auth/operation-not-allowed") return "Ative E-mail/Senha no Firebase Authentication.";
    return err && err.message || "Falha de autenticação.";
  }

  async function ensureSuperProfile(user) {
    if (!emailIsSuperAdmin(user.email)) throw new Error("E-mail não liberado como superadmin em js/config.firebase.js.");
    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();
    const profile = {
      uid: user.uid,
      email: user.email,
      nome: user.displayName || user.email.split("@")[0],
      role: "admin",
      active: true,
      updatedAt: ts()
    };
    await ref.set(snap.exists ? profile : Object.assign({ createdAt: ts() }, profile), { merge: true });
    return profile;
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      $("superLoginView").classList.remove("hidden");
      $("superAppView").classList.add("hidden");
      return;
    }
    try {
      await ensureSuperProfile(user);
      $("superLoginView").classList.add("hidden");
      $("superAppView").classList.remove("hidden");
      $("superUserBox").textContent = user.email;
      bindSettings();
    } catch (err) {
      $("superLoginError").textContent = err.message;
      await auth.signOut();
    }
  });

  $("superLoginForm").onsubmit = async (e) => {
    e.preventDefault();
    $("superLoginError").textContent = "";
    try {
      await auth.signInWithEmailAndPassword($("superEmail").value.trim(), $("superPass").value);
    } catch (err) {
      $("superLoginError").textContent = friendlyAuthError(err);
    }
  };

  $("superFirstAccessBtn").onclick = async () => {
    const email = $("superEmail").value.trim().toLowerCase();
    const pass = $("superPass").value;
    $("superLoginError").textContent = "";
    if (!emailIsSuperAdmin(email)) return $("superLoginError").textContent = "Este e-mail não está liberado como superadmin.";
    if (!pass || pass.length < 6) return $("superLoginError").textContent = "Senha mínima: 6 caracteres.";
    try {
      await auth.createUserWithEmailAndPassword(email, pass);
    } catch (err) {
      $("superLoginError").textContent = friendlyAuthError(err);
    }
  };

  $("superLogoutBtn").onclick = () => auth.signOut();
  $("superSeedBtn").onclick = () => seedBase();
  $("superSyncTrackerBtn").onclick = () => syncTracker();

  function bindSettings() {
    db.collection("settings").doc("integrations").onSnapshot((snap) => {
      settings = snap.exists ? snap.data() : {};
      renderSettings();
    });
    db.collection("settings").doc("company").onSnapshot((snap) => {
      const company = Object.assign({}, cfg.empresa || {}, snap.exists ? snap.data() : {});
      $("companyName").value = company.nome || "";
      $("companyCity").value = company.cidadeBase || "";
      $("companyPhone").value = company.telefoneOperacional || "";
    });
    db.collection("vehicles").onSnapshot((snap) => {
      vehicles = {};
      snap.forEach((doc) => { vehicles[doc.id] = { id: doc.id, ...doc.data() }; });
    });
  }

  function renderSettings() {
    const tracker = Object.assign({}, cfg.tracker || {}, settings.tracker || {});
    const cloud = Object.assign({}, cfg.cloudinary || {}, settings.cloudinary || {});
    const googleMaps = Object.assign({}, cfg.googleMaps || {}, settings.googleMaps || {});
    $("trackerPlatform").value = tracker.platformUrl || "";
    $("trackerEndpoint").value = tracker.endpoint || "";
    $("trackerToken").value = tracker.token || "";
    $("trackerHeader").value = tracker.tokenHeader || "Authorization";
    $("trackerPrefix").value = tracker.tokenPrefix || "Bearer ";
    $("trackerPolling").value = tracker.pollingMs || 30000;
    $("trackerFha").value = tracker.vehicles && tracker.vehicles.FHA4B30 && tracker.vehicles.FHA4B30.trackerId || "FHA4B30";
    $("trackerDaj").value = tracker.vehicles && tracker.vehicles.DAJ6J95 && tracker.vehicles.DAJ6J95.trackerId || "DAJ6J95";
    $("superCloudName").value = cloud.cloudName || "";
    $("superCloudPreset").value = cloud.uploadPreset || "";
    $("superGoogleMapsKey").value = googleMaps.apiKey || "";
    $("superGoogleMapsLanguage").value = googleMaps.language || "pt-BR";
    $("superGoogleMapsRegion").value = googleMaps.region || "BR";
    $("superGoogleMapsCenterLat").value = googleMaps.center && googleMaps.center.lat || -20.8113;
    $("superGoogleMapsCenterLng").value = googleMaps.center && googleMaps.center.lng || -49.3758;
    $("superGoogleMapsRadius").value = googleMaps.radiusMeters || 90000;
  }

  function currentVehicles() {
    const base = Object.assign({}, cfg.tracker && cfg.tracker.vehicles || {}, settings.tracker && settings.tracker.vehicles || {});
    base.FHA4B30 = Object.assign({ placa: "FHA4B30", apelido: "Guincho", tipo: "Guincho plataforma" }, base.FHA4B30 || {}, { trackerId: $("trackerFha").value.trim() || "FHA4B30" });
    base.DAJ6J95 = Object.assign({ placa: "DAJ6J95", apelido: "Munk", tipo: "Caminhao munck" }, base.DAJ6J95 || {}, { trackerId: $("trackerDaj").value.trim() || "DAJ6J95" });
    return base;
  }

  async function seedBase() {
    const batch = db.batch();
    const now = new Date().toISOString();
    Object.entries(currentVehicles()).forEach(([id, vehicle]) => {
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
      tracker: Object.assign({}, cfg.tracker || {}, settings.tracker || {}, { vehicles: currentVehicles() }),
      cloudinary: Object.assign({}, cfg.cloudinary || {}, settings.cloudinary || {}),
      googleMaps: Object.assign({}, cfg.googleMaps || {}, settings.googleMaps || {}),
      updatedAt: now
    }, { merge: true });
    await batch.commit();
    toast("Base JM criada/atualizada com FHA4B30 e DAJ6J95.", "ok");
  }

  async function syncTracker() {
    const tracker = Object.assign({}, cfg.tracker || {}, settings.tracker || {}, { vehicles: currentVehicles() });
    if (!tracker.endpoint || !tracker.token) {
      toast("Configure endpoint e token do Tracker antes de sincronizar.", "danger");
      return;
    }
    try {
      const positions = await window.JM.tracker.syncTrackerToFirestore(tracker, db, vehicles);
      toast(`${positions.length} posição(ões) sincronizada(s) do Tracker.`, "ok");
    } catch (err) {
      console.error(err);
      toast("Tracker indisponível: " + (err && err.message || err), "danger");
    }
  }

  $("companyForm").onsubmit = async (e) => {
    e.preventDefault();
    await db.collection("settings").doc("company").set({
      nome: $("companyName").value.trim(),
      cidadeBase: $("companyCity").value.trim(),
      telefoneOperacional: $("companyPhone").value.trim(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
    toast("Cadastro do JM salvo.", "ok");
  };

  $("trackerForm").onsubmit = async (e) => {
    e.preventDefault();
    await db.collection("settings").doc("integrations").set({
      tracker: {
        platformUrl: $("trackerPlatform").value.trim(),
        endpoint: $("trackerEndpoint").value.trim(),
        token: $("trackerToken").value.trim(),
        tokenHeader: $("trackerHeader").value.trim() || "Authorization",
        tokenPrefix: $("trackerPrefix").value,
        pollingMs: Number($("trackerPolling").value || 30000),
        vehicles: currentVehicles()
      },
      updatedAt: new Date().toISOString()
    }, { merge: true });
    toast("Tracker salvo. O mapa do jm.html usará posições reais na próxima sincronização.", "ok");
  };

  $("trackerVehiclesForm").onsubmit = async (e) => {
    e.preventDefault();
    await db.collection("settings").doc("integrations").set({
      tracker: Object.assign({}, cfg.tracker || {}, settings.tracker || {}, { vehicles: currentVehicles() }),
      updatedAt: new Date().toISOString()
    }, { merge: true });
    toast("IDs dos rastreadores salvos.", "ok");
  };

  $("superCloudForm").onsubmit = async (e) => {
    e.preventDefault();
    await db.collection("settings").doc("integrations").set({
      cloudinary: {
        cloudName: $("superCloudName").value.trim(),
        uploadPreset: $("superCloudPreset").value.trim(),
        folder: "jm-guinchos"
      },
      updatedAt: new Date().toISOString()
    }, { merge: true });
    toast("Cloudinary salvo.", "ok");
  };

  $("superGoogleMapsForm").onsubmit = async (e) => {
    e.preventDefault();
    await db.collection("settings").doc("integrations").set({
      googleMaps: {
        apiKey: $("superGoogleMapsKey").value.trim(),
        language: $("superGoogleMapsLanguage").value.trim() || "pt-BR",
        region: $("superGoogleMapsRegion").value.trim() || "BR",
        country: "br",
        center: {
          lat: Number(String($("superGoogleMapsCenterLat").value || "-20.8113").replace(",", ".")),
          lng: Number(String($("superGoogleMapsCenterLng").value || "-49.3758").replace(",", "."))
        },
        radiusMeters: Number($("superGoogleMapsRadius").value || 90000)
      },
      updatedAt: new Date().toISOString()
    }, { merge: true });
    toast("Google Maps salvo. O jm.html usará endereço validado, autocomplete e rota inteligente.", "ok");
  };

  $("adminUserForm").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("adminEmail").value.trim().toLowerCase();
    const pass = $("adminPass").value;
    const nome = $("adminName").value.trim();
    if (!pass || pass.length < 6) return toast("Senha mínima: 6 caracteres.", "danger");

    const managerPayload = {
      nome,
      email,
      role: "admin",
      active: true,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser && auth.currentUser.uid || "",
      source: "superadmin-adminUserForm"
    };

    try {
      // Registro por e-mail: esta é a proteção definitiva para o gestor nunca virar motorista.
      // Mesmo que o UID já exista no Auth ou tenha sido salvo antes como driver, o jm.html
      // consegue ler managerAccess/{email} e reparar users/{uid} para admin no primeiro login.
      await db.collection("managerAccess").doc(email).set(Object.assign({ createdAt: new Date().toISOString() }, managerPayload), { merge: true });

      // Corrige imediatamente qualquer documento antigo em users que tenha esse e-mail
      // salvo por engano como driver/motorista, inclusive quando o ID do documento não é o UID real.
      const oldUsers = await db.collection("users").where("email", "==", email).get();
      if (!oldUsers.empty) {
        const batch = db.batch();
        oldUsers.forEach((doc) => {
          batch.set(doc.ref, Object.assign({}, managerPayload, {
            role: "admin",
            active: true,
            fixedFromRole: "driver/motorista",
            fixedAt: new Date().toISOString()
          }), { merge: true });
        });
        await batch.commit();
      }

      let cred = null;
      try {
        cred = await secondaryAuth.createUserWithEmailAndPassword(email, pass);
        await secondaryAuth.signOut().catch(() => {});
      } catch (err) {
        if (!(err && err.code === "auth/email-already-in-use")) throw err;
        e.target.reset();
        toast("Este e-mail já existia no Auth. Ele foi liberado como gestor; ao entrar no jm.html o perfil será corrigido para admin. Se a senha não for essa, redefina no Firebase Authentication.", "ok");
        return;
      }

      await db.collection("users").doc(cred.user.uid).set({
        uid: cred.user.uid,
        nome,
        email,
        role: "admin",
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: auth.currentUser && auth.currentUser.uid || "",
        source: "superadmin-adminUserForm"
      }, { merge: true });
      e.target.reset();
      toast("Gestor criado como ADMIN no Auth, em managerAccess e em users. Não será cadastrado como motorista.", "ok");
    } catch (err) {
      toast(friendlyAuthError(err), "danger");
    }
  };
}());
