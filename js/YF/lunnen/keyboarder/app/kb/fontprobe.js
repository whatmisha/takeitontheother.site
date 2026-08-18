/**
 * Font probe and auto-compensation calibration.
 *
 * Stage 8 starts here: given a parsed Typeface, derive the font-dependent metrics and
 * compensation parameters that can later feed the same Compensator API used by YS Text.
 */
import { Compensator, YS_TEXT_REGULAR } from './compensate.js';

const YS_REFERENCE = {
    stemWidth: 94,
    sidebearingDelta: 38.5
};

const DEFAULT_CAP_CHARS = ['H', 'E', 'Н'];
const DEFAULT_X_CHARS = ['x', 'o', 'н'];
const STEM_CHARS = ['I', 'l', '|', 'Н', 'H'];
const FLAT_SIDE_CHARS = ['H', 'I', 'Н', 'П', 'Ш'];
const ROUND_SIDE_CHARS = ['O', 'О', 'C', 'С', '0'];
const PUNCTUATION_CHARS = [
    ...new Set([
        ...Object.keys(YS_TEXT_REGULAR.table || {}),
        ...'!"#$%&()*+,-./:;<=>?@[\\]^_`{|}~'
    ])
];
const FLAT_INVARIANT_CHARS = ['H', 'I', 'Н', 'П', 'Ш'];
const MONOTONIC_CHARS = ['H', 'S', 'O', 'A', 'W'];
const SYMMETRY_CHARS = ['O', 'H', 'X', 'Ж'];

const finite = (value) => Number.isFinite(value) ? value : null;
const round2 = (value) => Math.round(value * 100) / 100;
const round4 = (value) => Math.round(value * 10000) / 10000;
const avg = (values) => values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;

function localizedName(name) {
    if (!name) return '';
    if (typeof name === 'string') return name;
    return name.en || name['en-US'] || Object.values(name).find(Boolean) || '';
}

function fontNames(font) {
    const names = font?.names || {};
    const preferredFamily = localizedName(names.preferredFamily);
    const preferredSubfamily = localizedName(names.preferredSubfamily);
    const legacyFamily = localizedName(names.fontFamily);
    const legacySubfamily = localizedName(names.fontSubfamily);
    return {
        family: preferredFamily || legacyFamily,
        subfamily: preferredSubfamily || legacySubfamily,
        preferredFamily,
        preferredSubfamily,
        legacyFamily,
        legacySubfamily,
        fullName: localizedName(names.fullName),
        postScriptName: localizedName(names.postScriptName)
    };
}

function firstGlyphTop(tf, chars) {
    for (const ch of chars) {
        const bb = tf.box(ch);
        if (bb && Number.isFinite(bb[3]) && bb[3] > 0) {
            return { value: bb[3], source: `glyph:${ch}` };
        }
    }
    return { value: null, source: 'missing' };
}

function metricChoice({ declared, geometric, fallback, declaredSource, geometricSource, fallbackSource }) {
    if (Number.isFinite(geometric) && geometric > 0) return { value: geometric, source: geometricSource };
    if (Number.isFinite(declared) && declared > 0) return { value: declared, source: declaredSource };
    return { value: finite(fallback), source: fallbackSource };
}

function glyphWidth(tf, ch) {
    const bb = tf.box(ch);
    return bb ? bb[2] - bb[0] : null;
}

function measureStemWidth(tf, capHeight) {
    const candidates = [];
    for (const ch of STEM_CHARS) {
        const width = glyphWidth(tf, ch);
        if (!Number.isFinite(width) || width <= 0) continue;
        const ratio = capHeight ? width / capHeight : 0;
        candidates.push({ ch, value: width, ratio });
    }
    const chosen = candidates.find((c) => c.ratio >= 0.04 && c.ratio <= 0.35) || candidates[0] || null;
    return {
        value: chosen ? chosen.value : null,
        source: chosen ? `glyph:${chosen.ch}` : 'missing',
        candidates
    };
}

function averageSidebearing(tf, chars, side) {
    const index = side === 'L' ? 0 : 1;
    const values = [];
    for (const ch of chars) {
        if (!tf.box(ch)) continue;
        values.push(tf.sidebearings(ch)[index]);
    }
    return {
        value: avg(values),
        n: values.length,
        chars: values.length ? chars.filter((ch) => tf.box(ch)) : []
    };
}

