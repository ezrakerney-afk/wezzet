import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {duration,splitClip,trimClip,removeClip,validateProject,exportArgs} from '../assets/video-editor-model.mjs';
const base=()=>({version:1,ratio:'16:9',tracks:[{id:'v',kind:'video',name:'Video'},{id:'a',kind:'audio',name:'Audio'}],media:[{id:'source',name:'sample.mp4',kind:'video',duration:4}],clips:[{id:'c',media:'source',track:'v',start:0,in:0,duration:4,speed:1,volume:1,fadeIn:0,fadeOut:0}]});
let p=base();assert.equal(splitClip(p,'c',0,'b'),false);assert.equal(splitClip(p,'c',1.5,'b'),true);assert.equal(p.clips[1].in,1.5);assert.equal(duration(p),4);removeClip(p,'c',true);assert.equal(p.clips[0].start,0);
p=base();p.clips[0].speed=2;p.clips[0].duration=2;splitClip(p,'c',.5,'b');assert.equal(p.clips[1].in,1);assert.equal(p.clips[1].duration,1.5);
p=base();p.clips[0].fadeIn=3;p.clips[0].fadeOut=3;splitClip(p,'c',1,'b');assert.equal(p.clips[0].fadeIn,1);assert.equal(p.clips[1].fadeOut,3);
let c={...base().clips[0]};trimClip(c,'left',1,4);assert.equal(c.in,1);assert.equal(c.duration,3);trimClip(c,'left',-20,4);assert.equal(c.start,0);assert.equal(c.in,0);trimClip(c,'right',99,4);assert.equal(c.duration,4);
assert.throws(()=>validateProject({...base(),clips:[{...base().clips[0],in:-1}]}));assert.throws(()=>validateProject({...base(),clips:[{...base().clips[0],track:'missing'}]}));validateProject(base());
const dir=mkdtempSync(join(tmpdir(),'wezzet-editor-'));
try{
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=160x90:rate=30:duration=4','-f','lavfi','-i','sine=frequency=440:duration=4','-c:v','libx264','-c:a','aac','-shortest',join(dir,'sample.mp4')]);copyFileSync(join(dir,'sample.mp4'),join(dir,'source.media'));
 for(const scenario of ['split-speed-fades','audio-only','muted','delayed-video']){
 p=base();p.clips[0].duration=1;p.clips[0].speed=2;p.clips[0].fadeIn=.2;p.clips[0].fadeOut=.2;p.clips.push({...p.clips[0],id:'audio',track:'a',start:.5});p.clips.push({...p.clips[0],id:'dup',start:2,in:2,speed:1});
 if(scenario==='audio-only')p.clips=p.clips.filter(c=>c.track==='a');if(scenario==='muted')p.tracks.forEach(t=>t.muted=true);if(scenario==='delayed-video')p.clips=p.clips.filter(c=>c.id==='dup');
 const args=exportArgs(p,160,90);execFileSync('ffmpeg',['-v','error','-filter_complex_threads','1',...args],{cwd:dir,timeout:30000});const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json','output.mp4'],{cwd:dir}));assert.ok(Math.abs(+info.format.duration-duration(p))<.15,scenario);assert.ok(info.streams.some(s=>s.codec_name==='h264'));if(scenario==='split-speed-fades'||scenario==='audio-only')assert.ok(info.streams.some(s=>s.codec_name==='aac'));console.log('PASS export '+scenario);
 }
}finally{rmSync(dir,{recursive:true,force:true});}
console.log('PASS timeline split, trim, speed, ripple delete and project validation');
