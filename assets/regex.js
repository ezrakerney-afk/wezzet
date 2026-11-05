(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let timer;
  // Name of each capturing group in order ("" for unnamed).
  function groupNames(src) {
    const out = []; let cls = false;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (c === "\\") { i++; continue; }
      if (cls) { if (c === "]") cls = false; continue; }
      if (c === "[") { cls = true; continue; }
      if (c !== "(") continue;
      if (src[i + 1] !== "?") out.push("");
      else { const m = /^\(\?<([A-Za-z_$][\w$]*)>/.exec(src.slice(i)); if (m) out.push(m[1]); }
    }
    return out;
  }
  function run() {
    const src = $("re").value, text = $("t").value;
    const flags = [...new Set($("fl").value.replace(/[^dgimsuyv]/g, ""))].join("");
    $("hl").textContent = text; $("groups").innerHTML = ""; $("repout").textContent = "";
    if (!src) { $("st").textContent = "Type a pattern."; return; }
    let re;
    try { re = new RegExp(src, flags); } catch (e) { $("st").textContent = e.message.replace(/^Invalid regular expression: /, ""); $("st").style.color = "var(--bad)"; return; }
    $("st").style.color = "";
    const g = new RegExp(src, flags.includes("g") ? flags : flags + "g");
    const ms = [];
    let m, guard = 0;
    while ((m = g.exec(text)) && guard++ < 5000) { ms.push(m); if (m[0] === "") g.lastIndex++; if (!flags.includes("g")) break; }
    $("st").textContent = ms.length ? `${ms.length}${guard > 5000 ? "+" : ""} match${ms.length === 1 ? "" : "es"}` : "No match";
    let h = "", last = 0;
    for (const x of ms) { h += esc(text.slice(last, x.index)) + "<mark>" + esc(x[0]) + "</mark>"; last = x.index + x[0].length; }
    $("hl").innerHTML = h + esc(text.slice(last));
    if (ms.length) {
      const names = groupNames(src), n = ms[0].length - 1;
      let t = "<table><tr><th>#</th><th>Match</th><th>At</th>";
      for (let i = 1; i <= n; i++) t += `<th>${names[i - 1] ? esc(names[i - 1]) : "$" + i}</th>`;
      t += "</tr>";
      ms.slice(0, 200).forEach((x, i) => { t += `<tr><td>${i + 1}</td><td>${esc(x[0])}</td><td>${x.index}</td>` + x.slice(1).map((v) => `<td>${v === undefined ? "" : esc(v)}</td>`).join("") + "</tr>"; });
      $("groups").innerHTML = t + "</table>";
    }
    if ($("rep").value !== "" || document.activeElement === $("rep")) $("repout").textContent = text.replace(re, $("rep").value);
  }
  const later = () => { clearTimeout(timer); timer = setTimeout(run, 120); };
  ["re", "fl", "t", "rep"].forEach((id) => $(id).addEventListener("input", later));
  const q = new URLSearchParams(location.search).get("re");
  if (q) $("re").value = q; else $("re").value = "[\\w.]+@\\w+\\.com";
  run();
})();
