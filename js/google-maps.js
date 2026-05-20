(function () {
  "use strict";

  const cfg = window.JM_CONFIG || {};
  const { coords, haversineKm } = window.JM.utils || {};
  let loadPromise = null;
  let loadedKey = "";
  const autocompleteInstances = {};

  function activeConfig(settings) {
    return Object.assign({
      apiKey: "",
      language: "pt-BR",
      region: "BR",
      country: "br",
      center: { lat: -20.8113, lng: -49.3758 },
      radiusMeters: 90000
    }, cfg.googleMaps || {}, settings && settings.googleMaps || {});
  }

  function apiKey(settings) {
    return String(activeConfig(settings).apiKey || "").trim();
  }

  function isConfigured(settings) {
    return !!apiKey(settings);
  }

  function load(settings) {
    const gcfg = activeConfig(settings);
    const key = apiKey(settings);
    if (!key) return Promise.reject(new Error("Configure a chave da Google Maps Platform no superadmin."));
    if (window.google && window.google.maps && window.google.maps.places && loadedKey === key) return Promise.resolve(window.google);
    if (loadPromise && loadedKey === key) return loadPromise;

    const old = document.getElementById("jm-google-maps-js");
    if (old) old.remove();
    loadedKey = key;
    loadPromise = new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        key,
        libraries: "places",
        language: gcfg.language || "pt-BR",
        region: gcfg.region || "BR",
        v: "weekly"
      });
      const script = document.createElement("script");
      script.id = "jm-google-maps-js";
      script.src = "https://maps.googleapis.com/maps/api/js?" + params.toString();
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google && window.google.maps) resolve(window.google);
        else reject(new Error("Google Maps carregou, mas o objeto google.maps não ficou disponível."));
      };
      script.onerror = () => reject(new Error("Não foi possível carregar o Google Maps. Confira chave, billing, APIs e domínio autorizado."));
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  function toLatLng(point) {
    if (!point) return null;
    if (point.coords) return toLatLng(point.coords);
    const parsed = coords ? coords(point.lat, point.lng) : null;
    return parsed ? { lat: Number(parsed.lat), lng: Number(parsed.lng) } : null;
  }

  function placeToAddress(place, fallbackText) {
    const loc = place && place.geometry && place.geometry.location;
    const point = loc ? { lat: loc.lat(), lng: loc.lng() } : null;
    return {
      label: place && (place.formatted_address || place.name) || fallbackText || "",
      coords: point,
      placeId: place && place.place_id || "",
      name: place && place.name || "",
      source: "google_places",
      resolvedAt: new Date().toISOString()
    };
  }

  function initAutocomplete(inputId, onPlace, settings) {
    const input = document.getElementById(inputId);
    if (!input || !isConfigured(settings)) return Promise.resolve(null);
    if (autocompleteInstances[inputId]) return Promise.resolve(autocompleteInstances[inputId]);
    return load(settings).then((google) => {
      const gcfg = activeConfig(settings);
      const options = {
        fields: ["formatted_address", "geometry", "name", "place_id"],
        componentRestrictions: { country: gcfg.country || "br" }
      };
      if (gcfg.center && Number.isFinite(Number(gcfg.center.lat)) && Number.isFinite(Number(gcfg.center.lng))) {
        const circle = new google.maps.Circle({
          center: { lat: Number(gcfg.center.lat), lng: Number(gcfg.center.lng) },
          radius: Number(gcfg.radiusMeters || 90000)
        });
        options.bounds = circle.getBounds();
        options.strictBounds = false;
      }
      const ac = new google.maps.places.Autocomplete(input, options);
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        const address = placeToAddress(place, input.value);
        if (address.coords && typeof onPlace === "function") onPlace(address);
      });
      autocompleteInstances[inputId] = ac;
      return ac;
    });
  }

  function geocode(text, settings) {
    const query = String(text || "").trim();
    if (!query) return Promise.reject(new Error("Digite um endereço antes de validar."));
    return load(settings).then((google) => new Promise((resolve, reject) => {
      const gcfg = activeConfig(settings);
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({
        address: query,
        region: gcfg.region || "BR",
        componentRestrictions: { country: String(gcfg.country || "br").toUpperCase() }
      }, (results, status) => {
        if (status !== "OK" || !results || !results[0]) {
          reject(new Error("Google não encontrou esse endereço. Complete rua, número, bairro e cidade."));
          return;
        }
        resolve(placeToAddress(results[0], query));
      });
    }));
  }

  function route(origin, destination, settings) {
    const start = toLatLng(origin);
    const end = toLatLng(destination);
    if (!start || !end) return Promise.reject(new Error("Origem e destino precisam de latitude/longitude."));
    return load(settings).then((google) => new Promise((resolve, reject) => {
      const service = new google.maps.DirectionsService();
      service.route({
        origin: start,
        destination: end,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS
        }
      }, (result, status) => {
        if (status !== "OK" || !result || !result.routes || !result.routes[0]) {
          reject(new Error("Google não conseguiu traçar a rota: " + status));
          return;
        }
        const leg = result.routes[0].legs && result.routes[0].legs[0] || {};
        resolve({
          source: "google_directions",
          distanceMeters: leg.distance && leg.distance.value || 0,
          distanceText: leg.distance && leg.distance.text || "",
          durationSeconds: leg.duration && leg.duration.value || 0,
          durationText: leg.duration && leg.duration.text || "",
          durationTrafficSeconds: leg.duration_in_traffic && leg.duration_in_traffic.value || 0,
          durationTrafficText: leg.duration_in_traffic && leg.duration_in_traffic.text || "",
          startAddress: leg.start_address || "",
          endAddress: leg.end_address || "",
          summary: result.routes[0].summary || "",
          calculatedAt: new Date().toISOString()
        });
      });
    }));
  }

  function routeUrl(points) {
    const clean = (points || []).map(toLatLng).filter(Boolean);
    if (clean.length < 2) return "";
    const params = new URLSearchParams({ api: "1", travelmode: "driving" });
    params.set("origin", clean[0].lat + "," + clean[0].lng);
    params.set("destination", clean[clean.length - 1].lat + "," + clean[clean.length - 1].lng);
    if (clean.length > 2) params.set("waypoints", clean.slice(1, -1).map((p) => p.lat + "," + p.lng).join("|"));
    return "https://www.google.com/maps/dir/?" + params.toString();
  }

  async function routeSummary(origin, destination, settings) {
    try {
      return await route(origin, destination, settings);
    } catch (err) {
      const a = toLatLng(origin);
      const b = toLatLng(destination);
      const km = a && b && haversineKm ? haversineKm(a, b) : 0;
      return {
        source: "fallback_haversine",
        distanceMeters: Math.round(km * 1000),
        distanceText: km ? km.toFixed(1).replace(".", ",") + " km em linha reta" : "",
        durationSeconds: km ? Math.round((km / 45) * 3600) : 0,
        durationText: km ? Math.max(1, Math.round((km / 45) * 60)) + " min estimado" : "",
        warning: err && err.message || "Rota Google indisponível."
      };
    }
  }

  async function rankVehicles(vehicles, origin, destination, settings) {
    const callOrigin = toLatLng(origin);
    const callDest = toLatLng(destination);
    const located = Object.values(vehicles || {}).filter((v) => toLatLng(v.location));
    const rows = [];
    for (const vehicle of located) {
      const vPoint = toLatLng(vehicle.location);
      const toOrigin = await routeSummary(vPoint, callOrigin, settings);
      const serviceRoute = callDest ? await routeSummary(callOrigin, callDest, settings) : null;
      const status = String(vehicle.status || "").toLowerCase();
      const statusPenalty = status.includes("manutenção") || status.includes("indispon") ? 9999 : status.includes("atendimento") ? 45 : 0;
      const minutesToOrigin = Math.round(((toOrigin.durationTrafficSeconds || toOrigin.durationSeconds || 0) / 60));
      const kmToOrigin = (toOrigin.distanceMeters || 0) / 1000;
      const totalKm = kmToOrigin + (serviceRoute ? (serviceRoute.distanceMeters || 0) / 1000 : 0);
      const score = minutesToOrigin + statusPenalty + (kmToOrigin * 0.35);
      rows.push({
        vehicle,
        toOrigin,
        serviceRoute,
        kmToOrigin,
        totalKm,
        minutesToOrigin,
        statusPenalty,
        score,
        routeUrl: routeUrl(callDest ? [vPoint, callOrigin, callDest] : [vPoint, callOrigin])
      });
    }
    return rows.sort((a, b) => a.score - b.score);
  }

  window.JM = window.JM || {};
  window.JM.googleMaps = {
    activeConfig,
    isConfigured,
    load,
    initAutocomplete,
    geocode,
    route,
    routeSummary,
    routeUrl,
    rankVehicles,
    toLatLng
  };
}());
