/* Wezzet image converter: everything happens in the browser.
   HEIC/HEIF are decoded with heic2any (loaded only when needed); other
   formats use the browser's own decoders. */
(() => {
  const $ = (id) => document.getElementById(id);
  const drop = $("drop"), input = $("files"), list = $("list"), zipBtn = $("zip");
  const qualityEl = $("quality"), qualityOut = $("quality-out"), widthEl = $("max-width");
  const results = []; // { name, blob }
  let heicLib = null;

  const fmt = () => document.querySelector('input[name="to"]:checked').value;
  const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
  const size = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);
  const isHeic = (f) => /\.(heic|heif)$/i.test(f.name) || /heic|heif/i.test(f.type);
  const isSvg = (f) => /\.svg$/i.test(f.name) || f.type === "image/svg+xml";

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

  function imageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode"));
      img.src = url;
    });
  }

  async function decode(file) {
    let blob = file;
    const extra = window.wzDecodeExtra && await wzDecodeExtra(file).catch(() => null);
    if (extra) blob = extra;
    if (isHeic(file)) {
      const heic2any = await loadHeic();
      const out = await heic2any({ blob: file, toType: "image/png" });
      blob = Array.isArray(out) ? out[0] : out;
    }
    if (isSvg(file)) {
      const url = URL.createObjectURL(blob);
      try {
        const img = await imageFromUrl(url);
        const w = img.naturalWidth || 1024, h = img.naturalHeight || 1024;
        return { source: img, w, h };
      } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    }
    if (window.createImageBitmap) {
      try {
        const bmp = await createImageBitmap(blob);
        return { source: bmp, w: bmp.width, h: bmp.height };
      } catch (e) { /* fall back to <img> */ }
    }
    const url = URL.createObjectURL(blob);
    try {
      const img = await imageFromUrl(url);
      return { source: img, w: img.naturalWidth, h: img.naturalHeight };
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }

  async function convert(file) {
    const { source, w, h } = await decode(file);
    const maxW = parseInt(widthEl.value, 10);
    const scale = maxW > 0 && w > maxW ? maxW / w : 1;
    const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d");
    const to = fmt();
    if (to === "jpg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cw, ch); }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, cw, ch);
    if (source.close) source.close();
    const q = to === "png" ? undefined : parseInt(qualityEl.value, 10) / 100;
    const blob = await new Promise((r) => canvas.toBlob(r, MIME[to], q));
    if (!blob) throw new Error("encode");
    return { blob, cw, ch };
  }

  function rowFor(file) {
    const li = document.createElement("li");
    const name = document.createElement("span"); name.className = "fname"; name.textContent = file.name;
    const meta = document.createElement("span"); meta.className = "fmeta"; meta.textContent = "Converting";
    const actions = document.createElement("span"); actions.className = "factions";
    li.append(name, meta, actions);
    list.append(li);
    return { li, meta, actions };
  }

  async function handle(files) {
    for (const file of files) {
      const row = rowFor(file);
      try {
        const { blob, cw, ch } = await convert(file);
        const outName = file.name.replace(/\.[^.]+$/, "") + "." + fmt();
        results.push({ name: outName, blob });
        row.meta.textContent = `${size(file.size)} to ${size(blob.size)}, ${cw} × ${ch}`;
        const a = document.createElement("a");
        a.className = "btn btn-quiet"; a.textContent = "Download";
        a.href = URL.createObjectURL(blob); a.download = outName;
        row.actions.append(a);
      } catch (e) {
        row.li.classList.add("bad");
        row.meta.textContent = e.message === "load"
          ? "The HEIC reader didn't load. Check your connection and try again."
          : "This file couldn't be read as an image.";
      }
      zipBtn.hidden = results.length < 2;
    }
  }

  zipBtn.addEventListener("click", async () => {
    zipBtn.disabled = true;
    const files = {};
    const used = new Set();
    for (const r of results) {
      let n = r.name, i = 2;
      while (used.has(n)) n = r.name.replace(/(\.[^.]+)$/, ` (${i++})$1`);
      used.add(n);
      files[n] = [new Uint8Array(await r.blob.arrayBuffer()), { level: 0 }];
    }
    const zipped = fflate.zipSync(files);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([zipped], { type: "application/zip" }));
    a.download = "converted-images.zip";
    a.click();
    zipBtn.disabled = false;
  });

  function syncQuality() {
    const lossy = fmt() !== "png";
    $("quality-field").hidden = !lossy;
    qualityOut.textContent = qualityEl.value;
  }
  qualityEl.addEventListener("input", syncQuality);
  document.querySelectorAll('input[name="to"]').forEach((r) => r.addEventListener("change", syncQuality));
  syncQuality();

  $("choose").addEventListener("click", () => input.click());
  input.addEventListener("change", () => { handle([...input.files]); input.value = ""; });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); handle([...e.dataTransfer.files]); });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
})();
