// ================= MAP =================
const map = L.map('map').setView([12.97, 77.59], 11);
const MICRO_AREAS = {
  "indiranagar": {
    center: [12.9716, 77.6412],
    zoom: 14
  }
};

const baseLayer = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }
).addTo(map);


// ================= COLORS =================
function getWardColor(score) {
  return score > 0.25 ? '#2ecc71' :
         score > 0.18 ? '#f1c40f' :
                        '#e74c3c';
}

function getMicroColor(score) {
  return score >= 0.8 ? "#2ecc71" :
         score >= 0.6 ? "#f1c40f" :
                        "#e74c3c";
}

// ================= LAYERS =================
let wardLayer = L.layerGroup().addTo(map);
let microLayer = L.layerGroup();
let gymLayer = L.layerGroup();

let wardData = {};
let microSites = [];
let gyms = [];

// ================= LOAD WARDS =================
Papa.parse("data/ward_data.csv", {
  download: true,
  header: true,
  complete: res => {
    res.data.forEach(d => wardData[d.ward_id] = d);
    buildTable(res.data);
  }
});

fetch("data/wards.geojson")
  .then(r => r.json())
  .then(geojson => {
    L.geoJSON(geojson, {
      style: f => {
        const d = wardData[f.properties.ward_id];
        return {
          fillColor: d ? getWardColor(+d.Final_Balanced) : "#ccc",
          weight: 1,
          color: "#333",
          fillOpacity: 0.7
        };
      },
      onEachFeature: (f, l) => {
        const d = wardData[f.properties.ward_id];
        if (!d) return;

        l.bindPopup(`
          <b>${d.ward_name}</b><br/>
          Score: ${(+d.Final_Balanced).toFixed(3)}<br/>
          Cafes: ${d.CafeCount}<br/>
          Gyms: ${d.GymCount}
        `);
      }
    }).addTo(wardLayer);
  });

// ================= LOAD MICRO SITES =================
Papa.parse("data/micro_sites.csv", {
  download: true,
  header: true,
  dynamicTyping: true,
  complete: res => {
    microSites = res.data;
    drawMicroSites();
  }
});

// ================= LOAD GYMS =================
Papa.parse("data/gyms_indiranagar.csv", {
  download: true,
  header: true,
  dynamicTyping: true,
  complete: res => {
    gyms = res.data;
  }
});

// ================= DRAW MICRO =================
function drawMicroSites() {
  microLayer.clearLayers();

  microSites.forEach(s => {
    if (!s.lat || !s.lon) return;

    L.circleMarker([s.lat, s.lon], {
      radius: 9,
      color: "#222",
      fillColor: getMicroColor(s.Final_Score),
      fillOpacity: 0.9,
      weight: 1.5
    })
    .bindPopup(`
      <b>Site ${s.site_id}</b><br/>
      Final Score: ${s.Final_Score}<br/>
      Rank: ${s.Rank}<hr/>
      Cafes: ${s.CafeCount}<br/>
      Gyms: ${s.GymCount}<br/>
      Bus Stops: ${s.BusStopCount}<br/>
      <i>${s.reason}</i>
    `)
    .addTo(microLayer);
  });
}

// ================= DRAW GYMS =================
function drawGyms() {
  gymLayer.clearLayers();

  gyms.forEach(g => {
    if (!g.lat || !g.lon) return;

    L.circleMarker([g.lat, g.lon], {
      radius: 5,
      color: "#1f3c88",
      fillColor: "#3498db",
      fillOpacity: 0.8
    })
    .bindPopup(g.name || "Gym")
    .addTo(gymLayer);
  });
}

// ================= MODE SWITCH =================
function setMode(mode) {
  map.removeLayer(microLayer);
  map.removeLayer(gymLayer);

  if (mode === "macro") {
    map.setView([12.97, 77.59], 11);
  }

  if (mode === "micro") {
    map.addLayer(microLayer);
    map.setView([12.9716, 77.6412], 14);
  }
}

document.getElementById("analysisMode").addEventListener("change", e => {
  setMode(e.target.value);
});

document.getElementById("showGyms").addEventListener("change", e => {
  if (e.target.checked) {
    drawGyms();
    map.addLayer(gymLayer);
  } else {
    map.removeLayer(gymLayer);
  }
});

// ================= TABLE =================
function buildTable(data) {
  const wrap = document.getElementById("tableWrap");

  const sorted = data
    .filter(d => d.ward_name)
    .sort((a, b) => b.Final_Balanced - a.Final_Balanced);

  let html = `<table><thead>
    <tr><th>#</th><th>Ward</th><th>Score</th></tr>
  </thead><tbody>`;

  sorted.forEach((d, i) => {
    html += `
      <tr data-lat="${d.centroid_lat}" data-lon="${d.centroid_lon}">
        <td>${i + 1}</td>
        <td>${d.ward_name}</td>
        <td>${(+d.Final_Balanced).toFixed(3)}</td>
      </tr>`;
  });

  html += "</tbody></table>";
  wrap.innerHTML = html;

  wrap.querySelectorAll("tr").forEach(r => {
    r.onclick = () => map.setView([r.dataset.lat, r.dataset.lon], 14);
  });
}
const searchInput = document.getElementById("placeSearch");
const goBtn = document.getElementById("goBtn");

goBtn.addEventListener("click", searchPlace);

// allow Enter key
searchInput.addEventListener("keypress", e => {
  if (e.key === "Enter") searchPlace();
});

function searchPlace() {
  const q = searchInput.value.trim();
  if (!q) {
    alert("Please enter a place name");
    return;
  }

  fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + ", Bangalore")}`
  )
    .then(res => res.json())
    .then(data => {
      if (!data || data.length === 0) {
        alert("Place not found");
        return;
      }

      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);

      map.setView([lat, lon], 15);

      // optional marker
      L.marker([lat, lon])
        .addTo(map)
        .bindPopup(`<b>${q}</b>`)
        .openPopup();

      // important: fix map rendering
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    })
    .catch(err => {
      console.error(err);
      alert("Search failed");
    });
}


// ================= FINAL FIX =================
setTimeout(() => map.invalidateSize(), 300);
