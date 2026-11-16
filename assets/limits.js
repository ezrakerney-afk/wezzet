// Wezzet Pro soft limits for tools that run in the browser, plus the "Get Pro" popup.
// wzUse counts one use; when today's free cap is used up it shows the popup and throws. Does nothing while limits are off.
// If the check can't be reached, the tool still runs.
export async function wzUse(tool) {
  let r;
  try {
    r = await fetch("/api/chat/use", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ tool }) });
  } catch { return; }
  if (r.status !== 429) return;
  const d = await r.json().catch(() => ({}));
  const msg = d.error || "You've hit today's free limit. Get Wezzet Pro for unlimited use, or come back tomorrow.";
  wzProPopup({ text: msg });
  throw new Error(msg);
}

// Popup offering Wezzet Pro. opts: { title, text, cta, href }.
export function wzProPopup(opts = {}) {
  if (!document.getElementById("wz-pro-style")) {
    const st = document.createElement("style"); st.id = "wz-pro-style";
    st.textContent = `.wz-pro-dlg{border:1px solid var(--line,#e2e2e2);border-radius:16px;padding:24px;max-width:min(400px,calc(100vw - 32px));background:var(--bg,#fff);color:var(--ink,#1a1a1a);box-shadow:0 20px 60px rgba(0,0,0,.25)}
.wz-pro-dlg::backdrop{background:rgba(0,0,0,.45)}.wz-pro-dlg h2{margin:0 0 8px;font-size:22px}.wz-pro-dlg p{margin:0 0 12px;color:var(--ink-soft,#5c5c5c);line-height:1.5}
.wz-pro-dlg .wz-pro-price{color:var(--ink,#1a1a1a);font-weight:600}.wz-pro-dlg .wz-pro-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}`;
    document.head.append(st);
  }
  document.getElementById("wz-pro-dlg")?.remove();
  const d = document.createElement("dialog"); d.id = "wz-pro-dlg"; d.className = "wz-pro-dlg";
  const h = document.createElement("h2"); h.textContent = opts.title || "Get Wezzet Pro";
  const p = document.createElement("p"); p.textContent = opts.text || "You've hit today's free limit.";
  const price = document.createElement("p"); price.className = "wz-pro-price"; price.textContent = opts.price || "Unlimited use of every tool for $5 a month. Cancel any time.";
  const go = document.createElement("a"); go.className = "btn"; go.href = opts.href || "/pro"; go.textContent = opts.cta || "Get Pro";
  const later = document.createElement("button"); later.type = "button"; later.className = "btn btn-quiet"; later.textContent = "Not now";
  later.onclick = () => d.close();
  const row = document.createElement("div"); row.className = "wz-pro-row"; row.append(go, later);
  d.append(h, p, price, row);
  d.addEventListener("close", () => d.remove());
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  document.body.append(d);
  if (d.showModal) d.showModal(); else d.setAttribute("open", "");
  go.focus();
}
window.wzProPopup = wzProPopup;
