// ------------------ MAP INIT ------------------
const map = L.map('map').setView([12.9716, 77.5946], 11);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

let wardsLayer = null;
let centroidsLayer = null;

let wardsData = null;
let centroidsData = null;

// ------------------ LOAD DATA ------------------
async function loadGeoJSON(path) {
  const res = await fetch(path);
  return await res.json();
}

function getWardName(props) {
  return props.ward_name || props.ward_name_ || props.ward || props.name || "Unknown Ward";
}

function getScore(props) {
  return Number(props.OpportunityScore || props.potential_score || props.demandScore || 0);
}

// ------------------ RENDER WARDS ------------------
function renderWards(topN) {
  if (wardsLayer) map.removeLayer(wardsLayer);

  const sorted = [...wardsData.features].sort((a, b) => getScore(b.properties) - getScore(a.properties));
  const selected = sorted.slice(0, topN);

  wardsLayer = L.geoJSON(selected, {
    style: () => ({
      color: "#111827",
      weight: 2,
      fillOpacity: 0.15
    }),
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(`
        <b>${getWardName(p)}</b><br/>
        <b>OpportunityScore:</b> ${getScore(p).toFixed(3)}<br/>
        <b>GymCount:</b> ${p.GymCount ?? "-"}<br/>
        <b>CafeCount:</b> ${p.CafeCount ?? "-"}<br/>
        <b>Growth:</b> ${p.growthMean ?? p.Growth ?? "-"}<br/>
        <b>NDBI:</b> ${p.ndbiMean ?? p.NDBI ?? "-"}
      `);
    }
  }).addTo(map);

  map.fitBounds(wardsLayer.getBounds());
}

// ------------------ RENDER CENTROIDS ------------------
function renderCentroids(topN) {
  if (centroidsLayer) map.removeLayer(centroidsLayer);

  const sorted = [...centroidsData.features].sort((a, b) => getScore(b.properties) - getScore(a.properties));
  const selected = sorted.slice(0, topN);

  centroidsLayer = L.geoJSON(selected, {
    pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
      radius: 6,
      weight: 2,
      fillOpacity: 0.9
    }),
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(`
        <b>${getWardName(p)}</b><br/>
        <b>OpportunityScore:</b> ${getScore(p).toFixed(3)}<br/>
        <b>GymCount:</b> ${p.GymCount ?? "-"}<br/>
        <b>CafeCount:</b> ${p.CafeCount ?? "-"}
      `);
    }
  }).addTo(map);
}

// ------------------ TABLE ------------------
function renderTable(topN) {
  const sorted = [...wardsData.features].sort((a, b) => getScore(b.properties) - getScore(a.properties));
  const selected = sorted.slice(0, topN);

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

  selected.forEach((f, i) => {
    const p = f.properties;
    html += `
      <tr data-rank="${i}">
        <td>${i + 1}</td>
        <td>${getWardName(p)}</td>
        <td>${getScore(p).toFixed(3)}</td>
        <td>${p.GymCount ?? "-"}</td>
        <td>${p.CafeCount ?? "-"}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  document.getElementById("tableWrap").innerHTML = html;

  // click row zoom
  document.querySelectorAll("tbody tr").forEach((row, idx) => {
    row.addEventListener("click", () => {
      const feature = selected[idx];
      const temp = L.geoJSON(feature);
      map.fitBounds(temp.getBounds());
    });
  });
}

// ------------------ UI ------------------
function updateUI() {
  const topN = Number(document.getElementById("topN").value);
  const showWards = document.getElementById("showWards").checked;
  const showCentroids = document.getElementById("showCentroids").checked;

  if (showWards) renderWards(topN);
  else if (wardsLayer) map.removeLayer(wardsLayer);

  if (showCentroids) renderCentroids(topN);
  else if (centroidsLayer) map.removeLayer(centroidsLayer);

  renderTable(topN);
}

// ------------------ SEARCH ------------------
function setupSearch() {
  const search = document.getElementById("searchBox");
  search.addEventListener("input", () => {
    const q = search.value.toLowerCase();
    const rows = document.querySelectorAll("tbody tr");

    rows.forEach(row => {
      const ward = row.children[1].innerText.toLowerCase();
      row.style.display = ward.includes(q) ? "" : "none";
    });
  });
}

// ------------------ INIT ------------------
async function init() {
  wardsData = await loadGeoJSON("data/wards.geojson");
  centroidsData = await loadGeoJSON("data/centroids.geojson");

  updateUI();
  setupSearch();

  document.getElementById("topN").addEventListener("change", updateUI);
  document.getElementById("showWards").addEventListener("change", updateUI);
  document.getElementById("showCentroids").addEventListener("change", updateUI);
}

init();

