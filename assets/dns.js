/* DNS lookup page: calls /api/dns (Cloudflare DNS over HTTPS). */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  async function go(e) {
    if (e) e.preventDefault();
    const name = $("name").value.trim(); if (!name) return;
    const t = $("type").value;
    $("sum").textContent = "Looking up…"; $("out").hidden = true;
    try { history.replaceState(null, "", "?name=" + encodeURIComponent(name) + (t ? "&type=" + t : "")); } catch (x) {}
    try {
      const r = await fetch("/api/dns?fmt=json&name=" + encodeURIComponent(name) + (t ? "&type=" + t : "")), j = await r.json();
      if (j.error) { $("sum").textContent = j.error; return; }
      const rows = Object.entries(j.answers).flatMap(([k, v]) => v.map((x) => `<tr><td>${k}</td><td class="mono">${esc(x.data)}</td><td>${x.ttl}</td></tr>`));
      $("sum").textContent = !j.exists ? j.name + " does not exist (NXDOMAIN)." : rows.length ? rows.length + " record" + (rows.length > 1 ? "s" : "") + " for " + j.name : "No records of that type for " + j.name + ".";
      $("rows").innerHTML = rows.join(""); $("out").hidden = !rows.length;
    } catch (x) { $("sum").textContent = "Lookup failed. Try again."; }
  }
  $("f").addEventListener("submit", go);
  const q = new URLSearchParams(location.search);
  if (q.get("name")) { $("name").value = q.get("name"); if (q.get("type")) $("type").value = q.get("type").toUpperCase(); go(); }
})();