function sidebearingCalibration(tf) {
    const flat = {
        L: averageSidebearing(tf, FLAT_SIDE_CHARS, 'L'),
        R: averageSidebearing(tf, FLAT_SIDE_CHARS, 'R')
    };
    const round = {
        L: averageSidebearing(tf, ROUND_SIDE_CHARS, 'L'),
        R: averageSidebearing(tf, ROUND_SIDE_CHARS, 'R')
    };
    const deltaL = Number.isFinite(flat.L.value) && Number.isFinite(round.L.value)
        ? round.L.value - flat.L.value
        : null;
    const deltaR = Number.isFinite(flat.R.value) && Number.isFinite(round.R.value)
        ? round.R.value - flat.R.value
        : null;
    const magnitude = avg([deltaL, deltaR].filter(Number.isFinite).map(Math.abs));
    return {
        flat,
        round,
        delta: { L: deltaL, R: deltaR, magnitude },
        scale: Number.isFinite(magnitude) && YS_REFERENCE.sidebearingDelta
            ? magnitude / YS_REFERENCE.sidebearingDelta
            : 1
    };
}

function variationAxes(font) {
    const axes = font?.tables?.fvar?.axes || [];
    return axes.map((axis) => ({
        tag: axis.tag,
        name: localizedName(axis.name) || axis.tag,
        min: finite(axis.minValue),
        default: finite(axis.defaultValue),
        max: finite(axis.maxValue)
    }));
}

function variationInstances(font) {
    const instances = font?.tables?.fvar?.instances || [];
    return instances.map((instance) => ({
        name: localizedName(instance.name),
        coordinates: { ...(instance.coordinates || {}) }
    }));
}

export function probeTypeface(tf, options = {}) {
    const font = tf?.font || {};
    const os2 = font.tables?.os2 || {};
    const hhea = font.tables?.hhea || {};
    const capGeo = firstGlyphTop(tf, options.capChars || DEFAULT_CAP_CHARS);
    const xGeo = firstGlyphTop(tf, options.xChars || DEFAULT_X_CHARS);
    const capHeight = metricChoice({
        declared: os2.sCapHeight,
        geometric: capGeo.value,
        fallback: tf.capHeight,
        declaredSource: 'OS/2.sCapHeight',
        geometricSource: capGeo.source,
        fallbackSource: 'typeface.capHeight'
    });
    const xHeight = metricChoice({
        declared: os2.sxHeight,
        geometric: xGeo.value,
        fallback: tf.xHeight,
        declaredSource: 'OS/2.sxHeight',
        geometricSource: xGeo.source,
        fallbackSource: 'typeface.xHeight'
    });
    const ascender = {
        value: finite(os2.sTypoAscender) ?? finite(hhea.ascender) ?? finite(tf.ascender),
        source: Number.isFinite(os2.sTypoAscender) ? 'OS/2.sTypoAscender' : 'hhea.ascender'
    };
    const descender = {
        value: finite(os2.sTypoDescender) ?? finite(hhea.descender) ?? finite(tf.descender),
        source: Number.isFinite(os2.sTypoDescender) ? 'OS/2.sTypoDescender' : 'hhea.descender'
    };
    const stemWidth = measureStemWidth(tf, capHeight.value);
    const sidebearings = sidebearingCalibration(tf);
    const names = fontNames(font);
    return {
        id: names.fullName || names.postScriptName || names.family || 'Unknown Typeface',
        names,
        metrics: {
            unitsPerEm: { value: tf.upm, source: 'head.unitsPerEm' },
            capHeight,
            xHeight,
            ascender,
            descender,
            hheaAscender: finite(hhea.ascender),
            hheaDescender: finite(hhea.descender),
            typoAscender: finite(os2.sTypoAscender),
            typoDescender: finite(os2.sTypoDescender),
            italicAngle: {
                value: finite(font.tables?.post?.italicAngle) ?? 0,
                source: Number.isFinite(font.tables?.post?.italicAngle) ? 'post.italicAngle' : 'fallback:0'
            },
            weightClass: {
                value: finite(os2.usWeightClass) ?? 400,
                source: Number.isFinite(os2.usWeightClass) ? 'OS/2.usWeightClass' : 'fallback:400'
            },
            widthClass: {
                value: finite(os2.usWidthClass) ?? 5,
                source: Number.isFinite(os2.usWidthClass) ? 'OS/2.usWidthClass' : 'fallback:5'
            }
        },
        proportions: {
            capEm: capHeight.value && tf.upm ? capHeight.value / tf.upm : null,
            xHeightEm: xHeight.value && tf.upm ? xHeight.value / tf.upm : null,
            widthHOverCap: tf.advance('H') && capHeight.value ? tf.advance('H') / capHeight.value : null
        },
        stems: {
            vertical: stemWidth,
            contrast: { value: 1, source: 'fallback' }
        },
        sidebearings,
        variations: {
            axes: variationAxes(font),
            instances: variationInstances(font)
        }
    };
}

