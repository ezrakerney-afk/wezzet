const $ = (id) => document.getElementById(id);
const money = (x) => (Number.isFinite(x) ? x : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function update() {
  const sel = document.querySelector('input[name="pct"]:checked').value;
  $("custom").hidden = sel !== "custom";
  const pct = sel === "custom" ? parseFloat($("custom").value) || 0 : +sel;
  const bill = parseFloat($("bill").value) || 0, people = Math.max(1, Math.floor(+$("people").value) || 1);
  const tip = bill * pct / 100, total = bill + tip;
  $("tip").textContent = money(tip); $("total").textContent = money(total); $("each").textContent = money(total / people);
}
document.querySelectorAll("input").forEach((i) => i.addEventListener("input", update));
update();
