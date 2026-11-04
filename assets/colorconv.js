/* Wezzet color format converter: HEX, RGB, HSL, HSV and CMYK, all kept in sync. */
(() => {
  const app = document.getElementById("app"), d = app.dataset;
  const el = (tag, props = {}, kids = []) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
  let uid = 0;
  const field = (label, input) => { input.id = "c" + uid++; return el("div", { className: "field" }, [el("label", { htmlFor: input.id, textContent: label }), input]); };
  const txt = (ph) => el("input", { type: "text", placeholder: ph, spellcheck: false, autocomplete: "off" });
  const F = { hex: txt("#3366ff"), rgb: txt("51, 102, 255"), hsl: txt("225, 100%, 60%"), hsv: txt("225, 80%, 100%"), cmyk: txt("80%, 60%, 0%, 0%") };
  const pick = el("input", { type: "color", style: "width:100%;height:120px;border:1px solid var(--line-strong);border-radius:12px;background:none;padding:0;cursor:pointer" });
  const css = el("input", { type: "text", readOnly: true }), out = el("p", { className: "note", role: "status" });
  app.append(el("div", { style: "display:grid;gap:16px", className: "tight" }, [field("Color", pick), el("div", { className: "field-row two" }, [field("HEX", F.hex), field("RGB (0–255)", F.rgb)]), el("div", { className: "field-row two" }, [field("HSL", F.hsl), field("HSV / HSB", F.hsv)]), el("div", { className: "field-row two" }, [field("CMYK", F.cmyk), field("CSS", css)]), out]));

  const nums = (s) => (s.match(/-?\d*\.?\d+/g) || []).map(Number);
  const r1 = (x) => Math.round(x * 10) / 10;
  function hsl2rgb(h, s, l) { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); return [f(0), f(8), f(4)].map((x) => x * 255); }
  function hsv2rgb(h, s, v) { s /= 100; v /= 100; const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)].map((x) => x * 255); }
  function rgb2hsx([r, g, b]) {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
    let h = 0; if (c) h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; h = (h * 60 + 360) % 360;
    const l = (mx + mn) / 2, sl = c ? c / (1 - Math.abs(2 * l - 1)) : 0, sv = mx ? c / mx : 0;
    return { hsl: [h, sl * 100, l * 100], hsv: [h, sv * 100, mx * 100] };
  }
  const PARSE = {
    hex: (s) => { let h = s.trim().replace(/^#/, ""); if (/^[0-9a-f]{3,4}$/i.test(h)) h = [...h].map((c) => c + c).join(""); if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) return null; return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); },
    rgb: (s) => { const n = nums(s); return n.length >= 3 && n.slice(0, 3).every((x) => x >= 0 && x <= 255) ? n.slice(0, 3) : null; },
    hsl: (s) => { const n = nums(s); return n.length >= 3 ? hsl2rgb(((n[0] % 360) + 360) % 360, n[1], n[2]) : null; },
    hsv: (s) => { const n = nums(s); return n.length >= 3 ? hsv2rgb(((n[0] % 360) + 360) % 360, n[1], n[2]) : null; },
    cmyk: (s) => { const n = nums(s); if (n.length < 4) return null; const [c, m, y, k] = n.map((x) => (s.includes("%") || x > 1 ? x / 100 : x)); return [c, m, y].map((x) => 255 * (1 - x) * (1 - k)); },
  };
  function set(rgb, skip) {
    if (!rgb) { out.textContent = "That color couldn't be read."; return; }
    out.textContent = "";
    const [r, g, b] = rgb.map((x) => Math.max(0, Math.min(255, x))), R = [r, g, b].map(Math.round), hex = "#" + R.map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
    const { hsl, hsv } = rgb2hsx([r, g, b]), k = 1 - Math.max(r, g, b) / 255, cmy = [r, g, b].map((x) => (k === 1 ? 0 : (1 - x / 255 - k) / (1 - k)));
    const v = { hex, rgb: R.join(", "), hsl: `${Math.round(hsl[0])}, ${r1(hsl[1])}%, ${r1(hsl[2])}%`, hsv: `${Math.round(hsv[0])}, ${r1(hsv[1])}%, ${r1(hsv[2])}%`, cmyk: [...cmy, k].map((x) => r1(x * 100) + "%").join(", ") };
    for (const key in F) if (key !== skip) F[key].value = v[key];
    pick.value = hex.toLowerCase(); css.value = `rgb(${R.join(" ")}) / ${hex} / hsl(${Math.round(hsl[0])} ${r1(hsl[1])}% ${r1(hsl[2])}%)`;
  }
  for (const k in F) F[k].oninput = () => set(PARSE[k](F[k].value), k);
  pick.oninput = () => set(PARSE.hex(pick.value), null);
  const start = F[d.from] || F.hex;
  set(PARSE.hex(d.value || "#3366FF")); start.focus(); start.select();
})();
