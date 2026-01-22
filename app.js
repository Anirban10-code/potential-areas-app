// ===============================
// CONFIG
// ===============================
const GEOJSON_PATH = "data/wards.geojson";
const CSV_PATH = "data/ward_data.csv";

// ===============================
// MAP INIT
// ===============================
const map = L.map("map").setView([12.9716, 77.5946], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

let wardsLayer = null;
let centroidsLayer = null;

let wardsData = null;
let csvRows = [];

// ===============================
// HELPERS
// ===============================
function num(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function getWardName(p) {
  return p.ward_name || p.ward_name_ || p.name || "Unknown Ward";
}

function getWardIdFromGeoJSONProps(p) {
  // Your geojson may have ward_id or wardid or id
  return (p.ward_id ?? p.wardId ?? p.id ?? "").toString().trim();
}

function getWardIdFromCSVRow(r) {
  return (r.ward_id ?? r.wardId ?? r.id ?? "").toString().trim();
}

function getScore(p) {
  // Your CSV has OpportunityScore
  return num(p.OpportunityScore ?? p.potential_score ?? p.demandScore, 0);
}

// ===============================
// LOADERS
// ===============================
async function loadGeoJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error("GeoJSON not found: " + path);
  return await res.json();
}

function loadCSV(path) {
  return new Promise((resolve, reject) => {
    Papa.parse(path, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (err) => reject(err)
    });
  });
}

// ===============================
// MERGE CSV INTO GEOJSON
// ===============================
function mergeCSVtoGeoJSON(geojson, rows) {
  const lookup = {};
  rows.forEach(r => {
    const wid = getWardIdFromCSVRow(r);
    if (wid) lookup[wid] = r;
  });

  geojson.features.forEach(f => {
    const p = f.properties || {};
    const wid = getWardIdFromGeoJSONProps(p);
    if (wid && lookup[wid]) {
      // merge CSV values into properties
      f.properties = { ...p, ...lookup[wid] };
    }
  });

  return geojson;
}

// ===============================
// FILTER TOP N
// ===============================
function getTopFeatures(topN) {
  const sorted = [...wardsData.features].sort((a, b) =>
    getScore(b.properties) - getScore(a.properties)
  );
  return sorted.slice(0, topN);
}

// ===============================
// WARDS RENDER
// ===============================
function renderWards(topFeatures) {
  if (wardsLayer) map.removeLayer(wardsLayer);

  wardsLayer = L.geoJSON(topFeatures, {
    style: (feature) => {
      const s = getScore(feature.properties);
      // opacity based on score
      const opacity = Math.min(0.6, 0.1 + s / 100);
      return {
        color: "#111827",
        weight: 2,
        fillOpacity: opacity
      };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;

      layer.bindPopup(`
        <b>${getWardName(p)}</b><br/>
        <b>Ward ID:</b> ${getWardIdFromGeoJSONProps(p)}<br/>
        <b>OpportunityScore:</b> ${getScore(p).toFixed(2)}<br/>
        <b>GymCount:</b> ${p.GymCount ?? "-"}<br/>
        <b>CafeCount:</b> ${p.CafeCount ?? "-"}<br/>
        <b>GrowthMean:</b> ${p.growthMean ?? p.Growth ?? "-"}<br/>
        <b>NDBI Mean:</b> ${p.ndbiMean ?? p.NDBI ?? "-"}<br/>
        <b>Zone:</b> ${p.zone_name ?? p.zone ?? "-"}
      `);
    }
  }).addTo(map);

  map.fitBounds(wardsLayer.getBounds());
}

