const $ = (id) => document.getElementById(id);
const q = $("q"), out = $("out"), hist = $("hist");
let timer, seq = 0;
async function run(save) {
  const v = q.value.trim(), n = ++seq;
  if (!v) { out.textContent = ""; return; }
  try {
    const r = await fetch("/api/calc?q=" + encodeURIComponent(v));
    const a = (await r.text()).trim();
    if (n !== seq) return;
    const bad = a.startsWith("couldn't");
    out.textContent = bad && !save ? "" : a;
    if (save && !bad) {
      const li = document.createElement("li"); li.textContent = v + "  →  " + a; hist.prepend(li);
      while (hist.children.length > 10) hist.lastChild.remove();
      history.replaceState(null, "", "?q=" + encodeURIComponent(v));
    }
  } catch (e) { out.textContent = "Couldn't reach the calculator. Check your connection."; }
}
q.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => run(false), 350); });
$("f").addEventListener("submit", (e) => { e.preventDefault(); clearTimeout(timer); run(true); });
const start = new URLSearchParams(location.search).get("q");
if (start) { q.value = start; run(true); }
