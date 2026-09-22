import { CODEC_NAME, decodePulsarRays } from '../codec/PulsarCodec.js';

function lengthOf(line) {
    return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}

function classifyLengths(rays, shortHint, longHint) {
    const values = rays.flatMap(ray => ray.marks.map(mark => mark.length));
    if (!values.length) throw new Error('SVG contains no Pulsar bit marks');

    if (Number.isFinite(shortHint) && Number.isFinite(longHint) && longHint > shortHint) {
        return (shortHint + longHint) / 2;
    }

    let low = Math.min(...values);
    let high = Math.max(...values);
    if (Math.abs(high - low) < 0.001) throw new Error('Short and long ticks are indistinguishable');
    for (let iteration = 0; iteration < 12; iteration += 1) {
        const lowValues = values.filter(value => Math.abs(value - low) <= Math.abs(value - high));
        const highValues = values.filter(value => Math.abs(value - low) > Math.abs(value - high));
        if (!lowValues.length || !highValues.length) break;
        low = lowValues.reduce((sum, value) => sum + value, 0) / lowValues.length;
        high = highValues.reduce((sum, value) => sum + value, 0) / highValues.length;
    }
    return (low + high) / 2;
}

function decodeGeometry(rays, shortHint, longHint) {
    const threshold = classifyLengths(rays, shortHint, longHint);
    const rayBits = rays
        .sort((a, b) => a.index - b.index)
        .map(ray => ray.marks
            .sort((a, b) => a.bitIndex - b.bitIndex)
            .map(mark => mark.length > threshold ? 1 : 0));
    return { ...decodePulsarRays(rayBits), source: 'svg', threshold };
}

function getNumberAttribute(element, name) {
    const value = Number(element.getAttribute(name));
    if (!Number.isFinite(value)) throw new Error(`Invalid SVG attribute: ${name}`);
    return value;
}

function parseWithDom(svgText, DOMParserClass) {
    const document = new DOMParserClass().parseFromString(svgText, 'image/svg+xml');
    const parserError = document.querySelector('parsererror');
    if (parserError) throw new Error('The selected SVG is not valid XML');
    const root = document.documentElement;
    if (root.getAttribute('data-codec') !== CODEC_NAME) throw new Error('Only Pulsar v2 SVG files are supported');

    const rays = [...document.querySelectorAll('.pulsar-ray')].map(group => ({
        index: getNumberAttribute(group, 'data-ray-index'),
        marks: [...group.querySelectorAll('[data-pulsar-role="bit"]')].map((line, order) => ({
            bitIndex: Number(line.getAttribute('data-bit-index') ?? order),
            length: lengthOf({
                x1: getNumberAttribute(line, 'x1'),
                y1: getNumberAttribute(line, 'y1'),
                x2: getNumberAttribute(line, 'x2'),
                y2: getNumberAttribute(line, 'y2')
            })
        }))
    }));
    if (!rays.length) throw new Error('No Pulsar v2 ray groups were found');
    return decodeGeometry(
        rays,
        Number(root.getAttribute('data-tick-short')),
        Number(root.getAttribute('data-tick-long'))
    );
}

function parseAttributes(tag) {
    const attributes = new Map();
    for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gu)) attributes.set(match[1], match[3]);
    return attributes;
}

function parseWithoutDom(svgText) {
    const rootMatch = svgText.match(/<svg\b[^>]*>/iu);
    if (!rootMatch) throw new Error('The selected file is not an SVG');
    const rootAttributes = parseAttributes(rootMatch[0]);
    if (rootAttributes.get('data-codec') !== CODEC_NAME) throw new Error('Only Pulsar v2 SVG files are supported');

    const rays = [];
    const groupPattern = /<g\b[^>]*class=["'][^"']*\bpulsar-ray\b[^"']*["'][^>]*>[\s\S]*?<\/g>/giu;
    for (const groupMatch of svgText.matchAll(groupPattern)) {
        const openTag = groupMatch[0].match(/<g\b[^>]*>/iu)?.[0];
        const groupAttributes = parseAttributes(openTag || '');
        const index = Number(groupAttributes.get('data-ray-index'));
        if (!Number.isInteger(index)) continue;
        const marks = [];
        for (const lineMatch of groupMatch[0].matchAll(/<line\b[^>]*>/giu)) {
            const attributes = parseAttributes(lineMatch[0]);
            if (attributes.get('data-pulsar-role') !== 'bit') continue;
            const line = Object.fromEntries(['x1', 'y1', 'x2', 'y2'].map(key => [key, Number(attributes.get(key))]));
            if (Object.values(line).some(value => !Number.isFinite(value))) continue;
            marks.push({
                bitIndex: Number(attributes.get('data-bit-index') ?? marks.length),
                length: lengthOf(line)
            });
        }
        rays.push({ index, marks });
    }
    if (!rays.length) throw new Error('No Pulsar v2 ray groups were found');
    return decodeGeometry(rays, Number(rootAttributes.get('data-tick-short')), Number(rootAttributes.get('data-tick-long')));
}

export function decodePulsarSvg(svgText, { DOMParserClass = globalThis.DOMParser } = {}) {
    const text = String(svgText || '');
    if (typeof DOMParserClass === 'function') return parseWithDom(text, DOMParserClass);
    return parseWithoutDom(text);
}
