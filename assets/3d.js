/* Wezzet 3D file converter: STL, OBJ, PLY, OFF and 3MF in, the same out. All in the browser (3MF zip via fflate). */
(() => {
  const $ = (id) => document.getElementById(id);
  const drop = $("drop"), input = $("file"), msg = $("msg"), result = $("result"), fmt = $("format"), scaleIn = $("scale");
  const cv = $("view"), ctx = cv.getContext("2d");
  let mesh = null, baseName = "model", rot = { x: 0.6, y: 0.7 };

  const fail = (t) => { msg.textContent = t; msg.hidden = false; };
  const fmtN = (n) => n.toLocaleString("en-US");

  /* ---------- readers: each returns { p: Float32Array xyz, f: Uint32Array tri indices } ---------- */
  function fromSoup(p) { // unindexed triangles -> shared vertices
    const map = new Map(), out = [], f = new Uint32Array(p.length / 3);
    for (let i = 0; i < p.length; i += 3) {
      const k = p[i] + "," + p[i + 1] + "," + p[i + 2];
      let j = map.get(k);
      if (j === undefined) { j = out.length / 3; map.set(k, j); out.push(p[i], p[i + 1], p[i + 2]); }
      f[i / 3] = j;
    }
    return { p: new Float32Array(out), f };
  }

  function readSTL(buf) {
    const dv = new DataView(buf), n = buf.byteLength >= 84 ? dv.getUint32(80, true) : 0;
    const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(buf.byteLength, 512)));
    if (84 + n * 50 === buf.byteLength || !/^\s*solid[\s\S]*facet/i.test(head)) {
      if (84 + n * 50 > buf.byteLength) throw new Error("This STL file looks cut off.");
      const p = new Float32Array(n * 9);
      for (let t = 0; t < n; t++) for (let k = 0; k < 9; k++) p[t * 9 + k] = dv.getFloat32(84 + t * 50 + 12 + k * 4, true);
      return fromSoup(p);
    }
    const txt = new TextDecoder().decode(buf), p = [], re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/gi;
    let m; while ((m = re.exec(txt))) p.push(+m[1], +m[2], +m[3]);
    return fromSoup(new Float32Array(p.slice(0, p.length - (p.length % 9))));
  }

  function polys(p, faces) { // faces: arrays of vertex indices -> fan triangles
    const f = [];
    for (const v of faces) for (let i = 1; i + 1 < v.length; i++) f.push(v[0], v[i], v[i + 1]);
    return { p: new Float32Array(p), f: new Uint32Array(f) };
  }

  function readOBJ(txt) {
    const p = [], faces = [];
    for (const line of txt.split(/\r?\n/)) {
      const s = line.trim().split(/\s+/);
      if (s[0] === "v") p.push(+s[1], +s[2], +s[3]);
      else if (s[0] === "f") {
        const n = p.length / 3;
        faces.push(s.slice(1).map((x) => { const i = parseInt(x, 10); return i < 0 ? n + i : i - 1; }));
      }
    }
    return polys(p, faces);
  }

  function readOFF(txt) {
    const t = txt.replace(/#.*$/gm, "").trim().split(/\s+/);
    let i = /^[A-Z]*OFF$/.test(t[0]) ? 1 : 0;
    const nv = +t[i], nf = +t[i + 1]; i += 3;
    const p = [], faces = [];
    for (let v = 0; v < nv; v++, i += 3) p.push(+t[i], +t[i + 1], +t[i + 2]);
    for (let k = 0; k < nf; k++) { const c = +t[i]; faces.push(t.slice(i + 1, i + 1 + c).map(Number)); i += 1 + c; }
    return polys(p, faces);
  }

  function readPLY(buf) {
    const bytes = new Uint8Array(buf);
    const hdrEnd = new TextDecoder().decode(bytes.subarray(0, 4096)).indexOf("end_header");
    if (hdrEnd < 0) throw new Error("This PLY file has no header.");
    const header = new TextDecoder().decode(bytes.subarray(0, hdrEnd)).split(/\r?\n/);
    let off = hdrEnd + 10; if (bytes[off] === 13) off++; if (bytes[off] === 10) off++;
    let format = "ascii"; const els = [];
    for (const l of header) {
      const s = l.trim().split(/\s+/);
      if (s[0] === "format") format = s[1];
      else if (s[0] === "element") els.push({ name: s[1], count: +s[2], props: [] });
      else if (s[0] === "property" && els.length) els[els.length - 1].props.push(s[1] === "list" ? { list: true, ct: s[2], t: s[3], name: s[4] } : { t: s[1], name: s[2] });
    }
    const p = [], faces = [];
    if (format === "ascii") {
      const tok = new TextDecoder().decode(bytes.subarray(off)).trim().split(/\s+/); let i = 0;
      for (const e of els) for (let r = 0; r < e.count; r++) {
        const row = {};
        for (const pr of e.props) {
          if (pr.list) { const c = +tok[i++]; row[pr.name] = tok.slice(i, i + c).map(Number); i += c; } else row[pr.name] = +tok[i++];
        }
        take(e, row);
      }
    } else {
      const le = format === "binary_little_endian", dv = new DataView(buf); let o = off;
      const SZ = { char: 1, int8: 1, uchar: 1, uint8: 1, short: 2, int16: 2, ushort: 2, uint16: 2, int: 4, int32: 4, uint: 4, uint32: 4, float: 4, float32: 4, double: 8, float64: 8 };
      const rd = (t) => {
        let v;
        switch (t) {
          case "char": case "int8": v = dv.getInt8(o); break;
          case "uchar": case "uint8": v = dv.getUint8(o); break;
          case "short": case "int16": v = dv.getInt16(o, le); break;
          case "ushort": case "uint16": v = dv.getUint16(o, le); break;
          case "int": case "int32": v = dv.getInt32(o, le); break;
          case "uint": case "uint32": v = dv.getUint32(o, le); break;
          case "float": case "float32": v = dv.getFloat32(o, le); break;
          default: v = dv.getFloat64(o, le);
        }
        o += SZ[t]; return v;
      };
      for (const e of els) for (let r = 0; r < e.count; r++) {
        const row = {};
        for (const pr of e.props) {
          if (pr.list) { const c = rd(pr.ct), a = new Array(c); for (let k = 0; k < c; k++) a[k] = rd(pr.t); row[pr.name] = a; } else row[pr.name] = rd(pr.t);
        }
        take(e, row);
      }
    }
    function take(e, row) {
      if (e.name === "vertex") p.push(row.x, row.y, row.z);
      else if (e.name === "face") faces.push(row.vertex_indices || row.vertex_index || []);
    }
    return polys(p, faces);
  }

  function read3MF(buf) {
    if (!window.fflate) throw new Error("Couldn't load the 3MF reader. Reload and try again.");
    const files = fflate.unzipSync(new Uint8Array(buf));
    const name = Object.keys(files).find((k) => /\.model$/i.test(k));
    if (!name) throw new Error("No 3D model found inside this 3MF file.");
    const doc = new DOMParser().parseFromString(new TextDecoder().decode(files[name]), "application/xml");
    const objs = {};
    for (const o of doc.getElementsByTagNameNS("*", "object")) objs[o.getAttribute("id")] = o;
    const p = [], f = [];
    const mat = (s) => { const a = (s || "1 0 0 0 1 0 0 0 1 0 0 0").trim().split(/\s+/).map(Number); return a; };
    const mul = (a, b) => [ // 3MF 3x4 row-vector matrices: result = a then b
      a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
      a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
      a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
      a[9] * b[0] + a[10] * b[3] + a[11] * b[6] + b[9], a[9] * b[1] + a[10] * b[4] + a[11] * b[7] + b[10], a[9] * b[2] + a[10] * b[5] + a[11] * b[8] + b[11]];
    function add(id, m, depth) {
      const o = objs[id]; if (!o || depth > 16) return;
      const meshEl = o.getElementsByTagNameNS("*", "mesh")[0];
      if (meshEl) {
        const base = p.length / 3;
        for (const v of meshEl.getElementsByTagNameNS("*", "vertex")) {
          const x = +v.getAttribute("x"), y = +v.getAttribute("y"), z = +v.getAttribute("z");
          p.push(x * m[0] + y * m[3] + z * m[6] + m[9], x * m[1] + y * m[4] + z * m[7] + m[10], x * m[2] + y * m[5] + z * m[8] + m[11]);
        }
        for (const t of meshEl.getElementsByTagNameNS("*", "triangle")) f.push(base + +t.getAttribute("v1"), base + +t.getAttribute("v2"), base + +t.getAttribute("v3"));
      }
      for (const c of o.getElementsByTagNameNS("*", "component")) add(c.getAttribute("objectid"), mul(mat(c.getAttribute("transform")), m), depth + 1);
    }
    const items = doc.getElementsByTagNameNS("*", "item");
    if (items.length) for (const it of items) add(it.getAttribute("objectid"), mat(it.getAttribute("transform")), 0);
    else for (const id in objs) add(id, mat(), 0);
    return { p: new Float32Array(p), f: new Uint32Array(f) };
  }

  /* ---------- writers ---------- */
  const name = (mesh) => mesh.name || "model";
  function normal(p, a, b, c) {
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  }
  function writeSTL(m) {
    const n = m.f.length / 3, out = new ArrayBuffer(84 + n * 50), dv = new DataView(out);
    new Uint8Array(out).set(new TextEncoder().encode("Made with wezzet.com/3d").subarray(0, 80));
    dv.setUint32(80, n, true);
    for (let t = 0; t < n; t++) {
      const a = m.f[t * 3] * 3, b = m.f[t * 3 + 1] * 3, c = m.f[t * 3 + 2] * 3, o = 84 + t * 50, nn = normal(m.p, a, b, c);
      const v = [...nn, m.p[a], m.p[a + 1], m.p[a + 2], m.p[b], m.p[b + 1], m.p[b + 2], m.p[c], m.p[c + 1], m.p[c + 2]];
      for (let k = 0; k < 12; k++) dv.setFloat32(o + k * 4, v[k], true);
    }
    return out;
  }
  const num = (x) => +x.toPrecision(7);
  function writeSTLText(m) {
    const s = ["solid " + name(m)];
    for (let t = 0; t < m.f.length; t += 3) {
      const a = m.f[t] * 3, b = m.f[t + 1] * 3, c = m.f[t + 2] * 3, nn = normal(m.p, a, b, c);
      s.push(`facet normal ${nn.map(num).join(" ")}`, "outer loop");
      for (const i of [a, b, c]) s.push(`vertex ${num(m.p[i])} ${num(m.p[i + 1])} ${num(m.p[i + 2])}`);
      s.push("endloop", "endfacet");
    }
    s.push("endsolid " + name(m)); return s.join("\n") + "\n";
  }
  function writeOBJ(m) {
    const s = ["# Made with wezzet.com/3d"];
    for (let i = 0; i < m.p.length; i += 3) s.push(`v ${num(m.p[i])} ${num(m.p[i + 1])} ${num(m.p[i + 2])}`);
    for (let t = 0; t < m.f.length; t += 3) s.push(`f ${m.f[t] + 1} ${m.f[t + 1] + 1} ${m.f[t + 2] + 1}`);
    return s.join("\n") + "\n";
  }
  function writePLY(m) {
    const nv = m.p.length / 3, nf = m.f.length / 3;
    const head = new TextEncoder().encode(`ply\nformat binary_little_endian 1.0\ncomment Made with wezzet.com/3d\nelement vertex ${nv}\nproperty float x\nproperty float y\nproperty float z\nelement face ${nf}\nproperty list uchar int vertex_indices\nend_header\n`);
    const out = new ArrayBuffer(head.length + nv * 12 + nf * 13), dv = new DataView(out);
    new Uint8Array(out).set(head); let o = head.length;
    for (let i = 0; i < m.p.length; i++, o += 4) dv.setFloat32(o, m.p[i], true);
    for (let t = 0; t < m.f.length; t += 3) { dv.setUint8(o++, 3); for (let k = 0; k < 3; k++, o += 4) dv.setInt32(o, m.f[t + k], true); }
    return out;
  }
  function writeOFF(m) {
    const s = ["OFF", `${m.p.length / 3} ${m.f.length / 3} 0`];
    for (let i = 0; i < m.p.length; i += 3) s.push(`${num(m.p[i])} ${num(m.p[i + 1])} ${num(m.p[i + 2])}`);
    for (let t = 0; t < m.f.length; t += 3) s.push(`3 ${m.f[t]} ${m.f[t + 1]} ${m.f[t + 2]}`);
    return s.join("\n") + "\n";
  }
  function write3MF(m) {
    const v = [], t = [];
    for (let i = 0; i < m.p.length; i += 3) v.push(`<vertex x="${num(m.p[i])}" y="${num(m.p[i + 1])}" z="${num(m.p[i + 2])}"/>`);
    for (let i = 0; i < m.f.length; i += 3) t.push(`<triangle v1="${m.f[i]}" v2="${m.f[i + 1]}" v3="${m.f[i + 2]}"/>`);
    const enc = (s) => new TextEncoder().encode(s);
    return fflate.zipSync({
      "[Content_Types].xml": enc('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'),
      "_rels/.rels": enc('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
      "3D/3dmodel.model": enc(`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices>${v.join("")}</vertices><triangles>${t.join("")}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`),
    }, { level: 6 });
  }
  const WRITERS = {
    stl: [writeSTL, "stl", "model/stl"], "stl-ascii": [writeSTLText, "stl", "model/stl"], obj: [writeOBJ, "obj", "model/obj"],
    "3mf": [write3MF, "3mf", "model/3mf"], ply: [writePLY, "ply", "application/octet-stream"], off: [writeOFF, "off", "text/plain"],
  };

  /* ---------- facts and preview ---------- */
  function bounds(p) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { const v = p[i + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
    return { lo, hi };
  }
  function volume(m) {
    let v = 0; const p = m.p, f = m.f;
    for (let t = 0; t < f.length; t += 3) {
      const a = f[t] * 3, b = f[t + 1] * 3, c = f[t + 2] * 3;
      v += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
    }
    return Math.abs(v / 6);
  }
  function facts() {
    const s = +scaleIn.value || 1, b = bounds(mesh.p), d = (k) => +((b.hi[k] - b.lo[k]) * s).toFixed(2);
    $("r-tris").textContent = fmtN(mesh.f.length / 3);
    $("r-verts").textContent = fmtN(mesh.p.length / 3);
    $("r-size").textContent = `${d(0)} × ${d(1)} × ${d(2)}`;
    $("r-vol").textContent = `${+(volume(mesh) * s * s * s / 1000).toFixed(2)} cm³`;
  }

  let queued = false;
  function draw() {
    queued = false; if (!mesh) return;
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const { p, f } = mesh, b = bounds(p), c = [0, 1, 2].map((k) => (b.lo[k] + b.hi[k]) / 2);
    const r = Math.hypot(b.hi[0] - b.lo[0], b.hi[1] - b.lo[1], b.hi[2] - b.lo[2]) / 2 || 1, sc = Math.min(w, h) / 2.2 / r;
    const cx = Math.cos(rot.x), sx = Math.sin(rot.x), cy = Math.cos(rot.y), sy = Math.sin(rot.y);
    const n = p.length / 3, X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n);
    for (let i = 0; i < n; i++) { // z-up model: spin around z, then tilt
      const x = p[i * 3] - c[0], y = p[i * 3 + 1] - c[1], z = p[i * 3 + 2] - c[2];
      const x1 = x * cy - y * sy, y1 = x * sy + y * cy;
      X[i] = x1; Y[i] = z * cx - y1 * sx; Z[i] = z * sx + y1 * cx;
    }
    const nt = f.length / 3, step = Math.max(1, Math.ceil(nt / 150000)), list = [];
    for (let t = 0; t < nt; t += step) list.push(t);
    const depth = new Float32Array(nt);
    for (const t of list) depth[t] = Z[f[t * 3]] + Z[f[t * 3 + 1]] + Z[f[t * 3 + 2]];
    list.sort((a, b2) => depth[a] - depth[b2]);
    const dark = getComputedStyle(document.body).color.match(/\d+/g).slice(0, 3).reduce((s2, v) => s2 + +v, 0) > 380;
    for (const t of list) {
      const a = f[t * 3], b2 = f[t * 3 + 1], e = f[t * 3 + 2];
      const ux = X[b2] - X[a], uy = Y[b2] - Y[a], uz = Z[b2] - Z[a], vx = X[e] - X[a], vy = Y[e] - Y[a], vz = Z[e] - Z[a];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
      const light = Math.abs((nx * 0.3 + ny * 0.5 + nz * 0.8) / l);
      const g = Math.round((dark ? 70 : 120) + light * (dark ? 150 : 120));
      ctx.fillStyle = ctx.strokeStyle = `rgb(${g},${g},${g})`;
      ctx.beginPath();
      ctx.moveTo(w / 2 + X[a] * sc, h / 2 - Y[a] * sc); ctx.lineTo(w / 2 + X[b2] * sc, h / 2 - Y[b2] * sc); ctx.lineTo(w / 2 + X[e] * sc, h / 2 - Y[e] * sc);
      ctx.closePath(); ctx.fill(); if (nt < 20000) ctx.stroke();
    }
  }
  const redraw = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };
  let drag = null;
  cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    rot.y += (e.clientX - drag.x) * 0.01; rot.x += (e.clientY - drag.y) * 0.01; drag = { x: e.clientX, y: e.clientY }; redraw();
  });
  cv.addEventListener("pointerup", () => { drag = null; });
  window.addEventListener("resize", redraw);

  /* ---------- flow ---------- */
  async function open(file) {
    msg.hidden = true;
    const ext = (file.name.match(/\.(\w+)$/) || [, ""])[1].toLowerCase();
    try {
      const buf = await file.arrayBuffer(), txt = () => new TextDecoder().decode(buf);
      const m = ext === "stl" ? readSTL(buf) : ext === "obj" ? readOBJ(txt()) : ext === "ply" ? readPLY(buf) : ext === "off" ? readOFF(txt()) : ext === "3mf" ? read3MF(buf) : null;
      if (!m) return fail("Pick an STL, OBJ, 3MF, PLY or OFF file.");
      if (!m.f.length) return fail("No triangles found in this file.");
      const nv = m.p.length / 3;
      for (let i = 0; i < m.f.length; i++) if (!(m.f[i] < nv)) return fail("This file has faces that point to missing vertices.");
      mesh = m; baseName = file.name.replace(/\.\w+$/, "") || "model"; mesh.name = baseName.replace(/\s+/g, "_");
      $("r-name").textContent = file.name;
      if (fmt.value === ext && !fmt.dataset.fixed) fmt.value = ext === "stl" ? "obj" : "stl";
      result.hidden = false; drop.hidden = true; facts(); label(); redraw();
    } catch (e) {
      fail(e && e.message && !/^[A-Z][a-z]+Error/.test(String(e)) ? e.message : "Couldn't read this file. It may be damaged or an unusual variant.");
    }
  }
  function label() { $("download").textContent = `Download ${fmt.options[fmt.selectedIndex].dataset.short || fmt.value.toUpperCase()} file`; }
  fmt.addEventListener("change", label);
  scaleIn.addEventListener("input", () => mesh && facts());

  $("download").addEventListener("click", () => {
    if (!mesh) return;
    const s = +scaleIn.value || 1, m = s === 1 ? mesh : { name: mesh.name, f: mesh.f, p: mesh.p.map((v) => v * s) };
    const [fn, ext, type] = WRITERS[fmt.value];
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([fn(m)], { type })); a.download = `${baseName}.${ext}`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    } catch (e) { fail("Couldn't make the file. The model may be too big for this browser."); }
  });
  $("again").addEventListener("click", () => { mesh = null; result.hidden = true; drop.hidden = false; input.value = ""; msg.hidden = true; });

  $("choose").addEventListener("click", () => input.click());
  input.addEventListener("change", () => input.files[0] && open(input.files[0]));
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("dragging"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("dragging"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("dragging"); e.dataTransfer.files[0] && open(e.dataTransfer.files[0]); });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => { e.preventDefault(); if (!drop.hidden && e.dataTransfer.files[0]) open(e.dataTransfer.files[0]); });
})();
