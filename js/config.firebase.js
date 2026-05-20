/*
 * JM Guinchos - configuracao central
 * Preencha este arquivo antes de publicar em GitHub Pages, PWA ou APK.
 */
window.JM_CONFIG = {
  firebaseConfig: {
    apiKey: "AIzaSyDabz--MxYrnUGo65G3nGKE6h_Tr6h112s",
    authDomain: "frvalencio.firebaseapp.com",
    projectId: "frvalencio",
    storageBucket: "frvalencio.firebasestorage.app",
    messagingSenderId: "1008400858370",
    appId: "1:1008400858370:web:17019357ea499ecd87561b"
  },
  empresa: {
    nome: "JM Guinchos",
    cidadeBase: "São José do Rio Preto - SP",
    telefoneOperacional: "(17) 99651-9832",
    moeda: "BRL"
  },
  auth: {
    // E-mails que podem acessar o jm.html e o superadmin.html.
    // Adicione aqui o e-mail real do dono/gestor antes de publicar.
    adminEmails: [
      "jm@jm.com",
      "tsvalencio@gmail.com"
    ],
    superadminEmails: [
      "jm@jm.com",
      "tsvalencio@gmail.com"
    ],
    // Correção do fluxo: se um e-mail gestor ficou salvo por engano como motorista,
    // o jm.html tenta reparar o perfil para admin em vez de mandar para motorista.html.
    autoRepairGestorLogin: true
  },
  tracker: {
  platformUrl: "https://gps2.rafacarrastreadores.com.br",
  endpoint: "https://gps2.rafacarrastreadores.com.br/api",
  socketUrl: "wss://gps2.rafacarrastreadores.com.br/api/socket",
  token: "RjBEAiBIfZbqwxwwx4sflEv1MKhRihZ9u6D3zDUmThyl4Eli1QIgNwK-0XsQUZqgb9YZzZLVrU1bVYVQbri_07sv290x9LV7InUiOjI1LCJlIjoiMjAyNi0xMS0xMFQwMDozODoxMy4zNDkrMDA6MDAifQ",
  tokenHeader: "Authorization",
  tokenPrefix: "Bearer ",
  pollingMs: 30000,
}
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
