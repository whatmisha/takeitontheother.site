import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'dist');
const port=Number(process.env.PORT||8003);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.woff2':'font/woff2','.json':'application/json'};
const server=createServer(async(request,response)=>{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return;}
  try{
    let name=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if(name.endsWith('/'))name+='index.html';
    const path=resolve(root,'.'+name);
    if(!path.startsWith(root+sep)){response.writeHead(403);response.end();return;}
    let file=path,encoding;
    const accept=request.headers['accept-encoding']||'';
    const accepted=type=>accept.split(',').some(part=>{const [name,...params]=part.trim().split(';');return name===type&&!params.some(p=>/^\s*q=0(?:\.0*)?\s*$/.test(p));});
    for(const [candidate,suffix] of [['br','.br'],['gzip','.gz']]){
      if(!accepted(candidate))continue;
      try{await stat(path+suffix);file=path+suffix;encoding=candidate;break;}catch{}
    }
    const data=await readFile(file);
    response.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream',
      'Content-Length':data.length,'Cache-Control':name.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache',
      'Vary':'Accept-Encoding','X-Content-Type-Options':'nosniff',...(encoding?{'Content-Encoding':encoding}:{})});
    response.end(request.method==='HEAD'?undefined:data);
  }catch{response.writeHead(404);response.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`NPV build: http://127.0.0.1:${port}/`));