// ===============================
// CENTROID RENDER (FROM CSV lat/lon)
// ===============================
function renderCentroids(topWardIdsSet) {
  if (centroidsLayer) map.removeLayer(centroidsLayer);

  // Build centroid geojson points from CSV
  const features = csvRows
    .filter(r => topWardIdsSet.has(getWardIdFromCSVRow(r)))
    .map(r => {
      const lat = num(r.centroid_lat, null);
      const lon = num(r.centroid_lon, null);
      if (lat === null || lon === null) return null;

      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: r
      };
    })
    .filter(Boolean);

  centroidsLayer = L.geoJSON(features, {
    pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
      radius: 6,
      weight: 2,
      fillOpacity: 0.9
    }),
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(`
        <b>${p.ward_name ?? "Ward"}</b><br/>
        <b>OpportunityScore:</b> ${num(p.OpportunityScore, 0).toFixed(2)}<br/>
        <b>GymCount:</b> ${p.GymCount ?? "-"}<br/>
        <b>CafeCount:</b> ${p.CafeCount ?? "-"}<br/>
        <b>Lat:</b> ${p.centroid_lat}<br/>
        <b>Lon:</b> ${p.centroid_lon}
      `);
    }
  }).addTo(map);
}

// ===============================
// TABLE RENDER
// ===============================
function renderTable(topFeatures) {
  let html = `<table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Ward</th>
        <th>Score</th>
        <th>Gyms</th>
        <th>Cafes</th>
      </tr>
    </thead>
    <tbody>
  `;

  topFeatures.forEach((f, i) => {
    const p = f.properties;
    html += `
      <tr data-i="${i}">
        <td>${i + 1}</td>
        <td>${getWardName(p)}</td>
        <td>${getScore(p).toFixed(2)}</td>
        <td>${p.GymCount ?? "-"}</td>
        <td>${p.CafeCount ?? "-"}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  document.getElementById("tableWrap").innerHTML = html;

  // row click zoom
  document.querySelectorAll("tbody tr").forEach((row) => {
    row.addEventListener("click", () => {
      const idx = Number(row.getAttribute("data-i"));
      const feature = topFeatures[idx];
      const temp = L.geoJSON(feature);
      map.fitBounds(temp.getBounds());
    });
  });
}

// ===============================
// SEARCH FILTER
// ===============================
function setupSearch(topFeatures) {
  const search = document.getElementById("searchBox");
  search.addEventListener("input", () => {
    const q = search.value.toLowerCase();
    document.querySelectorAll("tbody tr").forEach(row => {
      const ward = row.children[1].innerText.toLowerCase();
      row.style.display = ward.includes(q) ? "" : "none";
    });
  });
}

// ===============================
// UPDATE UI
// ===============================
function updateUI() {
  const topN = Number(document.getElementById("topN").value);
  const showWards = document.getElementById("showWards").checked;
  const showCentroids = document.getElementById("showCentroids").checked;

  const actualTopN = topN === 9999 ? wardsData.features.length : topN;
  const topFeatures = getTopFeatures(actualTopN);

  // Render wards
  if (showWards) {
    renderWards(topFeatures);
  } else {
    if (wardsLayer) map.removeLayer(wardsLayer);
  }

  // Render centroids
  const topWardIdsSet = new Set(topFeatures.map(f => getWardIdFromGeoJSONProps(f.properties)));
  if (showCentroids) {
    renderCentroids(topWardIdsSet);
  } else {
    if (centroidsLayer) map.removeLayer(centroidsLayer);
  }

  // Table
  renderTable(topFeatures);

  // Search
  setupSearch(topFeatures);
}

// ===============================
// INIT
// ===============================
async function init() {
  try {
    wardsData = await loadGeoJSON(GEOJSON_PATH);
    csvRows = await loadCSV(CSV_PATH);

    wardsData = mergeCSVtoGeoJSON(wardsData, csvRows);

    updateUI();

    document.getElementById("topN").addEventListener("change", updateUI);
    document.getElementById("showWards").addEventListener("change", updateUI);
    document.getElementById("showCentroids").addEventListener("change", updateUI);

  } catch (err) {
    console.error(err);
    alert("ERROR: " + err.message + "\n\nCheck file names + paths in /data folder.");
  }
}

init();
