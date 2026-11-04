/* Wezzet favicon maker: builds favicon.ico (16, 32, 48 px) plus app icon PNGs from one image. */
(() => {
  const $ = (id) => document.getElementById(id);
  const drop = $("drop"), input = $("files"), out = $("out"), msg = $("msg"), preview = $("preview");
  const ICO_SIZES = [16, 32, 48];
  const PNG_SIZES = { "apple-touch-icon.png": 180, "icon-192.png": 192, "icon-512.png": 512 };

  async function decode(file) {
    const extra = window.wzDecodeExtra && await wzDecodeExtra(file).catch(() => null);
    if (extra) file = extra;
    try { return await createImageBitmap(file); } catch (e) {
      const url = URL.createObjectURL(file);
      try { return await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); }
      finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    }
  }

  // Square icon, image centered and fit inside
  async function png(src, s) {
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const ctx = c.getContext("2d");
    const w = src.width || src.naturalWidth || s, h = src.height || src.naturalHeight || s;
    const k = Math.min(s / w, s / h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, (s - w * k) / 2, (s - h * k) / 2, w * k, h * k);
    const b = await new Promise((r) => c.toBlob(r, "image/png"));
    return new Uint8Array(await b.arrayBuffer());
  }

  // ICO file whose entries are PNGs (supported by every current browser and Windows Vista+)
  function ico(pngs) {
    const head = 6 + 16 * pngs.length;
    const total = head + pngs.reduce((n, p) => n + p.data.length, 0);
    const buf = new Uint8Array(total), v = new DataView(buf.buffer);
    v.setUint16(2, 1, true); v.setUint16(4, pngs.length, true);
    let off = head;
    pngs.forEach((p, i) => {
      const e = 6 + 16 * i;
      v.setUint8(e, p.size % 256); v.setUint8(e + 1, p.size % 256);
      v.setUint16(e + 4, 1, true); v.setUint16(e + 6, 32, true);
      v.setUint32(e + 8, p.data.length, true); v.setUint32(e + 12, off, true);
      buf.set(p.data, off); off += p.data.length;
    });
    return buf;
  }

  function link(bytes, name, type, text) {
    const a = document.createElement("a");
    a.className = "btn" + (name.endsWith(".zip") ? "" : " btn-quiet");
    a.textContent = text;
    a.href = URL.createObjectURL(new Blob([bytes], { type })); a.download = name;
    return a;
  }

  async function handle(file) {
    msg.hidden = true; out.textContent = "";
    try {
      const src = await decode(file);
      const icoBytes = ico(await Promise.all(ICO_SIZES.map(async (s) => ({ size: s, data: await png(src, s) }))));
      const files = { "favicon.ico": [icoBytes, { level: 0 }] };
      for (const [n, s] of Object.entries(PNG_SIZES)) files[n] = [await png(src, s), { level: 0 }];
      files["favicon-32.png"] = [await png(src, 32), { level: 0 }];
      preview.src = URL.createObjectURL(new Blob([files["icon-192.png"][0]], { type: "image/png" }));
      preview.hidden = false;
      out.append(
        link(fflate.zipSync(files), "favicon-pack.zip", "application/zip", "Download all (.zip)"),
        link(icoBytes, "favicon.ico", "image/x-icon", "favicon.ico only")
      );
      $("snippet").hidden = false;
    } catch (e) {
      msg.textContent = "This file couldn't be read as an image."; msg.hidden = false;
    }
  }

  $("choose").addEventListener("click", () => input.click());
  input.addEventListener("change", () => { if (input.files[0]) handle(input.files[0]); input.value = ""; });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
})();
