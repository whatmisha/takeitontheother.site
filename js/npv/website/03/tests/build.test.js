import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {brotliDecompressSync,gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

const root=new URL('../',import.meta.url);
let manifest;
try{manifest=JSON.parse(await readFile(new URL('dist/build-manifest.json',root)));}catch{}
test('standalone build has self-contained hashed assets and lossless precompression',{skip:!manifest},async()=>{
  const html=await readFile(new URL('dist/index.html',root),'utf8');
  assert.ok(html.includes('name="npv-worker"'));
  assert.ok(!html.includes('../../src/'));
  assert.equal(manifest.filter(file=>file.file.endsWith('.woff2')).length,2);
  for(const entry of manifest){
    const bytes=await readFile(new URL('dist/'+entry.file,root));
    assert.equal(bytes.length,entry.bytes);
    if(entry.brotli){
      assert.deepEqual(brotliDecompressSync(await readFile(new URL('dist/'+entry.file+'.br',root))),bytes);
      assert.deepEqual(gunzipSync(await readFile(new URL('dist/'+entry.file+'.gz',root))),bytes);
    }
  }
});

test('production preview serves compression and correct cache headers',{skip:!manifest},async()=>{
  const child=spawn(process.execPath,[fileURLToPath(new URL('serve.mjs',root))],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  try{
    const output=await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw new Error('preview exited');})]);
    const base=output[0].toString().match(/http:\/\/127\.0\.0\.1:\d+\//)[0];
    const html=await fetch(base);assert.equal(html.status,200);assert.equal(html.headers.get('cache-control'),'no-cache');
    const asset=manifest.find(entry=>entry.file.endsWith('.js'));
    const response=await fetch(new URL(asset.file,base),{headers:{'Accept-Encoding':'br,gzip'}});
    assert.equal(response.headers.get('content-encoding'),'br');
    assert.match(response.headers.get('cache-control'),/immutable/);
    assert.match(response.headers.get('content-type'),/javascript/);
    assert.equal((await response.arrayBuffer()).byteLength,asset.bytes);
    const formula=manifest.find(entry=>entry.file.endsWith('.svg'));
    assert.ok(formula,'the formula SVG is included in the standalone output');
    const image=await fetch(new URL(formula.file,base),{headers:{'Accept-Encoding':'br'}});
    assert.equal(image.headers.get('content-type'),'image/svg+xml');
    assert.ok((await image.text()).includes('#111111'));
    const plain=await fetch(new URL(asset.file,base),{headers:{'Accept-Encoding':'br;q=0,gzip;q=0'}});
    assert.equal(plain.headers.get('content-encoding'),null);
    assert.equal((await fetch(new URL('missing.js',base))).status,404);
  }finally{child.kill();await once(child,'exit');}
});
