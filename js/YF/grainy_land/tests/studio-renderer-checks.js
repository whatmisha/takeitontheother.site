import {LandscapeRenderer} from '../render.js?v=studio-1';
import {defaults} from '../document.js?v=studio-1';
import {withLayers,addLayer,editLayer} from '../layers.js?v=studio-1';
import {renderTiledPNG} from '../tiled-export.js?v=studio-1';
import {renderVideo} from '../motion.js?v=studio-1';
import {localToCanvas} from '../transforms.js?v=studio-1';
const r=new LandscapeRenderer(),results=[],check=(name,ok)=>{results.push((ok?'PASS ':'FAIL ')+name);document.querySelector('#results').textContent=results.join('\n');if(!ok)throw Error(name);};
const pixels=source=>{const c=document.createElement('canvas');c.width=source.width;c.height=source.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
try{
 const added=addLayer(withLayers(defaults,[]),'vector'),s=editLayer(added.settings,added.id,{rotation:42,flipX:true,scaleX:1.4,scaleY:.6,material:{glow:60}}),w=1031,h=259;
 const direct=pixels(r.render(s,w,h,0,true)),tile=await renderTiledPNG(r,s,w,h,{transparent:true,tileSize:128,bandHeight:37}),bitmap=await createImageBitmap(tile.blob),tiled=pixels(bitmap);bitmap.close();
 let error=0;for(let i=0;i<direct.length;i++)error+=Math.abs(direct[i]-tiled[i]);check('Tiled and direct PNG match across tile boundaries ('+error/direct.length+' MAE)',error/direct.length<.02);
 const map=r.formMap(s,400,225),local=[.62,.5],world=localToCanvas(local,{x:0,y:0,scaleX:1.4,scaleY:.6,rotation:42,flipX:true},defaults.width/defaults.height);check('Rotated/flipped vector picking agrees with editor coordinates',map.ids[Math.floor(world[1]*225)*400+Math.floor(world[0]*400)]===1);
 const flat=pixels(r.render(editLayer(s,added.id,{material:{grain:0,softness:0,glow:0}}),w,h,0,true));check('Per-layer surface changes the rendered material',flat.some((v,i)=>v!==direct[i]));
 const wide=await renderTiledPNG(r,{...defaults,width:9000,height:64},9000,64),wideImage=await createImageBitmap(wide.blob);check('A 9000 px PNG exports beyond the previous side limit',wideImage.width===9000&&wideImage.height===64);wideImage.close();
 const result=await renderVideo(r,{...defaults,width:320,height:180,motionDuration:2,motionAmount:5});check('Video contains encoded frames',result.blob.size>2000);const video=document.createElement('video');video.controls=true;video.src=URL.createObjectURL(result.blob);document.querySelector('#artifacts').append(video);await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(Error('Video decode failed'));});check('Loop video decodes at the expected dimensions',video.videoWidth===320&&video.videoHeight===180);
 check('All studio renderer checks passed.',true);
}catch(error){document.querySelector('#results').textContent=results.join('\n')+'\nERROR '+error.message;}finally{r.destroy();}
