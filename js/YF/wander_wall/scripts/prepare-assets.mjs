import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSETS } from '../assets.js';

// Build-time dependencies only; the tool runs with the browser and local assets.
const require = createRequire(import.meta.url);
const sharp = require(process.env.WANDER_NODE_MODULES ? resolve(process.env.WANDER_NODE_MODULES, 'sharp') : 'sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(resolve(root, 'graphics/blobs'), { recursive: true });
for (let index = 1; index <= 4; index++) {
    const filename = `blob_0${index}.png`;
    try { await readFile(resolve(root, 'graphics/blobs', filename)); }
    catch { await copyFile(resolve(root, 'ref', filename), resolve(root, 'graphics/blobs', filename)); }
}
const metrics = {};
for (const asset of Object.values(ASSETS)) {
    const { data, info } = await sharp(resolve(root, asset.src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = info.width, top = info.height, right = 0, bottom = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * 4 + 3] < 16) continue;
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
    left = Math.max(0, left - 2); top = Math.max(0, top - 2);
    right = Math.min(info.width - 1, right + 2); bottom = Math.min(info.height - 1, bottom + 2);
    const width = right - left + 1, height = bottom - top + 1;
    const mask = await sharp(data, { raw: info }).extract({ left, top, width, height }).resize(32, 32, { fit: 'fill' }).raw().toBuffer();
    const rows = Array.from({ length: 32 }, (_, y) => {
        let row = 0;
        for (let x = 0; x < 32; x++) if (mask[(y * 32 + x) * 4 + 3] >= 96) row = (row | (1 << x)) >>> 0;
        return row.toString(16).padStart(8, '0');
    });
    metrics[asset.id] = { bounds: [left, top, width, height], rows };
}
await writeFile(resolve(root, 'asset-metrics.json'), JSON.stringify(metrics) + '\n');

const packageRoot = process.env.WANDER_NODE_MODULES
    ? resolve(process.env.WANDER_NODE_MODULES, 'lucide') : dirname(require.resolve('lucide/package.json'));
const vendor = resolve(root, 'vendor/lucide');
await mkdir(resolve(vendor, 'icons'), { recursive: true });
const icons = ['arrow-left', 'chevron-down', 'undo-2', 'redo-2', 'pin', 'pin-off', 'rotate-cw', 'scaling', 'shuffle', 'refresh-cw', 'plus', 'minus', 'trash-2', 'arrow-up', 'arrow-down', 'maximize', 'link', 'save', 'mouse-pointer-2', 'check', 'grip-vertical', 'eye', 'eye-off'];
for (const name of ['createElement', 'defaultAttributes', ...icons.map(name => 'icons/' + name)]) {
    await copyFile(resolve(packageRoot, 'dist/esm', name + '.js'), resolve(vendor, name + '.js'));
}
await copyFile(resolve(packageRoot, 'LICENSE'), resolve(vendor, 'LICENSE'));
console.log(`Prepared ${Object.keys(metrics).length} silhouette masks and local Lucide icons.`);
