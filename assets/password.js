async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) { const t = document.createElement("textarea"); t.value = text; document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); }
  if (btn) { const l = btn.textContent; btn.textContent = "Copied"; setTimeout(() => (btn.textContent = l), 1200); }
}

const $ = (id) => document.getElementById(id);
const SETS = { upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", lower: "abcdefghijklmnopqrstuvwxyz", digits: "0123456789", symbols: "!@#$%^&*()-_=+[]{};:,.?/~" };
const SIMILAR = /[0OolI1|]/g;
function randInt(n) {
  const max = Math.floor(0x100000000 / n) * n, a = new Uint32Array(1);
  do crypto.getRandomValues(a); while (a[0] >= max);
  return a[0] % n;
}
function gen() {
  const len = +$("len").value;
  $("len-out").textContent = len;
  let sets = Object.keys(SETS).filter((k) => $(k).checked).map((k) => ($("similar").checked ? SETS[k].replace(SIMILAR, "") : SETS[k]));
  if (!sets.length) { $("upper").checked = $("lower").checked = true; return gen(); }
  const all = sets.join("");
  const chars = sets.map((s) => s[randInt(s.length)]); // at least one from each chosen set
  while (chars.length < len) chars.push(all[randInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = randInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  const pw = chars.slice(0, len).join("");
  $("pw").textContent = pw;
  const bits = Math.round(len * Math.log2(all.length));
  $("strength").textContent = `${bits >= 100 ? "Very strong" : bits >= 70 ? "Strong" : bits >= 50 ? "Fair" : "Weak"} (about ${bits} bits)`;
}
["len", "upper", "lower", "digits", "symbols", "similar"].forEach((id) => $(id).addEventListener("input", gen));
$("gen").addEventListener("click", gen);
$("copy").addEventListener("click", (e) => copyText($("pw").textContent, e.currentTarget));
gen();
