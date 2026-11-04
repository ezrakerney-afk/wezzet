/* Wezzet electrical calculators: Ohm's law, power (DC / AC single and three phase), energy and battery
   capacity, light (lumens, lux, watts) and decibels. The page picks one with <div id="app" data-mode=...>. */
(() => {
  const app = document.getElementById("app"), d = app.dataset;
  const el = (tag, props = {}, kids = []) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
  let uid = 0;
  const field = (label, input) => { input.id = "e" + uid++; return el("div", { className: "field" }, [el("label", { htmlFor: input.id, textContent: label }), input]); };
  const num = (v = "", ph = "") => el("input", { type: "number", step: "any", value: v, placeholder: ph });
  const sel = (opts, v) => { const s = el("select"); opts.forEach(([val, t]) => s.add(new Option(t, val))); if (v !== undefined) s.value = v; return s; };
  const row = (...f) => el("div", { className: "field-row " + (f.length >= 3 ? "three" : "two") + " tight" }, f);
  const out = el("p", { className: "note", role: "status" });
  const tbody = el("tbody"), table = el("table", { className: "plain", style: "margin-top:16px" }, [tbody]);
  const show = (rows) => { tbody.textContent = ""; rows.forEach(([k, v]) => { const tr = el("tr"); tr.append(el("td", { textContent: v }), el("td", { textContent: k, style: "font-weight:400" })); tbody.append(tr); }); };
  const f = (x, u = "") => (!Number.isFinite(x) ? "–" : (Math.abs(x) >= 1e12 || (Math.abs(x) < 1e-4 && x !== 0) ? x.toExponential(4) : (+x.toPrecision(8)).toLocaleString("en-US", { maximumFractionDigits: 8 })) + (u ? " " + u : ""));
  const v = (i) => (i.value.trim() === "" ? NaN : parseFloat(i.value));
  const box = el("div", { style: "display:grid;gap:16px" });
  app.append(box);

  const MODES = {
    // Any two of voltage, current, resistance and power give the other two
    ohm() {
      const V = num(d.v || "", "12"), I = num(d.i || "", "2"), R = num("", ""), P = num("", "");
      const clear = el("button", { type: "button", className: "btn btn-quiet", textContent: "Clear" });
      box.append(el("p", { className: "hint", textContent: "Fill in any two; the other two are worked out." }), row(field("Voltage (V)", V), field("Current (A)", I)), row(field("Resistance (Ω)", R), field("Power (W)", P)), el("div", { className: "row-actions" }, [clear]), out, table);
      const order = [];
      const go = (src) => {
        if (src) { const i = order.indexOf(src); if (i >= 0) order.splice(i, 1); if (src.value.trim() !== "") order.unshift(src); }
        const [a, b] = order; show([]); out.textContent = "";
        if (!a || !b) return;
        let vv = v(V), ii = v(I), rr = v(R), pp = v(P);
        const k = new Set([a, b]);
        if (k.has(V) && k.has(I)) { rr = vv / ii; pp = vv * ii; }
        else if (k.has(V) && k.has(R)) { ii = vv / rr; pp = (vv * vv) / rr; }
        else if (k.has(V) && k.has(P)) { ii = pp / vv; rr = (vv * vv) / pp; }
        else if (k.has(I) && k.has(R)) { vv = ii * rr; pp = ii * ii * rr; }
        else if (k.has(I) && k.has(P)) { vv = pp / ii; rr = pp / (ii * ii); }
        else { vv = Math.sqrt(pp * rr); ii = Math.sqrt(pp / rr); }
        for (const [n, x] of [[V, vv], [I, ii], [R, rr], [P, pp]]) if (!k.has(n)) n.value = Number.isFinite(x) ? +x.toPrecision(8) : "";
        out.textContent = `V = I × R,  P = V × I`;
        show([["Volts", f(vv, "V")], ["Millivolts", f(vv * 1e3, "mV")], ["Amps", f(ii, "A")], ["Milliamps", f(ii * 1e3, "mA")], ["Ohms", f(rr, "Ω")], ["Kilohms", f(rr / 1e3, "kΩ")], ["Watts", f(pp, "W")], ["Kilowatts", f(pp / 1e3, "kW")]]);
      };
      [V, I, R, P].forEach((n) => (n.oninput = () => go(n)));
      clear.onclick = () => { [V, I, R, P].forEach((n) => (n.value = "")); order.length = 0; go(); };
      [V, I].forEach((n) => n.value && order.push(n)); go();
    },
    // Amps, volts, watts, kW, VA, kVA with power factor and phase
    power() {
      const phase = sel([["dc", "DC"], ["1", "AC single phase"], ["3", "AC three phase (line to line)"]], d.phase || "dc");
      const V = num(d.v || "120", "120"), I = num("", "10"), P = num("", ""), S = num("", ""), pf = num("1", "0.8");
      pf.min = 0; pf.max = 1;
      box.append(row(field("Circuit", phase), field("Power factor", pf)), row(field("Voltage (V)", V), field("Current (A)", I)), row(field("Real power (W)", P), field("Apparent power (VA)", S)), el("p", { className: "hint", textContent: "Fill in two of voltage, current and power." }), out, table);
      let last = [];
      const go = (src) => {
        if (src) { last = last.filter((x) => x !== src); if (src.value.trim() !== "") last.unshift(src); }
        const k = phase.value === "3" ? Math.sqrt(3) : 1, p = phase.value === "dc" ? 1 : Math.min(1, Math.max(0, v(pf) || 1));
        pf.disabled = phase.value === "dc";
        const known = new Set(last.slice(0, 2));
        let vv = v(V), ii = v(I), ss;
        if (known.has(P) && known.has(V)) ii = v(P) / (k * vv * p);
        else if (known.has(P) && known.has(I)) vv = v(P) / (k * ii * p);
        else if (known.has(S) && known.has(V)) ii = v(S) / (k * vv);
        else if (known.has(S) && known.has(I)) vv = v(S) / (k * ii);
        ss = k * vv * ii; const pp = ss * p;
        if (!known.has(V)) V.value = Number.isFinite(vv) ? +vv.toPrecision(8) : V.value;
        if (!known.has(I)) I.value = Number.isFinite(ii) ? +ii.toPrecision(8) : "";
        if (!known.has(P)) P.value = Number.isFinite(pp) ? +pp.toPrecision(8) : "";
        if (!known.has(S)) S.value = Number.isFinite(ss) ? +ss.toPrecision(8) : "";
        out.textContent = phase.value === "dc" ? "P = V × I" : phase.value === "1" ? "P = PF × V × I,  S = V × I" : "P = √3 × PF × V × I,  S = √3 × V × I";
        show([["Watts", f(pp, "W")], ["Kilowatts", f(pp / 1e3, "kW")], ["Volt-amps", f(ss, "VA")], ["Kilovolt-amps", f(ss / 1e3, "kVA")], ["Reactive power", f(Math.sqrt(Math.max(0, ss * ss - pp * pp)), "VAR")], ["Amps", f(ii, "A")], ["Milliamps", f(ii * 1e3, "mA")], ["Volts", f(vv, "V")], ["Horsepower", f(pp / 745.69987, "hp")], ["BTU per hour", f(pp * 3.41214163, "BTU/h")]]);
      };
      [V, I, P, S].forEach((n) => (n.oninput = () => go(n)));
      phase.onchange = pf.oninput = () => go();
      const start = { w: P, va: S, a: I }[d.from] || I; start.value = d.value || (start === I ? "10" : "1000"); last = [start, V]; go();
    },
    // Energy over time and battery capacity
    energy() {
      const P = num(d.w || "100", "100"), T = num("1", "1"), unit = sel([["1", "hours"], ["0.0166666667", "minutes"], ["0.000277777778", "seconds"], ["24", "days"]], "1");
      const bV = num("3.7", "3.7"), mAh = num("", "3000"), Wh = num("", "11.1");
      box.append(el("h2", { textContent: "Power over time" }), row(field("Power (W)", P), field("Time", T), field("Unit", unit)), el("h2", { textContent: "Battery capacity" }), row(field("Battery voltage (V)", bV), field("Capacity (mAh)", mAh), field("Energy (Wh)", Wh)), out, table);
      const go = () => {
        const wh = v(P) * v(T) * +unit.value;
        show([["Watt hours", f(wh, "Wh")], ["Kilowatt hours", f(wh / 1e3, "kWh")], ["Joules", f(wh * 3600, "J")], ["Kilojoules", f(wh * 3.6, "kJ")], ["Kilocalories", f((wh * 3600) / 4184, "kcal")], ["BTU", f(wh * 3.41214163, "BTU")]]);
        out.textContent = Number.isFinite(wh) ? `${f(v(P), "W")} for ${T.value} ${unit.selectedOptions[0].text} uses ${f(wh / 1e3, "kWh")}.` : "";
      };
      const bat = (src) => { const vv = v(bV); if (src === Wh) mAh.value = Number.isFinite(v(Wh) / vv) ? +((v(Wh) / vv) * 1000).toPrecision(8) : ""; else Wh.value = Number.isFinite(v(mAh) * vv) ? +((v(mAh) * vv) / 1000).toPrecision(8) : ""; };
      P.oninput = T.oninput = unit.onchange = go;
      mAh.oninput = () => bat(mAh); Wh.oninput = () => bat(Wh); bV.oninput = () => bat(mAh.value ? mAh : Wh);
      if (d.from === "wh") { Wh.value = "11.1"; bat(Wh); } else { mAh.value = "3000"; bat(mAh); }
      go();
    },
    // Lumens, watts and lux
    light() {
      const EFF = [["90", "LED (90 lm/W)"], ["60", "CFL (60 lm/W)"], ["15", "Incandescent (15 lm/W)"], ["20", "Halogen (20 lm/W)"], ["80", "Fluorescent tube (80 lm/W)"], ["683", "Ideal 555 nm light (683 lm/W)"]];
      const type = sel(EFF, "90"), W = num(d.w || "10", "10"), L = num("", "900"), area = num("10", "10"), aunit = sel([["1", "square meters"], ["0.09290304", "square feet"]], "1"), lux = num("", "");
      box.append(el("h2", { textContent: "Lumens and watts" }), row(field("Light type", type), field("Power (W)", W), field("Brightness (lm)", L)), el("h2", { textContent: "Lumens and lux" }), row(field("Area lit", area), field("Area unit", aunit), field("Illuminance (lux)", lux)), out);
      const m2 = () => v(area) * +aunit.value;
      const fromW = () => { L.value = +(v(W) * +type.value).toPrecision(8) || ""; toLux(); };
      const fromL = () => { W.value = +(v(L) / +type.value).toPrecision(8) || ""; toLux(); };
      const toLux = () => { lux.value = +(v(L) / m2()).toPrecision(8) || ""; out.textContent = lux.value ? `${L.value} lm over ${area.value} ${aunit.selectedOptions[0].text} = ${lux.value} lux (${f(v(lux) / 10.7639104, "foot-candles")})` : ""; };
      W.oninput = type.onchange = fromW; L.oninput = fromL; area.oninput = aunit.onchange = toLux;
      lux.oninput = () => { L.value = +(v(lux) * m2()).toPrecision(8) || ""; W.value = +(v(L) / +type.value).toPrecision(8) || ""; };
      if (d.from === "lm") { L.value = "800"; fromL(); } else fromW();
    },
    // Decibels: power and amplitude ratios, dBm, dBW
    db() {
      const dB = num(d.db || "3", "3"), pr = num("", ""), ar = num("", ""), dBm = num("", "30"), mW = num("", "1000"), W = num("", "1"), dBW = num("", "");
      box.append(el("h2", { textContent: "Decibels and ratios" }), row(field("Decibels (dB)", dB), field("Power ratio", pr), field("Voltage / amplitude ratio", ar)), el("h2", { textContent: "dBm, milliwatts, watts" }), row(field("dBm", dBm), field("Milliwatts (mW)", mW)), row(field("Watts (W)", W), field("dBW", dBW)), out);
      const n = (x) => (Number.isFinite(x) ? +x.toPrecision(10) : "");
      const ratio = (x, skip) => { if (skip !== dB) dB.value = n(x); if (skip !== pr) pr.value = n(Math.pow(10, x / 10)); if (skip !== ar) ar.value = n(Math.pow(10, x / 20)); };
      dB.oninput = () => ratio(v(dB), dB); pr.oninput = () => ratio(10 * Math.log10(v(pr)), pr); ar.oninput = () => ratio(20 * Math.log10(v(ar)), ar);
      const pw = (w, skip) => { if (skip !== W) W.value = n(w); if (skip !== mW) mW.value = n(w * 1e3); if (skip !== dBm) dBm.value = n(10 * Math.log10(w * 1e3)); if (skip !== dBW) dBW.value = n(10 * Math.log10(w)); out.textContent = Number.isFinite(w) ? `${f(w, "W")} = ${dBm.value} dBm` : ""; };
      dBm.oninput = () => pw(Math.pow(10, v(dBm) / 10) / 1e3, dBm); mW.oninput = () => pw(v(mW) / 1e3, mW); W.oninput = () => pw(v(W), W); dBW.oninput = () => pw(Math.pow(10, v(dBW) / 10), dBW);
      ratio(v(dB), dB);
      if (d.from === "w") { W.value = "1"; pw(1, W); } else { dBm.value = d.dbm || "30"; pw(Math.pow(10, v(dBm) / 10) / 1e3, dBm); }
    },
  };
  (MODES[d.mode] || MODES.ohm)();
})();
