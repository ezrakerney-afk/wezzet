(() => {
  const $ = (id) => document.getElementById(id);
  let stream, ctx, an, raf;
  const st = (m, bad) => { $("st").textContent = m; $("st").style.color = bad ? "var(--bad)" : ""; };
  async function start(id) {
    try {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({ audio: id ? { deviceId: { exact: id } } : true });
    } catch (e) {
      st(e.name === "NotAllowedError" ? "Microphone access was blocked. Allow it in the address bar and try again." : e.name === "NotFoundError" ? "No microphone found." : "Could not open the microphone: " + e.message, true);
      return;
    }
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") await ctx.resume();
    an = ctx.createAnalyser(); an.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(an);
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
    const cur = stream.getAudioTracks()[0];
    $("dev").innerHTML = devs.map((d, i) => `<option value="${d.deviceId}">${(d.label || "Microphone " + (i + 1)).replace(/</g, "&lt;")}</option>`).join("");
    $("dev").value = cur.getSettings().deviceId || ""; $("dev").disabled = false;
    $("rec").disabled = false; $("start").textContent = "Restart";
    st("Listening to " + cur.label + ". Speak and watch the bar move.");
    loop();
  }
  let heard = 0;
  function loop() {
    cancelAnimationFrame(raf);
    const buf = new Float32Array(an.fftSize), cv = $("wave"), g = cv.getContext("2d");
    const ink = getComputedStyle(document.body).color;
    const step = () => {
      an.getFloatTimeDomainData(buf);
      let sum = 0; for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length), pct = Math.min(100, Math.sqrt(rms) * 160);
      $("lvl").style.width = pct + "%";
      if (pct > 25 && !heard++) st("Your microphone works.");
      g.clearRect(0, 0, cv.width, cv.height); g.strokeStyle = ink; g.lineWidth = 3; g.beginPath();
      for (let i = 0; i < buf.length; i += 2) { const x = i / buf.length * cv.width, y = (1 - buf[i]) * cv.height / 2; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); raf = requestAnimationFrame(step);
    };
    step();
  }
  $("start").addEventListener("click", () => { if (!navigator.mediaDevices) return st("This browser can't use the microphone here.", true); start(); });
  $("dev").addEventListener("change", () => start($("dev").value));
  $("rec").addEventListener("click", () => {
    if (!window.MediaRecorder) return st("Recording is not supported in this browser.", true);
    const mr = new MediaRecorder(stream), parts = [];
    mr.ondataavailable = (e) => parts.push(e.data);
    mr.onstop = () => { const p = $("play"); p.src = URL.createObjectURL(new Blob(parts, { type: mr.mimeType })); p.hidden = false; p.play().catch(() => {}); $("rec").disabled = false; $("rec").textContent = "Record 5 seconds"; st("Playing back your recording."); };
    mr.start(); $("rec").disabled = true; $("rec").textContent = "Recording…";
    setTimeout(() => mr.state !== "inactive" && mr.stop(), 5000);
  });
})();
