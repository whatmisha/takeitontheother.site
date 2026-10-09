import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareCatalog } from './catalog.mjs';

const root = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
const wall = resolve(root, 'wander_wall');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };
let preparing;
const server = createServer(async (request, response) => {
    try {
        if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        if (pathname.split('/').some(part => part.startsWith('.') && part !== '')) { response.writeHead(403).end(); return; }
        if (pathname === '/wander_wall/asset-catalog.json') {
            preparing ??= prepareCatalog(wall).finally(() => { preparing = null; });
            const catalog = await preparing;
            response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            response.end(request.method === 'HEAD' ? undefined : JSON.stringify(catalog)); return;
        }
        let path = resolve(root, '.' + pathname);
        if ((await stat(path)).isDirectory()) {
            if (!pathname.endsWith('/')) { response.writeHead(302, { Location: pathname + '/' }).end(); return; }
            path = resolve(path, 'index.html');
        }
        path = await realpath(path);
        if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
        response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
        if (request.method === 'HEAD') response.end();
        else createReadStream(path).on('error', () => response.destroy()).pipe(response);
    } catch (error) {
        response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' });
        response.end(error.code === 'ENOENT' ? 'Not found' : 'Could not prepare artwork: ' + error.message);
    }
});
server.listen(Number(process.env.PORT || 8020), '127.0.0.1', () => console.log(`Wander Wall: http://127.0.0.1:${server.address().port}/wander_wall/`));
