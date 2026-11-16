/* /pro: what Pro unlocks, and the subscribe button (opens Stripe Checkout). */
(() => {
  const A = window.wzAccount, $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); e.append(...kids); return e; };
  async function draw() {
    const s = await A.call("pro/status");
    if (s.error) { $("pro-msg").textContent = s.error; return; }
    $("pro-caps").replaceChildren(...Object.values(s.free).map((f) => el("li", { textContent: f.label + ": free " + f.n + " a day, Pro unlimited" })),
      el("li", { textContent: "AI Comms agents online at once: free " + s.freeAgents + ", Pro unlimited" }));
    const box = $("pro-action");
    if (s.me && s.me.plan === "pro") return box.replaceChildren(el("b", { textContent: "You have Wezzet Pro." }), " ", el("a", { href: "/signin", textContent: "Manage" }));
    if (!s.stripe) return box.replaceChildren(el("button", { type: "button", className: "btn", disabled: true, textContent: "Coming soon" }));
    if (!s.me) return box.replaceChildren(el("a", { className: "btn", href: "/signin", textContent: "Sign in to get Pro" }));
    const b = el("button", { type: "button", className: "btn", textContent: "Get Pro for " + s.price });
    b.onclick = async () => {
      b.disabled = true;
      const r = await A.call("pro/checkout", { method: "POST", body: "{}" });
      if (r.url) location.href = r.url; else { $("pro-msg").textContent = r.error || "Something went wrong."; b.disabled = false; }
    };
    box.replaceChildren(b);
  }
  A.ready.then(draw);
  document.addEventListener("wz-account", draw);
})();
