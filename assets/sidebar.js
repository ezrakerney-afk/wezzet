/* Keep icon-only navigation named for screen readers and hover tooltips. */
document.querySelectorAll('.sidebar nav a').forEach(link => {
  const label = link.textContent.trim().replace(/^[^A-Za-z]+/, '').trim();
  link.setAttribute('aria-label', label);
  link.title = label;
});
