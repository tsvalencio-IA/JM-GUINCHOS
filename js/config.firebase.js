/*
 * JM Guinchos - configuracao central
 * Preencha este arquivo antes de publicar em GitHub Pages, PWA ou APK.
 */
window.JM_CONFIG = {
  firebaseConfig: {
    apiKey: "PREENCHA_API_KEY",
    authDomain: "PREENCHA.firebaseapp.com",
    projectId: "PREENCHA_PROJECT_ID",
    storageBucket: "PREENCHA.firebasestorage.app",
    messagingSenderId: "PREENCHA_SENDER_ID",
    appId: "PREENCHA_APP_ID"
  },
  empresa: {
    nome: "JM Guinchos",
    cidadeBase: "Ribeirao Preto/SP",
    telefoneOperacional: "",
    moeda: "BRL"
  },
  auth: {
    adminEmails: [
      "admin@jmguinchos.com.br"
    ]
  },
  tracker: {
    platformUrl: "https://LINK_DA_PLATAFORMA_TRACKER_AQUI",
    endpoint: "",
    token: "",
    tokenHeader: "Authorization",
    tokenPrefix: "Bearer ",
    pollingMs: 30000,
    vehicles: {
      FHA4B30: {
        placa: "FHA4B30",
        apelido: "Guincho",
        tipo: "Guincho plataforma",
        trackerId: "FHA4B30"
      },
      DAJ6J95: {
        placa: "DAJ6J95",
        apelido: "Munk",
        tipo: "Caminhao munck",
        trackerId: "DAJ6J95"
      }
    }
  },
  cloudinary: {
    cloudName: "",
    uploadPreset: "",
    folder: "jm-guinchos"
  }
};
