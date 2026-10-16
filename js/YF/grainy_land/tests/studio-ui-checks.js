import {defaults} from '../document.js?v=flower-field-2';
import {LandscapeRenderer} from '../render.js?v=flower-field-2';
import {renderPNG} from '../png-export.js?v=flower-field-2';
import {renderLayersZIP} from '../layers-export.js?v=flower-field-2';
import {readStoredZip} from './zip-reader.js';
import {renderVideo} from '../motion.js?v=flower-field-2';
const r=new LandscapeRenderer(),log=[],out=document.querySelector('#results');
const check=(name,ok)=>{log.push((ok?'PASS ':'FAIL ')+name);out.textContent=log.join('\n');if(!ok)throw Error(name);};
const pixels=source=>{const c=document.createElement('canvas');c.width=source.width;c.height=source.height;const ctx=c.getContext('2d');ctx.drawImage(source,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
const alpha=(p,value)=>p.every((v,i)=>i%4!==3||v===value);
try{
 const empty={...defaults,width:320,height:180,layers:[],backgroundVisible:false};
 check('Hidden Background renders transparent',alpha(pixels(r.render(empty,320,180)),0));
 check('Visible Background renders opaque',alpha(pixels(r.render({...empty,backgroundVisible:true},320,180)),255));
 for(const forceTiled of [false,true]){const {blob}=await renderPNG(r,empty,{forceTiled}),img=await createImageBitmap(blob);check('Hidden Background PNG, tiled '+forceTiled,alpha(pixels(img),0));img.close();}
 const zip=await renderLayersZIP(r,empty),files=readStoredZip(new Uint8Array(await zip.blob.arrayBuffer()));
 check('ZIP retains hidden Background with hidden marker',files.length===1&&files[0].name==='01-Background-hidden.png');
 const result=await renderVideo(r,{...empty,motionDuration:2});
 check('MP4 has actual MP4 container',result.extension==='mp4'&&String.fromCharCode(...new Uint8Array(await result.blob.slice(4,8).arrayBuffer()))==='ftyp');
 const v=document.createElement('video');v.muted=true;v.controls=true;v.src=URL.createObjectURL(result.blob);document.querySelector('#artifacts').append(v);
 await new Promise((resolve,reject)=>{v.onloadeddata=resolve;v.onerror=()=>reject(Error('Video decode failed'));});
 check('MP4 decodes',v.videoWidth===320&&v.videoHeight===180);check('All checks passed',true);
}catch(e){out.textContent+='\nERROR '+e.stack;}finally{r.destroy();}
