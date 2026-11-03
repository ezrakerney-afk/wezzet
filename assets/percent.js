const $ = (id) => document.getElementById(id);
const n = (id) => parseFloat($(id).value);
const fmt = (x) => (Number.isFinite(x) ? (+x.toFixed(4)).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "-");
function update() {
  $("r1").textContent = fmt((n("a1") / 100) * n("b1"));
  $("r2").textContent = n("b2") === 0 ? "-" : fmt((n("a2") / n("b2")) * 100) + "%";
  const ch = ((n("b3") - n("a3")) / Math.abs(n("a3"))) * 100;
  $("r3").textContent = n("a3") === 0 ? "-" : (ch > 0 ? "+" : "") + fmt(ch) + "%" + (ch > 0 ? " increase" : ch < 0 ? " decrease" : "");
}
document.querySelectorAll("input").forEach((i) => i.addEventListener("input", update));
update();
