/* Text compare: Myers diff on lines, then on words inside changed lines. */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  // Returns ops: [type, index] with type " " (same), "-" (a only), "+" (b only).
  function myers(a, b) {
    const n = a.length, m = b.length, max = n + m, off = max + 1;
    const v = new Int32Array(2 * max + 3), trace = [];
    let found = false;
    for (let d = 0; d <= max && !found; d++) {
      trace.push(v.slice(off - d - 1, off + d + 2));
      for (let k = -d; k <= d; k += 2) {
        let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1;
        let y = x - k;
        while (x < n && y < m && a[x] === b[y]) { x++; y++; }
        v[off + k] = x;
        if (x >= n && y >= m) { found = true; break; }
      }
      if (d > 6000) return null;
    }
    const ops = [];
    let x = n, y = m;
    for (let d = trace.length - 1; d >= 0; d--) {
      const t = trace[d], V = (k) => t[k + d + 1];
      const k = x - y;
      const pk = (k === -d || (k !== d && V(k - 1) < V(k + 1))) ? k + 1 : k - 1;
      const px = V(pk), py = px - pk;
      while (x > px && y > py) { ops.push([" ", --x, --y]); }
      if (d > 0) { if (x === px) ops.push(["+", x, --y]); else ops.push(["-", --x, y]); }
      x = px; y = py;
    }
    return ops.reverse();
  }

  function words(oldL, newL) {
    const tok = (s) => s.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) || [];
    const a = tok(oldL), b = tok(newL);
    if (a.length * b.length > 4e6) return [esc(oldL), esc(newL)];
    const ops = myers(a, b);
    if (!ops) return [esc(oldL), esc(newL)];
    let r = "", s = "";
    for (const [t, i, j] of ops) {
      if (t === " ") { r += esc(a[i]); s += esc(b[j]); }
      else if (t === "-") r += "<del>" + esc(a[i]) + "</del>";
      else s += "<ins>" + esc(b[j]) + "</ins>";
    }
    return [r.replace(/<\/del><del>/g, ""), s.replace(/<\/ins><ins>/g, "")];
  }

  function run() {
    const A = $("a").value.replace(/\r\n?/g, "\n").split("\n"), B = $("b").value.replace(/\r\n?/g, "\n").split("\n");
    const ws = $("ws").checked, ic = $("ic").checked;
    const norm = (s) => { if (ws) s = s.replace(/\s+/g, " ").trim(); if (ic) s = s.toLowerCase(); return s; };
    const ops = myers(A.map(norm), B.map(norm));
    const out = $("out");
    if (!ops) { $("sum").textContent = "These texts are too different to compare line by line."; out.hidden = true; return; }
    // Build rows, pairing removed and added runs for word highlights.
    const rows = [];
    let add = 0, del = 0;
    for (let i = 0; i < ops.length;) {
      if (ops[i][0] === " ") { rows.push(["s", esc(B[ops[i][2]])]); i++; continue; }
      const r = [], s = [];
      while (i < ops.length && ops[i][0] !== " ") { if (ops[i][0] === "-") r.push(A[ops[i][1]]); else s.push(B[ops[i][2]]); i++; }
      del += r.length; add += s.length;
      const pr = [], ps = [];
      for (let j = 0; j < Math.max(r.length, s.length); j++) {
        if (j < r.length && j < s.length && r[j].length < 4000 && s[j].length < 4000) { const [x, y] = words(r[j], s[j]); pr.push(x); ps.push(y); }
        else { if (j < r.length) pr.push(esc(r[j])); if (j < s.length) ps.push(esc(s[j])); }
      }
      pr.forEach((h) => rows.push(["r", h])); ps.forEach((h) => rows.push(["a", h]));
    }
    if (!add && !del) { $("sum").textContent = "No differences. The texts are the same."; out.hidden = true; return; }
    $("sum").textContent = `${del} line${del === 1 ? "" : "s"} removed, ${add} line${add === 1 ? "" : "s"} added.`;
    const all = $("all").checked, keep = new Uint8Array(rows.length);
    rows.forEach((r, i) => { if (r[0] !== "s") for (let j = Math.max(0, i - 3); j <= Math.min(rows.length - 1, i + 3); j++) keep[j] = 1; });
    let h = "", skipped = 0;
    rows.forEach((r, i) => {
      if (!all && !keep[i]) { skipped++; return; }
      if (skipped) { h += `<div class="gap">${skipped} unchanged line${skipped === 1 ? "" : "s"}</div>`; skipped = 0; }
      h += `<div class="${r[0]}">${r[1] || " "}</div>`;
    });
    if (skipped) h += `<div class="gap">${skipped} unchanged line${skipped === 1 ? "" : "s"}</div>`;
    out.innerHTML = h; out.hidden = false;
  }
  $("go").addEventListener("click", run);
  ["ws", "ic", "all"].forEach((id) => $(id).addEventListener("change", () => { if (!$("out").hidden || $("sum").textContent) run(); }));
})();
