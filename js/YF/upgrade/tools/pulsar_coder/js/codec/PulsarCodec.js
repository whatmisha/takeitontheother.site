/**
 * Pulsar v2 codec.
 *
 * The visual format is self describing. Ray 0 carries a compact global header;
 * every ray starts with its index followed by the inverse index. The SVG
 * metadata mirrors these values, but decoding never depends on it.
 */

export const CODEC_NAME = 'pulsar-v2';
export const CODEC_VERSION = 2;
export const GLOBAL_MAGIC = 0xD35;
export const GLOBAL_MAGIC_BITS = 12;
export const RAY_INDEX_BITS = 5;
export const RAY_PREFIX_BITS = RAY_INDEX_BITS * 2;
export const HEADER_DATA_BITS = GLOBAL_MAGIC_BITS + 4 + 2 + 5 + 16;
export const HEADER_BITS = HEADER_DATA_BITS + 8;

const ECC_TO_ID = Object.freeze({ none: 0, repeat2: 1, repeat3: 2 });
const ID_TO_ECC = Object.freeze(['none', 'repeat2', 'repeat3']);

export function utf8ToBytes(value) {
    return new TextEncoder().encode(String(value));
}

export function bytesToUtf8(bytes, { fatal = true } = {}) {
    return new TextDecoder('utf-8', { fatal }).decode(bytes);
}

export function bytesToBits(bytes) {
    const bits = [];
    for (const byte of bytes) {
        for (let shift = 7; shift >= 0; shift -= 1) bits.push((byte >>> shift) & 1);
    }
    return bits;
}

export function bitsToBytes(bits) {
    if (bits.length % 8 !== 0) throw new Error('Bit count must be divisible by 8');
    const bytes = new Uint8Array(bits.length / 8);
    for (let index = 0; index < bits.length; index += 1) {
        const bit = bits[index];
        if (bit !== 0 && bit !== 1) throw new Error(`Unknown bit at ${index}`);
        bytes[Math.floor(index / 8)] |= bit << (7 - (index % 8));
    }
    return bytes;
}

export function numToBits(value, length) {
    if (!Number.isInteger(length) || length < 1 || length > 32) {
        throw new Error('Bit field length must be between 1 and 32');
    }
    const unsigned = Number(value) >>> 0;
    const bits = [];
    for (let shift = length - 1; shift >= 0; shift -= 1) bits.push((unsigned >>> shift) & 1);
    return bits;
}

export function bitsToNum(bits) {
    let value = 0;
    for (const bit of bits) {
        if (bit !== 0 && bit !== 1) throw new Error('Cannot read a numeric field containing unknown bits');
        value = ((value << 1) | bit) >>> 0;
    }
    return value >>> 0;
}

let crcTable = null;

function getCrcTable() {
    if (crcTable) return crcTable;
    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = value & 1 ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
        }
        crcTable[index] = value >>> 0;
    }
    return crcTable;
}

