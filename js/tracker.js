(function () {
  "use strict";

  const { plateKey } = window.JM.utils;

  function normalizePosition(raw) {
    const lat = Number(raw.lat ?? raw.latitude ?? raw.y ?? raw.Latitude);
    const lng = Number(raw.lng ?? raw.lon ?? raw.longitude ?? raw.x ?? raw.Longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const plate = plateKey(raw.placa || raw.plate || raw.name || raw.vehicle || raw.deviceName || raw.device || raw.identificacao || raw.id);
    return {
      plate,
      trackerId: String(raw.trackerId || raw.deviceId || raw.id || raw.imei || plate || ""),
      lat,
      lng,
      speed: Number(raw.speed ?? raw.velocidade ?? 0) || 0,
      ignition: Boolean(raw.ignition ?? raw.ignicao ?? raw.acc ?? false),
      rawStatus: raw.status || raw.situacao || "",
      source: "tracker",
      capturedAt: raw.timestamp || raw.time || raw.dataHora || new Date().toISOString()
    };
  }

  function flattenTrackerPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.vehicles)) return payload.vehicles;
    if (Array.isArray(payload.veiculos)) return payload.veiculos;
    if (Array.isArray(payload.positions)) return payload.positions;
    if (Array.isArray(payload.posicoes)) return payload.posicoes;
    return Object.values(payload).filter((v) => v && typeof v === "object");
  }

  function demoPositions(config) {
    const base = {
      FHA4B30: { lat: -21.1774, lng: -47.8103, speed: 0 },
      DAJ6J95: { lat: -21.1807, lng: -47.7982, speed: 0 }
    };
    return Object.entries(config.vehicles || {}).map(([plate, vehicle], index) => ({
      plate,
      trackerId: vehicle.trackerId || plate,
      lat: (base[plate] && base[plate].lat || -21.1774) + index * 0.006,
      lng: (base[plate] && base[plate].lng || -47.8103) - index * 0.006,
      speed: base[plate] && base[plate].speed || 0,
      ignition: false,
      rawStatus: "sem token tracker - posicao demonstrativa",
      source: "demo",
      capturedAt: new Date().toISOString()
    }));
  }

  async function fetchTrackerPositions(config) {
    if (!config || !config.endpoint || !config.token) return [];
    const headers = { "Accept": "application/json" };
    headers[config.tokenHeader || "Authorization"] = String(config.tokenPrefix || "Bearer ") + config.token;
    headers["X-Tracker-Token"] = config.token;
    const response = await fetch(config.endpoint, { method: "GET", headers, cache: "no-store" });
    if (!response.ok) throw new Error("Tracker retornou HTTP " + response.status);
    const payload = await response.json();
    return flattenTrackerPayload(payload).map(normalizePosition).filter(Boolean);
  }

  async function syncTrackerToFirestore(config, db, vehicles) {
    const positions = await fetchTrackerPositions(config);
    const batch = db.batch();
    const now = new Date().toISOString();
    positions.forEach((pos) => {
      let vehicleId = pos.plate;
      Object.entries(vehicles || {}).forEach(([id, vehicle]) => {
        const idMatch = String(vehicle.trackerId || "").toLowerCase() === String(pos.trackerId || "").toLowerCase();
        const plateMatch = plateKey(vehicle.placa || id) === pos.plate;
        if (idMatch || plateMatch) vehicleId = id;
      });
      if (!vehicleId) return;
      const ref = db.collection("vehicles").doc(vehicleId);
      batch.set(ref, {
        location: { lat: pos.lat, lng: pos.lng },
        trackerId: pos.trackerId,
        trackerSource: pos.source,
        trackerStatus: pos.rawStatus,
        speed: pos.speed,
        ignition: pos.ignition,
        lastTrackerAt: pos.capturedAt,
        updatedAt: now
      }, { merge: true });
    });
    await batch.commit();
    return positions;
  }

  window.JM = window.JM || {};
  window.JM.tracker = { fetchTrackerPositions, syncTrackerToFirestore, normalizePosition };
}());
