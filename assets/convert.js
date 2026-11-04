/* Wezzet universal converter: drop any file, see every tool that can open it, and carry the file there. */
(() => {
  const $ = (id) => document.getElementById(id);
  const drop = $("drop"), input = $("files"), out = $("out");
  const IMG = "jpg jpeg png webp avif gif bmp heic heif svg ico tif tiff";
  const VID = "mp4 mov m4v mkv webm avi wmv flv 3gp mpg mpeg ts mts";
  const AUD = "mp3 wav m4a aac ogg oga opus flac wma aiff aif amr";
  const EMB = "pes dst jef exp vp3 xxx hus pec sew vip vp4 u01 shv dsb dsz tbf 10o 100 ksm pcs pcm pcq jpx stx zhs";
  const SHEET = "xlsx xls xlsm xlsb ods numbers fods";
  // [extensions, tools: [label, path, query]]
  const ROUTES = [
    [IMG, [["Convert to JPG, PNG or WebP", "/image"], ["Resize", "/resize"], ["Compress to a file size", "/compress"], ["Remove the background", "/remove-bg"], ["Put into a PDF", "/jpg-to-pdf"], ["Make a favicon", "/favicon"]]],
    ["pdf", [["Split, extract or rotate pages", "/split-pdf"], ["Turn pages into JPGs", "/pdf-to-jpg"], ["Compress the PDF", "/compress-pdf"], ["Copy out the text", "/pdf-to-text"], ["Sign it", "/sign-pdf"], ["Merge with other PDFs", "/pdf"]]],
    [VID, [["Convert to MP4", "/video", "mp4"], ["Make it smaller (MP4)", "/video", "mp4-small"], ["Extract the audio as MP3", "/mp3"], ["Turn into a GIF", "/gif"], ["Convert to WebM", "/video", "webm"]]],
    [AUD, [["Convert to MP3", "/mp3"], ["Convert to M4A", "/video", "m4a"], ["Convert to WAV", "/video", "wav"], ["Convert to OGG", "/video", "ogg"]]],
    [EMB, [["Convert embroidery file", "/embroidery"]]],
    [SHEET, [["Convert to CSV, JSON or YAML", "/data"]]],
    ["csv tsv", [["Convert to JSON or YAML", "/data"]]],
    ["json yaml yml", [["Convert to CSV, JSON or YAML", "/data"], ["Format JSON", "/json"]]],
    ["zip", [["Open the zip", "/zip"]]],
  ].map(([exts, tools]) => [new Set(exts.split(" ")), tools]);

  const ext = (f) => ((f.name.match(/\.([^.]+)$/) || [])[1] || "").toLowerCase();
  function guess(f) {
    const e = ext(f);
    for (const [set, tools] of ROUTES) if (set.has(e)) return tools;
    if (f.type.startsWith("image/")) return ROUTES[0][1];
    if (f.type.startsWith("video/")) return ROUTES[2][1];
    if (f.type.startsWith("audio/")) return ROUTES[3][1];
    return null;
  }

  async function go(files, path, to) {
    try { await wzHandoff.put(files); } catch (e) { location.href = path + (to ? `?to=${to}` : ""); return; }
    location.href = path + "?" + (to ? `to=${to}&` : "") + "handoff=1";
  }

  function show(files) {
    out.textContent = "";
    const first = files[0], tools = guess(first);
    const h = document.createElement("h2");
    h.textContent = files.length > 1 ? `${files.length} files (${first.name} and more)` : first.name;
    out.append(h);
    const box = document.createElement("div"); box.className = "row-actions";
    if (tools) {
      tools.forEach(([label, path, to], i) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "btn" + (i ? " btn-quiet" : ""); b.textContent = label;
        b.addEventListener("click", () => go(files, path, to));
        box.append(b);
      });
    } else {
      const p = document.createElement("p");
      p.textContent = `No dedicated tool for .${ext(first) || "this kind of"} files yet, but you can convert it below.`;
      out.append(p);
    }
    const z = document.createElement("button");
    z.type = "button"; z.className = "btn btn-quiet"; z.textContent = "Zip it";
    z.addEventListener("click", () => go(files, "/zip"));
    const ask = document.createElement("a"); ask.className = "btn btn-quiet"; ask.href = "/forum"; ask.textContent = "Request a converter";
    box.append(z); if (!tools) box.append(ask);
    out.append(box);
    extra(first);
  }

  // Built-in conversions for any file, so nothing is a dead end. Everything stays in memory; nothing is stored.
  const TXT = new Set("txt text md markdown html htm xhtml xml css js mjs ts json csv tsv yaml yml log ini cfg conf toml rtf srt vtt sql py rb java c cpp h cs go rs php sh bat ps1 url webloc desktop env tex".split(" "));
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const save = (data, name, type) => { const a = document.createElement("a"), u = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type })); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 5000); };
  const md2html = (t) => esc(t).replace(/^### (.*)$/gm, "<h3>$1</h3>").replace(/^## (.*)$/gm, "<h2>$1</h2>").replace(/^# (.*)$/gm, "<h1>$1</h1>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>").replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>').replace(/^[-*] (.*)$/gm, "<li>$1</li>").replace(/\n{2,}/g, "<br><br>");
  const page = (title, body) => `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><body style="font:16px/1.5 system-ui;max-width:760px;margin:40px auto;padding:0 16px">${body}</body>`;
  const parse = (h) => { const d = new DOMParser().parseFromString(h, "text/html"); d.querySelectorAll("script,style").forEach((n) => n.remove()); return d; };
  function html2text(h) { const d = parse(h); d.querySelectorAll("br,p,div,li,h1,h2,h3,h4,tr").forEach((n) => n.append("\n")); return (d.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim(); }
  function html2md(h) { const w = (n) => [...n.childNodes].map(md).join(""); const md = (n) => { if (n.nodeType === 3) return n.textContent; const t = n.tagName; if (!t) return ""; const i = w(n); return ({ H1: `\n# ${i}\n`, H2: `\n## ${i}\n`, H3: `\n### ${i}\n`, P: `\n${i}\n`, BR: "\n", LI: `\n- ${i}`, B: `**${i}**`, STRONG: `**${i}**`, I: `*${i}*`, EM: `*${i}*`, A: `[${i}](${n.getAttribute("href") || ""})`, IMG: `![${n.alt || ""}](${n.getAttribute("src") || ""})` })[t] ?? i; }; return w(parse(h).body).replace(/\n{3,}/g, "\n\n").trim(); }
  function lnkTarget(b) { const u = new Uint8Array(b); let best = "", cur = ""; for (const c of u) { if (c >= 32 && c < 127) cur += String.fromCharCode(c); else { if (/^[a-z]:\|^\\|^https?:/i.test(cur) && cur.length > best.length) best = cur; cur = ""; } } return best; }
  function printPdf(title, body) { const w = window.open(""); if (!w) return; w.document.write(page(title, body) + "<script>onload=()=>print()<\/script>"); w.document.close(); }

  async function extra(f) {
    const e = ext(f), base = f.name.replace(/\.[^.]+$/, "") || "file", acts = [];
    const add = (label, fn) => acts.push([label, fn]);
    const note = (t) => { const p = document.createElement("p"); p.textContent = t; out.append(p); };
    if (e === "lnk") {
      const t = lnkTarget(await f.arrayBuffer());
      note(t ? `This Windows shortcut points to: ${t}` : "This Windows shortcut has no readable target.");
      if (t) { add("Save target as .txt", () => save(t, base + ".txt", "text/plain")); if (/^https?:/i.test(t)) add("Convert to .url", () => save(`[InternetShortcut]\r\nURL=${t}\r\n`, base + ".url", "text/plain")); }
    } else if (TXT.has(e) || f.type.startsWith("text/") || (!guess(f) && f.size < 5e6 && !/[\x00-\x08]/.test(await f.slice(0, 4096).text()))) {
      const t = await f.text(), isH = /^(html?|xhtml)$/.test(e), isM = /^(md|markdown)$/.test(e);
      const link = (t.match(/^URL=(.+)$/m) || t.match(/<string>(https?:[^<]+)<\/string>/) || [])[1];
      if (/^(url|webloc|desktop)$/.test(e) && link) {
        note(`This shortcut opens: ${link}`);
        add("Convert to .url (Windows)", () => save(`[InternetShortcut]\r\nURL=${link}\r\n`, base + ".url", "text/plain"));
        add("Convert to .webloc (Mac)", () => save(`<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>URL</key><string>${esc(link)}</string></dict></plist>\n`, base + ".webloc", "application/xml"));
        add("Convert to .desktop (Linux)", () => save(`[Desktop Entry]\nType=Link\nName=${base}\nURL=${link}\n`, base + ".desktop", "text/plain"));
        add("Convert to .html link", () => save(page(base, `<meta http-equiv="refresh" content="0;url=${esc(link)}"><a href="${esc(link)}">${esc(link)}</a>`), base + ".html", "text/html"));
      }
      const body = isH ? parse(t).body.innerHTML : isM ? md2html(t) : `<pre style="white-space:pre-wrap">${esc(t)}</pre>`;
      add("Convert to PDF", () => printPdf(base, body));
      add("Convert to .txt", () => save(isH ? html2text(t) : t, base + ".txt", "text/plain"));
      if (!isH) add("Convert to .html", () => save(page(base, body), base + ".html", "text/html"));
      add("Convert to .md", () => save(isH ? html2md(t) : t, base + ".md", "text/markdown"));
      add("Convert to Word (.doc)", () => save(page(base, body), base + ".doc", "application/msword"));
      add("Convert to .json", () => save(JSON.stringify({ name: f.name, text: t }, null, 2), base + ".json", "application/json"));
    }
    if (window.wzMore) await wzMore(f, e, add, save, note);
    add("Convert to Base64", () => { const r = new FileReader(); r.onload = () => save(r.result.split(",")[1], f.name + ".base64.txt", "text/plain"); r.readAsDataURL(f); });
    add("Hex dump", async () => { const u = new Uint8Array(await f.slice(0, 2e6).arrayBuffer()); let s = ""; for (let i = 0; i < u.length; i += 16) { const r = [...u.subarray(i, i + 16)]; s += i.toString(16).padStart(8, "0") + "  " + r.map((x) => x.toString(16).padStart(2, "0")).join(" ").padEnd(48) + "  " + r.map((x) => (x > 31 && x < 127 ? String.fromCharCode(x) : ".")).join("") + "\n"; } save(s, f.name + ".hex.txt", "text/plain"); });
    const h = document.createElement("h2"); h.textContent = "Convert right here"; out.append(h);
    const box = document.createElement("div"); box.className = "row-actions";
    acts.forEach(([l, fn]) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn btn-quiet"; b.textContent = l; b.addEventListener("click", fn); box.append(b); });
    out.append(box);
    // On a landing page like /csv-to-json, put the matching conversion first
    const want = (document.querySelector("h1")?.textContent || "").toLowerCase().replace(/ \(.*$/, "");
    const hit = [...box.children].find((b) => b.textContent.toLowerCase().includes(want));
    if (hit && location.pathname !== "/convert") { hit.className = "btn"; box.prepend(hit); }
  }

  // Never keep files around: clear anything a previous visit left in the handoff store.
  try { indexedDB.deleteDatabase("wz-handoff"); } catch (e) {}

  $("choose").addEventListener("click", () => input.click());
  input.addEventListener("change", () => { if (input.files.length) show([...input.files]); input.value = ""; });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files.length) show([...e.dataTransfer.files]); });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
})();
