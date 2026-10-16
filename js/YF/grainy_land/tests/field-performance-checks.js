import {defaults,switchMode} from '../legacy-document.js';
import {normalizeSettings} from '../document.js?v=unified-document-1';
import {resizeObjects} from '../object-actions.js';
import {createLayerScene} from '../scene.js';
import {motionFrame} from '../motion.js';
import {FloraFieldPool} from '../flora-field-pool.js?v=field-cpu-1';
import {LandscapeRenderer} from '../render.js?v=field-cpu-1';
const before=new FloraFieldPool({createWorker:()=>new Worker(new URL('./fixtures/field-before-cpu-worker.js',import.meta.url),{type:'module'})}),after=new FloraFieldPool();
const out=document.querySelector('#results'),log=[],write=s=>{log.push(s);out.textContent=log.join('\n');};
const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const check=(name,ok)=>{write((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name);};
const read=r=>{const p=new Uint8Array(r.canvas.width*r.canvas.height*4);r.gl.readPixels(0,0,r.canvas.width,r.canvas.height,r.gl.RGBA,r.gl.UNSIGNED_BYTE,p);return p;};
try{
 for(const count of [1,8,32]){
  const s=resizeObjects({...switchMode(defaults,'f'),width:1920,height:1080,motionAmount:6},'flower',count),times=[[],[]];let pair,settings,scene;
  for(let i=0;i<9;i++){
   settings=normalizeSettings(motionFrame(s,(i+.123)/11));scene=createLayerScene(settings);pair=[];
   for(const k of i%2?[1,0]:[0,1]){const t=performance.now();pair[k]=await [before,after][k].prepare(scene,settings);if(i>=2)times[k].push(performance.now()-t);}
   for(let j=0;j<scene.length;j++)if(pair[0][j]){
    const a=pair[0][j],b=pair[1][j];
    if(a.width!==b.width||a.height!==b.height||!same(a.bounds,b.bounds)||!same(a.pixels,b.pixels)||!same(a.colors,b.colors))throw Error(count+' flowers: changed field at pose '+i+', layer '+j);
   }
   await new Promise(r=>setTimeout(r,0));
  }
  check(count+' flowers × 9 poses: identical distance and color bytes',true);
  write(JSON.stringify({flowers:count,workers:after.workers.length,beforeMs:+median(times[0]).toFixed(1),afterMs:+median(times[1]).toFixed(1),samples:times[0].length}));
  if(count===32){
   const a=new LandscapeRenderer(),b=new LandscapeRenderer(),prepared=k=>({settings,scene,fields:pair[k]});
   try{
    for(const [name,pass,transparent,layer]of [['opaque',0,false,-1],['transparent',0,true,-1],['picking',1,false,-1],['isolated layer',0,true,17]]){
     a.render(settings,960,540,pass,transparent,layer,null,prepared(0));b.render(settings,960,540,pass,transparent,layer,null,prepared(1));
     check('32 flowers: exact '+name+' GPU pixels',same(read(a),read(b)));
    }
    for(const [r,k]of [[a,0],[b,1]]){
     const c=document.createElement('canvas');c.width=960;c.height=540;c.getContext('2d').drawImage(r.render(settings,960,540,0,false,-1,null,prepared(k)),0,0);
     const f=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=k?'After':'Before';f.append(c,caption);document.querySelector('#images').append(f);
     if(k){const link=document.createElement('a');link.textContent='Download verified PNG';link.download='grainy-land-field-cpu.png';link.href=URL.createObjectURL(await new Promise(resolve=>c.toBlob(resolve)));f.append(link);}
    }
   }finally{a.destroy();b.destroy();}
  }
 }
 check('Both paths used module workers',before.enabled&&after.enabled&&before.workers.length>0&&after.workers.length>0);
 write('All CPU field comparison checks passed');
}catch(e){write('ERROR '+e.stack);}finally{before.destroy();after.destroy();}
