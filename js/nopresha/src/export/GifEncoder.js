const COLOR_STEPS = [0, 51, 102, 153, 204, 255];
const TRANSPARENT_INDEX = 255;

export class GifEncoder {
    constructor(width, height, options = {}) {
        this.width = Math.round(width);
        this.height = Math.round(height);
        this.delayCentiseconds = options.delayCentiseconds || 15;
        this.transparent = Boolean(options.transparent);
        this.bytes = [];
        this.palette = createPalette();

        this.writeHeader();
    }

    addFrame(imageData, delayCentiseconds = this.delayCentiseconds) {
        const indexedPixels = this.indexPixels(imageData.data);

        this.writeGraphicControlExtension(delayCentiseconds);
        this.writeImageDescriptor();
        this.writeByte(8);
        this.writeSubBlocks(lzwEncode(indexedPixels, 8));
    }

    finish() {
        this.writeByte(0x3b);
        return new Blob([new Uint8Array(this.bytes)], { type: 'image/gif' });
    }

    writeHeader() {
        this.writeString('GIF89a');
        this.writeShort(this.width);
        this.writeShort(this.height);
        this.writeByte(0xf7);
        this.writeByte(0);
        this.writeByte(0);
        this.palette.forEach(([r, g, b]) => {
            this.writeByte(r);
            this.writeByte(g);
            this.writeByte(b);
        });
        this.writeLoopExtension();
    }

    writeLoopExtension() {
        this.writeByte(0x21);
        this.writeByte(0xff);
        this.writeByte(0x0b);
        this.writeString('NETSCAPE2.0');
        this.writeByte(0x03);
        this.writeByte(0x01);
        this.writeShort(0);
        this.writeByte(0);
    }

    writeGraphicControlExtension(delayCentiseconds) {
        this.writeByte(0x21);
        this.writeByte(0xf9);
        this.writeByte(0x04);
        this.writeByte(this.transparent ? 0x09 : 0x08);
        this.writeShort(Math.max(1, Math.round(delayCentiseconds)));
        this.writeByte(this.transparent ? TRANSPARENT_INDEX : 0);
        this.writeByte(0);
    }

    writeImageDescriptor() {
        this.writeByte(0x2c);
        this.writeShort(0);
        this.writeShort(0);
        this.writeShort(this.width);
        this.writeShort(this.height);
        this.writeByte(0);
    }

    indexPixels(data) {
        const pixels = new Uint8Array(this.width * this.height);
        for (let src = 0, dst = 0; src < data.length; src += 4, dst += 1) {
            const alpha = data[src + 3];
            if (this.transparent && alpha < 128) {
                pixels[dst] = TRANSPARENT_INDEX;
                continue;
            }

            const r = data[src];
            const g = data[src + 1];
            const b = data[src + 2];
            pixels[dst] = isNearGray(r, g, b) ? grayIndex(r, g, b) : cubeIndex(r, g, b);
        }
        return pixels;
    }

    writeSubBlocks(data) {
        for (let i = 0; i < data.length; i += 255) {
            const block = data.subarray(i, i + 255);
            this.writeByte(block.length);
            for (let j = 0; j < block.length; j += 1) {
                this.writeByte(block[j]);
            }
        }
        this.writeByte(0);
    }

    writeString(value) {
        for (let i = 0; i < value.length; i += 1) {
            this.writeByte(value.charCodeAt(i));
        }
    }

    writeShort(value) {
        this.writeByte(value & 0xff);
        this.writeByte((value >> 8) & 0xff);
    }

    writeByte(value) {
        this.bytes.push(value & 0xff);
    }
}

function createPalette() {
    const palette = [];
    COLOR_STEPS.forEach((r) => {
        COLOR_STEPS.forEach((g) => {
            COLOR_STEPS.forEach((b) => {
                palette.push([r, g, b]);
            });
        });
    });

    for (let i = 0; i < 39; i += 1) {
        const value = Math.round((i / 38) * 255);
        palette.push([value, value, value]);
    }

    palette.push([0, 0, 0]);
    return palette;
}

function cubeIndex(r, g, b) {
    const ri = Math.round(r / 51);
    const gi = Math.round(g / 51);
    const bi = Math.round(b / 51);
    return ri * 36 + gi * 6 + bi;
}

function grayIndex(r, g, b) {
    const luma = r * 0.299 + g * 0.587 + b * 0.114;
    return 216 + Math.max(0, Math.min(38, Math.round((luma / 255) * 38)));
}

function isNearGray(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max - min < 18;
}

function lzwEncode(indices, minCodeSize) {
    const clearCode = 1 << minCodeSize;
    const endCode = clearCode + 1;
    const packer = new BitPacker();
    let dictionary = new Map();
    let codeSize = minCodeSize + 1;
    let nextCode = endCode + 1;
    let maxCode = (1 << codeSize) - 1;

    const reset = () => {
        dictionary = new Map();
        codeSize = minCodeSize + 1;
        nextCode = endCode + 1;
        maxCode = (1 << codeSize) - 1;
    };

    const writeCode = (code) => {
        packer.write(code, codeSize);
        if (nextCode > maxCode && codeSize < 12) {
            codeSize += 1;
            maxCode = (1 << codeSize) - 1;
        }
    };

    writeCode(clearCode);

    let prefix = indices[0];
    for (let i = 1; i < indices.length; i += 1) {
        const suffix = indices[i];
        const key = prefix * 256 + suffix;
        const existingCode = dictionary.get(key);

        if (existingCode !== undefined) {
            prefix = existingCode;
            continue;
        }

        writeCode(prefix);

        if (nextCode < 4096) {
            dictionary.set(key, nextCode);
            nextCode += 1;
        } else {
            writeCode(clearCode);
            reset();
        }

        prefix = suffix;
    }

    writeCode(prefix);
    writeCode(endCode);
    return packer.finish();
}

class BitPacker {
    constructor() {
        this.bytes = [];
        this.buffer = 0;
        this.bitCount = 0;
    }

    write(code, size) {
        this.buffer |= code << this.bitCount;
        this.bitCount += size;

        while (this.bitCount >= 8) {
            this.bytes.push(this.buffer & 0xff);
            this.buffer >>= 8;
            this.bitCount -= 8;
        }
    }

    finish() {
        if (this.bitCount > 0) {
            this.bytes.push(this.buffer & 0xff);
        }
        return new Uint8Array(this.bytes);
    }
}
