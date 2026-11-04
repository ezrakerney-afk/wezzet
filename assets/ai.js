/* WezzetAI: a helper that finds the right Wezzet tool for what you type or drop.
   Answers with an open-weight model that runs on the visitor's GPU (WebLLM) plus free live search from /api/search.
   Nothing is stored; dropped files only go to the tool you pick. */
(() => {
  const $ = (id) => document.getElementById(id);
  const log = $("log"), form = $("ask"), q = $("q"), drop = $("drop"), input = $("files");
  let TOOLS = [];
  const history = [];
  fetch("/assets/home.js").then((r) => r.text()).then((t) => {
    TOOLS = [...t.matchAll(/^\s*\["([^"]+)", "(\/[^"]*)", "([^"]*)"\]/gm)].map((m) => ({ name: m[1], path: m[2], words: (m[1] + " " + m[3]).toLowerCase() }));
  });

  function say(who, text, links = []) {
    const d = document.createElement("div"); d.className = "ai-msg ai-" + who;
    const p = document.createElement("p"); p.textContent = text; d.append(p);
    if (links.length) {
      const box = document.createElement("div"); box.className = "row-actions";
      links.forEach(([label, href, fn], i) => { const a = document.createElement(fn ? "button" : "a"); a.className = "btn" + (i ? " btn-quiet" : ""); a.textContent = label; if (fn) { a.type = "button"; a.onclick = fn; } else a.href = href; box.append(a); });
      d.append(box);
    }
    log.append(d); log.scrollTop = log.scrollHeight;
  }

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
    }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 4).map((x) => x.t);
  }

  function calc(text) {
    const m = text.replace(/what is|what's|calculate|=|\?/gi, "").trim();
    if (!/^[\d\s+\-*/().%^]+$/.test(m) || !/\d/.test(m)) return null;
    try { const v = Function(`"use strict";return (${m.replace(/\^/g, "**")})`)(); return Number.isFinite(v) ? v : null; } catch (e) { return null; }
  }

  // The model runs on the visitor's own GPU through WebLLM, so it costs nothing to run and has no usage cap.
  // To swap in our own weights, point MODEL at an MLC-compiled model (see webllm "custom model" docs) and add it to appConfig.
  const WEBLLM = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.86/+esm";
  const MODELS = ["Qwen3-8B-q4f16_1-MLC", "Qwen3-4B-q4f16_1-MLC", "Qwen2.5-3B-Instruct-q4f16_1-MLC"];
  let engine = null, loading = null;
  async function getEngine(status) {
    if (engine) return engine;
    if (!navigator.gpu) return null;
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
    const toolish = hits.length && text.length < 50 && !/\?|^(who|what|when|why|how|is|are|did|does|should|tell|explain|write)\b/i.test(text);
    if (toolish) return say("bot", hits.length > 1 ? "These should do it:" : "This should do it:", hits.map((t) => [t.name, t.path]));
    say("bot", "Searching…"); const bubble = log.lastChild, status = (s) => { bubble.firstChild.textContent = s; };
    let found = { web: [], news: [] };
    try { const r = await fetch("/api/search?q=" + encodeURIComponent(text)); if (r.ok) found = await r.json(); } catch (e) {}
    const srcs = [...found.news.slice(0, 4), ...found.web.slice(0, 4)];
    const links = srcs.slice(0, 4).map((x) => { let h = x.source || ""; try { h = h || new URL(x.url).hostname.replace(/^www\./, ""); } catch (e) {} return [h || "source", x.url]; });
    status("Thinking…");
    const ctx = `Now: ${now()} Eastern.\nWezzet tools that may fit: ${hits.map((t) => `${t.name} (${t.path})`).join(", ") || "none"}.\nSearch results:\n` +
      (srcs.map((x, i) => `[${i + 1}] ${x.title}${x.source ? " — " + x.source : ""}${x.date ? " (" + x.date + ")" : ""}\n${x.snippet || ""}`).join("\n") || "none");
    const msgs = [{ role: "system", content: SYSTEM }, ...history.slice(-8, -1), { role: "user", content: ctx + "\n\nQuestion: " + text + " /no_think" }];
    try {
      const r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: msgs.map((m) => ({ ...m, content: m.content.replace(" /no_think", "") })) }) });
      if (r.ok) { const j = await r.json(); if (j.reply) { history.push({ role: "assistant", content: j.reply }); bubble.remove(); return say("bot", j.reply, [...links, ...hits.slice(0, 2).map((t) => [t.name, t.path])]); } }
    } catch (e) {}
    const eng = await getEngine(status);
    if (!eng) {
      bubble.remove();
      if (srcs.length) say("bot", "Your browser can't run WezzetAI's on-device model (it needs WebGPU, in recent Chrome or Edge). Here's what the web has on it:\n" + srcs.slice(0, 5).map((x) => "• " + x.title).join("\n"), [...links, ...hits.slice(0, 2).map((t) => [t.name, t.path])]);
      else say("bot", "I couldn't find anything on that. Try different words.", hits.map((t) => [t.name, t.path]));
      return;
    }
    let out = "", raw = "";
    try {
      const stream = await eng.chat.completions.create({ messages: msgs, stream: true, temperature: 0.5, max_tokens: 700 });
      for await (const ch of stream) { raw += ch.choices[0]?.delta?.content || ""; out = raw.replace(/<think>[\s\S]*?(<\/think>|$)/, "").trimStart(); status(out || "Thinking…"); }
    } catch (e) { out = out || "Something went wrong running the model. Reload and try again."; status(out); }
    history.push({ role: "assistant", content: out });
    bubble.remove(); say("bot", out, [...links, ...hits.slice(0, 2).map((t) => [t.name, t.path])]);
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

  form.addEventListener("submit", (ev) => { ev.preventDefault(); const t = q.value.trim(); if (!t) return; q.value = ""; say("you", t); answer(t); });
  $("choose").addEventListener("click", () => input.click());
  input.addEventListener("change", () => { if (input.files.length) files([...input.files]); input.value = ""; });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("dragging")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files.length) files([...e.dataTransfer.files]); });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
  const pre = new URLSearchParams(location.search).get("q");
  say("bot", "Hi, I'm WezzetAI. Ask me anything, including today's news, or tell me what you need done, like \"heic to jpg\". You can also drop a file here.");
  if (pre) setTimeout(() => { say("you", pre); answer(pre); }, 400);
})();
