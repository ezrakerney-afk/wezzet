/* Wezzet video and audio to MP3: the browser decodes the sound, LAME encodes it in a worker. */
(() => {
  const $ = (id) => document.getElementById(id);
  const drop = $("drop"), input = $("files"), list = $("list"), msg = $("msg");
  const pick = (n) => document.querySelector(`input[name="${n}"]:checked`).value;
  const size = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);
  const time = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`; };
  let ctx;

  document.querySelectorAll('input[name="to"]').forEach((r) => r.addEventListener("change", () => { $("kbps-field").hidden = pick("to") !== "mp3"; }));

  function wav(audio) {
    const ch = Math.min(2, audio.numberOfChannels), n = audio.length, rate = audio.sampleRate;
    const data = [...Array(ch)].map((_, i) => audio.getChannelData(i));
    const buf = new ArrayBuffer(44 + n * ch * 2), v = new DataView(buf);
    const s = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    s(0, "RIFF"); v.setUint32(4, 36 + n * ch * 2, true); s(8, "WAVE"); s(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, rate, true);
    v.setUint32(28, rate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); s(36, "data"); v.setUint32(40, n * ch * 2, true);
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const x = Math.max(-1, Math.min(1, data[c][i])); v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2; }
    return new Blob([buf], { type: "audio/wav" });
  }

  function mp3(audio, kbps, onProgress) {
    return new Promise((resolve, reject) => {
      const w = new Worker("/assets/mp3-worker.js?v=1");
      const left = audio.getChannelData(0).slice(), right = audio.numberOfChannels > 1 ? audio.getChannelData(1).slice() : null;
      w.onmessage = (e) => { if (e.data.blob) { w.terminate(); resolve(e.data.blob); } else onProgress(e.data.progress); };
      w.onerror = (e) => { w.terminate(); reject(e); };
      w.postMessage({ left, right, rate: audio.sampleRate, kbps }, right ? [left.buffer, right.buffer] : [left.buffer]);
    });
  }

  async function handle(file) {
    msg.hidden = true;
    const to = pick("to"), kbps = parseInt(pick("kbps"), 10);
    const outName = file.name.replace(/\.[^.]+$/, "") + "." + to;
    const li = document.createElement("li");
    const name = document.createElement("span"); name.className = "fname"; name.textContent = outName;
    const meta = document.createElement("span"); meta.className = "fmeta"; meta.textContent = "Reading";
    const actions = document.createElement("span"); actions.className = "factions";
    li.append(name, meta, actions); list.append(li);
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const raw = await file.arrayBuffer();
      meta.textContent = "Decoding";
      const audio = await new Promise((res, rej) => { const p = ctx.decodeAudioData(raw, res, rej); if (p && p.catch) p.catch(rej); });
      meta.textContent = "Converting";
      const blob = to === "wav" ? wav(audio) : await mp3(audio, kbps, (p) => { meta.textContent = `Converting ${p}%`; });
      meta.textContent = `${time(audio.duration)}, ${size(blob.size)}`;
      const a = document.createElement("a");
      a.className = "btn btn-quiet"; a.textContent = "Download";
      a.href = URL.createObjectURL(blob); a.download = outName;
      actions.append(a);
    } catch (e) {
      li.classList.add("bad");
      meta.textContent = "No sound could be read from this file. Try Chrome, or another file.";
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
})();
