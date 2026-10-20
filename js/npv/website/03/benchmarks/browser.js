const result=document.querySelector('#result');
const childProbe=()=>{
  const samples=[]; let firstSphere=null,ready=null;
  const native=requestAnimationFrame.bind(window);
  window.requestAnimationFrame=callback=>native(time=>{const start=performance.now();callback(time);samples.push(performance.now()-start);});
  const fill=CanvasRenderingContext2D.prototype.fill;
  CanvasRenderingContext2D.prototype.fill=function(...args){
    const value=fill.apply(this,args);
    if(firstSphere===null && this.canvas.id==='main-sphere') firstSphere=performance.now();
    return value;
  };
  const tasks=[];
  try{new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});}catch{}
  document.addEventListener('DOMContentLoaded',()=>{ready=performance.now();});
  window.benchmarkReport=()=>({firstSphereMs:firstSphere,domReadyMs:ready,callbackMs:samples.slice(),longTasksMs:tasks.slice()});
};
const quantile=(items,p)=>[...items].sort((a,b)=>a-b)[Math.min(items.length-1,Math.floor(items.length*p))]||0;
document.querySelector('#run').onclick=async()=>{
  const button=document.querySelector('#run');button.disabled=true;result.textContent='Loading…';
  const version=document.querySelector('#version').value;
  const [width,height]=document.querySelector('#size').value.split(',').map(Number);
  const blur=document.querySelector('#blur').value;
  const base=new URL(version==='dist'?'../dist/':`../../${version}/`,location.href);
  let html=await (await fetch(new URL('index.html',base))).text();
  const experiment=blur==='3'?`<style>.glass-blur:nth-child(2){--blur:2px;--solid:62%;--end:100%}.glass-blur:nth-child(3){--blur:8px;--solid:30%;--end:72%}.glass-blur:nth-child(4){--blur:24px;--solid:0%;--end:40%}.glass-blur:nth-child(n+5){display:none}</style>`:'';
  html=html.replace('<head>',`<head><base href="${base}"><script>(${childProbe.toString()})()<\/script>`).replace('</head>',experiment+'</head>');
  const iframe=document.createElement('iframe');iframe.width=width;iframe.height=height;iframe.srcdoc=html;
  document.querySelector('#stage').replaceChildren(iframe);
  await new Promise(resolve=>iframe.onload=resolve);
  const win=iframe.contentWindow;
  const deadline=performance.now()+15000;
  while(!win.benchmarkReport?.().firstSphereMs && performance.now()<deadline) await new Promise(requestAnimationFrame);
  await new Promise(resolve=>setTimeout(resolve,800));
  const startup=win.benchmarkReport();
  const gaps=[];let last=0;
  result.textContent='Measuring scroll, reverse transition and pointer response…';
  const start=performance.now();
  const scrollHeight=win.document.documentElement.scrollHeight-height;
  await new Promise(resolve=>{
    const step=time=>{
      if(last)gaps.push(time-last);last=time;
      const t=(time-start)/1000;
      if(t<5) win.scrollTo({top:scrollHeight*t/5,behavior:'instant'});
      else if(t<8){
        win.scrollTo({top:scrollHeight,behavior:'instant'});
        const panel=win.document.querySelector('.graphic-panel').getBoundingClientRect();
        win.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:panel.width*(.5+.35*Math.sin(t*2)),clientY:panel.height*(.5+.3*Math.cos(t*2))}));
      }else if(t<13)win.scrollTo({top:scrollHeight*(1-(t-8)/5),behavior:'instant'});
      else {resolve();return;}
      requestAnimationFrame(step);
    };requestAnimationFrame(step);
  });
  const report=win.benchmarkReport();
  const callbacks=report.callbackMs.slice(startup.callbackMs.length);
  const summary={version,viewport:[width,height],blurLayers:Number(blur),firstSphereMs:report.firstSphereMs,domReadyMs:report.domReadyMs,
    frames:gaps.length,frameGapP95:quantile(gaps,.95),frameGapMax:Math.max(...gaps),framesOver25ms:gaps.filter(t=>t>25).length,
    callbackP95:quantile(callbacks,.95),callbackMax:Math.max(0,...callbacks),longTasks:report.longTasksMs.length,
    note:'Local WebKit iframe, warm HTTP cache; frame gaps include browser scheduling. No CPU throttling.'};
  result.textContent=JSON.stringify(summary,null,2);button.disabled=false;
};
