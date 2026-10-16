import {defaults,switchMode} from '../legacy-document.js';
import {normalizeSettings} from '../document.js?v=unified-document-1';
import {resizeObjects,addObject} from '../object-actions.js';
import {getLayers,editLayer,addLayer,addBlueLayer} from '../layers.js';
import {addCustomColor} from '../custom-colors.js';
import {createLayerScene} from '../scene.js';
import {FloraFieldPool} from '../flora-field-pool.js?v=gpu-perf-1';
import {motionFrame} from '../motion.js?v=gpu-perf-1';
import {createReferenceRenderer,pixelDifference} from './reference-renderer.js';
import {LandscapeRenderer as After} from '../render.js?v=gpu-perf-1';
const pool=new FloraFieldPool(),before=createReferenceRenderer(),after=new After(),log=[],out=document.querySelector('#results');
const write=x=>{log.push(x);out.textContent=log.join('\n');};
const rgba=r=>{const data=new Uint8Array(r.canvas.width*r.canvas.height*4);r.gl.readPixels(0,0,r.canvas.width,r.canvas.height,r.gl.RGBA,r.gl.UNSIGNED_BYTE,data);return data;};
const cases=[];
for(const mode of ['landscape','abstract','flora','f'])for(const toneCharacter of ['pigment','pearlescent','radiant'])cases.push([mode+' '+toneCharacter,{...switchMode(defaults,mode),toneCharacter,skyToneAmount:55,glow:80}]);
const base={...switchMode(defaults,'f'),motionAmount:6};
for(const type of ['fan','cup','lobed','radial'])for(const phase of [.17,.61])cases.push([type+' '+phase,motionFrame({...base,fType:type},phase)]);
cases.push(['32 flowers',motionFrame(resizeObjects(base,'flower',32),.41)]);
let mixed=resizeObjects(base,'flower',3);for(const kind of ['plant','land','spot'])mixed=addObject(mixed,kind).settings;mixed=addBlueLayer(mixed).settings;for(const kind of ['vector','drawn'])mixed=addLayer(mixed,kind).settings;
let custom=addCustomColor(mixed);mixed=editLayer(custom.settings,getLayers(mixed).filter(l=>l.flora?.generator==='flower').at(-1).id,{group:custom.id,rotation:37,scaleX:.8,flipX:true,strokes:[{kind:'erase',rx:.07,ry:.1,points:[[.5,.4],[.6,.6]]}]},{manual:true});
mixed=editLayer(mixed,getLayers(mixed)[1].id,{visible:false});mixed=editLayer(mixed,getLayers(mixed)[2].id,{opacity:24});
cases.push(['mixed custom/paint/vector/hidden',mixed]);cases.push(['no grain', {...base,grain:0,softness:0,edgeVariation:0,glow:0}]);cases.push(['max surface',{...base,grain:100,softness:100,edgeVariation:100,halo:100,glow:100,toneBleed:100}]);
try{
 for(const [name,raw]of cases){
  const settings=normalizeSettings(raw),scene=createLayerScene(settings),p={settings,scene,fields:await pool.prepare(scene,settings)};
  const passes=[['opaque',0,false,-1,null],['transparent',0,true,-1,null],['picking',1,false,-1,null],['layer PNG',0,true,scene.length-1,null],['tile',0,false,-1,{x:113,y:59,fullWidth:768,fullHeight:432}]];
  for(const [label,editor,transparent,layer,region]of passes){
   before.render(settings,384,216,editor,transparent,layer,region,p);const old=rgba(before);
   after.render(settings,384,216,editor,transparent,layer,region,p);const now=rgba(after);
   const diff=pixelDifference(old,now),ok=editor?diff.max===0:diff.max<=1&&diff.mean<.001;
   write((ok?'PASS ':'FAIL ')+name+' '+label+' · max '+diff.max+', MAE '+diff.mean.toFixed(6));
   if(!ok)throw Error('Visual regression: '+name+' '+label);

  }
  if(name==='32 flowers')for(const r of [before,after]){const c=document.createElement('canvas');c.width=960;c.height=540;c.getContext('2d').drawImage(r.render(settings,960,540,0,false,-1,null,p),0,0);const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=r===before?'Before':'After';figure.append(c,caption);document.querySelector('#images').append(figure);if(r===after){const link=document.createElement('a');link.textContent='Download optimized PNG';link.download='grainy-land-gpu-check.png';link.href=URL.createObjectURL(await new Promise(resolve=>c.toBlob(resolve,'image/png')));figure.append(link);}}
 }
 // A hidden object's isolated contour must still be available to the editor.
 const hidden=editLayer(base,getLayers(base)[0].id,{visible:false}),settings=normalizeSettings(hidden),scene=createLayerScene(settings);
 const p={settings,scene,fields:await pool.prepare(scene,settings,{editorPass:2})};
 const old=before.formMap(settings,384,216,0,p),now=after.formMap(settings,384,216,0,p);
 if(!now.ids.some(Boolean)||pixelDifference(old.ids,now.ids).max)throw Error('Hidden isolated picking changed');
 write('PASS hidden object isolated picking');
 // Instrument actual GPU transfers: surface-only edits need no uploads, and
 // recoloring must not upload the unchanged contour again.
 const uploads=[],sub=after.gl.texSubImage2D.bind(after.gl);
 after.gl.texSubImage2D=(...args)=>{uploads.push(after.gl.getParameter(after.gl.ACTIVE_TEXTURE)-after.gl.TEXTURE0);return sub(...args);};
 const plain={...base,fColorVariation:0,fPetalColors:0};
 after.render(plain,384,216);uploads.length=0;
 after.render({...plain,grain:1},384,216);
 if(uploads.length)throw Error('Surface-only edit uploaded field data');
 write('PASS surface edits reuse GPU fields');
 after.render({...plain,depth:'#AA5500'},384,216);
 if(!uploads.length||uploads.some(unit=>unit!==3))throw Error('Recolor uploaded geometry or skipped RGB');
 write('PASS recoloring uploads only RGB');
 uploads.length=0;
 const changed={...plain,fType:'cup'};
 after.formMap(changed,320,180);
 if(!uploads.length||uploads.some(unit=>unit!==2))throw Error('Picking uploaded pigment data');
 write('PASS picking uploads only contours');
 before.render(changed,384,216);after.render(changed,384,216);
 const restored=pixelDifference(rgba(before),rgba(after));
 if(restored.max>1||restored.mean>=.001)throw Error('Paint atlas did not recover after picking');
 write('PASS paint redraw after changed picking bounds restores colors');
 write('All GPU reference checks passed');
}catch(e){write('ERROR '+e.stack);}finally{before.destroy();after.destroy();pool.destroy();}
