/* Wezzet transport tracker: one search box, live data from /api/transport, client-side sorting. Text is set with textContent only. */
(() => {
  const $ = (id) => document.getElementById(id);
  const t = (ts) => ts ? new Date(typeof ts === "number" && ts < 1e12 ? ts * 1e3 : ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const map = (r) => r.lat != null ? "https://www.openstreetmap.org/?mlat=" + r.lat + "&mlon=" + r.lon + "#map=9/" + r.lat + "/" + r.lon : "";
  const M = {
    flights: { label: "Flights", ph: "Flight callsign (UAL123, BAW), ICAO24 hex or country. Empty = all", cols: [["callsign", "Flight"], ["country", "Country"], ["alt_m", "Altitude (m)"], ["speed_kmh", "Speed (km/h)"], ["heading", "Heading"], ["ground", "On ground"], ["squawk", "Squawk"], ["seen", "Seen", t], ["map", "Map"]] },
    trains: { label: "Trains", ph: "Station or city (Berlin Hbf, Zürich, Paris Gare de Lyon)", need: 1, cols: [["number", "Train"], ["line", "Line"], ["to", "To"], ["departs", "Departs", t], ["scheduled", "Scheduled", t], ["track", "Track"], ["operator", "Operator"], ["kind", "Type"]] },
    ships: { label: "Ships", ph: "Ship name, MMSI, IMO, callsign or destination port. Empty = all", cols: [["name", "Ship"], ["mmsi", "MMSI"], ["imo", "IMO"], ["destination", "Destination"], ["speed_kn", "Speed (kn)"], ["heading", "Heading"], ["seen", "Seen", t], ["map", "Map"]] },
    airports: { label: "Airports", ph: "Airport name, code or city (JFK, Heathrow, Narita)", need: 2, cols: [["name", "Airport"], ["city", "City"], ["country", "Country"], ["map", "Map"]] },
    ports: { label: "Ship ports", ph: "Port name (Rotterdam, Singapore)", need: 2, cols: [["name", "Port"], ["city", "City"], ["country", "Country"], ["map", "Map"]] },
    stations: { label: "Stations", ph: "Station name", need: 2, cols: [["name", "Station"], ["city", "City"], ["country", "Country"], ["map", "Map"]] },
    railways: { label: "Railways", ph: "Railway or train route name/number (ICE 3, Eurostar, Trans-Siberian)", need: 2, cols: [["name", "Route"], ["code", "Number"], ["operator", "Operator"], ["from", "From"], ["to", "To"], ["osm", "Details"]] },
  };
  let mode = "flights", rows = [], sort = null, dir = 1;
  const tabs = $("tabs");
  for (const k in M) { const b = document.createElement("button"); b.type = "button"; b.role = "tab"; b.textContent = M[k].label; b.dataset.k = k; b.onclick = () => pick(k); tabs.append(b); }
  function pick(k) {
    mode = k; rows = []; sort = null;
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.k === k)));
    $("q").placeholder = M[k].ph; $("meta").textContent = ""; $("meta").className = "tt-meta"; draw();
    try { history.replaceState(null, "", "#" + k); } catch (e) {}
  }
  function draw() {
    const cols = M[mode].cols, th = $("th"), tb = $("tb");
    th.textContent = ""; tb.textContent = "";
    const tr = document.createElement("tr");
    cols.forEach(([k, l]) => { const h = document.createElement("th"); h.textContent = l; h.scope = "col"; if (sort === k) h.setAttribute("aria-sort", dir > 0 ? "ascending" : "descending");
      if (k !== "map" && k !== "osm") h.onclick = () => { dir = sort === k ? -dir : 1; sort = k; draw(); }; tr.append(h); });
    th.append(tr);
    const list = sort ? [...rows].sort((a, b) => { const x = a[sort], y = b[sort]; return (x == null || x === "") - (y == null || y === "") || (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * dir; }) : rows;
    for (const r of list) {
      const row = document.createElement("tr");
      for (const [k, , f] of cols) {
        const td = document.createElement("td");
        const href = k === "map" ? map(r) : k === "osm" ? r.osm : "";
        if (href) { const a = document.createElement("a"); a.href = href; a.target = "_blank"; a.rel = "noopener"; a.textContent = k === "map" ? "View" : "OSM ↗"; td.append(a); }
        else td.textContent = f ? f(r[k]) : r[k] === true ? "yes" : r[k] === false ? "" : r[k] ?? "";
        row.append(td);
      }
      tb.append(row);
    }
    $("empty").hidden = rows.length > 0;
  }
  $("f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("q").value.trim(), m = $("meta");
    if (M[mode].need && q.length < M[mode].need) { m.textContent = "Type something to search " + M[mode].label.toLowerCase() + "."; return; }
    m.className = "tt-meta"; m.textContent = "Fetching live data…";
    try {
      const r = await fetch("/api/transport?" + new URLSearchParams({ mode, q, limit: $("lim").value }));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Search failed.");
      rows = j.items; draw();
      m.textContent = j.count + " found" + (j.count > rows.length ? ", showing " + rows.length : "") + " · " + j.source + " · " + new Date().toLocaleTimeString();
      $("empty").textContent = "Nothing matched.";
    } catch (err) { m.className = "tt-meta bad"; m.textContent = err.message; }
  });
  pick(M[location.hash.slice(1)] ? location.hash.slice(1) : "flights");
})();
