import {defaults,normalizeSettings} from '../document.js?v=layers-zip-1';
import {getLayers,withLayers,addLayer,editLayer} from '../layers.js?v=layers-zip-1';
import {LandscapeRenderer} from '../render.js?v=layers-zip-1';
import {renderLayersZIP} from '../layers-export.js?v=layers-zip-2';
import {readStoredZip} from './zip-reader.js';
const results=[],renderer=new LandscapeRenderer();
const check=(name,ok)=>{results.push((ok?'PASS ':'FAIL ')+name);document.querySelector('#results').textContent=results.join('\n');if(!ok)throw new Error(name);};
const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const pixels=c=>c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data;
try {
    for(const mode of ['landscape','abstract'])for(const transparentBackground of [false,true]) {
        const variant=mode+(transparentBackground?' transparent':' with background');
        let settings=normalizeSettings({...defaults,mode,width:320,height:180,exportScale:2,glow:72,toneBleed:100,exportLayers:true,transparentBackground});
        const stack=getLayers(settings).map((l,i)=>({...l,visible:i!==2,opacity:i===1?43:100,x:i===3?.08:0}));
        settings=withLayers(settings,stack);let added=addLayer(settings,'drawn');settings=added.settings;
        settings=editLayer(settings,added.id,{strokes:[{kind:'paint',rx:.06,ry:.09,points:[[.14,.15],[.25,.29]]}]});
        settings=addLayer(settings,'drawn').settings; // deliberately empty layer
        const before=JSON.stringify(settings),width=640,height=360;
        const expected=canvas(width,height);expected.getContext('2d').drawImage(renderer.render(settings,width,height,0,transparentBackground),0,0);
        const progress=[],artifact=await renderLayersZIP(renderer,settings,{onProgress:e=>progress.push(e.current)});
        check(variant+' leaves the source snapshot intact',JSON.stringify(settings)===before);
        const files=readStoredZip(new Uint8Array(await artifact.blob.arrayBuffer()));
        check(variant+' exports every layer with PNG-only filenames',files.length===(transparentBackground?8:9)&&files.every(e=>e.name.endsWith('.png')));
        check(variant+' reports progress for each PNG',progress.join(',')===files.map((_,i)=>i+1).join(','));
        const composite=canvas(width,height),ctx=composite.getContext('2d');
        for(const [order,file] of [...files].reverse().entries()) {
            const index=order-(transparentBackground?0:1);
            const png=new Blob([file.bytes],{type:'image/png'}),bitmap=await createImageBitmap(png);
            check(variant+' '+file.name+' keeps full export dimensions',bitmap.width===width&&bitmap.height===height);
            const isolated=canvas(width,height);isolated.getContext('2d').drawImage(bitmap,0,0);const rgba=pixels(isolated);
            if(index===-1)check(variant+' Background is a separate opaque PNG in the exact sky color',rgba.every((v,i)=>v===[35,83,219,255][i%4]));
            else check(variant+' '+file.name+' contains transparency',rgba.some((v,i)=>i%4===3&&v===0));
            if(index===6)check(variant+' drawn paint exports visible pixels',rgba.some((v,i)=>i%4===3&&v>0));
            if(index===7)check(variant+' empty drawn layer is completely clear',rgba.every(v=>v===0));
            if(index===2)check(variant+' hidden layer still exports its pixels',rgba.some((v,i)=>i%4===3&&v>0));
            if(index===1)check(variant+' layer opacity is preserved',rgba.reduce((max,v,i)=>i%4===3?Math.max(max,v):max,0)<128);
            if(!file.name.endsWith('-hidden.png'))ctx.drawImage(bitmap,0,0);
            bitmap.close();isolated.width=isolated.height=1;
        }
        const a=pixels(expected),b=pixels(composite);let error=0;
        // Compare visible premultiplied colors: RGB in almost-clear pixels is immaterial.
        for(let i=0;i<a.length;i+=4){for(let c=0;c<3;c++)error+=Math.abs(a[i+c]*a[i+3]/255-b[i+c]*b[i+3]/255);error+=Math.abs(a[i+3]-b[i+3]);}
        error/=a.length;
        check(variant+' PNG layers recompose with reflected color and glow ('+error.toFixed(3)+' MAE)',error<1);
        const image=document.createElement('img');image.src=composite.toDataURL();image.alt=variant+' recomposed layer PNGs';document.querySelector('#artifacts').append(image);
    }
    const print=normalizeSettings({...defaults,width:240,height:135,canvasUnit:'mm',dpi:150});
    const printZip=await renderLayersZIP(renderer,print),files=readStoredZip(new Uint8Array(await printZip.blob.arrayBuffer()));
    check('Every print layer retains DPI metadata',files.every(f=>{const v=new DataView(f.bytes.buffer);return String.fromCharCode(...f.bytes.slice(37,41))==='pHYs'&&v.getUint32(41)===5906&&v.getUint32(45)===5906;}));
    document.querySelector('#results').textContent=results.join('\n')+'\nAll layer ZIP checks passed.';
} catch(error){document.querySelector('#results').textContent=results.join('\n')+'\nERROR '+error.message;}
finally{renderer.destroy();}
