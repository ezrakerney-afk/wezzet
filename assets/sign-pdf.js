/* Wezzet sign PDF: draw or type a signature, place it on pages, save with pdf-lib. All in the browser. */
import * as pdfjs from "/vendor/pdfjs-4.10.38/pdf.min.mjs";
pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs-4.10.38/pdf.worker.min.mjs";

const $ = (id) => document.getElementById(id);
const drop = $("drop"), input = $("files"), msg = $("msg"), work = $("work"), pagesEl = $("pages");
const pad = $("pad"), typed = $("typed"), saveBtn = $("save");
const how = () => document.querySelector('input[name="how"]:checked').value;
const FONT = '"Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive';
let bytes = null, fileName = "document", pages = [], drew = false;

/* Signature pad */
const pctx = pad.getContext("2d");
function setupPad() {
  const r = window.devicePixelRatio || 1, w = pad.clientWidth, h = pad.clientHeight;
  pad.width = w * r; pad.height = h * r;
  pctx.setTransform(r, 0, 0, r, 0, 0);
  pctx.lineWidth = 2.4; pctx.lineCap = "round"; pctx.lineJoin = "round"; pctx.strokeStyle = $("ink").value;
  drew = false;
  if (how() === "type") drawTyped();
}
function drawTyped() {
  const w = pad.clientWidth, h = pad.clientHeight;
  pctx.clearRect(0, 0, w, h);
  const t = typed.value.trim();
  if (!t) { drew = false; return; }
  let fs = 56;
  pctx.font = `${fs}px ${FONT}`;
  while (fs > 16 && pctx.measureText(t).width > w - 24) { fs -= 2; pctx.font = `${fs}px ${FONT}`; }
  pctx.fillStyle = $("ink").value; pctx.textBaseline = "middle"; pctx.textAlign = "center";
  pctx.fillText(t, w / 2, h / 2);
  drew = true;
}
let drawing = false;
pad.addEventListener("pointerdown", (e) => {
  if (how() !== "draw") return;
  drawing = true; pad.setPointerCapture(e.pointerId);
  pctx.strokeStyle = $("ink").value;
  pctx.beginPath(); pctx.moveTo(e.offsetX, e.offsetY);
});
pad.addEventListener("pointermove", (e) => { if (!drawing) return; pctx.lineTo(e.offsetX, e.offsetY); pctx.stroke(); drew = true; });
pad.addEventListener("pointerup", () => { drawing = false; });
$("clear").addEventListener("click", () => { pctx.clearRect(0, 0, pad.width, pad.height); typed.value = ""; drew = false; });
typed.addEventListener("input", drawTyped);
$("ink").addEventListener("change", () => { if (how() === "type") drawTyped(); });
document.querySelectorAll('input[name="how"]').forEach((r) => r.addEventListener("change", () => {
  $("type-field").hidden = how() !== "type";
  pad.classList.toggle("typing", how() === "type");
  pctx.clearRect(0, 0, pad.width, pad.height); drew = false;
  if (how() === "type") { drawTyped(); typed.focus(); }
}));

/* Crop the signature to its drawn area so it places tightly. */
function signatureImage() {
  const { width: w, height: h } = pad;
  const d = pctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const m = 6, cw = Math.min(w, x1 + m) - Math.max(0, x0 - m), ch = Math.min(h, y1 + m) - Math.max(0, y0 - m);
  const c = document.createElement("canvas"); c.width = cw; c.height = ch;
  c.getContext("2d").drawImage(pad, Math.max(0, x0 - m), Math.max(0, y0 - m), cw, ch, 0, 0, cw, ch);
  return { url: c.toDataURL("image/png"), ratio: ch / cw };
}

