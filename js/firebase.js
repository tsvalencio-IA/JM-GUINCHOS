(function () {
  "use strict";

  const cfg = window.JM_CONFIG || {};
  if (!window.firebase) throw new Error("Firebase SDK nao carregou.");
  if (!firebase.apps.length) firebase.initializeApp(cfg.firebaseConfig);

  const auth = firebase.auth();
  const db = firebase.firestore();
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

  window.JM = window.JM || {};
  window.JM.firebase = {
    auth,
    db,
    ts: () => firebase.firestore.FieldValue.serverTimestamp(),
    arrayUnion: (value) => firebase.firestore.FieldValue.arrayUnion(value),
    emailIsAdmin(email) {
      return (cfg.auth && cfg.auth.adminEmails || []).map((e) => String(e).toLowerCase()).includes(String(email || "").toLowerCase());
    }
  };
}());
