// ================= MAP =================
const map = L.map("map").setView([12.97, 77.59], 11);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }
).addTo(map);

// ================= MICRO AREAS =================
const MICRO_AREAS = {
  indiranagar: {
    center: [12.9716, 77.6412],
    zoom: 14
  }
};

// ================= COLORS =================
function getWardColor(score) {
  return score > 0.25 ? "#2ecc71" :
         score > 0.18 ? "#f1c40f" :
                        "#e74c3c";
}

function getMicroColor(score) {
  return score >= 0.8 ? "#2ecc71" :
         score >= 0.6 ? "#f1c40f" :
                        "#e74c3c";
}

// ================= LAYERS =================
const wardLayer = L.layerGroup().addTo(map);
const microLayer = L.layerGroup();
const gymLayer = L.layerGroup();

// ================= DATA =================
let wardData = {};
let microSites = [];
let gyms = [];

// ================= LOAD WARD CSV =================
Papa.parse("data/ward_data.csv", {
  download: true,
  header: true,
  complete: res => {
    res.data.forEach(d => {
      if (d.ward_id) wardData[d.ward_id] = d;
    });
    buildWardTable(Object.values(wardData));
  }
});

// ================= LOAD WARDS GEOJSON =================
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
          fillOpacity: 0.75
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
    microSites = res.data.filter(s => s.lat && s.lon);
  }
});

// ================= LOAD GYMS =================
Papa.parse("data/gyms_indiranagar.csv", {
  download: true,
  header: true,
  dynamicTyping: true,
  complete: res => {
    gyms = res.data.filter(g => g.lat && g.lon);
  }
});

// ================= DRAW MICRO =================
function drawMicroSites() {
  microLayer.clearLayers();

  microSites.forEach(s => {
    L.circleMarker([s.lat, s.lon], {
      radius: 9,
      color: "#222",
      weight: 1.5,
      fillColor: getMicroColor(s.Final_Score),
      fillOpacity: 0.9
    })
    .bindPopup(`
      <b>Site ${s.site_id}</b><br/>
      Score: ${(+s.Final_Score).toFixed(3)}<br/>
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

// ================= SEARCH =================
const searchBox = document.getElementById("searchBox");

searchBox.addEventListener("keyup", e => {
  if (e.key === "Enter") {
    handleSearch(searchBox.value.trim().toLowerCase());
  }
});

function handleSearch(query) {
  if (!query) return;

  const q = query.toLowerCase();

  // ================= MICRO AREA (FIRST PRIORITY) =================
  if (MICRO_AREAS[q]) {
    showMicroArea(q);
    document.getElementById("analysisMode").value = "micro";
    return;
  }

  // ================= MACRO WARD SEARCH =================
  const ward = Object.values(wardData).find(w =>
    w.ward_name && w.ward_name.toLowerCase().includes(q)
  );

  if (ward) {
    setMode("macro");
    map.setView([ward.centroid_lat, ward.centroid_lon], 14);
    return;
  }

  // ================= FALLBACK: NORMAL PLACE SEARCH =================
  searchPlaceByName(q);
}


  // ---------- MACRO ----------
  const ward = Object.values(wardData).find(w =>
    w.ward_name && w.ward_name.toLowerCase().includes(query)
  );

  if (ward) {
    clearMicro();
    map.addLayer(wardLayer);
    map.setView([ward.centroid_lat, ward.centroid_lon], 14);
    buildWardTable(Object.values(wardData));
  } else {
    alert("Location not found. Try a ward name or 'Indiranagar'");
  }
}

// ================= SHOW MICRO =================
function showMicroArea(key) {
  clearMicro();
  map.removeLayer(wardLayer);

  drawMicroSites();
  map.addLayer(microLayer);

  if (document.getElementById("showGyms").checked) {
    drawGyms();
    map.addLayer(gymLayer);
  }

  const area = MICRO_AREAS[key];
  map.setView(area.center, area.zoom);

  buildMicroTable();
}

// ================= CLEAR MICRO =================
function clearMicro() {
  map.removeLayer(microLayer);
  map.removeLayer(gymLayer);
}

// ================= MODE SWITCH =================
document.getElementById("analysisMode").addEventListener("change", e => {
  if (e.target.value === "macro") {
    clearMicro();
    map.addLayer(wardLayer);
    map.setView([12.97, 77.59], 11);
    buildWardTable(Object.values(wardData));
  } else {
    showMicroArea("indiranagar");
  }
});

// ================= GYM TOGGLE =================
document.getElementById("showGyms").addEventListener("change", e => {
  if (e.target.checked && map.hasLayer(microLayer)) {
    drawGyms();
    map.addLayer(gymLayer);
  } else {
    map.removeLayer(gymLayer);
  }
});

// ================= TABLES =================
function buildWardTable(data) {
  const wrap = document.getElementById("tableWrap");

  const sorted = data
    .filter(d => d.ward_name)
    .sort((a, b) => b.Final_Balanced - a.Final_Balanced);

  let html = `<table>
    <thead><tr><th>#</th><th>Ward</th><th>Score</th></tr></thead>
    <tbody>`;

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

function buildMicroTable() {
  const wrap = document.getElementById("tableWrap");

  const sorted = [...microSites].sort((a, b) => b.Final_Score - a.Final_Score);

  let html = `<table>
    <thead><tr><th>Rank</th><th>Site</th><th>Score</th></tr></thead>
    <tbody>`;

  sorted.forEach(s => {
    html += `
      <tr data-lat="${s.lat}" data-lon="${s.lon}">
        <td>${s.Rank}</td>
        <td>${s.reason}</td>
        <td>${(+s.Final_Score).toFixed(3)}</td>
      </tr>`;
  });

  html += "</tbody></table>";
  wrap.innerHTML = html;

  wrap.querySelectorAll("tr").forEach(r => {
    r.onclick = () => map.setView([r.dataset.lat, r.dataset.lon], 17);
  });
}

// ================= FINAL FIX =================
setTimeout(() => map.invalidateSize(), 300);
