const $ = (id) => document.getElementById(id);
let mode = "timer", running = false, startAt = 0, elapsed = 0, target = 300000, raf = null, audio = null;
const fmt = (ms, showTenths) => {
  const t = Math.max(0, ms), h = Math.floor(t / 3600000), m = Math.floor(t / 60000) % 60, s = Math.floor(t / 1000) % 60;
  const p = (x) => String(x).padStart(2, "0");
  let out = (h ? h + ":" : "") + p(m) + ":" + p(s);
  if (showTenths) out += "." + Math.floor((t % 1000) / 100);
  return out;
};
const now = () => performance.now();
const current = () => elapsed + (running ? now() - startAt : 0);
function readTarget() { target = ((+$("hh").value || 0) * 3600 + (+$("mm").value || 0) * 60 + (+$("ss").value || 0)) * 1000; }
function beep() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 6; i++) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
      const t0 = audio.currentTime + i * 0.5;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      o.start(t0); o.stop(t0 + 0.4);
    }
  } catch (e) {}
}
function render() {
  const c = current();
  if (mode === "timer") {
    const left = target - c;
    $("display").textContent = fmt(Math.ceil(left / 1000) * 1000);
    document.title = running ? fmt(Math.ceil(left / 1000) * 1000) + " | Timer" : "Online Timer and Stopwatch | Wezzet";
    if (running && left <= 0) { stop(); elapsed = target; $("display").textContent = "00:00"; $("done").hidden = false; document.title = "Time's up | Wezzet"; beep(); return; }
  } else {
    $("display").textContent = fmt(c, true);
  }
  if (running) raf = requestAnimationFrame(render);
}
function stop() { if (running) { elapsed += now() - startAt; running = false; } cancelAnimationFrame(raf); $("start").textContent = "Start"; }
function start() {
  if (mode === "timer") { if (elapsed === 0) readTarget(); if (target <= 0 || elapsed >= target) return; }
  if (audio && audio.state === "suspended") audio.resume();
  if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  $("done").hidden = true;
  running = true; startAt = now(); $("start").textContent = "Pause"; $("set").hidden = true; render();
}
function reset() { stop(); elapsed = 0; $("laps").textContent = ""; $("done").hidden = true; $("set").hidden = mode !== "timer"; readTarget(); render(); }
$("start").addEventListener("click", () => (running ? stop() : start()));
$("reset").addEventListener("click", reset);
$("lap").addEventListener("click", () => { if (!running) return; const li = document.createElement("li"); li.textContent = fmt(current(), true); $("laps").prepend(li); });
["hh", "mm", "ss"].forEach((id) => $(id).addEventListener("input", () => { if (!running && elapsed === 0) { readTarget(); render(); } }));
document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", () => {
  mode = r.value; $("lap").hidden = mode !== "watch"; reset();
}));
document.addEventListener("keydown", (e) => { if (e.code === "Space" && !/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)) { e.preventDefault(); running ? stop() : start(); } });
reset();
