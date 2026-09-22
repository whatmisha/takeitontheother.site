import assert from 'node:assert/strict';
import test from 'node:test';

import { encodePulsar } from '../js/codec/PulsarCodec.js';
import { buildPulsarSvg, createPulsarGeometry } from '../js/geometry/PulsarGeometry.js';
import { decodePulsarSvg } from '../js/decode/PulsarSvgDecoder.js';
import { decodePulsarBinaryImage, imageDataToBinary } from '../js/decode/PulsarRasterDecoder.js';

function params(overrides = {}) {
    return {
        rayCount: 14,
        rayLength: 280,
        bitStep: 9,
        tickShort: 5,
        tickLong: 11,
        strokeWidth: 1.5,
        showRays: true,
        seed: 'pulsar-v2-tests',
        margin: 45,
        centerOffsetX: 0,
        centerOffsetY: 0,
        eccMode: 'none',
        ...overrides
    };
}

function makeArtifact(payload, options = {}) {
    const settings = params(options);
    const encoded = encodePulsar(payload, settings);
    const geometry = createPulsarGeometry(settings, encoded.raysBits);
    return {
        settings,
        encoded,
        geometry,
        svg: buildPulsarSvg(settings, geometry, encoded.metadata, { forExport: true })
    };
}

function rasterizeGeometry(geometry, showRays, size = 1200) {
    const binary = new Uint8Array(size * size);
    const box = geometry.viewBox;
    const scale = Math.min((size - 32) / box.width, (size - 32) / box.height);
    const offsetX = 16 - box.x * scale + (size - 32 - box.width * scale) / 2;
    const offsetY = 16 - box.y * scale + (size - 32 - box.height * scale) / 2;
    const map = point => ({ x: point.x * scale + offsetX, y: point.y * scale + offsetY });

    const drawDisk = (x, y, radius) => {
        const minX = Math.max(0, Math.floor(x - radius));
        const maxX = Math.min(size - 1, Math.ceil(x + radius));
        const minY = Math.max(0, Math.floor(y - radius));
        const maxY = Math.min(size - 1, Math.ceil(y + radius));
        for (let py = minY; py <= maxY; py += 1) {
            for (let px = minX; px <= maxX; px += 1) {
                if ((px - x) ** 2 + (py - y) ** 2 <= radius ** 2) binary[py * size + px] = 1;
            }
        }
    };
    const drawLine = (start, end, width) => {
        const a = map(start);
        const b = map(end);
        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.max(1, Math.ceil(distance * 2));
        for (let step = 0; step <= steps; step += 1) {
            const amount = step / steps;
            drawDisk(a.x + (b.x - a.x) * amount, a.y + (b.y - a.y) * amount, width * scale / 2);
        }
    };

    for (const ray of geometry.rays) {
        if (showRays) drawLine(geometry.center, ray.endpoint, 1.5);
        for (const mark of ray.marks) drawLine({ x: mark.x1, y: mark.y1 }, { x: mark.x2, y: mark.y2 }, 1.5);
    }
    return { binary, width: size, height: size, center: map(geometry.center) };
}

test('SVG round-trip works with visible or hidden axes and a moved center', () => {
    const payload = 'Скрытые лучи + moved center 👽';
    for (const showRays of [true, false]) {
        const artifact = makeArtifact(payload, {
            showRays,
            centerOffsetX: 173,
            centerOffsetY: -91,
            eccMode: 'repeat3'
        });
        const result = decodePulsarSvg(artifact.svg, { DOMParserClass: undefined });
        assert.equal(result.payloadText, payload);
        assert.equal(result.crcMatch, true);
        assert.match(artifact.svg, /data-codec="pulsar-v2"/u);
        assert.equal((artifact.svg.match(/data-pulsar-role="axis"/gu) || []).length, showRays ? 14 : 0);
        if (showRays) assert.match(artifact.svg, /data-pulsar-role="axis"[^>]*opacity="0\.8"/u);
    }
});

test('moving the center never drops a bit mark', () => {
    const payload = 'Every encoded bit must stay visible';
    const initialSettings = params();
    const encoded = encodePulsar(payload, initialSettings);
    const initial = createPulsarGeometry(initialSettings, encoded.raysBits);
    const moved = createPulsarGeometry(
        params({ centerOffsetX: 310, centerOffsetY: 190 }),
        encoded.raysBits,
        initial,
        true
    );
    moved.rays.forEach((ray, index) => {
        assert.equal(ray.marks.filter(mark => mark.role === 'bit').length, encoded.raysBits[index].length);
        const farthest = Math.max(...ray.marks.map(mark => Math.hypot(
            mark.center.x - moved.center.x,
            mark.center.y - moved.center.y
        ) + mark.length / 2));
        assert.ok(ray.length >= farthest);
    });
});

test('clean ticks-only rasters decode across moved centers, layouts, ECC, and sizes', () => {
    const cases = [
        { rayCount: 8, centerOffsetX: 120, centerOffsetY: -75, eccMode: 'none', size: 1400, seed: 'hidden-a' },
        { rayCount: 14, centerOffsetX: -180, centerOffsetY: 95, eccMode: 'repeat2', size: 1200, seed: 'hidden-b' },
        { rayCount: 20, centerOffsetX: 240, centerOffsetY: 160, eccMode: 'repeat3', size: 1400, seed: 'hidden-c' }
    ];
    for (const [index, testCase] of cases.entries()) {
        const payload = `Raster v2 ${index} 👽`;
        const artifact = makeArtifact(payload, { showRays: false, ...testCase });
        const raster = rasterizeGeometry(artifact.geometry, false, testCase.size);
        const result = decodePulsarBinaryImage(raster.binary, raster.width, raster.height);
        assert.equal(result.payloadText, payload);
        assert.equal(result.geometry.mode, 'ticks-only');
        assert.equal(result.details.rayCount, testCase.rayCount);
    }
});

test('clean raster with visible axes decodes', () => {
    const payload = 'Visible rays';
    const artifact = makeArtifact(payload, { showRays: true, centerOffsetX: -80, centerOffsetY: 65 });
    const marks = rasterizeGeometry(artifact.geometry, false);
    const artwork = rasterizeGeometry(artifact.geometry, true);
    const data = new Uint8ClampedArray(artwork.width * artwork.height * 4);
    for (let index = 0; index < artwork.binary.length; index += 1) {
        const value = marks.binary[index] ? 0 : artwork.binary[index] ? 51 : 255;
        data[index * 4] = value;
        data[index * 4 + 1] = value;
        data[index * 4 + 2] = value;
        data[index * 4 + 3] = 255;
    }
    const binary = imageDataToBinary({ data, width: artwork.width, height: artwork.height });
    const result = decodePulsarBinaryImage(binary, artwork.width, artwork.height);
    assert.equal(result.payloadText, payload);
    assert.equal(result.geometry.mode, 'ticks-only');
});
