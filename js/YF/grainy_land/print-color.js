import {rasterBands} from './tiled-export.js?v=studio-1';
import {exportDimensions} from './document.js?v=studio-1';
let runtime;
async function cms(){if(!runtime)runtime=import('./vendor/lcms/lcms.js').then(async api=>({api,engine:await api.instantiate({locateFile:name=>new URL('./vendor/lcms/'+name,import.meta.url).href})}));return runtime;}
export class PrintColor {
 constructor(){this.profile=null;this.transforms=null;this.proofCanvas=null;}
 async load(bytes,name='ICC profile'){
  if(bytes.length<128||bytes.length>4*1024*1024||String.fromCharCode(...bytes.slice(36,40))!=='acsp')throw Error('Choose an ICC profile up to 4 MiB.');
  const {engine:m,api}=await cms(),ptr=m._malloc(bytes.length);let profile;
  try{m.HEAPU8.set(bytes,ptr);profile=m._cmsOpenProfileFromMem(ptr,bytes.length);}finally{m._free(ptr);}
  if(!profile)throw Error('This ICC profile could not be read.');
  const space=m.cmsGetColorSpaceASCII(profile);if(!['RGB','CMYK'].includes(space)){m.cmsCloseProfile(profile);throw Error('Choose an RGB or CMYK output profile.');}
  this.clear();this.profile={bytes:bytes.slice(),name,space,handle:profile};this.engine=m;this.api=api;return this.profile;
 }
 clear(){this.resetTransforms();if(this.profile)this.engine.cmsCloseProfile(this.profile.handle);this.profile=null;}
 resetTransforms(){if(this.transforms)for(const h of [this.transforms.output,this.transforms.proof])if(h)this.engine.cmsDeleteTransform(h);this.transforms=null;}
 ensure(intent=1){if(!this.profile)throw Error('Load a print ICC profile first.');if(this.transforms?.intent===intent)return this.transforms;
  this.resetTransforms();const m=this.engine,a=this.api,srgb=m.cmsCreate_sRGBProfile(),format=this.profile.space==='CMYK'?a.TYPE_CMYK_8:a.TYPE_RGB_8;
  const output=m.cmsCreateTransform(srgb,a.TYPE_RGB_8,this.profile.handle,format,intent,a.cmsFLAGS_BLACKPOINTCOMPENSATION);
  // Printing intent follows the selected output intent; absolute proofing simulates paper white.
  // https://www.littlecms.com/LittleCMS2.18%20tutorial.pdf (Proofing)
  const proof=m.cmsCreateProofingTransform(srgb,a.TYPE_RGB_8,srgb,a.TYPE_RGB_8,this.profile.handle,intent,3,a.cmsFLAGS_SOFTPROOFING|a.cmsFLAGS_BLACKPOINTCOMPENSATION);m.cmsCloseProfile(srgb);
  this.transforms={intent,output,proof};if(!output||!proof){this.resetTransforms();throw Error('The profile does not support output conversion and proofing.');}return this.transforms;
 }
 rgb(rgba){const out=new Uint8Array(rgba.length/4*3);for(let i=0,j=0;i<rgba.length;i+=4,j+=3){const alpha=rgba[i+3]/255;for(let c=0;c<3;c++)out[j+c]=Math.round(rgba[i+c]*alpha+255*(1-alpha));}return out;}
 convert(rgba,intent=1,proof=false){const t=this.ensure(intent);return this.engine.cmsDoTransform(proof?t.proof:t.output,this.rgb(rgba),rgba.length/4);}
 proof(surface,intent=1){this.proofCanvas??=document.createElement('canvas');const c=this.proofCanvas;c.width=surface.width;c.height=surface.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(surface,0,0);const image=ctx.getImageData(0,0,c.width,c.height),rgb=this.convert(image.data,intent,true);for(let i=0,j=0;i<image.data.length;i+=4,j+=3){image.data[i]=rgb[j];image.data[i+1]=rgb[j+1];image.data[i+2]=rgb[j+2];image.data[i+3]=255;}ctx.putImageData(image,0,0);return c;}
 async export(renderer,s,{signal,onProgress}={}){
  if(!this.profile)throw Error('Load a print ICC profile first.');
  // The user can load another profile while a long export is running.
  const output=new PrintColor();await output.load(this.profile.bytes,this.profile.name);
  try {output.ensure(s.printIntent);const {width,height}=exportDimensions(s),strips=[],channels=output.profile.space==='CMYK'?4:3;
   for await(const band of rasterBands(renderer,s,width,height,{signal,onProgress,transparent:false})){const converted=output.convert(band.rgba,s.printIntent),compressed=await new Response(new Blob([converted]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer();strips.push(new Uint8Array(compressed));}
   signal?.throwIfAborted();return {blob:makeTIFF(width,height,strips,{channels,dpi:s.dpi,icc:output.profile.bytes,rowsPerStrip:64}),width,height};
  }finally{output.clear();}
 }
}
// Baseline TIFF, chunky RGB/CMYK, Deflate strips and embedded ICC (tag 34675).
export function makeTIFF(width,height,strips,{channels=4,dpi=300,icc,rowsPerStrip=64}){
 const tags=[[256,4,1,width],[257,4,1,height],[258,3,channels,Array(channels).fill(8)],[259,3,1,8],[262,3,1,channels===4?5:2],[273,4,strips.length,[]],[277,3,1,channels],[278,4,1,rowsPerStrip],[279,4,strips.length,strips.map(s=>s.length)],[282,5,1,[dpi,1]],[283,5,1,[dpi,1]],[284,3,1,1],[296,3,1,2],[34675,7,icc.length,icc]];
 if(channels===4)tags.push([332,3,1,1]);tags.sort((a,b)=>a[0]-b[0]);
 const sizes={3:2,4:4,5:8,7:1};let end=8+2+tags.length*12+4;
 for(const tag of tags){const size=sizes[tag[1]]*tag[2];if(size>4){tag[4]=end;end+=size+(size%2);}}
 const offsets=[];let offset=end;for(const strip of strips){offsets.push(offset);offset+=strip.length;}if(offset>0xffffffff)throw Error('TIFF exceeds 4 GiB.');tags.find(t=>t[0]===273)[3]=offsets;
 const header=new Uint8Array(end),v=new DataView(header.buffer);header.set([73,73,42,0]);v.setUint32(4,8,true);v.setUint16(8,tags.length,true);
 tags.forEach(([id,type,count,value,position],i)=>{const at=10+i*12;v.setUint16(at,id,true);v.setUint16(at+2,type,true);v.setUint32(at+4,count,true);const target=position??at+8;if(position!=null)v.setUint32(at+8,position,true);const values=typeof value==='number'?[value]:value;
  if(type===7)header.set(values,target);else if(type===3)values.forEach((n,j)=>v.setUint16(target+j*2,n,true));else values.forEach((n,j)=>v.setUint32(target+j*4,n,true));
 });return new Blob([header,...strips],{type:'image/tiff'});
}
