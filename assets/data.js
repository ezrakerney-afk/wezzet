/* Wezzet data converter: CSV, TSV, JSON and YAML into each other. YAML uses js-yaml. */
(() => {
  const $ = (id) => document.getElementById(id);
  const src = $("src"), dst = $("dst"), fromEl = $("from"), toEl = $("to"), msg = $("msg");
  const EXT = { csv: "csv", tsv: "tsv", json: "json", yaml: "yaml" };
  const MIME = { csv: "text/csv", tsv: "text/tab-separated-values", json: "application/json", yaml: "application/yaml" };

  function guess(text) {
    const t = text.trim();
    if (/^[\[{]/.test(t)) return "json";
    const first = t.split("\n")[0];
    if (first.includes("\t")) return "tsv";
    if (/^(---|- |\w[\w ]*:\s)/.test(t) && !first.includes(",")) return "yaml";
    return "csv";
  }

  // RFC 4180 reader: quoted fields, doubled quotes, newlines inside quotes
  function readDelimited(text, sep) {
    const rows = []; let row = [], f = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"' && f === "") q = true;
      else if (c === sep) { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(f); rows.push(row); row = []; f = "";
      } else f += c;
    }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    const body = rows.filter((r) => r.some((x) => x !== ""));
    if (!body.length) return [];
    const head = body[0].map((h, i) => h.trim() || `column${i + 1}`);
    return body.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, typed(r[i] ?? "")])));
  }
  const typed = (s) => (/^-?\d+(\.\d+)?$/.test(s) && !/^-?0\d/.test(s) ? Number(s) : s === "true" ? true : s === "false" ? false : s);

  function writeDelimited(data, sep) {
    const rows = Array.isArray(data) ? data : [data];
    const cols = [];
    for (const r of rows) for (const k of Object.keys(r && typeof r === "object" ? r : { value: r })) if (!cols.includes(k)) cols.push(k);
    const cell = (v) => {
      let s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      return /["\n\r]/.test(s) || s.includes(sep) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [cols.map(cell).join(sep), ...rows.map((r) => cols.map((c) => cell(r && typeof r === "object" ? r[c] : r)).join(sep))].join("\n");
  }

  function convert() {
    msg.hidden = true;
    const text = src.value;
    if (!text.trim()) { dst.value = ""; return; }
    const from = fromEl.value === "auto" ? guess(text) : fromEl.value, to = toEl.value;
    $("detected").textContent = fromEl.value === "auto" ? `Reading as ${from.toUpperCase()}` : "";
    try {
      const data = from === "json" ? JSON.parse(text) : from === "yaml" ? jsyaml.load(text) : readDelimited(text, from === "tsv" ? "\t" : ",");
      dst.value = to === "json" ? JSON.stringify(data, null, 2) : to === "yaml" ? jsyaml.dump(data, { lineWidth: -1 }) : writeDelimited(data, to === "tsv" ? "\t" : ",");
    } catch (e) {
      dst.value = "";
      msg.textContent = `That doesn't look like valid ${from.toUpperCase()}: ${String(e.message).split("\n")[0]}`;
      msg.hidden = false;
    }
  }

  [src, fromEl, toEl].forEach((el) => el.addEventListener("input", convert));
  $("open").addEventListener("click", () => $("file").click());
  $("file").addEventListener("change", async () => {
    const f = $("file").files[0];
    if (!f) return;
    src.value = await f.text();
    const ext = (f.name.match(/\.(\w+)$/) || [])[1];
    if (ext) fromEl.value = { yml: "yaml", yaml: "yaml", json: "json", csv: "csv", tsv: "tsv" }[ext.toLowerCase()] || "auto";
    $("file").value = "";
    convert();
  });
  $("copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(dst.value); $("copy").textContent = "Copied"; setTimeout(() => ($("copy").textContent = "Copy"), 1500); } catch (e) {}
  });
  $("save").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([dst.value], { type: MIME[toEl.value] }));
    a.download = "converted." + EXT[toEl.value]; a.click();
  });
})();
