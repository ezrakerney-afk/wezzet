import { $ } from './studio-common.js';
// Original implementations of standard mathematical formulas. No copied calculator content.
export const calculations=[
 ['Percentage','part ÷ whole × 100',[['Part',0],['Whole',1]],([a,b])=>{if(!b)throw Error('Whole cannot be zero.');return a/b*100;}],
 ['Percentage change','(new − old) ÷ |old| × 100',[['Old value',1],['New value',2]],([a,b])=>{if(!a)throw Error('Old value cannot be zero.');return (b-a)/Math.abs(a)*100;}],
 ['Circle area','π × radius²',[['Radius',1,0]],([r])=>Math.PI*r*r],
 ['Cylinder volume','π × radius² × height',[['Radius',1,0],['Height',1,0]],([r,h])=>Math.PI*r*r*h],
 ['Sphere volume','4 ÷ 3 × π × radius³',[['Radius',1,0]],([r])=>4/3*Math.PI*r**3],
 ['Triangle area','base × height ÷ 2',[['Base',1,0],['Height',1,0]],([b,h])=>b*h/2],
 ['Right triangle hypotenuse','√(a² + b²)',[['Leg a',3,0],['Leg b',4,0]],([a,b])=>Math.hypot(a,b)],
 ['Average speed','distance ÷ time',[['Distance',100,0],['Time',10,0]],([d,t])=>{if(!t)throw Error('Time must be greater than zero.');return d/t;}],
 ['Density','mass ÷ volume',[['Mass',10,0],['Volume',2,0]],([m,v])=>{if(!v)throw Error('Volume must be greater than zero.');return m/v;}],
 ['Kinetic energy (J)','½ × mass (kg) × speed (m/s)²',[['Mass (kg)',1,0],['Speed (m/s)',1,0]],([m,v])=>.5*m*v*v],
 ['Ohm’s law: current (A)','voltage (V) ÷ resistance (Ω)',[['Voltage (V)',12],['Resistance (Ω)',4,0]],([v,r])=>{if(!r)throw Error('Resistance must be greater than zero.');return v/r;}],
 ['Electrical power (W)','voltage (V) × current (A)',[['Voltage (V)',12],['Current (A)',2]],([v,i])=>v*i]
];
calculations.forEach((c,i)=>$('calculator').add(new Option(c[0],i)));
function choose(){const c=calculations[Number($('calculator').value)];$('fields').replaceChildren();$('answer').textContent='';$('formula').textContent=c[1];c[2].forEach(([name,value,min],i)=>{const l=document.createElement('label');l.textContent=name;const input=document.createElement('input');input.type='number';input.step='any';input.required=true;input.value=value;input.name='v'+i;if(min!==undefined)input.min=min;l.append(input);$('fields').append(l);});}
const requestedCalculator = new URLSearchParams(location.search).get('calc');
const requestedIndex = calculations.findIndex(([name]) => name === requestedCalculator);
if (requestedIndex !== -1) $('calculator').value = String(requestedIndex);
$('calculator').onchange=choose;choose();
$('calc-form').onsubmit=e=>{e.preventDefault();try{const c=calculations[Number($('calculator').value)],v=[...$('fields').querySelectorAll('input')].map(n=>Number(n.value));if(v.some(n=>!Number.isFinite(n)))throw Error('Enter finite numbers.');const result=c[3](v);if(!Number.isFinite(result))throw Error('Result is too large. Try smaller numbers.');$('answer').textContent='Result: '+Number(result.toPrecision(12)).toLocaleString(undefined,{maximumSignificantDigits:12});}catch(err){$('answer').textContent=err.message;}};
