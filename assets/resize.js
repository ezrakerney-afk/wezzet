/* Wezzet image resizer: resize by pixels or percent, all in the browser. */
(() => {
  const $ = (id) => document.getElementById(id);
  const drop = $("drop"), input = $("files"), list = $("list"), zipBtn = $("zip");
  const wEl = $("w"), hEl = $("h"), pctEl = $("pct"), keepEl = $("keep");
  const results = [];
  let heicLib = null;

  const mode = () => document.querySelector('input[name="by"]:checked').value;
  const fmtPick = () => document.querySelector('input[name="to"]:checked').value;
  const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
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

  function target(w, h) {
    if (mode() === "pct") {
      const p = Math.max(1, parseFloat(pctEl.value) || 50) / 100;
      return [Math.max(1, Math.round(w * p)), Math.max(1, Math.round(h * p))];
    }
    const tw = parseInt(wEl.value, 10), th = parseInt(hEl.value, 10);
    if (keepEl.checked) {
      if (tw > 0 && th > 0) { const s = Math.min(tw / w, th / h); return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))]; }
      if (tw > 0) return [tw, Math.max(1, Math.round(h * tw / w))];
      if (th > 0) return [Math.max(1, Math.round(w * th / h)), th];
      return [w, h];
    }
    return [tw > 0 ? tw : w, th > 0 ? th : h];
  }

  function outFormat(file) {
    const f = fmtPick();
    if (f !== "same") return f;
    if (/png/i.test(file.type) || /\.png$/i.test(file.name)) return "png";
    if (/webp/i.test(file.type) || /\.webp$/i.test(file.name)) return "webp";
    return "jpg";
  }

  async function resize(file) {
    const { source, w, h } = await decode(file);
    const [tw, th] = target(w, h);
    const ext = outFormat(file), mime = MIME[ext];
    const c = document.createElement("canvas");
    c.width = tw; c.height = th;
    const ctx = c.getContext("2d");
    if (mime === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, tw, th); }
    ctx.imageSmoothingQuality = "high";
    // Halve in steps when shrinking a lot, so the result stays sharp instead of jagged.
    let src = source, sw = w, sh = h;
    while (sw / 2 > tw && sh / 2 > th) {
      const step = document.createElement("canvas");
      step.width = Math.round(sw / 2); step.height = Math.round(sh / 2);
      const sc = step.getContext("2d"); sc.imageSmoothingQuality = "high";
      sc.drawImage(src, 0, 0, step.width, step.height);
      src = step; sw = step.width; sh = step.height;
    }
    ctx.drawImage(src, 0, 0, tw, th);
    if (source.close) source.close();
    const blob = await new Promise((r, rej) => c.toBlob((b) => (b ? r(b) : rej(new Error("encode"))), mime, 0.9));
    return { blob, ext, w, h, tw, th };
  }

  async function handle(files) {
    for (const file of files) {
      const li = document.createElement("li");
      const name = document.createElement("span"); name.className = "fname"; name.textContent = file.name;
      const meta = document.createElement("span"); meta.className = "fmeta"; meta.textContent = "Resizing";
      const actions = document.createElement("span"); actions.className = "factions";
      li.append(name, meta, actions); list.append(li);
      try {
        const { blob, ext, w, h, tw, th } = await resize(file);
        const outName = file.name.replace(/\.[^.]+$/, "") + `-${tw}x${th}.` + ext;
        results.push({ name: outName, blob });
        meta.textContent = `${w} × ${h} to ${tw} × ${th}, ${size(blob.size)}`;
        const a = document.createElement("a");
        a.className = "btn btn-quiet"; a.textContent = "Download";
        a.href = URL.createObjectURL(blob); a.download = outName;
        actions.append(a);
      } catch (e) {
        li.classList.add("bad");
        meta.textContent = e.message === "load" ? "The HEIC reader didn't load. Check your connection and try again." : "This file couldn't be read as an image.";
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
    a.download = "resized-images.zip"; a.click();
    zipBtn.disabled = false;
  });

  const sync = () => { const px = mode() === "px"; $("px-fields").hidden = !px; $("pct-field").hidden = px; };
  document.querySelectorAll('input[name="by"]').forEach((r) => r.addEventListener("change", sync));
  document.querySelectorAll("[data-pct]").forEach((b) => b.addEventListener("click", () => { pctEl.value = b.dataset.pct; }));
  sync();
  $("choose").addEventListener("click", () => input.click());
  input.addEventListener("change", () => { handle([...input.files]); input.value = ""; });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); handle([...e.dataTransfer.files]); });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
})();
