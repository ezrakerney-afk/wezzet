/* Home navigation, shared account, messages and website support. */
(() => {
  const $ = (id) => document.getElementById(id);
  const account = window.wzAccount;
  const setBadge = (count) => {
    count = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    $("messages-toggle").setAttribute("aria-label", count ? `Messages, ${count} unread` : "Messages");
    document.querySelectorAll("[data-chat-badge]").forEach((b) => {
      b.hidden = !count;
      b.textContent = count > 99 ? "99+" : String(count);
      b.setAttribute("aria-label", count + " unread messages");
    });
  };
  window.addEventListener("message", event => {
    if (event.origin === location.origin && event.source === $("chat-frame").contentWindow && event.data?.type === "wz-chat-unread") setBadge(event.data.count);
  });
  let checking = false;
  async function refreshMessages() {
    if (document.hidden || checking) return;
    checking = true;
    try {
      const user = await account.call("me");
      if (user.error && user.me !== null) return;
      account.me = user.me || null;
      showAccount();
      if (!account.me) {
        setBadge(0);
        return;
      }
      const rooms = await account.call("rooms");
      if (rooms.error) return;
      const unread = [...(rooms.dms || []), ...(rooms.groups || [])].reduce(
        (n, r) => n + (r.unread || 0),
        0,
      );
      setBadge(unread);
    } finally {
      checking = false;
    }
  }
  // Top-right account button: signed out it links to /signin; signed in it opens a menu with the account details.
  const link = $("account-link"), menu = $("account-menu");
  const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); e.append(...kids); return e; };
  let shown;
  function showAccount() {
    const name = account.me ? account.me.name : "";
    if (name === shown) return;
    shown = name;
    if (!name) { link.textContent = "Sign in →"; link.removeAttribute("aria-expanded"); link.removeAttribute("aria-haspopup"); menu.hidden = true; return; }
    link.replaceChildren(el("span", { className: "account-avatar", textContent: name[0].toUpperCase() }), el("span", { className: "account-name", textContent: name }), el("span", { className: "account-caret", textContent: "▾", ariaHidden: "true" }));
    link.setAttribute("aria-haspopup", "true"); link.setAttribute("aria-expanded", "false");
  }
  async function openMenu(open) {
    menu.hidden = !open; link.setAttribute("aria-expanded", String(open));
    if (!open) return;
    const head = el("div", { className: "account-head" }, el("span", { className: "account-avatar big", textContent: account.me.name[0].toUpperCase() }), el("div", {}, el("b", { textContent: account.me.name }), el("span", { id: "account-sub", textContent: "Wezzet account" })));
    const out = el("button", { type: "button", className: "account-out", textContent: "Sign out" });
    out.onclick = async () => { out.disabled = true; await account.call("logout", { method: "POST", body: "{}" }); account.me = null; openMenu(false); showAccount(); setBadge(0); document.dispatchEvent(new CustomEvent("wz-account", { detail: null })); };
    const item = (href, text, note) => el("a", { href }, text, note ? el("span", { textContent: note }) : "");
    const links = el("nav", { ariaLabel: "Account" }, item("/signin", "Account details"), item("/chat", "Messages"), item("/ai", "WezzetAI"), item("/aicomms#mine", "My AI agents"));
    menu.replaceChildren(head, links, out);
    const a = await account.call("account");
    if (a.error || menu.hidden) return;
    const since = a.created ? "Member since " + new Date(a.created).toLocaleDateString([], { month: "short", year: "numeric" }) : "";
    $("account-sub").textContent = [a.login && a.login !== account.me.name ? "Login: " + a.login : "", since].filter(Boolean).join(" · ") || "Wezzet account";
    links.lastChild.append(el("span", { textContent: String(a.agents.length) }));
    if (a.tracker) links.append(item("/tracker", "Chain Watch", "Private"));
  }
  link.onclick = (e) => { if (!account.me) return; e.preventDefault(); openMenu(menu.hidden); };
  document.addEventListener("click", (e) => { if (!menu.hidden && !e.target.closest(".account-wrap")) openMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { openMenu(false); link.focus(); } });

  account.ready.then(refreshMessages);
  setInterval(refreshMessages, 30000);
  window.addEventListener("focus", refreshMessages);
  document.addEventListener("visibilitychange", refreshMessages);
  document.addEventListener("wz-account", refreshMessages);

  function togglePanel(name, open) {
    const panel = $(name + "-panel"),
      button = $(name + "-toggle");
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    if (open) {
      const other = name === "support" ? "messages" : "support";
      $(other + "-panel").hidden = true;
      $(other + "-toggle").setAttribute("aria-expanded", "false");
      if (name === "messages" && !$("chat-frame").getAttribute("src"))
        $("chat-frame").src = "/chat";
      if (name === "support") $("support-input").focus();
    } else {
      button.focus();
      refreshMessages();
    }
  }
  for (const name of ["support", "messages"])
    $(name + "-toggle").onclick = () =>
      togglePanel(name, $(name + "-panel").hidden);
  document
    .querySelectorAll("[data-close]")
    .forEach((b) => (b.onclick = () => togglePanel(b.dataset.close, false)));
  let focusSearch = false;
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      for (const name of ["support", "messages"])
        if (!$(name + "-panel").hidden) togglePanel(name, false);
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      if ($("overview").hidden) {
        focusSearch = true;
        location.hash = "overview";
      } else {
        $("q").focus();
      }
    }
  });

  function selectSection(event) {
    const requested = location.hash.slice(1) || "overview";
    const legacyToolTabs = ["converters", "ai-tools", "utilities"];
    const id = legacyToolTabs.includes(requested) ? "tools"
      : ["tools", "agents"].includes(requested) ? requested : "overview";
    for (const section of ["overview", "tools", "agents"]) {
      $(section).hidden = section !== id;
    }
    document.querySelectorAll("[data-section]").forEach((link) => {
      if (link.dataset.section === id) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    if (focusSearch && id === "overview") {
      focusSearch = false;
      $("q").focus();
    } else if (event && (requested === id || legacyToolTabs.includes(requested))) {
      window.scrollTo(0, 0);
      $(id).querySelector("h1").focus({ preventScroll: true });
    }
  }
  window.addEventListener("hashchange", selectSection);
  selectSection();

  const history = [];
  const message = (text, user = false) => {
    const p = document.createElement("p");
    p.className = "support-message" + (user ? " user" : "");
    p.textContent = text;
    $("support-log").append(p);
    p.scrollIntoView({ block: "nearest" });
    return p;
  };
  $("support-form").onsubmit = async (e) => {
    e.preventDefault();
    const text = $("support-input").value.trim(),
      send = e.currentTarget.querySelector("button");
    if (!text || send.disabled) return;
    message(text, true);
    $("support-input").value = "";
    send.disabled = true;
    const reply = message("Thinking… This can take a minute.");
    try {
      const r = await fetch("/api/ai/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(90000),
        body: JSON.stringify({
          messages: [...history.slice(-8), { role: "user", content: text }],
        }),
      });
      if (r.status === 429)
        throw new Error(
          "You’ve reached the AI limit. Please try again later or use the Contact link below.",
        );
      if (!r.ok)
        throw new Error(
          "Support AI is unavailable right now. Please try again or use the Contact link below.",
        );
      const data = await r.json();
      if (!data.reply) throw new Error("No reply came back. Please try again.");
      reply.textContent = data.reply;
      history.push(
        { role: "user", content: text },
        { role: "assistant", content: data.reply },
      );
    } catch (err) {
      reply.textContent =
        err.name === "TimeoutError"
          ? "That took too long. Please try again or contact us below."
          : err.message;
    } finally {
      send.disabled = false;
      reply.scrollIntoView({ block: "nearest" });
    }
  };
})();
