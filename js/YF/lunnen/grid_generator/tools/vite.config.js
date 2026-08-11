import { cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolsDirectory, '..');
const outputDirectory = path.join(projectRoot, 'build');
const dependencyPath = (...parts) => path.join(toolsDirectory, 'node_modules', ...parts);

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

export default defineConfig({
    root: projectRoot,
    cacheDir: path.join(toolsDirectory, '.vite'),
    base: './',
    publicDir: false,
    resolve: {
        alias: {
            '@vendor/jspdf': dependencyPath('jspdf', 'dist', 'jspdf.es.min.js'),
            '@vendor/opentype': dependencyPath('opentype.js', 'dist', 'opentype.module.js'),
            '@vendor/svg2pdf': dependencyPath('svg2pdf.js', 'dist', 'svg2pdf.es.min.js')
        }
    },
    plugins: [copyRuntimeAssets()],
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
        sourcemap: true,
        target: ['chrome120', 'safari17']
    }
});
