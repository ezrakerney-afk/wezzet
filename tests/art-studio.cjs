// Run with: node tests/art-studio.cjs (requires @napi-rs/canvas).
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createCanvas,Image}=require('@napi-rs/canvas');
class Element{
 constructor(){this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.style={};this.dataset={};this.children=[];this.handlers={};this.classList={toggle(){}};this.clientWidth=900;this.clientHeight=700;}
 append(...x){this.children.push(...x);}replaceChildren(...x){this.children=x;}setAttribute(){}addEventListener(k,fn){this.handlers[k]=fn;}getBoundingClientRect(){return {left:0,top:0,width:900,height:700};}setPointerCapture(){}focus(){}click(){this.onclick?.();}remove(){}showModal(){}close(){}
}
const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,['art','overlay'].includes(id)?createCanvas(1600,1200):new Element());return nodes.get(id);};
for(const [key,value] of Object.entries({size:'12',opacity:'100',tolerance:'24',name:'Test',font:'sans-serif','font-size':'48'}))$(key).value=value;
$('background').checked=$('pressure').checked=true;
const context=vm.createContext({console,Image,Blob,URL,document:{getElementById:$,createElement:t=>t==='canvas'?createCanvas(1,1):new Element(),querySelectorAll:()=>[],querySelector:()=>null,body:new Element()},window:{addEventListener(){}},requestAnimationFrame:()=>1,ResizeObserver:class{observe(){}},setTimeout:()=>1,clearTimeout(){},confirm:()=>true,alert(){}});
let source=fs.readFileSync(__dirname+'/../assets/art-studio.js','utf8').replace(/init\(\);\s*$/,'');
vm.runInContext(source+`\nthis.api={reset,render,snapshot,decodeProject,applyProject,travel,selectTool,setColor,point,fit,view,flood,commit,current,getState:()=>({width,height,layers,active,zoom,panX,panY,stroke,gesture,historyIndex,baseCanvas}),setView:()=>{zoom=1;panX=0;panY=0;},setBrush:(b,s,o)=>{brush=b;size=s;opacity=o;}};`,context);
const a=context.api, vp=$('viewport');
const event=(x,y,id=1,type='mouse',pressure=.5)=>({clientX:x,clientY:y,pointerId:id,pointerType:type,pressure,button:0,preventDefault(){}});
const send=(type,e)=>vp.handlers[type]({...e,type});
const pixel=(x,y,c=a.current().canvas)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
const draw=(tool,x,y,xx,yy)=>{a.selectTool(tool);send('pointerdown',event(x,y));send('pointermove',event(xx,yy));send('pointerup',event(xx,yy));};
(async()=>{
 a.reset(200,200);a.setView();a.setColor('#ff0000');a.setBrush('ink',12,1);draw('brush',20,30,150,30);assert.deepEqual(pixel(80,30),[255,0,0,255]);assert.equal(pixel(80,50)[3],0);
 await a.travel(-1);assert.equal(pixel(80,30)[3],0);await a.travel(1);assert.equal(pixel(80,30)[3],255);
 draw('eraser',80,20,80,40);assert.equal(pixel(80,30)[3],0);await a.travel(-1);
 a.setBrush('ink',12,.5);draw('brush',20,70,150,70);assert.ok(pixel(80,70)[3]>=127&&pixel(80,70)[3]<=128,'Opacity must not compound across dabs');
 a.setBrush('ink',4,1);$('fill-shapes').checked=true;draw('rectangle',20,100,80,150);assert.equal(pixel(40,120)[3],255);assert.equal(pixel(90,120)[3],0);
 a.setColor('#0000ff');a.flood({x:40,y:120});assert.deepEqual(pixel(40,120),[0,0,255,255]);assert.equal(pixel(90,120)[3],0);
 $('add-layer').onclick();assert.equal(a.getState().layers.length,2);a.setColor('#00ff00');draw('brush',20,30,150,30);a.render();assert.deepEqual(pixel(40,30,$('art')),[0,255,0,255]);
 $('layer-opacity').value='50';$('layer-opacity').oninput();$('layer-opacity').onchange();a.render();assert.ok(pixel(40,30,$('art'))[0]>120);$('layer-opacity').value='100';$('layer-opacity').oninput();$('layer-opacity').onchange();
 $('duplicate-layer').onclick();assert.equal(a.getState().layers.length,3);$('delete-layer').onclick();assert.equal(a.getState().layers.length,2);$('merge-layer').onclick();assert.equal(a.getState().layers.length,1);
 const saved=a.snapshot(),decoded=await a.decodeProject(saved);a.applyProject(saved,decoded);assert.deepEqual(pixel(40,30),[0,255,0,255]);await assert.rejects(()=>a.decodeProject({...saved,width:100000}));await assert.rejects(()=>a.decodeProject({...saved,layers:[{data:'https://example.com/image.png'}]}));
 a.setView();const before=a.current().canvas.toDataURL();a.selectTool('brush');send('pointerdown',event(50,170,1,'touch'));send('pointermove',event(80,170,1,'touch'));send('pointerdown',event(100,170,2,'touch'));assert.equal(a.current().canvas.toDataURL(),before,'Second finger must cancel the initial mark');send('pointermove',event(150,170,2,'touch'));assert.ok(a.getState().zoom>1);send('pointerup',event(80,170,1,'touch'));send('pointerup',event(150,170,2,'touch'));assert.equal(a.getState().gesture,null);
 a.setView();a.selectTool('brush');send('pointerdown',event(50,180));send('pointercancel',event(50,180));assert.equal(a.current().canvas.toDataURL(),before,'Canceled stroke must restore the canvas');
 $('pen-only').checked=true;send('pointerdown',event(50,100,1,'touch'));send('pointermove',event(80,120,1,'touch'));send('pointerup',event(80,120,1,'touch'));assert.equal(a.current().canvas.toDataURL(),before,'Pen-only finger panning must not paint');$('pen-only').checked=false;
 a.setView();a.setBrush('ink',30,1);a.selectTool('brush');send('pointerdown',event(160,150,3,'pen',.1));send('pointerup',event(160,150,3,'pen',.1));assert.equal(pixel(168,150)[3],0);send('pointerdown',event(160,175,3,'pen',1));send('pointerup',event(160,175,3,'pen',1));assert.equal(pixel(168,175)[3],255);
 $('background').checked=false;a.render();assert.equal(pixel(199,199,$('art'))[3],0);const png=$('art').toBuffer('image/png');assert.equal(png.readUInt32BE(16),200);assert.equal(png.readUInt32BE(20),200);
 a.reset(200,200);a.setView();a.selectTool('fill');const blank=a.current().canvas.toDataURL();send('pointerdown',event(20,20,1,'touch'));assert.equal(a.current().canvas.toDataURL(),blank,'Touch fill waits for release');send('pointerdown',event(100,100,2,'touch'));send('pointerup',event(100,100,2,'touch'));send('pointerup',event(20,20,1,'touch'));assert.equal(a.current().canvas.toDataURL(),blank,'Pinch must not fill');
 a.setView();send('pointerdown',event(20,20,1,'touch'));send('pointerup',event(20,20,1,'touch'));assert.equal(pixel(20,20)[3],255,'Touch fill applies on release');
 a.reset(200,200);a.setView();a.selectTool('brush');a.setBrush('ink',10,1);send('pointerdown',event(30,40,1,'pen',1));send('pointerdown',event(100,100,2,'touch'));send('pointermove',event(60,40,1,'pen',1));send('pointerup',event(60,40,1,'pen',1));send('pointerup',event(100,100,2,'touch'));assert.equal(pixel(45,40)[3],255,'Palm touch must not interrupt pen stroke');
 $('flip-layer').onclick();assert.equal(pixel(155,40)[3],255);assert.equal(pixel(45,40)[3],0);$('rotate-layer').onclick();assert.equal(pixel(159,155)[3],255);await a.travel(-1);assert.equal(pixel(155,40)[3],255);
 console.log('PASS: stroke pixels, non-compounding opacity, erasing, undo/redo, shapes, bounded fill, layer compositing/opacity/duplicate/delete/merge, project round trip and validation, touch pinch cancellation, pointer cancellation, pen-only panning, stylus pressure, transparent full-resolution PNG, deferred touch fills, pen/palm interaction, flips and rotations.');
})().catch(e=>{console.error(e);process.exitCode=1;});
