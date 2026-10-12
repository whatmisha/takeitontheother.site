import {LandscapeRenderer} from '../../../render.js?v=flower-f-2';
import {defaults,switchMode,regenerate} from '../../../document.js?v=flower-f-2';
import {getLayers,withLayers} from '../../../layers.js?v=flower-f-2';
import {flowerType} from '../../../flower.js?v=flower-f-2';
import {buildFlowerParts as oldParts} from './flower-before.js';
const seeds=await(await fetch('seeds.json')).json(),base=switchMode(defaults,'f'),status=document.querySelector('#status'),grid=document.querySelector('#grid');
const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const blob=c=>new Promise(resolve=>c.toBlob(resolve));
const save=async(name,body)=>{const r=await fetch('/__grainy_flower_growth_save/'+name,{method:'POST',body});if(!r.ok)throw Error('Save failed: '+name);};
const families=['fan','cup','lobed','radial'];
function item(i,src,type){const figure=document.createElement('figure'),link=document.createElement('a'),image=new Image(),cap=document.createElement('figcaption');image.src=src;image.alt=type+' '+seeds[i];link.href=src;link.target='_blank';link.append(image);cap.textContent=String(i+1).padStart(2,'0')+' · '+type+' · '+seeds[i];figure.append(link,cap);grid.append(figure);}
function comparison(){const c=document.querySelector('#comparison');c.replaceChildren();for(const name of ['before-after','recognizability']){const a=document.createElement('a'),i=new Image();a.href=name+'.png';i.src=a.href+'?t='+Date.now();i.alt=name;a.target='_blank';a.append(i);c.append(a);}}
function before(s){const layer=getLayers(s)[0],parts=oldParts(layer,s),aspect=s.width/s.height,edits={};for(const p of parts)edits[p.id]={path:p.path.map(n=>({...n,x:n.x/aspect,in:[n.in[0]/aspect,n.in[1]],out:[n.out[0]/aspect,n.out[1]]})),...(!p.parent?{detached:true,origin:p.origin}:{}),...(p.hidden?{hidden:true}:{})};return withLayers(s,[{...layer,flora:{...layer.flora,edits}}]);}
function sheet(w,h){const c=make(w,h),ctx=c.getContext('2d');ctx.fillStyle='#151515';ctx.fillRect(0,0,w,h);ctx.fillStyle='#ddd';ctx.font='17px system-ui';return [c,ctx];}
document.querySelector('#run').onclick=async()=>{
 const renderer=new LandscapeRenderer(),button=document.querySelector('#run');button.disabled=true;grid.replaceChildren();
 const render=s=>{const c=make(960,540);c.getContext('2d').drawImage(renderer.render(s,960,540),0,0);return c;};
 try{
  const [sheetCanvas,ctx]=sheet(1600,5*253),stats=[];
  for(let i=0;i<20;i++){
   const s=regenerate(base,seeds[i]),c=render(s),type=flowerType(getLayers(s)[0],s),name=String(i+1).padStart(2,'0')+'.png';await save(name,await blob(c));item(i,name+'?t='+Date.now(),type);
   const x=i%4*400,y=Math.floor(i/4)*253;ctx.drawImage(c,x,y,400,225);ctx.fillText(String(i+1).padStart(2,'0')+' · '+type,x+8,y+247);stats.push({seed:seeds[i],type});status.textContent='Сохранено '+(i+1)+' / 20';
  }
  await save('contact-sheet.png',await blob(sheetCanvas));
  const [compare,cc]=sheet(1600,2*253);for(let i=0;i<4;i++){const s={...base,fType:families[i]};for(let row=0;row<2;row++){cc.drawImage(render(row?s:before(s)),i*400,row*253,400,225);cc.fillText((row?'AFTER · ':'BEFORE · ')+families[i],i*400+8,row*253+247);}}await save('before-after.png',await blob(compare));
  const [recognition,rc]=sheet(1200,4*253);for(let i=0;i<4;i++)for(let j=0;j<3;j++){const value=100-j*50;rc.drawImage(render({...base,fType:families[i],fRecognition:value}),j*400,i*253,400,225);rc.fillText(families[i]+' · Recognizability '+value,j*400+8,i*253+247);}await save('recognizability.png',await blob(recognition));
  await save('metrics.json',JSON.stringify({date:'2026-10-12',count:20,settings:base,stats},null,2));comparison();status.textContent='Готово: 20 / 20. Сравнения и настройки сохранены.';
 }catch(e){status.textContent='Ошибка: '+e.message;}finally{renderer.destroy();button.disabled=false;}
};
try{const response=await fetch('metrics.json');if(response.ok){const data=await response.json();data.stats.forEach((s,i)=>item(i,String(i+1).padStart(2,'0')+'.png',s.type));comparison();status.textContent='Сохранено 20 / 20 генераций.';}else status.textContent='Готово к генерации.';}catch{status.textContent='Готово к генерации.';}
if(location.port!=='8022')document.querySelector('#run').hidden=true;
