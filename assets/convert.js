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
    [IMG, [["Convert to JPG, PNG or WebP", "/image"], ["Compress to a file size", "/compress"], ["Put into a PDF", "/pdf"], ["Make a favicon", "/favicon"]]],
    ["pdf", [["Split, extract or rotate pages", "/split-pdf"], ["Turn pages into JPGs", "/pdf-to-jpg"], ["Merge with other PDFs", "/pdf"]]],
    [VID, [["Convert to MP4", "/video", "mp4"], ["Make it smaller (MP4)", "/video", "mp4-small"], ["Extract the audio as MP3", "/video", "mp3"], ["Turn into a GIF", "/video", "gif"], ["Convert to WebM", "/video", "webm"]]],
    [AUD, [["Convert to MP3", "/video", "mp3"], ["Convert to M4A", "/video", "m4a"], ["Convert to WAV", "/video", "wav"], ["Convert to OGG", "/video", "ogg"]]],
    [EMB, [["Convert embroidery file", "/embroidery"]]],
    [SHEET, [["Convert spreadsheet (CSV, JSON, XLSX)", "/excel"]]],
    ["csv tsv", [["Convert to Excel", "/excel"], ["Convert to JSON or YAML", "/data"]]],
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
      p.textContent = `Wezzet can't convert .${ext(first) || "this kind of"} files yet. You can still zip them, or ask for a converter in the forum.`;
      out.append(p);
    }
    const z = document.createElement("button");
    z.type = "button"; z.className = "btn btn-quiet"; z.textContent = "Zip it";
    z.addEventListener("click", () => go(files, "/zip"));
    const ask = document.createElement("a"); ask.className = "btn btn-quiet"; ask.href = "/forum"; ask.textContent = "Request a converter";
    box.append(z); if (!tools) box.append(ask);
    out.append(box);
  }

  $("choose").addEventListener("click", () => input.click());
  input.addEventListener("change", () => { if (input.files.length) show([...input.files]); input.value = ""; });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files.length) show([...e.dataTransfer.files]); });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
})();
