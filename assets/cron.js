/* Cron expression explainer. Core is shared with /api/cron in _worker.js. */
(() => {
// Cron core (shared by /cron page and /api/cron). 5 fields: minute hour day-of-month month day-of-week.
const CRON_MAC = { '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *', '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *' };
const CRON_MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], CRON_DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const CRON_F = [['minute', 0, 59], ['hour', 0, 23], ['day of month', 1, 31], ['month', 1, 12, CRON_MON], ['day of week', 0, 7, CRON_DOW]];
function cronParse(expr) {
  const src = String(expr || '').trim().toLowerCase();
  const parts = (CRON_MAC[src] || src).split(/\s+/);
  if (parts.length === 6) parts.shift(); // seconds field: ignored
  if (parts.length !== 5) throw new Error('need 5 fields: minute hour day-of-month month day-of-week');
  return parts.map((p, i) => {
    const [name, lo, hi, names] = CRON_F[i], set = new Set();
    const num = s => { const n = names && names.indexOf(s.slice(0, 3)) >= 0 ? names.indexOf(s.slice(0, 3)) + (i === 3 ? 1 : 0) : /^\d+$/.test(s) ? +s : NaN; if (!(n >= lo && n <= hi)) throw new Error('bad ' + name + ': ' + s); return n; };
    for (const item of p.split(',')) {
      const m = item.match(/^(\*|\?|[a-z0-9]+(?:-[a-z0-9]+)?)(?:\/(\d+))?$/);
      if (!m) throw new Error('bad ' + name + ': ' + item);
      let a = lo, b = hi;
      if (m[1] !== '*' && m[1] !== '?') { const r = m[1].split('-'); a = num(r[0]); b = r[1] ? num(r[1]) : (m[2] ? hi : a); }
      const step = m[2] ? +m[2] : 1;
      if (!step || a > b) throw new Error('bad ' + name + ': ' + item);
      for (let v = a; v <= b; v += step) set.add(i === 4 && v === 7 ? 0 : v);
    }
    return { all: p === '*' || p === '?', set, raw: p };
  });
}
function cronMatchDay(f, dom, mon, dow) {
  if (!f[3].set.has(mon)) return false;
  const d = f[2].set.has(dom), w = f[4].set.has(dow);
  return f[2].all || f[4].all ? d && w : d || w;
}
function cronNext(f, n, tz, from) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' });
  const W = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const P = t => { const o = {}; for (const x of fmt.formatToParts(t)) o[x.type] = x.value; return { mo: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, w: W[o.weekday] }; };
  const out = []; let t = Math.floor((from || Date.now()) / 60000) * 60000 + 60000;
  for (let i = 0; i < 200000 && out.length < n; i++) {
    const p = P(t);
    if (!cronMatchDay(f, p.d, p.mo, p.w)) { t += ((23 - p.h) * 60 + 60 - p.mi) * 60000; continue; }
    if (!f[1].set.has(p.h)) { t += (60 - p.mi) * 60000; continue; }
    if (!f[0].set.has(p.mi)) { t += 60000; continue; }
    out.push(t); t += 60000;
  }
  return out;
}
function cronDescribe(f) {
  const pad = n => String(n).padStart(2, '0');
  const list = (s, fn) => { const a = [...s].sort((x, y) => x - y); const r = []; for (let i = 0; i < a.length; i++) { let j = i; while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++; r.push(j - i >= 2 ? fn(a[i]) + ' to ' + fn(a[j]) : j > i ? fn(a[i]) + ', ' + fn(a[j]) : fn(a[i])); i = j; } return r.length > 1 ? r.slice(0, -1).join(', ') + ' and ' + r[r.length - 1] : r[0]; };
  const step = (fl, unit) => { const m = fl.raw.match(/^(?:\*|0)\/(\d+)$/); return m ? 'every ' + m[1] + ' ' + unit + 's' : null; };
  const [mi, h, dom, mon, dow] = f;
  let s;
  if (mi.set.size === 1 && h.set.size === 1) s = 'At ' + pad([...h.set][0]) + ':' + pad([...mi.set][0]);
  else if (mi.set.size === 1 && h.set.size <= 6) s = 'At ' + [...h.set].sort((a, b) => a - b).map(x => pad(x) + ':' + pad([...mi.set][0])).join(', ');
  else {
    const sm = step(mi, 'minute');
    s = mi.all ? 'Every minute' : sm ? sm[0].toUpperCase() + sm.slice(1) : 'At minute ' + list(mi.set, String) + (h.all ? ' of every hour' : '');
    const hs = [...h.set].sort((a, b) => a - b), run = hs.length > 1 && hs[hs.length - 1] - hs[0] === hs.length - 1;
    if (!h.all) s += step(h, 'hour') ? ', ' + step(h, 'hour') : run ? ', from ' + pad(hs[0]) + ':00 to ' + pad(hs[hs.length - 1]) + ':59' : ', during hour ' + list(h.set, pad);
  }
  if (!dom.all) s += ', on day ' + list(dom.set, String) + ' of the month';
  if (!dow.all) s += (dom.all ? ', on ' : ', or on ') + list(dow.set, x => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][x]);
  if (!mon.all) s += ', in ' + list(mon.set, x => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][x - 1]);
  return s;
}
  const $ = (id) => document.getElementById(id);
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const tzSel = $("tz");
  const zones = (Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : [local]);
  tzSel.innerHTML = ["UTC", ...zones.filter((z) => z !== "UTC")].map((z) => `<option${z === local ? " selected" : ""}>${z}</option>`).join("");
  const fmt = (t, tz) => new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(t);
  function run() {
    const e = $("expr").value.trim();
    try { history.replaceState(null, "", e ? "#" + encodeURIComponent(e) : location.pathname); } catch (x) {}
    if (!e) { $("desc").textContent = " "; $("next").innerHTML = ""; return; }
    try {
      const f = cronParse(e), tz = tzSel.value;
      $("desc").textContent = cronDescribe(f);
      $("desc").classList.remove("bad");
      $("next").innerHTML = cronNext(f, 10, tz).map((t) => `<li>${fmt(t, tz)}</li>`).join("") || "<li>No runs in the next few years.</li>";
    } catch (x) { $("desc").textContent = x.message; $("desc").classList.add("bad"); $("next").innerHTML = ""; }
  }
  document.querySelectorAll("[data-cron]").forEach((b) => b.addEventListener("click", () => { $("expr").value = b.dataset.cron; run(); }));
  $("expr").addEventListener("input", run); tzSel.addEventListener("change", run);
  if (location.hash.length > 1) try { $("expr").value = decodeURIComponent(location.hash.slice(1)); } catch (x) {}
  run();
})();
