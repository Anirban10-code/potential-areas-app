// ------------------ MAP INIT ------------------
const map = L.map("map").setView([12.9716, 77.5946], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
}).addTo(map);

let wardsLayer = null;
let wardsData = null;
let csvRows = [];

// ------------------ HELPERS ------------------
function getWardName(props) {
  return props.ward_name || props.ward_name_ || props.name || "Unknown Ward";
}

function getScore(obj) {
  return Number(obj.OpportunityScore || obj.potential_score || obj.demandScore || 0);
}

// ------------------ LOAD GEOJSON ------------------
async function loadGeoJSON(path) {
  const res = await fetch(path);
  return await res.json();
}

// ------------------ LOAD CSV ------------------
// Simple CSV parser (works for normal CSV)
async function loadCSV(path) {
  const res = await fetch(path);
  const text = await res.text();

  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());

  return lines.slice(1).map(line => {
    // handles commas safely (basic)
    const values = line.split(",").map(v => v.trim());
    let obj = {};
    headers.forEach((h, i) => obj[h] = values[i]);
    return obj;
  });
}

// ------------------ MERGE CSV DATA INTO GEOJSON ------------------
function mergeCSVtoGeoJSON(geojson, csvData) {
  // Create lookup: ward_id OR ward_name
  const lookup = {};

  csvData.forEach(row => {
    const wid = row.ward_id || row.wardId || row.id;
    const wname = row.ward_name || row.ward_name_ || row.WardName;
    if (wid) lookup["id_" + wid] = row;
    if (wname) lookup["name_" + wname.toLowerCase()] = row;
  });

  geojson.features.forEach(f => {
    const p = f.properties || {};
    const wid = p.ward_id || p.wardId || p.id;
    const wname = getWardName(p);

    let row = null;
    if (wid && lookup["id_" + wid]) row = lookup["id_" + wid];
    else if (wname && lookup["name_" + wname.toLowerCase()]) row = lookup["name_" + wname.toLowerCase()];

    if (row) {
      // Add CSV fields into GeoJSON properties
      f.properties = { ...p, ...row };
    }
  });

  return geojson;
}

// ------------------ RENDER WARDS ------------------
function renderWards(topN) {
  if (wardsLayer) map.removeLayer(wardsLayer);

  // sort by OpportunityScore
  const sorted = [...wardsData.features].sort((a, b) =>
    getScore(b.properties) - getScore(a.properties)
  );

  const selected = sorted.slice(0, topN);

  wardsLayer = L.geoJSON(selected, {
    style: (feature) => ({
      color: "#111827",
      weight: 2,
      fillOpacity: 0.15,
    }),
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(`
        <b>${p.ward_name || p.ward_name_ || "Ward"}</b><br/>
        <b>OpportunityScore:</b> ${Number(p.OpportunityScore || 0).toFixed(2)}<br/>
        <b>GymCount:</b> ${p.GymCount ?? "-"}<br/>
        <b>CafeCount:</b> ${p.CafeCount ?? "-"}<br/>
        <b>GrowthMean:</b> ${p.growthMean ?? p.Growth ?? "-"}<br/>
        <b>NDBI Mean:</b> ${p.ndbiMean ?? p.NDBI ?? "-"}<br/>
        <b>Zone:</b> ${p.zone_name ?? p.zone ?? "-"}
      `);
    },
  }).addTo(map);

  map.fitBounds(wardsLayer.getBounds());
}

// ------------------ TABLE ------------------
function renderTable(topN) {
  const sorted = [...wardsData.features].sort((a, b) =>
    getScore(b.properties) - getScore(a.properties)
  );

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
        <td>${Number(p.OpportunityScore || 0).toFixed(2)}</td>
        <td>${p.GymCount ?? "-"}</td>
        <td>${p.CafeCount ?? "-"}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  document.getElementById("tableWrap").innerHTML = html;

  // Row click -> zoom to ward
  document.querySelectorAll("tbody tr").forEach((row, idx) => {
    row.addEventListener("click", () => {
      const feature = selected[idx];
      const temp = L.geoJSON(feature);
      map.fitBounds(temp.getBounds());
    });
  });
}

// ------------------ SEARCH ------------------
function setupSearch() {
  const search = document.getElementById("searchBox");
  search.addEventListener("input", () => {
    const q = search.value.toLowerCase();
    const rows = document.querySelectorAll("tbody tr");

    rows.forEach((row) => {
      const ward = row.children[1].innerText.toLowerCase();
      row.style.display = ward.includes(q) ? "" : "none";
    });
  });
}

// ------------------ UPDATE UI ------------------
function updateUI() {
  const topN = Number(document.getElementById("topN").value);
  renderWards(topN);
  renderTable(topN);
}

// ------------------ INIT ------------------
async function init() {
  wardsData = await loadGeoJSON("data/wards.geojson");
  csvRows = await loadCSV("data/ward_data.csv");

  // merge csv into geojson
  wardsData = mergeCSVtoGeoJSON(wardsData, csvRows);

  updateUI();
  setupSearch();

  document.getElementById("topN").addEventListener("change", updateUI);
}

init();
