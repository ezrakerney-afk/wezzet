/* HTTP status and redirect checker: calls /api/status. */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cls = (s) => (s >= 200 && s < 300 ? "ok" : s >= 300 && s < 400 ? "re" : "er");
  async function go(e) {
    if (e) e.preventDefault();
    const u = $("url").value.trim(); if (!u) return;
    $("sum").textContent = "Checking…"; $("res").hidden = true;
    try { history.replaceState(null, "", "?url=" + encodeURIComponent(u)); } catch (x) {}
    try {
      const r = await fetch("/api/status?fmt=json&url=" + encodeURIComponent(u)), j = await r.json();
      if (j.error && !j.chain) { $("sum").textContent = j.error; return; }
      $("sum").textContent = j.status ? `Final status ${j.status}, ${j.redirects} redirect${j.redirects === 1 ? "" : "s"}, ${j.total_ms} ms.` : "Could not connect: " + j.error;
      $("chain").innerHTML = j.chain.map((c) => `<li><b class="${c.error ? "er" : cls(c.status)}">${c.error ? "Error" : c.status}</b> <span class="mono">${esc(c.url)}</span>${c.ms != null ? ` <span class="hint">${c.ms} ms</span>` : ""}${c.error ? ` <span class="hint">${esc(c.error)}</span>` : ""}</li>`).join("");
      $("rows").innerHTML = Object.entries(j.headers || {}).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="mono">${esc(v)}</td></tr>`).join("");
      $("hd").hidden = !j.headers || !Object.keys(j.headers).length; $("res").hidden = false;
    } catch (x) { $("sum").textContent = "Check failed. Try again."; }
  }
  $("f").addEventListener("submit", go);
  const q = new URLSearchParams(location.search).get("url");
  if (q) { $("url").value = q; go(); }
})();
