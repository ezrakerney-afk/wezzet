const $ = (id) => document.getElementById(id);
const msg = $("msg"), t = $("t");
function show(text, bad) { msg.textContent = text; msg.className = "note" + (bad ? " error" : ""); msg.hidden = !text; }
async function go() {
  const u = $("u").value.trim();
  if (!u) return;
  show("Loading..."); t.value = "";
  history.replaceState(null, "", "?url=" + encodeURIComponent(u));
  try {
    const r = await fetch("/api/read?fmt=json&max=100000&url=" + encodeURIComponent(u) + "&format=" + $("fmt").value);
    const j = await r.json();
    if (j.error) { show(j.error, true); return; }
    t.value = (j.title ? "# " + j.title + "\n\n" : "") + j.text;
    show(j.end < j.total ? "Showing the first " + j.end.toLocaleString() + " of " + j.total.toLocaleString() + " characters." : "");
  } catch (e) { show("Couldn't read that page.", true); }
}
$("f").addEventListener("submit", (e) => { e.preventDefault(); go(); });
$("fmt").addEventListener("change", () => { if (t.value) go(); });
$("copy").addEventListener("click", async (e) => {
  try { await navigator.clipboard.writeText(t.value); } catch (er) { t.select(); document.execCommand("copy"); }
  const b = e.currentTarget, l = b.textContent; b.textContent = "Copied"; setTimeout(() => (b.textContent = l), 1200);
});
const start = new URLSearchParams(location.search).get("url");
if (start) { $("u").value = start; go(); }
