(() => {
  const $ = (id) => document.getElementById(id);
  let rec, streams = [], t0, tick, url;
  const st = (m, bad) => { $("st").textContent = m; $("st").style.color = bad ? "var(--bad)" : ""; };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { $("go").disabled = true; st("This browser can't record the screen. Use Chrome, Edge, Firefox or Safari on a computer.", true); }
  const pick = () => ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
  const fmt = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  $("go").addEventListener("click", async () => {
    let screen, mic;
    try { screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: $("sys").checked }); }
    catch (e) { st(e.name === "NotAllowedError" ? "Recording was cancelled." : "Could not start: " + e.message, true); return; }
    if ($("mic").checked) { try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { st("Microphone blocked, recording without it."); } }
    streams = [screen, mic].filter(Boolean);
    const tracks = [...screen.getVideoTracks()];
    const audios = streams.flatMap((s) => s.getAudioTracks());
    if (audios.length > 1) {
      const ctx = new AudioContext(), dest = ctx.createMediaStreamDestination();
      streams.forEach((s) => s.getAudioTracks().length && ctx.createMediaStreamSource(s).connect(dest));
      tracks.push(...dest.stream.getAudioTracks());
    } else tracks.push(...audios);
    const type = pick(), parts = [];
    rec = new MediaRecorder(new MediaStream(tracks), type ? { mimeType: type } : {});
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    rec.onstop = () => {
      clearInterval(tick); streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      const mt = rec.mimeType || type || "video/webm", ext = /mp4/.test(mt) ? "mp4" : "webm";
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(new Blob(parts, { type: mt.split(";")[0] }));
      $("v").src = url; $("v").hidden = false;
      $("dl").href = url; $("dl").download = "screen-recording-" + new Date().toISOString().slice(0, 19).replace(/:/g, "-") + "." + ext; $("dl").hidden = false;
      $("conv").hidden = ext === "mp4";
      $("go").disabled = false; $("stop").disabled = true; $("go").textContent = "Record again";
      st("Done. " + fmt((Date.now() - t0) / 1000) + " recorded.");
    };
    screen.getVideoTracks()[0].addEventListener("ended", () => rec.state !== "inactive" && rec.stop());
    rec.start(1000); t0 = Date.now();
    $("go").disabled = true; $("stop").disabled = false; $("time").hidden = false; $("v").hidden = $("dl").hidden = $("conv").hidden = true;
    st("Recording. Press Stop, or stop sharing in the browser bar.");
    tick = setInterval(() => { $("time").textContent = fmt((Date.now() - t0) / 1000); }, 500);
    $("time").textContent = "0:00";
  });
  $("stop").addEventListener("click", () => rec && rec.state !== "inactive" && rec.stop());
})();
