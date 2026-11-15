/* Wezzet transport tracker: one search box, live data from /api/transport, client-side sorting. Text is set with textContent only. */
(() => {
  const $ = (id) => document.getElementById(id);
  const t = (ts) => ts ? new Date(typeof ts === "number" && ts < 1e12 ? ts * 1e3 : ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const map = (r) => r.lat != null ? "https://www.openstreetmap.org/?mlat=" + r.lat + "&mlon=" + r.lon + "#map=9/" + r.lat + "/" + r.lon : "";
  const M = {
    flights: { label: "Flights", quick: ["JFK", "Heathrow", "Dubai", "Tokyo", "Los Angeles", "Singapore Changi"], ph: "Flight number (UA123), registration (N12345) or airport (JFK, Tokyo)", cols: [["callsign", "Flight"], ["reg", "Registration"], ["type", "Type"], ["alt_m", "Altitude (m)"], ["speed_kmh", "Speed (km/h)"], ["heading", "Heading"], ["dist_km", "Distance (km)"], ["ground", "On ground"], ["map", "Map"]] },
    trains: { label: "Trains", quick: ["Berlin Hbf", "Paris Gare de Lyon", "Zürich HB", "Amsterdam Centraal"], ph: "Station or city (Berlin Hbf, Zürich, Paris Gare de Lyon)", need: 1, cols: [["number", "Train"], ["line", "Line"], ["to", "To"], ["departs", "Departs", t], ["scheduled", "Scheduled", t], ["track", "Track"], ["operator", "Operator"], ["kind", "Type"]] },
    ships: { label: "Ships", quick: ["Live sample"], ph: "Ship name, 9-digit MMSI, IMO, callsign or destination. Leave empty for a live sample", cols: [["name", "Ship"], ["mmsi", "MMSI"], ["imo", "IMO"], ["destination", "Destination"], ["speed_kn", "Speed (kn)"], ["heading", "Heading"], ["seen", "Seen", t], ["map", "Map"]] },
    airports: { label: "Airports", quick: ["Heathrow", "Narita", "O\u2019Hare"], ph: "Airport name, code or city (JFK, Heathrow, Narita)", need: 2, cols: [["name", "Airport"], ["city", "City"], ["country", "Country"], ["map", "Map"]] },
    ports: { label: "Ship ports", quick: ["Rotterdam", "Singapore", "Los Angeles"], ph: "Port name (Rotterdam, Singapore)", need: 2, cols: [["name", "Port"], ["city", "City"], ["country", "Country"], ["map", "Map"]] },
    stations: { label: "Stations", quick: ["Tokyo", "Milano Centrale", "Grand Central"], ph: "Station name", need: 2, cols: [["name", "Station"], ["city", "City"], ["country", "Country"], ["map", "Map"]] },
  };
  let mode = "flights", rows = [], sort = null, dir = 1;
  const tabs = $("tabs");
  for (const k in M) { const b = document.createElement("button"); b.type = "button"; b.role = "tab"; b.textContent = M[k].label; b.dataset.k = k; b.onclick = () => pick(k); tabs.append(b); }
  function pick(k) {
    mode = k; rows = []; sort = null;
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.k === k)));
    $("q").placeholder = M[k].ph; $("q").value = ""; $("meta").textContent = ""; $("meta").className = "tt-meta"; $("empty").textContent = "Pick a type and search."; draw();
    // One-click examples, so the page opens instantly and a first search is one tap.
    $("quick").replaceChildren("Try: ", ...(M[k].quick || []).map((t) => { const b = document.createElement("button"); b.type = "button"; b.textContent = t; b.onclick = () => { $("q").value = t === "Live sample" ? "" : t; search(); }; return b; }));
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
  let ctl = null;
  async function search() {
    const q = $("q").value.trim(), m = $("meta"), btn = $("f").querySelector("button");
    if (M[mode].need && q.length < M[mode].need) { m.className = "tt-meta"; m.textContent = "Type something to search " + M[mode].label.toLowerCase() + "."; return; }
    if (ctl) ctl.abort();
    const mine = (ctl = new AbortController()), asked = mode, timer = setTimeout(() => mine.abort(), 15000);
    m.className = "tt-meta"; m.textContent = mode === "ships" ? "Listening for ships… about 3 seconds" : mode === "flights" ? "Fetching live flights… this can take a few seconds" : "Fetching live data…"; btn.disabled = true; $("tb").classList.add("tt-wait");
    try {
      const r = await fetch("/api/transport?" + new URLSearchParams({ mode, q, limit: $("lim").value }), { signal: mine.signal });
      const j = await r.json().catch(() => ({ error: "The live source didn't answer. Try again in a minute." }));
      if (asked !== mode) return;
      if (!r.ok) throw new Error(j.error || "Search failed.");
      rows = j.items; sort = null; draw();
      m.textContent = (j.note ? j.note + " " : "") + j.count + " found" + (j.count > rows.length ? ", showing " + rows.length : "") + " · " + j.source + " · " + new Date().toLocaleTimeString();
      $("empty").textContent = j.note || "Nothing matched.";
    } catch (err) {
      if (asked !== mode || (err.name === "AbortError" && ctl !== mine)) return;
      m.className = "tt-meta bad"; m.textContent = err.name === "AbortError" ? "That took too long, so it was stopped. Try again." : err.message;
    } finally { clearTimeout(timer); if (ctl === mine) { btn.disabled = false; $("tb").classList.remove("tt-wait"); } }
  }
  $("f").addEventListener("submit", (e) => { e.preventDefault(); search(); });
  pick(M[location.hash.slice(1)] ? location.hash.slice(1) : "flights");
})();
