(() => {
  const $ = (id) => document.getElementById(id), K = "wz-notepad", t = $("t");
  let saveT, store = true;
  try { t.value = localStorage.getItem(K) || ""; } catch (e) { store = false; }
  const count = () => { const w = (t.value.match(/\S+/g) || []).length; return `${w} word${w === 1 ? "" : "s"}, ${t.value.length} characters`; };
  const status = (msg) => { $("st").textContent = count() + (msg ? " · " + msg : ""); };
  status(store ? (t.value ? "Restored" : "") : "Saving is off in this browser");
  t.addEventListener("input", () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(K, t.value); status("Saved"); } catch (e) { status("Could not save"); } }, 400);
    status("");
  });
  window.addEventListener("beforeunload", () => { try { localStorage.setItem(K, t.value); } catch (e) {} });
  $("dl").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([t.value], { type: "text/plain;charset=utf-8" }));
    const first = (t.value.trim().split("\n")[0] || "note").replace(/[^\w\- ]+/g, "").trim().slice(0, 40) || "note";
    a.download = first + ".txt"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $("cp").addEventListener("click", async () => { try { await navigator.clipboard.writeText(t.value); status("Copied"); } catch (e) { t.select(); } });
  $("clr").addEventListener("click", () => { if (!t.value || confirm("Clear the note?")) { t.value = ""; try { localStorage.removeItem(K); } catch (e) {} status(""); t.focus(); } });
  $("op").addEventListener("click", () => $("f").click());
  $("f").addEventListener("change", async () => {
    const f = $("f").files[0]; if (!f) return;
    if (t.value && !confirm("Replace the current note with " + f.name + "?")) return;
    t.value = await f.text(); t.dispatchEvent(new Event("input")); $("f").value = "";
  });
})();
