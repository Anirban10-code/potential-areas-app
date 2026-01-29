document.addEventListener("DOMContentLoaded", () => {

  // ================= MAP =================
  const map = L.map("map").setView([12.97, 77.59], 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // ================= MICRO AREAS =================
  const MICRO_AREAS = {
    indiranagar: {
      center: [12.9716, 77.6412],
      zoom: 14
    }
  };

  // ================= COLORS =================
  const getWardColor = s =>
    s > 0.25 ? "#2ecc71" :
    s > 0.18 ? "#f1c40f" :
               "#e74c3c";

  const getMicroColor = s =>
    s >= 0.8 ? "#2ecc71" :
    s >= 0.6 ? "#f1c40f" :
               "#e74c3c";

  // ================= LAYERS =================
  const wardLayer  = L.layerGroup().addTo(map);
  const microLayer = L.layerGroup();
  const gymLayer   = L.layerGroup();

  // ================= DATA =================
  let wardData   = {};
  let microSites = [];
  let gyms       = [];

  // ================= LOAD WARDS CSV =================
  Papa.parse("data/ward_data.csv", {
    download: true,
    header: true,
    complete: res => {
      res.data.forEach(d => {
        if (d.ward_id) wardData[d.ward_id] = d;
      });
      buildWardTable(Object.values(wardData));

      // Load GeoJSON AFTER CSV
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
    }
  });

  // ================= LOAD MICRO SITES =================
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

  // ================= LOAD GYMS =================
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

  // ================= MODE HELPERS =================
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

  // ================= PLACE SEARCH =================
  const placeSearch = document.getElementById("placeSearch");

  placeSearch.addEventListener("keypress", e => {
    if (e.key === "Enter") handlePlaceSearch(placeSearch.value.trim().toLowerCase());
  });

  function handlePlaceSearch(q) {
    if (!q) return;

    // Known micro areas
    if (MICRO_AREAS[q]) {
      document.getElementById("analysisMode").value = "micro";
      showMicroArea(q);
      return;
    }
  
    // Fallback → Nominatim
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + ", Bangalore")}`)
      .then(r => r.json())
      .then(d => {
        if (!d.length) return alert("Place not found");
        setMacroMode();
        map.setView([+d[0].lat, +d[0].lon], 15);
      });
  }
const goBtn = document.getElementById("goBtn");

goBtn.addEventListener("click", () => {
  handlePlaceSearch(placeSearch.value.trim().toLowerCase());
});

  // ================= TABLE SEARCH (FILTER ONLY) =================
  const searchBox = document.getElementById("searchBox");
  searchBox.addEventListener("input", () => {
    const q = searchBox.value.toLowerCase();
    document.querySelectorAll("#tableWrap tbody tr").forEach(r => {
      r.style.display = r.innerText.toLowerCase().includes(q) ? "" : "none";
    });
  });

  // ================= MODE SWITCH =================
  document.getElementById("analysisMode").addEventListener("change", e => {
    e.target.value === "macro" ? setMacroMode() : showMicroArea("indiranagar");
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
    const sorted = data.filter(d => d.ward_name)
      .sort((a, b) => b.Final_Balanced - a.Final_Balanced);

    wrap.innerHTML = `
      <table>
        <thead><tr><th>#</th><th>Ward</th><th>Score</th></tr></thead>
        <tbody>
          ${sorted.map((d,i)=>`
            <tr data-lat="${d.centroid_lat}" data-lon="${d.centroid_lon}">
              <td>${i+1}</td>
              <td>${d.ward_name}</td>
              <td>${(+d.Final_Balanced).toFixed(3)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    `;

    wrap.querySelectorAll("tr[data-lat]").forEach(r => {
      r.onclick = () => map.setView([r.dataset.lat, r.dataset.lon], 14);
    });
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
      </table>
    `;

    wrap.querySelectorAll("tr[data-lat]").forEach(r => {
      r.onclick = () => map.setView([r.dataset.lat, r.dataset.lon], 17);
    });
  }

  setTimeout(() => map.invalidateSize(), 300);
});
