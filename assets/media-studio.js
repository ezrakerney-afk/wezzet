import { FFmpeg } from '/vendor/ffmpeg-0.12.15/index.js';
import { toBlobURL } from '/vendor/ffmpeg-util-0.12.2/index.js';
import { $, save, readCaptions, subtitles } from './studio-common.js';
const mode=document.querySelector('[data-mode]').dataset.mode, CORE='https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
let ff, worker, file, inputURL, resultURL, busy=false, generation=0, rejectWorker;
const status=s=>$('status').textContent=s;
function controls(on){busy=on;$('file').disabled=on;$('run').disabled=on||!file;$('cancel').disabled=!on;$('progress').hidden=!on;}
$('file').onchange=()=>{
  file=$('file').files[0]; $('output').hidden=true; $('preview').hidden=true; $('run').disabled=true;
  if(inputURL)URL.revokeObjectURL(inputURL); if(resultURL)URL.revokeObjectURL(resultURL);
  if(!file)return;
  if(file.size>250*1024*1024){status('Choose a file up to 250 MB.');file=null;return;}
  inputURL=URL.createObjectURL(file);$('preview').src=inputURL;$('preview').hidden=false;
  $('run').disabled=false; status('Ready.');
  if(mode==='clip'){$('start').value=0;$('end').value='';}
};
$('preview').onloadedmetadata=()=>{if(mode==='clip'&&Number.isFinite($('preview').duration))$('end').value=$('preview').duration.toFixed(2);};
if(mode==='clip'){
  $('set-start').onclick=()=>{$('start').value=$('preview').currentTime.toFixed(2);};
  $('set-end').onclick=()=>{$('end').value=$('preview').currentTime.toFixed(2);};
}
async function engine(token){
  status('Loading media engine (32 MB on first use)…');
  const f=new FFmpeg();ff=f;
  const urls=[];
  try{
    for(const [name,mime] of [['ffmpeg-core.js','text/javascript'],['ffmpeg-core.wasm','application/wasm']]){
      urls.push(await toBlobURL(`${CORE}/${name}`,mime));if(token!==generation)throw new Error('Cancelled');
    }
    await f.load({coreURL:urls[0],wasmURL:urls[1]});
    if(token!==generation){f.terminate();throw new Error('Cancelled');}
    f.on('progress',({progress})=>{if(token===generation&&progress>=0&&progress<=1)$('progress').value=progress;});return f;
  }finally{urls.forEach(u=>URL.revokeObjectURL(u));}
}
function recognize(audio,token){
  if(!worker)worker=new Worker('/assets/transcribe-worker.js',{type:'module'});
  return new Promise((resolve,reject)=>{
    rejectWorker=reject;
    worker.onmessage=({data})=>{
      if(token!==generation)return;
      if(data.status)status(data.status);
      if(data.error){rejectWorker=null;reject(new Error(data.error));}
      if(data.result){rejectWorker=null;resolve(data.result);}
    };
    worker.onerror=()=>{rejectWorker=null;reject(new Error('The speech model could not load. Check your connection or try a smaller file in a desktop browser.'));};
    worker.postMessage({audio},[audio.buffer]);
  });
}
$('cancel').onclick=()=>{
  generation++;ff?.terminate();ff=null;worker?.terminate();worker=null;
  rejectWorker?.(new Error('Cancelled'));rejectWorker=null;controls(false);status('Cancelled. Choose Export or Transcribe to try again.');
};
$('run').onclick=async()=>{
  if(busy||!file)return;
  const token=++generation; controls(true);$('output').hidden=true;$('progress').value=0;$('preview').pause();
  let f;
  try{
    let start,end;
    if(mode==='clip'){
      start=Number($('start').value);end=Number($('end').value);
      if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start)throw new Error('Set an end time after the start time.');
      if(Number.isFinite($('preview').duration)&&end>$('preview').duration+.05)throw new Error('End time is beyond the video duration.');
    }
    f=await engine(token);if(token!==generation)return;
    await f.writeFile('input',new Uint8Array(await file.arrayBuffer()));if(token!==generation)return;
    if(mode==='transcribe'){
      status('Extracting audio…');
      const code=await f.exec(['-i','input','-vn','-ac','1','-ar','16000','-t','7201','-f','f32le','audio.pcm']);
      if(code!==0)throw new Error('Could not read audio from this file. Try MP3, WAV or MP4.');
      const raw=await f.readFile('audio.pcm');
      const samples=new Float32Array(raw.buffer,raw.byteOffset,Math.floor(raw.byteLength/4));
      if(!samples.length)throw new Error('This file contains no decodable audio.');
      if(samples.length/16000>7200)throw new Error('This browser tool supports recordings up to two hours. Split this recording with the clipper first.');
      f.terminate();ff=null;f=null;
      // Non-overlapping five-minute sections bound model memory. Whisper overlaps internally.
      const cues=[],texts=[],step=300*16000,total=Math.ceil(samples.length/step);
      for(let offset=0;offset<samples.length;offset+=step){
        if(token!==generation)return;
        const seconds=offset/16000,length=Math.min(step,samples.length-offset)/16000;
        status(`Transcribing section ${Math.floor(offset/step)+1} of ${total}. Keep this tab open…`);
        const result=await recognize(samples.slice(offset,offset+step),token);
        if(token!==generation)return;
        texts.push(result.text||'');
        let last=seconds;
        for(const chunk of result.chunks||[]){
          const text=chunk.text?.trim();if(!text)continue;
          const a=Math.max(last,seconds+Number(chunk.timestamp?.[0]||0)),b=Math.min(seconds+length,seconds+Number(chunk.timestamp?.[1]??length));
          if(b>a){cues.push({start:a,end:b,text});last=b;}
        }
        $('progress').value=Math.min(1,(offset+step)/samples.length);
      }
      $('transcript').value=texts.join(' ').trim();
      $('captions').value=cues.map(c=>`${c.start.toFixed(3)} | ${c.end.toFixed(3)} | ${c.text.replace(/\n/g,' ')}`).join('\n');
      $('output').hidden=false;status(cues.length?'Transcript ready. Review the text and timestamps before downloading.':'No caption timestamps found. The recording may contain no speech; review the transcript.');
    }else{
      status(mode==='clip'?'Exporting your clip…':'Reducing steady background noise…');
      const out=mode==='clip'?'clip.mp4':'clean.wav';
      const args=mode==='clip'?['-ss',String(start),'-i','input','-t',String(end-start),'-map','0:v:0','-map','0:a?','-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2','-c:v','libx264','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',out]:['-i','input','-vn','-af',`afftdn=nr=${$('strength').value}:nf=-30:tn=1`,'-c:a','pcm_s16le',out];
      if(await f.exec(args)!==0)throw new Error('Processing failed. Check the time range and file format, or try a smaller file.');
      const bytes=await f.readFile(out),blob=new Blob([bytes],{type:mode==='clip'?'video/mp4':'audio/wav'});
      if(resultURL)URL.revokeObjectURL(resultURL);resultURL=URL.createObjectURL(blob);
      $('download').href=resultURL;$('download').download=file.name.replace(/\.[^.]+$/,'')+'-'+out;
      if(mode==='noise'){$('cleaned').src=resultURL;$('cleaned').hidden=false;}
      $('output').hidden=false;status('Ready to download.');
    }
  }catch(e){if(token===generation)status(e.message||'Processing failed. Try a smaller file.');}
  finally{f?.terminate();if(token===generation){ff=null;controls(false);}}
};
for(const b of document.querySelectorAll('[data-export]'))b.onclick=()=>{
  try{
    const fmt=b.dataset.export;
    let text=$('transcript').value;
    if(fmt!=='txt'){const cues=readCaptions($('captions').value);if(!cues.length)throw new Error('There are no captions to export.');text=subtitles(cues,fmt);}
    save(new Blob([text],{type:fmt==='vtt'?'text/vtt;charset=utf-8':'text/plain;charset=utf-8'}),file.name.replace(/\.[^.]+$/,'')+'.'+fmt);
  }catch(e){status(e.message);}
};
