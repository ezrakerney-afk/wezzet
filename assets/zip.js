/* Wezzet zip tool: open .zip files and save what's inside, or pack files into a new zip (fflate). */
(() => {
  const $ = (id) => document.getElementById(id);
  const drop = $("drop"), input = $("files"), list = $("list"), msg = $("msg"), makeBtn = $("make"), clearBtn = $("clear");
  const pack = []; // files waiting to be zipped
  const size = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);
  const isZip = (f) => /\.zip$/i.test(f.name) || /zip/.test(f.type);
  const TYPES = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", txt: "text/plain", csv: "text/csv", json: "application/json" };

  function row(title, sub) {
    const li = document.createElement("li");
    const n = document.createElement("span"); n.className = "fname"; n.textContent = title;
    const m = document.createElement("span"); m.className = "fmeta"; m.textContent = sub;
    const a = document.createElement("span"); a.className = "factions";
    li.append(n, m, a); list.append(li);
    return a;
  }

  function link(data, name) {
    const a = document.createElement("a");
    a.className = "btn btn-quiet"; a.textContent = "Download";
    const ext = (name.match(/\.(\w+)$/) || [])[1];
    a.href = URL.createObjectURL(new Blob([data], { type: TYPES[(ext || "").toLowerCase()] || "application/octet-stream" }));
    a.download = name.split("/").pop();
    return a;
  }

  async function open(file) {
    let entries;
    try {
      entries = fflate.unzipSync(new Uint8Array(await file.arrayBuffer()));
    } catch (e) {
      msg.textContent = `${file.name} couldn't be opened. It may be damaged, encrypted, or not a zip file.`; msg.hidden = false; return;
    }
    const names = Object.keys(entries).filter((n) => !n.endsWith("/") && !n.startsWith("__MACOSX/"));
    row(file.name, `${names.length} file${names.length === 1 ? "" : "s"} inside`);
    for (const n of names) row(n, size(entries[n].length)).append(link(entries[n], n));
  }

  function renderPack() {
    makeBtn.hidden = clearBtn.hidden = pack.length === 0;
    makeBtn.textContent = `Make zip of ${pack.length} file${pack.length === 1 ? "" : "s"}`;
  }

  async function add(files) {
    msg.hidden = true;
    const wantPack = document.querySelector('input[name="mode"]:checked').value === "make";
    for (const f of files) {
      if (isZip(f) && !wantPack) await open(f);
      else { pack.push(f); row(f.name, `${size(f.size)}, will be zipped`); }
    }
    renderPack();
  }

  makeBtn.addEventListener("click", async () => {
    makeBtn.disabled = true;
    const files = {}, used = new Set();
    for (const f of pack) {
      let n = f.name, i = 2;
      while (used.has(n)) n = f.name.replace(/(\.[^.]+)?$/, ` (${i++})$1`);
      used.add(n);
      // Already-compressed formats are stored; everything else is deflated
      const level = /\.(jpe?g|png|gif|webp|heic|mp4|mov|mp3|m4a|zip|gz|7z|rar|pdf|docx|xlsx|pptx)$/i.test(n) ? 0 : 6;
      files[n] = [new Uint8Array(await f.arrayBuffer()), { level }];
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([fflate.zipSync(files)], { type: "application/zip" }));
    a.download = pack.length === 1 ? pack[0].name.replace(/\.[^.]+$/, "") + ".zip" : "files.zip"; a.click();
    makeBtn.disabled = false;
  });
  clearBtn.addEventListener("click", () => { pack.length = 0; list.textContent = ""; msg.hidden = true; renderPack(); });
  document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", () => clearBtn.click()));

  $("choose").addEventListener("click", () => input.click());
  input.addEventListener("change", () => { add([...input.files]); input.value = ""; });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); add([...e.dataTransfer.files]); });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
})();
