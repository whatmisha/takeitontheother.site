import {LandscapeRenderer} from '../render.js?v=vector-1';
import {defaults,regenerate,readDocument,makeDocument} from '../document.js?v=vector-1';
import {addLayer,withLayers,editLayer,convertLayer} from '../layers.js?v=vector-1';
import {moveVectorNode,defaultVectorPath} from '../vector-path.js?v=vector-1';
const r=new LandscapeRenderer(),results=[];
const check=(name,ok)=>{results.push((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name);};
const capture=s=>{const c=document.createElement('canvas');c.width=480;c.height=270;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(r.render(s,480,270,0,true),0,0);return ctx.getImageData(0,0,480,270).data;};
const equal=(a,b)=>a.every((v,i)=>v===b[i]);
try{
 for(const mode of ['landscape','abstract']){
  const {settings:s,id}=addLayer(withLayers({...defaults,mode},[]),'vector'),before=capture(s);
  check(mode+' vector has opaque body and transparent exterior',before.some((v,i)=>i%4===3&&v===255)&&before.some((v,i)=>i%4===3&&v===0));
  check(mode+' spray gives the contour partial coverage',before.some((v,i)=>i%4===3&&v>0&&v<255));
  check(mode+' Generate and composition preserve vector pixels',equal(before,capture(regenerate({...s,scale:200,flow:0,folds:0},99))));
  check(mode+' JSON preserves rendering',equal(before,capture(readDocument(JSON.parse(JSON.stringify(makeDocument(s)))))));
  check(mode+' Convert to drawn preserves rendering',equal(before,capture(convertLayer(s,id))));
  const moved=editLayer(s,id,{vectorPath:moveVectorNode(defaultVectorPath(),0,[.5,.05])});
  check(mode+' node edit changes visible contour',!equal(before,capture(moved)));
  const painted=editLayer(s,id,{strokes:[{kind:'erase',rx:.08,ry:.08,points:[[.5,.5]]}]});
  check(mode+' eraser removes vector paint at its center',capture(painted)[(135*480+240)*4+3]<before[(135*480+240)*4+3]);
  const map=r.formMap(s,160,90);check(mode+' picking identifies vector body',map.ids[45*160+80]===1);
 }
 results.push('All vector renderer checks passed.');
}catch(e){results.push('ERROR '+e.message);}finally{r.destroy();document.querySelector('#results').textContent=results.join('\n');}
