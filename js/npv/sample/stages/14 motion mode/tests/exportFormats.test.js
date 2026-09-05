import assert from 'node:assert/strict';
import test from 'node:test';
import { createStoredZip, crc32 } from '../src/export/zipStore.js';
import { muxAvcToMp4 } from '../src/export/mp4Muxer.js';

const signatureAt = (bytes, offset) => new DataView(
    bytes.buffer,
    bytes.byteOffset + offset,
    4
).getUint32(0, true);

test('stored ZIP contains every named PNG and a valid directory footer', () => {
    const archive = createStoredZip([
        { name: 'frame_0001.png', data: new Uint8Array([1, 2, 3]) },
        { name: 'frame_0002.png', data: new Uint8Array([4, 5]) }
    ]);
    assert.equal(signatureAt(archive, 0), 0x04034b50);
    assert.equal(signatureAt(archive, archive.length - 22), 0x06054b50);
    const footer = new DataView(archive.buffer, archive.byteOffset + archive.length - 22, 22);
    assert.equal(footer.getUint16(8, true), 2);
    const decoded = new TextDecoder().decode(archive);
    assert.ok(decoded.includes('frame_0001.png'));
    assert.ok(decoded.includes('frame_0002.png'));
});

test('CRC32 matches the standard check value', () => {
    assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('MP4 muxer writes AVC configuration, timing, samples and media data', () => {
    const video = muxAvcToMp4({
        width: 480,
        height: 480,
        fps: 30,
        decoderConfig: new Uint8Array([1, 100, 0, 40, 0xff]),
        chunks: [
            { type: 'key', timestamp: 0, data: new Uint8Array([0, 0, 0, 1, 9]) },
            { type: 'delta', timestamp: 33333, data: new Uint8Array([0, 0, 0, 1, 1, 2]) }
        ]
    });
    const decoded = new TextDecoder('latin1').decode(video);
    ['ftyp', 'moov', 'avc1', 'avcC', 'stts', 'stsz', 'stco', 'mdat'].forEach((atom) => {
        assert.ok(decoded.includes(atom), `missing ${atom} atom`);
    });
    const firstBoxSize = new DataView(video.buffer, video.byteOffset, 4).getUint32(0);
    assert.ok(firstBoxSize > 8 && firstBoxSize < video.byteLength);
});

test('MP4 muxer preserves decode order and records reordered presentation timestamps', () => {
    const video = muxAvcToMp4({
        width: 480,
        height: 480,
        fps: 30,
        decoderConfig: new Uint8Array([1, 100, 0, 40, 0xff]),
        chunks: [
            { type: 'key', timestamp: 0, data: new Uint8Array([10]) },
            { type: 'delta', timestamp: 66667, data: new Uint8Array([20]) },
            { type: 'delta', timestamp: 33333, data: new Uint8Array([30]) }
        ]
    });
    const decoded = new TextDecoder('latin1').decode(video);
    assert.ok(decoded.includes('ctts'));
    const mdat = decoded.indexOf('mdat');
    assert.deepEqual([...video.slice(mdat + 4)], [10, 20, 30]);
});
