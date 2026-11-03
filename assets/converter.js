(() => {
  const $ = (id) => document.getElementById(id);
  const hoop = $("hoop"), canvas = $("preview"), empty = $("hoop-empty"), status = $("hoop-status");
  const fileInput = $("file"), chooseBtn = $("choose"), result = $("result"), errorBox = $("error");
  const formatSel = $("format"), downloadBtn = $("download"), againBtn = $("again");
  const colorNote = $("color-note"), rNote = $("r-note");

  const NO_COLOR_FORMATS = new Set(["dst", "exp", "u01"]);
  let worker = null, engineReady = false, engineFailed = false;
  let nextId = 1;
  const pending = new Map();
  let current = null; // { name, base, path, info }

  function warm() {
    if (worker) return;
    worker = new Worker("/assets/converter-worker.js");
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "ready") { engineReady = true; return; }
      if (m.type === "failed") {
        engineFailed = true;
        for (const [, p] of pending) p.reject(new Error("engine"));
        pending.clear();
        return;
      }
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      m.ok ? p.resolve(m) : p.reject(new Error(m.error || "failed"));
    };
  }

  function call(msg, transfer) {
    warm();
    if (engineFailed) return Promise.reject(new Error("engine"));
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ ...msg, id }, transfer || []);
    });
  }

  function showStatus(text) {
    status.innerHTML = "";
    const span = document.createElement("span");
    span.textContent = text;
    const bar = document.createElement("span");
    bar.className = "stitching";
    span.appendChild(bar);
    status.appendChild(span);
    status.hidden = false;
  }
  function hideStatus() { status.hidden = true; status.textContent = ""; }

  function showError(text) {
    errorBox.textContent = text;
    errorBox.hidden = false;
  }

  function resetToEmpty() {
    current = null;
    result.hidden = true;
    canvas.hidden = true;
    empty.hidden = false;
    hideStatus();
  }

  async function handleFile(file) {
    if (!file) return;
    errorBox.hidden = true;
    result.hidden = true;
    empty.hidden = true;
    canvas.hidden = true;
    showStatus(engineReady ? "Reading your design" : "Getting the converter ready. This takes a few seconds the first time.");
    try {
      const bytes = await file.arrayBuffer();
      const m = await call({ type: "inspect", name: file.name, bytes }, [bytes]);
      const base = file.name.replace(/\.[^.]+$/, "") || "design";
      const srcExt = (file.name.split(".").pop() || "").toLowerCase();
      current = { name: file.name, base, srcExt, path: m.path, info: m.result };
      hideStatus();
      renderResult();
    } catch (err) {
      resetToEmpty();
      if (String(err.message) === "engine") {
        showError("The converter didn't load. Check your internet connection and reload the page.");
      } else {
        showError("This file couldn't be read as an embroidery design. Check that it's a stitch file such as .pes, .dst or .jef. Picture files like .jpg or .png need to be digitized first.");
      }
    }
  }

  function fmtNumber(n) { return n.toLocaleString("en-US"); }

  function renderResult() {
    const i = current.info;
    $("r-name").textContent = current.name;
    const win = (i.width_mm / 25.4).toFixed(1), hin = (i.height_mm / 25.4).toFixed(1);
    $("r-size").textContent = `${i.width_mm} × ${i.height_mm} mm (${win} × ${hin} in)`;
    $("r-stitches").textContent = fmtNumber(i.stitches);
    $("r-colors").textContent = String(i.colors);
    $("r-hoop").textContent = i.hoop || "Larger than 14 × 8 in";

    const sw = $("r-swatches");
    sw.innerHTML = "";
    i.blocks.forEach((b, idx) => {
      const li = document.createElement("li");
      li.style.background = b.color;
      li.title = b.name ? `${idx + 1}. ${b.name}` : `Color ${idx + 1}`;
      sw.appendChild(li);
    });
    sw.hidden = !i.has_colors;

    const notes = [];
    if (!i.has_colors) notes.push("This file doesn't store thread colors, so the preview uses sample colors.");
    if (!i.hoop) notes.push("This design is bigger than common home hoops. Check your machine's largest stitch area before converting.");
    rNote.textContent = notes.join(" ");
    rNote.hidden = notes.length === 0;

    let preferred = null;
    if (!formatSel.dataset.fixed) try { preferred = localStorage.getItem("wezzet.format"); } catch (e) {}
    if (preferred && [...formatSel.options].some(o => o.value === preferred)) formatSel.value = preferred;
    updateFormatUi();

    empty.hidden = true;
    canvas.hidden = false;
    result.hidden = false;
    draw();
    $("r-name").setAttribute("tabindex", "-1");
    $("r-name").focus({ preventScroll: true });
  }

  function updateFormatUi() {
    const ext = formatSel.value;
    downloadBtn.textContent = `Download ${ext.toUpperCase()} file`;
    colorNote.hidden = !(current && current.info.has_colors && NO_COLOR_FORMATS.has(ext));
  }

  function draw() {
    if (!current || canvas.hidden) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const [ex, ey] = current.info.extent;
    const box = Math.min(canvas.width, canvas.height) * 0.64;
    const scale = box / Math.max(ex, ey, 1);
    const ox = (canvas.width - ex * scale) / 2;
    const oy = (canvas.height - ey * scale) / 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1, 1.1 * dpr);
    for (const b of current.info.blocks) {
      ctx.strokeStyle = b.color;
      ctx.beginPath();
      for (const line of b.lines) {
        ctx.moveTo(ox + line[0] * scale, oy + line[1] * scale);
        for (let k = 2; k < line.length; k += 2) ctx.lineTo(ox + line[k] * scale, oy + line[k + 1] * scale);
      }
      ctx.stroke();
    }
  }

  async function download() {
    if (!current) return;
    const ext = formatSel.value;
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Converting";
    try {
      const m = await call({ type: "convert", path: current.path, ext });
      const blob = new Blob([m.bytes], { type: "application/octet-stream" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${current.base}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      try { localStorage.setItem("wezzet.format", ext); } catch (e) {}
    } catch (err) {
      showError(`This design couldn't be saved as ${ext.toUpperCase()}. Try another format, such as DST, which most machines can read.`);
    } finally {
      downloadBtn.disabled = false;
      updateFormatUi();
    }
  }

  // Wire up
  chooseBtn.addEventListener("click", () => { warm(); fileInput.click(); });
  fileInput.addEventListener("change", () => { handleFile(fileInput.files[0]); fileInput.value = ""; });
  hoop.addEventListener("pointerenter", warm, { once: true });
  formatSel.addEventListener("change", updateFormatUi);
  downloadBtn.addEventListener("click", download);
  againBtn.addEventListener("click", () => { resetToEmpty(); errorBox.hidden = true; chooseBtn.focus(); });

  let dragDepth = 0;
  window.addEventListener("dragenter", (e) => { e.preventDefault(); warm(); dragDepth++; hoop.classList.add("dragging"); });
  window.addEventListener("dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) hoop.classList.remove("dragging"); });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    hoop.classList.remove("dragging");
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(draw, 120); });
})();
