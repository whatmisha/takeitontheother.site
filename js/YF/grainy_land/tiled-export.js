// Bounded GPU tiles and scanline bands avoid a full-size browser canvas.
const signature=new Uint8Array([137,80,78,71,13,10,26,10]);
const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function pngChunk(type,data){const out=new Uint8Array(data.length+12),v=new DataView(out.buffer);v.setUint32(0,data.length);for(let i=0;i<4;i++)out[4+i]=type.charCodeAt(i);out.set(data,8);let crc=0xffffffff;for(const b of out.subarray(4,-4))crc=table[(crc^b)&255]^(crc>>>8);v.setUint32(out.length-4,(crc^0xffffffff)>>>0);return out;}
export async function* rasterBands(renderer,s,width,height,{signal,onProgress=()=>{},layerIndex=-1,transparent=s.transparentBackground,tileSize=1024,bandHeight=64}={}){
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 try{for(let y=0;y<height;y+=bandHeight){signal?.throwIfAborted();const h=Math.min(bandHeight,height-y),rgba=new Uint8Array(width*h*4);
  for(let x=0;x<width;x+=tileSize){signal?.throwIfAborted();const w=Math.min(tileSize,width-x);canvas.width=w;canvas.height=h;ctx.drawImage(renderer.render(s,w,h,0,transparent,layerIndex,{x,y,fullWidth:width,fullHeight:height}),0,0);const pixels=ctx.getImageData(0,0,w,h).data;
   for(let row=0;row<h;row++)rgba.set(pixels.subarray(row*w*4,(row+1)*w*4),(row*width+x)*4);
  }yield {rgba,y,height:h};onProgress({current:Math.min(y+h,height),total:height});await new Promise(resolve=>setTimeout(resolve,0));
 }}finally{canvas.width=canvas.height=1;}
}
export async function encodePNG(width,height,bands,{dpi=0,signal}={}){
 if(typeof CompressionStream==='undefined')throw Error('This browser does not support streaming PNG export.');
 const header=new Uint8Array(13),hv=new DataView(header.buffer);hv.setUint32(0,width);hv.setUint32(4,height);header[8]=8;header[9]=6;
 const parts=[signature,pngChunk('IHDR',header),pngChunk('sRGB',new Uint8Array([0]))];
 if(dpi){const b=new Uint8Array(9),v=new DataView(b.buffer),ppm=Math.round(dpi/.0254);v.setUint32(0,ppm);v.setUint32(4,ppm);b[8]=1;parts.push(pngChunk('pHYs',b));}
 const stream=new CompressionStream('deflate'),writer=stream.writable.getWriter();const reading=(async()=>{const reader=stream.readable.getReader();while(true){const {value,done}=await reader.read();if(done)break;parts.push(pngChunk('IDAT',value));}})();
 try{for await(const {rgba,height:h}of bands){signal?.throwIfAborted();const stride=width*4,filtered=new Uint8Array((stride+1)*h);for(let y=0;y<h;y++){const offset=y*(stride+1),src=y*stride;filtered[offset]=1;for(let x=0;x<stride;x++)filtered[offset+1+x]=(rgba[src+x]-(x>=4?rgba[src+x-4]:0))&255;}await writer.write(filtered);}await writer.close();await reading;}
 catch(error){await writer.abort(error).catch(()=>{});await reading.catch(()=>{});throw error;}
 parts.push(pngChunk('IEND',new Uint8Array()));return new Blob(parts,{type:'image/png'});
}
export async function renderTiledPNG(renderer,s,width,height,options={}){return {width,height,blob:await encodePNG(width,height,rasterBands(renderer,s,width,height,options),{dpi:s.canvasUnit==='mm'?s.dpi:0,signal:options.signal})};}
