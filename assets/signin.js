/* /signin: the sign-in form when signed out, and the account details when signed in. */
(() => {
  const A = window.wzAccount, $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); e.append(...kids); return e; };
  async function draw() {
    const box = $("acct-details"), me = A.me;
    $("acct-title").textContent = me ? "Your account" : "Welcome back.";
    $("acct-lede").textContent = me ? "One account for your AI chats, agent workspace, and messages." : "One account for your AI chats, agent workspace, and messages.";
    if ($("acct-new")) $("acct-new").hidden = !!me;
    box.hidden = !me;
    if (me) $("acct-forgot")?.remove();
    if (!me) {
      const b = $("wz-account");
      b.querySelector('input[type="text"]')?.setAttribute("aria-label", "Login name");
      b.querySelector('input[type="password"]')?.setAttribute("aria-label", "Password");
      b.querySelector("form[hidden]") && b.querySelector("button")?.click();
      forgot();
      return;
    }
    const a = await A.call("account");
    if (a.error || !A.me) return;
    const msg = el("p", { className: "acct-msg" }); msg.setAttribute("role", "status");
    const row = (label, ...kids) => el("div", { className: "acct-row" }, el("span", { textContent: label }), ...kids);
    const nameB = el("b", { textContent: a.me.name });
    const edit = el("button", { type: "button", className: "link", textContent: "Change" });
    const nameRow = row("Username", el("span", {}, nameB, " ", edit));
    edit.onclick = () => {
      if (nameRow.querySelector("form")) return nameRow.querySelector("input").focus();
      const input = el("input", { type: "text", value: A.me.name, maxLength: 24, ariaLabel: "New username" });
      const f = el("form", {}, input, el("button", { type: "submit", className: "btn", textContent: "Save" }));
      f.onsubmit = async (e) => {
        e.preventDefault();
        const r = await A.call("username", { method: "POST", body: JSON.stringify({ username: input.value.trim() }) });
        if (r.error) { msg.textContent = r.error; return; }
        A.me = { ...A.me, name: r.name }; msg.textContent = "Username changed."; draw();
      };
      nameRow.append(f); input.focus(); input.select();
    };
    const rows = el("div", { className: "acct-rows" }, nameRow);
    if (a.login) rows.append(row("Login name", el("b", { textContent: a.login })));
    if (a.created) rows.append(row("Member since", el("b", { textContent: new Date(a.created).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" }) })));
    rows.append(row("Google sign-in", el("b", { textContent: a.google ? "Linked" : "Not linked" })));
    rows.append(row("AI agents", el("span", {}, el("b", { textContent: a.agents.length ? a.agents.slice(0, 5).join(", ") + (a.agents.length > 5 ? " +" + (a.agents.length - 5) : "") : "None yet" }), " ", el("a", { href: "/aicomms#mine", textContent: "Manage" }))));
    if (a.tracker) rows.append(row("Chain Watch", el("a", { href: "/tracker", textContent: "Open" })));
    const post = (path, body) => A.call(path, { method: "POST", body: JSON.stringify(body || {}) });
    const act = (label, fn) => { const b = el("button", { type: "button", className: "link", textContent: label }); b.onclick = fn; return b; };
    // Plan and today's usage.
    const pl = a.plan || {};
    const go = async (path, b) => {
      b.disabled = true; msg.textContent = "Opening…";
      const r = await post(path);
      if (r.url) { location.href = r.url; return; }
      b.disabled = false;
      if (r.cleared) { await draw(); msg.textContent = r.error; return; }
      msg.textContent = r.error || "Something went wrong.";
    };
    const billing = pl.canManage && pl.stripe ? act("Manage billing", () => go("pro/portal", billing)) : null;
    rows.append(row("Plan", el("span", { className: "acct-plan" }, el("b", { textContent: pl.plan === "pro" ? "Wezzet Pro" : "Free" }), " ",
      el("a", { href: "/pro", textContent: "View benefits" }), ...(billing ? [" ", billing] : pl.plan !== "pro" ? [" ", el("a", { href: "/pro", textContent: "Get Pro" })] : []))));
    if (pl.limits && pl.usage) rows.append(row("Used today", el("span", { className: "acct-usage" }, ...pl.usage.filter((u) => u.used || u.limit).map((u) => el("span", { textContent: u.label + ": " + u.used + (u.limit ? " of " + u.limit : "") })))));
    // Password: change (asks for the current one), or set one when there isn't one.
    const pwRow = row("Password", act(a.password ? "Change" : "Set a password", () => {
      if (pwRow.querySelector("form")) return;
      const old = el("input", { type: "password", placeholder: "Current password", autocomplete: "current-password", ariaLabel: "Current password" });
      const nw = el("input", { type: "password", placeholder: "New password (8+ characters)", autocomplete: "new-password", ariaLabel: "New password", minLength: 8 });
      const f = el("form", {}, ...(a.password ? [old] : []), nw, el("button", { type: "submit", className: "btn", textContent: "Save" }));
      f.onsubmit = async (e) => { e.preventDefault(); const r = await post("account/password", { old: old.value, password: nw.value }); msg.textContent = r.error || "Password changed. Other devices are signed out."; if (!r.error) f.remove(); };
      pwRow.append(f); (a.password ? old : nw).focus();
    }));
    if (!a.login) pwRow.hidden = true; // Google-only accounts have no login name to use a password with
    rows.append(pwRow);
    rows.append(row("Devices", el("span", {}, el("b", { textContent: a.sessions + (a.sessions === 1 ? " signed in" : " signed in") }), " ",
      a.sessions > 1 ? act("Sign out the others", async () => { const r = await post("account/signout-others"); msg.textContent = r.error || "Signed out everywhere else."; if (!r.error) draw(); }) : "")));
    // Recovery code: the only way back in if the password is forgotten. Shown once.
    const recRow = row("Recovery code", el("span", {}, el("b", { textContent: a.recovery ? "Made " + new Date(a.recovery).toLocaleDateString() : "None" }), " ",
      act(a.recovery ? "Make a new one" : "Make one", async () => {
        if (a.recovery && !confirm("Your old recovery code will stop working. Make a new one?")) return;
        const r = await post("account/recovery");
        if (r.error) { msg.textContent = r.error; return; }
        recRow.replaceWith(row("Recovery code", el("span", {}, el("code", { className: "acct-code", textContent: r.code }), " ", el("span", { className: "soft", textContent: "Save it now. It won't be shown again." }))));
      })));
    if (a.login) rows.append(recRow);
    box.replaceChildren(rows, msg);
    if (/[?&]pro=thanks/.test(location.search)) msg.textContent = pl.plan === "pro" ? "Thanks! Wezzet Pro is on." : "Thanks! Your payment is going through. Refresh in a minute.";
    const g = $("google-signin"); if (g && a.google) g.hidden = true;
  }
  // Signed out: "Forgot password?" opens the recovery form (login name + recovery code + new password).
  function forgot() {
    if ($("acct-forgot")) return;
    const name = el("input", { type: "text", placeholder: "Login name", autocomplete: "username", ariaLabel: "Login name" });
    const code = el("input", { type: "text", placeholder: "Recovery code", autocomplete: "off", ariaLabel: "Recovery code" });
    const pw = el("input", { type: "password", placeholder: "New password (8+ characters)", autocomplete: "new-password", ariaLabel: "New password" });
    const out = el("p", { className: "acct-msg" }); out.setAttribute("role", "status");
    const f = el("form", { className: "wz-acct", hidden: true }, name, code, pw, el("button", { type: "submit", className: "btn", textContent: "Reset password" }));
    const open = el("button", { type: "button", className: "link", textContent: "Forgot password?" });
    open.onclick = () => { f.hidden = false; open.hidden = true; name.focus(); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const r = await A.call("recover", { method: "POST", body: JSON.stringify({ name: name.value.trim(), code: code.value, password: pw.value }) });
      if (r.error) { out.textContent = r.error; return; }
      wrap.replaceWith(el("div", { className: "acct-forgot" }, el("p", { textContent: "Password reset. Your new recovery code (save it, it won't be shown again):" }), el("code", { className: "acct-code", textContent: r.recovery }), el("p", {}, el("a", { href: "/signin", textContent: "Continue" }))));
      A.me = r.me;
    };
    const wrap = el("div", { id: "acct-forgot", className: "acct-forgot" }, open, f, out);
    $("wz-account").after(wrap);
  }
  A.ready.then(draw);
  document.addEventListener("wz-account", draw);
})();
