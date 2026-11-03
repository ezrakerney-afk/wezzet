/* Wezzet spreadsheet converter: Excel, OpenDocument, Numbers and CSV via SheetJS, in the browser. */
(() => {
  const $ = (id) => document.getElementById(id);
  const drop = $("drop"), input = $("files"), list = $("list"), msg = $("msg");

  function save(data, name, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click();
  }

  const OUT = {
    csv: (ws) => [XLSX.utils.sheet_to_csv(ws), "text/csv"],
    tsv: (ws) => [XLSX.utils.sheet_to_csv(ws, { FS: "\t" }), "text/tab-separated-values"],
    json: (ws) => [JSON.stringify(XLSX.utils.sheet_to_json(ws, { defval: null }), null, 2), "application/json"],
    html: (ws) => [XLSX.utils.sheet_to_html(ws), "text/html"],
  };
  const BOOK = { xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ods: "application/vnd.oasis.opendocument.spreadsheet", xls: "application/vnd.ms-excel" };

  function button(text, fn, quiet = true) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn" + (quiet ? " btn-quiet" : ""); b.textContent = text;
    b.addEventListener("click", fn); return b;
  }

  async function handle(file) {
    msg.hidden = true;
    let wb;
    try {
      wb = XLSX.read(await file.arrayBuffer(), { cellDates: true, dense: true });
    } catch (e) {
      msg.textContent = `${file.name} couldn't be read as a spreadsheet.`; msg.hidden = false; return;
    }
    const base = file.name.replace(/\.[^.]+$/, "");
    const book = document.createElement("li");
    const name = document.createElement("span"); name.className = "fname"; name.textContent = file.name;
    const meta = document.createElement("span"); meta.className = "fmeta";
    meta.textContent = `${wb.SheetNames.length} sheet${wb.SheetNames.length === 1 ? "" : "s"}. Save the whole workbook as:`;
    const actions = document.createElement("span"); actions.className = "factions";
    for (const t of ["xlsx", "ods", "xls"]) actions.append(button(t.toUpperCase(), () => save(XLSX.write(wb, { bookType: t === "xls" ? "biff8" : t, type: "array" }), `${base}.${t}`, BOOK[t])));
    book.append(name, meta, actions); list.append(book);
    for (const sheet of wb.SheetNames) {
      const ws = wb.Sheets[sheet];
      const rows = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]).e.r + 1 : 0;
      const li = document.createElement("li");
      const n = document.createElement("span"); n.className = "fname"; n.textContent = `Sheet: ${sheet}`;
      const m = document.createElement("span"); m.className = "fmeta"; m.textContent = `${rows} row${rows === 1 ? "" : "s"}`;
      const acts = document.createElement("span"); acts.className = "factions";
      for (const [t, fn] of Object.entries(OUT)) {
        acts.append(button(t.toUpperCase(), () => { const [data, type] = fn(ws); save(data, `${base}-${sheet}.${t}`.replace(/[\\/:*?"<>|]/g, "_"), type); }));
      }
      li.append(n, m, acts); list.append(li);
    }
  }

  const add = async (files) => { for (const f of files) await handle(f); };
  $("choose").addEventListener("click", () => input.click());
  input.addEventListener("change", () => { add([...input.files]); input.value = ""; });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); add([...e.dataTransfer.files]); });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
})();
