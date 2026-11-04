/* Wezzet image compressor: shrinks images to a target file size in the browser.
   Searches JPEG/WebP quality first, then scales the image down if that isn't enough. */
(() => {
  const $ = (id) => document.getElementById(id);
  const drop = $("drop"), input = $("files"), list = $("list"), zipBtn = $("zip");
  const targetEl = $("target"), widthEl = $("max-width");
  const results = [];
  let heicLib = null;

  const fmt = () => document.querySelector('input[name="to"]:checked').value;
  const MIME = { jpg: "image/jpeg", webp: "image/webp" };
  const size = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);
  const isHeic = (f) => /\.(heic|heif)$/i.test(f.name) || /heic|heif/i.test(f.type);

  function loadHeic() {
    if (!heicLib) {
      heicLib = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "/vendor/heic2any-0.0.4.min.js";
        s.onload = () => resolve(window.heic2any);
        s.onerror = () => reject(new Error("load"));
        document.head.appendChild(s);
      });
    }
    return heicLib;
  }

  async function decode(file) {
    let blob = file;
    const extra = window.wzDecodeExtra && await wzDecodeExtra(file).catch(() => null);
    if (extra) blob = extra;
    if (isHeic(file)) {
      const out = await (await loadHeic())({ blob: file, toType: "image/png" });
      blob = Array.isArray(out) ? out[0] : out;
    }
    try {
      const bmp = await createImageBitmap(blob);
      return { source: bmp, w: bmp.width, h: bmp.height };
    } catch (e) {
      const url = URL.createObjectURL(blob);
      try {
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("decode")); i.src = url; });
        return { source: img, w: img.naturalWidth || 1024, h: img.naturalHeight || 1024 };
      } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    }
  }

  function encode(source, w, h, mime, q) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (mime === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, w, h);
    return new Promise((r, rej) => c.toBlob((b) => (b ? r(b) : rej(new Error("encode"))), mime, q));
  }

  async function compress(file) {
    const target = Math.max(5, parseFloat(targetEl.value) || 200) * 1024;
    const { source, w, h } = await decode(file);
    const maxW = parseInt(widthEl.value, 10);
    let scale = maxW > 0 && w > maxW ? maxW / w : 1;
    const mime = MIME[fmt()];
    let best = null;
    // Up to 8 rounds of downscaling; each round binary-searches quality between 0.35 and 0.92.
    for (let round = 0; round < 8 && !best; round++) {
      const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
      let lo = 0.35, hi = 0.92, fit = null;
      const top = await encode(source, cw, ch, mime, hi);
      if (top.size <= target) fit = { blob: top, q: hi };
      else {
        for (let i = 0; i < 7; i++) {
          const mid = (lo + hi) / 2;
          const b = await encode(source, cw, ch, mime, mid);
          if (b.size <= target) { fit = { blob: b, q: mid }; lo = mid; } else hi = mid;
        }
      }
      if (fit) best = { ...fit, cw, ch };
      else scale *= 0.8;
    }
    if (source.close) source.close();
    if (!best) throw new Error("small");
    return best;
  }

  async function handle(files) {
    for (const file of files) {
      const li = document.createElement("li");
      const name = document.createElement("span"); name.className = "fname"; name.textContent = file.name;
      const meta = document.createElement("span"); meta.className = "fmeta"; meta.textContent = "Compressing";
      const actions = document.createElement("span"); actions.className = "factions";
      li.append(name, meta, actions); list.append(li);
      try {
        const { blob, q, cw, ch } = await compress(file);
        const outName = file.name.replace(/\.[^.]+$/, "") + "-small." + fmt();
        results.push({ name: outName, blob });
        meta.textContent = `${size(file.size)} to ${size(blob.size)}, ${cw} × ${ch}, quality ${Math.round(q * 100)}`;
        const a = document.createElement("a");
        a.className = "btn btn-quiet"; a.textContent = "Download";
        a.href = URL.createObjectURL(blob); a.download = outName;
        actions.append(a);
      } catch (e) {
        li.classList.add("bad");
        meta.textContent = e.message === "load" ? "The HEIC reader didn't load. Check your connection and try again."
          : e.message === "small" ? "Couldn't get this image that small. Try a bigger target size."
          : "This file couldn't be read as an image.";
      }
      zipBtn.hidden = results.length < 2;
    }
  }

  zipBtn.addEventListener("click", async () => {
    zipBtn.disabled = true;
    const files = {}, used = new Set();
    for (const r of results) {
      let n = r.name, i = 2;
      while (used.has(n)) n = r.name.replace(/(\.[^.]+)$/, ` (${i++})$1`);
      used.add(n);
      files[n] = [new Uint8Array(await r.blob.arrayBuffer()), { level: 0 }];
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([fflate.zipSync(files)], { type: "application/zip" }));
    a.download = "compressed-images.zip"; a.click();
    zipBtn.disabled = false;
  });

  document.querySelectorAll("[data-kb]").forEach((b) => b.addEventListener("click", () => { targetEl.value = b.dataset.kb; }));
  $("choose").addEventListener("click", () => input.click());
  input.addEventListener("change", () => { handle([...input.files]); input.value = ""; });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); handle([...e.dataTransfer.files]); });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
})();
