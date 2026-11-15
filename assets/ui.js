/* Wezzet shared page behaviour: quick search (Ctrl/Cmd K), copy on click, hover glow, scroll touches.
   All text is set with textContent. Nothing here is needed for a tool to work. */
(() => {
  const d = document, root = d.documentElement, $ = (s, r = d) => r.querySelector(s), $$ = (s, r = d) => [...r.querySelectorAll(s)];
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = (tag, cls, text) => { const e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const ICON = { search: "M10 2a8 8 0 0 1 6.32 12.9l5.39 5.4-1.41 1.4-5.4-5.39A8 8 0 1 1 10 2Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z", up: "M12 5.6 4.3 13.3l1.4 1.4L12 8.4l6.3 6.3 1.4-1.4L12 5.6Z" };
  const svg = (path) => { const s = d.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); const p = d.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("fill", "currentColor"); p.setAttribute("d", path); s.append(p); return s; };
  root.classList.add("wz-js");

  // ---- toast + copy on click ----
  let toastEl;
  const toast = (t) => { if (toastEl) toastEl.remove(); toastEl = el("div", "wz-toast", t); toastEl.setAttribute("role", "status"); d.body.append(toastEl); setTimeout(() => toastEl && toastEl.remove(), 1700); };
  const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); toast(what + " copied"); } catch (e) { toast("Couldn't copy"); } };
  d.addEventListener("click", (e) => {
    if (getSelection().toString()) return; // the visitor is selecting text, leave it alone
    const code = e.target.closest(".guide code");
    if (code) return copy(code.textContent.trim(), "Formula");
    const ans = e.target.closest("#answer");
    if (ans && ans.textContent.trim()) copy(ans.textContent.trim(), "Result");
  });
  $$(".guide code").forEach((c) => (c.title = "Click to copy"));
  // A paragraph that is nothing but a formula is shown as a block.
  $$(".guide p").forEach((p) => { const codes = $$("code", p); if (codes.length && p.textContent.trim() === codes.map((c) => c.textContent).join("").trim()) p.classList.add("wz-formula"); });
  const answer = $("#answer"); if (answer) answer.title = "Click to copy";

  // ---- header shadow + back to top ----
  const top = el("button", "wz-top"); top.type = "button"; top.setAttribute("aria-label", "Back to top"); top.append(svg(ICON.up));
  top.onclick = () => scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
  d.body.append(top);
  let tick = false;
  const onScroll = () => { tick = false; d.body.classList.toggle("wz-scrolled", scrollY > 8); top.classList.toggle("on", scrollY > 700); };
  addEventListener("scroll", () => { if (!tick) { tick = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // ---- soft glow that follows the pointer on the main tool card ----
  if (matchMedia("(hover: hover)").matches && !calm) {
    $$(".tool-frame, #app.tight, .dropzone, .panel").forEach((c) => {
      c.classList.add("wz-glow");
      c.addEventListener("pointermove", (e) => { const r = c.getBoundingClientRect(); c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px"); });
      c.addEventListener("pointerleave", () => { c.style.removeProperty("--mx"); c.style.removeProperty("--my"); });
    });
  }

  // ---- sections below the fold ease in as they arrive ----
  if (!calm && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { rootMargin: "0px 0px -6% 0px" });
    $$("main .faq, main .guide, main .related, .site-footer .wz-foot").forEach((s) => { if (s.getBoundingClientRect().top > innerHeight) { s.classList.add("wz-reveal"); io.observe(s); } });
  }

  // ---- quick search ----
  let pal, input, list, tools = null, shown = [], sel = 0;
  const recent = () => { try { return JSON.parse(localStorage.getItem("wz-recent") || "[]").filter((r) => r && r.u && r.n).map((r) => ({ url: r.u, name: r.n })); } catch (e) { return []; } };
  const POPULAR = [["/heic-to-jpg", "HEIC to JPG"], ["/compress-pdf", "Compress PDF"], ["/mp4-to-mp3", "MP4 to MP3"], ["/units", "Unit converter"], ["/transport", "Live transport tracker"], ["/qr", "QR code generator"], ["/ai", "WezzetAI"]].map(([url, name]) => ({ url, name }));
  const load = () => tools ? Promise.resolve(tools) : fetch("/assets/tool-catalog.json").then((r) => r.json()).then((j) => (tools = j.pages || [])).catch(() => (tools = POPULAR));
  function find(q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean), out = [];
    for (const t of tools) {
      const n = t.name.toLowerCase();
      if (!words.every((w) => n.includes(w))) continue;
      // exact, then starts with, then a word starts with it, then anywhere; shorter names first
      const first = words[0], score = (n === q.toLowerCase() ? 0 : n.startsWith(first) ? 1 : n.includes(" " + first) ? 2 : 3) * 1000 + n.length;
      out.push([score, t]);
    }
    return out.sort((a, b) => a[0] - b[0]).slice(0, 9).map((x) => x[1]);
  }
  function row(t, q, i) {
    const li = el("li"); li.setAttribute("role", "option"); li.id = "wz-opt-" + i; li.dataset.i = i;
    const name = el("span"), low = t.name.toLowerCase(), w = q.trim().toLowerCase().split(/\s+/)[0], at = w ? low.indexOf(w) : -1;
    if (at >= 0) { name.append(t.name.slice(0, at), el("mark", "", t.name.slice(at, at + w.length)), t.name.slice(at + w.length)); } else name.textContent = t.name;
    li.append(name, el("small", "", t.url.replace(/^\//, "")));
    return li;
  }
  function draw() {
    const q = input.value.trim();
    list.replaceChildren(); shown = []; sel = 0;
    const group = (title, items) => { if (!items.length) return; const cap = el("li", "wz-pal-cap", title); cap.setAttribute("role", "presentation"); list.append(cap); for (const t of items) { list.append(row(t, q, shown.length)); shown.push(t); } };
    if (!q) { const r = recent().filter((x) => x.url !== location.pathname.replace(/\.html$/, "")); group("Recently opened", r.slice(0, 4)); group("Popular", POPULAR.filter((p) => !r.some((x) => x.url === p.url)).slice(0, 6)); }
    else if (!tools) list.append(el("li", "wz-pal-none", "Loading tools…"));
    else { const hits = find(q); if (hits.length) group(hits.length === 1 ? "1 tool" : "Top " + hits.length + " tools", hits); else list.append(el("li", "wz-pal-none", "No tool matches \"" + q + "\". Try fewer words.")); }
    mark();
  }
  function mark() {
    $$("li[role=option]", list).forEach((li) => li.setAttribute("aria-selected", String(+li.dataset.i === sel)));
    const cur = $("#wz-opt-" + sel, list);
    if (cur) { input.setAttribute("aria-activedescendant", cur.id); cur.scrollIntoView({ block: "nearest" }); } else input.removeAttribute("aria-activedescendant");
  }
  const go = (t) => { if (t) location.href = t.url; };
  function build() {
    pal = el("dialog", "wz-pal"); pal.setAttribute("aria-label", "Search tools");
    const topRow = el("div", "wz-pal-top"); input = el("input"); input.type = "search"; input.placeholder = "Search every tool…"; input.autocomplete = "off"; input.spellcheck = false;
    input.setAttribute("role", "combobox"); input.setAttribute("aria-expanded", "true"); input.setAttribute("aria-controls", "wz-pal-list"); input.setAttribute("aria-label", "Search tools");
    const esc = el("kbd", "", "Esc"); topRow.append(svg(ICON.search), input, esc);
    list = el("ul", "wz-pal-list"); list.id = "wz-pal-list"; list.setAttribute("role", "listbox");
    const foot = el("div", "wz-pal-foot"); for (const [k, t] of [["↑↓", "to move"], ["Enter", "to open"], ["Esc", "to close"]]) { const s = el("span"); s.append(el("kbd", "", k), " " + t); foot.append(s); }
    pal.append(topRow, list, foot); d.body.append(pal);
    input.addEventListener("input", draw);
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (shown.length) { sel = (sel + (e.key === "ArrowDown" ? 1 : shown.length - 1)) % shown.length; mark(); } }
      else if (e.key === "Enter") { e.preventDefault(); go(shown[sel]); }
    });
    list.addEventListener("click", (e) => { const li = e.target.closest("li[role=option]"); if (li) go(shown[+li.dataset.i]); });
    list.addEventListener("pointermove", (e) => { const li = e.target.closest("li[role=option]"); if (li && +li.dataset.i !== sel) { sel = +li.dataset.i; mark(); } });
    pal.addEventListener("click", (e) => { if (e.target === pal) pal.close(); }); // click on the dimmed backdrop
  }
  function open() {
    const home = $("#q"); // the homepage has its own search box: use that one
    if (home && !pal) { home.focus(); home.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" }); return; }
    if (!pal) build();
    if (pal.open) return;
    input.value = ""; pal.showModal(); draw(); input.focus();
    load().then(() => { if (pal.open && input.value.trim()) draw(); });
  }
  d.addEventListener("click", (e) => { if (e.target.closest("[data-wz-search]")) open(); });
  // Pages that are about pressing keys keep every key for themselves.
  if (!/^\/(keycode|typing|cps|reaction)/.test(location.pathname)) d.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) { e.preventDefault(); pal && pal.open ? pal.close() : open(); }
    else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); open(); }
  });
  // Show the right shortcut for the device.
  if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) $$("[data-wz-search] kbd").forEach((k) => (k.textContent = "⌘K"));
})();
