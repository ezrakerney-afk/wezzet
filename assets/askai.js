/* Ask AI buttons: <button data-askai="summarize|explain|fixjson" data-src="#textarea" [data-apply="#textarea"]>.
   Sends that text to WezzetAI (/api/ai) only when clicked, and streams the answer into a box below the button row. */
(() => {
  const css = document.createElement("style");
  css.textContent = ".ai-box{margin-top:12px;padding:12px 14px;border:1px solid var(--line,#ddd);border-radius:10px;white-space:pre-wrap;font-size:15px;line-height:1.5}.ai-box .row-actions{margin-top:10px}.ai-note{font-size:13px;opacity:.7;margin-top:6px}";
  document.head.append(css);
  document.querySelectorAll("[data-askai]").forEach((btn) => btn.addEventListener("click", async () => {
    const src = document.querySelector(btn.dataset.src), text = src ? src.value.trim() : "";
    const row = btn.closest(".row-actions, .btn-row") || btn;
    let box = row.nextElementSibling && row.nextElementSibling.classList.contains("ai-box") ? row.nextElementSibling : null;
    if (!box) { box = document.createElement("div"); box.className = "ai-box"; box.setAttribute("aria-live", "polite"); row.after(box); }
    if (!text) { box.textContent = "Add some text first."; return; }
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "Thinking…";
    const out = document.createElement("div"); box.replaceChildren(out);
    out.textContent = "WezzetAI is reading it. This can take up to a minute.";
    let got = "";
    try {
      const r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(90000), body: JSON.stringify({ task: btn.dataset.askai, text, stream: true }) });
      if (r.status === 429) throw new Error("You've asked a lot this hour. Try again later.");
      if (!r.ok) throw new Error("WezzetAI is busy right now. Try again in a minute.");
      if ((r.headers.get("content-type") || "").includes("json")) got = (await r.json()).reply || "";
      else { const rd = r.body.getReader(), dec = new TextDecoder(); for (;;) { const { done, value } = await rd.read(); if (done) break; got += dec.decode(value, { stream: true }); out.textContent = got; } }
      got = got.trim().replace(/^```\w*\s*|\s*```$/g, "");
      if (!got) throw new Error("No answer came back. Try again.");
      out.textContent = got;
      const acts = document.createElement("div"); acts.className = "row-actions";
      const b = (t, f) => { const x = document.createElement("button"); x.type = "button"; x.className = "btn btn-quiet"; x.textContent = t; x.onclick = f; acts.append(x); return x; };
      const cp = b("Copy", () => navigator.clipboard.writeText(got).then(() => { cp.textContent = "Copied"; }));
      const dst = btn.dataset.apply && document.querySelector(btn.dataset.apply);
      if (dst) b("Use it", () => { dst.value = got; dst.dispatchEvent(new Event("input", { bubbles: true })); box.remove(); });
      const note = document.createElement("p"); note.className = "ai-note"; note.textContent = "Written by AI. Check it before you rely on it.";
      box.append(acts, note);
    } catch (e) { out.textContent = e.name === "TimeoutError" ? "That took too long. Try a shorter text." : e.message; }
    btn.disabled = false; btn.textContent = label;
  }));
})();
