import {getLayers} from '../layers.js?v=flower-field-2';
import {bakeFlora} from '../flora-field.js?v=flower-field-2';
import {defaults,switchMode,regenerate} from '../document.js?v=flower-field-2';
import {resizeObjects} from '../object-actions.js?v=flower-field-2';
import {LandscapeRenderer} from '../render.js?v=flower-field-2';
import {renderPNG} from '../png-export.js?v=flower-field-2';
import {renderLayersZIP} from '../layers-export.js?v=flower-field-2';
import {readStoredZip} from './zip-reader.js';
const renderer=new LandscapeRenderer(),out=document.querySelector('#results'),lines=[];
const check=(name,ok)=>{lines.push((ok?'PASS ':'FAIL ')+name);out.textContent=lines.join('\n');if(!ok)throw Error(name);};
try{
 for(const [mode,kind]of [['f','flower'],['flora','plant']]){
  let s=regenerate(resizeObjects({...switchMode(defaults,mode),width:192,height:108},kind,32),41251);
  renderer.render(s,384,216);check(kind+' · 32-layer render',renderer.gl.getError()===0);
  const map=renderer.formMap(s,320,180,31);check(kind+' · layer 32 can be selected',map.ids.some(id=>id===32));
  const png=await renderPNG(renderer,{...s,transparentBackground:true}),bitmap=await createImageBitmap(png.blob);check(kind+' · transparent PNG',bitmap.width===192&&bitmap.height===108);bitmap.close();
  const zip=await renderLayersZIP(renderer,s),files=readStoredZip(new Uint8Array(await zip.blob.arrayBuffer()));check(kind+' · ZIP contains 32 objects + Background',files.length===33);
  for(const f of files){const image=await createImageBitmap(new Blob([f.bytes],{type:'image/png'}));if(image.width!==192||image.height!==108)throw Error('PNG dimensions '+f.name);image.close();}
  check(kind+' · all 33 PNGs decode',true);
  renderer.render(s,384,216);const stack=getLayers(s),baked=stack.map(l=>bakeFlora(l,s));
  const changed={...s,grain:s.grain+1};renderer.render(changed,384,216);check(kind+' · surface changes reuse all 32 baked fields',stack.every((l,i)=>bakeFlora(l,changed)===baked[i]));
 }
 check('All 32-layer checks passed',true);
}catch(e){out.textContent+='\nERROR '+e.stack;}finally{renderer.destroy();}
