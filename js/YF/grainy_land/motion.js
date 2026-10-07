import {getLayers,layerSettingsKey} from './layer-data.js?v=studio-1';
export function motionFrame(settings,phase){
 const angle=((phase%1)+1)%1*Math.PI*2,amount=(settings.motionAmount??3)/100,stack=getLayers(settings),aspect=settings.width/settings.height;
 const groups=new Map();stack.forEach((l,i)=>{if(!l.collection||l.locked)return;const g=groups.get(l.collection)??{members:[],first:i};g.members.push(l);groups.set(l.collection,g);});
 const rotation=Math.sin(angle)*amount*90,a=rotation*Math.PI/180,c=Math.cos(a),sn=Math.sin(a);
 return {...settings,[layerSettingsKey(settings.mode)]:stack.map((l,i)=>{
  if(l.locked)return l;const g=groups.get(l.collection),first=g?stack[g.first]:l,index=g?.first??i,p=(first.seed%997)/997*Math.PI*2+index*.7;
  let x=l.x,y=l.y;if(g){const cx=g.members.reduce((v,m)=>v+m.x,0)/g.members.length,cy=g.members.reduce((v,m)=>v+m.y,0)/g.members.length,dx=(l.x-cx)*aspect,dy=l.y-cy;x=cx+(dx*c-dy*sn)/aspect;y=cy+dx*sn+dy*c;}
  return {...l,x:x+(Math.sin(angle+p)-Math.sin(p))*amount,y:y+(Math.cos(angle+p)-Math.cos(p))*amount*.5,rotation:(l.rotation||0)+rotation};
 })};
}
export async function renderVideo(renderer,settings,{signal,onProgress=()=>{}}={}){
 if(typeof MediaRecorder==='undefined')throw Error('Video export is not supported in this browser.');
 const mimeType=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));if(!mimeType)throw Error('No supported video encoder.');
 const max=1920,scale=Math.min(1,max/Math.max(settings.width,settings.height)),width=Math.max(2,Math.round(settings.width*scale/2)*2),height=Math.max(2,Math.round(settings.height*scale/2)*2),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d'),fps=30,seconds=settings.motionDuration??6,stream=canvas.captureStream(fps),recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:12000000}),parts=[];
 const finished=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};recorder.onstop=resolve;recorder.onerror=e=>reject(e.error??Error('Video encoding failed.'));});
 try{
  ctx.drawImage(renderer.render(motionFrame(settings,0),width,height),0,0);recorder.start();const start=performance.now();
  while(true){signal?.throwIfAborted();const elapsed=(performance.now()-start)/1000;if(elapsed>=seconds)break;ctx.drawImage(renderer.render(motionFrame(settings,elapsed/seconds),width,height),0,0);onProgress({current:elapsed,total:seconds});await new Promise(resolve=>setTimeout(resolve,1000/fps));}
  recorder.stop();await finished;return {blob:new Blob(parts,{type:mimeType}),extension:mimeType.startsWith('video/mp4')?'mp4':'webm',width,height};
 }catch(error){if(recorder.state!=='inactive')recorder.stop();await finished.catch(()=>{});throw error;}finally{for(const track of stream.getTracks())track.stop();canvas.width=canvas.height=1;}
}
