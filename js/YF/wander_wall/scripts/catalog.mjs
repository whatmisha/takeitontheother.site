import { readFile, readdir, mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, posix } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require(process.env.WANDER_NODE_MODULES ? resolve(process.env.WANDER_NODE_MODULES, 'sharp') : 'sharp');
const legacyForms = { 'blob_01.png': ['pillow', 'Pink pillow'], 'blob_02.png': ['lime', 'Lime fur'], 'blob_03.png': ['pearl', 'Pearlescent'], 'blob_04.png': ['lilac', 'Lilac fur'] };
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const urlPath = path => './' + path.split('/').map(encodeURIComponent).join('/');

async function entries(path) {
    try { return await readdir(path, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

export async function discoverAssets(root) {
    const assets = [];
    for (const dir of await entries(resolve(root, 'graphics/alphabet'))) {
        const set = /^set_(\d+)$/.exec(dir.name);
        if (!dir.isDirectory() || !set) continue;
        for (const file of await entries(resolve(root, 'graphics/alphabet', dir.name))) {
            const variant = /^([A-Z])_(\d+)\.png$/i.exec(file.name);
            if (!file.isFile() || !variant) continue;
            const letter = variant[1].toUpperCase();
            const path = `graphics/alphabet/${dir.name}/${file.name}`;
            assets.push({ id: `${letter}-${Number(set[1])}-${Number(variant[2])}`, kind: 'letter', name: letter,
                letter, set: Number(set[1]), variant: Number(variant[2]), path, src: urlPath(path) });
        }
    }
    async function objects(directory = '') {
        for (const file of await entries(resolve(root, 'graphics', directory))) {
            if (/^[._]/.test(file.name) || (!directory && ['alphabet', 'previews'].includes(file.name))) continue;
            const relative = posix.join(directory, file.name);
            if (file.isDirectory()) { await objects(relative); continue; }
            if (!file.isFile() || !/\.png$/i.test(file.name)) continue;
            const category = relative.includes('/') ? relative.split('/')[0] : 'objects';
            const local = relative.slice(category.length + 1), ground = category === 'ground';
            const legacy = category === 'blobs' ? legacyForms[local] : null;
            const path = 'graphics/' + relative;
            const id = legacy?.[0] ?? (category === 'blobs' ? 'form:' + local : ground ? 'ground:' + local : 'object:' + relative);
            const name = legacy?.[1] ?? relative.replace(/\.png$/i, '').replace(/[_-]+/g, ' ').split('/').join(' / ');
            assets.push({ id, kind: ground ? 'ground' : 'form', category, name, path, src: urlPath(path) });
        }
    }
    await objects();
    assets.sort((a, b) => compare(a.kind, b.kind) || compare(a.letter ?? '', b.letter ?? '') || (a.set ?? 0) - (b.set ?? 0) || (a.variant ?? 0) - (b.variant ?? 0) || compare(a.path, b.path));
    const ids = new Set();
    for (const asset of assets) {
        if (ids.has(asset.id)) throw new Error(`Duplicate artwork ID: ${asset.id} (${asset.path})`);
        ids.add(asset.id);
    }
    return assets;
}

export async function prepareCatalog(root) {
    const file = resolve(root, 'asset-catalog.json');
    let previous;
    try { previous = JSON.parse(await readFile(file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    const cached = new Map(previous?.version === 1 ? previous.assets.map(asset => [asset.id, asset]) : []);
    const assets = [];
    await mkdir(resolve(root, 'graphics/previews'), { recursive: true });
    for (const { path, ...asset } of await discoverAssets(root)) {
        const input = await readFile(resolve(root, path));
        const hash = createHash('sha256').update(input).digest('hex');
        const old = cached.get(asset.id), preview = `graphics/previews/${hash}.webp`;
        if (old?.hash === hash && old.metrics) {
            try {
                await readFile(resolve(root, preview));
                assets.push({ ...asset, hash, preview: urlPath(preview), metrics: old.metrics });
                continue;
            } catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
        const { data, info } = await sharp(input).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        let left = info.width, top = info.height, right = -1, bottom = -1;
        for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
            if (data[(y * info.width + x) * 4 + 3] < 16) continue;
            left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
        if (right < left) throw new Error(`Artwork is fully transparent: ${path}`);
        left = Math.max(0, left - 2); top = Math.max(0, top - 2);
        right = Math.min(info.width - 1, right + 2); bottom = Math.min(info.height - 1, bottom + 2);
        const width = right - left + 1, height = bottom - top + 1;
        const mask = await sharp(data, { raw: info }).extract({ left, top, width, height }).resize(32, 32, { fit: 'fill' }).raw().toBuffer();
        const rows = Array.from({ length: 32 }, (_, y) => {
            let row = 0;
            for (let x = 0; x < 32; x++) if (mask[(y * 32 + x) * 4 + 3] >= 96) row = (row | (1 << x)) >>> 0;
            return row.toString(16).padStart(8, '0');
        });
        await sharp(input).resize(96, 96, { fit: 'inside' }).webp({ quality: 80 }).toFile(resolve(root, preview));
        assets.push({ ...asset, hash, preview: urlPath(preview), metrics: { bounds: [left, top, width, height], rows } });
    }
    const revision = createHash('sha256').update(JSON.stringify(assets)).digest('hex');
    const catalog = { version: 1, revision, assets };
    if (revision !== previous?.revision) {
        // Publish paths and silhouettes together, only after every PNG is ready.
        const temporary = file + `.${process.pid}.tmp`;
        await writeFile(temporary, JSON.stringify(catalog) + '\n');
        await rename(temporary, file);
    }
    return catalog;
}
