import { SeededRandom } from '../infra/framework/src/index.js';
import { normalizeSettings } from './document.js';

// Geometry is independent of the palette, texture and raster resolution.
// Coordinates are normalized; this is the extension point for future painted fields.
export function createScene(settings) {
    const s = normalizeSettings(settings);
    const random = new SeededRandom(s.seed).fork('landforms-v1');
    return {
        version: 1,
        phases: Array.from({ length: 4 }, () => random.float(0, Math.PI * 2)),
        fields: Array.from({ length: 5 }, () => [random.float(-.1,1.1), random.float(.35,1.2), random.float(.12,.28), random.float(-1.1,1.1)]),
        mode: s.mode === 'abstract' ? 1 : 0,
        scale: 100 / s.scale, complexity: s.complexity,
        flow: s.flow / 100, horizon: s.horizon / 100, relief: s.relief / 100
    };
}

export function hexRGB(hex) {
    return hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255);
}

// Perceptual interpolation keeps automatic half-tones luminous between anchors.
function toLab(rgb) {
    const [r,g,b] = rgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const l = Math.cbrt(.4122214708*r + .5363325363*g + .0514459929*b);
    const m = Math.cbrt(.2119034982*r + .6806995451*g + .1073969566*b);
    const s = Math.cbrt(.0883024619*r + .2817188376*g + .6299787005*b);
    return [.2104542553*l + .793617785*m - .0040720468*s,
        1.9779984951*l - 2.428592205*m + .4505937099*s,
        .0259040371*l + .7827717662*m - .808675766*s];
}
function fromLab([L,a,b]) {
    const l = (L + .3963377774*a + .2158037573*b) ** 3;
    const m = (L - .1055613458*a - .0638541728*b) ** 3;
    const s = (L - .0894841775*a - 1.291485548*b) ** 3;
    return [4.0767416621*l - 3.3077115913*m + .2309699292*s,
        -1.2684380046*l + 2.6097574011*m - .3413193965*s,
        -.0041960863*l - .7034186147*m + 1.707614701*s].map(v => {
            const c = v <= .0031308 ? v * 12.92 : 1.055 * Math.max(0, v) ** (1/2.4) - .055;
            return Math.round(Math.max(0, Math.min(1, c)) * 255);
        });
}
export function paletteLUT(settings) {
    const s = normalizeSettings(settings);
    const stops = [[0, s.depth], [.12, s.depth], [.36, s.terrain], [.63, s.terrain], [.88, s.light], [1, s.light]]
        .map(([at, hex]) => [at, toLab(hexRGB(hex))]);
    const data = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
        const x = i / 255;
        const j = Math.min(stops.length - 2, stops.findIndex((p, index) => index < stops.length - 1 && x <= stops[index+1][0]));
        const [start, a] = stops[Math.max(0, j)], [end, b] = stops[Math.max(0, j) + 1];
        let t = (x - start) / (end - start); t = Math.max(0, Math.min(1, (t-.5) / (.18 + s.softness/100*1.4) + .5)); t = t*t*(3-2*t);
        data.set([...fromLab(a.map((v,k) => v + (b[k]-v)*t)), 255], i*4);
    }
    return data;
}
