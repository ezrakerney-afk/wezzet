/* Wezzet file handoff: /convert stores dropped files in IndexedDB and opens a tool with ?handoff=1.
   On the tool page this puts those files into the page's file input, as if the visitor chose them. */
window.wzHandoff = (() => {
  const DB = "wz-handoff", STORE = "files";
  const db = () => new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  async function put(files) {
    const d = await db();
    await new Promise((res, rej) => { const t = d.transaction(STORE, "readwrite"); t.objectStore(STORE).put([...files], "pending"); t.oncomplete = res; t.onerror = () => rej(t.error); });
  }
  async function take() {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(STORE, "readwrite"), s = t.objectStore(STORE), g = s.get("pending");
      g.onsuccess = () => { s.delete("pending"); res(g.result || []); };
      t.onerror = () => rej(t.error);
    });
  }
  async function receive() {
    if (!new URLSearchParams(location.search).has("handoff")) return;
    history.replaceState(null, "", location.pathname + location.search.replace(/[?&]handoff=1/, "").replace(/^&/, "?"));
    let files;
    try { files = await take(); } catch (e) { return; }
    const input = document.querySelector("#files, #file, input[type=file]");
    if (!files.length || !input) return;
    const dt = new DataTransfer();
    (input.multiple ? files : files.slice(0, 1)).forEach((f) => dt.items.add(f));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (document.readyState === "complete") receive(); else window.addEventListener("load", receive);
  return { put };
})();
