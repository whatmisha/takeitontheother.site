import { CODEC_NAME } from '../codec/PulsarCodec.js';

export function seededRandom(seed) {
    let state = 0;
    for (const char of String(seed)) state = ((state << 5) - state + char.charCodeAt(0)) | 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) | 0;
        return (state >>> 0) / 0x100000000;
    };
}

export function makeAngles(rayCount, seed) {
    const rng = seededRandom(`${seed}_angles_v2`);
    const step = 360 / rayCount;
    const angles = [0];
    for (let index = 1; index < rayCount; index += 1) {
        const jitter = (rng() - 0.5) * step * 0.44;
        angles.push(index * step + jitter);
    }
    return angles;
}

function pointOnRay(center, angle, distance) {
    return {
        x: center.x + Math.cos(angle) * distance,
        y: center.y + Math.sin(angle) * distance
    };
}

function markSegment(center, angle, distance, length, role, bitIndex = null) {
    const point = pointOnRay(center, angle, distance);
    const perpendicular = angle + Math.PI / 2;
    const half = length / 2;
    return {
        role,
        bitIndex,
        center: point,
        length,
        x1: point.x - Math.cos(perpendicular) * half,
        y1: point.y - Math.sin(perpendicular) * half,
        x2: point.x + Math.cos(perpendicular) * half,
        y2: point.y + Math.sin(perpendicular) * half
    };
}

function addPoint(bounds, point) {
    bounds.minX = Math.min(bounds.minX, point.x);
    bounds.minY = Math.min(bounds.minY, point.y);
    bounds.maxX = Math.max(bounds.maxX, point.x);
    bounds.maxY = Math.max(bounds.maxY, point.y);
}

export function createPulsarGeometry(params, raysBits, previousGeometry = null, preserveEndpoints = false) {
    const center = {
        x: 500 + (Number(params.centerOffsetX) || 0),
        y: 500 + (Number(params.centerOffsetY) || 0)
    };
    const rayCount = Number(params.rayCount);
    const bitStep = Number(params.bitStep);
    const tickShort = Number(params.tickShort);
    const tickLong = Number(params.tickLong);
    if (!Number.isFinite(bitStep) || bitStep <= 0) throw new Error('Bit step must be positive');
    if (!Number.isFinite(tickShort) || tickShort <= 0) throw new Error('Short tick must be positive');
    if (!Number.isFinite(tickLong) || tickLong < tickShort * 1.5) {
        throw new Error('Long tick must be at least 1.5× the short tick');
    }
    if (!Array.isArray(raysBits) || raysBits.length !== rayCount) throw new Error('Ray data does not match ray count');

    const canPreserve = preserveEndpoints && previousGeometry?.rays?.length === rayCount;
    const angles = makeAngles(rayCount, params.seed);
    const lengthRng = seededRandom(`${params.seed}_lengths_v2`);
    const offsetRng = seededRandom(`${params.seed}_offsets_v2`);
    const stepRng = seededRandom(`${params.seed}_steps_v3`);
    const tailRng = seededRandom(`${params.seed}_tails_v3`);
    const lengthVariation = Math.max(0, Math.min(100, Number(params.lengthVariation) || 0)) / 100;
    const nominalLength = Number(params.rayLength);
    const syncLength = tickLong * 2.35;
    const padding = Math.max(16, tickLong);
    const rays = [];
    const bounds = { minX: center.x, minY: center.y, maxX: center.x, maxY: center.y };

    for (let index = 0; index < rayCount; index += 1) {
        const baseLength = nominalLength * (1 + (lengthRng() - 0.5) * lengthVariation * 0.9);
        const rayStep = canPreserve
            ? previousGeometry.rays[index].bitStep
            : bitStep * (0.88 + stepRng() * 0.24);
        const initialAngle = angles[index] * Math.PI / 180;
        const offset = canPreserve
            ? previousGeometry.rays[index].offset
            : Math.max(100, syncLength * 5) + offsetRng() * Math.max(20, baseLength * 0.18);
        const bodyStart = offset + rayStep * 8;
        const bodyEnd = bodyStart + Math.max(0, raysBits[index].length - 1) * rayStep;
        const requiredLength = Math.max(offset + rayStep * 5, bodyEnd) + syncLength / 2 + padding;
        const tailExtension = canPreserve
            ? (previousGeometry.rays[index].tailExtension || 0)
            : nominalLength * lengthVariation * (0.08 + tailRng() * 0.42);

        const sourceEndpoint = canPreserve
            ? previousGeometry.rays[index].sourceEndpoint
            : pointOnRay(center, initialAngle, Math.max(baseLength, requiredLength) + tailExtension);
        const dx = sourceEndpoint.x - center.x;
        const dy = sourceEndpoint.y - center.y;
        const actualLength = Math.hypot(dx, dy);
        const angle = actualLength > 0.001 ? Math.atan2(dy, dx) : initialAngle;
        const drawnLength = Math.max(actualLength, requiredLength);
        const endpoint = pointOnRay(center, angle, drawnLength);

        const marks = [
            markSegment(center, angle, offset, syncLength, 'pilot'),
            markSegment(center, angle, offset + rayStep * 2, syncLength, 'pilot'),
            markSegment(center, angle, offset + rayStep * 5, syncLength, 'pilot')
        ];
        raysBits[index].forEach((bit, bitIndex) => {
            const length = bit ? tickLong : tickShort;
            marks.push(markSegment(center, angle, bodyStart + bitIndex * rayStep, length, 'bit', bitIndex));
        });

        addPoint(bounds, endpoint);
        for (const mark of marks) {
            addPoint(bounds, { x: mark.x1, y: mark.y1 });
            addPoint(bounds, { x: mark.x2, y: mark.y2 });
        }
        rays.push({
            index,
            angle,
            offset,
            bitStep: rayStep,
            tailExtension,
            sourceEndpoint,
            endpoint,
            length: drawnLength,
            marks
        });
    }

    const viewPadding = Math.max(40, tickLong * 2);
    const minX = bounds.minX - viewPadding;
    const minY = bounds.minY - viewPadding;
    const maxX = bounds.maxX + viewPadding;
    const maxY = bounds.maxY + viewPadding;

    return {
        codec: CODEC_NAME,
        center,
        rays,
        bitStep,
        tickShort,
        tickLong,
        syncLength,
        viewBox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    };
}

