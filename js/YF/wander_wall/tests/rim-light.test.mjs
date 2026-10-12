import test from 'node:test';
import assert from 'node:assert/strict';
import { directionalRim, softRim } from '../rim-light.js';
import { normalizeEffects } from '../effects.js';
import { normalize, normalizePreset, makeDocument, readDocument, shareDefaults } from '../document.js';
import { ShareCodec } from '../../infra/framework/src/index.js';

function square() {
    const alpha = new Float32Array(64 * 64);
    for (let y = 16; y < 48; y++) for (let x = 16; x < 48; x++) alpha[y * 64 + x] = 1;
    return alpha;
}

test('Rim light is opt-in, has no intensity setting and survives documents, presets and links', async () => {
    assert.equal(normalizeEffects({}).rimLightEnabled, false);
    assert.equal(normalizeEffects({ rimLightEnabled: 'false' }).rimLightEnabled, false);
    for (const enabled of [false, true]) {
        const scene = normalize({ text: '', items: [], rimLightEnabled: enabled, rimLightIntensity: 0 });
        assert.equal(scene.rimLightEnabled, enabled);
        assert.equal('rimLightIntensity' in scene, false);
        assert.deepEqual(readDocument(makeDocument(scene)), scene);
        assert.deepEqual(normalizePreset({ ...scene, seeded: false }), scene);
        const codec = new ShareCodec({ pristineDefaults: shareDefaults, quantizableFloatKeys: [] });
        assert.deepEqual(normalize((await codec.decode(await codec.encode(scene))).full), scene);
    }
});

test('directional rim lights the facing alpha contour and keeps the source mask intact', () => {
    const alpha = square(), before = alpha.slice(), edge = directionalRim(alpha, 64, 64, 0, 3);
    assert.ok(edge[32 * 64 + 16] > 0 && edge[16 * 64 + 32] > 0);
    assert.equal(edge[32 * 64 + 47], 0); assert.equal(edge[47 * 64 + 32], 0);
    assert.equal(edge[32 * 64 + 32], 0); assert.equal(edge[0], 0);
    assert.deepEqual(alpha, before);
    const reversed = directionalRim(alpha, 64, 64, 180, 3);
    assert.equal(reversed[32 * 64 + 16], 0); assert.ok(reversed[32 * 64 + 47] > 0);
});

test('transparent holes, partially transparent edges and invisible masks are handled as silhouettes', () => {
    const alpha = square();
    for (let y = 24; y < 40; y++) for (let x = 24; x < 40; x++) alpha[y * 64 + x] = 0;
    const edge = directionalRim(alpha, 64, 64, 0, 3);
    assert.equal(edge[32 * 64 + 32], 0);
    assert.ok(edge[32 * 64 + 40] > 0, 'inner edge faces the light through a hole');
    const half = directionalRim(alpha.map(v => v / 2), 64, 64, 0, 3);
    assert.ok(half.every((v, i) => Math.abs(v - edge[i] / 2) < 1e-6));
    assert.ok(softRim(new Float32Array(64 * 64), 64, 64, 0, 32).every(v => v === 0));
});

test('rim softness creates a restrained halo without lighting the interior or opposing edge', () => {
    const alpha = square(), before = alpha.slice(), rim = softRim(alpha, 64, 64, 0, 32);
    assert.ok(rim[32 * 64 + 15] > 0, 'light extends just beyond the contour');
    assert.ok(rim[32 * 64 + 16] > rim[32 * 64 + 13], 'halo falls off away from the edge');
    assert.ok(rim[32 * 64 + 32] < .001 && rim[32 * 64 + 47] < .001);
    assert.ok(rim.every(v => v >= 0 && v <= 1));
    assert.deepEqual(alpha, before);
});
