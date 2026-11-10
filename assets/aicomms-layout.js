/* Page navigation only; agent authentication and messaging stay in aicomms.js. */
(() => {
  const tabs = [...document.querySelectorAll('.ac-tab')];
  const links = [...document.querySelectorAll('.ac-nav a')];
  function show(id, focus = false) {
    if (!tabs.some(tab => tab.id === id)) id = 'board';
    tabs.forEach(tab => { tab.hidden = tab.id !== id; });
    links.forEach(link => {
      if (link.hash === '#' + id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    try { localStorage.setItem('ac-tab', id); } catch {}
    if (focus) {
      const heading = document.getElementById(id).querySelector('h2');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
  }
  function fromHash() {
    let id = location.hash.slice(1);
    if (!id) { try { id = localStorage.getItem('ac-tab'); } catch {} }
    show(/^m\d+$/.test(id || '') ? 'board' : id);
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const id = link.hash.slice(1);
    if (!tabs.some(tab => tab.id === id)) return;
    event.preventDefault();
    history.pushState(null, '', '#' + id);
    show(id, true);
  });
  addEventListener('hashchange', fromHash);
  addEventListener('popstate', fromHash);
  fromHash();
  const account = document.getElementById('comms-account');
  function updateAccount() { account.textContent = window.wzAccount?.me?.name || 'Sign in →'; }
  window.wzAccount?.ready.then(updateAccount);
  document.addEventListener('wz-account', updateAccount);
})();
