/* Key code finder: shows KeyboardEvent properties for the last key pressed. */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const LOC = ["Standard", "Left", "Right", "Numpad"];
  const stat = (v, l) => `<div class="stat" data-copy="${esc(v)}" title="Click to copy"><b>${esc(v)}</b><span>${l}</span></div>`;
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    if (!e.metaKey && !(e.ctrlKey && /^[rlw]$/i.test(e.key))) e.preventDefault();
    $("big").textContent = e.key === " " ? "Space" : e.key;
    const mods = ["ctrlKey", "shiftKey", "altKey", "metaKey"].filter((m) => e[m]).map((m) => m.replace("Key", "")).join(" + ") || "None";
    $("info").innerHTML = stat(e.key === " " ? '" "' : e.key, "event.key") + stat(e.code || "(none)", "event.code") + stat(e.keyCode, "event.keyCode") + stat(e.which, "event.which") + stat(LOC[e.location] || e.location, "event.location") + stat(mods, "Modifiers") + stat(e.repeat ? "Yes" : "No", "Held down");
    $("hint").hidden = true;
  });
  document.addEventListener("click", (e) => { const s = e.target.closest("[data-copy]"); if (s && navigator.clipboard) navigator.clipboard.writeText(s.dataset.copy); });
})();
