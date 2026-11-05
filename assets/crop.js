(() => {
  const $ = (id) => document.getElementById(id);
  const img = $("img"), box = $("box"), stage = $("stage");
  let file = null, W = 0, H = 0, r = { x: 0, y: 0, w: 0, h: 0 }, ar = 0;
  const sc = () => img.clientWidth / W || 1;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function draw() {
    const s = sc();
    Object.assign(box.style, { left: r.x * s + "px", top: r.y * s + "px", width: r.w * s + "px", height: r.h * s + "px" });
    $("cw").value = Math.round(r.w); $("ch").value = Math.round(r.h);
  }
  function fit() {
    // Largest centred box of the chosen ratio, 90% of the image.
    let w = W * 0.9, h = H * 0.9;
    if (ar) { if (w / h > ar) w = h * ar; else h = w / ar; }
    r = { x: (W - w) / 2, y: (H - h) / 2, w, h }; draw();
  }
  function load(f) {
    if (!f || !/^image\//.test(f.type)) return;
    file = f;
    const u = URL.createObjectURL(f);
    img.onload = () => { W = img.naturalWidth; H = img.naturalHeight; $("drop").hidden = true; $("ed").hidden = false; requestAnimationFrame(fit); };
    img.onerror = () => alert("This image can't be opened here. Try the image converter first.");
    img.src = u;
  }
  $("choose").addEventListener("click", () => $("file").click());
  $("file").addEventListener("change", () => load($("file").files[0]));
  const dz = $("drop");
  dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("dragging"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("dragging"));
  dz.addEventListener("drop", (e) => { e.preventDefault(); dz.classList.remove("dragging"); load(e.dataTransfer.files[0]); });
  document.addEventListener("paste", (e) => { const f = [...(e.clipboardData?.files || [])][0]; if (f) load(f); });
  $("other").addEventListener("click", () => { $("ed").hidden = true; $("drop").hidden = false; $("file").value = ""; });
  document.querySelectorAll('input[name="ar"]').forEach((i) => i.addEventListener("change", () => { ar = +i.value; fit(); }));
  window.addEventListener("resize", () => W && draw());

  let drag = null;
  stage.addEventListener("pointerdown", (e) => {
    const h = e.target.dataset.h || (e.target === box ? "move" : null);
    if (!h) return;
    e.preventDefault(); stage.setPointerCapture(e.pointerId);
    drag = { h, sx: e.clientX, sy: e.clientY, o: { ...r } };
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const s = sc(), dx = (e.clientX - drag.sx) / s, dy = (e.clientY - drag.sy) / s, o = drag.o;
    if (drag.h === "move") { r.x = clamp(o.x + dx, 0, W - o.w); r.y = clamp(o.y + dy, 0, H - o.h); draw(); return; }
    // Fixed corner is opposite the dragged handle.
    const left = drag.h.includes("w"), top = drag.h.includes("n");
    const fx = left ? o.x + o.w : o.x, fy = top ? o.y + o.h : o.y;
    let w = clamp(left ? o.w - dx : o.w + dx, 8, left ? fx : W - fx);
    let h = clamp(top ? o.h - dy : o.h + dy, 8, top ? fy : H - fy);
    if (ar) {
      if (w / h > ar) w = h * ar; else h = w / ar;
    }
    r = { x: left ? fx - w : fx, y: top ? fy - h : fy, w, h }; draw();
  });
  const end = () => { drag = null; };
  stage.addEventListener("pointerup", end); stage.addEventListener("pointercancel", end);

  function setSize(which) {
    let w = clamp(+$("cw").value || r.w, 1, W), h = clamp(+$("ch").value || r.h, 1, H);
    if (ar) { if (which === "w") h = w / ar; else w = h * ar; if (h > H) { h = H; w = h * ar; } if (w > W) { w = W; h = w / ar; } }
    r = { x: clamp(r.x, 0, W - w), y: clamp(r.y, 0, H - h), w, h }; draw();
  }
  $("cw").addEventListener("change", () => setSize("w"));
  $("ch").addEventListener("change", () => setSize("h"));

  $("save").addEventListener("click", () => {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(r.w)); c.height = Math.max(1, Math.round(r.h));
    let to = document.querySelector('input[name="to"]:checked').value;
    if (to === "same") to = /png/.test(file.type) ? "png" : /webp/.test(file.type) ? "webp" : "jpg";
    const type = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" }[to];
    const ctx = c.getContext("2d");
    if (to === "jpg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
    c.toBlob((b) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = file.name.replace(/\.[^.]+$/, "") + "-cropped." + to;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, type, 0.95);
  });
})();
