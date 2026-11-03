/* Wezzet QR code maker (qrcode-generator, UTF-8). */
(() => {
  const $ = (id) => document.getElementById(id);
  const preview = $("preview"), msg = $("msg"), dl = $("downloads");
  let current = null; // qr object

  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];

  const mode = () => document.querySelector('input[name="mode"]:checked').value;
  const wifiEsc = (s) => s.replace(/([\\;,:"])/g, "\\$1");

  function payload() {
    if (mode() === "wifi") {
      const ssid = $("ssid").value;
      if (!ssid) return "";
      const sec = $("security").value;
      const pass = $("wpass").value;
      let s = `WIFI:T:${sec};S:${wifiEsc(ssid)};`;
      if (sec !== "nopass") s += `P:${wifiEsc(pass)};`;
      if ($("hidden-net").checked) s += "H:true;";
      return s + ";";
    }
    return $("text").value.trim();
  }

  function draw() {
    msg.hidden = true;
    const data = payload();
    if (!data) { preview.textContent = ""; dl.hidden = true; current = null; return; }
    try {
      const qr = qrcode(0, $("ecc").value);
      qr.addData(data, "Byte");
      qr.make();
      current = qr;
      preview.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 4, scalable: true });
      const svg = preview.querySelector("svg");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", "QR code");
      dl.hidden = false;
    } catch (e) {
      current = null; preview.textContent = ""; dl.hidden = true;
      msg.textContent = "That's too much text for one QR code. Try something shorter.";
      msg.hidden = false;
    }
  }

  function save(href, name) {
    const a = document.createElement("a");
    a.href = href; a.download = name; a.click();
  }

  $("png").addEventListener("click", () => {
    if (!current) return;
    const n = current.getModuleCount(), margin = 4, px = Math.max(8, Math.ceil(1024 / (n + margin * 2)));
    const size = (n + margin * 2) * px;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#000";
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
      if (current.isDark(r, col)) ctx.fillRect((col + margin) * px, (r + margin) * px, px, px);
    }
    c.toBlob((b) => save(URL.createObjectURL(b), "qr-code.png"), "image/png");
  });

  $("svg").addEventListener("click", () => {
    if (!current) return;
    const svg = current.createSvgTag({ cellSize: 10, margin: 4 });
    const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', svg], { type: "image/svg+xml" });
    save(URL.createObjectURL(blob), "qr-code.svg");
  });

  function syncMode() {
    const wifi = mode() === "wifi";
    $("text-fields").hidden = wifi;
    $("wifi-fields").hidden = !wifi;
    $("wpass-field").hidden = $("security").value === "nopass";
    draw();
  }

  document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", syncMode));
  ["text", "ssid", "wpass", "ecc", "security", "hidden-net"].forEach((id) => {
    $(id).addEventListener("input", syncMode);
    $(id).addEventListener("change", syncMode);
  });
  syncMode();
})();
