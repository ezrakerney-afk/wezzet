/* Wezzet PDF tool: merge PDFs and turn images into a PDF, all in the browser (pdf-lib). */
(() => {
  const $ = (id) => document.getElementById(id);
  const drop = $("drop"), input = $("files"), list = $("list"), makeBtn = $("make"), clearBtn = $("clear"), msg = $("msg");
  const items = []; // { file, kind: 'pdf' | 'image' }
  const size = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

  function kindOf(f) {
    if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) return "pdf";
    if (f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name)) return "image";
    return null;
  }

  function render() {
    list.textContent = "";
    items.forEach((it, i) => {
      const li = document.createElement("li");
      const name = document.createElement("span"); name.className = "fname"; name.textContent = it.file.name;
      const meta = document.createElement("span"); meta.className = "fmeta";
      meta.textContent = `${it.kind === "pdf" ? "PDF" : "Image"}, ${size(it.file.size)}`;
      const actions = document.createElement("span"); actions.className = "factions";
      const btn = (label, text, fn, disabled) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "icon-btn"; b.setAttribute("aria-label", label); b.textContent = text;
        b.disabled = !!disabled; b.addEventListener("click", fn); return b;
      };
      actions.append(
        btn(`Move ${it.file.name} up`, "↑", () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; render(); }, i === 0),
        btn(`Move ${it.file.name} down`, "↓", () => { [items[i + 1], items[i]] = [items[i], items[i + 1]]; render(); }, i === items.length - 1),
        btn(`Remove ${it.file.name}`, "×", () => { items.splice(i, 1); render(); })
      );
      li.append(name, meta, actions);
      list.append(li);
    });
    makeBtn.hidden = clearBtn.hidden = items.length === 0;
  }

  function add(files) {
    msg.hidden = true;
    const skipped = [];
    for (const f of files) {
      const kind = kindOf(f);
      if (kind) items.push({ file: f, kind }); else skipped.push(f.name);
    }
    if (skipped.length) { msg.textContent = `Skipped (not a PDF or image): ${skipped.join(", ")}`; msg.hidden = false; }
    render();
  }

  // Draws any image to a canvas and returns JPEG or PNG bytes pdf-lib can embed.
  async function imageBytes(file) {
    const isJpg = file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name);
    const isPng = file.type === "image/png" || /\.png$/i.test(file.name);
    const buf = new Uint8Array(await file.arrayBuffer());
    if (isJpg) return { bytes: buf, type: "jpg" };
    if (isPng) return { bytes: buf, type: "png" };
    const bmp = await createImageBitmap(file);
    const c = document.createElement("canvas");
    c.width = bmp.width; c.height = bmp.height;
    c.getContext("2d").drawImage(bmp, 0, 0);
    bmp.close();
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), type: "png" };
  }

  makeBtn.addEventListener("click", async () => {
    msg.hidden = true;
    makeBtn.disabled = true;
    const label = makeBtn.textContent;
    makeBtn.textContent = "Working";
    try {
      const { PDFDocument } = PDFLib;
      const out = await PDFDocument.create();
      for (const it of items) {
        try {
          if (it.kind === "pdf") {
            const src = await PDFDocument.load(await it.file.arrayBuffer(), { ignoreEncryption: true });
            const pages = await out.copyPages(src, src.getPageIndices());
            pages.forEach((p) => out.addPage(p));
          } else {
            const { bytes, type } = await imageBytes(it.file);
            const img = type === "jpg" ? await out.embedJpg(bytes) : await out.embedPng(bytes);
            // Page sized to the image at 72 dpi, capped to roughly A4/Letter scale
            const scale = Math.min(1, 842 / Math.max(img.width, img.height));
            const w = img.width * scale, h = img.height * scale;
            const page = out.addPage([w, h]);
            page.drawImage(img, { x: 0, y: 0, width: w, height: h });
          }
        } catch (e) {
          throw new Error(`Couldn't read ${it.file.name}. It may be damaged or password protected.`);
        }
      }
      const bytes = await out.save();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      a.download = items.length === 1 ? items[0].file.name.replace(/\.[^.]+$/, "") + ".pdf" : "combined.pdf";
      a.click();
    } catch (e) {
      msg.textContent = e.message; msg.hidden = false;
    } finally {
      makeBtn.disabled = false; makeBtn.textContent = label;
    }
  });

  clearBtn.addEventListener("click", () => { items.length = 0; msg.hidden = true; render(); });
  $("choose").addEventListener("click", () => input.click());
  input.addEventListener("change", () => { add([...input.files]); input.value = ""; });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); add([...e.dataTransfer.files]); });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
})();
