import { settingsAtBolidTime } from './bolid.js?v=20260828-3';
import { buildCharacterGeometry } from '../geometry/characterGeometry.js?v=20260828-2';
import { clamp } from '../geometry/vector.js';

export const BOLID_COLOR_TRAIL_DEFAULT = 0;
export const BOLID_HUE_SPREAD_MAX = 90;
export const BOLID_HUE_SPREAD_DEFAULT = BOLID_HUE_SPREAD_MAX;

const ACHROMATIC_RED = '#ff334d';
const ACHROMATIC_BLUE = '#2868ff';
const TAU = Math.PI * 2;
const SPECTRAL_BANDS = Object.freeze([
    { name: 'outer', distance: 1, opacity: 0.42 },
    { name: 'middle', distance: 0.72, opacity: 0.76 },
    { name: 'inner', distance: 0.42, opacity: 0.52 }
]);

const finiteOr = (value, fallback) => Number.isFinite(Number(value))
    ? Number(value)
    : fallback;

export const normalizeBolidColorTrail = (value) => clamp(
    finiteOr(value, BOLID_COLOR_TRAIL_DEFAULT),
    0,
    100
);

export const normalizeBolidHueSpread = (value) => clamp(
    finiteOr(value, BOLID_HUE_SPREAD_DEFAULT),
    0,
    BOLID_HUE_SPREAD_MAX
);

function parseHex(value) {
    const source = String(value || '').trim().replace(/^#/, '');
    const expanded = source.length === 3
        ? source.split('').map((entry) => entry + entry).join('')
        : source;
    if (!/^[0-9a-f]{6}$/i.test(expanded)) return [1, 1, 1];
    return [0, 2, 4].map((offset) => parseInt(expanded.slice(offset, offset + 2), 16) / 255);
}

const srgbToLinear = (value) => value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;

const linearToSrgb = (value) => value <= 0.0031308
    ? value * 12.92
    : 1.055 * Math.max(0, value) ** (1 / 2.4) - 0.055;

function rgbToOklab(rgb) {
    const [red, green, blue] = rgb.map(srgbToLinear);
    const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
    const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
    const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
    return {
        L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    };
}

function oklabToLinearRgb({ L, a, b }) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ];
}

