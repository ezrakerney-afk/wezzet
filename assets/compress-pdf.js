/* Wezzet PDF compressor: renders each page with pdf.js and rebuilds the PDF
   from JPEG pages with pdf-lib, all in the browser. */
import * as pdfjs from "/vendor/pdfjs-4.10.38/pdf.min.mjs";
pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs-4.10.38/pdf.worker.min.mjs";

const LEVELS = { strong: [90, 0.55], medium: [120, 0.68], light: [150, 0.8] };
const $ = (id) => document.getElementById(id);
const drop = $("drop"), input = $("files"), list = $("list"), msg = $("msg");
const level = () => LEVELS[document.querySelector('input[name="lvl"]:checked').value];
const size = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

async function compress(file, status) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const [dpi, q] = level();
  const out = await PDFLib.PDFDocument.create();
  for (let n = 1; n <= doc.numPages; n++) {
    status(`Page ${n} of ${doc.numPages}`);
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: dpi / 72 });
    const c = document.createElement("canvas");
    c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const jpg = await new Promise((r) => c.toBlob(r, "image/jpeg", q));
    const img = await out.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
    const p = out.addPage([base.width, base.height]);
    p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
    page.cleanup();
    c.width = c.height = 0;
  }
  doc.destroy();
  return new Blob([await out.save({ useObjectStreams: true })], { type: "application/pdf" });
}

async function handle(file) {
  msg.hidden = true;
  if (!(file.type === "application/pdf" || /\.pdf$/i.test(file.name))) { msg.textContent = `${file.name} isn't a PDF.`; msg.hidden = false; return; }
  const li = document.createElement("li");
  const name = document.createElement("span"); name.className = "fname"; name.textContent = file.name;
  const meta = document.createElement("span"); meta.className = "fmeta"; meta.textContent = "Opening";
  const actions = document.createElement("span"); actions.className = "factions";
  li.append(name, meta, actions); list.append(li);
  try {
    const blob = await compress(file, (s) => { meta.textContent = s; });
    if (blob.size >= file.size * 0.97) {
      meta.textContent = `Already small (${size(file.size)}). A stronger level may help, or keep your original.`;
      return;
    }
    const pct = Math.round((1 - blob.size / file.size) * 100);
    meta.textContent = `${size(file.size)} to ${size(blob.size)}, ${pct}% smaller`;
    const a = document.createElement("a");
    a.className = "btn btn-quiet"; a.textContent = "Download";
    a.href = URL.createObjectURL(blob); a.download = file.name.replace(/\.pdf$/i, "") + "-compressed.pdf";
    actions.append(a);
  } catch (e) {
    li.classList.add("bad");
    meta.textContent = e && e.name === "PasswordException" ? "This PDF is password protected." : "This file couldn't be read as a PDF.";
  }
}

const run = async (files) => { for (const f of files) await handle(f); };
$("choose").addEventListener("click", () => input.click());
input.addEventListener("change", () => { run([...input.files]); input.value = ""; });
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
drop.addEventListener("drop", (e) => { e.preventDefault(); run([...e.dataTransfer.files]); });
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());