/* Pages */
async function load(file) {
  msg.hidden = true;
  if (!(file.type === "application/pdf" || /\.pdf$/i.test(file.name))) { msg.textContent = `${file.name} isn't a PDF.`; msg.hidden = false; return; }
  bytes = new Uint8Array(await file.arrayBuffer());
  fileName = file.name.replace(/\.pdf$/i, "");
  let doc;
  try { doc = await pdfjs.getDocument({ data: bytes.slice() }).promise; }
  catch (e) { msg.textContent = e && e.name === "PasswordException" ? "This PDF is password protected." : "This file couldn't be read as a PDF."; msg.hidden = false; return; }
  pagesEl.textContent = ""; pages = [];
  work.hidden = false; drop.hidden = true;
  setupPad();
  const avail = Math.min(800, pagesEl.clientWidth || 800), r = window.devicePixelRatio || 1;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const scale = avail / page.getViewport({ scale: 1 }).width;
    const vp = page.getViewport({ scale });
    const box = document.createElement("div"); box.className = "pg";
    box.style.width = vp.width + "px"; box.style.height = vp.height + "px";
    const c = document.createElement("canvas");
    c.width = Math.ceil(vp.width * r); c.height = Math.ceil(vp.height * r);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: scale * r }) }).promise;
    box.append(c); pagesEl.append(box);
    const label = document.createElement("p"); label.className = "pg-num"; label.textContent = `Page ${n} of ${doc.numPages}`;
    pagesEl.append(label);
    pages.push({ box, vp, index: n - 1 });
    box.addEventListener("click", (e) => { if (e.target === c) place(pages[n - 1], e.offsetX, e.offsetY); });
  }
}

function place(pg, x, y) {
  const sig = signatureImage();
  if (!sig) { msg.textContent = "Draw or type your signature first, then click the page."; msg.hidden = false; return; }
  msg.hidden = true;
  const w = Math.min(220, pg.vp.width * 0.35), h = w * sig.ratio;
  const el = document.createElement("div"); el.className = "sig";
  el.style.left = Math.max(0, x - w / 2) + "px"; el.style.top = Math.max(0, y - h / 2) + "px"; el.style.width = w + "px";
  el.dataset.ratio = sig.ratio;
  const img = document.createElement("img"); img.src = sig.url; img.alt = "Signature"; img.draggable = false;
  const del = document.createElement("button"); del.type = "button"; del.className = "sig-del"; del.textContent = "×"; del.setAttribute("aria-label", "Remove signature");
  const grip = document.createElement("span"); grip.className = "sig-grip"; grip.setAttribute("aria-hidden", "true");
  el.append(img, del, grip); pg.box.append(el);
  del.addEventListener("click", () => el.remove());
  drag(el, grip, pg.box);
  saveBtn.disabled = false;
}

function drag(el, grip, box) {
  let mode = null, sx, sy, sl, st, sw;
  el.addEventListener("pointerdown", (e) => {
    if (e.target.classList.contains("sig-del")) return;
    mode = e.target === grip ? "size" : "move";
    sx = e.clientX; sy = e.clientY; sl = el.offsetLeft; st = el.offsetTop; sw = el.offsetWidth;
    el.setPointerCapture(e.pointerId); e.preventDefault();
  });
  el.addEventListener("pointermove", (e) => {
    if (!mode) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (mode === "move") {
      el.style.left = Math.min(box.clientWidth - 20, Math.max(-el.offsetWidth + 20, sl + dx)) + "px";
      el.style.top = Math.min(box.clientHeight - 20, Math.max(-el.offsetHeight + 20, st + dy)) + "px";
    } else el.style.width = Math.max(30, sw + dx) + "px";
  });
  el.addEventListener("pointerup", () => { mode = null; });
}

saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;
  try {
    const { PDFDocument, degrees } = PDFLib;
    const out = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const cache = new Map();
    for (const pg of pages) {
      const page = out.getPage(pg.index);
      for (const el of pg.box.querySelectorAll(".sig")) {
        const src = el.querySelector("img").src;
        if (!cache.has(src)) cache.set(src, await out.embedPng(src));
        const L = el.offsetLeft, T = el.offsetTop, W = el.offsetWidth, H = el.offsetHeight;
        const [x0, y0] = pg.vp.convertToPdfPoint(L, T + H);
        const [x1, y1] = pg.vp.convertToPdfPoint(L + W, T + H);
        const ang = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
        page.drawImage(cache.get(src), { x: x0, y: y0, width: W / pg.vp.scale, height: H / pg.vp.scale, rotate: degrees(ang) });
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([await out.save()], { type: "application/pdf" }));
    a.download = fileName + "-signed.pdf"; a.click();
  } catch (e) {
    msg.textContent = "This PDF couldn't be saved. It may be locked against changes."; msg.hidden = false;
  }
  saveBtn.disabled = false;
});

$("again").addEventListener("click", () => { work.hidden = true; drop.hidden = false; pagesEl.textContent = ""; pages = []; saveBtn.disabled = true; });
$("choose").addEventListener("click", () => input.click());
input.addEventListener("change", () => { if (input.files[0]) load(input.files[0]); input.value = ""; });
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
drop.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) load(e.dataTransfer.files[0]); });
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());
window.addEventListener("resize", () => { if (!work.hidden && !drew) setupPad(); });