function labToHex(lab) {
    const channels = oklabToLinearRgb(lab).map((value) => (
        Math.round(clamp(linearToSrgb(value), 0, 1) * 255)
    ));
    return `#${channels.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function lchToLab(L, C, hueDegrees) {
    const radians = hueDegrees * Math.PI / 180;
    return { L, a: Math.cos(radians) * C, b: Math.sin(radians) * C };
}

function gamutMappedLch(L, requestedChroma, hueDegrees) {
    let low = 0;
    let high = Math.max(0, requestedChroma);
    let winner = lchToLab(L, 0, hueDegrees);
    for (let iteration = 0; iteration < 14; iteration += 1) {
        const middle = (low + high) / 2;
        const candidate = lchToLab(L, middle, hueDegrees);
        const rgb = oklabToLinearRgb(candidate);
        if (rgb.every((channel) => channel >= 0 && channel <= 1)) {
            low = middle;
            winner = candidate;
        } else {
            high = middle;
        }
    }
    return winner;
}

const mixLab = (first, second, amount) => ({
    L: first.L + (second.L - first.L) * amount,
    a: first.a + (second.a - first.a) * amount,
    b: first.b + (second.b - first.b) * amount
});

const smoothstep = (value) => {
    const amount = clamp(value, 0, 1);
    return amount * amount * (3 - 2 * amount);
};

export function colorToOklch(value) {
    const lab = rgbToOklab(parseHex(value));
    const chroma = Math.hypot(lab.a, lab.b);
    return {
        L: lab.L,
        C: chroma,
        h: chroma <= 1e-9
            ? 0
            : ((Math.atan2(lab.b, lab.a) * 180 / Math.PI) + 360) % 360
    };
}

function spectralProfile(baseColor, sourceColor) {
    const baseLab = rgbToOklab(parseHex(baseColor));
    const sourceLab = rgbToOklab(parseHex(sourceColor));
    const baseChroma = Math.hypot(baseLab.a, baseLab.b);
    const baseHue = baseChroma <= 1e-9
        ? 0
        : Math.atan2(baseLab.b, baseLab.a) * 180 / Math.PI;
    const outerLightness = clamp(baseLab.L - 0.085, 0.06, 0.94);
    const outerChroma = clamp(baseChroma * 1.14 + 0.008, 0, 0.34);
    return {
        inner: labToHex(mixLab(baseLab, sourceLab, 0.36)),
        middle: baseColor,
        outer: labToHex(gamutMappedLch(outerLightness, outerChroma, baseHue))
    };
}

/**
 * Achromatic heads use the fixed aberration pair. As source chroma grows, the
 * same pair continuously becomes two neighbours around the source OKLCH hue.
 */
export function resolveBolidTrailColors(headColor, hueSpread) {
    const source = colorToOklch(headColor);
    const spread = normalizeBolidHueSpread(hueSpread);
    const chromaticMix = smoothstep((source.C - 0.015) / 0.09);
    const boostedChroma = clamp(source.C * 1.18 + 0.025, 0.035, 0.31);
    const minusHue = gamutMappedLch(source.L, boostedChroma, source.h - spread);
    const plusHue = gamutMappedLch(source.L, boostedChroma, source.h + spread);
    const fixedRed = rgbToOklab(parseHex(ACHROMATIC_RED));
    const fixedBlue = rgbToOklab(parseHex(ACHROMATIC_BLUE));
    return {
        minus: labToHex(mixLab(fixedRed, minusHue, chromaticMix)),
        plus: labToHex(mixLab(fixedBlue, plusHue, chromaticMix)),
        chromaticMix,
        source
    };
}

/**
 * The edge is a small spectral profile rather than one translucent color:
 * inner bands converge towards the head, middle bands stay pure and outer
 * bands become darker and more saturated.
 */
export function resolveBolidTrailSpectrum(headColor, hueSpread) {
    const colors = resolveBolidTrailColors(headColor, hueSpread);
    return {
        minus: spectralProfile(colors.minus, headColor),
        plus: spectralProfile(colors.plus, headColor),
        chromaticMix: colors.chromaticMix,
        source: colors.source
    };
}

/**
 * Reuse the head spectrum for the much smaller eye contours. Eye inertia adds
 * a short common lag while the red/blue (or hue-neighbour) sides stay split.
 */
export function buildBolidEyeColorTrailLayers(
    settings,
    headLayers,
    eyeOffset = null
) {
    if (!Array.isArray(headLayers) || headLayers.length === 0) return [];
    const eyeLab = rgbToOklab(parseHex(settings.eyeColor));
    const headLab = rgbToOklab(parseHex(settings.headColor));
    const contrast = clamp(Math.hypot(
        eyeLab.L - headLab.L,
        eyeLab.a - headLab.a,
        eyeLab.b - headLab.b
    ) / 0.22, 0, 1);
    if (contrast <= 1e-5) return [];

    const spectrum = resolveBolidTrailSpectrum(
        settings.eyeColor,
        BOLID_HUE_SPREAD_MAX
    );
    const lagX = finiteOr(eyeOffset?.x, 0);
    const lagY = finiteOr(eyeOffset?.y, 0);
    const scaleLag = Math.abs(finiteOr(eyeOffset?.scaleRatio, 1) - 1);
    const lagStrength = clamp(Math.hypot(lagX, lagY) / 8 + scaleLag * 8, 0, 1);

    return headLayers.map((layer) => {
        const sideName = layer.side < 0 ? 'minus' : 'plus';
        const band = SPECTRAL_BANDS.find((entry) => entry.name === layer.band)
            || SPECTRAL_BANDS[1];
        return {
            side: layer.side,
            band: layer.band,
            color: spectrum[sideName][layer.band],
            opacity: layer.opacity * contrast * (0.68 + lagStrength * 0.22),
            offsetX: layer.offsetX * 0.36 + lagX * 0.2 * band.distance,
            offsetY: layer.offsetY * 0.36 + lagY * 0.2 * band.distance
        };
    });
}

const clockDirection = (degrees) => {
    const radians = degrees * Math.PI / 180;
    return { x: Math.sin(radians), y: -Math.cos(radians) };
};

const wrapTime = (timeMs, durationMs) => {
    const duration = Math.max(1, durationMs);
    return ((timeMs % duration) + duration) % duration;
};

/** Build six ordinary filled paths shared by SVG preview and Canvas export. */
export function buildBolidColorTrailLayers(settings, focus, {
    timeMs = 0,
    durationMs = finiteOr(settings.motionDuration, 5) * 1000
} = {}) {
    if (settings.focusMode !== 'bolid') return [];
    const trailControl = normalizeBolidColorTrail(settings.bolidColorTrail) / 100;
    if (trailControl <= 1e-9) return [];
    const duration = Math.max(1, finiteOr(durationMs, 5000));
    const currentTime = wrapTime(finiteOr(timeMs, 0), duration);
    const current = settingsAtBolidTime(settings, currentTime, duration);
    const deformationStrength = clamp(finiteOr(current.bolidStrength, 0), 0, 1);
    const amount = trailControl * deformationStrength;
    if (amount <= 1e-5) return [];

    const spectrum = resolveBolidTrailSpectrum(settings.headColor, BOLID_HUE_SPREAD_MAX);
    const flight = clockDirection(finiteOr(settings.bolidTargetAngle, 180));
    const trail = { x: -flight.x, y: -flight.y };
    const lateral = { x: -trail.y, y: trail.x };
    const flutterPhase = finiteOr(current.bolidFlutterPhase, 0) * TAU;
    const jitterPhase = finiteOr(current.bolidJitterPhase, 0) * TAU;
    const sampleOffsetMs = 9 + amount * 27;
    const lateralBase = 1.5 + amount * 5.4;
    const trailBase = 0.8 + amount * 3.5;
    const opacity = clamp(amount * (0.2 + amount * 0.28), 0, 0.48);

    return SPECTRAL_BANDS.flatMap((band, bandIndex) => (
        [-1, 1].map((side) => {
            const localFlutter = Math.sin(
                flutterPhase + side * 0.9 + bandIndex * 0.13
            ) * 0.16 + Math.sin(
                jitterPhase - side * 1.35 - bandIndex * 0.17
            ) * 0.08;
            const bandSampleOffset = sampleOffsetMs * band.distance;
            const sampleTimeMs = wrapTime(
                currentTime + side * bandSampleOffset,
                duration
            );
            const sampled = settingsAtBolidTime(settings, sampleTimeMs, duration);
            const geometry = buildCharacterGeometry({
                ...sampled,
                focusX: focus.x,
                focusY: focus.y,
                focusMode: 'manual'
            });
            const lateralDistance = side * lateralBase * band.distance
                * (1 + localFlutter);
            const trailDistance = trailBase * band.distance
                * (1 - localFlutter * 0.45);
            const sideName = side < 0 ? 'minus' : 'plus';
            return {
                side,
                band: band.name,
                color: spectrum[sideName][band.name],
                opacity: opacity * band.opacity * (side < 0 ? 0.94 : 1),
                offsetX: trail.x * trailDistance + lateral.x * lateralDistance,
                offsetY: trail.y * trailDistance + lateral.y * lateralDistance,
                sampleTimeMs,
                path: geometry.rounded.path
            };
        })
    ));
}
