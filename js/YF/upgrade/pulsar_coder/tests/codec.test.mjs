import assert from 'node:assert/strict';
import test from 'node:test';

const originalDocument = globalThis.document;
globalThis.document = { addEventListener() {} };
const codec = await import('../pulsar-main.js');
if (originalDocument === undefined) {
    delete globalThis.document;
} else {
    globalThis.document = originalDocument;
}

const voyagerParams = Object.freeze({
    eccMode: 'none',
    preambleLength: 16,
    rayCount: 14,
    seed: 'voyager1977'
});

test('UTF-8, bit conversion and CRC32 retain known results', () => {
    const bytes = codec.utf8ToBytes('The truth is out there');
    const bits = codec.bytesToBits(bytes);

    assert.equal(bytes.length, 22);
    assert.equal(bits.length, 176);
    assert.equal(codec.bytesToUtf8(codec.bitsToBytes(bits)), 'The truth is out there');
    assert.equal(codec.crc32(bytes).toString(16).toUpperCase(), 'DDC73540');
});

test('Voyager encoding stays deterministic at 240 framed bits', () => {
    const first = codec.encodePulsar('The truth is out there', voyagerParams);
    const second = codec.encodePulsar('The truth is out there', voyagerParams);

    assert.deepEqual(first, second);
    assert.equal(first.metadata.payloadLength, 176);
    assert.equal(first.metadata.encodedLength, 240);
    assert.equal(first.metadata.crcHex, 'DDC73540');
    assert.equal(first.raysBits.length, 14);
    assert.equal(first.raysBits.reduce((sum, ray) => sum + ray.length, 0), 240);
});

test('ECC repetition retains the framed bit stream', () => {
    const bits = [1, 0, 1, 1, 0];
    for (const mode of ['none', 'repeat2', 'repeat3']) {
        assert.deepEqual(codec.decodeECC(codec.applyECC(bits, mode), mode), bits);
    }
});

test('the known legacy verification failure is recorded, not silently changed', () => {
    const encoded = codec.encodePulsar('The truth is out there', voyagerParams);
    const result = codec.verifyPulsar(encoded.raysBits, voyagerParams);

    assert.equal(result.success, false);
    assert.equal(result.crcMatch, false);
});
