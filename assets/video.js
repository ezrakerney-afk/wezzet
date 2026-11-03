/* Wezzet video and audio converter: ffmpeg compiled to WebAssembly, running in the browser.
   The 32 MB ffmpeg core is too big for Cloudflare Pages, so it's fetched from jsDelivr the
   first time it's needed. Files are still processed on the visitor's device. */
import { FFmpeg } from "/vendor/ffmpeg-0.12.15/index.js";
import { fetchFile, toBlobURL } from "/vendor/ffmpeg-util-0.12.2/index.js";

const CORE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
const $ = (id) => document.getElementById(id);
const drop = $("drop"), input = $("files"), list = $("list"), msg = $("msg"), bar = $("bar"), status = $("status");
const size = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);
const fmt = () => $("to").value;
let ff = null, busy = false;
const queue = [];

// Output presets: file extension, MIME type and ffmpeg arguments
const PRESETS = {
  mp4: ["mp4", "video/mp4", ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart"]],
  "mp4-small": ["mp4", "video/mp4", ["-vf", "scale='min(1280,iw)':-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart"]],
  webm: ["webm", "video/webm", ["-c:v", "libvpx", "-b:v", "1M", "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libvorbis"]],
  gif: ["gif", "image/gif", ["-vf", "fps=12,scale='min(480,iw)':-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse", "-loop", "0", "-an"]],
  mp3: ["mp3", "audio/mpeg", ["-vn", "-c:a", "libmp3lame", "-q:a", "2"]],
  m4a: ["m4a", "audio/mp4", ["-vn", "-c:a", "aac", "-b:a", "192k"]],
  wav: ["wav", "audio/wav", ["-vn"]],
  ogg: ["ogg", "audio/ogg", ["-vn", "-c:a", "libvorbis", "-q:a", "5"]],
};

async function engine() {
  if (ff) return ff;
  status.textContent = "Loading the converter (about 32 MB, only the first time)";
  const f = new FFmpeg();
  f.on("progress", ({ progress }) => { if (progress >= 0 && progress <= 1) bar.value = progress; });
  await f.load({
    coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, "application/wasm"),
  });
  ff = f;
  return ff;
}

// "1:30" or "90" -> seconds as a string ffmpeg accepts, or null
function time(v) {
  const t = v.trim();
  if (!t) return null;
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(t)) throw new Error(`"${t}" isn't a time like 90 or 1:30.`);
  return t;
}

async function convert(file) {
  const li = document.createElement("li");
  const name = document.createElement("span"); name.className = "fname"; name.textContent = file.name;
  const meta = document.createElement("span"); meta.className = "fmeta"; meta.textContent = "Waiting";
  const actions = document.createElement("span"); actions.className = "factions";
  li.append(name, meta, actions); list.append(li);
  const key = fmt(), [ext, mime, args] = PRESETS[key];
  const inName = "in" + ((file.name.match(/\.[^.]+$/) || [".bin"])[0]).toLowerCase(), outName = "out." + ext;
  try {
    const start = time($("start").value), end = time($("end").value);
    const f = await engine();
    meta.textContent = "Converting"; bar.value = 0; bar.hidden = false;
    status.textContent = `Converting ${file.name}`;
    await f.writeFile(inName, await fetchFile(file));
    const cut = [...(start ? ["-ss", start] : []), ...(end ? ["-to", end] : [])];
    const code = await f.exec([...cut, "-i", inName, ...args, outName]);
    if (code !== 0) throw new Error("ffmpeg");
    const data = await f.readFile(outName);
    await f.deleteFile(inName); await f.deleteFile(outName);
    const blob = new Blob([data.buffer], { type: mime });
    const out = file.name.replace(/\.[^.]+$/, "") + (key === "mp4-small" ? "-small" : "") + "." + ext;
    meta.textContent = `${size(file.size)} to ${size(blob.size)}`;
    const a = document.createElement("a");
    a.className = "btn btn-quiet"; a.textContent = "Download";
    a.href = URL.createObjectURL(blob); a.download = out;
    actions.append(a);
  } catch (e) {
    li.classList.add("bad");
    meta.textContent = /isn't a time/.test(e.message) ? e.message
      : e.message === "ffmpeg" ? "This file couldn't be converted. It may be damaged, or in a format ffmpeg can't read."
      : "The converter couldn't load. Check your connection and try again.";
    try { await ff?.deleteFile(inName); } catch (x) {}
  }
}

async function run() {
  if (busy) return;
  busy = true;
  while (queue.length) await convert(queue.shift());
  busy = false; bar.hidden = true; status.textContent = "";
}

function add(files) {
  msg.hidden = true;
  for (const f of files) queue.push(f);
  run();
}

$("choose").addEventListener("click", () => input.click());
input.addEventListener("change", () => { add([...input.files]); input.value = ""; });
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
drop.addEventListener("drop", (e) => { e.preventDefault(); add([...e.dataTransfer.files]); });
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());
// Pre-select the format from links like /video?to=mp3
const pre = new URLSearchParams(location.search).get("to");
if (pre && PRESETS[pre]) $("to").value = pre;
