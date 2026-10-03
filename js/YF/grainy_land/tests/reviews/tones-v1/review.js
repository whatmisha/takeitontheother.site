import {LandscapeRenderer} from '../../../render.js?v=tones-1';
import {defaults,palettes} from '../../../document.js?v=tones-1';
const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const png=c=>new Promise(r=>c.toBlob(r,'image/png'));
const save=async(name,body)=>{const r=await fetch('/__grainy_tones_save/'+name,{method:'POST',body});if(!r.ok)throw Error('Save failed: '+name);};
const cases=[];
for(const palette of ['pigment','ember']) for(const character of ['off','pigment','pearlescent','radiant']) cases.push({label:palette+' / '+character,settings:{...defaults,...palettes[palette],glow:palette==='ember'?82:12,halo:palette==='ember'?65:40,contrast:palette==='ember'?118:100,softness:palette==='ember'?38:52,toneAmount:character==='off'?0:90,toneSpread:70,toneCharacter:character==='off'?'pigment':character}});
function mount(){document.getElementById('grid').replaceChildren();cases.forEach((entry,i)=>{const f=document.createElement('figure'),a=document.createElement('a'),img=new Image(),label=document.createElement('figcaption');img.src='./'+String(i+1).padStart(2,'0')+'.png';img.alt=entry.label;label.textContent=entry.label;a.href=img.src;a.append(img);f.append(a,label);document.getElementById('grid').append(f);});}
mount();
document.getElementById('generate').addEventListener('click',async()=>{
 const button=document.getElementById('generate'),status=document.getElementById('status');button.disabled=true;
 const renderer=new LandscapeRenderer(),sheet=make(2000,672),ctx=sheet.getContext('2d');ctx.fillStyle='#171717';ctx.fillRect(0,0,2000,672);ctx.font='18px system-ui';
 try{
  for(let i=0;i<cases.length;i++){
   const {settings,label}=cases[i],canvas=make(1920,1080);canvas.getContext('2d').drawImage(renderer.render(settings,1920,1080),0,0);await save(String(i+1).padStart(2,'0')+'.png',await png(canvas));
   const x=16+(i%4)*496,y=16+Math.floor(i/4)*330;ctx.fillStyle='#ddd';ctx.fillText(label,x,y+20);ctx.drawImage(canvas,x,y+36,480,270);status.textContent='Сохранено '+(i+1)+' / 8';
  }
  await save('contact-sheet.png',await png(sheet));await save('metrics.json',new Blob([JSON.stringify({cases},null,2)],{type:'application/json'}));
  document.getElementById('sheet').src='./contact-sheet.png?generated='+Date.now();mount();status.textContent='Готово: 8 вариантов с одинаковой геометрией.';
 }catch(e){status.textContent='Ошибка: '+e.message;}finally{renderer.destroy();button.disabled=false;}
});
