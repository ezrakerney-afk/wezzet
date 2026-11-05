/* Metronome: Web Audio look-ahead scheduler, tap tempo. */
(() => {
  const $ = (id) => document.getElementById(id);
  let ctx, timer, next = 0, beat = 0, taps = [];
  const bpm = () => Math.min(300, Math.max(20, +$("bpm").value || 120));
  const per = () => +$("beats").value;
  function dots() { $("dots").innerHTML = Array.from({ length: per() }, (_, i) => `<span${i === 0 ? ' class="first"' : ""}></span>`).join(""); }
  function click(t, first) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = first && per() > 1 ? 1600 : 1000;
    g.gain.setValueAtTime(+$("vol").value / 100, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.06);
    const b = beat;
    setTimeout(() => { const s = $("dots").children; for (let i = 0; i < s.length; i++) s[i].classList.toggle("on", i === b); }, Math.max(0, (t - ctx.currentTime) * 1000));
  }
  function tick() {
    while (next < ctx.currentTime + 0.12) { click(next, beat === 0); next += 60 / bpm(); beat = (beat + 1) % per(); }
  }
  function toggle() {
    if (timer) { clearInterval(timer); timer = null; $("go").textContent = "Start"; [...$("dots").children].forEach((s) => s.classList.remove("on")); return; }
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume();
    beat = 0; next = ctx.currentTime + 0.06; timer = setInterval(tick, 25); tick();
    $("go").textContent = "Stop";
  }
  const set = (v) => { $("bpm").value = Math.round(Math.min(300, Math.max(20, v))); $("bpmr").value = $("bpm").value; $("bpmo").textContent = $("bpm").value; };
  $("go").addEventListener("click", toggle);
  $("bpmr").addEventListener("input", () => set(+$("bpmr").value));
  $("bpm").addEventListener("change", () => set(bpm()));
  $("minus").addEventListener("click", () => set(bpm() - 1));
  $("plus").addEventListener("click", () => set(bpm() + 1));
  $("beats").addEventListener("change", () => { beat = 0; dots(); });
  $("tap").addEventListener("click", () => {
    const now = performance.now(); taps = taps.filter((t) => now - t < 3000); taps.push(now);
    if (taps.length > 1) set(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)));
  });
  document.addEventListener("keydown", (e) => { if (e.code === "Space" && !e.target.closest("input, select, button")) { e.preventDefault(); toggle(); } });
  set(120); dots();
})();
