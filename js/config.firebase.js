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
      "jmguinchos@ts.com",
      "tsvalencio@gmail.com"
    ],
    superadminEmails: [
      "jmguinchos@ts.com",
      "tsvalencio@gmail.com"
    ],
    // Correção do fluxo: se um e-mail gestor ficou salvo por engano como motorista,
    // o jm.html tenta reparar o perfil para admin em vez de mandar para motorista.html.
    autoRepairGestorLogin: true
  },
  googleMaps: {
    // Preencha pelo superadmin para ativar endereço Google, geocodificação, autocomplete e rota inteligente.
    // APIs recomendadas no Google Cloud: Maps JavaScript API, Places API e Geocoding API.
    apiKey: "",
    language: "pt-BR",
    region: "BR",
    country: "br",
    center: { lat: -20.8113, lng: -49.3758 },
    radiusMeters: 90000
  },
  tracker: {
    platformUrl: "https://gps2.rafacarrastreadores.com.br",
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
