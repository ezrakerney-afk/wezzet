/* Wezzet PDF to text: reads the text layer of each page with pdf.js. */
import * as pdfjs from "/vendor/pdfjs-4.10.38/pdf.min.mjs";
pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs-4.10.38/pdf.worker.min.mjs";

const $ = (id) => document.getElementById(id);
const drop = $("drop"), input = $("files"), msg = $("msg"), out = $("out"), info = $("info");
let base = "text";

function pageText(items) {
  // Group pieces into lines by their vertical position, then left to right
  const lines = [];
  for (const it of items) {
    if (!("str" in it)) continue;
    const y = it.transform[5], x = it.transform[4];
    let line = lines.find((l) => Math.abs(l.y - y) < Math.max(2, (it.height || 10) * 0.5));
    if (!line) { line = { y, parts: [] }; lines.push(line); }
    line.parts.push({ x, s: it.str, w: it.width });
  }
  lines.sort((a, b) => b.y - a.y);
  return lines.map((l) => {
    l.parts.sort((a, b) => a.x - b.x);
    let s = "", end = null;
    for (const p of l.parts) {
      if (end !== null && p.x - end > 1 && !/\s$/.test(s) && !/^\s/.test(p.s)) s += " ";
      s += p.s; end = p.x + p.w;
    }
    return s.replace(/\s+$/, "");
  }).join("\n");
}

async function handle(file) {
  msg.hidden = true;
  if (!file) return;
  if (!(file.type === "application/pdf" || /\.pdf$/i.test(file.name))) { msg.textContent = `${file.name} isn't a PDF.`; msg.hidden = false; return; }
  base = file.name.replace(/\.pdf$/i, "");
  $("out-wrap").hidden = false; out.value = ""; info.textContent = "Opening";
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (e) {
    $("out-wrap").hidden = true;
    msg.textContent = e && e.name === "PasswordException" ? `${file.name} is password protected.` : `${file.name} couldn't be read as a PDF.`;
    msg.hidden = false; return;
  }
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    info.textContent = `Reading page ${n} of ${doc.numPages}`;
    const page = await doc.getPage(n);
    pages.push(pageText((await page.getTextContent()).items));
    page.cleanup();
  }
  doc.destroy();
  out.value = pages.join("\n\n").trim();
  const words = out.value ? out.value.split(/\s+/).length : 0;
  info.textContent = `${pages.length} page${pages.length === 1 ? "" : "s"}, ${words.toLocaleString()} words`;
  if (!words) { msg.textContent = "No text found. This PDF is probably a scan of pictures."; msg.hidden = false; }
}

$("copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(out.value); } catch { out.select(); document.execCommand("copy"); }
  $("copy").textContent = "Copied"; setTimeout(() => ($("copy").textContent = "Copy"), 1200);
});
$("save").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([out.value], { type: "text/plain;charset=utf-8" }));
  a.download = base + ".txt"; a.click();
});
$("choose").addEventListener("click", () => input.click());
input.addEventListener("change", () => { handle(input.files[0]); input.value = ""; });
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
drop.addEventListener("drop", (e) => { e.preventDefault(); handle(e.dataTransfer.files[0]); });
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());
