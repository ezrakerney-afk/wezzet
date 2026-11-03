/* Wezzet PDF page tool: extract, split, delete or rotate pages in the browser (pdf-lib). */
(() => {
  const $ = (id) => document.getElementById(id);
  const drop = $("drop"), input = $("files"), info = $("info"), go = $("go"), msg = $("msg"), pagesEl = $("pages");
  let file = null, count = 0;

  const action = () => document.querySelector('input[name="act"]:checked').value;
  const base = () => file.name.replace(/\.pdf$/i, "");

  // "1-3, 5, 8-" -> zero-based page indices, in the order written
  function parse(text) {
    const t = text.trim();
    if (!t) return [...Array(count).keys()];
    const out = [];
    for (const part of t.split(/[,\s]+/).filter(Boolean)) {
      const m = part.match(/^(\d*)\s*-\s*(\d*)$/) || part.match(/^(\d+)$/);
      if (!m) throw new Error(`"${part}" isn't a page or a range like 2-5.`);
      const a = m[1] ? parseInt(m[1], 10) : 1;
      const b = m.length > 2 ? (m[2] ? parseInt(m[2], 10) : count) : a;
      if (a < 1 || b > count || a > b) throw new Error(`Pages ${part} don't exist. This PDF has ${count} page${count === 1 ? "" : "s"}.`);
      for (let p = a; p <= b; p++) out.push(p - 1);
    }
    return out;
  }

  function save(bytes, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bytes], { type: name.endsWith(".zip") ? "application/zip" : "application/pdf" }));
    a.download = name; a.click();
  }

  async function load(f) {
    msg.hidden = true;
    if (!(f.type === "application/pdf" || /\.pdf$/i.test(f.name))) { msg.textContent = "That isn't a PDF."; msg.hidden = false; return; }
    try {
      const doc = await PDFLib.PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
      file = f; count = doc.getPageCount();
      info.textContent = `${f.name}: ${count} page${count === 1 ? "" : "s"}`;
      info.hidden = false; $("controls").hidden = false;
    } catch (e) {
      msg.textContent = "This PDF couldn't be read. It may be damaged or password protected."; msg.hidden = false;
    }
  }

  go.addEventListener("click", async () => {
    msg.hidden = true;
    const label = go.textContent;
    go.disabled = true; go.textContent = "Working";
    try {
      const { PDFDocument, degrees } = PDFLib;
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const picked = parse(pagesEl.value);
      const act = action();
      if (act === "extract") {
        const out = await PDFDocument.create();
        (await out.copyPages(src, picked)).forEach((p) => out.addPage(p));
        save(await out.save(), `${base()}-pages.pdf`);
      } else if (act === "split") {
        const files = {};
        for (const i of picked) {
          const out = await PDFDocument.create();
          const [p] = await out.copyPages(src, [i]);
          out.addPage(p);
          files[`${base()}-page-${i + 1}.pdf`] = [await out.save(), { level: 0 }];
        }
        save(fflate.zipSync(files), `${base()}-pages.zip`);
      } else if (act === "delete") {
        const drop = new Set(picked);
        if (drop.size >= count) throw new Error("That would delete every page.");
        const keep = [...Array(count).keys()].filter((i) => !drop.has(i));
        const out = await PDFDocument.create();
        (await out.copyPages(src, keep)).forEach((p) => out.addPage(p));
        save(await out.save(), `${base()}-edited.pdf`);
      } else {
        const turn = parseInt(document.querySelector('input[name="deg"]:checked').value, 10);
        for (const i of new Set(picked)) {
          const p = src.getPage(i);
          p.setRotation(degrees((p.getRotation().angle + turn) % 360));
        }
        save(await src.save(), `${base()}-rotated.pdf`);
      }
    } catch (e) {
      msg.textContent = e.message && !/^[A-Z][a-z]+Error/.test(e.name) ? e.message : "Something went wrong reading this PDF.";
      msg.hidden = false;
    } finally {
      go.disabled = false; go.textContent = label;
    }
  });

  document.querySelectorAll('input[name="act"]').forEach((r) => r.addEventListener("change", () => { $("deg-field").hidden = action() !== "rotate"; }));
  $("choose").addEventListener("click", () => input.click());
  input.addEventListener("change", () => { if (input.files[0]) load(input.files[0]); input.value = ""; });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) load(e.dataTransfer.files[0]); });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
})();
