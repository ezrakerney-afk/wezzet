const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createCanvas,loadImage,DOMMatrix,Path2D,ImageData}=require('@napi-rs/canvas');
const root=__dirname+'/../';
class Element{
 constructor(){this.value='';this.hidden=false;this.disabled=false;this.children=[];this.files=[];}
 append(...items){this.children.push(...items);} replaceChildren(...items){this.children=items;} add(v){this.children.push(v);}
 setAttribute(){} getContext(){} querySelectorAll(){return this.children.map(c=>c.children[0]);}
}
const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
let saved;
function canvas(){const c=createCanvas(1,1);c.toBlob=async(cb,type)=>cb(new Blob([await c.encode(type==='image/jpeg'?'jpeg':type==='image/webp'?'webp':'png')],{type}));return c;}
const document={getElementById:$,createElement:tag=>tag==='canvas'?canvas():new Element()};
const common=fs.readFileSync(root+'assets/studio-common.js','utf8').replaceAll('export ','');
const context=vm.createContext({document,console,Blob,URL,setTimeout,clearTimeout,Option:function(label,value){this.label=label;this.value=value;},createImageBitmap:async file=>{const image=await loadImage(file.bytes);image.close=()=>{};return image;}});
vm.runInContext(common+'\nthis.testCommon={stamp,readCaptions,subtitles};',context);
const {stamp,readCaptions,subtitles}=context.testCommon;
assert.equal(stamp(59.9996),'00:01:00,000');assert.equal(stamp(3661.25),'01:01:01,250');
assert.throws(()=>readCaptions('0 | 2 | a\n1 | 3 | b'));assert.throws(()=>readCaptions('2 | 1 | bad'));assert.throws(()=>readCaptions('NaN | 3 | bad'));
assert.match(subtitles(readCaptions('0 | 1.5 | Hello\n1.5 | 3 | world'),'vtt'),/^WEBVTT\n\n00:00:00.000 --> 00:00:01.500\nHello/);
assert.match(subtitles(readCaptions('0 | 1 | Hello'),'srt'),/^1\n00:00:00,000 --> 00:00:01,000/);
context.capture=(blob,name)=>{saved={blob,name};};vm.runInContext('save=(blob,name)=>capture(blob,name)',context);
elements.set('canvas',canvas());
vm.runInContext(fs.readFileSync(root+'assets/image-editor.js','utf8').replace(/^import .*\n/,''),context);
(async()=>{
 const source=createCanvas(80,60),ctx=source.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,40,60);ctx.fillStyle='blue';ctx.fillRect(40,0,40,60);
 $('file').files=[{name:'sample.png',bytes:source.toBuffer('image/png')}];await $('file').onchange();
 assert.equal($('canvas').width,80);assert.equal($('canvas').height,60);
 $('rotate').onclick();assert.equal($('canvas').width,60);assert.equal($('canvas').height,80);
 $('reset').onclick();$('flip').onclick();assert.deepEqual([...$('canvas').getContext('2d').getImageData(0,0,1,1).data],[0,0,255,255]);
 $('x').value=100;$('y').value=0;$('cw').value=20;$('ch').value=20;$('crop').onclick();assert.match($('status').textContent,/fit inside/);assert.equal($('canvas').width,80);
 $('x').value=0;$('cw').value=20;$('ch').value=20;$('crop').onclick();assert.equal($('canvas').width,20);
 $('width').value=40;$('width').oninput();assert.equal($('height').value,40);$('format').value='png';await $('save').onclick();
 assert.equal(saved.name,'sample-edited.png');const image=await loadImage(Buffer.from(await saved.blob.arrayBuffer()));assert.equal(image.width,40);assert.equal(image.height,40);
 $('width').value=10000;$('height').value=10000;await $('save').onclick();assert.match($('status').textContent,/24 megapixels/);
 console.log('PASS image decode, rotate, flip pixels, reset, crop bounds, aspect ratio, PNG export and memory bounds');
 const calcContext=vm.createContext({document,console,Option:context.Option});
 vm.runInContext("const $=id=>document.getElementById(id);"+fs.readFileSync(root+'assets/calculators.js','utf8').replace(/^import .*\n/,'').replace('export const','const')+'\nthis.calcs=calculations;',calcContext);
 const answers=[0,100,Math.PI,Math.PI,4/3*Math.PI,.5,5,10,5,.5,3,24];
 calcContext.calcs.forEach((c,i)=>assert.ok(Math.abs(c[3](c[2].map(x=>x[1]))-answers[i])<1e-9));
 assert.throws(()=>calcContext.calcs[0][3]([1,0]));assert.throws(()=>calcContext.calcs[7][3]([1,0]));
 console.log('PASS 12 calculator formulas and zero denominators; subtitle timestamps, formatting and validation');
 const workerSource=fs.readFileSync(root+'_worker.js','utf8');
 const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(workerSource).toString('base64'));
 for(const task of ['quiz','rewrite','rewritecode']){
  let call;
  const env={AI:{run:async(model,payload)=>{call=payload;return {response:task==='quiz'?'{}':'Rewritten text'};}}};
  const request=text=>new Request('https://wezzet.com/api/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({task,text})});
  const result=await worker.fetch(request('Sample notes'),env,{});assert.equal(result.status,200);assert.equal(call.messages[1].content,'Sample notes');assert.ok(call.messages[0].content.length>50);
  assert.equal((await worker.fetch(request(''),env,{})).status,400);
  assert.equal((await worker.fetch(request('hello'),{},{})).status,503);
 }
 console.log('PASS AI quiz/rewrite task routing, empty input rejection and service-unavailable responses');
 // Run the real PDF extraction and DOCX packaging modules with a minimal UI.
 global.DOMMatrix=DOMMatrix;global.Path2D=Path2D;global.ImageData=ImageData;
 const pdfjs=await import(root+'vendor/pdfjs-4.10.38/pdf.min.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc=root+'vendor/pdfjs-4.10.38/pdf.worker.min.mjs';
 const pdfCtx=vm.createContext({document,console,Blob,URL,pdfjs,$,window:{}});
 vm.runInContext(fs.readFileSync(root+'vendor/fflate-0.8.3.min.js','utf8'),pdfCtx);pdfCtx.window.fflate=pdfCtx.fflate;
 let blob;
 pdfCtx.URL={createObjectURL:b=>{blob=b;return 'blob:test';},revokeObjectURL:()=>{}};
 let pdfSource=fs.readFileSync(root+'assets/pdf-to-word.js','utf8').replace(/^import .*\n/gm,'').replace(/^pdfjs.GlobalWorkerOptions.workerSrc=.*\n/m,'');
 vm.runInContext(pdfSource,pdfCtx);
 const bytes=fs.readFileSync(root+'tests/fixtures/two-pages.pdf');$('file').files=[{name:'sample.pdf',size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}];
 await $('run').onclick();assert.equal($('download').hidden,false,$('status').textContent);
 fs.writeFileSync(require('node:path').join(require('node:os').tmpdir(),'wezzet-test-result.docx'),Buffer.from(await blob.arrayBuffer()));
 console.log('PASS real two-page PDF extraction and editable DOCX generation');
})().catch(e=>{console.error(e);process.exitCode=1;});
