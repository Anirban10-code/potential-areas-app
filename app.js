// ---------------- MAP SETUP ----------------
const map = L.map('map').setView([12.97, 77.59], 11);

L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  { attribution: '&copy; OpenStreetMap & Carto' }
).addTo(map);

function getColor(score) {
  return score > 0.25 ? '#2ecc71' :
         score > 0.18 ? '#f1c40f' :
                        '#e74c3c';
}

let wardData = {};
let wardLayer;
let centroidLayer;
let microLayer = L.layerGroup().addTo(map);
let microSites = [];

// ---------------- LOAD CSV ----------------
Papa.parse("data/ward_data.csv", {
  download: true,
  header: true,
  complete: results => {
    results.data.forEach(d => {
      wardData[d.ward_id] = d;
    });
    buildTable(results.data);
  }
});
Papa.parse("data/micro_sites.csv", {
  download: true,
  header: true,
  dynamicTyping: true,
  complete: results => {
    microSites = results.data;
    drawMicroSites();
  }
});

// ---------------- LOAD GEOJSON ----------------
fetch("data/wards.geojson")
  .then(res => res.json())
  .then(geojson => {

    wardLayer = L.geoJSON(geojson, {
      style: f => {
        const p = wardData[f.properties.ward_id];
        return {
          fillColor: p ? getColor(+p.Final_Balanced) : '#ccc',
          weight: 1,
          color: '#333',
          fillOpacity: 0.7
        };
      },
      onEachFeature: (feature, layer) => {
        const p = wardData[feature.properties.ward_id];
        if (!p) return;

        layer.bindPopup(`
          <div class="popup-card">
            <h4>${p.ward_name}</h4>
            <p>📈 Opportunity: ${(+p.OpportunityScore).toFixed(3)}</p>
            <p>🏋️ Gyms: ${p.GymCount}</p>
            <p>☕ Cafes: ${p.CafeCount}</p>
            <p><b>⭐ Final Score: ${(+p.Final_Balanced).toFixed(3)}</b></p>
          </div>
        `);
      }
    }).addTo(map);
  });

// ---------------- TABLE ----------------
function drawMicroSites() {
  microLayer.clearLayers();

  microSites.forEach(s => {
    if (!s.lat || !s.lon) return;

    // color by score
    let color =
      s.SiteScore >= 15 ? "#2ecc71" :
      s.SiteScore >= 8  ? "#f1c40f" :
                          "#e74c3c";

    let marker = L.circleMarker([s.lat, s.lon], {
      radius: 9,
      color: color,
      fillColor: color,
      fillOpacity: 0.9,
      weight: 2
    });

    marker.bindPopup(`
      <div class="popup-card">
        <h4>Site ${s.site_id}</h4>
        <p><b>⭐ Score:</b> ${s.SiteScore.toFixed(2)}</p>
        <hr/>
        ☕ Cafes: ${s.CafeCount}<br/>
        🏋️ Gyms: ${s.GymCount}<br/>
        🚌 Bus Stops: ${s.BusStopCount}<br/>
        <hr/>
        <i>${s.reason}</i>
      </div>
    `);

    marker.addTo(microLayer);
  });
}

function buildTable(data) {
  const wrap = document.getElementById("tableWrap");

  const sorted = data
    .filter(d => d.ward_name)
    .sort((a, b) => b.Final_Balanced - a.Final_Balanced);

  let html = `<table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Ward</th>
        <th>Score</th>
      </tr>
    </thead>
    <tbody>`;

  sorted.forEach((d, i) => {
    html += `
      <tr data-lat="${d.centroid_lat}" data-lon="${d.centroid_lon}">
        <td class="rank">${i + 1}</td>
        <td>${d.ward_name}</td>
        <td>${(+d.Final_Balanced).toFixed(3)}</td>
      </tr>`;
  });

  html += `</tbody></table>`;
  wrap.innerHTML = html;

  wrap.querySelectorAll("tr[data-lat]").forEach(row => {
    row.onclick = () => {
      map.setView([row.dataset.lat, row.dataset.lon], 14);
    };
  });
}
document.getElementById("showMicro").addEventListener("change", e => {
  if (e.target.checked) {
    drawMicroSites();
  } else {
    microLayer.clearLayers();
  }
});
map.setView([12.9716, 77.6412], 13);
