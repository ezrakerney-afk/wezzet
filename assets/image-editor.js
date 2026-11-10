import { $, save } from './studio-common.js';
const base = document.createElement('canvas'), canvas = $('canvas');
let original, filename = 'image', version = 0;
const filters = ['brightness', 'contrast', 'saturation'];
function resetSliders() { filters.forEach(id => $(id).value = 100); }
function dimensions() {
  $('width').value = $('cw').value = base.width; $('height').value = $('ch').value = base.height;
  $('x').value = $('y').value = 0;
}
function render() {
  canvas.width = base.width; canvas.height = base.height;
  const c = canvas.getContext('2d');
  c.filter = `brightness(${$('brightness').value}%) contrast(${$('contrast').value}%) saturate(${$('saturation').value}%)`;
  c.drawImage(base,0,0); c.filter = 'none';
}
function commit(c) { base.width = c.width; base.height = c.height; base.getContext('2d').drawImage(c,0,0); resetSliders(); dimensions(); render(); }
function attempt(fn) { try { fn(); $('status').textContent = `${base.width} × ${base.height} pixels`; } catch(e) { $('status').textContent = e.message; } }
$('file').onchange = async () => {
  const file = $('file').files[0], token = ++version; if (!file) return;
  $('editor').hidden = true;
  try {
    const image = await createImageBitmap(file);
    if (token !== version) { image.close(); return; }
    if (image.width * image.height > 24000000 || Math.max(image.width,image.height)>12000) { image.close(); throw new Error('Choose an image up to 24 megapixels and 12,000 pixels per side.'); }
    original?.close(); original = image; filename = file.name.replace(/\.[^.]+$/, '');
    base.width = image.width; base.height = image.height; base.getContext('2d').drawImage(image,0,0);
    resetSliders(); dimensions(); render(); $('editor').hidden = false; $('status').textContent = `${base.width} × ${base.height} pixels`;
    if (!('filter' in canvas.getContext('2d'))) { filters.forEach(id => $(id).disabled = true); $('status').textContent += '. Color adjustments are not supported by this browser.'; }
  } catch(e) { $('status').textContent = e.message || 'This image could not be opened.'; }
};
filters.forEach(id => $(id).oninput = render);
$('rotate').onclick = () => attempt(() => {
  const c=document.createElement('canvas'); c.width=canvas.height; c.height=canvas.width;
  const ctx=c.getContext('2d'); ctx.translate(c.width,0); ctx.rotate(Math.PI/2); ctx.drawImage(canvas,0,0); commit(c);
});
$('flip').onclick = () => attempt(() => {
  const c=document.createElement('canvas'); c.width=canvas.width; c.height=canvas.height;
  const ctx=c.getContext('2d'); ctx.translate(c.width,0); ctx.scale(-1,1); ctx.drawImage(canvas,0,0); commit(c);
});
$('reset').onclick = () => attempt(() => { base.width=original.width; base.height=original.height; base.getContext('2d').drawImage(original,0,0); resetSliders(); dimensions(); render(); });
$('crop').onclick = () => attempt(() => {
  const [x,y,w,h]=['x','y','cw','ch'].map(id=>Number($(id).value));
  if (![x,y,w,h].every(Number.isInteger)||x<0||y<0||w<1||h<1||x+w>canvas.width||y+h>canvas.height) throw new Error('The crop must fit inside the image. Use whole pixels.');
  const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(canvas,x,y,w,h,0,0,w,h); commit(c);
});
$('width').oninput=()=>{$('height').value=Math.max(1,Math.round(Number($('width').value)*base.height/base.width));};
$('height').oninput=()=>{$('width').value=Math.max(1,Math.round(Number($('height').value)*base.width/base.height));};
$('save').onclick=async()=>{
  try {
    const w=Number($('width').value), h=Number($('height').value), fmt=$('format').value;
    if (![w,h].every(Number.isInteger)||w<1||h<1||w*h>24000000||Math.max(w,h)>12000) throw new Error('Export dimensions must be positive whole pixels, up to 24 megapixels and 12,000 pixels per side.');
    const c=document.createElement('canvas'); c.width=w; c.height=h; const ctx=c.getContext('2d');
    if(fmt==='jpeg'){ctx.fillStyle='white';ctx.fillRect(0,0,w,h);}
    ctx.drawImage(canvas,0,0,w,h);
    const blob=await new Promise(r=>c.toBlob(r,'image/'+fmt,.92));
    if(!blob) throw new Error('Export failed. Try a smaller image.');
    if(blob.type!=='image/'+fmt) throw new Error('Your browser cannot export this format. Choose PNG.');
    save(blob,filename+'-edited.'+(fmt==='jpeg'?'jpg':fmt)); $('status').textContent='Image exported.';
  }catch(e){$('status').textContent=e.message;}
};
