import {LandscapeRenderer} from '../../../render.js?v=forms-3';
const pigment=await (await fetch('../../../presets/pigment.json')).json();
const ember=await (await fetch('../../../presets/ember.json')).json();
const cases=[];
for(const [name,preset] of [['Ember',ember],['Pigment',pigment]]) for(const seed of [1565559100,80423,925731,247109]) cases.push({label:name+' · '+seed,settings:{...preset,seed}});
cases.push({label:'Ember · Glow 82',settings:{...ember,glow:82}});
cases.push({label:'Abstract',settings:{...pigment,mode:'abstract',seed:925731,scale:125,flow:85,complexity:3,glow:34}});
const filename=(i,after)=>String(i*2+(after?2:1)).padStart(2,'0')+'.png';
const png=c=>new Promise(r=>c.toBlob(r,'image/png'));
const save=async(name,body)=>{const r=await fetch('/__grainy_forms_save/'+name,{method:'POST',body});if(!r.ok)throw Error('Save failed: '+name);};
const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});
function mount(){document.getElementById('grid').replaceChildren();cases.forEach((entry,i)=>{for(const after of [false,true]){const f=document.createElement('figure'),a=document.createElement('a'),img=new Image(),label=document.createElement('figcaption');img.src=filename(i,after)+'?v='+Date.now();img.alt=entry.label+(after?' · после':' · до');label.textContent=img.alt;a.href=img.src;a.append(img);f.append(a,label);document.getElementById('grid').append(f);}});}
async function generate(after){
 const buttons=[...document.querySelectorAll('button')],status=document.getElementById('status');buttons.forEach(b=>b.disabled=true);
 const renderer=new LandscapeRenderer();
 try{
  for(let i=0;i<cases.length;i++){
   const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;canvas.getContext('2d').drawImage(renderer.render(cases[i].settings,1920,1080),0,0);await save(filename(i,after),await png(canvas));status.textContent='Сохранено '+(i+1)+' / '+cases.length;
  }
  if(after){
   const sheet=document.createElement('canvas');sheet.width=1600;sheet.height=cases.length*487;const ctx=sheet.getContext('2d');ctx.fillStyle='#171717';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.font='20px system-ui';
   for(let i=0;i<cases.length;i++)for(const a of [false,true]){const x=a?808:8,y=i*487;ctx.fillStyle='#eee';ctx.fillText(cases[i].label+(a?' · после':' · до'),x,y+28);ctx.drawImage(await load(filename(i,a)+'?v='+Date.now()),x,y+38,784,441);}
   await save('contact-sheet.png',await png(sheet));
   const detail=document.createElement('canvas');detail.width=1600;detail.height=974;detail.getContext('2d').drawImage(sheet,0,0,1600,487,0,0,1600,487);detail.getContext('2d').drawImage(sheet,0,4*487,1600,487,0,487,1600,487);await save('before-after.png',await png(detail));
   document.getElementById('sheet').src='contact-sheet.png?v='+Date.now();
  }
  await save('metrics.json',new Blob([JSON.stringify({cases},null,2)],{type:'application/json'}));mount();status.textContent=after?'Готово: 10 пар до / после.':'Готово: исходные 10 изображений сохранены.';
 }catch(e){status.textContent='Ошибка: '+e.message;}finally{renderer.destroy();buttons.forEach(b=>b.disabled=b.id==='before');}
}
document.getElementById('after').onclick=()=>generate(true);
mount();