function number(value) {
    return Number(value.toFixed(4));
}

function escapeAttribute(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function lineMarkup({ x1, y1, x2, y2 }, attributes) {
    return `<line x1="${number(x1)}" y1="${number(y1)}" x2="${number(x2)}" y2="${number(y2)}" ${attributes}/>`;
}

export function buildPulsarSvg(params, geometry, metadata, { forExport = false } = {}) {
    const strokeColor = forExport ? '#000000' : '#ffffff';
    const common = `stroke="${strokeColor}" stroke-width="${number(Number(params.strokeWidth))}" stroke-linecap="round"`;
    const groups = geometry.rays.map(ray => {
        const elements = [];
        if (params.showRays) {
            elements.push(lineMarkup({
                x1: geometry.center.x,
                y1: geometry.center.y,
                x2: ray.endpoint.x,
                y2: ray.endpoint.y
            }, `class="pulsar-ray-line" data-pulsar-role="axis" ${common} opacity="0.8"`));
        }
        for (const mark of ray.marks) {
            const bitIndex = mark.bitIndex === null ? '' : ` data-bit-index="${mark.bitIndex}"`;
            elements.push(lineMarkup(mark, `class="pulsar-mark pulsar-mark--${mark.role}" data-pulsar-role="${mark.role}"${bitIndex} ${common}`));
        }
        return `<g class="pulsar-ray" data-ray-index="${ray.index}">\n            ${elements.join('\n            ')}\n        </g>`;
    });
    const viewBox = geometry.viewBox;
    const metadataJson = escapeAttribute(JSON.stringify({
        codec: CODEC_NAME,
        version: 2,
        rayCount: params.rayCount,
        ecc: params.eccMode,
        payloadBytes: metadata.payloadByteLength,
        crc32: metadata.crcHex
    }));

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${number(viewBox.x)} ${number(viewBox.y)} ${number(viewBox.width)} ${number(viewBox.height)}"
     data-codec="${CODEC_NAME}"
     data-ray-count="${params.rayCount}"
     data-ecc="${params.eccMode}"
     data-crc="${metadata.crcHex}"
     data-payload-bytes="${metadata.payloadByteLength}"
     data-bit-step="${number(Number(params.bitStep))}"
     data-tick-short="${number(Number(params.tickShort))}"
     data-tick-long="${number(Number(params.tickLong))}"
     data-center-x="${number(geometry.center.x)}"
     data-center-y="${number(geometry.center.y)}"
     data-show-rays="${params.showRays ? 'true' : 'false'}">
    <metadata id="pulsar-metadata">${metadataJson}</metadata>
    <g id="pulsar-code" stroke-linecap="round" stroke-linejoin="round">
        ${groups.join('\n        ')}
    </g>
</svg>`;
}
