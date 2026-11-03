const $ = (id) => document.getElementById(id);
const pad = (x) => String(x).padStart(2, "0");
const today = new Date();
$("on").value = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
const parse = (v) => { const [y, m, d] = v.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const dim = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
function update() {
  if (!$("dob").value || !$("on").value) return;
  const a = parse($("dob").value), b = parse($("on").value);
  if (b < a) { $("age").textContent = "The second date is before the first."; return; }
  let y = b.getUTCFullYear() - a.getUTCFullYear(), m = b.getUTCMonth() - a.getUTCMonth(), d = b.getUTCDate() - a.getUTCDate();
  if (d < 0) { m--; d += dim(b.getUTCFullYear(), b.getUTCMonth() - 1); }
  if (m < 0) { y--; m += 12; }
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  $("age").textContent = `${plural(y, "year")}, ${plural(m, "month")}, ${plural(d, "day")}`;
  const days = Math.round((b - a) / 86400000);
  $("days").textContent = days.toLocaleString();
  $("weeks").textContent = Math.floor(days / 7).toLocaleString();
  $("months").textContent = (y * 12 + m).toLocaleString();
  let nb = new Date(Date.UTC(b.getUTCFullYear(), a.getUTCMonth(), Math.min(a.getUTCDate(), dim(b.getUTCFullYear(), a.getUTCMonth()))));
  if (nb < b) nb = new Date(Date.UTC(b.getUTCFullYear() + 1, a.getUTCMonth(), Math.min(a.getUTCDate(), dim(b.getUTCFullYear() + 1, a.getUTCMonth()))));
  $("next").textContent = Math.round((nb - b) / 86400000).toLocaleString();
}
["dob", "on"].forEach((id) => $(id).addEventListener("input", update));
update();
