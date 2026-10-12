import {checkFloraEdges} from './flora-edge-checks.js';
import {defaults,switchMode,normalizeSettings,makeDocument,readDocument} from '../document.js?v=flower-f-5';
import {LandscapeRenderer} from '../render.js?v=flower-f-5';
import {withLayers,getLayers,editLayer} from '../layers.js?v=flower-f-5';
import {editFloraPart,floraParts} from '../flora.js?v=flower-f-5';
import {renderPNG} from '../png-export.js?v=flower-f-5';
import {renderLayersZIP} from '../layers-export.js?v=flower-f-5';
import {readStoredZip} from './zip-reader.js';
const r=new LandscapeRenderer(),log=[],output=document.querySelector('#results');
const check=(name,ok)=>{log.push((ok?'PASS ':'FAIL ')+name);output.textContent=log.join('\n');if(!ok)throw Error(name);};
const canvas=(w=480,h=270)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const pixels=c=>c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data;
const capture=(s,transparent=false,w=480,h=270)=>{const c=canvas(w,h);c.getContext('2d').drawImage(r.render(s,w,h,0,transparent),0,0);return c;};
const error=(a,b)=>{let e=0;for(let i=0;i<a.length;i+=4){for(let k=0;k<3;k++)e+=Math.abs(a[i+k]*a[i+3]/255-b[i+k]*b[i+3]/255);e+=Math.abs(a[i+3]-b[i+3]);}return e/a.length;};
try{
 checkFloraEdges(r,check);
 const s=normalizeSettings({...switchMode(defaults,'flora'),width:960,height:540});
 const variants=[['Cluster · default',{}],['Cluster · another seed',{seed:9876}],['Single · recognizable',{floraLayout:'single',floraRecognition:90,floraScale:100}],['Field',{floraLayout:'field',floraCount:7,floraScale:90,seed:909}],['Abstract growth',{floraRecognition:5,floraFusion:85,seed:4001}],['Open shapes · no merging',{floraMerge:0,floraFusion:0,floraOpening:100,seed:404}]];
 const sheet=canvas(1920,3*590),ctx=sheet.getContext('2d');ctx.fillStyle='#151515';ctx.fillRect(0,0,sheet.width,sheet.height);
 for(const [i,[title,patch]]of variants.entries()){
  const v={...s,...patch},c=capture(v,false,960,540),f=document.createElement('figure'),img=document.createElement('img'),cap=document.createElement('figcaption');img.src=c.toDataURL();cap.textContent=title;f.append(img,cap);document.querySelector('#gallery').append(f);
  ctx.drawImage(c,(i%2)*960,Math.floor(i/2)*590);ctx.font='22px system-ui';ctx.fillStyle='#ddd';ctx.fillText(title,(i%2)*960+16,Math.floor(i/2)*590+573);
  check(title+' has visible paint and no GL error',pixels(c).some((v,i)=>i%4===0&&v>180)&&r.gl.getError()===0);
 }
 const link=document.querySelector('#contact');link.href=sheet.toDataURL();link.hidden=false;
 check('Grain zero is independent of droplet size',error(pixels(capture({...s,grain:0,grainSize:.5})),pixels(capture({...s,grain:0,grainSize:4})))===0);
 check('Patch size changes broad pigment fields',error(pixels(capture({...s,toneScale:25})),pixels(capture({...s,toneScale:190})))>1);
 check('Grain changes pigment and edge coverage',error(pixels(capture({...s,grain:0})),pixels(capture({...s,grain:100})))>.1);
 check('JSON reload renders identical pixels',error(pixels(capture(s)),pixels(capture(readDocument(makeDocument(s)))))===0);
 check('Merge plants changes the rendered union',error(pixels(capture({...s,floraFusion:0})),pixels(capture({...s,floraFusion:100})))>.001);
 let edited=withLayers(s,getLayers(s)),l=getLayers(edited)[2],p=floraParts(l,s)[1];l=editFloraPart(l,s,p.id,{group:'sky'});edited=editLayer(edited,l.id,{flora:l.flora});
 check('Part color changes actual rendered pixels',error(pixels(capture(s)),pixels(capture(edited)))>.001);
 const transparent=capture(s,true);check('Transparent retains soft spray alpha and clear areas',pixels(transparent).some((v,i)=>i%4===3&&v===0)&&pixels(transparent).some((v,i)=>i%4===3&&v>0&&v<255));
 for(const transparentBackground of [false,true]){
  const v={...edited,width:480,height:270,transparentBackground},expected=capture(v,transparentBackground),before=JSON.stringify(v),zip=await renderLayersZIP(r,v),files=readStoredZip(new Uint8Array(await zip.blob.arrayBuffer())),composite=canvas(),cc=composite.getContext('2d');
  check('ZIP plant count '+transparentBackground,files.length===(transparentBackground?4:5));
  for(const file of [...files].reverse()){const bitmap=await createImageBitmap(new Blob([file.bytes],{type:'image/png'}));cc.drawImage(bitmap,0,0);bitmap.close();}
  const mae=error(pixels(expected),pixels(composite));check('ZIP recomposes '+transparentBackground+' ('+mae.toFixed(3)+' MAE)',mae<1);check('Export leaves document unchanged',before===JSON.stringify(v));
 }
 const v={...s,width:960,height:540},png=await renderPNG(r,v),tiled=await renderPNG(r,v,{forceTiled:true}),a=await createImageBitmap(png.blob),b=await createImageBitmap(tiled.blob),ca=canvas(960,540),cb=canvas(960,540);ca.getContext('2d').drawImage(a,0,0);cb.getContext('2d').drawImage(b,0,0);check('PNG and tiled print export match',error(pixels(ca),pixels(cb))<1);a.close();b.close();
 output.textContent=log.join('\n')+'\nAll Flora render checks passed.';
}catch(e){output.textContent=log.join('\n')+'\nERROR '+e.stack;}finally{r.destroy();}
