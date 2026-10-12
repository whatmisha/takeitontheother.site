import {LandscapeRenderer} from '../../../render.js?v=flora-surface-1';
import {defaults,switchMode,regenerate} from '../../../document.js?v=flora-surface-1';
const seeds=await(await fetch('seeds.json')).json();
const base=switchMode(defaults,'flora'),status=document.querySelector('#status'),grid=document.querySelector('#grid');
const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const blob=c=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('PNG encoding failed'))));
const save=async(name,body)=>{const r=await fetch('/__grainy_flora_save/'+name,{method:'POST',body});if(!r.ok)throw Error('Save failed: '+name);};
const load=async(src)=>{const img=new Image();img.src=src;await img.decode();return img;};
function item(i,src){const f=document.createElement('figure'),a=document.createElement('a'),img=new Image(),cap=document.createElement('figcaption');img.src=src;img.alt='Flora '+(i+1);a.href=src;a.target='_blank';a.append(img);cap.textContent=String(i+1).padStart(2,'0')+' · '+seeds[i];f.append(a,cap);grid.append(f);}
for(let i=1;i<=8;i++){const img=new Image();img.src='../../../ref/flora/'+String(i).padStart(2,'0')+'.png';img.alt='Референс '+i;document.querySelector('#allRefs').append(img);}
document.querySelector('#run').onclick=async()=>{
 const renderer=new LandscapeRenderer(),button=document.querySelector('#run');button.disabled=true;grid.replaceChildren();
 const sheet=make(1920,5*306),ctx=sheet.getContext('2d'),details=make(1920,3*408),dc=details.getContext('2d');
 for(const c of [ctx,dc]){c.fillStyle='#151515';c.fillRect(0,0,c.canvas.width,c.canvas.height);c.fillStyle='#ddd';c.font='19px system-ui';}
 const stats=[];
 try{
  const refs=await Promise.all(['05','06'].map(n=>load('../../../ref/flora/'+n+'.png')));
  refs.forEach((img,i)=>{dc.drawImage(img,350,130,480,360,i*960,0,480,360);dc.drawImage(img,800,360,480,360,i*960+480,0,480,360);dc.fillText('Reference '+(i+5)+' · 1:1',i*960+12,390);});
  for(let i=0;i<20;i++){
   const settings=regenerate(base,seeds[i]),c=make(1920,1080),cc=c.getContext('2d',{willReadFrequently:true});
   cc.drawImage(renderer.render(settings,c.width,c.height),0,0);
   const name=String(i+1).padStart(2,'0')+'.png',png=await blob(c);await save(name,png);item(i,URL.createObjectURL(png));
   const x=i%4*480,y=Math.floor(i/4)*306;ctx.drawImage(c,x,y,480,270);ctx.fillText(String(i+1).padStart(2,'0')+' · '+seeds[i],x+10,y+296);
   if(i<4){const dx=i%2*960,dy=408+Math.floor(i/2)*408;dc.drawImage(c,430,270,480,360,dx,dy,480,360);dc.drawImage(c,1010,440,480,360,dx+480,dy,480,360);dc.fillText('Generation '+(i+1)+' · 1:1',dx+12,dy+390);}
   const bytes=cc.getImageData(0,0,c.width,c.height).data;let blue=0,light=0;
   for(let p=0;p<bytes.length;p+=4){if(bytes[p+2]>bytes[p]*1.2&&bytes[p+2]>bytes[p+1]*1.15)blue++;if(Math.min(bytes[p],bytes[p+1],bytes[p+2])>185)light++;}
   stats.push({number:i+1,seed:seeds[i],blueFraction:blue/(1920*1080),lightFraction:light/(1920*1080),pngBytes:png.size});
   status.textContent='Сохранено '+(i+1)+' / 20';await new Promise(resolve=>setTimeout(resolve,0));
  }
  await save('contact-sheet.png',await blob(sheet));await save('detail-sheet.png',await blob(details));
  await save('metrics.json',JSON.stringify({date:'2026-10-12',mode:'flora',palette:'Ember',count:20,width:1920,height:1080,seeds,settings:base,stats},null,2));
  status.textContent='Готово: 20 / 20 PNG сохранены, настройки и seed записаны.';
 }catch(e){status.textContent='Ошибка: '+e.message;}finally{renderer.destroy();button.disabled=false;}
};
try{const response=await fetch('metrics.json');if(response.ok){const saved=await response.json();for(let i=0;i<saved.count;i++)item(i,String(i+1).padStart(2,'0')+'.png');status.textContent='Сохранено 20 / 20 генераций.';}else status.textContent='Готово к генерации.';}catch{status.textContent='Готово к генерации.';}

// Saving is available only on the dedicated local review server.
if(location.port!=='8022')document.querySelector('#run').hidden=true;
