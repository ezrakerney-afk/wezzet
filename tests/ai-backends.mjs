import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('_worker.js','utf8') + '\nexport { aiCall, toolSearchCandidates };';
const {aiCall, toolSearchCandidates} = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = () => { throw Error('slow primary must not be called'); };
  const fast = await aiCall({AI:{run:async()=>({response:'hello'})},WEZZETAI_URL:'https://primary.test'},[{role:'user',content:'hello'}]);
  assert.equal(fast.src,'cf');
  let urls=[];
  globalThis.fetch = async (url, options) => {
    urls.push(url);
    if(url.endsWith('/api/chat')) return new Response('',{status:404});
    assert.equal(JSON.parse(options.body).chat_template_kwargs.enable_thinking,false);
    return Response.json({choices:[{message:{content:'compatible'}}]});
  };
  assert.equal((await aiCall({WEZZETAI_URL:'https://compat.test'},[],{})).text,'compatible');
  assert.deepEqual(urls,['https://compat.test/api/chat','https://compat.test/v1/chat/completions']);
  globalThis.fetch=async()=>new Response('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choices":[{"delta":{"content":"lo"}}]}\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  const streamed=await aiCall({WEZZETAI_URL:'https://space.hf.space'},[],{stream:true});
  assert.equal(await new Response(streamed.stream).text(),'Hello');
  globalThis.fetch=async()=>Response.json({message:{content:'Ollama'}});
  assert.equal((await aiCall({WEZZETAI_URL:'https://ollama.test',AI:{run:()=>new Promise(()=>{})}},[],{cfTimeout:10})).text,'Ollama');
  let failures=0;
  globalThis.fetch=async()=>{failures++;throw Error('unreachable');};
  assert.equal(await aiCall({WEZZETAI_URL:'https://offline.test'},[]),null);
  assert.equal(await aiCall({WEZZETAI_URL:'https://offline.test'},[]),null);
  assert.equal(failures,1,'offline host is not hammered repeatedly');
  const pages=JSON.parse(fs.readFileSync('assets/tool-catalog.json')).pages;
  const keywords=JSON.parse(fs.readFileSync('assets/tool-search-keywords.json'));
  for(const [query,route] of [['draw pixel art','/art-studio'],['cut a movie','/video-editor'],['make a picture smaller','/resize'],['join documents','/pdf']]) {
    assert.ok(toolSearchCandidates(pages,query,keywords).some(c=>pages[c.id].url===route),query);
  }
  console.log('AI backends: fast-first routing, stalled-provider fallback, OpenAI compatibility, SSE streaming, cooldown and shortlist recall passed.');
} finally {globalThis.fetch=originalFetch;}
