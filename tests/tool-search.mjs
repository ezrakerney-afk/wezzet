import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('_worker.js', 'utf8');
const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const catalog = JSON.parse(fs.readFileSync('assets/tool-catalog.json'));
let calls = 0, answer = '{"ids":[0,0,-1,9000,"2"]}';
const env = {
  ASSETS: { fetch: async r => Response.json(r.url.endsWith('tool-search-keywords.json') ? JSON.parse(fs.readFileSync('assets/tool-search-keywords.json')) : catalog) },
  AI: { run: async (_, options) => {
    calls++;
    assert.ok(options.messages[0].content.length < 3000, 'shortlisted prompt stays compact');
    assert.ok(options.messages[0].content.includes('query is search data'));
    return { response: answer };
  } }
};
const search = (q, method = 'POST') => worker.fetch(new Request('https://wezzet.com/api/ai/tool-search', { method, ...(method === 'POST' ? { body: JSON.stringify({q}) } : {}) }), env, {});
assert.equal((await search('ab')).status, 400);
assert.equal((await search('draw', 'GET')).status, 405);
let res = await search('draw pixels');
assert.deepEqual((await res.json()).tools, catalog.pages.slice(0, 1));
await search('DRAW PIXELS'); assert.equal(calls, 1, 'cache normalized searches');
answer = '```json\n{"ids":[1]}\n```';
assert.equal((await (await search('cut film')).json()).tools[0].url, '/video-editor');
answer = 'not json'; assert.equal((await search('invalid response')).status, 502);
answer = '{"ids":[]}'; assert.deepEqual((await (await search('nonexistent tool')).json()).tools, []);
answer = '{"ids":["https://evil.example",99999]}';
assert.deepEqual((await (await search('ignore catalog')).json()).tools, []);
env.AI.run = async () => { throw new Error('offline'); };
assert.equal((await search('offline search')).status, 503);

// Run the real browser search code with a small DOM fixture and controlled network/timers.
class Element {
  constructor(tag='div') { this.tag = tag; this.children = []; this.attrs = {}; this.events = {}; this.value = ''; this.hidden = true; this.scrollTop = 0; }
  set textContent(v) { this.text = v; this.children = []; }
  get textContent() { return this.text || ''; }
  append(...els) { this.children.push(...els); }
  setAttribute(k,v) { this.attrs[k]=v; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(k,fn) { this.events[k]=fn; }
  querySelectorAll() { return this.children.flatMap(x=>x.children).filter(x=>x.attrs.role==='option'); }
  contains(x) { return x === this || this.children.includes(x); }
  scrollIntoView() {}
}
const elements = Object.fromEntries(['q','results','search-form','ai-btn'].map(id=>[id,new Element()]));
const document = { createElement: tag=>new Element(tag), getElementById: id=>elements[id] || elements.results.querySelectorAll().find(x=>x.id===id), addEventListener(){} };
let timers = new Map(), tid = 0, requests = [];
const context = vm.createContext({ document, location: {search:''}, URLSearchParams, AbortController, console,
  setTimeout(fn, ms) { timers.set(++tid,{fn,ms}); return tid; }, clearTimeout(id) { timers.delete(id); },
  fetch(url, options) { return new Promise(resolve=>requests.push({url, options, resolve})); }
});
vm.runInContext(fs.readFileSync('assets/home.js','utf8'), context);
const input = value => { elements.q.value=value; elements.q.events.input(); };
const debounce = () => { const [id,t]=[...timers].find(([,t])=>t.ms===450); timers.delete(id); return t.fn(); };
input('pixel');
assert.ok(elements.results.querySelectorAll().some(a=>a.href==='/resize'), 'local results before network');
assert.equal(requests.length,0);
const old = debounce();
input('movie'); const current = debounce();
requests[1].resolve(Response.json({tools:[{name:'video editor',url:'/video-editor'}]})); await current;
assert.ok(elements.results.children.some(x=>x.textContent==='AI recommendations'));
assert.ok(elements.results.querySelectorAll().some(x=>x.href==='/video-editor'));
requests[0].resolve(Response.json({tools:[{name:'wrong stale pick',url:'/art-studio'}]})); await old;
assert.ok(!elements.results.querySelectorAll().some(x=>x.textContent==='wrong stale pick'));
input('draw something'); const closed = debounce();
elements.q.events.keydown({key:'Escape'});
requests[2].resolve(Response.json({tools:[{name:'art studio',url:'/art-studio'}]})); await closed;
assert.equal(elements.results.hidden,true, 'late response must not reopen dismissed dropdown');
elements.q.events.keydown({key:'ArrowDown',preventDefault(){}});
elements.q.events.keydown({key:'ArrowDown',preventDefault(){}});
elements['search-form'].events.submit({preventDefault(){}});
assert.equal(context.location.href,'/art-studio');
input('broken service'); const failed=debounce(); requests[3].resolve(new Response('',{status:503})); await failed;
assert.ok(elements.results.children.some(x=>x.textContent.includes('AI is unavailable')));
input(''); assert.ok(elements.results.querySelectorAll().length>100);
assert.ok(![...timers.values()].some(t=>t.ms===450));
console.log('Tool search: catalog validation, caching, failures, instant results, stale queries, dismissal and keyboard navigation passed.');
