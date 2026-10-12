import {defaults,switchMode} from '../document.js?v=flower-f-5';
import {getLayers,withLayers} from '../layers.js?v=flower-f-5';
import {LandscapeRenderer} from '../render.js?v=flower-f-5';
const samples=await(await fetch('./fixtures/flower-approved.json')).json(),renderer=new LandscapeRenderer(),base=switchMode(defaults,'f'),signatures={},log=[];
const canvas=Object.assign(document.createElement('canvas'),{width:640,height:360}),ctx=canvas.getContext('2d',{willReadFrequently:true});
try{
 for(const sample of samples.filter(s=>s.pixels)){
  let s={...base,...sample.settings,seed:sample.seed},l=getLayers(s)[0];s=withLayers(s,[{...l,flora:{...l.flora,variant:sample.variant}}]);
  ctx.drawImage(renderer.render(s,640,360),0,0);const pixels=ctx.getImageData(0,0,640,360).data;
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))].map(b=>b.toString(16).padStart(2,'0')).join('');signatures[sample.id]=hash;
  log.push((sample.pixelHash?(hash===sample.pixelHash?'PASS ':'FAIL '):'BASELINE ')+sample.id);document.querySelector('#results').textContent=log.join('\n');
 }
 document.querySelector('#signatures').textContent=JSON.stringify(signatures);
 document.querySelector('#results').textContent+='\n'+(log.some(s=>s.startsWith('FAIL'))?'ERROR: pixel mismatch':'Complete: '+log.length+' renders');
}catch(e){document.querySelector('#results').textContent+='\nERROR '+e.stack;}finally{renderer.destroy();}
