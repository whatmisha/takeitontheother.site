import { ASSET_MAX_BYTES, decodeLottieAsset, validateLottieJSON, validateDotLottie } from './ending-model.js';
let runtime;
async function lottieRuntime() {
    return runtime ||= import('./vendor/dotlottie/0.81.0/index.js').then(({ DotLottie }) => {
        DotLottie.setWasmUrl(new URL('./vendor/dotlottie/0.81.0/dotlottie-player.wasm', import.meta.url).href);
        return DotLottie;
    });
}
// SVG is decoded as an image, never inserted into the document. Reject active or
// external dependencies so a saved preset renders identically offline and in exports.
export function svgImageSource(source) {
    if (new TextEncoder().encode(source).length > ASSET_MAX_BYTES) throw new Error('Use an SVG up to 5 MB.');
    if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('Use an SVG without a DOCTYPE or external entities.');
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml'), root = doc.documentElement;
    if (root.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('This file is not a valid SVG.');
    for (const el of doc.querySelectorAll('*')) {
        if (/^(script|foreignObject|animate|animateTransform|animateMotion|set|discard|audio|video)$/i.test(el.localName)) throw new Error('Use a static SVG, or import animation as Lottie.');
        for (const attr of el.attributes) {
            if (/^on/i.test(attr.name)) throw new Error('SVG event handlers are not supported.');
            if (attr.localName === 'href' && !/^#|^data:image\/(png|jpeg|webp);base64,/i.test(attr.value)) throw new Error('Embed external SVG images and convert fonts to outlines.');
        }
    }
    if (/@import|@font-face|(?:animation|transition)\s*:/i.test(source) || [...source.matchAll(/url\(([^)]*)\)/gi)].some(match => !match[1].trim().replace(/^['"]|['"]$/g, '').startsWith('#'))) throw new Error('Use a self-contained, static SVG with outlined fonts.');
    const box = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    const w = box.length === 4 ? box[2] : parseFloat(root.getAttribute('width')), h = box.length === 4 ? box[3] : parseFloat(root.getAttribute('height'));
    if (!(w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h))) throw new Error('The SVG needs a valid viewBox or width and height.');
    if (box.length !== 4) root.setAttribute('viewBox', `0 0 ${w} ${h}`);
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const fit = Math.min(1920 / w, 1080 / h);
    root.setAttribute('width', String(Math.max(1, Math.round(w * fit)))); root.setAttribute('height', String(Math.max(1, Math.round(h * fit))));
    return new XMLSerializer().serializeToString(root);
}
export async function svgBitmap(asset) {
    const source = svgImageSource(asset.data), url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
    try {
        const image = new Image(); image.src = url; await image.decode();
        return await createImageBitmap(image);
    } catch (error) { throw new Error(`Could not render SVG: ${error.message}`); }
    finally { URL.revokeObjectURL(url); }
}
export async function readEndingFile(file, type) {
    if (file.size > ASSET_MAX_BYTES) throw new Error('Use a file up to 5 MB.');
    const name = file.name.slice(0, 200);
    if (type === 'svg') { const data = await file.text(); svgImageSource(data); return { kind: 'svg', name, data }; }
    if (file.name.toLowerCase().endsWith('.lottie')) {
        const bytes = new Uint8Array(await file.arrayBuffer()); validateDotLottie(bytes);
        let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        return { kind: 'dotlottie', name, data: btoa(binary) };
    }
    const data = await file.text(); validateLottieJSON(data); return { kind: 'lottie-json', name, data };
}
export async function loadLottie(asset) {
    const data = decodeLottieAsset(asset), DotLottie = await lottieRuntime();
    const canvas = new OffscreenCanvas(1920, 1080);
    const player = new DotLottie({ canvas, data, autoplay: false, loop: false, useFrameInterpolation: true,
        renderConfig: { devicePixelRatio: 1, autoResize: false, freezeOnOffscreen: false }, layout: { fit: 'contain', align: [.5, .5] },
        assetResolver: () => null
    });
    try {
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => finish(new Error('Lottie loading timed out. Try a simpler file.')), 15000);
            const loaded = () => finish(), failed = event => finish(new Error(event.error?.message || 'Could not load this Lottie animation.'));
            const finish = error => { clearTimeout(timer); player.removeEventListener('load', loaded); player.removeEventListener('loadError', failed); error ? reject(error) : resolve(); };
            player.addEventListener('load', loaded); player.addEventListener('loadError', failed);
        });
        if (!(player.duration > 0 && player.totalFrames > 0)) throw new Error('Lottie contains no playable frames.');
        player.setFrame(0);
        return { canvas, player, duration: player.duration, totalFrames: player.totalFrames, destroy: () => player.destroy() };
    } catch (error) { player.destroy(); throw error; }
}
