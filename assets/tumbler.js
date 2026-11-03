/* Wezzet tumbler template maker.
   A tapered cup unrolls into part of a ring (an annular sector). This builds
   that shape from three measurements and warps the visitor's design onto it,
   all in the browser. Output: 300 DPI PNG (with print size stored in the file)
   and an SVG outline in real inches. */
(() => {
  const DPI = 300;
  const $ = (id) => document.getElementById(id);
  const els = {
    form: $("tumbler-form"), top: $("top"), bottom: $("bottom"), height: $("height"),
    overlap: $("overlap"), bleed: $("bleed"), mirror: $("mirror"), outline: $("outline"),
    image: $("image"), imageName: $("image-name"), canvas: $("out"), result: $("result"),
    facts: $("facts"), msg: $("msg"), png: $("dl-png"), svg: $("dl-svg"), flat: $("flat-size"),
    build: $("build"),
  };
  let sourcePixels = null; // { data, w, h }
  let lastGeom = null;

  const unit = () => document.querySelector('input[name="unit"]:checked').value;
  const toIn = (v) => (unit() === "cm" ? v / 2.54 : v);
  const fromIn = (v) => (unit() === "cm" ? v * 2.54 : v);
  const fmt = (v) => `${fromIn(v).toFixed(2)} ${unit()}`;
  const num = (el) => parseFloat(String(el.value).replace(",", "."));

  function geometry() {
    let C = toIn(num(els.top)), c = toIn(num(els.bottom)), s = toIn(num(els.height));
    const o = toIn(num(els.overlap) || 0), b = toIn(num(els.bleed) || 0);
    if (![C, c, s].every((x) => isFinite(x) && x > 0)) return { error: "Enter the top and bottom measurements around the cup and the height along its side." };
    if (s > Math.max(C, c) * 2) return { error: "The height looks too large for these circumferences. Check that you measured around the cup, not across it." };
    const flipped = c > C;
    if (flipped) [C, c] = [c, C];
    const straight = (C - c) / C < 0.004;
    if (straight) {
      const w = C + o + 2 * b, h = s + 2 * b;
      return { straight, flipped, C, c, s, o, b, width: w, height: h };
    }
    const Rin = (s * c) / (C - c), Rout = Rin + s;
    const theta = (C + o) / Rout;
    if (theta >= 2 * Math.PI) return { error: "These measurements describe a very steep cone. Check that the top and bottom are circumferences, not diameters." };
    const r0 = Rin - b, r1 = Rout + b;
    // bounding box by sampling the outline (apex at origin, y pointing up)
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i <= 400; i++) {
      const phi = -theta / 2 + (theta * i) / 400;
      for (const r of [r0, r1]) {
        const x = r * Math.sin(phi), y = r * Math.cos(phi);
        xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y);
      }
    }
    return { straight, flipped, C, c, s, o, b, Rin, Rout, r0, r1, theta, xmin, xmax, ymin, ymax, width: xmax - xmin, height: ymax - ymin };
  }

  function sample(u, v, out, k) {
    if (!sourcePixels) { out[k + 3] = 0; return; }
    const { data, w, h } = sourcePixels;
    const x = Math.min(w - 1, Math.max(0, Math.floor(u * w)));
    const y = Math.min(h - 1, Math.max(0, Math.floor(v * h)));
    const i = (y * w + x) * 4;
    out[k] = data[i]; out[k + 1] = data[i + 1]; out[k + 2] = data[i + 2]; out[k + 3] = data[i + 3];
  }

  function render(g) {
    const W = Math.round(g.width * DPI), H = Math.round(g.height * DPI);
    const cv = els.canvas;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const img = ctx.createImageData(W, H);
    const px = img.data;
    const mirror = els.mirror.checked;
    if (g.straight) {
      const x0 = g.b, x1 = g.b + g.C + g.o, y0 = g.b, y1 = g.b + g.s;
      for (let j = 0; j < H; j++) {
        const y = (j + 0.5) / DPI;
        let v = (y - y0) / (y1 - y0);
        for (let i = 0; i < W; i++) {
          const x = (i + 0.5) / DPI;
          let u = (x - x0) / (x1 - x0);
          if (mirror) u = 1 - u;
          sample(Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v)), px, (j * W + i) * 4);
          if (!sourcePixels) { const k = (j * W + i) * 4; px[k] = px[k + 1] = px[k + 2] = 255; px[k + 3] = 255; }
        }
      }
    } else {
      const span = g.r1 - g.r0;
      for (let j = 0; j < H; j++) {
        const y = g.ymax - (j + 0.5) / DPI;
        for (let i = 0; i < W; i++) {
          const x = g.xmin + (i + 0.5) / DPI;
          const r = Math.hypot(x, y);
          const k = (j * W + i) * 4;
          if (r < g.r0 || r > g.r1) continue;
          const phi = Math.atan2(x, y);
          if (phi < -g.theta / 2 || phi > g.theta / 2) continue;
          let u = (phi + g.theta / 2) / g.theta;
          let v = (g.r1 - r) / span;
          if (mirror) u = 1 - u;
          if (g.flipped) { u = 1 - u; v = 1 - v; }
          if (sourcePixels) sample(u, v, px, k);
          else { px[k] = px[k + 1] = px[k + 2] = 255; px[k + 3] = 255; }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    if (g.flipped && !g.straight) {
      // rotate the finished template 180 degrees so the narrow end is on top
      const tmp = document.createElement("canvas");
      tmp.width = W; tmp.height = H;
      tmp.getContext("2d").drawImage(cv, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.save(); ctx.translate(W, H); ctx.rotate(Math.PI); ctx.drawImage(tmp, 0, 0); ctx.restore();
    }
    if (els.outline.checked) {
      ctx.save();
      ctx.strokeStyle = "#9a9a9a";
      ctx.lineWidth = Math.max(2, DPI / 150);
      ctx.setLineDash([DPI / 10, DPI / 20]);
      ctx.beginPath();
      outlinePath(g, (x, y, first) => (first ? ctx.moveTo(x * DPI, y * DPI) : ctx.lineTo(x * DPI, y * DPI)));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  // Calls emit(x, y, first) in template inches, origin top-left.
  function outlinePath(g, emit) {
    if (g.straight) {
      const pts = [[0, 0], [g.width, 0], [g.width, g.height], [0, g.height]];
      pts.forEach(([x, y], i) => emit(x, y, i === 0));
      return;
    }
    const pts = [];
    const n = 200;
    for (let i = 0; i <= n; i++) { const p = -g.theta / 2 + (g.theta * i) / n; pts.push([g.r1 * Math.sin(p), g.r1 * Math.cos(p)]); }
    for (let i = n; i >= 0; i--) { const p = -g.theta / 2 + (g.theta * i) / n; pts.push([g.r0 * Math.sin(p), g.r0 * Math.cos(p)]); }
    pts.forEach(([x, y], i) => {
      let tx = x - g.xmin, ty = g.ymax - y;
      if (g.flipped) { tx = g.width - tx; ty = g.height - ty; }
      emit(tx, ty, i === 0);
    });
  }

  function svgOutline(g) {
    const d = [];
    outlinePath(g, (x, y, first) => d.push(`${first ? "M" : "L"}${x.toFixed(4)} ${y.toFixed(4)}`));
    const w = g.width.toFixed(4), h = g.height.toFixed(4);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}in" height="${h}in" viewBox="0 0 ${w} ${h}">\n  <path d="${d.join(" ")} Z" fill="none" stroke="#000" stroke-width="0.01"/>\n</svg>\n`;
  }

  // Store 300 DPI in the PNG so it prints at the right size.
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function withDpi(buf, dpi) {
    const src = new Uint8Array(buf);
    const ppm = Math.round(dpi / 0.0254);
    const chunk = new Uint8Array(21);
    const dv = new DataView(chunk.buffer);
    dv.setUint32(0, 9);
    chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
    dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
    dv.setUint32(17, crc32(chunk.subarray(4, 17)));
    const insertAt = 8 + 25; // signature + IHDR chunk
    const out = new Uint8Array(src.length + chunk.length);
    out.set(src.subarray(0, insertAt), 0);
    out.set(chunk, insertAt);
    out.set(src.subarray(insertAt), insertAt + chunk.length);
    return out;
  }

  function setDownload(a, blob, name) {
    if (a.dataset.url) URL.revokeObjectURL(a.dataset.url);
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = name; a.dataset.url = url;
  }

  function updateFlatHint() {
    const C = toIn(num(els.top)), s = toIn(num(els.height));
    els.flat.textContent = isFinite(C) && isFinite(s) && C > 0 && s > 0
      ? `Make your design ${fmt(C)} wide by ${fmt(s)} tall (at 300 DPI: ${Math.round(C * DPI)} × ${Math.round(s * DPI)} pixels).`
      : "Enter your measurements to see the size to design at.";
  }

  async function build(e) {
    if (e) e.preventDefault();
    els.msg.hidden = true;
    const g = geometry();
    if (g.error) { els.msg.textContent = g.error; els.msg.hidden = false; els.result.hidden = true; return; }
    els.build.disabled = true;
    els.build.textContent = "Building";
    await new Promise((r) => setTimeout(r, 30));
    render(g);
    lastGeom = g;
    const rows = [
      ["Template size", `${fmt(g.width)} × ${fmt(g.height)}`],
      ["Cup shape", g.straight ? "Straight" : g.flipped ? "Tapered, wider at the bottom" : "Tapered, wider at the top"],
    ];
    if (!g.straight) rows.push(["Arc radius", `${fmt(g.Rin)} inside, ${fmt(g.Rout)} outside`], ["Arc angle", `${(g.theta * 180 / Math.PI).toFixed(2)}°`]);
    els.facts.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    const base = `tumbler-${fromIn(g.C).toFixed(1)}x${fromIn(g.s).toFixed(1)}${unit()}`.replace(/\./g, "_");
    els.canvas.toBlob(async (blob) => {
      const png = withDpi(await blob.arrayBuffer(), DPI);
      setDownload(els.png, new Blob([png], { type: "image/png" }), `${base}.png`);
    }, "image/png");
    setDownload(els.svg, new Blob([svgOutline(g)], { type: "image/svg+xml" }), `${base}-outline.svg`);
    els.result.hidden = false;
    els.build.disabled = false;
    els.build.textContent = "Make template";
  }

  els.image.addEventListener("change", () => {
    const f = els.image.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const max = 4000, scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const cx = c.getContext("2d"); cx.drawImage(img, 0, 0, w, h);
      sourcePixels = { data: cx.getImageData(0, 0, w, h).data, w, h };
      els.imageName.textContent = `${f.name} (${img.naturalWidth} × ${img.naturalHeight} px)`;
      URL.revokeObjectURL(img.src);
      if (lastGeom) build();
    };
    img.onerror = () => { els.msg.textContent = "This image couldn't be opened. Use a PNG or JPG file."; els.msg.hidden = false; };
    img.src = URL.createObjectURL(f);
  });

  document.querySelectorAll('input[name="unit"]').forEach((r) => r.addEventListener("change", () => {
    const factor = unit() === "cm" ? 2.54 : 1 / 2.54;
    for (const el of [els.top, els.bottom, els.height, els.overlap, els.bleed]) {
      const v = num(el); if (isFinite(v)) el.value = +(v * factor).toFixed(2);
    }
    document.querySelectorAll(".unit-label").forEach((s) => (s.textContent = unit()));
    updateFlatHint();
    if (lastGeom) build();
  }));
  for (const el of [els.top, els.height]) el.addEventListener("input", updateFlatHint);
  els.form.addEventListener("submit", build);
  updateFlatHint();
  build();
})();
