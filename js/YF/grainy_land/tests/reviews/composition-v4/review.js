import {LandscapeRenderer} from '../../../render.js?v=composition-4';
const cases=await (await fetch('cases.json')).json();
const name=(stage,i)=>stage+'-'+String(i).padStart(2,'0')+'.webp';
const encode=(canvas,type='image/png')=>new Promise(resolve=>canvas.toBlob(resolve,type,.94));
const save=async(name,body)=>{const r=await fetch('/__grainy_composition_save/'+name,{method:'POST',body});if(!r.ok)throw Error('Save failed: '+name);};
const load=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});
const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function mount(){
 const grid=document.getElementById('grid');grid.replaceChildren();
 cases.forEach((entry,i)=>{for(const stage of ['before','after']){const f=document.createElement('figure'),img=new Image(),a=document.createElement('a'),label=document.createElement('figcaption');img.src=name(stage,i)+'?v='+Date.now();img.alt=entry.label+' · '+(stage==='before'?'до':'после');label.textContent=img.alt;a.href=img.src;a.append(img);f.append(a,label);grid.append(f);}});
 const sheets=document.getElementById('sheets');sheets.replaceChildren();
 for(const stage of ['before','after']){const h=document.createElement('h2');h.textContent=stage==='before'?'Опубликованные формы':'Новые формы';sheets.append(h);for(let i=0;i<4;i++){const img=new Image();img.src=stage+'-sheet-'+i+'.png?v='+Date.now();img.alt=h.textContent+' · '+(i+1);sheets.append(img);}}
}
async function generate(stage){
 const buttons=[...document.querySelectorAll('button')],status=document.getElementById('status');buttons.forEach(b=>b.disabled=true);const renderer=new LandscapeRenderer();
 try{
  for(let i=0;i<cases.length;i++){const c=make(960,540);c.getContext('2d').drawImage(renderer.render(cases[i].settings,960,540),0,0);await save(name(stage,i),await encode(c,'image/webp'));status.textContent='Сохранено '+(i+1)+' / '+cases.length;}
  for(let page=0;page<4;page++){
   const c=make(1600,5*475),ctx=c.getContext('2d');ctx.fillStyle='#171717';ctx.fillRect(0,0,c.width,c.height);ctx.font='18px system-ui';
   for(let n=0;n<10;n++){const i=page*10+n,x=n%2*800,y=Math.floor(n/2)*475;ctx.fillStyle='#eee';ctx.fillText(cases[i].label,x+8,y+24);ctx.drawImage(await load(name(stage,i)),x+8,y+32,784,441);}
   await save(stage+'-sheet-'+page+'.png',await encode(c));
  }
  if(stage==='after'){
   const c=make(1600,4*475),ctx=c.getContext('2d');ctx.fillStyle='#171717';ctx.fillRect(0,0,c.width,c.height);ctx.font='18px system-ui';
   for(const [row,index] of [0,8,4,2].entries())for(const [column,s] of ['before','after'].entries()){ctx.fillStyle='#eee';ctx.fillText(cases[index].label+' · '+(s==='before'?'до':'после'),column*800+8,row*475+24);ctx.drawImage(await load(name(s,index)),column*800+8,row*475+32,784,441);}
   await save('before-after.png',await encode(c));
  }
  mount();status.textContent='Готово: '+cases.length+' изображений · '+stage;
 }catch(e){status.textContent='Ошибка: '+e.message;}finally{renderer.destroy();buttons.forEach(b=>b.disabled=b.id==='before');}
}
document.getElementById('after').onclick=()=>generate('after');mount();
