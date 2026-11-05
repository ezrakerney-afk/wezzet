/* WCAG contrast checker. */
(() => {
  const $ = (id) => document.getElementById(id);
  const parse = (s) => {
    s = s.trim().replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(s)) s = s.replace(/./g, "$&$&");
    if (/^[0-9a-f]{6}$/i.test(s)) return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
    const m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
    return m ? m.slice(1, 4).map((x) => Math.min(255, +x)) : null;
  };
  const hex = (c) => "#" + c.map((x) => x.toString(16).padStart(2, "0")).join("");
  const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const badge = (ok, l) => `<div class="stat"><b class="${ok ? "pass" : "fail"}">${ok ? "Pass" : "Fail"}</b><span>${l}</span></div>`;
  function run() {
    const f = parse($("fgt").value), b = parse($("bgt").value);
    if (!f || !b) { $("ratio").textContent = "Enter two colors"; $("grades").innerHTML = ""; return; }
    $("fg").value = hex(f); $("bg").value = hex(b);
    const r = ratio(f, b);
    $("ratio").textContent = (Math.floor(r * 100) / 100).toFixed(2) + " : 1";
    $("prev").style.color = hex(f); $("prev").style.background = hex(b);
    $("grades").innerHTML = badge(r >= 4.5, "AA normal text") + badge(r >= 3, "AA large text") + badge(r >= 7, "AAA normal text") + badge(r >= 4.5, "AAA large text") + badge(r >= 3, "UI parts and icons");
    try { history.replaceState(null, "", "#" + hex(f).slice(1) + "-" + hex(b).slice(1)); } catch (x) {}
  }
  ["fg", "bg"].forEach((k) => {
    $(k).addEventListener("input", () => { $(k + "t").value = $(k).value; run(); });
    $(k + "t").addEventListener("input", run);
  });
  $("swap").addEventListener("click", () => { const t = $("fgt").value; $("fgt").value = $("bgt").value; $("bgt").value = t; run(); });
  const h = location.hash.match(/^#([0-9a-f]{6})-([0-9a-f]{6})$/i);
  if (h) { $("fgt").value = "#" + h[1]; $("bgt").value = "#" + h[2]; }
  run();
})();
