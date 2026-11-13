/* Home navigation, shared account, messages and website support. */
(() => {
  const $ = (id) => document.getElementById(id);
  const account = window.wzAccount;
  const setBadge = (count) =>
    document.querySelectorAll("[data-chat-badge]").forEach((b) => {
      b.hidden = !count;
      b.textContent = count > 99 ? "99+" : String(count);
      b.setAttribute("aria-label", count + " unread messages");
    });
  let checking = false;
  async function refreshMessages() {
    if (document.hidden || checking) return;
    checking = true;
    try {
      const user = await account.call("me");
      if (user.error && user.me !== null) return;
      account.me = user.me || null;
      $("account-link").textContent = account.me
        ? account.me.name
        : "Sign in →";
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
