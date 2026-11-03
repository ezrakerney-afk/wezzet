const $ = (id) => document.getElementById(id);
function randInt(n) { const max = Math.floor(0x100000000 / n) * n, a = new Uint32Array(1); do crypto.getRandomValues(a); while (a[0] >= max); return a[0] % n; }
$("go-n").addEventListener("click", () => {
  let lo = Math.ceil(+$("min").value), hi = Math.floor(+$("max").value), k = Math.max(1, Math.min(1000, Math.floor(+$("count").value) || 1));
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return;
  if (lo > hi) [lo, hi] = [hi, lo];
  const span = hi - lo + 1;
  if (span > 2 ** 32) { $("r-n").textContent = "Range is too large."; return; }
  const out = [];
  if ($("unique").checked) {
    if (k > span) { $("r-n").textContent = `Only ${span} numbers in that range.`; return; }
    const seen = new Set();
    while (out.length < k) { const v = lo + randInt(span); if (!seen.has(v)) { seen.add(v); out.push(v); } }
  } else for (let i = 0; i < k; i++) out.push(lo + randInt(span));
  $("r-n").textContent = out.join(", ");
});
const items = () => $("list").value.split("\n").map((s) => s.trim()).filter(Boolean);
$("go-l").addEventListener("click", () => { const l = items(); $("r-l").textContent = l.length ? l[randInt(l.length)] : "Add some items first."; });
$("shuffle").addEventListener("click", () => {
  const l = items();
  for (let i = l.length - 1; i > 0; i--) { const j = randInt(i + 1); [l[i], l[j]] = [l[j], l[i]]; }
  $("list").value = l.join("\n"); $("r-l").textContent = l.length ? "Shuffled." : "Add some items first.";
});
$("flip").addEventListener("click", () => { $("r-c").textContent = "…"; setTimeout(() => ($("r-c").textContent = randInt(2) ? "Heads" : "Tails"), 250); });
