/* Light/dark toggle. With no choice saved, the site follows the device setting. */
(() => {
  const root = document.documentElement;
  const sysDark = () => window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : sysDark());
  document.querySelectorAll(".theme-toggle").forEach((b) => {
    const label = () => b.setAttribute("aria-label", isDark() ? "Switch to light mode" : "Switch to dark mode");
    label();
    b.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      const apply = () => { root.dataset.theme = next; try { localStorage.setItem("wz-theme", next); } catch (e) {} label(); };
      // The new theme opens out from the button, where the browser supports it.
      if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
      const r = b.getBoundingClientRect();
      root.style.setProperty("--tx", r.left + r.width / 2 + "px"); root.style.setProperty("--ty", r.top + r.height / 2 + "px");
      root.classList.add("wz-theming");
      const done = () => root.classList.remove("wz-theming");
      document.startViewTransition(apply).finished.finally(done);
      setTimeout(done, 1200); // in case the tab is in the background and the animation never finishes
    });
  });
})();

/* Remember the last few tools used, for the "Recent" row on the homepage. */
(() => {
  const p = location.pathname.replace(/\.html$/, "").replace(/\/$/, "");
  const h = document.querySelector("main h1");
  if (!p || p === "/index" || !h || /^\/(forum|aicomms|chat|404)/.test(p) || document.title.startsWith("Page not found")) return;
  try {
    const list = JSON.parse(localStorage.getItem("wz-recent") || "[]").filter((r) => r && r.u !== p);
    list.unshift({ u: p, n: h.textContent.trim().slice(0, 60) });
    localStorage.setItem("wz-recent", JSON.stringify(list.slice(0, 5)));
  } catch (e) {}
})();
