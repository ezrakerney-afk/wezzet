(() => {
  const $ = (id) => document.getElementById(id), v = $("v");
  let stream, mirror = true, fpsT;
  const st = (m, bad) => { $("st").textContent = m; $("st").style.color = bad ? "var(--bad)" : ""; };
  v.style.transform = "scaleX(-1)";
  async function start(id) {
    try {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({ video: { ...(id ? { deviceId: { exact: id } } : {}), width: { ideal: 3840 }, height: { ideal: 2160 } } });
    } catch (e) {
      st(e.name === "NotAllowedError" ? "Camera access was blocked. Allow it in the address bar and try again." : e.name === "NotFoundError" ? "No camera found." : e.name === "NotReadableError" ? "The camera is in use by another app. Close it and try again." : "Could not open the camera: " + e.message, true);
      return;
    }
    v.srcObject = stream;
    const tr = stream.getVideoTracks()[0];
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
    $("dev").innerHTML = devs.map((d, i) => `<option value="${d.deviceId}">${(d.label || "Camera " + (i + 1)).replace(/</g, "&lt;")}</option>`).join("");
    $("dev").value = tr.getSettings().deviceId || ""; $("dev").disabled = false;
    $("snap").disabled = $("flip").disabled = false; $("start").textContent = "Restart";
    st("Your camera works: " + tr.label);
    v.onloadedmetadata = () => { $("res").textContent = v.videoWidth + " × " + v.videoHeight; };
    measure();
  }
  function measure() {
    clearInterval(fpsT);
    if (v.requestVideoFrameCallback) {
      let n = 0; const cb = () => { n++; v.requestVideoFrameCallback(cb); }; v.requestVideoFrameCallback(cb);
      fpsT = setInterval(() => { $("fps").textContent = n; n = 0; if (v.videoWidth) $("res").textContent = v.videoWidth + " × " + v.videoHeight; }, 1000);
    } else {
      const fr = stream.getVideoTracks()[0].getSettings().frameRate;
      $("fps").textContent = fr ? Math.round(fr) : "-";
    }
  }
  $("start").addEventListener("click", () => { if (!navigator.mediaDevices) return st("This browser can't use the camera here.", true); start(); });
  $("dev").addEventListener("change", () => start($("dev").value));
  $("flip").addEventListener("click", () => { mirror = !mirror; v.style.transform = mirror ? "scaleX(-1)" : ""; });
  $("snap").addEventListener("click", () => {
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    const g = c.getContext("2d"); if (mirror) { g.translate(c.width, 0); g.scale(-1, 1); }
    g.drawImage(v, 0, 0);
    c.toBlob((b) => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "webcam-" + new Date().toISOString().slice(0, 19).replace(/:/g, "-") + ".jpg"; a.click(); }, "image/jpeg", 0.92);
  });
})();
