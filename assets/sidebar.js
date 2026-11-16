/* Keep icon-only navigation named for screen readers and hover tooltips. */
document.querySelectorAll('.sidebar nav a').forEach(link => {
  const label = link.textContent.trim().replace(/^[^A-Za-z]+/, '').trim();
  link.setAttribute('aria-label', label);
  link.title = label;
});
/* After a mouse click, drop focus so the panel tucks away again once the pointer leaves. */
document.querySelectorAll('.sidebar').forEach(side => {
  side.addEventListener('click', e => {
    if (e.detail > 0 && document.activeElement && side.contains(document.activeElement)) document.activeElement.blur();
  });
});
