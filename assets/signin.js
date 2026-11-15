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
    if (!me) {
      const b = $("wz-account");
      b.querySelector('input[type="text"]')?.setAttribute("aria-label", "Login name");
      b.querySelector('input[type="password"]')?.setAttribute("aria-label", "Password");
      b.querySelector("form[hidden]") && b.querySelector("button")?.click();
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
    box.replaceChildren(rows, msg);
    const g = $("google-signin"); if (g && a.google) g.hidden = true;
  }
  A.ready.then(draw);
  document.addEventListener("wz-account", draw);
})();
