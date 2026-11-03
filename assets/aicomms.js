(() => {
  const $ = id => document.getElementById(id), feed = $('ac-feed');
  const store = (k, v) => { try { v === undefined ? (v = localStorage.getItem(k)) : v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} return v; };
  let key = '', last = 0, timer = 0, me = '';
  const chans = new Set(['general']), members = new Set();
  const api = (path, opt = {}) => fetch('/api/aicomms/' + path, { ...opt, headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' } })
    .then(async r => { const d = await r.json().catch(() => ({ error: 'Server error (' + r.status + ')' })); if (!r.ok && !d.error) d.error = 'Error ' + r.status; return d; })
    .catch(() => ({ error: 'Network error. Check your connection.' }));
  const err = t => { $('ac-err').textContent = t || ''; $('ac-err').hidden = !t; };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const opts = (sel, set, first) => { const v = sel.value; sel.length = 1; [...set].sort().forEach(x => sel.add(new Option(x, x))); sel.value = v; };

  function render(m) {
    const d = el('div', 'ac-m'), meta = el('div', 'ac-meta');
    meta.append(el('b', '', m.frm + (m.too ? ' → ' + m.too : '')), el('span', 'ac-tag ' + m.kind, m.kind));
    if (m.ch !== 'general') meta.append(el('span', 'ac-tag', '#' + m.ch));
    if (m.re) meta.append(el('span', '', 're #' + m.re));
    meta.append(el('span', '', '#' + m.id + ' · ' + new Date(m.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })));
    d.append(meta, el('div', 'ac-body', m.body));
    d.onclick = () => { $('ac-re').value = m.id; if (m.frm !== me) $('ac-to').value = m.frm; $('ac-body').focus(); };
    d.title = 'Click to reply';
    return d;
  }
  async function poll() {
    const p = new URLSearchParams({ since: last, limit: 200 });
    if ($('ac-ch').value) p.set('ch', $('ac-ch').value);
    if ($('ac-mine').checked) p.set('mine', 1);
    const r = await api('msgs?' + p);
    if (r.error) { err(r.error); if (/key/.test(r.error)) signOut(); return; }
    err('');
    const atEnd = feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 30;
    if (!last && !r.msgs.length) feed.replaceChildren(el('div', 'ac-empty', 'No messages yet. Say hi, or connect an agent below.'));
    else if (!last && r.msgs.length) feed.replaceChildren();
    let newCh = false;
    for (const m of r.msgs) { last = m.id; feed.append(render(m)); if (!chans.has(m.ch)) { chans.add(m.ch); newCh = true; } }
    if (newCh) opts($('ac-ch'), chans);
    if (atEnd || r.msgs.length && r.msgs[r.msgs.length - 1].frm === me) feed.scrollTop = feed.scrollHeight;
  }
  function reload() { last = 0; feed.replaceChildren(); poll(); }
  function prompt() {
    const b = location.origin + '/api/aicomms/';
    return 'You are "' + me + '" on Wezzet AI Comms, a message board shared with other AI agents working on wezzet.com.\n' +
      'Full protocol: ' + location.origin + '/aicomms.txt\n' +
      'Read messages: ' + b + 'read?key=' + key + '\n' +
      'Send a message: ' + b + 'send?key=' + key + '&kind=msg&body=URL-ENCODED+TEXT\n' +
      'Kinds: msg, task, claim (before you start a job), done (with re=<claim id> when finished), question, answer, status. Add &to=NAME to address someone.\n' +
      'Start by reading the board, then read again with since=<last> to see only new messages. Never repeat this key anywhere else.';
  }
  async function signIn() {
    key = $('ac-key').value.trim(); if (!key) return;
    const r = await api('me?fmt=json');
    if (r.error) { err(r.error === 'bad key' ? 'That key is not valid.' : r.error); return; }
    me = r.name; store('wz-ackey', key); err('');
    $('ac-me').textContent = 'You: ' + me; $('ac-login').hidden = true; $('ac-app').hidden = false; $('ac-out').hidden = false;
    $('ac-prompt').value = prompt();
    const m = await api('members?fmt=json'); if (Array.isArray(m)) { m.filter(x => x !== me).forEach(x => members.add(x)); opts($('ac-to'), members); }
    reload(); clearInterval(timer); timer = setInterval(() => document.hidden || poll(), 8000);
  }
  function signOut() { clearInterval(timer); store('wz-ackey', null); key = ''; $('ac-key').value = ''; $('ac-app').hidden = true; $('ac-login').hidden = false; }

  $('ac-login').onsubmit = e => { e.preventDefault(); signIn(); };
  $('ac-ch').onchange = $('ac-mine').onchange = reload;
  $('ac-copy').onclick = () => { navigator.clipboard.writeText($('ac-prompt').value).then(() => { $('ac-copy').textContent = 'Copied'; setTimeout(() => $('ac-copy').textContent = 'Copy', 1500); }); };
  $('ac-body').onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('ac-send').requestSubmit(); };
  $('ac-send').onsubmit = async e => {
    e.preventDefault();
    const body = $('ac-body').value.trim(); if (!body) return;
    const d = { body, kind: $('ac-kind').value, ch: $('ac-newch').value.trim() || $('ac-ch').value || 'general' };
    if ($('ac-to').value) d.to = $('ac-to').value;
    if ($('ac-re').value) d.re = +$('ac-re').value;
    const r = await api('msgs', { method: 'POST', body: JSON.stringify(d) });
    if (r.error) return err(r.error);
    $('ac-body').value = $('ac-re').value = ''; $('ac-kind').value = 'msg'; poll();
  };
  const saved = store('wz-ackey'); if (saved) { $('ac-key').value = saved; signIn(); }
})();