export function crc32(bytes) {
    const table = getCrcTable();
    let crc = 0xFFFFFFFF;
    for (const byte of bytes) crc = ((crc >>> 8) ^ table[(crc ^ byte) & 0xFF]) >>> 0;
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function crc8Bits(bits) {
    let crc = 0;
    for (const bit of bits) {
        const mix = ((crc >>> 7) & 1) ^ bit;
        crc = (crc << 1) & 0xFF;
        if (mix) crc ^= 0x07;
    }
    return crc & 0xFF;
}

export function applyECC(bits, mode = 'none') {
    if (mode === 'none') return [...bits];
    const repeat = mode === 'repeat2' ? 2 : mode === 'repeat3' ? 3 : 0;
    if (!repeat) throw new Error(`Unsupported ECC mode: ${mode}`);
    return bits.flatMap(bit => Array(repeat).fill(bit));
}

export function decodeECC(bits, mode = 'none') {
    if (mode === 'none') return [...bits];
    const repeat = mode === 'repeat2' ? 2 : mode === 'repeat3' ? 3 : 0;
    if (!repeat) throw new Error(`Unsupported ECC mode: ${mode}`);
    if (bits.length % repeat !== 0) throw new Error('Truncated ECC stream');

    const decoded = [];
    for (let index = 0; index < bits.length; index += repeat) {
        const chunk = bits.slice(index, index + repeat);
        if (chunk.some(bit => bit !== 0 && bit !== 1)) throw new Error('ECC stream contains unknown bits');
        const ones = chunk.reduce((sum, bit) => sum + bit, 0);
        if (repeat === 2 && ones === 1) throw new Error('Two-copy ECC detected an uncorrectable disagreement');
        decoded.push(ones > repeat / 2 ? 1 : 0);
    }
    return decoded;
}

export function makeRayPrefix(rayIndex) {
    const indexBits = numToBits(rayIndex, RAY_INDEX_BITS);
    return [...indexBits, ...indexBits.map(bit => 1 - bit)];
}

export function readRayPrefix(bits) {
    if (bits.length < RAY_PREFIX_BITS) throw new Error('Ray prefix is truncated');
    const indexBits = bits.slice(0, RAY_INDEX_BITS);
    const inverseBits = bits.slice(RAY_INDEX_BITS, RAY_PREFIX_BITS);
    for (let index = 0; index < RAY_INDEX_BITS; index += 1) {
        if (indexBits[index] === inverseBits[index]) throw new Error('Ray prefix checksum failed');
    }
    return bitsToNum(indexBits);
}

export function buildGlobalHeader({ eccMode, rayCount, payloadByteLength }) {
    if (!(eccMode in ECC_TO_ID)) throw new Error(`Unsupported ECC mode: ${eccMode}`);
    if (!Number.isInteger(rayCount) || rayCount < 3 || rayCount > 31) throw new Error('Ray count must be between 3 and 31');
    if (!Number.isInteger(payloadByteLength) || payloadByteLength < 0 || payloadByteLength > 0xFFFF) {
        throw new Error('Payload is too large for Pulsar v2');
    }

    const data = [
        ...numToBits(GLOBAL_MAGIC, GLOBAL_MAGIC_BITS),
        ...numToBits(CODEC_VERSION, 4),
        ...numToBits(ECC_TO_ID[eccMode], 2),
        ...numToBits(rayCount, 5),
        ...numToBits(payloadByteLength, 16)
    ];
    return [...data, ...numToBits(crc8Bits(data), 8)];
}

export function parseGlobalHeader(bits) {
    if (bits.length < HEADER_BITS) throw new Error('Global header is truncated');
    const header = bits.slice(0, HEADER_BITS);
    const data = header.slice(0, HEADER_DATA_BITS);
    const expectedCrc = bitsToNum(header.slice(HEADER_DATA_BITS));
    if (crc8Bits(data) !== expectedCrc) throw new Error('Global header checksum failed');

    let offset = 0;
    const take = length => {
        const value = bitsToNum(data.slice(offset, offset + length));
        offset += length;
        return value;
    };
    const magic = take(GLOBAL_MAGIC_BITS);
    const version = take(4);
    const eccId = take(2);
    const rayCount = take(5);
    const payloadByteLength = take(16);

    if (magic !== GLOBAL_MAGIC) throw new Error('Pulsar v2 magic is missing');
    if (version !== CODEC_VERSION) throw new Error(`Unsupported Pulsar version: ${version}`);
    if (!ID_TO_ECC[eccId]) throw new Error('Unknown ECC mode in header');
    if (rayCount < 3 || rayCount > 31) throw new Error('Invalid ray count in header');

    return { magic, version, eccMode: ID_TO_ECC[eccId], rayCount, payloadByteLength };
}

export function splitBitsToRays(bits, rayCount) {
    if (!Number.isInteger(rayCount) || rayCount < 3 || rayCount > 31) throw new Error('Ray count must be between 3 and 31');
    const rays = Array.from({ length: rayCount }, (_, index) => makeRayPrefix(index));
    for (let index = 0; index < bits.length; index += 1) {
        const rayIndex = 1 + (index % (rayCount - 1));
        rays[rayIndex].push(bits[index]);
    }
    return rays;
}

export function addFraming(payloadBits) {
    if (payloadBits.length % 8 !== 0) throw new Error('Payload bits must contain complete bytes');
    const payloadBytes = bitsToBytes(payloadBits);
    return [...payloadBits, ...numToBits(crc32(payloadBytes), 32)];
}

export function encodePulsar(payload, params) {
    const payloadBytes = utf8ToBytes(payload);
    const payloadBits = bytesToBits(payloadBytes);
    const framedBits = addFraming(payloadBits);
    const encodedBits = applyECC(framedBits, params.eccMode);
    const raysBits = splitBitsToRays(encodedBits, params.rayCount);
    raysBits[0].push(...buildGlobalHeader({
        eccMode: params.eccMode,
        rayCount: params.rayCount,
        payloadByteLength: payloadBytes.length
    }));

    const checksum = crc32(payloadBytes);
    return {
        raysBits,
        metadata: {
            codec: CODEC_NAME,
            payloadLength: payloadBits.length,
            payloadByteLength: payloadBytes.length,
            encodedLength: encodedBits.length,
            crc: checksum,
            crcHex: checksum.toString(16).toUpperCase().padStart(8, '0')
        }
    };
}

export function decodePulsarRays(inputRays) {
    const raysByIndex = new Map();
    for (const bits of inputRays) {
        const rayIndex = readRayPrefix(bits);
        if (raysByIndex.has(rayIndex)) throw new Error(`Duplicate ray ${rayIndex}`);
        raysByIndex.set(rayIndex, bits.slice(RAY_PREFIX_BITS));
    }

    const anchor = raysByIndex.get(0);
    if (!anchor) throw new Error('Anchor ray is missing');
    const header = parseGlobalHeader(anchor);
    if (raysByIndex.size !== header.rayCount) {
        throw new Error(`Expected ${header.rayCount} rays, found ${raysByIndex.size}`);
    }

    const repeat = header.eccMode === 'repeat2' ? 2 : header.eccMode === 'repeat3' ? 3 : 1;
    const framedLength = header.payloadByteLength * 8 + 32;
    const encodedLength = framedLength * repeat;
    const encodedBits = [];
    let row = 0;
    while (encodedBits.length < encodedLength) {
        let added = false;
        for (let rayIndex = 1; rayIndex < header.rayCount && encodedBits.length < encodedLength; rayIndex += 1) {
            const ray = raysByIndex.get(rayIndex);
            if (!ray) throw new Error(`Ray ${rayIndex} is missing`);
            if (row < ray.length) {
                encodedBits.push(ray[row]);
                added = true;
            }
        }
        if (!added) break;
        row += 1;
    }
    if (encodedBits.length !== encodedLength) throw new Error('Payload stream is truncated');

    const framedBits = decodeECC(encodedBits, header.eccMode);
    const payloadBitLength = header.payloadByteLength * 8;
    const payloadBits = framedBits.slice(0, payloadBitLength);
    const expectedCrc = bitsToNum(framedBits.slice(payloadBitLength, payloadBitLength + 32));
    const payloadBytes = bitsToBytes(payloadBits);
    const actualCrc = crc32(payloadBytes);
    if (actualCrc !== expectedCrc) throw new Error('CRC32 mismatch');

    return {
        success: true,
        payloadText: bytesToUtf8(payloadBytes),
        payloadBytes,
        payloadLength: payloadBitLength,
        expectedCrc,
        actualCrc,
        crcMatch: true,
        details: {
            codec: CODEC_NAME,
            version: CODEC_VERSION,
            rayCount: header.rayCount,
            eccMode: header.eccMode,
            encodedBits: encodedLength
        }
    };
}

export function verifyPulsar(raysBits) {
    try {
        return decodePulsarRays(raysBits);
    } catch (error) {
        return { success: false, crcMatch: false, error: error.message };
    }
}
