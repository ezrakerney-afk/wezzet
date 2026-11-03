/* Wezzet PDF to image: renders each page with pdf.js and saves JPG or PNG, all in the browser. */
import * as pdfjs from "/vendor/pdfjs-4.10.38/pdf.min.mjs";
pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs-4.10.38/pdf.worker.min.mjs";

const $ = (id) => document.getElementById(id);
const drop = $("drop"), input = $("files"), list = $("list"), zipBtn = $("zip"), msg = $("msg");
const results = [];
const fmt = () => document.querySelector('input[name="to"]:checked').value;
const dpi = () => parseInt(document.querySelector('input[name="dpi"]:checked').value, 10);
const size = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

async function handle(file) {
  msg.hidden = true;
  if (!(file.type === "application/pdf" || /\.pdf$/i.test(file.name))) { msg.textContent = `${file.name} isn't a PDF.`; msg.hidden = false; return; }
  // The PDF reader takes a few seconds to start the first time, so show that something is happening
  const wait = document.createElement("li");
  wait.innerHTML = '<span class="fname"></span><span class="fmeta">Opening</span>';
  wait.firstChild.textContent = file.name;
  list.append(wait);
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (e) {
    msg.textContent = e && e.name === "PasswordException" ? `${file.name} is password protected.` : `${file.name} couldn't be read as a PDF.`;
    msg.hidden = false; return;
  } finally {
    wait.remove();
  }
  const base = file.name.replace(/\.pdf$/i, ""), to = fmt(), scale = dpi() / 72;
  for (let n = 1; n <= doc.numPages; n++) {
    const li = document.createElement("li");
    const name = document.createElement("span"); name.className = "fname";
    const outName = `${base}-page-${n}.${to}`;
    name.textContent = outName;
    const meta = document.createElement("span"); meta.className = "fmeta"; meta.textContent = "Rendering";
    const actions = document.createElement("span"); actions.className = "factions";
    li.append(name, meta, actions); list.append(li);
    try {
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale });
      const c = document.createElement("canvas");
      c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const blob = await new Promise((r) => c.toBlob(r, to === "png" ? "image/png" : "image/jpeg", 0.92));
      results.push({ name: outName, blob });
      meta.textContent = `${c.width} × ${c.height}, ${size(blob.size)}`;
      const a = document.createElement("a");
      a.className = "btn btn-quiet"; a.textContent = "Download";
      a.href = URL.createObjectURL(blob); a.download = outName;
      actions.append(a);
      page.cleanup();
    } catch (e) {
      li.classList.add("bad"); meta.textContent = "This page couldn't be rendered.";
    }
    zipBtn.hidden = results.length < 2;
  }
  doc.destroy();
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
  a.download = "pdf-pages.zip"; a.click();
  zipBtn.disabled = false;
});

const run = async (files) => { for (const f of files) await handle(f); };
$("choose").addEventListener("click", () => input.click());
input.addEventListener("change", () => { run([...input.files]); input.value = ""; });
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
drop.addEventListener("drop", (e) => { e.preventDefault(); run([...e.dataTransfer.files]); });
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());
