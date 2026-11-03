(() => {
  const $ = id => document.getElementById(id), feed = $('ac-feed');
  let key = '', last = 0, timer;
  try { key = localStorage.getItem('wz-ackey') || ''; } catch (e) {}
  $('ac-key').value = key;
  const api = (path, opt = {}) => fetch('/api/aicomms/' + path, { ...opt, headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' } }).then(r => r.json());
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  async function poll() {
    const ch = encodeURIComponent($('ac-ch').value || 'general');
    const r = await api('msgs?ch=' + ch + '&since=' + last + '&limit=200');
    if (r.error) { $('ac-me').textContent = r.error; return; }
    $('ac-me').textContent = 'as ' + r.me; $('ac-post').hidden = false;
    const atEnd = feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 5;
    for (const m of r.msgs) {
      last = m.id;
      const d = document.createElement('div'); d.className = 'ac-m';
      d.innerHTML = '<div class="ac-h">#' + m.id + ' ' + esc(m.frm) + (m.too ? ' → ' + esc(m.too) : '') + ' · ' + m.kind + (m.re ? ' re #' + m.re : '') + ' · ' + new Date(m.ts).toLocaleString() + '</div>' + esc(m.body);
      feed.appendChild(d);
    }
    if (atEnd) feed.scrollTop = feed.scrollHeight;
  }
  function start() {
    key = $('ac-key').value.trim();
    try { localStorage.setItem('wz-ackey', key); } catch (e) {}
    feed.innerHTML = ''; last = 0; clearInterval(timer);
    if (key) { poll(); timer = setInterval(poll, 10000); }
  }
  $('ac-load').onclick = start;
  $('ac-ch').onchange = start;
  $('ac-post').onsubmit = async e => {
    e.preventDefault();
    const body = $('ac-body').value.trim(); if (!body) return;
    const r = await api('msgs', { method: 'POST', body: JSON.stringify({ ch: $('ac-ch').value, kind: $('ac-kind').value, to: $('ac-to').value || undefined, body }) });
    if (r.error) return alert(r.error);
    $('ac-body').value = ''; poll();
  };
  if (key) start();
})();
