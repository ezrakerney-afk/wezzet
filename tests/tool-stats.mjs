import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('_worker.js', 'utf8');
const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const catalog = JSON.parse(fs.readFileSync('assets/tool-catalog.json'));
assert.equal(new Set(catalog.pages.map(t => t.url)).size, catalog.pages.length);
assert.equal(catalog.count, catalog.pages.length - 1 + catalog.calculatorFeatures.length);
for (const tool of catalog.pages) assert.ok(fs.existsSync('.' + tool.url + '.html'), tool.url);
const visits = new Map();
const env = {
  ASSETS: { fetch: async request => new URL(request.url).pathname === '/assets/tool-catalog.json'
    ? Response.json(catalog) : new Response('<h1>tool</h1>', {headers: {'content-type': 'text/html'}}) },
  DB: { prepare(sql) {
    return {args: [], bind(...args) {this.args = args; return this;},
      async run() {if (sql.startsWith('INSERT')) visits.set(this.args[0], (visits.get(this.args[0]) || 0) + 1);},
      async all() {return {results: [...visits].map(([path, visits]) => ({path, visits})).sort((a,b) => b.visits-a.visits || a.path.localeCompare(b.path))};}
    };
  } }
};
const pending = [];
const ctx = {waitUntil: promise => pending.push(promise)};
const request = (path, headers={}, method='GET') => new Request('https://wezzet.com'+path, {method,headers});
let r = await worker.fetch(request('/api/tool-stats'),env,ctx);
assert.deepEqual((await r.json()).top, []);
for (const path of ['/words','/words.html','/json','/calc','/qr','/data','/ai']) {
  await worker.fetch(request(path, {'sec-fetch-dest':'document','user-agent':'Mozilla/5.0'}),env,ctx);
}
await Promise.all(pending);
assert.equal(visits.get('/words'),2);
for (const [path, headers] of [
 ['/words',{'sec-fetch-dest':'document','user-agent':'Googlebot'}],
 ['/words',{'sec-fetch-dest':'document','purpose':'prefetch'}],
 ['/words',{}],['/about',{'sec-fetch-dest':'document'}]
]) await worker.fetch(request(path,headers),env,ctx);
await Promise.all(pending);
assert.equal(visits.get('/words'),2); assert.equal(visits.has('/about'),false);
visits.set('/removed-tool',999);
r=await worker.fetch(request('/api/tool-stats'),env,ctx);
const data=await r.json(); assert.equal(data.top.length,5); assert.equal(data.top[0].url,'/words'); assert.equal(data.top[0].visits,2);
assert.equal((await worker.fetch(request('/api/tool-stats',{},'POST'),env,ctx)).status,405);
assert.equal((await worker.fetch(request('/api/tool-stats'),{...env,DB:null},ctx)).status,503);
const page = fs.readFileSync('index.html','utf8');
for (const section of ['tools', 'agents']) {
  assert.ok(page.includes(`class="tool-section" hidden id="${section}"`));
}
assert.ok(page.includes('id="feature-count">'+catalog.count));
console.log('PASS: catalog completeness, canonical counts, ranking order and limit, empty ranking, bot/prefetch exclusion, and unavailable database.');
