import assert from 'node:assert/strict';
import test from 'node:test';

const codec = await import('../js/codec/PulsarCodec.js');

const voyagerParams = Object.freeze({
    eccMode: 'none',
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

test('Pulsar v2 encoding is deterministic and accounts for every bit', () => {
    const first = codec.encodePulsar('The truth is out there', voyagerParams);
    const second = codec.encodePulsar('The truth is out there', voyagerParams);

    assert.deepEqual(first, second);
    assert.equal(first.metadata.payloadLength, 176);
    assert.equal(first.metadata.encodedLength, 208);
    assert.equal(first.metadata.crcHex, 'DDC73540');
    assert.equal(first.raysBits.length, 14);
    assert.equal(first.raysBits[0].length, 57);
    assert.equal(first.raysBits.reduce((sum, ray) => sum + ray.length, 0), 395);
});

test('ECC repetition retains the framed bit stream', () => {
    const bits = [1, 0, 1, 1, 0];
    for (const mode of ['none', 'repeat2', 'repeat3']) {
        assert.deepEqual(codec.decodeECC(codec.applyECC(bits, mode), mode), bits);
    }
});

test('Pulsar v2 round-trips UTF-8 payloads through every ECC mode', () => {
    for (const payload of ['', 'The truth is out there', 'Привет 👽']) {
        for (const eccMode of ['none', 'repeat2', 'repeat3']) {
            const encoded = codec.encodePulsar(payload, { ...voyagerParams, eccMode });
            const result = codec.verifyPulsar(encoded.raysBits);
            assert.equal(result.success, true);
            assert.equal(result.crcMatch, true);
            assert.equal(result.payloadText, payload);
        }
    }
});

test('3x ECC repairs one damaged copy while 2x ECC rejects disagreement', () => {
    const triple = codec.encodePulsar('repair me', { ...voyagerParams, eccMode: 'repeat3' });
    triple.raysBits[1][codec.RAY_PREFIX_BITS] ^= 1;
    assert.equal(codec.verifyPulsar(triple.raysBits).payloadText, 'repair me');

    const double = codec.encodePulsar('detect me', { ...voyagerParams, eccMode: 'repeat2' });
    double.raysBits[1][codec.RAY_PREFIX_BITS] ^= 1;
    assert.match(codec.verifyPulsar(double.raysBits).error, /uncorrectable disagreement/u);
});

test('ray index and CRC corruption are rejected', () => {
    const encoded = codec.encodePulsar('integrity', voyagerParams);
    const brokenPrefix = encoded.raysBits.map(ray => [...ray]);
    brokenPrefix[2][0] ^= 1;
    assert.match(codec.verifyPulsar(brokenPrefix).error, /prefix checksum/u);

    const brokenPayload = encoded.raysBits.map(ray => [...ray]);
    brokenPayload[3].at(-1) === 1
        ? brokenPayload[3].splice(-1, 1, 0)
        : brokenPayload[3].splice(-1, 1, 1);
    assert.equal(codec.verifyPulsar(brokenPayload).success, false);
});
