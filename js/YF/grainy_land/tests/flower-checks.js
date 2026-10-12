import {defaults,switchMode,makeDocument,readDocument} from '../document.js?v=flower-f-2';
import {LandscapeRenderer} from '../render.js?v=flower-f-2';
import {renderPNG} from '../png-export.js?v=flower-f-2';
import {renderLayersZIP} from '../layers-export.js?v=flower-f-2';
import {readStoredZip} from './zip-reader.js';
const renderer=new LandscapeRenderer(),base=switchMode(defaults,'f'),output=document.querySelector('#results'),log=[];
const make=(w=640,h=360)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const capture=(s,transparent=false)=>{const c=make();c.getContext('2d').drawImage(renderer.render(s,640,360,0,transparent),0,0);return c;};
const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
const mae=(a,b)=>{let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length;};
const check=(name,ok)=>{log.push((ok?'PASS ':'FAIL ')+name);output.textContent=log.join('\n');if(!ok)throw Error(name);};
try{
 const sheet=make(1280,2*396),ctx=sheet.getContext('2d');ctx.fillStyle='#151515';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.fillStyle='#ddd';ctx.font='20px system-ui';
 for(const [i,fType] of ['fan','cup','lobed','radial'].entries())for(const fTilt of [0,35,75]){
  const s={...base,fType,fTilt},c=capture(s),figure=document.createElement('figure'),img=new Image(),caption=document.createElement('figcaption');img.src=c.toDataURL();caption.textContent=fType+' · '+fTilt+'°';figure.append(img,caption);document.querySelector('#gallery').append(figure);
  const bytes=pixels(c);check(fType+' '+fTilt+'° renders visible pigment',bytes.some((v,i)=>i%4===0&&v>180)&&renderer.gl.getError()===0);
  if(fTilt===35){const x=i%2*640,y=Math.floor(i/2)*396;ctx.drawImage(c,x,y);ctx.fillText(fType,x+12,y+387);}
 }
 const sheetLink=document.querySelector('#sheet');sheetLink.href=sheet.toDataURL();sheetLink.hidden=false;
 check('JSON has identical pixels',mae(pixels(capture(base)),pixels(capture(readDocument(makeDocument(base)))))===0);
 check('Angle changes silhouette',mae(pixels(capture({...base,fTilt:0})),pixels(capture({...base,fTilt:75})))>2);
 for(const transparentBackground of [false,true]){
  const s={...base,width:640,height:360,transparentBackground},before=JSON.stringify(s),png=await renderPNG(renderer,s),bitmap=await createImageBitmap(png.blob),c=make();c.getContext('2d').drawImage(bitmap,0,0);bitmap.close();
  const a=pixels(c);check('PNG alpha '+transparentBackground,transparentBackground?a.some((v,i)=>i%4===3&&v===0)&&a.some((v,i)=>i%4===3&&v>0&&v<255):a.every((v,i)=>i%4!==3||v===255));
  const zip=await renderLayersZIP(renderer,s),files=readStoredZip(new Uint8Array(await zip.blob.arrayBuffer()));check('ZIP count '+transparentBackground,files.length===(transparentBackground?1:2));
  check('Export preserves settings',JSON.stringify(s)===before);
 }
 output.textContent=log.join('\n')+'\nAll F checks passed.';
}catch(e){output.textContent=log.join('\n')+'\nERROR '+e.stack;}finally{renderer.destroy();}
