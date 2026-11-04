/* Toolbar popup: searches Wezzet's tool list (loaded from the site, so it stays current). */
const q = document.getElementById("q"), list = document.getElementById("list");
let tools = [];
fetch("https://wezzet.com/assets/home.js").then((r) => r.text()).then((t) => {
  tools = [...t.matchAll(/^\s*\["([^"]+)", "(\/[^"]*)", "([^"]*)"\]/gm)].map((m) => ({ name: m[1], path: m[2], words: (m[1] + " " + m[3]).toLowerCase() }));
  show();
});
function show() {
  const w = q.value.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = w.length ? tools.filter((t) => w.every((x) => t.words.includes(x))).slice(0, 8) : tools.filter((t) => ["/convert", "/ai", "/image", "/pdf", "/video", "/compress"].includes(t.path));
  list.textContent = "";
  (hits.length ? hits : [{ name: `ask wezzetai: "${q.value}"`, path: "/ai?q=" + encodeURIComponent(q.value) }]).forEach((t, i) => {
    const a = document.createElement("a"); a.href = "https://wezzet.com" + t.path; a.target = "_blank"; a.textContent = t.name; if (!i) a.className = "on";
    const li = document.createElement("li"); li.append(a); list.append(li);
  });
}
q.addEventListener("input", show);
q.addEventListener("keydown", (e) => { if (e.key === "Enter") list.querySelector("a")?.click(); });
