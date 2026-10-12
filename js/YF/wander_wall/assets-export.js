import { StoredZipWriter } from '../infra/framework/src/export/StoredZipWriter.js';
import { ASSETS } from './assets.js';

export function assetsPackPlan(scene, catalog = ASSETS) {
    const artworkName = `wander-wall-${scene.seed}.png`, used = new Set(), names = new Set([artworkName.toLowerCase()]);
    const entries = [];
    for (const item of scene.items) {
        if (item.visible === false) continue;
        const asset = catalog[item.asset];
        if (!asset) throw new Error('Unknown artwork: ' + item.asset);
        if (used.has(asset.src)) continue;
        used.add(asset.src);
        const url = new URL(asset.src, import.meta.url);
        url.searchParams.set('v', asset.hash);
        const base = decodeURIComponent(url.pathname.split('/').at(-1)).replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_');
        if (!/\.png$/i.test(base)) throw new Error('Assets pack requires PNG artwork: ' + base);
        let name = base, suffix = 2;
        while (names.has(name.toLowerCase())) name = base.slice(0, -4) + '_' + suffix++ + '.png';
        names.add(name.toLowerCase());
        entries.push({ name, url: url.href });
    }
    return { artworkName, entries };
}

export async function createAssetsPack(scene, artwork, { signal, onProgress = () => {} } = {}) {
    const { artworkName, entries } = assetsPackPlan(scene);
    const zip = new StoredZipWriter();
    await zip.add(artworkName, artwork, { signal });
    // Keep originals byte-for-byte, fetching one at a time to bound peak memory.
    for (const [index, entry] of entries.entries()) {
        signal?.throwIfAborted();
        onProgress({ current: index + 1, total: entries.length });
        const response = await fetch(entry.url, { signal });
        if (!response.ok) throw new Error('Could not load ' + entry.name + ' for Assets pack.');
        const blob = await response.blob();
        const signature = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
        if (signature.length !== 8 || ![137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => signature[i] === value)) {
            throw new Error('Invalid PNG artwork: ' + entry.name);
        }
        await zip.add(entry.name, blob, { signal });
    }
    signal?.throwIfAborted();
    return zip.toBlob();
}
