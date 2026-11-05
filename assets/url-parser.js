/* URL parser: splits a URL into parts and decodes the query string. */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const dec = (s) => { try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch (e) { return s; } };
  const row = (k, v) => v ? `<tr><td>${k}</td><td class="mono">${esc(v)}</td><td><button class="btn btn-quiet sm" type="button" data-copy="${esc(v)}">Copy</button></td></tr>` : "";
  function run() {
    const raw = $("u").value.trim();
    if (!raw) { $("res").hidden = true; $("sum").textContent = ""; return; }
    let u;
    try { u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : "https://" + raw); } catch (e) { $("res").hidden = true; $("sum").textContent = "That is not a valid URL."; return; }
    $("sum").textContent = "";
    $("parts").innerHTML = row("Protocol", u.protocol.replace(/:$/, "")) + row("Username", dec(u.username)) + row("Password", dec(u.password)) + row("Host", u.hostname) + row("Port", u.port) + row("Origin", u.origin !== "null" ? u.origin : "") + row("Path", dec(u.pathname)) + row("Query", u.search) + row("Fragment", dec(u.hash.slice(1)));
    const q = [...u.searchParams];
    $("qh").hidden = !q.length;
    $("query").innerHTML = q.map(([k, v]) => row(esc(k), v)).join("");
    $("res").hidden = false;
  }
  $("u").addEventListener("input", run);
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-copy]"); if (b && navigator.clipboard) { navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1200); } });
  run();
})();
