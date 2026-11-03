/* Wezzet video to GIF: grabs frames from a <video> and encodes them with gifenc, all in the browser. */
import { GIFEncoder, quantize, applyPalette } from "/vendor/gifenc-1.0.3.esm.js";

const $ = (id) => document.getElementById(id);
const drop = $("drop"), input = $("files"), video = $("video"), panel = $("panel"), msg = $("msg");
const startEl = $("start"), lenEl = $("len"), widthEl = $("width"), makeBtn = $("make"), status = $("status"), out = $("out");
const fps = () => parseInt(document.querySelector('input[name="fps"]:checked').value, 10);
const size = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);
let url = null, baseName = "clip";

function load(file) {
  msg.hidden = true;
  if (!/^video\//.test(file.type) && !/\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(file.name)) { msg.textContent = `${file.name} isn't a video.`; msg.hidden = false; return; }
  if (url) URL.revokeObjectURL(url);
  url = URL.createObjectURL(file);
  baseName = file.name.replace(/\.[^.]+$/, "");
  out.textContent = ""; status.textContent = "";
  video.src = url;
  video.onloadedmetadata = () => {
    panel.hidden = false;
    startEl.max = Math.max(0, video.duration - 0.1).toFixed(1);
    startEl.value = "0";
    lenEl.value = Math.min(5, Math.floor(video.duration * 10) / 10 || 5);
  };
  video.onerror = () => { msg.textContent = "This video format can't be played in your browser. MP4 and WebM work best."; msg.hidden = false; };
}

const seek = (t) => new Promise((res) => { video.onseeked = () => { video.onseeked = null; res(); }; video.currentTime = t; });

async function make() {
  makeBtn.disabled = true; out.textContent = "";
  video.pause();
  const start = Math.max(0, parseFloat(startEl.value) || 0);
  const len = Math.min(20, Math.max(0.2, parseFloat(lenEl.value) || 5));
  const end = Math.min(video.duration, start + len);
  const rate = fps();
  const w = Math.min(video.videoWidth, Math.max(40, parseInt(widthEl.value, 10) || 480));
  const h = Math.max(1, Math.round(video.videoHeight * w / video.videoWidth));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const gif = GIFEncoder();
  const delay = Math.round(1000 / rate);
  const total = Math.max(1, Math.floor((end - start) * rate));
  try {
    for (let i = 0; i < total; i++) {
      status.textContent = `Frame ${i + 1} of ${total}`;
      await seek(start + i / rate);
      ctx.drawImage(video, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const palette = quantize(data, 256);
      gif.writeFrame(applyPalette(data, palette), w, h, { palette, delay });
    }
    gif.finish();
    const blob = new Blob([gif.bytes()], { type: "image/gif" });
    const href = URL.createObjectURL(blob);
    status.textContent = `${w} × ${h}, ${total} frames, ${size(blob.size)}`;
    const img = document.createElement("img"); img.src = href; img.alt = "Your GIF"; img.className = "gif-out";
    const a = document.createElement("a"); a.className = "btn"; a.textContent = "Download GIF"; a.href = href; a.download = baseName + ".gif";
    out.append(img, a);
  } catch (e) {
    status.textContent = "Something went wrong making the GIF. Try a shorter clip or a smaller width.";
  }
  makeBtn.disabled = false;
}

makeBtn.addEventListener("click", make);
$("choose").addEventListener("click", () => input.click());
input.addEventListener("change", () => { if (input.files[0]) load(input.files[0]); input.value = ""; });
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
drop.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) load(e.dataTransfer.files[0]); });
$("use-now").addEventListener("click", () => { startEl.value = video.currentTime.toFixed(1); });
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());
