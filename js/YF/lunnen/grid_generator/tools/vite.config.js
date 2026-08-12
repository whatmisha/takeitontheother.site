import { cp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

import { readBuildEntry, renderApplicationDocument } from './public-runtime-utils.js';

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolsDirectory, '..');
const outputDirectory = path.join(projectRoot, 'build');
function copyRuntimeAssets() {
    return {
        name: 'copy-runtime-assets',
        async writeBundle() {
            await Promise.all(['fonts', 'graphics', 'presets'].map(directory => (
                cp(
                    path.join(projectRoot, directory),
                    path.join(outputDirectory, directory),
                    { recursive: true }
                )
            )));
        }
    };
}

function serveDevelopmentDocument() {
    return {
        name: 'serve-development-document',
        configureServer(server) {
            server.middlewares.use((request, _response, next) => {
                const [pathname, query = ''] = (request.url || '/').split('?');
                if (pathname === '/' || pathname === '/index.html') {
                    request.url = `/src/ui/ApplicationDocument.html${query ? `?${query}` : ''}`;
                }
                next();
            });
        }
    };
}

function writeBuildDocument() {
    return {
        name: 'write-build-document',
        async closeBundle() {
            const entry = await readBuildEntry();
            const html = await renderApplicationDocument({
                scriptHref: `./${entry.script}`,
                styleHref: `./${entry.style}`
            });
            await writeFile(path.join(outputDirectory, 'index.html'), html, 'utf8');
        }
    };
}

export default defineConfig({
    root: projectRoot,
    cacheDir: path.join(toolsDirectory, '.vite'),
    base: './',
    publicDir: false,
    plugins: [serveDevelopmentDocument(), copyRuntimeAssets(), writeBuildDocument()],
    server: {
        host: '127.0.0.1',
        port: 8000,
        headers: { 'Cache-Control': 'no-store' }
    },
    preview: {
        host: '127.0.0.1',
        port: 8000,
        headers: { 'Cache-Control': 'no-store' }
    },
    build: {
        outDir: outputDirectory,
        emptyOutDir: true,
        manifest: true,
        sourcemap: true,
        target: ['chrome120', 'safari17'],
        rollupOptions: {
            input: path.join(projectRoot, 'src', 'runtime', 'PublicEntry.js')
        }
    }
});