function coefficientScale(probe) {
    const scale = probe?.sidebearings?.scale;
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function generatedPunctuationTable(tf, probe) {
    const table = {};
    for (const ch of PUNCTUATION_CHARS) {
        if (!tf.box(ch)) continue;
        const [left, right] = tf.sidebearings(ch);
        const row = {};
        const flatL = probe.sidebearings.flat.L.value;
        const flatR = probe.sidebearings.flat.R.value;
        if (Number.isFinite(left) && Number.isFinite(flatL)) {
            const value = Math.max(0, left - flatL);
            if (value > 0.005) row.L = round2(value);
        }
        if (Number.isFinite(right) && Number.isFinite(flatR)) {
            const value = Math.max(0, right - flatR);
            if (value > 0.005) row.R = round2(value);
        }
        if (Object.keys(row).length) table[ch] = row;
    }
    return table;
}

export function autoCompensationParams(tf, probe = probeTypeface(tf), options = {}) {
    const stem = probe.stems.vertical.value || YS_REFERENCE.stemWidth;
    const stemScale = stem / YS_REFERENCE.stemWidth;
    const scale = coefficientScale(probe);
    const coef = {};
    for (const [key, value] of Object.entries(YS_TEXT_REGULAR.coef || {})) {
        coef[key] = round4(value * scale);
    }
    return {
        id: `Auto ${probe.id}`,
        source: 'fontprobe.auto.v1',
        eps: round4(YS_TEXT_REGULAR.eps * stemScale),
        w: round4(YS_TEXT_REGULAR.w * stemScale),
        coef,
        r2: null,
        rmse_em: null,
        table: options.punctuationTable === false ? {} : generatedPunctuationTable(tf, probe),
        calibration: {
            stemScale: round4(stemScale),
            sidebearingScale: round4(scale),
            reference: { ...YS_REFERENCE }
        }
    };
}

function stats(values) {
    const clean = values.filter(Number.isFinite);
    const mean = avg(clean) ?? 0;
    const sigma = clean.length
        ? Math.sqrt(clean.reduce((s, v) => s + (v - mean) ** 2, 0) / clean.length)
        : 0;
    return {
        n: clean.length,
        mean,
        sigma,
        maxAbs: clean.length ? Math.max(...clean.map((v) => Math.abs(v))) : 0
    };
}

function flatStemInvariant(comp, size, tolerancePx) {
    const values = [];
    for (const ch of FLAT_INVARIANT_CHARS) {
        for (const side of ['L', 'R']) {
            values.push(comp.outdentEm(ch, side));
        }
    }
    const s = stats(values);
    return {
        ...s,
        sigmaPx: s.sigma * size / 1000,
        maxAbsPx: s.maxAbs * size / 1000,
        pass: s.sigma * size / 1000 <= tolerancePx
    };
}

function monotonicInvariant(comp) {
    const bySide = {};
    let pass = true;
    for (const side of ['L', 'R']) {
        const values = MONOTONIC_CHARS.map((ch) => ({ ch, em: comp.outdentEm(ch, side) }));
        const sidePass = values.every((entry, i) => i === 0 || entry.em + 0.001 >= values[i - 1].em);
        bySide[side] = { values, pass: sidePass };
        pass = pass && sidePass;
    }
    return { pass, bySide };
}

function symmetryInvariant(comp, toleranceEm) {
    const values = [];
    for (const ch of SYMMETRY_CHARS) {
        const L = comp.outdentEm(ch, 'L');
        const R = comp.outdentEm(ch, 'R');
        if (!Number.isFinite(L) || !Number.isFinite(R)) continue;
        values.push({ ch, L, R, delta: Math.abs(L - R), pass: Math.abs(L - R) <= toleranceEm });
    }
    return {
        values,
        maxDelta: values.length ? Math.max(...values.map((v) => v.delta)) : 0,
        pass: values.every((v) => v.pass)
    };
}

export function runCompensationInvariants(tf, params, options = {}) {
    const size = options.size || 15.2;
    const comp = new Compensator(tf, { ...params, table: {} });
    const flatStem = flatStemInvariant(comp, size, options.flatStemTolerancePx || 0.05);
    const monotonic = monotonicInvariant(comp);
    const symmetry = symmetryInvariant(comp, options.symmetryToleranceEm || 0.75);
    return {
        pass: flatStem.pass && monotonic.pass && symmetry.pass,
        flatStem,
        monotonic,
        symmetry
    };
}
