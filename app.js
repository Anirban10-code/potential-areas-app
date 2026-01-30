document.addEventListener("DOMContentLoaded", () => {

  /* ================= MAP ================= */
  const map = L.map("map").setView([12.97, 77.59], 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  /* ================= MICRO AREAS ================= */
  const MICRO_AREAS = {
    indiranagar: {
      center: [12.9716, 77.6412],
      zoom: 14
    }
  };

  /* ================= COLORS ================= */
  const getWardColor = s =>
    s > 0.25 ? "#2ecc71" :
    s > 0.18 ? "#f1c40f" :
               "#e74c3c";

  const getMicroColor = s =>
    s >= 0.8 ? "#2ecc71" :
    s >= 0.6 ? "#f1c40f" :
               "#e74c3c";

  /* ================= LAYERS ================= */
  const wardLayer  = L.layerGroup().addTo(map);
  const microLayer = L.layerGroup();
  const gymLayer   = L.layerGroup();

  /* ================= DATA ================= */
  let wardData = {};
  let microSites = [];
  let gyms = [];

  /* ================= EXPLANATIONS ================= */
  function explainWard(d) {
    let r = [];
    if (+d.CafeCount >= 5) r.push("High cafe density → strong lifestyle demand");
    if (+d.GymCount >= 3) r.push("Good gym presence → fitness-oriented users");
    if (+d.Final_Balanced > 0.25) r.push("High overall opportunity score");
    return r.length ? r.join("<br/>• ") : "Moderate growth indicators";
  }

  function explainMicroSite(s) {
    let r = [];
    if (s.CafeCount >= 20) r.push("Heavy cafe clustering → strong footfall");
    if (s.GymCount >= 5) r.push("Multiple gyms nearby → target users present");
    if (s.BusStopCount >= 5) r.push("Excellent public transport access");
    if (s.reason) r.push(s.reason);
    return r.join("<br/>• ");
  }

  /* ================= LOAD WARDS CSV ================= */
  Papa.parse("data/ward_data.csv", {
    download: true,
    header: true,
    complete: res => {
      res.data.forEach(d => {
        if (d.ward_id) wardData[d.ward_id] = d;
      });
      buildWardTable(Object.values(wardData));

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

              l.on("click", () => {
               updateInfoPanel(
    d.ward_name,
    "Macro (Ward)",
    (+d.Final_Balanced).toFixed(3),
    explainWard(d).split("<br/>• "),
    {
      Cafes: d.CafeCount,
      Gyms: d.GymCount,
      Opportunity: d.Final_Balanced
    }
  );
});

            }
          }).addTo(wardLayer);
        });
    }
  });

  /* ================= LOAD MICRO SITES ================= */
  Papa.parse("data/micro_sites.csv", {
    download: true,
    header: true,
    dynamicTyping: true,
    complete: res => {
      microSites = res.data
        .map(s => ({ ...s, lat: +s.lat, lon: +s.lon }))
        .filter(s => !isNaN(s.lat) && !isNaN(s.lon));
    }
  });

  /* ================= LOAD GYMS ================= */
  Papa.parse("data/gyms_indiranagar.csv", {
    download: true,
    header: true,
    dynamicTyping: true,
    complete: res => {
      gyms = res.data
        .map(g => ({ ...g, lat: +g.lat, lon: +g.lon }))
        .filter(g => !isNaN(g.lat) && !isNaN(g.lon));
    }
  });

  /* ================= DRAW MICRO ================= */
  function drawMicroSites() {
    microLayer.clearLayers();

    microSites.forEach(s => {
      const marker = L.circleMarker([s.lat, s.lon], {
        radius: 9,
        color: "#222",
        weight: 1.5,
        fillColor: getMicroColor(s.Final_Score),
        fillOpacity: 0.9
      });

      marker.bindPopup(`
        <div class="popup-card">
          <h4>Site ${s.site_id}</h4>
          <b>Final Score:</b> ${(+s.Final_Score).toFixed(3)}
          <hr/>
          <b>Why this site?</b><br/>
          • ${explainMicroSite(s)}
        </div>
      `);
      marker.on("click", () => {
  updateInfoPanel(
    `Site ${s.site_id}`,
    "Micro (Street-level)",
    (+s.Final_Score).toFixed(3),
    explainMicroSite(s).split("<br/>• "),
    {
      Cafes: s.CafeCount,
      Gyms: s.GymCount,
      BusStops: s.BusStopCount
    }
  );
});

      marker.addTo(microLayer);
    });
  }

  /* ================= DRAW GYMS ================= */
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

  /* ================= MODE HELPERS ================= */
  function clearMicro() {
    map.removeLayer(microLayer);
    map.removeLayer(gymLayer);
  }

  function setMacroMode() {
    clearMicro();
    map.addLayer(wardLayer);
    map.setView([12.97, 77.59], 11);
    buildWardTable(Object.values(wardData));
  }

  function showMicroArea(key) {
    document.getElementById("analysisMode").value = "micro";
    clearMicro();
    map.removeLayer(wardLayer);

    drawMicroSites();
    map.addLayer(microLayer);

    if (document.getElementById("showGyms").checked) {
      drawGyms();
      map.addLayer(gymLayer);
    }

    const a = MICRO_AREAS[key];
    map.setView(a.center, a.zoom);
    buildMicroTable();
  }

  /* ================= PLACE SEARCH ================= */
  const placeSearch = document.getElementById("placeSearch");
  const goBtn = document.getElementById("goBtn");

  function handlePlaceSearch(q) {
    if (!q) return;

    if (MICRO_AREAS[q]) {
      showMicroArea(q);
      return;
    }

    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + ", Bangalore")}`)
      .then(r => r.json())
      .then(d => {
        if (!d.length) return alert("Place not found");
        setMacroMode();
        map.setView([+d[0].lat, +d[0].lon], 15);
      });
  }

  placeSearch.addEventListener("keypress", e => {
    if (e.key === "Enter") handlePlaceSearch(placeSearch.value.trim().toLowerCase());
  });

  goBtn.addEventListener("click", () => {
    handlePlaceSearch(placeSearch.value.trim().toLowerCase());
  });

  /* ================= TABLE FILTER ================= */
  document.getElementById("searchBox").addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll("#tableWrap tbody tr").forEach(r => {
      r.style.display = r.innerText.toLowerCase().includes(q) ? "" : "none";
    });
  });

  /* ================= MODE SWITCH ================= */
  document.getElementById("analysisMode").addEventListener("change", e => {
    e.target.value === "macro" ? setMacroMode() : showMicroArea("indiranagar");
  });

  /* ================= TABLES ================= */

  function buildWardTable(data) {
  const wrap = document.getElementById("tableWrap");

  const sorted = data
    .filter(d => d.ward_name)
    .sort((a, b) => b.Final_Balanced - a.Final_Balanced);

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Ward</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map((d, i) => `
          <tr class="ward-row"
              data-lat="${d.centroid_lat}"
              data-lon="${d.centroid_lon}">
            <td>${i + 1}</td>
            <td>${d.ward_name}</td>
            <td>${(+d.Final_Balanced).toFixed(3)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

wrap.querySelectorAll(".ward-row").forEach(row => {
  row.addEventListener("click", () => {
    const lat = Number(row.dataset.lat);
    const lon = Number(row.dataset.lon);

    if (!isNaN(lat) && !isNaN(lon)) {
      map.setView([lat, lon], 14, { animate: true });
    }
  });
});

}
function updateInfoPanel(title, type, score, reasons, metrics) {
  const panel = document.getElementById("infoContent");

  panel.innerHTML = `
    <div class="info-section">
      <h4>${title}</h4>
      <div class="badge">${type}</div>
      <div class="info-metric"><b>Score:</b> ${score}</div>
    </div>

    <div class="info-section">
      <h4>Why this area?</h4>
      <ul>
        ${reasons.map(r => `<li>${r}</li>`).join("")}
      </ul>
    </div>

    <div class="info-section">
      <h4>Key Metrics</h4>
      ${Object.entries(metrics).map(
        ([k,v]) => `<div class="info-metric"><b>${k}:</b> ${v}</div>`
      ).join("")}
    </div>
  `;
}



  function buildMicroTable() {
    const wrap = document.getElementById("tableWrap");
    const sorted = [...microSites].sort((a,b)=>b.Final_Score-a.Final_Score);

    wrap.innerHTML = `
      <table>
        <thead><tr><th>Rank</th><th>Site</th><th>Score</th></tr></thead>
        <tbody>
          ${sorted.map(s=>`
            <tr data-lat="${s.lat}" data-lon="${s.lon}">
              <td>${s.Rank}</td>
              <td>${s.reason}</td>
              <td>${(+s.Final_Score).toFixed(3)}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
    wrap.querySelectorAll("tr[data-lat]").forEach(row => {
  row.addEventListener("click", () => {
    const lat = Number(row.dataset.lat);
    const lon = Number(row.dataset.lon);

    if (!isNaN(lat) && !isNaN(lon)) {
      map.setView([lat, lon], 17, { animate: true });
    }
  });
});

  }

  setTimeout(() => map.invalidateSize(), 300);
});
