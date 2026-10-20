import {build} from 'esbuild';
import {readFile,writeFile,rm,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname,basename,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {brotliCompressSync,gzipSync,constants} from 'node:zlib';
const root=dirname(fileURLToPath(import.meta.url));
const outdir=resolve(root,'dist');
await rm(outdir,{recursive:true,force:true});await mkdir(outdir,{recursive:true});
const options={absWorkingDir:root,outdir:resolve(outdir,'assets'),bundle:true,minify:true,
  format:'esm',target:['es2022'],entryNames:'[name]-[hash]',assetNames:'[name]-[hash]',
  metafile:true,legalComments:'eof',logLevel:'info'};
const site=await build({...options,entryPoints:['main.js','styles.css','planet-worker.js'],
  splitting:true,loader:{'.woff2':'file','.svg':'file'}});
const entry=name=>Object.entries(site.metafile.outputs).find(([,info])=>info.entryPoint===name)?.[0];
const outputs=Object.keys(site.metafile.outputs);
let html=await readFile(resolve(root,'index.html'),'utf8');
html=html.replace('<head>',`<head>\n  <meta name="npv-worker" content="./assets/${basename(entry('planet-worker.js'))}">`);
for(const name of ['main.js','styles.css'])html=html.replace('./'+name,'./assets/'+basename(entry(name)));
for(const font of ['FormaDJRDisplay-Medium','FormaDJRText-Medium']){
  const output=outputs.find(path=>basename(path).startsWith(font+'-')&&path.endsWith('.woff2'));
  html=html.replace('./fonts/'+font+'.woff2','./assets/'+basename(output));
}
await writeFile(resolve(outdir,'index.html'),html);
await writeFile(resolve(outdir,'_headers'),`/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`);
const assets=[];
async function compress(directory){
  for(const item of await readdir(directory,{withFileTypes:true})){
    const path=resolve(directory,item.name);
    if(item.isDirectory()){await compress(path);continue;}
    if(!['.html','.js','.css','.svg','.woff2'].includes(extname(path)))continue;
    const bytes=await readFile(path),record={file:path.slice(outdir.length+1),bytes:bytes.length};
    if(extname(path)!=='.woff2'){
      const gzip=gzipSync(bytes,{level:9});
      const brotli=brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:11}});
      await writeFile(path+'.gz',gzip);await writeFile(path+'.br',brotli);
      Object.assign(record,{gzip:gzip.length,brotli:brotli.length});
    }
    assets.push(record);
  }
}
await compress(outdir);
await writeFile(resolve(outdir,'build-manifest.json'),JSON.stringify(assets,null,2)+'\n');
console.log('Standalone output: '+outdir);
console.log('Total Brotli + fonts: '+assets.reduce((n,a)=>n+(a.brotli??a.bytes),0)+' bytes');
