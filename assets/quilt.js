/* Wezzet quilt backing, binding and batting calculator. All math in inches. */
(() => {
  const SEAM = 0.5; // fabric used by one backing seam (1/4 in on each side)
  const BATTING = [["Crib", 45, 60], ["Twin", 72, 90], ["Full", 81, 96], ["Queen", 90, 108], ["King", 120, 120]];
  const $ = (id) => document.getElementById(id);
  const ids = ["q-width", "q-length", "q-extra", "q-back-fabric", "q-back-custom", "q-strip", "q-bind-fabric"];
  const el = Object.fromEntries(ids.map((i) => [i, $(i)]));
  const n = (e) => parseFloat(String(e.value).replace(",", "."));

  function yardsText(inches) {
    const eighths = Math.ceil(inches / 36 * 8 - 1e-9);
    const whole = Math.floor(eighths / 8), rem = eighths % 8;
    const frac = { 0: "", 1: "1/8", 2: "1/4", 3: "3/8", 4: "1/2", 5: "5/8", 6: "3/4", 7: "7/8" }[rem];
    const yd = whole && frac ? `${whole} ${frac}` : whole ? `${whole}` : frac;
    const m = Math.ceil(inches * 0.0254 * 10) / 10;
    return `${yd} yd <span class="metric">(${m.toFixed(1)} m)</span>`;
  }

  function panelsFor(need, usable) {
    let k = 1;
    while (k * usable - (k - 1) * SEAM < need) k++;
    return k;
  }

  function backing(W, L, e, F) {
    const w = W + 2 * e, l = L + 2 * e;
    const v = panelsFor(w, F), h = panelsFor(l, F);
    const vertical = { panels: v, pieceLength: l, total: v * l, seams: "running top to bottom" };
    const horizontal = { panels: h, pieceLength: w, total: h * w, seams: "running side to side" };
    const best = horizontal.total < vertical.total ? horizontal : vertical;
    return { w, l, ...best, orient: best === vertical ? "v" : "h" };
  }

  function diagram(b, F) {
    const scale = 150 / Math.max(b.w, b.l);
    const W = b.w * scale, L = b.l * scale, pad = 6;
    let lines = "";
    for (let i = 1; i < b.panels; i++) {
      const pos = (i * (F - SEAM / 2) - (i - 1) * SEAM / 2) * scale;
      lines += b.orient === "v"
        ? `<line x1="${pad + pos}" y1="${pad}" x2="${pad + pos}" y2="${pad + L}" />`
        : `<line x1="${pad}" y1="${pad + pos}" x2="${pad + W}" y2="${pad + pos}" />`;
    }
    return `<svg viewBox="0 0 ${W + pad * 2} ${L + pad * 2}" width="${W + pad * 2}" height="${L + pad * 2}" aria-hidden="true">
      <rect x="${pad}" y="${pad}" width="${W}" height="${L}" fill="#fff" stroke="#1a1a1a" stroke-width="1.5"/>
      <g stroke="#1a1a1a" stroke-dasharray="4 3" stroke-width="1.2">${lines}</g></svg>`;
  }

  function calc() {
    const W = n(el["q-width"]), L = n(el["q-length"]), e = n(el["q-extra"]);
    const out = $("q-results"), msg = $("q-msg");
    if (![W, L].every((x) => isFinite(x) && x > 0) || !(e >= 0)) {
      out.hidden = true; msg.hidden = false;
      msg.textContent = "Enter the width and length of your finished quilt top in inches.";
      return;
    }
    msg.hidden = true; out.hidden = false;
    const backSel = el["q-back-fabric"].value;
    $("q-custom-wrap").hidden = backSel !== "custom";
    const F = backSel === "custom" ? n(el["q-back-custom"]) : parseFloat(backSel);
    if (!(F > 1)) { out.hidden = true; msg.hidden = false; msg.textContent = "Enter the usable width of your backing fabric."; return; }

    const b = backing(W, L, e, F);
    $("r-back").innerHTML = yardsText(b.total);
    $("r-back-how").textContent = b.panels === 1
      ? `One piece, ${Math.ceil(b.pieceLength)} in long. No seams needed for a ${b.w} × ${b.l} in backing.`
      : `${b.panels} pieces, each ${Math.ceil(b.pieceLength)} in long, sewn with ${b.panels - 1} seam${b.panels > 2 ? "s" : ""} ${b.seams}. Backing size: ${b.w} × ${b.l} in.`;
    $("r-back-diagram").innerHTML = diagram(b, F);

    const strip = n(el["q-strip"]), Fb = parseFloat(el["q-bind-fabric"].value);
    const perimeter = 2 * (W + L);
    const needed = perimeter + 12;
    const perStrip = Fb - strip; // allow for the diagonal joining seams
    const strips = Math.ceil(needed / perStrip);
    $("r-bind").innerHTML = yardsText(strips * strip);
    $("r-bind-how").textContent = `Cut ${strips} strips, ${strip} in wide, across the fabric. That gives about ${Math.floor(strips * perStrip)} in of binding for a ${perimeter} in edge, with extra for corners and joining the ends.`;

    const bw = W + 2 * e, bl = L + 2 * e;
    const fit = BATTING.find(([, a, c]) => (a >= bw && c >= bl) || (a >= bl && c >= bw));
    $("r-batt").textContent = `${bw} × ${bl} in`;
    $("r-batt-how").textContent = fit
      ? `A ${fit[0].toLowerCase()} size package (${fit[1]} × ${fit[2]} in) is the smallest common size that covers it. Sizes vary by brand, so check the label.`
      : "Larger than a king size package. Buy batting by the yard or join two pieces.";
  }

  ids.forEach((i) => el[i].addEventListener("input", calc));
  calc();
})();
