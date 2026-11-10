import * as pdfjs from '/vendor/pdfjs-4.10.38/pdf.min.mjs';
import { $ } from './studio-common.js';
pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdfjs-4.10.38/pdf.worker.min.mjs';
let url;
$('file').onchange=()=>{$('run').disabled=!$('file').files.length;$('download').hidden=true;$('status').textContent='';};
const xml=s=>s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function lines(items){
  const rows=[];
  for(const item of items){if(!('str'in item))continue;let row=rows.find(r=>Math.abs(r.y-item.transform[5])<Math.max(2,(item.height||10)*.4));if(!row){row={y:item.transform[5],parts:[]};rows.push(row);}row.parts.push({x:item.transform[4],text:item.str});}
  return rows.sort((a,b)=>b.y-a.y).map(r=>r.parts.sort((a,b)=>a.x-b.x).map(p=>p.text).join(' '));
}
$('run').onclick=async()=>{
  const file=$('file').files[0];if(!file)return;$('run').disabled=true;$('file').disabled=true;$('download').hidden=true;let doc;
  try{
    if(file.size>50*1024*1024)throw new Error('Choose a PDF up to 50 MB.');
    doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
    if(doc.numPages>300)throw new Error('Choose a PDF with 300 pages or fewer.');
    let body='',empty=0,chars=0;
    for(let i=1;i<=doc.numPages;i++){
      $('status').textContent=`Reading page ${i} of ${doc.numPages}…`;
      const page=await doc.getPage(i),text=lines((await page.getTextContent()).items);
      if(!text.join('').trim())empty++;chars+=text.join('').length;
      if(i>1)body+='<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      body+=text.map(s=>`<w:p><w:r><w:t xml:space="preserve">${xml(s)}</w:t></w:r></w:p>`).join('');page.cleanup();
    }
    if(!chars)throw new Error('No readable text found. This PDF needs OCR; scanned-page recognition is not included.');
    const header='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const files={
      '[Content_Types].xml':header+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      '_rels/.rels':header+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml':header+'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+'<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>'
    };
    const zipped=window.fflate.zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,window.fflate.strToU8(v)])));
    if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(new Blob([zipped],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
    $('download').href=url;$('download').download=file.name.replace(/\.pdf$/i,'')+'.docx';$('download').hidden=false;
    $('status').textContent=`Ready: ${doc.numPages} pages converted to editable text.`+(empty?` ${empty} page(s) had no readable text; their images were not included.`:'');
  }catch(e){$('status').textContent=e.name==='PasswordException'?'This PDF is password protected. Unlock it first.':e.message||'This PDF could not be converted.';}
  finally{await doc?.destroy();$('run').disabled=false;$('file').disabled=false;}
};
