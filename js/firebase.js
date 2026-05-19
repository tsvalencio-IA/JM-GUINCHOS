(function () {
  "use strict";

  const cfg = window.JM_CONFIG || {};
  if (!window.firebase) throw new Error("Firebase SDK nao carregou.");
  if (!firebase.apps.length) firebase.initializeApp(cfg.firebaseConfig);
  let secondaryApp;
  try {
    secondaryApp = firebase.app("SecondaryAuth");
  } catch (e) {
    secondaryApp = firebase.initializeApp(cfg.firebaseConfig, "SecondaryAuth");
  }

  const auth = firebase.auth();
  const secondaryAuth = secondaryApp.auth();
  const db = firebase.firestore();
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

  window.JM = window.JM || {};
  window.JM.firebase = {
    auth,
    secondaryAuth,
    db,
    ts: () => firebase.firestore.FieldValue.serverTimestamp(),
    arrayUnion: (value) => firebase.firestore.FieldValue.arrayUnion(value),
    emailIsAdmin(email) {
      const authCfg = cfg.auth || {};
      const allowed = [
        ...(authCfg.adminEmails || []),
        ...(authCfg.superadminEmails || [])
      ].map((e) => String(e).toLowerCase().trim()).filter(Boolean);
      return allowed.includes(String(email || "").toLowerCase().trim());
    },
    emailIsSuperAdmin(email) {
      const authCfg = cfg.auth || {};
      const allowed = [
        ...(authCfg.superadminEmails || []),
        ...(authCfg.adminEmails || [])
      ].map((e) => String(e).toLowerCase().trim()).filter(Boolean);
      return allowed.includes(String(email || "").toLowerCase().trim());
    }
  };
}());
