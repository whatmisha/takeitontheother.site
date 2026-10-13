import {defaults,switchMode,regenerate} from '../document.js?v=flower-field-2';
import {resizeObjects} from '../object-actions.js?v=flower-field-2';
import {LandscapeRenderer} from '../render.js?v=flower-field-2';
const out=document.querySelector('#results'),sheet=document.querySelector('#sheet'),ctx=sheet.getContext('2d'),renderer=new LandscapeRenderer();
const save=new URL(location.href).searchParams.has('save'),results=[];
const post=async(name,body)=>{const res=await fetch('/__grainy_flower_composition_save/'+name,{method:'POST',body});if(!res.ok)throw Error('Save failed '+name);};
const blob=c=>new Promise(resolve=>c.toBlob(resolve));
ctx.fillStyle='#131313';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.fillStyle='#ddd';ctx.font='16px system-ui';
try{
 for(let i=0;i<20;i++){
  const fType=['radial','cup','fan','lobed'][i%4],fColorPattern=['grouped','alternating','scattered'][Math.floor(i/4)%3],fCount=[6,12,20,32,8][Math.floor(i/4)],seed=(121347+i*754913)>>>0;
  let s={...switchMode(defaults,'f'),fType,fColorPattern,seed};s=regenerate(resizeObjects(s,'flower',fCount),seed);
  const canvas=Object.assign(document.createElement('canvas'),{width:800,height:450}),c=canvas.getContext('2d');c.drawImage(renderer.render(s,800,450),0,0);
  if(renderer.gl.getError())throw Error('WebGL error '+i);
  const col=i%4,row=Math.floor(i/4);ctx.drawImage(canvas,col*400,row*256,400,225);ctx.fillText(`${i+1} · ${fType} · ${fColorPattern} · ${fCount}`,col*400+10,row*256+247);
  const figure=document.createElement('figure'),img=new Image(),caption=document.createElement('figcaption');img.src=canvas.toDataURL();caption.textContent=`${i+1} · ${fType} · ${fColorPattern} · ${fCount} Flowers · seed ${seed}`;figure.append(img,caption);document.querySelector('#gallery').append(figure);
  results.push({fType,fColorPattern,fCount,seed});out.textContent=`Rendered ${i+1}/20`;
  if(save)await post(String(i+1).padStart(2,'0')+'.png',await blob(canvas));
  await new Promise(resolve=>requestAnimationFrame(resolve));
 }
 if(save){await post('contact-sheet.png',await blob(sheet));await post('metrics.json',JSON.stringify(results,null,2));}
 out.textContent='PASS · 20 compositions rendered · 4 flower types · Field · 6–32 flowers · 3 color patterns';
}catch(e){out.textContent='ERROR '+e.stack;}finally{renderer.destroy();}
