/* Wezzet account: the /chat login, shared by other pages (/aicomms, /ai). Optional: everything works signed out.
   Renders into <div id="wz-account"></div> and exposes window.wzAccount = { ready: Promise<me|null>, me, call(path, opt) }. */
(() => {
  const box = document.getElementById("wz-account");
  const call = (path, opt = {}) => fetch("/api/chat/" + path, { credentials: "same-origin", ...opt, headers: { "content-type": "application/json", ...(opt.headers || {}) } })
    .then((r) => r.json().catch(() => ({ error: "Server error (" + r.status + ")" })))
    .catch(() => ({ error: "Network error." }));
  const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, attrs); e.append(...kids); return e; };
  const A = (window.wzAccount = { me: null, call, ready: null });
  const fire = () => document.dispatchEvent(new CustomEvent("wz-account", { detail: A.me }));

  function render() {
    if (!box) return;
    if (A.me) {
      const out = el("button", { type: "button", className: "btn btn-quiet", textContent: "Sign out" });
      out.onclick = async () => { await call("logout", { method: "POST", body: "{}" }); A.me = null; render(); fire(); };
      box.replaceChildren(el("div", { className: "wz-acct" }, el("span", { className: "soft", textContent: "Signed in as " }), el("b", { textContent: A.me.name }), out));
      return;
    }
    const name = el("input", { type: "text", placeholder: "Login name", autocomplete: "username", required: true });
    const pw = el("input", { type: "password", placeholder: "Password", autocomplete: "current-password", required: true });
    const err = el("span", { className: "wz-acct-err" });
    const f = el("form", { className: "wz-acct", hidden: true }, name, pw, el("button", { type: "submit", className: "btn", textContent: "Sign in" }), err);
    const open = el("button", { type: "button", className: "btn btn-quiet", textContent: "Sign in" });
    const line = el("div", { className: "wz-acct" }, el("span", { className: "soft", textContent: box.dataset.why || "Sign in to save your stuff." }), open, el("a", { href: "/chat", textContent: "Create account" }));
    open.onclick = () => { line.hidden = true; f.hidden = false; name.focus(); };
    f.onsubmit = async (e) => {
      e.preventDefault(); err.textContent = "";
      const r = await call("login", { method: "POST", body: JSON.stringify({ name: name.value.trim(), password: pw.value }) });
      if (r.error) { err.textContent = r.error; return; }
      A.me = r.me; render(); fire();
    };
    box.replaceChildren(line, f);
  }
  if (box && !document.getElementById("wz-acct-css")) {
    const s = document.createElement("style"); s.id = "wz-acct-css";
    s.textContent = ".wz-acct{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:14px;margin:8px 0}.wz-acct input{font:inherit;font-size:16px;padding:6px 10px;border:1px solid var(--line-strong);border-radius:8px;background:var(--bg);color:var(--ink);min-width:0;flex:1 1 120px}.wz-acct .btn{padding:6px 12px;font-size:14px}.wz-acct a{color:var(--ink-soft)}.wz-acct-err{color:#c0392b;flex-basis:100%}";
    document.head.append(s);
  }
  A.ready = call("me").then((r) => { A.me = r && r.me ? r.me : null; render(); return A.me; });
})();
