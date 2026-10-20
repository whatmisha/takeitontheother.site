import {performance} from 'node:perf_hooks';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const cold=path=>JSON.parse(spawnSync(process.execPath,['--input-type=module','-e',
  `const t=performance.now();await import(${JSON.stringify(path)});console.log(performance.now()-t)`],{cwd:root,encoding:'utf8'}).stdout);
const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];
const results={environment:process.version,coldGeometryImportMs:{
  before:median(Array.from({length:5},()=>cold('../../src/geometry/globalGeometry.js'))),
  after:median(Array.from({length:5},()=>cold('./runtime/geometry/globalGeometry.js')))}};
const old=await import('../../../src/geometry/flatGeometry.js');
const next=await import('../runtime/geometry/flatGeometry.js');
const {talentSettings}=await import('../talent-surface.js');
const {LayoutCache}=await import('../layout-cache.js');
const measure=run=>{for(let i=0;i<30;i++)run(i);const samples=[];for(let i=0;i<200;i++){const t=performance.now();run(i);samples.push(performance.now()-t);}return median(samples);};
results.flatSceneMs={};
for(const [width,height] of [[714,768],[390,422]]){
 const settings=talentSettings(width,height),layout=next.buildFlatLayout(settings);
 const options=i=>({transientField:{x:Math.sin(i)*width*.3,y:Math.cos(i)*height*.3}});
 results.flatSceneMs[`${width}x${height}`]={before:measure(i=>old.buildFlatScene(settings,options(i))),
  after:measure(i=>next.buildFlatScene(settings,{...options(i),layout}))};
}
const cache=new LayoutCache();const start=performance.now();cache.get(1108);
const uncached=performance.now()-start;const cached=measure(()=>cache.get(1108));
results.layoutMs={uncached,cached};
console.log(JSON.stringify(results,null,2));
