/* Wezzet extra image decoders for formats browsers can't open: TIFF, camera RAW (CR2, NEF, ARW, DNG, ...),
   Photoshop PSD, Netpbm (PPM/PGM/PBM), TGA, and any file with an embedded JPEG preview.
   wzDecodeExtra(file) resolves to a PNG Blob, or null when the browser can already read the file. */
(() => {
  let utif = null;
  const load = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("load")); document.head.append(s); });
  async function loadUtif() {
    if (!utif) utif = (async () => {
      if (!self.fflate) await load("/vendor/fflate-0.8.3.min.js");
      // UTIF only needs pako.inflate for Deflate-compressed TIFFs; fflate does the same job.
      self.pako = self.pako || { inflate: (d) => self.fflate.unzlibSync(d instanceof Uint8Array ? d : new Uint8Array(d)) };
      await load("/vendor/utif-3.1.0.js");
      return self.UTIF;
    })();
    return utif;
  }

  const toPng = (rgba, w, h) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, w * h * 4), w, h), 0, 0);
    return new Promise((res) => c.toBlob(res, "image/png"));
  };

  function native(u) {
    const s = (o, t) => [...t].every((c, i) => u[o + i] === c.charCodeAt(0));
    return (u[0] === 0xff && u[1] === 0xd8) || s(0, "\x89PNG") || s(0, "GIF8") || (s(0, "RIFF") && s(8, "WEBP")) || s(0, "BM") || s(4, "ftypavif") || s(4, "ftypavis") || (u[0] === 0 && u[1] === 0 && u[2] === 1 && u[3] === 0);
  }

  // Largest JPEG hidden inside the file (RAW previews, PSD thumbnails, EXIF, office docs ...)
  async function embeddedJpeg(u) {
    const starts = [];
    for (let i = 0; i < u.length - 3 && starts.length < 24; i++) if (u[i] === 0xff && u[i + 1] === 0xd8 && u[i + 2] === 0xff && ((u[i + 3] & 0xf0) === 0xe0 || u[i + 3] === 0xdb)) starts.push(i);
    // Decoders stop at the JPEG end marker, so each candidate can simply run to the end of the file.
    let best = null, area = 0;
    for (const s of starts) {
      const b = new Blob([u.subarray(s)], { type: "image/jpeg" });
      try { const bmp = await createImageBitmap(b); if (bmp.width * bmp.height > area) { area = bmp.width * bmp.height; best = b; } bmp.close(); } catch (e) {}
    }
    return best;
  }

  async function tiff(buf) {
    const UTIF = await loadUtif();
    const ifds = UTIF.decode(buf);
    let best = null;
    for (const ifd of ifds) {
      try { UTIF.decodeImage(buf, ifd); } catch (e) { continue; }
      if (ifd.width && ifd.data && (!best || ifd.width * ifd.height > best.width * best.height)) best = ifd;
    }
    if (!best) return null;
    return toPng(UTIF.toRGBA8(best), best.width, best.height);
  }

  function psd(u) {
    const v = new DataView(u.buffer, u.byteOffset, u.byteLength);
    const ch = v.getUint16(12), h = v.getUint32(14), w = v.getUint32(18), depth = v.getUint16(22), mode = v.getUint16(24);
    if (depth !== 8 || !(mode === 1 || mode === 3)) return null;
    let p = 26; p += 4 + v.getUint32(p); p += 4 + v.getUint32(p); p += 4 + v.getUint32(p);
    const comp = v.getUint16(p); p += 2;
    const n = w * h, planes = [];
    if (comp === 0) for (let c = 0; c < ch; c++) { planes.push(u.subarray(p, p + n)); p += n; }
    else if (comp === 1) {
      const counts = []; for (let i = 0; i < ch * h; i++) { counts.push(v.getUint16(p)); p += 2; }
      for (let c = 0; c < ch; c++) {
        const out = new Uint8Array(n); let o = 0;
        for (let r = 0; r < h; r++) {
          const end = p + counts[c * h + r];
          while (p < end) { const k = (u[p] << 24) >> 24; p++; if (k >= 0) { out.set(u.subarray(p, p + k + 1), o); o += k + 1; p += k + 1; } else if (k !== -128) { out.fill(u[p], o, o + 1 - k); o += 1 - k; p++; } }
        }
        planes.push(out);
      }
    } else return null;
    const rgba = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) {
      const g = planes[0][i];
      rgba[i * 4] = g; rgba[i * 4 + 1] = mode === 3 ? planes[1][i] : g; rgba[i * 4 + 2] = mode === 3 ? planes[2][i] : g;
      rgba[i * 4 + 3] = (mode === 3 ? planes[3] : planes[1])?.[i] ?? 255;
    }
    return toPng(rgba, w, h);
  }

  function netpbm(u) {
    let p = 0; const tok = () => { for (;;) { while (/\s/.test(String.fromCharCode(u[p]))) p++; if (u[p] === 35) { while (u[p] !== 10 && p < u.length) p++; } else break; } let s = ""; while (p < u.length && !/\s/.test(String.fromCharCode(u[p]))) s += String.fromCharCode(u[p++]); return s; };
    const kind = tok(), w = +tok(), h = +tok(), max = /P1|P4/.test(kind) ? 1 : +tok(); p++;
    const rgba = new Uint8Array(w * h * 4), ascii = /P[123]/.test(kind), chans = /P[36]/.test(kind) ? 3 : 1, wide = max > 255;
    const next = ascii ? () => +tok() : wide ? () => { const x = (u[p] << 8) | u[p + 1]; p += 2; return x; } : () => u[p++];
    for (let i = 0; i < w * h; i++) {
      let r, g, b;
      if (kind === "P4") { const row = Math.floor(i / w), col = i % w, byte = u[p + row * Math.ceil(w / 8) + (col >> 3)]; r = g = b = (byte >> (7 - (col & 7))) & 1 ? 0 : 255; }
      else if (kind === "P1") r = g = b = next() ? 0 : 255;
      else if (chans === 3) { r = next() * 255 / max; g = next() * 255 / max; b = next() * 255 / max; }
      else r = g = b = next() * 255 / max;
      rgba.set([r, g, b, 255], i * 4);
    }
    return toPng(rgba, w, h);
  }

  function tga(u) {
    const idLen = u[0], cmap = u[1], type = u[2], w = u[12] | (u[13] << 8), h = u[14] | (u[15] << 8), bpp = u[16], desc = u[17];
    if (cmap || ![2, 3, 10, 11].includes(type) || ![8, 24, 32].includes(bpp) || !w || !h) return null;
    let p = 18 + idLen; const px = bpp / 8, n = w * h, raw = new Uint8Array(n * px);
    if (type < 9) raw.set(u.subarray(p, p + raw.length));
    else for (let o = 0; o < raw.length;) { const c = u[p++], k = (c & 127) + 1; if (c & 128) { for (let j = 0; j < k; j++) raw.set(u.subarray(p, p + px), o + j * px); p += px; } else { raw.set(u.subarray(p, p + k * px), o); p += k * px; } o += k * px; }
    const rgba = new Uint8Array(n * 4), top = desc & 32;
    for (let i = 0; i < n; i++) {
      const y = Math.floor(i / w), x = i % w, d = ((top ? y : h - 1 - y) * w + x) * 4, s = i * px;
      if (px === 1) rgba.set([raw[s], raw[s], raw[s], 255], d); else rgba.set([raw[s + 2], raw[s + 1], raw[s], px === 4 ? raw[s + 3] : 255], d);
    }
    return toPng(rgba, w, h);
  }

  window.wzDecodeExtra = async (file) => {
    const buf = await file.arrayBuffer(), u = new Uint8Array(buf);
    if (u.length < 4 || native(u)) return null;
    const name = (file.name || "").toLowerCase(), head = String.fromCharCode(...u.subarray(0, 4));
    if (/svg|heic|heif/.test(name.split(".").pop()) || /svg/.test(file.type)) return null;
    let out = null;
    try {
      if (head === "II*\0" || head === "MM\0*") out = await tiff(buf);
      else if (head === "8BPS") out = psd(u);
      else if (/^P[1-6]\s/.test(String.fromCharCode(...u.subarray(0, 3)))) out = netpbm(u);
      else if (/\.tga$/.test(name)) out = tga(u);
    } catch (e) { out = null; }
    // Camera RAW files are TIFF-like but their main image is a sensor dump; their JPEG preview is the reliable picture.
    if (out && /\.(cr2|cr3|nef|nrw|arw|sr2|srf|orf|rw2|raf|pef|dng|3fr|erf|kdc|mrw|srw|x3f|iiq|rwl)$/.test(name)) {
      const j = await embeddedJpeg(u); if (j) { const a = await createImageBitmap(out), b = await createImageBitmap(j); if (b.width * b.height >= a.width * a.height) out = j; a.close(); b.close(); }
    }
    return out || embeddedJpeg(u);
  };
})();
