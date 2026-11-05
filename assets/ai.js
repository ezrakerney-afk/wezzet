/* WezzetAI: a helper that finds the right Wezzet tool for what you type or drop.
   Answers with an open-weight model that runs on the visitor's GPU (WebLLM) plus free live search from /api/search.
   Nothing is stored unless you sign in to a Wezzet account (then the chat is kept on it); dropped files only go to the tool you pick. */
(() => {
  const $ = (id) => document.getElementById(id);
  const log = $("log"), form = $("ask"), q = $("q"), drop = $("ask"), input = $("files"), page = $("page"), send = $("send");
  let ctl = null; // aborts the answer being written (Stop button)
  let TOOLS = [];
  const history = [];
  fetch("/assets/home.js").then((r) => r.text()).then((t) => {
    TOOLS = [...t.matchAll(/^\s*\["([^"]+)", "(\/[^"]*)", "([^"]*)"\]/gm)].map((m) => ({ name: m[1], path: m[2], words: (m[1] + " " + m[3]).toLowerCase() }));
  });

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  // Small, safe Markdown: the text is escaped first, then **bold**, *italic*, `code`, [links](url), bare URLs, # headings and lists.
  function md(text) {
    const lines = esc(text.trim()).split("\n"), out = [];
    let list = null;
    const inline = (s) => s.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|\W)\*([^*\n]+)\*(?=\W|$)/g, "$1<i>$2</i>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[\w\-/?=&.%]*)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
      .replace(/(^|\s)(\/[a-z0-9][a-z0-9-]*)(?=[\s.,!?)]|$)/g, '$1<a href="$2">$2</a>');
    for (const l of lines) {
      const li = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
      if (li) { if (!list) { list = []; } list.push(`<li>${inline(li[1])}</li>`); continue; }
      if (list) { out.push(`<ul>${list.join("")}</ul>`); list = null; }
      const h = l.match(/^#{1,6}\s+(.*)/);
      if (h) out.push(`<p><b>${inline(h[1])}</b></p>`); else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
    }
    if (list) out.push(`<ul>${list.join("")}</ul>`);
    return out.join("");
  }

  function say(who, text, links = [], sources = []) {
    const d = document.createElement("div"); d.className = "ai-msg ai-" + who;
    const body = document.createElement("div"); body.className = "ai-body";
    if (who === "bot") body.innerHTML = md(text); else body.textContent = text;
    d.append(body);
    if (sources.length) {
      const s = document.createElement("div"); s.className = "ai-src";
      sources.forEach(([label, href], i) => { const a = document.createElement("a"); a.href = href; a.target = "_blank"; a.rel = "noopener"; a.textContent = `${i + 1}. ${label}`; s.append(a); });
      d.append(s);
    }
    if (links.length) {
      const box = document.createElement("div"); box.className = "row-actions";
      links.forEach(([label, href, fn], i) => { const a = document.createElement(fn ? "button" : "a"); a.className = "btn" + (i ? " btn-quiet" : ""); a.textContent = label; if (fn) { a.type = "button"; a.onclick = fn; } else a.href = href; box.append(a); });
      d.append(box);
    }
    if (who === "bot" && text.length > 40 && !links.length) {
      const t = document.createElement("div"); t.className = "ai-tools";
      const c = document.createElement("button"); c.type = "button"; c.textContent = "Copy";
      c.onclick = () => { navigator.clipboard.writeText(text).then(() => { c.textContent = "Copied"; setTimeout(() => (c.textContent = "Copy"), 1500); }, () => {}); };
      t.append(c); d.append(t);
    }
    page.classList.add("chatting"); log.append(d); down();
    return d;
  }

  const down = () => { const near = innerHeight + scrollY > document.body.scrollHeight - 160; if (near || !ctl) scrollTo(0, document.body.scrollHeight); };
  const STOP = new Set("i a an the to my me can you how do convert into from and or for of in on with want need make please this that it is".split(" "));
  function match(text) {
    const words = text.toLowerCase().replace(/[^\w.+ -]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
    const pair = text.toLowerCase().match(/\.?(\w+)\s+(?:to|into|->)\s+\.?(\w+)/);
    return TOOLS.map((t) => {
      let s = 0;
      for (const w of words) if (t.words.includes(w)) s += w.length > 3 ? 2 : 1;
      if (pair && t.path === `/${pair[1]}-to-${pair[2]}`) s += 20;
      if (pair && t.words.includes(pair[1]) && t.words.includes(pair[2])) s += 4;
      return { t, s };
    }).filter((x) => x.s >= 2).sort((a, b) => b.s - a.s).slice(0, 4).map((x) => x.t);
  }

  function calc(text) {
    const m = text.replace(/what is|what's|calculate|=|\?/gi, "").trim();
    if (!/^[\d\s+\-*/().%^]+$/.test(m) || !/\d/.test(m)) return null;
    try { const v = Function(`"use strict";return (${m.replace(/\^/g, "**")})`)(); return Number.isFinite(v) ? v : null; } catch (e) { return null; }
  }

  // The model runs on the visitor's own GPU through WebLLM, so it costs nothing to run and has no usage cap.
  // To swap in our own weights, point MODEL at an MLC-compiled model (see webllm "custom model" docs) and add it to appConfig.
  const WEBLLM = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.86/+esm";
  const MODELS = ["Qwen3-4B-q4f16_1-MLC", "Qwen3-1.7B-q4f16_1-MLC", "Qwen2.5-3B-Instruct-q4f16_1-MLC"];
  let allowDevice = (() => { try { return localStorage.getItem("wz-ai-device") === "1"; } catch (e) { return false; } })();
  let engine = null, loading = null;
  async function getEngine(status) {
    if (engine) return engine;
    if (!navigator.gpu || !allowDevice) return null;
    loading = loading || (async () => {
      const webllm = await import(WEBLLM);
      const ids = webllm.prebuiltAppConfig.model_list.map((m) => m.model_id);
      const small = (navigator.deviceMemory || 8) < 8;
      const id = (small ? MODELS.slice(1) : MODELS).find((m) => ids.includes(m)) || ids.find((m) => /Instruct/.test(m));
      engine = await webllm.CreateMLCEngine(id, { initProgressCallback: (p) => status(`Loading WezzetAI onto your device (first time only): ${Math.round((p.progress || 0) * 100)}%`) });
      return engine;
    })();
    try { return await loading; } catch (e) { loading = null; return null; }
  }

  const now = () => new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" });
  const SYSTEM = `You are WezzetAI, the assistant on wezzet.com, a site of 200+ free tools that run in the browser without uploading files. Help with anything. Answer briefly and plainly, without Markdown headings. Use the search results you are given for anything recent, and say which source it came from. If the results don't cover it, say you aren't sure instead of guessing. If a Wezzet tool from the list fits, mention its path (like /convert). Never write "PH" for Product Hunt. Give times in Eastern.`;

  async function answer(text) {
    history.push({ role: "user", content: text });
    const c = calc(text);
    if (c !== null) return say("bot", `${text.replace(/[=?]/g, "").trim()} = ${+c.toFixed(10)}`);
    const hits = match(text);
    const bubble = say("bot", "Thinking"), body = bubble.firstChild;
    body.classList.add("ai-wait");
    const status = (s, done) => { body.classList.toggle("ai-wait", !done); body.innerHTML = md(s); down(); };
    let found = { web: [], news: [] };
    // Search only when the question needs fresh or factual info: it makes the prompt longer and the answer slower.
    const needs = /\b(news|today|tonight|yesterday|tomorrow|latest|current|currently|now|recent|this (week|month|year)|20[2-3]\d|price|cost|weather|score|won|election|who is|who's|who was|when (is|did|was)|where is|stock|release|launch|update|happened|ceo|president)\b/i.test(text) || /[A-Z][a-z]+ [A-Z][a-z]+/.test(text.slice(1));
    if (needs) status("Searching");
    if (needs) try { const r = await fetch("/api/search?q=" + encodeURIComponent(text), { signal: AbortSignal.timeout(4000) }); if (r.ok) found = await r.json(); } catch (e) {}
    const srcs = [...found.news.slice(0, 3), ...found.web.slice(0, 3)];
    const links = srcs.slice(0, 4).map((x) => { let h = x.source || ""; try { h = h || new URL(x.url).hostname.replace(/^www\./, ""); } catch (e) {} return [h || "source", x.url]; });
    status("Thinking");
    const ctx = `Now: ${now()} Eastern.\nWezzet tools that may fit: ${hits.map((t) => `${t.name} (${t.path})`).join(", ") || "none"}.\nSearch results:\n` +
      (!needs ? "not needed" : srcs.map((x, i) => `[${i + 1}] ${x.title}${x.source ? " — " + x.source : ""}${x.date ? " (" + x.date + ")" : ""}\n${(x.snippet || "").slice(0, 220)}`).join("\n") || "none");
    const msgs = [{ role: "system", content: SYSTEM }, ...history.slice(-5, -1), { role: "user", content: ctx + "\n\nQuestion: " + text + " /no_think" }];
    try {
      const mine = ctl, dog = setTimeout(() => mine.abort("slow"), 75000);
      const r = await fetch("/api/ai", { method: "POST", signal: ctl.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ stream: true, messages: msgs.map((m) => ({ ...m, content: m.content.replace(" /no_think", "") })) }) });
      let reply = "";
      clearTimeout(dog);
      if (r.ok && /text\/plain/.test(r.headers.get("content-type") || "")) {
        // Streamed answer: show the words as they arrive.
        const rd = r.body.getReader(), dec = new TextDecoder();
        try { for (;;) { const { done, value } = await rd.read(); if (done) break; reply += dec.decode(value, { stream: true }); if (reply.trim()) status(reply, true); } }
        catch (e) { if (!reply.trim()) throw e; }
        reply = reply.trim();
      } else if (r.ok) { const j = await r.json(); reply = j.reply || ""; }
      if (reply) { history.push({ role: "assistant", content: reply }); bubble.remove(); return say("bot", reply, [], links); }
    } catch (e) { if (ctl && ctl.signal.aborted && ctl.signal.reason !== "slow") { bubble.remove(); return; } }
    const eng = await getEngine(status);
    if (!eng) {
      bubble.remove();
      if (ctl && ctl.signal.aborted && ctl.signal.reason !== "slow") return;
      const enable = navigator.gpu && !allowDevice ? [["Run it on this device (2–3 GB, once)", null, () => { allowDevice = true; try { localStorage.setItem("wz-ai-device", "1"); } catch (e) {} history.pop(); ask(text, true); }]] : [];
      say("bot", "WezzetAI is busy right now. Try again in a minute.", enable);
      return;
    }
    let out = "", raw = "";
    try {
      const stream = await eng.chat.completions.create({ messages: msgs, stream: true, temperature: 0.5, max_tokens: 700 });
      for await (const ch of stream) { raw += ch.choices[0]?.delta?.content || ""; out = raw.replace(/<think>[\s\S]*?(<\/think>|$)/, "").trimStart(); status(out || "Thinking", !!out); if (ctl && ctl.signal.aborted) break; }
    } catch (e) { out = out || "Something went wrong running the model. Reload and try again."; status(out); }
    history.push({ role: "assistant", content: out });
    bubble.remove(); say("bot", out, [], links);
  }

  async function files(list) {
    const f = list[0];
    say("you", list.length > 1 ? `${list.length} files (${f.name}, …)` : f.name);
    const e = ((f.name.match(/\.([^.]+)$/) || [])[1] || "").toLowerCase();
    const hits = TOOLS.filter((t) => t.words.split(/\s+/).includes(e)).slice(0, 4);
    const go = async (path) => { try { await wzHandoff.put(list); location.href = path + "?handoff=1"; } catch (er) { location.href = path; } };
    say("bot", hits.length ? `Here's what Wezzet can do with a .${e} file:` : `Open it in the any-file converter to see every option for .${e || "this"} files.`,
      [...hits.map((t) => [t.name, null, () => go(t.path)]), ["See every option", null, () => go("/convert")]]);
  }

  const grow = () => { q.style.height = "auto"; q.style.height = Math.min(q.scrollHeight, 200) + "px"; };
  async function ask(t, again) {
    if (ctl) return;
    ctl = new AbortController(); send.classList.add("busy"); send.setAttribute("aria-label", "Stop");
    if (!again) say("you", t);
    try { await answer(t); } catch (e) {}
    ctl = null; send.classList.remove("busy"); send.setAttribute("aria-label", "Send"); grow(); keep();
  }

  // Signed in to a Wezzet account (optional): the chat (last 60 messages) and settings are kept on the account.
  const acct = () => window.wzAccount && window.wzAccount.me ? window.wzAccount : null;
  const keep = () => { const A = acct(); if (A) A.call("store", { method: "POST", body: JSON.stringify({ k: "ai", v: { history: history.slice(-60), device: allowDevice } }) }); };
  async function restore() {
    const A = acct(); if (!A || history.length) return;
    const r = await A.call("store?k=ai"), v = r && r.v && JSON.parse(r.v);
    if (!v || history.length) return;
    if (v.device) allowDevice = true;
    for (const m of v.history || []) if (m && typeof m.content === "string") { history.push({ role: m.role === "user" ? "user" : "assistant", content: m.content }); say(m.role === "user" ? "you" : "bot", m.content); }
  }
  if (window.wzAccount) { window.wzAccount.ready.then(restore); document.addEventListener("wz-account", restore); }
  const fresh = $("ai-new");
  if (fresh) fresh.onclick = () => { if (ctl) return; history.length = 0; log.replaceChildren(); page.classList.remove("chatting"); keep(); q.focus(); };
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (ctl) { ctl.abort(); return; }
    const t = q.value.trim(); if (!t) return; q.value = ""; grow(); ask(t);
  });
  q.addEventListener("input", grow);
  q.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  $("chips").addEventListener("click", (e) => { const b = e.target.closest(".ai-chip"); if (b) ask(b.textContent); });
  $("choose").addEventListener("click", () => input.click());
  input.addEventListener("change", () => { if (input.files.length) files([...input.files]); input.value = ""; });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files.length) files([...e.dataTransfer.files]); });
  window.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("dragging"); });
  window.addEventListener("dragleave", (e) => { if (!e.relatedTarget) drop.classList.remove("dragging"); });
  window.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("dragging"); if (e.target.closest && !e.target.closest("#ask") && e.dataTransfer.files.length) files([...e.dataTransfer.files]); });
  const pre = new URLSearchParams(location.search).get("q");
  if (pre) setTimeout(() => ask(pre), 300); else if (matchMedia("(pointer:fine)").matches) q.focus();
})();
