import { normalizeSettings, exportDimensions } from './document.js?v=alpha-1';
const signature=[137,80,78,71,13,10,26,10];
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
// PNG pHYs stores pixels/metre; insert before IDAT and replace the browser's
// resolution without decoding or changing image data. https://www.w3.org/TR/png-3/#11pHYs
export async function withPngDpi(blob,dpi) {
    if(!Number.isFinite(dpi)||dpi<36||dpi>1200)throw new RangeError('DPI must be between 36 and 1200.');
    const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer);
    if(!signature.every((v,i)=>bytes[i]===v))throw new Error('Invalid PNG image.');
    const physical=new Uint8Array(21),pv=new DataView(physical.buffer),ppm=Math.round(dpi/0.0254);
    pv.setUint32(0,9);physical.set([112,72,89,115],4);pv.setUint32(8,ppm);pv.setUint32(12,ppm);physical[16]=1;
    pv.setUint32(17,crc32(physical.subarray(4,17)));
    const parts=[bytes.subarray(0,8)];let header=false,end=false;
    for(let at=8;at<bytes.length;) {
        if(at+12>bytes.length)throw new Error('Truncated PNG image.');
        const length=view.getUint32(at),next=at+length+12;
        if(next>bytes.length)throw new Error('Truncated PNG image.');
        const type=String.fromCharCode(...bytes.subarray(at+4,at+8));
        if(!header && (type!=='IHDR'||length!==13))throw new Error('Invalid PNG header.');
        if(type!=='pHYs')parts.push(bytes.subarray(at,next));
        if(!header){parts.push(physical);header=true;}
        at=next;
        if(type==='IEND'){end=true;break;}
    }
    if(!header||!end)throw new Error('Incomplete PNG image.');
    return new Blob(parts,{type:'image/png'});
}
export async function renderPNG(renderer,settings) {
    const s=normalizeSettings(settings),{width,height}=exportDimensions(s);
    const surface=renderer.render(s,width,height,0,s.transparentBackground),canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    try {
        const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Could not allocate the export canvas.');
        ctx.drawImage(surface,0,0);
        const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG encoding failed.')),'image/png'));
        return {blob:s.canvasUnit==='mm'?await withPngDpi(blob,s.dpi):blob,width,height};
    } finally {canvas.width=canvas.height=1;}
}
