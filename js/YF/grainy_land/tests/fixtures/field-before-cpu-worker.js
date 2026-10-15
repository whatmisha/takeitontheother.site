import {bakeFlora,setFloraCacheBudget} from './field-before-cpu.js';
import {FLOWER_MOTION} from '../../flower-motion.js?v=petal-motion-1';

self.onmessage=({data:{id,settings,entries,cacheBudget}})=>{
 try{
  setFloraCacheBudget(cacheBudget);
  const fields=entries.map(({index,layer,motion})=>{
   if(motion)layer[FLOWER_MOTION]=motion;
   const field=bakeFlora(layer,settings);
   // Cached fields stay owned by this worker; transfer only the display buffers.
   return {index,key:field.key,geometryKey:field.geometryKey,width:field.width,height:field.height,
    bounds:field.bounds,pixels:field.pixels.slice(),colors:field.colors.slice()};
  });
  self.postMessage({id,fields},fields.flatMap(f=>[f.pixels.buffer,f.colors.buffer]));
 }catch(error){self.postMessage({id,error:error.message||String(error)});}
};
