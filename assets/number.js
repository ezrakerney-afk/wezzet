/* Wezzet number converters: bases, text encodings, fractions/percent/ppm, scientific notation,
   two's complement, angles and binary codes. The page picks a mode with <div id="app" data-mode=...>. */
(() => {
  const app = document.getElementById("app"), d = app.dataset;
  const el = (tag, props = {}, kids = []) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
  const field = (label, input) => { input.id = input.id || "f" + Math.random().toString(36).slice(2, 8); return el("div", { className: "field" }, [el("label", { htmlFor: input.id, textContent: label }), input]); };
  const inp = (v = "", ph = "") => el("input", { type: "text", value: v, placeholder: ph, spellcheck: false, autocomplete: "off" });
  const area = (ph = "") => el("textarea", { className: "big", rows: 5, placeholder: ph, spellcheck: false });
  const sel = (opts, v) => { const s = el("select"); opts.forEach(([val, t]) => s.add(new Option(t, val))); if (v !== undefined) s.value = v; return s; };
  const row = (...f) => el("div", { className: "field-row " + (f.length === 3 ? "three" : "two") + " tight" }, f);
  const out = el("p", { className: "note", role: "status" });
  const tbl = () => el("table", { className: "plain", style: "margin-top:16px" }, [el("tbody")]);
  const fill = (t, rows) => { const b = t.tBodies[0]; b.textContent = ""; rows.forEach(([k, v]) => { const tr = el("tr"); tr.append(el("td", { textContent: v }), el("td", { textContent: k, style: "font-weight:400" })); b.append(tr); }); };
  const box = el("div", { style: "display:grid;gap:16px" });
  app.append(box);

  const BASES = Array.from({ length: 35 }, (_, i) => i + 2).map((b) => [String(b), ({ 2: "Binary (2)", 8: "Octal (8)", 10: "Decimal (10)", 16: "Hex (16)" })[b] || `Base ${b}`]);
  const DIG = "0123456789abcdefghijklmnopqrstuvwxyz";
  function parseBase(s, b) {
    s = s.trim().toLowerCase().replace(/[\s_]/g, "").replace(/^(0x|0b|0o)/, (p) => (({ "0x": 16, "0b": 2, "0o": 8 })[p] === b ? "" : p));
    if (!s) return null;
    const neg = s.startsWith("-"); if (neg || s.startsWith("+")) s = s.slice(1);
    const [ip, fp = ""] = s.split(".");
    let n = 0n;
    for (const c of ip || "0") { const v = DIG.indexOf(c); if (v < 0 || v >= b) throw new Error(`"${c}" isn't a base-${b} digit`); n = n * BigInt(b) + BigInt(v); }
    let f = 0, p = 1;
    for (const c of fp) { const v = DIG.indexOf(c); if (v < 0 || v >= b) throw new Error(`"${c}" isn't a base-${b} digit`); p /= b; f += v * p; }
    return { neg, n, f };
  }
  function toBase({ neg, n, f }, b, places = 20) {
    let s = n.toString(b);
    if (f > 0) { s += "."; for (let i = 0; i < places && f > 0; i++) { f *= b; const dgt = Math.floor(f + 1e-12); s += DIG[dgt]; f -= dgt; } }
    return (neg && (n || f) ? "-" : "") + s.toUpperCase();
  }

  const MODES = {
    base() {
      const v = inp(d.value || "", "Type a number"), from = sel(BASES, d.from || "10"), to = sel(BASES, d.to || "2");
      const res = el("input", { type: "text", readOnly: true }), t = tbl(), swap = el("button", { type: "button", className: "btn btn-quiet", textContent: "Swap" });
      box.append(field("Number", v), row(field("From", from), field("To", to)), el("div", { className: "row-actions" }, [swap]), field("Result", res), out, t);
      const go = () => {
        out.textContent = ""; res.value = ""; fill(t, []);
        try {
          const x = parseBase(v.value, +from.value); if (!x) return;
          res.value = toBase(x, +to.value);
          fill(t, [["Binary", toBase(x, 2)], ["Octal", toBase(x, 8)], ["Decimal", toBase(x, 10)], ["Hex", toBase(x, 16)], ["Base 36", toBase(x, 36)]]);
          if (+to.value === 2 && !x.f) out.textContent = `${res.value.replace("-", "").length} bits`;
        } catch (e) { out.textContent = e.message; }
      };
      v.oninput = from.onchange = to.onchange = go;
      swap.onclick = () => { [from.value, to.value] = [to.value, from.value]; if (res.value) v.value = res.value; go(); };
      go(); v.focus();
    },
    text() {
      const enc = new TextEncoder(), dec = new TextDecoder();
      const t = area("Hello"), f = sel([["2", "Binary"], ["16", "Hex"], ["10", "Decimal"], ["8", "Octal"], ["b64", "Base64"], ["u", "Unicode code points"]], d.format || "2");
      const sep = sel([[" ", "Space"], ["", "None"], [",", "Comma"], ["\n", "New line"]], " "), o = area("01001000 01101001");
      box.append(field("Text", t), row(field("Format", f), field("Separator", sep)), field("Encoded", o), out);
      const pad = { 2: 8, 16: 2, 8: 3, 10: 0 };
      const go = () => {
        const b = enc.encode(t.value), F = f.value;
        if (F === "b64") { let s = ""; b.forEach((x) => (s += String.fromCharCode(x))); o.value = btoa(s); }
        else if (F === "u") o.value = [...t.value].map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")).join(sep.value);
        else o.value = [...b].map((x) => x.toString(+F).toUpperCase().padStart(pad[F], "0")).join(sep.value);
        out.textContent = `${[...t.value].length} characters, ${b.length} bytes`;
      };
      const back = () => {
        try {
          const F = f.value, v = o.value.trim();
          if (F === "b64") t.value = dec.decode(Uint8Array.from(atob(v.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
          else if (F === "u") t.value = String.fromCodePoint(...v.split(/[^0-9a-f+u]+/i).filter(Boolean).map((x) => parseInt(x.replace(/^u\+?/i, ""), 16)));
          else {
            let parts = v.split(/[\s,]+/).filter(Boolean);
            if (parts.length === 1 && pad[F] && parts[0].length > pad[F]) parts = parts[0].match(new RegExp(`.{1,${pad[F]}}`, "g"));
            t.value = dec.decode(Uint8Array.from(parts, (x) => { const n = parseInt(x, +F); if (Number.isNaN(n) || n > 255) throw new Error(x); return n; }));
          }
          out.textContent = "";
        } catch (e) { out.textContent = "That doesn't look like valid " + f.selectedOptions[0].text.toLowerCase() + "."; }
      };
      t.oninput = go; f.onchange = sep.onchange = go; o.oninput = back;
      if (d.reverse) { o.focus(); } else { go(); t.focus(); }
    },
    fraction() {
      const fs = { dec: inp("", "0.75"), frac: inp("", "3/4"), pct: inp("", "75"), ppm: inp("", "750000"), ppb: inp("", ""), ppt: inp("", "") };
      box.append(row(field("Decimal", fs.dec), field("Fraction", fs.frac)), row(field("Percent (%)", fs.pct), field("Parts per million (ppm)", fs.ppm)), row(field("Parts per billion (ppb)", fs.ppb), field("Parts per trillion (ppt)", fs.ppt)), out);
      const gcd = (a, b) => (b ? gcd(b, a % b) : a);
      function toFrac(x) {
        if (Number.isInteger(x)) return String(x);
        // Continued fractions: the simplest fraction within floating-point error
        let h1 = 1, h0 = 0, k1 = 0, k0 = 1, y = Math.abs(x);
        for (let i = 0; i < 40; i++) { const a = Math.floor(y); [h1, h0] = [a * h1 + h0, h1]; [k1, k0] = [a * k1 + k0, k1]; if (Math.abs(Math.abs(x) - h1 / k1) < 1e-12 * Math.max(1, Math.abs(x)) || k1 > 1e12) break; y = 1 / (y - a); }
        const s = x < 0 ? "-" : "", w = Math.floor(h1 / k1), r = h1 - w * k1;
        return s + h1 + "/" + k1 + (w && r ? `  (${s}${w} ${r}/${k1})` : "");
      }
      function fromFrac(s) {
        const m = s.trim().match(/^(-)?\s*(?:(\d+)\s+)?(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
        if (m) return (m[1] ? -1 : 1) * ((+m[2] || 0) + +m[3] / +m[4]);
        const n = parseFloat(s); return Number.isFinite(n) ? n : NaN;
      }
      const num = (x) => (+x.toPrecision(12)).toString();
      const set = (x, skip) => {
        out.textContent = Number.isFinite(x) ? "" : "Enter a number or a fraction like 3/4 or 1 1/2.";
        if (!Number.isFinite(x)) return;
        const v = { dec: num(x), frac: toFrac(x), pct: num(x * 100), ppm: num(x * 1e6), ppb: num(x * 1e9), ppt: num(x * 1e12) };
        for (const k in fs) if (k !== skip) fs[k].value = v[k];
      };
      const div = { dec: 1, pct: 100, ppm: 1e6, ppb: 1e9, ppt: 1e12 };
      for (const k in fs) fs[k].oninput = () => { if (!fs[k].value.trim()) return; set(k === "frac" ? fromFrac(fs[k].value) : fromFrac(fs[k].value) / div[k], k); };
      const first = fs[d.from || "dec"]; first.value = d.value || ""; if (first.value) first.oninput(); first.focus();
    },
    sci() {
      const v = inp(d.value || "", "123456789 or 1.23e8 or 1.23 × 10^8"), places = sel([["", "All digits"], ...[1, 2, 3, 4, 5, 6, 8, 10].map((n) => [String(n), n + " significant digits"])], "");
      const t = tbl();
      box.append(row(field("Number", v), field("Precision", places)), out, t);
      const go = () => {
        fill(t, []); out.textContent = "";
        const s = v.value.trim().replace(/,/g, "").replace(/\s*[x×·*]\s*10\s*\^\s*/i, "e").replace(/\s/g, "");
        if (!s) return;
        const x = Number(s); if (!Number.isFinite(x)) { out.textContent = "Enter a number like 0.000123 or 1.23e-4."; return; }
        const p = places.value ? +places.value : undefined;
        const e = x.toExponential(p === undefined ? undefined : p - 1), [m, ex] = e.split("e"), exp = +ex;
        const sup = (n) => String(n).replace(/[-0-9]/g, (c) => "⁻⁰¹²³⁴⁵⁶⁷⁸⁹"["-0123456789".indexOf(c)]);
        const eng = Math.floor(exp / 3) * 3, em = x / Math.pow(10, eng);
        fill(t, [["Scientific notation", `${m} × 10${sup(exp)}`], ["E notation", e.replace("e+", "e")], ["Engineering notation", `${+em.toPrecision(p || 12)} × 10${sup(eng)}`], ["Decimal", x.toLocaleString("en-US", { maximumFractionDigits: 20, maximumSignificantDigits: p })], ["Plain", x.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 })]]);
      };
      v.oninput = places.onchange = go; go(); v.focus();
    },
    twos() {
      const dec = inp(d.value || "-5", "-5"), bits = sel([["4", "4 bits"], ["8", "8 bits"], ["16", "16 bits"], ["32", "32 bits"], ["64", "64 bits"]], d.bits || "8"), bin = inp("", "11111011"), hex = el("input", { type: "text", readOnly: true });
      box.append(row(field("Decimal", dec), field("Bit width", bits)), row(field("Two's complement binary", bin), field("Hex", hex)), out);
      const toB = () => {
        out.textContent = ""; const n = BigInt.asIntN ? (() => { try { return BigInt(dec.value.trim()); } catch (e) { return null; } })() : null; const w = +bits.value;
        if (n === null) { out.textContent = "Enter a whole number."; return; }
        const min = -(1n << BigInt(w - 1)), max = (1n << BigInt(w - 1)) - 1n;
        if (n < min || n > max) out.textContent = `Out of range for ${w} bits (${min} to ${max}); showing the lowest ${w} bits.`;
        const u = BigInt.asUintN(w, n); bin.value = u.toString(2).padStart(w, "0").replace(/(.{4})(?=.)/g, "$1 "); hex.value = u.toString(16).toUpperCase().padStart(w / 4, "0");
      };
      const toD = () => {
        const s = bin.value.replace(/\s/g, ""); if (!/^[01]+$/.test(s)) { out.textContent = "Binary digits only (0 and 1)."; return; }
        out.textContent = ""; const w = Math.max(+bits.value, s.length); dec.value = BigInt.asIntN(s.length, BigInt("0b" + s)).toString(); hex.value = BigInt("0b" + s).toString(16).toUpperCase(); if (w !== +bits.value) out.textContent = `Read as ${s.length} bits.`;
      };
      dec.oninput = bits.onchange = toB; bin.oninput = toD; toB(); dec.focus();
    },
    angle() {
      const deg = inp("", "45.5"), rad = inp("", "0.7941"), grad = inp("", ""), dd = inp("", "45"), mm = inp("", "30"), ss = inp("", "0");
      box.append(row(field("Degrees (°)", deg), field("Radians", rad), field("Gradians", grad)), el("h2", { textContent: "Degrees, minutes, seconds" }), row(field("Degrees", dd), field("Minutes (′)", mm), field("Seconds (″)", ss)), out);
      const n = (x) => (+x.toPrecision(12)).toString();
      const set = (x, skip) => {
        if (!Number.isFinite(x)) return;
        if (skip !== "deg") deg.value = n(x); if (skip !== "rad") rad.value = n((x * Math.PI) / 180); if (skip !== "grad") grad.value = n(x / 0.9);
        if (skip !== "dms") { const s = x < 0 ? -1 : 1, a = Math.abs(x), D = Math.floor(a), M = Math.floor((a - D) * 60), S = (a - D - M / 60) * 3600; dd.value = s * D; mm.value = M; ss.value = n(S); }
        out.textContent = `${n(x)}° = ${dd.value}° ${mm.value}′ ${ss.value}″ = ${rad.value} rad (${n(x / 180)}π)`;
      };
      deg.oninput = () => set(parseFloat(deg.value), "deg");
      rad.oninput = () => set((parseFloat(rad.value) * 180) / Math.PI, "rad");
      grad.oninput = () => set(parseFloat(grad.value) * 0.9, "grad");
      dd.oninput = mm.oninput = ss.oninput = () => { const D = parseFloat(dd.value) || 0, s = D < 0 || Object.is(D, -0) ? -1 : 1; set(s * (Math.abs(D) + (parseFloat(mm.value) || 0) / 60 + (parseFloat(ss.value) || 0) / 3600), "dms"); };
      const first = { rad, dms: dd }[d.from] || deg; first.value = d.value || (first === rad ? "1" : "45"); first.oninput(); first.focus();
    },
    codes() {
      const dec = inp(d.value || "25", "25"), bin = el("input", { type: "text", readOnly: true }), gray = inp("", ""), bcd = inp("", "");
      box.append(field("Decimal", dec), row(field("Binary", bin), field("Gray code", gray)), field("BCD (8421)", bcd), out);
      const set = (n, skip) => {
        if (n === null || n < 0n) { out.textContent = "Enter a whole number, 0 or more."; return; }
        out.textContent = "";
        if (skip !== "dec") dec.value = n.toString(); bin.value = n.toString(2);
        if (skip !== "gray") gray.value = (n ^ (n >> 1n)).toString(2);
        if (skip !== "bcd") bcd.value = [...n.toString()].map((c) => (+c).toString(2).padStart(4, "0")).join(" ");
      };
      const big = (s, b) => { try { s = s.replace(/\s/g, ""); return s ? BigInt((b === 2 ? "0b" : "") + s) : null; } catch (e) { return null; } };
      dec.oninput = () => set(big(dec.value, 10), "dec");
      gray.oninput = () => { let g = big(gray.value, 2); if (g === null) return set(null); let n = g; while ((g >>= 1n)) n ^= g; set(n, "gray"); };
      bcd.oninput = () => { const s = bcd.value.replace(/\s/g, ""); if (!/^([01]{4})+$/.test(s)) { out.textContent = "BCD is groups of 4 bits, each 0000 to 1001."; return; } const ds = s.match(/.{4}/g).map((x) => parseInt(x, 2)); if (ds.some((x) => x > 9)) { out.textContent = "A BCD group can't be more than 1001 (9)."; return; } set(BigInt(ds.join("")), "bcd"); };
      const first = { gray, bcd }[d.from] || dec; if (first !== dec) { first.value = ""; set(25n); } else set(big(dec.value, 10), "dec"); first.focus();
    },
  };
  (MODES[d.mode] || MODES.base)();
})();
