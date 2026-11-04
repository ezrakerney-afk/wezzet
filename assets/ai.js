/* WezzetAI: a helper that finds the right Wezzet tool for what you type or drop.
   Uses /api/ai (Workers AI) when the site has it, and falls back to matching the tool list in the browser.
   Nothing is stored; dropped files only go to the tool you pick. */
(() => {
  const $ = (id) => document.getElementById(id);
  const log = $("log"), form = $("ask"), q = $("q"), drop = $("drop"), input = $("files");
  let TOOLS = [];
  const history = [];
  let thinking = null;
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
    log.append(d); d.scrollIntoView({ block: "end", behavior: "smooth" });
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

  async function answer(text) {
    history.push({ role: "user", content: text });
    const c = calc(text);
    if (c !== null) return say("bot", `${text.replace(/[=?]/g, "").trim()} = ${+c.toFixed(10)}`);
    const hits = match(text);
    let reply = null;
    say("bot", "…"); thinking = log.lastChild;
    try {
      const r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history.slice(-8) }) });
      if (r.ok) { const j = await r.json(); reply = j.reply; var src = j.sources || []; }
    } catch (e) {}
    thinking.remove();
    if (reply) { history.push({ role: "assistant", content: reply }); return say("bot", reply, [...(src || []).map((x) => [new URL(x.url).hostname.replace(/^www\./, ""), x.url]), ...(src && src.length ? [] : hits.slice(0, 2).map((t) => [t.name, t.path]))]); }
    if (hits.length) say("bot", hits.length > 1 ? "These should do it:" : "This should do it:", hits.map((t) => [t.name, t.path]));
    else say("bot", "I couldn't find a tool for that yet. Try different words, drop the file here, or ask for it in the forum.", [["Convert any file", "/convert"], ["Request it", "/forum"]]);
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
