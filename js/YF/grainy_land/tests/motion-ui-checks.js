const frame=document.querySelector('#app'),out=document.querySelector('#results'),log=[];
const pause=(ms=50)=>new Promise(r=>setTimeout(r,ms));
const check=(name,ok)=>{log.push((ok?'PASS ':'FAIL ')+name);out.textContent=log.join('\n');if(!ok)throw Error(name);};
try{
 for(let i=0;i<200&&!frame.contentDocument?.documentElement.dataset.ready;i++)await pause();
 const d=frame.contentDocument,w=frame.contentWindow,$=id=>d.getElementById(id),errors=[];
 w.addEventListener('error',e=>errors.push(e.message));w.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
 const click=async id=>{$(id).click();await pause();};
 const still=()=>$('mainCanvas').toDataURL();
 const playing=()=>$('playMotion').getAttribute('aria-pressed')==='true';
 check('App ready',d.documentElement.dataset.ready==='true');
 await click('presetDropdownToggle');d.querySelector('#presetDropdownMenu [data-value="Ember"]').click();await pause();await click('modeFlower');
 const count=$('fCountValue');count.value='32';count.focus();count.blur();await pause();
 check('32 flowers are ready',count.value==='32'&&d.querySelectorAll('#layerList > [data-layer-id]').length===32);
 const original=still();
 $('playMotion').click();check('Play starts',playing());
 await pause(10);const t=performance.now();$('playMotion').click();const latency=performance.now()-t;
 check('Stop during field preparation returns to the original artwork',!playing()&&still()===original);
 await pause(500);check('A late worker frame cannot overwrite Stop',still()===original);
 log.push('Stop handler: '+latency.toFixed(1)+' ms');out.textContent=log.join('\n');
 $('playMotion').click();await pause(5);$('playMotion').click();$('playMotion').click();
 check('Rapid restart leaves one active playback',playing());
 let moved=false;for(let i=0;i<50&&!moved;i++){await pause(50);moved=still()!==original;}
 check('Restarted playback displays moving flowers',moved);
 d.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));
 d.body.dispatchEvent(new w.KeyboardEvent('keyup',{key:' ',code:'Space',bubbles:true}));await pause();
 check('Space stops and restores the still frame',!playing()&&still()===original);
 d.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));
 d.body.dispatchEvent(new w.KeyboardEvent('keyup',{key:' ',code:'Space',bubbles:true}));await pause();
 check('Space starts a fresh playback',playing());
 d.querySelector('#compositionPanelHeader').dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true}));await pause();
 check('Editing controls stops pending playback',!playing());await pause(500);
 check('No app errors: '+JSON.stringify(errors),errors.length===0&&!$('operationStatus').textContent);
 check('No stale frames after cancellation',still()===original);
 check('All playback lifecycle checks passed',true);
}catch(error){out.textContent+='\nERROR '+error.stack;}
