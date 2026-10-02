import { defaults, palettes } from '../../../document.js';
import { LandscapeRenderer } from '../../../render.js?v=landforms-2';

const manifest = await (await fetch('./manifest.json')).json();
const button = document.getElementById('generate'), status = document.getElementById('status');
const makeCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const encode=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG encoding failed')),'image/png'));
const save=async(name,body)=>{
    const response=await fetch('/__grainy_v2_save/'+name,{method:'POST',body});
    if(!response.ok)throw new Error('Save failed: '+name+' ('+response.status+')');
};
const measure=canvas=>{
    const sample=makeCanvas(480,270),ctx=sample.getContext('2d');
    ctx.drawImage(canvas,0,0,480,270);
    const data=ctx.getImageData(0,0,480,270).data;
    let blue=0,coral=0,brown=0,pink=0,yellow=0;
    for(let i=0;i<data.length;i+=4){
        const [r,g,b]=data.slice(i,i+3);
        if(b>r*1.3&&b>g*1.15){blue++;continue;}
        if(r>g*1.35&&g>b*1.3&&r<190){brown++;continue;}
        if(r>190&&b>150&&g>120&&b>g*1.03){pink++;continue;}
        if(r>200&&g>140&&g>b*1.25){yellow++;continue;}
        if(r>180&&r>g*1.15&&r>b*1.1)coral++;
    }
    const n=480*270;return {blue:blue/n,coral:coral/n,brown:brown/n,pink:pink/n,yellow:yellow/n};
};
function mount(index,seed,src){
    const figure=document.createElement('figure'),caption=document.createElement('figcaption'),img=document.createElement('img'),link=document.createElement('a');
    const label=String(index+1).padStart(2,'0');
    img.src=src;img.alt='Вариант '+label+' · seed '+seed;
    link.href='../../../?preset=pigment#';link.removeAttribute('href');
    caption.textContent=label+' · seed '+seed;
    figure.append(img,caption);document.getElementById('grid').append(figure);
}
button.addEventListener('click',async()=>{
    button.disabled=true;document.getElementById('grid').replaceChildren();
    const renderer=new LandscapeRenderer(), sheet=makeCanvas(2000,1606),sc=sheet.getContext('2d');
    sc.fillStyle='#171717';sc.fillRect(0,0,sheet.width,sheet.height);
    sc.font='17px system-ui';const snapshots=[],metrics=[];
    try{
        for(let i=0;i<manifest.seeds.length;i++){
            const seed=manifest.seeds[i],settings={...manifest.settings,seed};
            const source=renderer.render(settings,settings.width,settings.height);
            const canvas=makeCanvas(settings.width,settings.height),ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);
            const name=String(i+1).padStart(2,'0')+'.png',blob=await encode(canvas);
            await save(name,blob);snapshots.push(canvas);metrics.push({number:i+1,seed,...measure(canvas)});
            const x=16+(i%4)*496,y=16+Math.floor(i/4)*318;
            sc.drawImage(canvas,x,y,480,270);sc.fillStyle='#ddd';sc.fillText(String(i+1).padStart(2,'0')+' · '+seed,x,y+294);
            mount(i,seed,'./'+name);status.textContent='Сохранено '+(i+1)+' / 20';
            await new Promise(requestAnimationFrame);
        }
        await save('contact-sheet.png',await encode(sheet));
        document.getElementById('sheet').src='./contact-sheet.png';document.getElementById('sheet').hidden=false;
        const reference=document.getElementById('reference');await reference.decode();
        const refCanvas=makeCanvas(1920,Math.round(1920*reference.naturalHeight/reference.naturalWidth));
        refCanvas.getContext('2d').drawImage(reference,0,0,refCanvas.width,refCanvas.height);
        const details=makeCanvas(1680,1320),dc=details.getContext('2d');
        dc.fillStyle='#171717';dc.fillRect(0,0,1680,1320);dc.font='19px system-ui';
        const entries=[['Reference',refCanvas],['05 · '+manifest.seeds[4],snapshots[4]],['10 · '+manifest.seeds[9],snapshots[9]]];
        // Crop after reducing reference to the same 1920px width; no unequal magnification.
        entries.forEach(([label,canvas],column)=>{
            const x=column*560;dc.fillStyle='#ddd';dc.fillText(label,x+16,28);
            dc.drawImage(canvas,x+16,44,528,canvas.height/canvas.width*528);
            const sy=Math.round(canvas.height*.48);
            dc.drawImage(canvas,640,sy,528,440,x+16,370,528,440);
            dc.fillText('Центр, ширина исходника 1920 px',x+16,842);
            dc.drawImage(canvas,1170,Math.round(canvas.height*.63),528,400,x+16,875,528,400);
        });
        await save('detail-sheet.png',await encode(details));
        const materials=makeCanvas(1200,2180),mc=materials.getContext('2d');
        mc.fillStyle='#171717';mc.fillRect(0,0,1200,2180);mc.font='20px system-ui';
        const examples=[['default',defaults],['ember',{...defaults,...palettes.ember,glow:82,halo:65,contrast:118,softness:38}],['abstract',{...defaults,mode:'abstract',seed:925731,scale:125,flow:85,complexity:3,glow:34}]];
        for(let i=0;i<examples.length;i++){
            const [name,settings]=examples[i],canvas=makeCanvas(1920,1080);
            canvas.getContext('2d').drawImage(renderer.render(settings,1920,1080),0,0);
            await save(name+'.png',await encode(canvas));
            mc.fillStyle='#ddd';mc.fillText(name,16,28+i*724);mc.drawImage(canvas,16,44+i*724,1168,657);
        }
        await save('materials.png',await encode(materials));
        const comparison=makeCanvas(1600,1470),bc=comparison.getContext('2d');
        bc.fillStyle='#171717';bc.fillRect(0,0,1600,1470);bc.font='20px system-ui';
        for(let row=0;row<3;row++){
            const i=[4,9,17][row],before=new Image();before.src='../pigment-20/'+String(i+1).padStart(2,'0')+'.png';await before.decode();
            bc.fillStyle='#ddd';bc.fillText('До · '+String(i+1).padStart(2,'0'),16,row*490+28);bc.fillText('После · тот же seed',816,row*490+28);
            bc.drawImage(before,16,row*490+44,768,432);bc.drawImage(snapshots[i],816,row*490+44,768,432);
        }
        await save('before-after.png',await encode(comparison));
        const refMetrics=measure(refCanvas);
        await save('metrics.json',new Blob([JSON.stringify({reference:refMetrics,generated:metrics},null,2)],{type:'application/json'}));
        status.textContent='Готово: сохранены 20 PNG, общий лист, фрагменты и seed.';
    }catch(error){status.textContent='Ошибка: '+error.message;}
    finally{renderer.destroy();button.disabled=false;}
});
// Existing saved results remain reviewable without a reroll.
for(let i=0;i<manifest.seeds.length;i++)mount(i,manifest.seeds[i],'./'+String(i+1).padStart(2,'0')+'.png');
document.getElementById('sheet').src='./contact-sheet.png';document.getElementById('sheet').hidden=false;
