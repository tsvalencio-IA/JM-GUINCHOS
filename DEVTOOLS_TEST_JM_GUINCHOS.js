/*
 * JM Guinchos - smoke test para DevTools.
 * Abra index.html, faça login e cole este arquivo no Console.
 */
(async function jmGuinchosSmoke() {
  "use strict";
  const out = [];
  const ok = (nome, detalhe) => out.push({ status: "OK", nome, detalhe: detalhe || "" });
  const fail = (nome, detalhe) => out.push({ status: "FALHA", nome, detalhe: detalhe || "" });
  const warn = (nome, detalhe) => out.push({ status: "ATENCAO", nome, detalhe: detalhe || "" });
  const has = (id) => !!document.getElementById(id);
  const fn = (path) => path.split(".").reduce((acc, k) => acc && acc[k], window);

  window.firebase ? ok("Firebase SDK carregado") : fail("Firebase SDK carregado");
  window.JM_CONFIG ? ok("Config JM carregado") : fail("Config JM carregado");
  fn("JM.firebase.db") ? ok("Firestore inicializado") : fail("Firestore inicializado");
  fn("JM.tracker.syncTrackerToFirestore") ? ok("Adaptador Tracker") : fail("Adaptador Tracker");
  fn("JM.mapa.renderFleetMap") ? ok("Motor de mapa") : fail("Motor de mapa");
  ["loginView","appView","dashboardMap","fleetMap","callForm","expenseForm","financeForm","vehicleForm","teamForm"].forEach((id) => has(id) ? ok("Elemento #" + id) : fail("Elemento #" + id));
  const tracker = window.JM_CONFIG && window.JM_CONFIG.tracker || {};
  tracker.vehicles && tracker.vehicles.FHA4B30 ? ok("Veículo FHA4B30 configurado") : fail("Veículo FHA4B30 configurado");
  tracker.vehicles && tracker.vehicles.DAJ6J95 ? ok("Veículo DAJ6J95 configurado") : fail("Veículo DAJ6J95 configurado");
  tracker.endpoint ? ok("Endpoint Tracker configurado") : warn("Endpoint Tracker configurado", "Sem endpoint, sistema usa posições demonstrativas ate preencher config.firebase.js.");
  tracker.token ? ok("Token Tracker configurado") : warn("Token Tracker configurado", "Sem token, sistema usa posições demonstrativas ate preencher config.firebase.js.");
  console.table(out);
  const falhas = out.filter((x) => x.status === "FALHA").length;
  const atencoes = out.filter((x) => x.status === "ATENCAO").length;
  console.log(`JM Guinchos: ${out.length} verificações, ${falhas} falha(s), ${atencoes} atenção(ões).`);
  return { falhas, atencoes, detalhes: out };
}());
