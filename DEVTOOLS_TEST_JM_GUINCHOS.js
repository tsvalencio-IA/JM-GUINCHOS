(function () {
  const ok = (name) => console.log("✅", name);
  const fail = (name, msg) => console.error("❌", name, msg || "falhou");
  const warn = (name, msg) => console.warn("⚠️", name, msg || "atenção");
  const fn = (path) => path.split(".").reduce((acc, key) => acc && acc[key], window);

  console.log("JM Guinchos v12 - teste rápido");

  window.JM && window.JM.utils ? ok("JM.utils carregado") : fail("JM.utils carregado");
  window.JM && window.JM.firebase ? ok("Firebase carregado") : fail("Firebase carregado");
  window.JM && window.JM.tracker ? ok("Tracker carregado") : fail("Tracker carregado");
  fn("JM.freeRouter.rankVehicles") ? ok("Roteirizador gratuito carregado") : fail("Roteirizador gratuito carregado");
  fn("JM.mapa.renderFleetMap") ? ok("Mapa Leaflet/OSM carregado") : fail("Mapa Leaflet/OSM carregado");

  const parsed = window.JM.freeRouter && window.JM.freeRouter.parseLocationInput("-20.851076,-49.398946");
  parsed && parsed.coords ? ok("Parser de coordenadas funcionando") : fail("Parser de coordenadas funcionando");

  const cfg = window.JM_CONFIG || {};
  cfg.tracker && cfg.tracker.endpoint ? ok("Endpoint tracker configurado") : warn("Endpoint tracker", "faltando endpoint");
  cfg.tracker && cfg.tracker.token ? ok("Token tracker presente") : warn("Token tracker", "faltando token");

  console.log("Para testar rota: cole -20.851076,-49.398946 na origem, clique em Ler origem e depois Traçar rota inteligente.");
}());
