import {duration,uid,splitClip,trimClip,removeClip,validateProject,exportArgs,exportSettings,originalExport,sourceShape} from './video-editor-model.mjs?v=2';
import {cacheMedia,cachedMedia} from './video-editor-storage.mjs?v=2';
import {FFmpeg} from '/vendor/ffmpeg-0.12.15/index.js';
const $=id=>document.getElementById(id), canvas=$('preview'), ctx=canvas.getContext('2d');
let p={version:1,ratio:'source',tracks:[{id:uid(),kind:'video',name:'Video 1',muted:false,locked:false},{id:uid(),kind:'audio',name:'Audio 1',muted:false,locked:false}],clips:[],media:[]};
const files=new Map(), elements=new Map();let selected=null,time=0,playing=false,origin=0,zoom=55,undo=[],redo=[],busy=false,loading=false,ff=null,audioContext,exportURL=null,lastExportState=null,pendingRelinkId=null;
const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${(s%60).toFixed(2).padStart(5,'0')}`;
const status=s=>$('status').textContent=s;
const snapshot=()=>JSON.stringify(p);
function remember(){undo.push(snapshot());if(undo.length>80)undo.shift();redo=[];}
function track(c){return p.tracks.find(t=>t.id===c.track);}
function clip(){return p.clips.find(c=>c.id===selected);}
function editable(){return !busy&&!loading&&clip()&&!track(clip()).locked;}
function playbackButton(){const b=$('play');b.setAttribute('aria-pressed',String(playing));b.setAttribute('aria-label',playing?'Pause':'Play');b.title=(playing?'Pause':'Play')+' (Space)';}
function pause(){playing=false;playbackButton();for(const x of elements.values())x.el.pause?.();}
function seek(t){pause();time=Math.max(0,Math.min(t,duration(p)));renderFrame();position();}
function position(){$('playhead').style.left=(155+time*zoom)+'px';$('clock').textContent=`${fmt(time)} / ${fmt(duration(p))}`;}
function assetName(c){return p.media.find(m=>m.id===c.media)?.name||'Missing media';}
function missingMedia(){return p.media.filter(m=>!files.has(m.id)&&p.clips.some(c=>c.media===m.id&&!track(c).muted));}
function refresh(){
 const missing=missingMedia();$('missing-media').hidden=!missing.length;
 $('missing-description').textContent=missing.length?`${missing.length} missing file${missing.length===1?'':'s'}: ${missing.slice(0,3).map(m=>m.name).join(', ')}${missing.length>3?'…':''}. Select the files you used in this project; all your edits will stay in place.`:'';
 if(lastExportState!==snapshot())$('download').hidden=true;
 $('empty').hidden=!!p.clips.length;$('asset-count').textContent=p.media.length+' files';$('assets').replaceChildren();
 for(const m of p.media){const b=document.createElement('button');b.className='asset'+(files.has(m.id)?'':' missing');b.disabled=busy||loading;b.title='Add '+m.name+' at playhead';const icon=document.createElement('span');icon.className='asset-icon';icon.textContent=m.kind==='audio'?'♫':m.kind==='image'?'▧':'▶';const name=document.createElement('span');name.textContent=m.name;const sub=document.createElement('small');sub.textContent=files.has(m.id)?`${m.kind.toUpperCase()} · ${fmt(m.duration)}`:'Missing · import original file';name.append(sub);b.append(icon,name);b.onclick=()=>addMedia(m);$('assets').append(b);}
 const length=Math.max(20,duration(p)+5,time+5);$('timeline').style.width=(155+length*zoom)+'px';$('ruler').replaceChildren();const step=zoom<30?5:zoom<70?2:1;
 for(let i=0;i<=length;i+=step){const tick=document.createElement('span');tick.className='tick';tick.style.left=i*zoom+'px';tick.textContent=fmt(i);$('ruler').append(tick);}
 $('tracks').replaceChildren();
 for(const t of p.tracks){const row=document.createElement('div');row.className='track';const label=document.createElement('div');label.className='track-label';label.textContent=(t.kind==='audio'?'♫  ':'▣  ')+t.name;label.append(document.createElement('br'));
 for(const [key,title] of [['muted',t.kind==='audio'?'Mute':'Hide'],['locked','Lock']]){const b=document.createElement('button');b.textContent=title;b.className=t[key]?'active':'';b.setAttribute('aria-pressed',String(!!t[key]));b.disabled=busy||loading;b.onclick=()=>{remember();t[key]=!t[key];refresh();};label.append(b);}
 const lane=document.createElement('div');lane.className='lane';lane.dataset.track=t.id;lane.onclick=e=>{if(e.target===lane&&!busy)seek((e.clientX-lane.getBoundingClientRect().left)/zoom);};
 for(const c of p.clips.filter(c=>c.track===t.id)){const b=document.createElement('div');b.tabIndex=0;b.setAttribute('role','button');b.setAttribute('aria-label',`${assetName(c)}, ${t.name}, starts ${fmt(c.start)}, duration ${fmt(c.duration)}`);b.className='clip '+t.kind+(c.id===selected?' selected':'');b.style.left=c.start*zoom+'px';b.style.width=Math.max(5,c.duration*zoom)+'px';const title=document.createElement('b');title.textContent=assetName(c);const sub=document.createElement('small');sub.textContent=`${fmt(c.duration)} · ${c.speed}×`;b.append(title,sub);const peaks=files.get(c.media)?.peaks;if(t.kind==='audio'&&peaks){const wave=document.createElementNS('http://www.w3.org/2000/svg','svg');wave.classList.add('waveform');wave.setAttribute('viewBox','0 0 160 20');wave.setAttribute('preserveAspectRatio','none');const source=p.media.find(m=>m.id===c.media);let d='';for(let i=0;i<160;i++){const ix=Math.min(159,Math.floor((c.in+c.duration*c.speed*i/160)/source.duration*160)),amp=Math.max(1,peaks[ix]*9);d+=`M${i},${10-amp}v${amp*2}`;}const line=document.createElementNS('http://www.w3.org/2000/svg','path');line.setAttribute('d',d);wave.append(line);b.append(wave);}for(const edge of ['left','right']){const h=document.createElement('span');h.className='handle '+edge;h.dataset.edge=edge;b.append(h);}b.onpointerdown=e=>drag(e,c);b.onkeydown=e=>{if(e.key==='Enter'){selected=c.id;refresh();}};lane.append(b);}row.append(label,lane);$('tracks').append(row);}
 $('selection-hint').hidden=!!clip();$('properties').hidden=!clip();const c=clip();if(c){$('clip-name').textContent=assetName(c);for(const k of ['start','in','duration','speed','volume'])$('clip-'+k).value=Number(c[k].toFixed(3));$('clip-fade-in').value=c.fadeIn;$('clip-fade-out').value=c.fadeOut;$('volume-value').textContent=Math.round(c.volume*100)+'%';$('volume-label').hidden=track(c).kind!=='audio';for(const el of $('properties').querySelectorAll('input,select'))el.disabled=!!track(c).locked||busy||loading;}
 for(const id of ['split','duplicate','delete','ripple'])$(id).disabled=!editable();$('undo').disabled=!undo.length||busy||loading;$('redo').disabled=!redo.length||busy||loading;$('export').disabled=!p.clips.length||busy||loading;$('play').disabled=!p.clips.length||busy||loading||!!missing.length;
 position();if(!busy)renderFrame();
}
function drag(e,c){if(busy||loading)return;e.preventDefault();selected=c.id;pause();if(track(c).locked){refresh();return;}const startX=e.clientX,initial={...c},before=snapshot(),edge=e.target.dataset.edge;let moved=false;
 const move=ev=>{let d=(ev.clientX-startX)/zoom;Object.assign(c,initial);if(Math.abs(ev.clientX-startX)>2)moved=true;if(edge)trimClip(c,edge,d,p.media.find(m=>m.id===c.media).kind==='image'?86400:p.media.find(m=>m.id===c.media).duration);else{let at=Math.max(0,initial.start+d);if($('snap').checked){const points=[0,time,...p.clips.filter(x=>x.id!==c.id).flatMap(x=>[x.start,x.start+x.duration])];for(const pt of points){if(Math.abs(at-pt)<8/zoom){at=pt;break;}if(Math.abs(at+c.duration-pt)<8/zoom){at=pt-c.duration;break;}}}c.start=Math.max(0,at);const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.lane');const dest=p.tracks.find(t=>t.id===target?.dataset.track);if(dest&&dest.kind===track(initial).kind&&!dest.locked)c.track=dest.id;}refresh();};
 const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',up);if(moved){undo.push(before);redo=[];}refresh();};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);refresh();
}
function newTrack(kind){const t={id:uid(),kind,name:(kind==='video'?'Video ':'Audio ')+(p.tracks.filter(t=>t.kind===kind).length+1),muted:false,locked:false};p.tracks.push(t);return t;}
function freeTrack(kind,start,len){return p.tracks.find(t=>t.kind===kind&&!t.locked&&!p.clips.some(c=>c.track===t.id&&c.start<start+len&&c.start+c.duration>start))||newTrack(kind);}
function addMedia(m){if(busy||loading)return;if(!files.has(m.id)){pendingRelinkId=m.id;status('Choose the original file for '+m.name+'. Renamed files can also be reconnected here.');$('files').click();return;}pause();remember();const len=m.kind==='image'?5:m.duration;const make=kind=>{const c={id:uid(),media:m.id,track:freeTrack(kind,time,len).id,start:time,in:0,duration:len,speed:1,volume:1,fadeIn:0,fadeOut:0};p.clips.push(c);selected=c.id;};if(m.kind!=='audio')make('video');if(m.kind==='audio'||m.hasAudio)make('audio');refresh();status('Added to timeline. Video and audio clips can be moved and edited independently.');}
function waitMedia(el,event){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>done(Error('Media took too long to load. Try MP4/H.264, WebM, MP3 or WAV.')),20000);const ok=()=>done(),bad=()=>done(Error('This file cannot be decoded by your browser. Try MP4/H.264, WebM, MP3 or WAV.'));function done(err){clearTimeout(timer);el.removeEventListener(event,ok);el.removeEventListener('error',bad);err?reject(err):resolve();}el.addEventListener(event,ok,{once:true});el.addEventListener('error',bad,{once:true});});}
async function importFiles(list){if(busy||loading)return;pause();loading=true;refresh();for(const f of list){let url;try{if(f.size>250*1048576)throw Error('Files must be 250 MB or smaller.');const kind=f.type.startsWith('video/')?'video':f.type.startsWith('audio/')?'audio':f.type.startsWith('image/')?'image':null;if(!kind)throw Error('Choose a video, audio or image file.');status('Reading '+f.name+'…');url=URL.createObjectURL(f);const el=document.createElement(kind==='image'?'img':kind);el.preload='auto';el.muted=true;const loaded=waitMedia(el,kind==='image'?'load':'loadedmetadata');el.src=url;await loaded;let len=kind==='image'?5:el.duration;if(!Number.isFinite(len)||len<=0)throw Error('This file has no usable duration.');let hasAudio=kind==='audio',peaks=null;if(kind!=='image'){try{audioContext??=new AudioContext();const decoded=await audioContext.decodeAudioData(await f.arrayBuffer()),samples=decoded.getChannelData(0);peaks=Array.from({length:160},(_,i)=>{const from=Math.floor(i*samples.length/160),to=Math.floor((i+1)*samples.length/160);let peak=0;const stride=Math.max(1,Math.floor((to-from)/100));for(let j=from;j<to;j+=stride)peak=Math.max(peak,Math.abs(samples[j]));return peak;});hasAudio=true;}catch{hasAudio=kind==='audio'||!!el.mozHasAudio||!!el.audioTracks?.length||el.webkitAudioDecodedByteCount>0;}}
 const target=p.media.find(m=>m.id===pendingRelinkId);if(target&&(target.kind!==kind||Math.abs(target.duration-len)>.1))throw Error('This file does not match the selected media type and duration. Choose its original file.');const missing=target||p.media.find(m=>!files.has(m.id)&&m.name===f.name&&(m.size===undefined||m.size===f.size)&&m.kind===kind&&Math.abs(m.duration-len)<.1);const m=missing||{id:uid(),name:f.name,size:f.size,lastModified:f.lastModified,kind,duration:len,hasAudio};m.width=el.videoWidth||el.naturalWidth||0;m.height=el.videoHeight||el.naturalHeight||0;files.set(m.id,{file:f,url,peaks});const cacheSaved=await cacheMedia(m,f,peaks);pendingRelinkId=null;if(!missing){remember();p.media.push(m);}else status('Reconnected '+m.name);if(!missing){loading=false;addMedia(m);loading=true;}el.removeAttribute('src');el.load?.();setCanvas();refresh();if(!cacheSaved)status('Media loaded. Local storage is full or unavailable; keep your originals to reconnect next time.');}catch(e){if(url&&!Array.from(files.values()).some(f=>f.url===url))URL.revokeObjectURL(url);status(f.name+': '+e.message);}}
 loading=false;$('files').value='';refresh();}
function mediaElement(c){let x=elements.get(c.id);if(x)return x;const m=p.media.find(m=>m.id===c.media),file=files.get(m.id);if(!file)return null;const kind=track(c).kind==='audio'?'audio':m.kind==='image'?'img':'video',el=document.createElement(kind);el.src=file.url;if(kind!=='img'){el.preload='auto';el.playsInline=true;el.muted=kind==='video';}x={el,kind,media:c.media};elements.set(c.id,x);return x;}
function fade(c,t){return Math.max(0,Math.min(1,c.fadeIn?t/c.fadeIn:1,c.fadeOut?(c.duration-t)/c.fadeOut:1));}
function renderFrame(){ctx.fillStyle='#08080b';ctx.fillRect(0,0,canvas.width,canvas.height);const active=new Set();const ordered=[...p.clips].sort((a,b)=>p.tracks.findIndex(t=>t.id===b.track)-p.tracks.findIndex(t=>t.id===a.track)||p.clips.indexOf(a)-p.clips.indexOf(b));for(const c of ordered){if(time<c.start||time>=c.start+c.duration||track(c).muted)continue;const x=mediaElement(c);if(!x)continue;active.add(c.id);const {el,kind}=x,t=time-c.start;if(kind!=='img'){const target=c.in+t*c.speed;el.playbackRate=c.speed;el.volume=Math.min(1,c.volume*fade(c,t));if(Math.abs(el.currentTime-target)>(playing?.15:.015)&&!el.seeking)el.currentTime=target;if(playing&&el.paused)el.play().catch(()=>{});if(!playing&&!el.paused)el.pause();}if(track(c).kind==='video'&&(kind==='img'?el.complete:el.readyState>=2)){const w=el.videoWidth||el.naturalWidth,h=el.videoHeight||el.naturalHeight;if(!w||!h)continue;const scale=Math.min(canvas.width/w,canvas.height/h);ctx.globalAlpha=fade(c,t);ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(el,(canvas.width-w*scale)/2,(canvas.height-h*scale)/2,w*scale,h*scale);ctx.globalAlpha=1;}}
 for(const [id,x] of elements){if(!active.has(id))x.el.pause?.();if(!p.clips.some(c=>c.id===id)){x.el.removeAttribute('src');x.el.load?.();elements.delete(id);}}
}
function tick(){if(busy){requestAnimationFrame(tick);return;}if(playing){time=(performance.now()-origin)/1000;if(time>=duration(p)){time=duration(p);pause();}position();}renderFrame();requestAnimationFrame(tick);}
$('play').onclick=()=>{if(busy||loading)return;if(playing)pause();else{if(time>=duration(p))time=0;playing=true;origin=performance.now()-time*1000;playbackButton();}};$('begin').onclick=()=>!busy&&seek(0);$('end').onclick=()=>!busy&&seek(duration(p));$('ruler').onclick=e=>!busy&&seek((e.clientX-$('ruler').getBoundingClientRect().left)/zoom);
$('reconnect').onclick=()=>{pendingRelinkId=null;$('files').click();};
for(const id of ['import','start-import'])$(id).onclick=()=>{if(!busy&&!loading){pendingRelinkId=null;$('files').click();}};$('files').onchange=()=>importFiles([...$('files').files]);document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>{e.preventDefault();importFiles([...e.dataTransfer.files]);});
$('split').onclick=()=>{if(!editable())return;pause();const before=snapshot();if(splitClip(p,selected,time)){undo.push(before);redo=[];refresh();}else status('Place the playhead inside the selected clip to split it.');};$('duplicate').onclick=()=>{if(!editable())return;pause();remember();const c=clip(),n={...c,id:uid(),start:c.start+c.duration};p.clips.push(n);selected=n.id;refresh();};for(const id of ['delete','ripple'])$(id).onclick=()=>{if(!editable())return;pause();remember();removeClip(p,selected,id==='ripple');selected=null;time=Math.min(time,duration(p));refresh();};
function history(back){if(busy||loading)return;const from=back?undo:redo,to=back?redo:undo;if(!from.length)return;pause();to.push(snapshot());p=JSON.parse(from.pop());selected=null;time=Math.min(time,duration(p));$('ratio').value=p.ratio;setCanvas();refresh();}
$('undo').onclick=()=>history(true);$('redo').onclick=()=>history(false);
for(const kind of ['video','audio'])$('add-'+kind).onclick=()=>{if(busy||loading)return;remember();newTrack(kind);refresh();};$('zoom').oninput=()=>{zoom=+$('zoom').value;refresh();};
function setCanvas(){const [w,h]=p.ratio==='source'?sourceShape(p):p.ratio.split(':').map(Number);canvas.width=w>=h?1280:720;canvas.height=Math.round(canvas.width*h/w);}
$('ratio').onchange=()=>{if(busy||loading){$('ratio').value=p.ratio;return;}remember();p.ratio=$('ratio').value;setCanvas();refresh();};
for(const [id,key] of [['clip-start','start'],['clip-in','in'],['clip-duration','duration'],['clip-speed','speed'],['clip-volume','volume'],['clip-fade-in','fadeIn'],['clip-fade-out','fadeOut']])$(id).onchange=()=>{if(!editable())return;const c=clip(),v=+$(id).value,m=p.media.find(m=>m.id===c.media);if(!Number.isFinite(v)||v<0){refresh();return;}pause();remember();c[key]=v;if(key==='speed')c.speed=Math.max(.25,Math.min(4,c.speed));if(m.kind!=='image'){c.in=Math.min(c.in,Math.max(0,m.duration-.04*c.speed));c.duration=Math.min(c.duration,(m.duration-c.in)/c.speed);}c.duration=Math.max(.04,c.duration);c.volume=Math.min(1,c.volume);c.fadeIn=Math.min(c.fadeIn,c.duration);c.fadeOut=Math.min(c.fadeOut,c.duration);refresh();};
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);}
$('save').onclick=()=>{if(busy||loading)return;download(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),'wezzet-project.json');status('Project saved. Media is cached on this browser when storage is available. Keep the original files for other devices or if the cache is cleared.');};$('open').onclick=()=>!busy&&!loading&&$('project-file').click();async function restoreProjectMedia(){
 let restored=0;
 for(const m of p.media){
  if(files.has(m.id))continue;
  const existing=[...files.values()].find(x=>x.file.name===m.name&&x.file.size===m.size&&(!m.lastModified||x.file.lastModified===m.lastModified));
  if(existing){files.set(m.id,existing);restored++;continue;}
  const cached=await cachedMedia(m);
  if(cached?.file){Object.assign(m,cached.metadata);files.set(m.id,{file:cached.file,url:URL.createObjectURL(cached.file),peaks:cached.peaks||null});restored++;}
 }
 return restored;
}
$('project-file').onchange=async()=>{
 if(busy||loading)return;
 try{
  const file=$('project-file').files[0];if(!file)return;if(file.size>2e6)throw Error('Project file is too large.');
  const next=validateProject(JSON.parse(await file.text()));pause();remember();loading=true;
  for(const x of elements.values()){x.el.pause?.();x.el.removeAttribute('src');x.el.load?.();}elements.clear();
  p=next;selected=null;time=0;pendingRelinkId=null;$('ratio').value=p.ratio;setCanvas();refresh();
  status('Opening project and restoring locally cached media…');
  const restored=await restoreProjectMedia();setCanvas();
  status(missingMedia().length?'Project opened. Choose the missing original files using Reconnect; your edits are intact.':`Project opened${restored?' and media restored from this browser':''}. Ready to play.`);
 }catch(e){status(e.message);}finally{loading=false;$('project-file').value='';refresh();}
};
let cancelled=false, engineAbort=null, rendering=false, exportLogs=[];
const exportStatus=message=>{status(message);$('export-status').textContent=message;};
function errorText(e){return e instanceof Error?e.message:typeof e==='string'?e:JSON.stringify(e)||'Unknown export error';}
function timeout(promise,ms,message){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]).finally(()=>clearTimeout(timer));}
$('cancel').onclick=()=>{cancelled=true;engineAbort?.abort();ff?.terminate();ff=null;exportStatus('Cancelling export…');};
$('close-export').onclick=()=>{if(!busy)$('export-panel').hidden=true;};
async function loadEngine(){
 if(ff)return ff;
 const f=new FFmpeg();ff=f;
 f.on('log',({message})=>{exportLogs.push(message);if(exportLogs.length>100)exportLogs.shift();});
 f.on('progress',({time:elapsed})=>{if(rendering&&Number.isFinite(elapsed)){$('progress').value=Math.max(0,Math.min(.99,elapsed/1000000/duration(p)));$('export-status').textContent=`Rendering MP4 · ${Math.round($('progress').value*100)}%. Keep this tab open.`;}});
 const urls=[];
 try{
  exportStatus('Downloading export engine (32 MB on first use)…');
  for(const [name,mime] of [['ffmpeg-core.js','text/javascript'],['ffmpeg-core.wasm','application/wasm']]){
   let lastError;
   for(const base of ['https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm','https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm']){
    if(cancelled)throw Error('Cancelled');
    engineAbort=new AbortController();const timer=setTimeout(()=>engineAbort?.abort(),60000);
    try{const response=await fetch(base+'/'+name,{signal:engineAbort.signal});if(!response.ok)throw Error('HTTP '+response.status);const bytes=await response.arrayBuffer();if(cancelled)throw Error('Cancelled');urls.push(URL.createObjectURL(new Blob([bytes],{type:mime})));lastError=null;break;}catch(e){lastError=e;if(cancelled)throw e;}finally{clearTimeout(timer);engineAbort=null;}
   }
   if(lastError)throw Error('Could not download the export engine. Check your connection or content blocker, then try again. '+errorText(lastError));
  }
  exportStatus('Starting export engine…');
  await timeout(f.load({coreURL:urls[0],wasmURL:urls[1]}),60000,'The export engine did not start. Try reloading this page after saving your project.');
  if(cancelled)throw Error('Cancelled');return f;
 }finally{urls.forEach(url=>URL.revokeObjectURL(url));}
}
function offerDownload(blob,name,message){
 if(exportURL)URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(blob);
 $('download').href=exportURL;$('download').download=name;$('download').textContent='Download '+name+' ↓';
 lastExportState=snapshot();$('download').hidden=false;$('progress').value=1;exportStatus(message);
}
$('export').onclick=async()=>{
 if(busy||loading||!p.clips.length)return;
 $('export-panel').hidden=false;$('download').hidden=true;
 const active=p.clips.filter(c=>!track(c).muted);
 if(active.some(c=>!files.has(c.media))){exportStatus('Reconnect missing media before exporting: import the original files.');return;}
 pause();busy=true;cancelled=false;rendering=false;exportLogs=[];refresh();
 $('cancel').hidden=false;$('close-export').disabled=true;$('progress').hidden=false;$('progress').removeAttribute('value');
 for(const id of ['resolution','frame-rate','quality','ratio'])$(id).disabled=true;
 const written=[];
 try{
  const original=originalExport(p,$('resolution').value,$('frame-rate').value);
  if(original&&/\.(mp4|m4v)$/i.test(original.name)){
   offerDownload(files.get(original.id).file,original.name,'No edits to render: your original file is ready, with byte-for-byte identical video and audio.');return;
  }
  // Release preview decoders while rendering; source files remain untouched.
  for(const x of elements.values()){x.el.pause?.();x.el.removeAttribute('src');x.el.load?.();}elements.clear();
  const engine=await loadEngine();
  const used=new Set(active.map(c=>c.media));
  for(const id of used){
   if(cancelled)throw Error('Cancelled');const m=p.media.find(m=>m.id===id);
   exportStatus('Preparing '+m.name+'…');
   await engine.writeFile(id+'.media',new Uint8Array(await files.get(id).file.arrayBuffer()));written.push(id+'.media');
   if(m.kind==='video'&&!m.fps){
    exportLogs=[];
    // FFmpeg's metadata-only invocation returns 1 (no output requested).
    // This works with the existing core, which does not ship ffprobe.
    await timeout(engine.exec(['-hide_banner','-i',id+'.media']),30000,'Reading source video metadata timed out.');
    const videoLine=exportLogs.find(line=>/Stream.*Video:/.test(line));
    const rate=videoLine?.match(/(\d+(?:\.\d+)?) fps/);
    if(rate)m.fps=Number(rate[1]);
   }
  }
  if(cancelled)throw Error('Cancelled');
  const settings=exportSettings(p,$('resolution').value,$('frame-rate').value,$('quality').value);
  exportStatus(`Rendering ${settings.width} × ${settings.height} at ${settings.fps.toFixed(3)} fps. High-quality export can take several minutes; keep this tab open.`);
  exportLogs=[];rendering=true;$('progress').value=0;
  const code=await timeout(engine.exec(exportArgs(p,settings.width,settings.height,settings)),30*60*1000,'Rendering exceeded 30 minutes. Try a shorter timeline or a lower resolution.');
  rendering=false;if(cancelled)throw Error('Cancelled');
  if(code!==0)throw Error('The video encoder could not finish. '+(exportLogs.filter(line=>/error|invalid|failed|memory|not found|no stream/i.test(line)).slice(-2).join(' ')||'The browser may have run out of memory. Try a shorter timeline or 720p.'));
  exportStatus('Preparing your download…');
  const bytes=await engine.readFile('output.mp4');if(!bytes.length)throw Error('The encoder produced an empty file. Try a shorter timeline.');
  offerDownload(new Blob([bytes],{type:'video/mp4'}),'wezzet-edit.mp4',`Export ready · ${settings.width} × ${settings.height} · ${settings.fps.toFixed(3)} fps. Click Download to save it.`);
 }catch(e){
  const message=errorText(e);exportStatus(cancelled?'Export cancelled. Your edits are safe.':/memory|out of bounds|alloc/i.test(message)?'The browser ran out of memory during export. Your edits are safe. Try 720p, close other tabs, or export a shorter timeline.':message);
 }finally{
  rendering=false;engineAbort?.abort();engineAbort=null;
  // Every export gets a fresh WASM heap. This also recovers from failed runs.
  ff?.terminate();ff=null;busy=false;$('cancel').hidden=true;$('close-export').disabled=false;$('progress').hidden=true;
  for(const id of ['resolution','frame-rate','quality','ratio'])$(id).disabled=false;
  refresh();
 }
};
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||busy||loading)return;const mod=e.ctrlKey||e.metaKey;if(e.code==='Space'){e.preventDefault();$('play').click();}else if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();history(!e.shiftKey);}else if(mod&&e.key.toLowerCase()==='d'){e.preventDefault();$('duplicate').click();}else if(e.key.toLowerCase()==='s'&&!mod)$('split').click();else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();$('delete').click();}else if(e.key==='ArrowRight'){e.preventDefault();seek(time+1/30);}else if(e.key==='ArrowLeft'){e.preventDefault();seek(time-1/30);}});
window.addEventListener('beforeunload',e=>{if(p.clips.length){e.preventDefault();e.returnValue='';}});refresh();requestAnimationFrame(tick);
