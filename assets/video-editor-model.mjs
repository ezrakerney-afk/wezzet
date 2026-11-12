// Pure timeline operations, shared by the editor and regression tests.
export const duration = p => Math.max(0, ...p.clips.map(c => c.start + c.duration));
export const uid = () => globalThis.crypto.randomUUID();
export function splitClip(p, id, time, newId = uid()) {
  const c = p.clips.find(c => c.id === id);
  if (!c || time - c.start < .04 || c.start + c.duration - time < .04) return false;
  const left = time - c.start;
  p.clips.push({...c, id:newId, start:time, in:c.in + left*c.speed, duration:c.duration-left, fadeIn:0, fadeOut:Math.min(c.fadeOut,c.duration-left)});
  c.duration=left; c.fadeIn=Math.min(c.fadeIn,left); c.fadeOut=0; return true;
}
export function trimClip(c, edge, delta, sourceDuration) {
  if(edge === 'left') { const d = Math.max(-c.start,-c.in/c.speed,Math.min(delta,c.duration-.04)); c.start+=d;c.in+=d*c.speed;c.duration-=d; }
  else c.duration=Math.max(.04,Math.min(c.duration+delta,(sourceDuration-c.in)/c.speed));
  c.fadeIn=Math.min(c.fadeIn,c.duration);c.fadeOut=Math.min(c.fadeOut,c.duration);
}
export function removeClip(p,id,ripple=false){const c=p.clips.find(x=>x.id===id);if(!c)return; p.clips=p.clips.filter(x=>x.id!==id);if(ripple)for(const x of p.clips)if(x.track===c.track&&x.start>=c.start+c.duration-.001)x.start-=c.duration;}
export function validateProject(p){
 if(!p||p.version!==1||!Array.isArray(p.tracks)||!Array.isArray(p.clips)||!Array.isArray(p.media)||!['source','16:9','9:16','1:1'].includes(p.ratio))throw Error('This is not a supported Wezzet project.');
 if(p.tracks.length>50||p.clips.length>1000||p.media.length>200)throw Error('This project is too large.');
 const unique=a=>new Set(a.map(x=>x.id)).size===a.length;
 if(![p.tracks,p.clips,p.media].every(unique))throw Error('Duplicate project identifiers.');
 for(const t of p.tracks)if(typeof t.id!=='string'||!['video','audio'].includes(t.kind)||typeof t.name!=='string')throw Error('Invalid track.');
 for(const m of p.media)if(typeof m.id!=='string'||typeof m.name!=='string'||!['video','audio','image'].includes(m.kind)||!Number.isFinite(m.duration)||m.duration<=0)throw Error('Invalid media.');
 for(const c of p.clips){const t=p.tracks.find(t=>t.id===c.track),m=p.media.find(m=>m.id===c.media);if(!t||!m||(t.kind==='video'&&m.kind==='audio')||!['start','in','duration','speed','volume','fadeIn','fadeOut'].every(k=>Number.isFinite(c[k])&&c[k]>=0)||c.duration<.04||c.speed<.25||c.speed>4||c.volume>1||(m.kind!=='image'&&c.in+c.duration*c.speed>m.duration+.05))throw Error('Invalid clip.');}
 return p;
}
export function sourceShape(p) {
 const media=p.clips.map(c=>p.media.find(m=>m.id===c.media)).find(m=>m?.width>0&&m?.height>0);
 return media?[media.width,media.height]:[1920,1080];
}
export function exportSettings(p,resolution='source',frameRate='source',quality=16) {
 const used=p.media.filter(m=>p.clips.some(c=>c.media===m.id&&!p.tracks.find(t=>t.id===c.track).muted));
 const [rw,rh]=p.ratio==='source'?sourceShape(p):p.ratio.split(':').map(Number);
 const scale=resolution==='source'?Math.max(used.some(m=>m.width>0&&m.height>0)?1:1080/Math.min(rw,rh),...used.filter(m=>m.width>0&&m.height>0).map(m=>Math.max(m.width/rw,m.height/rh))):Number(resolution)/Math.min(rw,rh);
 const even=n=>Math.max(2,Math.ceil(n/2)*2);
 const rates=used.filter(m=>m.kind==='video'&&m.fps>0).map(m=>m.fps);
 if(frameRate==='source'&&used.some(m=>m.kind==='video'&&!m.fps))throw Error('Could not detect the source frame rate. Choose a frame rate explicitly and retry.');
 const fps=frameRate==='source'?Math.max(30*(rates.length===0),...rates):Number(frameRate);
 const rational=[[23.976,24000/1001],[29.97,30000/1001],[59.94,60000/1001],[119.88,120000/1001]].find(([n])=>Math.abs(fps-n)<.002);
 return {width:even(rw*scale),height:even(rh*scale),fps:rational?rational[1]:fps,crf:[16,20,25].includes(Number(quality))?Number(quality):16};
}
// Returning the untouched original is the only bit-exact export path.
export function originalExport(p,resolution='source',frameRate='source') {
 if(resolution!=='source'||frameRate!=='source'||p.ratio!=='source')return null;
 const active=p.clips.filter(c=>!p.tracks.find(t=>t.id===c.track).muted);
 const video=active.filter(c=>p.tracks.find(t=>t.id===c.track).kind==='video');
 if(video.length!==1)return null;
 const m=p.media.find(m=>m.id===video[0].media);
 if(m.kind!=='video'||active.length!==(m.hasAudio?2:1))return null;
 if(active.every(c=>c.media===m.id&&c.start===0&&c.in===0&&c.duration===m.duration&&c.speed===1&&c.volume===1&&!c.fadeIn&&!c.fadeOut)&&duration(p)===m.duration)return m;
 return null;
}
export function exportArgs(p,width,height,{fps=30,crf=16}={}){
 const args=['-y','-filter_complex_threads','1'],filters=[],inputs=new Map(),ranges=new Map();
 const active=p.clips.filter(c=>!p.tracks.find(t=>t.id===c.track).muted);
 // Open only the source range needed by each clip. Feeding one entire source
 // into many differently trimmed branches can retain large queues of frames.
 // Matching video/audio ranges still share one input decoder.
 for(const c of active){
  const m=p.media.find(m=>m.id===c.media),key=JSON.stringify([c.media,c.in,c.duration*c.speed]);
  if(!ranges.has(key)){
   ranges.set(key,ranges.size);
   if(m.kind==='image')args.push('-loop','1');else args.push('-ss',String(c.in));
   args.push('-t',String(c.duration*c.speed),'-threads','1','-i',m.id+'.media');
  }
  inputs.set(c.id,ranges.get(key));
 }
 const total=duration(p);filters.push(`color=c=black:s=${width}x${height}:r=${fps}:d=${total}[base]`);let v='base',vi=0;const audio=[];
 // Higher video lanes appear above lower ones, in both preview and export.
 const video=active.filter(c=>p.tracks.find(t=>t.id===c.track).kind==='video').sort((a,b)=>p.tracks.findIndex(t=>t.id===b.track)-p.tracks.findIndex(t=>t.id===a.track)||p.clips.indexOf(a)-p.clips.indexOf(b));
 for(const c of video){let f=`[${inputs.get(c.id)}:v]trim=start=0:duration=${c.duration*c.speed},setpts=(PTS-STARTPTS)/${c.speed},scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},format=${c.fadeIn||c.fadeOut?'yuva420p':'yuv420p'}`;
 if(c.fadeIn)f+=`,fade=t=in:st=0:d=${Math.min(c.fadeIn,c.duration)}:alpha=1`;
 if(c.fadeOut)f+=`,fade=t=out:st=${Math.max(0,c.duration-c.fadeOut)}:d=${Math.min(c.fadeOut,c.duration)}:alpha=1`;
 f+=`,setpts=PTS+${c.start}/TB[v${vi}]`;filters.push(f);filters.push(`[${v}][v${vi}]overlay=eof_action=pass:repeatlast=0:enable='gte(t,${c.start})*lt(t,${c.start+c.duration})'[mix${vi}]`);v='mix'+vi++;}
 for(const c of active.filter(c=>p.tracks.find(t=>t.id===c.track).kind==='audio')){const n=audio.length;let f=`[${inputs.get(c.id)}:a]atrim=start=0:duration=${c.duration*c.speed},asetpts=PTS-STARTPTS`;let speed=c.speed;while(speed>2){f+=',atempo=2';speed/=2;}while(speed<.5){f+=',atempo=0.5';speed/=.5;}f+=`,atempo=${speed},volume=${c.volume}`;if(c.fadeIn)f+=`,afade=t=in:d=${Math.min(c.fadeIn,c.duration)}`;if(c.fadeOut)f+=`,afade=t=out:st=${Math.max(0,c.duration-c.fadeOut)}:d=${Math.min(c.fadeOut,c.duration)}`;f+=`,adelay=${Math.round(c.start*1000)}:all=1[a${n}]`;filters.push(f);audio.push(`[a${n}]`);}
 if(audio.length)filters.push(`${audio.join('')}amix=inputs=${audio.length}:duration=longest:normalize=0,apad,atrim=duration=${total}[audio]`);
 args.push('-filter_complex',filters.join(';'),'-map',`[${v}]`);if(audio.length)args.push('-map','[audio]');args.push('-t',String(total),'-r',String(fps),'-c:v','libx264','-threads','1','-preset','veryfast','-crf',String(crf),'-pix_fmt','yuv420p','-c:a','aac','-b:a','320k','-movflags','+faststart','output.mp4');return args;
}
