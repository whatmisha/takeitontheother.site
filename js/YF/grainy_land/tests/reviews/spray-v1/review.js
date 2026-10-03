import {LandscapeRenderer} from '../../../render.js?v=spray-1';
const {cases}=await (await fetch('../forms-v3/metrics.json')).json();
const filename=i=>String(i+1).padStart(2,'0')+'.png';
const before=i=>'../forms-v3/'+String(i*2+2).padStart(2,'0')+'.png';
const png=c=>new Promise(resolve=>c.toBlob(resolve,'image/png'));
const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});
const save=async(name,body)=>{const r=await fetch('/__grainy_spray_save/'+name,{method:'POST',body});if(!r.ok)throw Error('Save failed: '+name);};
const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function mount(){
 const grid=document.getElementById('grid');grid.replaceChildren();
 cases.forEach((entry,i)=>{for(const after of [false,true]){
  const figure=document.createElement('figure'),link=document.createElement('a'),img=new Image(),label=document.createElement('figcaption');
  img.src=(after?filename(i):before(i))+'?v='+Date.now();img.alt=entry.label+(after?' · напыление':' · прежнее зерно');
  label.textContent=img.alt;link.href=img.src;link.append(img);figure.append(link,label);grid.append(figure);
 }});
}
async function generate(){
 const button=document.getElementById('generate'),status=document.getElementById('status');button.disabled=true;
 const renderer=new LandscapeRenderer();
 try{
  for(let i=0;i<cases.length;i++){
   const c=canvas(1920,1080);c.getContext('2d').drawImage(renderer.render(cases[i].settings,1920,1080),0,0);
   await save(filename(i),await png(c));status.textContent='Сохранено '+(i+1)+' / '+cases.length;
  }
  const sheet=canvas(1600,487*cases.length),ctx=sheet.getContext('2d');
  ctx.fillStyle='#171717';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.font='20px system-ui';
  for(let i=0;i<cases.length;i++) for(const after of [false,true]){
   const x=after?808:8,y=i*487;ctx.fillStyle='#eee';ctx.fillText(cases[i].label+(after?' · напыление':' · прежнее зерно'),x,y+28);
   ctx.drawImage(await load(after?filename(i):before(i)),x,y+38,784,441);
  }
  await save('contact-sheet.png',await png(sheet));
  const pair=canvas(1600,974),pairCtx=pair.getContext('2d');
  for(const [row,index] of [[0,0],[1,4]])pairCtx.drawImage(sheet,0,index*487,1600,487,0,row*487,1600,487);
  await save('before-after.png',await png(pair));
  // Identical 640×300 artwork fragments, shown at 1× before browser scaling.
  const detail=canvas(1280,1044),dc=detail.getContext('2d');dc.fillStyle='#171717';dc.fillRect(0,0,1280,1044);dc.font='18px system-ui';
  for(const [row,index,top] of [[0,0,440],[1,4,670]])for(const after of [false,true]){
   const x=after?640:0,y=row*348;dc.fillStyle='#eee';dc.fillText(cases[index].label+(after?' · напыление':' · прежнее зерно'),x+8,y+28);
   dc.drawImage(await load(after?filename(index):before(index)),650,top,640,300,x,y+40,640,300);
  }
  // Bring both references to the same 1920px artwork width before cropping.
  for(const [n,left,top] of [[1,670,390],[2,670,390]]){
   const ref=await load('../../../ref/landscape_0'+n+'.png'),ratio=ref.width/1920,x=(n-1)*640,y=696;
   dc.fillStyle='#eee';dc.fillText('Референс '+n+' · приведён к ширине 1920 px',x+8,y+28);
   dc.drawImage(ref,left*ratio,top*ratio,640*ratio,300*ratio,x,y+40,640,300);
  }
  await save('detail-sheet.png',await png(detail));
  await save('metrics.json',new Blob([JSON.stringify({renderer:'spray-1',baseline:'forms-v3 even images',cases},null,2)],{type:'application/json'}));
  mount();for(const id of ['sheet','details'])document.getElementById(id).src=(id==='sheet'?'contact-sheet':'detail-sheet')+'.png?v='+Date.now();
  status.textContent='Готово: 10 сравнений на одинаковых seed и параметрах, включая свечение и абстракцию.';
 }catch(error){status.textContent='Ошибка: '+error.message;}finally{renderer.destroy();button.disabled=false;}
}
document.getElementById('generate').onclick=generate;
mount();
