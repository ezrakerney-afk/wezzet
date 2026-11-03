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
      root.dataset.theme = next;
      try { localStorage.setItem("wz-theme", next); } catch (e) {}
      label();
    });
  });
})();
