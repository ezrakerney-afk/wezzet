async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) { const t = document.createElement("textarea"); t.value = text; document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); }
  if (btn) { const l = btn.textContent; btn.textContent = "Copied"; setTimeout(() => (btn.textContent = l), 1200); }
}

const $ = (id) => document.getElementById(id);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const toHex = ([r, g, b]) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2; let h = 0, s = 0;
  if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}
function hslToRgb(h, s, l) {
  s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function set(rgb, skip) {
  const hex = toHex(rgb), [h, s, l] = rgbToHsl(rgb);
  $("pick").value = hex;
  if (skip !== "hex") $("hex").value = hex.toUpperCase();
  if (skip !== "rgb") $("rgb").value = `rgb(${rgb.join(", ")})`;
  if (skip !== "hsl") $("hsl").value = `hsl(${h}, ${s}%, ${l}%)`;
  $("sw-w").style.background = $("sw-b").style.background = hex;
  const w = ratio(rgb, [255, 255, 255]), bl = ratio(rgb, [0, 0, 0]);
  $("c-w").textContent = `White text ${w.toFixed(2)}:1 ${w >= 4.5 ? "pass" : "fail"}`;
  $("c-b").textContent = `Black text ${bl.toFixed(2)}:1 ${bl >= 4.5 ? "pass" : "fail"}`;
}
function parseHex(v) { v = v.trim().replace(/^#/, ""); if (/^[0-9a-f]{3}$/i.test(v)) v = v.split("").map((c) => c + c).join(""); if (!/^[0-9a-f]{6}$/i.test(v)) return null; return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)); }
$("pick").addEventListener("input", () => set(parseHex($("pick").value)));
$("hex").addEventListener("input", () => { const c = parseHex($("hex").value); if (c) set(c, "hex"); });
$("rgb").addEventListener("input", () => { const m = $("rgb").value.match(/\d+(\.\d+)?/g); if (m && m.length >= 3) set(m.slice(0, 3).map((x) => clamp(Math.round(+x), 0, 255)), "rgb"); });
$("hsl").addEventListener("input", () => { const m = $("hsl").value.match(/\d+(\.\d+)?/g); if (m && m.length >= 3) set(hslToRgb(+m[0] % 360, clamp(+m[1], 0, 100), clamp(+m[2], 0, 100)), "hsl"); });
document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => copyText($(b.dataset.copy).value, b)));
set(parseHex("#3b82f6"));
