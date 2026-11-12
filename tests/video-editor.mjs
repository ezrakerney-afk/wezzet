import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {duration,splitClip,trimClip,removeClip,validateProject,exportArgs,exportSettings,originalExport} from '../assets/video-editor-model.mjs';
const base=()=>({version:1,ratio:'16:9',tracks:[{id:'v',kind:'video',name:'Video'},{id:'a',kind:'audio',name:'Audio'}],media:[{id:'source',name:'sample.mp4',kind:'video',duration:4}],clips:[{id:'c',media:'source',track:'v',start:0,in:0,duration:4,speed:1,volume:1,fadeIn:0,fadeOut:0}]});
let p=base();assert.equal(splitClip(p,'c',0,'b'),false);assert.equal(splitClip(p,'c',1.5,'b'),true);assert.equal(p.clips[1].in,1.5);assert.equal(duration(p),4);removeClip(p,'c',true);assert.equal(p.clips[0].start,0);
p=base();p.clips[0].speed=2;p.clips[0].duration=2;splitClip(p,'c',.5,'b');assert.equal(p.clips[1].in,1);assert.equal(p.clips[1].duration,1.5);
p=base();p.clips[0].fadeIn=3;p.clips[0].fadeOut=3;splitClip(p,'c',1,'b');assert.equal(p.clips[0].fadeIn,1);assert.equal(p.clips[1].fadeOut,3);
let c={...base().clips[0]};trimClip(c,'left',1,4);assert.equal(c.in,1);assert.equal(c.duration,3);trimClip(c,'left',-20,4);assert.equal(c.start,0);assert.equal(c.in,0);trimClip(c,'right',99,4);assert.equal(c.duration,4);
assert.throws(()=>validateProject({...base(),clips:[{...base().clips[0],in:-1}]}));assert.throws(()=>validateProject({...base(),clips:[{...base().clips[0],track:'missing'}]}));validateProject(base());
p=base();p.ratio='source';Object.assign(p.media[0],{width:3840,height:2160,fps:59.94,hasAudio:true});p.clips.push({...p.clips[0],id:'a1',track:'a'});
let settings=exportSettings(p);assert.equal(settings.width,3840);assert.equal(settings.height,2160);assert.equal(settings.fps,60000/1001);assert.equal(settings.crf,16);
assert.equal(originalExport(p).id,'source');p.clips[0].duration=2;assert.equal(originalExport(p),null);
const graph=exportArgs(p,3840,2160,settings);assert.equal(graph.filter(a=>a==='-i').length,1);assert.equal(graph[graph.indexOf('-b:a')+1],'320k');
p.ratio='9:16';settings=exportSettings(p,'1080','60');assert.equal(settings.width,1080);assert.equal(settings.height,1920);assert.equal(settings.fps,60);
p=base();assert.throws(()=>exportSettings(p),/frame rate/);assert.equal(exportSettings(p,'720','30').width,1280);
const dir=mkdtempSync(join(tmpdir(),'wezzet-editor-'));
try{
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=160x90:rate=30:duration=4','-f','lavfi','-i','sine=frequency=440:duration=4','-c:v','libx264','-c:a','aac','-shortest',join(dir,'sample.mp4')]);copyFileSync(join(dir,'sample.mp4'),join(dir,'source.media'));
 for(const scenario of ['split-speed-fades','audio-only','muted','delayed-video','source-60fps']){
 p=base();p.clips[0].duration=1;p.clips[0].speed=2;p.clips[0].fadeIn=.2;p.clips[0].fadeOut=.2;p.clips.push({...p.clips[0],id:'audio',track:'a',start:.5});p.clips.push({...p.clips[0],id:'dup',start:2,in:2,speed:1});
 if(scenario==='audio-only')p.clips=p.clips.filter(c=>c.track==='a');if(scenario==='muted')p.tracks.forEach(t=>t.muted=true);if(scenario==='delayed-video')p.clips=p.clips.filter(c=>c.id==='dup');
 const args=exportArgs(p,160,90,{fps:scenario==='source-60fps'?60:30});execFileSync('ffmpeg',['-v','error','-filter_complex_threads','1',...args],{cwd:dir,timeout:30000});const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json','output.mp4'],{cwd:dir}));assert.ok(Math.abs(+info.format.duration-duration(p))<.15,scenario);assert.ok(info.streams.some(s=>s.codec_name==='h264'));if(scenario==='split-speed-fades'||scenario==='audio-only')assert.ok(info.streams.some(s=>s.codec_name==='aac'));if(scenario==='source-60fps')assert.equal(info.streams.find(s=>s.codec_name==='h264').r_frame_rate,'60/1');console.log('PASS export '+scenario);
 }
}finally{rmSync(dir,{recursive:true,force:true});}
console.log('PASS timeline split, trim, speed, ripple delete and project validation');
