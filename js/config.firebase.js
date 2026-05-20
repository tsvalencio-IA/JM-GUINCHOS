/*
 * JM Guinchos - configuracao central
 * Frontend estatico: qualquer dado neste arquivo fica visivel no GitHub Pages.
 * Para operacao profissional, restrinja o token do rastreador no painel do fornecedor
 * e troque o token sempre que suspeitar de exposicao.
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
    cidadeBase: "Sao Jose do Rio Preto - SP",
    telefoneOperacional: "(17) 99651-9832",
    moeda: "BRL"
  },
  auth: {
    adminEmails: [
      "jmguinchos@ts.com",
      "tsvalencio@gmail.com"
    ],
    superadminEmails: [
      "jmguinchos@ts.com",
      "tsvalencio@gmail.com"
    ],
    autoRepairGestorLogin: true
  },
  map: {
    provider: "leaflet_osm",
    paidApi: false,
    country: "br",
    center: { lat: -20.8113, lng: -49.3758 },
    radiusMeters: 90000,
    averageSpeedKmH: 48
  },
  tracker: {
    platformUrl: "https://gps2.rafacarrastreadores.com.br",
    endpoint: "https://gps2.rafacarrastreadores.com.br/api",
    socketUrl: "wss://gps2.rafacarrastreadores.com.br/api/socket",
    token: "RjBEAiBIfZbqwxwwx4sflEv1MKhRihZ9u6D3zDUmThyl4Eli1QIgNwK-0XsQUZqgb9YZzZLVrU1bVYVQbri_07sv290x9LV7InUiOjI1LCJlIjoiMjAyNi0xMS0xMFQwMDozODoxMy4zNDkrMDA6MDAifQ",
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
