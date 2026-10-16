// Run from a same-origin test page with lottie-web loaded. Production does not
// download or depend on the player. See LOTTIE.md for the manual check steps.
import { createLottieAnimation, sampleLottieFrames } from '../src/export/lottieExporter.js';
import { drawAnimationFrame } from '../src/render/animationFrameRenderer.js?v=lottie-1';
import { importSvgPathData } from '../src/animation/svgPathImporter.js';
import { serializeFocusPath } from '../src/animation/focusPath.js';

const nextPaint = () => new Promise((resolve) => requestAnimationFrame(resolve));
function difference(reference, actual) {
    let sum = 0, bad = 0;
    for (let pixel = 0; pixel < reference.length; pixel += 4) {
        let maximum = Math.abs(reference[pixel + 3] - actual[pixel + 3]);
        sum += maximum;
        for (let channel = 0; channel < 3; channel += 1) {
            const delta = Math.abs(reference[pixel + channel] * reference[pixel + 3] / 255 - actual[pixel + channel] * actual[pixel + 3] / 255);
            sum += delta;
            maximum = Math.max(maximum, delta);
        }
        if (maximum > 32) bad += 1;
    }
    return { meanError: sum / reference.length, mismatchPercent: bad / (reference.length / 4) * 100 };
}
async function playerPixels(container, renderer) {
    if (renderer === 'canvas') return container.querySelector('canvas').getContext('2d').getImageData(0, 0, 480, 480).data;
    const svg = container.querySelector('svg');
    const image = new Image();
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
    try {
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 480;
        canvas.getContext('2d').drawImage(image, 0, 0, 480, 480);
        return canvas.getContext('2d').getImageData(0, 0, 480, 480).data;
    } finally { URL.revokeObjectURL(url); }
}

export async function runLottieVisualChecks(lottie) {
    const basic = await (await fetch('../presets/basic.json')).json();
    const startFocus = { x: 240, y: 240 };
    const base = { ...basic, focusMode: 'animate', motionDuration: 1, motionPointCount: 6,
        motionComplexity: 30, motionSmoothness: 50, motionStopCount: 3, motionSpeedVariation: 40,
        motionBlinkCount: 2, motionEmotionVariation: 70, motionSeed: 24062026,
        bolidTargetAngle: 180, bolidTargetDistance: 40, bolidIntensity: 100, bolidColorTrail: 0 };
    const imported = serializeFocusPath(importSvgPathData('M0 0 L100 0 L50 100 Z', { center: startFocus, radius: 180, startFocus }));
    const cases = [
        { name: 'Path', settings: base },
        { name: 'Bolid + color trail', settings: { ...base, focusMode: 'bolid', bolidColorTrail: 100, eyeColor: '#237aff' } },
        { name: 'Circular corners', settings: { ...base, cornerSmoothing: 0, rayCount: 13 } },
        { name: 'Sharp + imported path', settings: { ...base, roundness: 0, eyeSize: 100 }, motionPath: imported }
    ];
    const results = [];
    document.body.innerHTML = '<h1>Sparky Lottie — reference / player</h1>';
    document.body.style.cssText = 'font:16px sans-serif;background:#777;color:white;margin:24px';
    for (const fixture of cases) {
        const options = { ...fixture, startFocus };
        const started = performance.now();
        const animation = createLottieAnimation(options);
        const text = JSON.stringify(animation);
        const generationMs = performance.now() - started;
        const frames = [...sampleLottieFrames(options)];
        for (const renderer of ['svg', 'canvas']) {
            const section = document.createElement('section');
            section.innerHTML = `<h2>${fixture.name} · ${renderer}</h2><div style="display:flex;gap:12px"></div>`;
            document.body.append(section);
            const row = section.querySelector('div');
            const reference = document.createElement('canvas');
            reference.width = reference.height = 480;
            row.append(reference);
            const container = document.createElement('div');
            container.style.cssText = 'width:480px;height:480px;flex:none';
            row.append(container);
            const player = lottie.loadAnimation({ container, renderer, autoplay: false, loop: true,
                animationData: JSON.parse(text), rendererSettings: { dpr: 1 } });
            await new Promise((resolve, reject) => {
                player.addEventListener('DOMLoaded', resolve);
                player.addEventListener('data_failed', () => reject(new Error('Lottie load failed')));
            });
            const checks = [];
            for (const index of [0, 7, 15, 29, 30, 45, 59, 0]) {
                const frame = frames[index];
                drawAnimationFrame(reference.getContext('2d'), 480, 480, fixture.settings, frame.focus, {
                    scene: frame.scene, eyeState: frame.eyeState, eyeOffset: frame.eyeOffset, transparentBackground: true
                });
                player.goToAndStop(index, true);
                await nextPaint();
                const expected = reference.getContext('2d').getImageData(0, 0, 480, 480).data;
                checks.push({ frame: index, ...difference(expected, await playerPixels(container, renderer)) });
            }
            results.push({ name: fixture.name, renderer, bytes: text.length, generationMs, checks });
            section.insertAdjacentHTML('beforeend', `<p>${Math.round(text.length / 1024)} KB · worst pixel mismatch ${Math.max(...checks.map((check) => check.mismatchPercent)).toFixed(3)}%</p>`);
        }
    }
    for (const result of results) for (const check of result.checks) {
        if (check.mismatchPercent > 1 || check.meanError > 1) {
            throw new Error(`${result.name} / ${result.renderer} / frame ${check.frame}: visual mismatch ${JSON.stringify(check)}`);
        }
    }
    return results;
}
