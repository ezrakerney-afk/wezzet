/* Wezzet niche converters for /convert. Everything runs in memory in the browser; nothing is stored or uploaded. */
window.wzMore = async (f, e, add, save, note) => {
  const base = f.name.replace(/\.[^.]+$/, "") || "file";
  const T = (d, x, type = "text/plain") => save(d, base + "." + x, type);
  const J = (o, x = "json") => T(JSON.stringify(o, null, 2), x, "application/json");
  const text = () => f.text();
  // CSV parser that handles quotes
  const csv = (s, sep = ",") => { const rows = [[]]; let c = "", q = false; for (let i = 0; i < s.length; i++) { const ch = s[i]; if (q) { if (ch === '"' && s[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; } else if (ch === '"') q = true; else if (ch === sep) { rows.at(-1).push(c); c = ""; } else if (ch === "\n") { rows.at(-1).push(c.replace(/\r$/, "")); rows.push([]); c = ""; } else c += ch; } rows.at(-1).push(c); return rows.filter((r) => r.some((v) => v !== "")); };
  const toObjs = (rows) => rows.slice(1).map((r) => Object.fromEntries(rows[0].map((h, i) => [h, r[i] ?? ""])));
  const cell = (v) => (/[",\n]/.test(v = String(v ?? "")) ? `"${v.replace(/"/g, '""')}"` : v);
  const toCsv = (objs, sep = ",") => { const h = [...new Set(objs.flatMap((o) => Object.keys(o)))]; return [h, ...objs.map((o) => h.map((k) => (typeof o[k] === "object" && o[k] ? JSON.stringify(o[k]) : o[k])))].map((r) => r.map(sep === "," ? cell : (v) => String(v ?? "")).join(sep)).join("\n"); };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const xml = (s) => new DOMParser().parseFromString(s, "application/xml");
  const x2j = (n) => { const o = {}; for (const a of n.attributes || []) o["@" + a.name] = a.value; for (const c of n.children) { const v = c.children.length || c.attributes.length ? x2j(c) : c.textContent; o[c.tagName] = o[c.tagName] === undefined ? v : [].concat(o[c.tagName], v); } return o; };
  const j2x = (o, t = "root") => Array.isArray(o) ? o.map((v) => j2x(v, t)).join("") : typeof o === "object" && o ? `<${t}>${Object.entries(o).map(([k, v]) => j2x(v, k.replace(/[^\w.-]/g, "_"))).join("")}</${t}>` : `<${t}>${esc(o)}</${t}>`;
  const yaml = (o, ind = "") => Array.isArray(o) ? o.map((v) => `${ind}- ${typeof v === "object" && v ? "\n" + yaml(v, ind + "  ") : JSON.stringify(v)}`).join("\n") : Object.entries(o || {}).map(([k, v]) => `${ind}${k}:${typeof v === "object" && v ? "\n" + yaml(v, ind + "  ") : " " + JSON.stringify(v)}`).join("\n");
  const kv = (s) => Object.fromEntries(s.split(/\r?\n/).filter((l) => /^\s*[^#;\[].*=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
  const ts = (t, vtt) => t.replace(/(\d\d:\d\d:\d\d)[,.](\d\d\d)/g, `$1${vtt ? "." : ","}$2`);

  // Data and tables
  if (/^(csv|tsv)$/.test(e)) {
    const rows = csv(await text(), e === "tsv" ? "\t" : ","), objs = toObjs(rows);
    add("CSV to JSON", () => J(objs));
    add("CSV to JSON Lines", () => T(objs.map((o) => JSON.stringify(o)).join("\n"), "jsonl"));
    add(e === "tsv" ? "TSV to CSV" : "CSV to TSV", () => T(rows.map((r) => r.map(e === "tsv" ? cell : (v) => v).join(e === "tsv" ? "," : "\t")).join("\n"), e === "tsv" ? "csv" : "tsv"));
    add("CSV to HTML table", () => T(`<table border="1">${rows.map((r, i) => `<tr>${r.map((v) => `<t${i ? "d" : "h"}>${esc(v)}</t${i ? "d" : "h"}>`).join("")}</tr>`).join("\n")}</table>`, "html", "text/html"));
    add("CSV to Markdown table", () => T([rows[0], rows[0].map(() => "---"), ...rows.slice(1)].map((r) => "| " + r.join(" | ") + " |").join("\n"), "md"));
    add("CSV to SQL inserts", () => T(rows.slice(1).map((r) => `INSERT INTO ${base.replace(/\W/g, "_")} (${rows[0].join(", ")}) VALUES (${r.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ")});`).join("\n"), "sql"));
    add("CSV to XML", () => T(j2x({ row: objs }, "rows"), "xml", "application/xml"));
    add("CSV to YAML", () => T(yaml(objs), "yaml"));
    add("CSV to vCard contacts", () => T(objs.map((o) => { const g = (re) => Object.entries(o).find(([k]) => re.test(k))?.[1] || ""; return `BEGIN:VCARD\nVERSION:3.0\nFN:${g(/name/i)}\nTEL:${g(/phone|tel/i)}\nEMAIL:${g(/mail/i)}\nEND:VCARD`; }).join("\n"), "vcf", "text/vcard"));
  }
  if (/^(json|geojson)$/.test(e)) {
    let o; try { o = JSON.parse(await text()); } catch (er) { note("That JSON couldn't be read: " + er.message); }
    if (o !== undefined) {
      const arr = Array.isArray(o) ? o : o.features || o.data || o.items || [o];
      add("JSON to CSV", () => T(toCsv(arr.map((x) => (x && x.properties ? { ...x.properties, geometry: x.geometry } : x))), "csv"));
      add("JSON to YAML", () => T(yaml(o), "yaml"));
      add("JSON to XML", () => T(j2x(o), "xml", "application/xml"));
      add("JSON to JSON Lines", () => T(arr.map((x) => JSON.stringify(x)).join("\n"), "jsonl"));
      add("Minify JSON", () => T(JSON.stringify(o), "min.json", "application/json"));
      add("Pretty-print JSON", () => J(o, "pretty.json"));
      add("JSON to .env", () => T(Object.entries(o).map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`).join("\n"), "env"));
      add("JSON to TypeScript type", () => { const ty = (v, i = "") => Array.isArray(v) ? (v.length ? ty(v[0], i) : "unknown") + "[]" : v === null ? "null" : typeof v === "object" ? `{\n${Object.entries(v).map(([k, x]) => `${i}  ${JSON.stringify(k)}: ${ty(x, i + "  ")};`).join("\n")}\n${i}}` : typeof v; T(`type Root = ${ty(o)};\n`, "ts"); });
    }
  }
  if (e === "jsonl" || e === "ndjson") { const a = (await text()).split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)); add("JSON Lines to JSON", () => J(a)); add("JSON Lines to CSV", () => T(toCsv(a), "csv")); }
  if (e === "xml" || e === "plist" || e === "rss" || e === "atom") { const d = xml(await text()); add("XML to JSON", () => J({ [d.documentElement.tagName]: x2j(d.documentElement) })); if (d.querySelector("item,entry")) add("Feed to CSV", () => T(toCsv([...d.querySelectorAll("item,entry")].map((i) => ({ title: i.querySelector("title")?.textContent, link: i.querySelector("link")?.textContent || i.querySelector("link")?.getAttribute("href"), date: i.querySelector("pubDate,updated,published")?.textContent }))), "csv")); }
  if (/^(ini|env|cfg|conf|properties)$/.test(e)) { const o = kv(await text()); add("To JSON", () => J(o)); add("To YAML", () => T(yaml(o), "yaml")); }
  if (e === "yaml" || e === "yml") { const o = {}; (await text()).split(/\r?\n/).forEach((l) => { const m = l.match(/^([\w.-]+):\s*(.+)$/); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ""); }); add("YAML (flat) to JSON", () => J(o)); add("YAML (flat) to .env", () => T(Object.entries(o).map(([k, v]) => `${k}=${v}`).join("\n"), "env")); }
  if (e === "sql") { const t = await text(); add("SQL inserts to CSV", () => T([...t.matchAll(/VALUES\s*\((.+?)\);/gi)].map((m) => m[1].split(/,(?=(?:[^']*'[^']*')*[^']*$)/).map((v) => cell(v.trim().replace(/^'|'$/g, "").replace(/''/g, "'")))).map((r) => r.join(",")).join("\n"), "csv")); }

  // Subtitles
  if (e === "srt") { const t = await text(); add("SRT to VTT", () => T("WEBVTT\n\n" + ts(t, 1), "vtt", "text/vtt")); add("Subtitles to plain text", () => T(t.split(/\r?\n/).filter((l) => !/^\d+$|-->|^\s*$/.test(l)).join("\n"), "txt")); }
  if (e === "vtt") { const t = await text(); let n = 0; add("VTT to SRT", () => T(ts(t.replace(/^WEBVTT.*\n+/, ""), 0).split(/\n\s*\n/).filter((b) => b.includes("-->")).map((b) => `${++n}\n${b.replace(/^.*?(?=\d\d:\d\d)/s, "")}`).join("\n\n"), "srt")); add("Subtitles to plain text", () => T(t.split(/\r?\n/).filter((l) => !/^WEBVTT|-->|^\s*$|^\d+$/.test(l)).join("\n"), "txt")); }
  if (e === "lrc") { const t = await text(); add("Lyrics timing to plain text", () => T(t.replace(/\[[^\]]*\]/g, "").trim(), "txt")); }

  // Contacts, calendars, maps, playlists, bookmarks
  if (e === "vcf") { const t = await text(); add("vCard to CSV", () => T(toCsv(t.split(/END:VCARD/i).filter((c) => /FN|N:/.test(c)).map((c) => { const g = (k) => (c.match(new RegExp("^" + k + "[^:]*:(.*)$", "mi")) || [])[1] || ""; return { name: g("FN"), phone: g("TEL"), email: g("EMAIL"), org: g("ORG") }; })), "csv")); }
  if (e === "ics") { const t = await text(); add("Calendar to CSV", () => T(toCsv(t.split("BEGIN:VEVENT").slice(1).map((v) => { const g = (k) => (v.match(new RegExp("^" + k + "[^:]*:(.*)$", "m")) || [])[1] || ""; return { title: g("SUMMARY"), start: g("DTSTART"), end: g("DTEND"), location: g("LOCATION") }; })), "csv")); }
  if (e === "gpx" || e === "kml") { const d = xml(await text()); const pts = e === "gpx" ? [...d.querySelectorAll("trkpt,wpt,rtept")].map((p) => [+p.getAttribute("lon"), +p.getAttribute("lat")]) : [...d.querySelectorAll("coordinates")].flatMap((c) => c.textContent.trim().split(/\s+/).map((x) => x.split(",").slice(0, 2).map(Number))); add("To GeoJSON", () => J({ type: "FeatureCollection", features: [{ type: "Feature", properties: { name: base }, geometry: { type: "LineString", coordinates: pts } }] }, "geojson")); add("To CSV of points", () => T("lon,lat\n" + pts.map((p) => p.join(",")).join("\n"), "csv")); if (e === "gpx") add("GPX to KML", () => T(`<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><LineString><coordinates>${pts.map((p) => p.join(",")).join(" ")}</coordinates></LineString></Placemark></kml>`, "kml")); else add("KML to GPX", () => T(`<?xml version="1.0"?><gpx version="1.1" creator="wezzet"><trk><trkseg>${pts.map(([lo, la]) => `<trkpt lat="${la}" lon="${lo}"/>`).join("")}</trkseg></trk></gpx>`, "gpx")); }
  if (/^(m3u|m3u8|pls)$/.test(e)) { const l = (await text()).split(/\r?\n/).map((x) => x.replace(/^File\d+=/, "")).filter((x) => x && !/^#|^\[|=/.test(x)); add("Playlist to text list", () => T(l.join("\n"), "txt")); add("Playlist to M3U", () => T("#EXTM3U\n" + l.join("\n"), "m3u")); }
  if (e === "opml") { const d = xml(await text()); add("OPML feeds to CSV", () => T(toCsv([...d.querySelectorAll("outline[xmlUrl]")].map((o) => ({ title: o.getAttribute("title") || o.getAttribute("text"), feed: o.getAttribute("xmlUrl"), site: o.getAttribute("htmlUrl") }))), "csv")); }
  if (/^html?$/.test(e)) { const d = new DOMParser().parseFromString(await text(), "text/html"), a = [...d.querySelectorAll("a[href]")]; if (a.length) add("Links/bookmarks to CSV", () => T(toCsv(a.map((x) => ({ title: x.textContent.trim(), url: x.getAttribute("href") }))), "csv")); const tb = d.querySelector("table"); if (tb) add("First table to CSV", () => T([...tb.rows].map((r) => [...r.cells].map((c) => cell(c.textContent.trim())).join(",")).join("\n"), "csv")); }
  if (e === "css") { const t = await text(); add("Minify CSS", () => T(t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}:;,])\s*/g, "$1"), "min.css", "text/css")); }
  if (e === "md" || e === "markdown") { const t = await text(); add("Markdown headings to outline", () => T(t.split("\n").filter((l) => /^#+ /.test(l)).map((l) => "  ".repeat(l.match(/^#+/)[0].length - 1) + "- " + l.replace(/^#+ /, "")).join("\n"), "outline.txt")); }
  if (e === "rtf") { const t = await text(); add("RTF to plain text", () => T(t.replace(/\\par[d]?/g, "\n").replace(/\{\*?\\[^{}]+}|[{}]|\\[a-z]+-?\d* ?/gi, "").trim(), "txt")); }
  if (e === "eml") { const t = await text(), b = t.split(/\r?\n\r?\n/); add("Email to plain text", () => T(b.slice(1).join("\n\n"), "txt")); add("Email headers to JSON", () => J(Object.fromEntries(b[0].split(/\r?\n(?!\s)/).map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()])))); }

  // Apple Shortcuts (.shortcut) and binary plists
  if (e === "shortcut" || e === "plist" || e === "wflow") {
    const u = new Uint8Array(await f.arrayBuffer()), head = String.fromCharCode(...u.slice(0, 8));
    if (head.startsWith("AEA1")) note("This is a signed Apple Shortcut. Its actions are encrypted by Apple, so only Shortcuts can read them, but here's what Wezzet can pull out.");
    const bp = head.startsWith("bplist00") ? bplist(u) : null;
    if (bp) {
      const acts = (bp.WFWorkflowActions || []).map((a) => a.WFWorkflowActionIdentifier?.replace(/^is\.workflow\.actions\./, ""));
      if (acts.length) note(`${acts.length} actions: ${acts.slice(0, 12).join(", ")}${acts.length > 12 ? "…" : ""}`);
      add("Shortcut/plist to JSON", () => J(bp));
      add("Action list to text", () => T(acts.join("\n") || "(no actions)", "actions.txt"));
      add("Plist to XML plist", () => T(`<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">${p2x(bp)}</plist>\n`, "xml.plist", "application/xml"));
    }
    const strs = (new TextDecoder("latin1").decode(u).match(/[\x20-\x7e]{6,}/g) || []);
    add("Readable strings to text", () => T(strs.join("\n"), "strings.txt"));
    const urls = strs.join(" ").match(/https?:\/\/[^\s"'<>]+/g);
    if (urls) add("Links inside to text", () => T([...new Set(urls)].join("\n"), "links.txt"));
  }

  // Images via canvas
  if (/^(svg|png|jpe?g|webp|gif|bmp)$/.test(e)) {
    const img = new Image(), url = URL.createObjectURL(f); img.src = url; await img.decode().catch(() => {});
    const draw = (w, h, type, x) => { const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h); c.toBlob((b) => T(b, x, type), type); };
    if (img.naturalWidth) {
      if (e === "svg") { add("SVG to PNG (2x)", () => draw(img.naturalWidth * 2, img.naturalHeight * 2, "image/png", "png")); add("SVG to JPG", () => draw(img.naturalWidth * 2, img.naturalHeight * 2, "image/jpeg", "jpg")); }
      add("Image to ICO (256px)", () => { const c = document.createElement("canvas"); c.width = c.height = 256; c.getContext("2d").drawImage(img, 0, 0, 256, 256); c.toBlob(async (b) => { const p = new Uint8Array(await b.arrayBuffer()), h = new DataView(new ArrayBuffer(22)); h.setUint16(2, 1, 1); h.setUint16(4, 1, 1); h.setUint16(10, 1, 1); h.setUint16(12, 32, 1); h.setUint32(14, p.length, 1); h.setUint32(18, 22, 1); T(new Blob([h, p], { type: "image/x-icon" }), "ico"); }, "image/png"); });
      add("Image to ASCII art", () => { const w = 100, h = Math.round((img.naturalHeight / img.naturalWidth) * w * 0.5), c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.drawImage(img, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data, ch = "@%#*+=-:. "; let s = ""; for (let y = 0; y < h; y++) { for (let i = 0; i < w; i++) { const k = (y * w + i) * 4; s += ch[Math.floor(((d[k] + d[k + 1] + d[k + 2]) / 765) * (ch.length - 1))]; } s += "\n"; } T(s, "ascii.txt"); });
      add("Image to SVG wrapper", () => { const r = new FileReader(); r.onload = () => T(`<svg xmlns="http://www.w3.org/2000/svg" width="${img.naturalWidth}" height="${img.naturalHeight}"><image href="${r.result}" width="100%" height="100%"/></svg>`, "svg", "image/svg+xml"); r.readAsDataURL(f); });
      add("Image to grayscale PNG", () => { const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext("2d"); x.filter = "grayscale(1)"; x.drawImage(img, 0, 0); c.toBlob((b) => T(b, "gray.png", "image/png"), "image/png"); });
    }
  }

  // Fun text conversions for any text file
  if (f.size < 2e6 && (f.type.startsWith("text/") || /^(txt|text|md)$/.test(e))) {
    const t = await text();
    const M = { a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....", i: "..", j: ".---", k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.", q: "--.-", r: ".-.", s: "...", t: "-", u: "..-", v: "...-", w: ".--", x: "-..-", y: "-.--", z: "--..", 0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----." };
    const NATO = "Alfa Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliett Kilo Lima Mike November Oscar Papa Quebec Romeo Sierra Tango Uniform Victor Whiskey Xray Yankee Zulu".split(" ");
    const flip = { a: "ɐ", b: "q", c: "ɔ", d: "p", e: "ǝ", f: "ɟ", g: "ƃ", h: "ɥ", i: "ᴉ", j: "ɾ", k: "ʞ", l: "l", m: "ɯ", n: "u", o: "o", p: "d", q: "b", r: "ɹ", s: "s", t: "ʇ", u: "n", v: "ʌ", w: "ʍ", y: "ʎ", ".": "˙", ",": "'", "?": "¿", "!": "¡" };
    add("Text to Morse code", () => T([...t.toLowerCase()].map((c) => M[c] || (c === " " ? "/" : c)).join(" "), "morse.txt"));
    add("Text to binary", () => T([...new TextEncoder().encode(t)].map((b) => b.toString(2).padStart(8, "0")).join(" "), "binary.txt"));
    add("Text to NATO alphabet", () => T([...t.toLowerCase()].map((c) => (c >= "a" && c <= "z" ? NATO[c.charCodeAt(0) - 97] : c)).join(" "), "nato.txt"));
    add("Text to ROT13", () => T(t.replace(/[a-z]/gi, (c) => String.fromCharCode(((c.charCodeAt(0) - (c < "a" ? 65 : 97) + 13) % 26) + (c < "a" ? 65 : 97))), "rot13.txt"));
    add("Text upside down", () => T([...t.toLowerCase()].map((c) => flip[c] || c).reverse().join(""), "flipped.txt"));
    add("Text to Braille", () => T([...t.toLowerCase()].map((c) => "⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚⠅⠇⠍⠝⠕⠏⠟⠗⠎⠞⠥⠧⠺⠭⠽⠵"[c.charCodeAt(0) - 97] || c).join(""), "braille.txt"));
    add("Text to leetspeak", () => T(t.replace(/[aeiost]/gi, (c) => ({ a: "4", e: "3", i: "1", o: "0", s: "5", t: "7" })[c.toLowerCase()]), "leet.txt"));
    add("Text to URL-encoded", () => T(encodeURIComponent(t), "urlencoded.txt"));
    add("Text to HTML entities", () => T([...t].map((c) => (c.charCodeAt(0) > 127 || /[<>&"']/.test(c) ? `&#${c.codePointAt(0)};` : c)).join(""), "entities.txt"));
    add("Text to Unicode code points", () => T([...t].map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")).join(" "), "codepoints.txt"));
    add("Text to word frequency CSV", () => { const m = {}; (t.toLowerCase().match(/[\p{L}']+/gu) || []).forEach((w) => (m[w] = (m[w] || 0) + 1)); T("word,count\n" + Object.entries(m).sort((a, b) => b[1] - a[1]).map((x) => x.join(",")).join("\n"), "words.csv"); });
    add("Lines to JSON array", () => J(t.split(/\r?\n/).filter(Boolean), "lines.json"));
    add("Sort lines A to Z", () => T(t.split(/\r?\n/).sort((a, b) => a.localeCompare(b)).join("\n"), "sorted.txt"));
  }

  // Hashes and encodings for any file
  for (const alg of ["SHA-1", "SHA-256", "SHA-512"]) add(alg + " checksum", async () => { const h = [...new Uint8Array(await crypto.subtle.digest(alg, await f.arrayBuffer()))].map((b) => b.toString(16).padStart(2, "0")).join(""); note(`${alg}: ${h}`); });
  add("To data URI", () => { const r = new FileReader(); r.onload = () => save(r.result, f.name + ".datauri.txt", "text/plain"); r.readAsDataURL(f); });
  add("To C byte array", async () => { const u = new Uint8Array(await f.slice(0, 1e6).arrayBuffer()); save(`unsigned char ${base.replace(/\W/g, "_")}[${u.length}] = {${[...u].map((b) => "0x" + b.toString(16).padStart(2, "0")).join(",")}};\n`, base + ".h", "text/plain"); });
  add("To gzip (.gz)", async () => save(await new Response(f.stream().pipeThrough(new CompressionStream("gzip"))).blob(), f.name + ".gz", "application/gzip"));
  if (e === "gz") add("Unzip .gz", async () => save(await new Response(f.stream().pipeThrough(new DecompressionStream("gzip"))).blob(), f.name.replace(/\.gz$/i, ""), "application/octet-stream"));

  // Minimal binary plist reader (Apple's bplist00 format)
  function bplist(u) {
    try {
      const v = new DataView(u.buffer, u.byteOffset), n = u.length, os = u[n - 26], rs = u[n - 25];
      const num = (p, s) => { let x = 0; for (let i = 0; i < s; i++) x = x * 256 + u[p + i]; return x; };
      const count = Number(v.getBigUint64(n - 24)), top = Number(v.getBigUint64(n - 16)), tbl = Number(v.getBigUint64(n - 8));
      const off = (i) => num(tbl + i * os, os), seen = new Set();
      const obj = (i) => {
        if (i >= count || seen.size > 1e5) return null;
        let p = off(i); const m = u[p] >> 4, l0 = u[p] & 15; p++;
        const len = () => { if (l0 < 15) return l0; const s = 1 << (u[p] & 15); const x = num(p + 1, s); p += 1 + s; return x; };
        if (m === 0) return l0 === 8 ? false : l0 === 9 ? true : null;
        if (m === 1) return num(p, 1 << l0);
        if (m === 2) return l0 === 3 ? v.getFloat64(p) : v.getFloat32(p);
        if (m === 3) return new Date((v.getFloat64(p) + 978307200) * 1000).toISOString();
        const L = len();
        if (m === 4) return `<${L} bytes>`;
        if (m === 5) return new TextDecoder("latin1").decode(u.slice(p, p + L));
        if (m === 6) return new TextDecoder("utf-16be").decode(u.slice(p, p + L * 2));
        if (m === 8) return num(p, L + 1);
        if (m === 10) return Array.from({ length: L }, (_, k) => obj(num(p + k * rs, rs)));
        if (m === 13) { const o = {}; for (let k = 0; k < L; k++) o[obj(num(p + k * rs, rs))] = obj(num(p + (L + k) * rs, rs)); return o; }
        return null;
      };
      return obj(top);
    } catch (er) { return null; }
  }
  function p2x(o) { if (Array.isArray(o)) return `<array>${o.map(p2x).join("")}</array>`; if (o && typeof o === "object") return `<dict>${Object.entries(o).map(([k, x]) => `<key>${esc(k)}</key>${p2x(x)}`).join("")}</dict>`; if (typeof o === "boolean") return o ? "<true/>" : "<false/>"; if (typeof o === "number") return Number.isInteger(o) ? `<integer>${o}</integer>` : `<real>${o}</real>`; return `<string>${esc(o ?? "")}</string>`; }
};
