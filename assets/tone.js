/* Tone generator (Web Audio). */
(() => {
  const $ = (id) => document.getElementById(id);
  let ctx, osc, gain;
  const f = () => Math.min(20000, Math.max(1, +$("freq").value || 440));
  const toSlider = (hz) => Math.log(hz / 20) / Math.log(1000) * 1000, fromSlider = (v) => 20 * 1000 ** (v / 1000);
  const note = (hz) => { const n = Math.round(12 * Math.log2(hz / 440)) + 57, names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]; return names[((n % 12) + 12) % 12] + Math.floor(n / 12); };
  function upd() {
    const hz = f();
    $("note").textContent = "Closest note: " + note(hz);
    if (osc) { osc.frequency.setTargetAtTime(hz, ctx.currentTime, 0.015); osc.type = document.querySelector("[name=wave]:checked").value; gain.gain.setTargetAtTime(+$("vol").value / 100 * 0.5, ctx.currentTime, 0.02); }
    try { history.replaceState(null, "", "#" + Math.round(hz * 100) / 100); } catch (e) {}
  }
  function stop() { if (!osc) return; const o = osc; gain.gain.setTargetAtTime(0, ctx.currentTime, 0.02); setTimeout(() => o.stop(), 120); osc = null; $("play").textContent = "Play"; }
  function play() {
    if (osc) return stop();
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume();
    osc = ctx.createOscillator(); gain = ctx.createGain(); gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination); osc.start();
    $("play").textContent = "Stop"; upd();
  }
  $("play").addEventListener("click", play);
  $("slider").addEventListener("input", () => { $("freq").value = Math.round(fromSlider(+$("slider").value)); upd(); });
  $("freq").addEventListener("input", () => { $("slider").value = toSlider(f()); upd(); });
  $("vol").addEventListener("input", upd);
  document.querySelectorAll("[name=wave]").forEach((r) => r.addEventListener("change", upd));
  document.querySelectorAll("[data-hz]").forEach((b) => b.addEventListener("click", () => { $("freq").value = b.dataset.hz; $("slider").value = toSlider(f()); upd(); }));
  document.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => { $("freq").value = Math.max(1, Math.round((f() * (+b.dataset.step > 0 ? 2 ** (1 / 12) : 2 ** (-1 / 12))) * 100) / 100); $("slider").value = toSlider(f()); upd(); }));
  const h = parseFloat(location.hash.slice(1)); if (h > 0) $("freq").value = h;
  $("slider").value = toSlider(f()); upd();
})();
