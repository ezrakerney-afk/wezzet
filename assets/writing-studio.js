import { $, save } from './studio-common.js';
const quiz=document.querySelector('[data-mode]').dataset.mode==='quiz';let controller;
const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
$('cancel').onclick=()=>controller?.abort();
$('run').onclick=async()=>{
  const text=$('source').value.trim();if(!text){$('status').textContent='Paste some notes or text first.';return;}
  $('run').disabled=true;$('cancel').disabled=false;$('result').replaceChildren();$('status').textContent='Working with WezzetAI…';
  controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),150000);
  try{
    const response=await fetch('/api/ai',{method:'POST',headers:{'content-type':'application/json'},signal:controller.signal,body:JSON.stringify({task:quiz?'quiz':$('kind').value,text})});
    if(!response.ok)throw new Error(response.status===429?'The AI usage limit was reached. Please try again later.':'WezzetAI is unavailable right now. Your text is still here; please try again later.');
    const data=await response.json();if(!data.reply?.trim())throw new Error('No answer came back. Please try again.');
    if(quiz)renderQuiz(data.reply);else{
      const label=el('label','Rewritten version'),out=document.createElement('textarea');out.value=data.reply;out.id='rewritten';label.append(out);
      const download=el('button','Download text');download.type='button';download.onclick=()=>save(new Blob([out.value],{type:'text/plain;charset=utf-8'}),'wezzet-rewrite.txt');
      $('result').append(label,download);
    }
    $('status').textContent=quiz?'Quiz ready. Select your answers, then check your score.':'Rewrite ready. Review it before using it.';
  }catch(e){$('status').textContent=e.name==='AbortError'?'Request cancelled or timed out. Your text has been kept.':e.message;}
  finally{clearTimeout(timeout);controller=null;$('run').disabled=false;$('cancel').disabled=true;}
};
function renderQuiz(raw){
  let data;
  try{data=JSON.parse(raw.replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,''));}catch{throw new Error('The AI returned an incomplete quiz. Please try again with shorter notes.');}
  if(!Array.isArray(data.questions)||data.questions.length<1||data.questions.length>8||data.questions.some(q=>!q||typeof q.question!=='string'||!Array.isArray(q.options)||q.options.length!==4||q.options.some(o=>typeof o!=='string')||!Number.isInteger(q.answer)||q.answer<0||q.answer>3||typeof q.explanation!=='string'))throw new Error('The AI returned an invalid quiz. Please try again.');
  const form=document.createElement('form'),feedback=[];
  data.questions.forEach((q,i)=>{
    const field=document.createElement('fieldset');field.append(el('legend',`${i+1}. ${q.question}`));
    q.options.forEach((option,j)=>{const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='q'+i;input.value=j;input.required=true;label.append(input,document.createTextNode(option));field.append(label);});
    const note=el('p','');note.className='feedback';note.hidden=true;feedback.push(note);field.append(note);form.append(field);
  });
  const submit=el('button','Check answers');submit.type='submit';submit.className='primary';form.append(submit);
  const score=el('p','');score.setAttribute('role','status');form.append(score);
  form.onsubmit=e=>{
    e.preventDefault();let correct=0;
    data.questions.forEach((q,i)=>{
      const chosen=Number(new FormData(form).get('q'+i)),ok=chosen===q.answer;if(ok)correct++;
      feedback[i].textContent=`${ok?'Correct.':'Correct answer: '+q.options[q.answer]+'.'} ${q.explanation}`;feedback[i].hidden=false;
    });score.textContent=`${correct} / ${data.questions.length} correct. Review the explanations and try again.`;
  };
  $('result').append(form);
}
