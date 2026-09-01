const encoder = new TextEncoder();

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < table.length; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
        }
        table[index] = value >>> 0;
    }
    return table;
})();

export function crc32(bytes) {
    let value = 0xffffffff;
    for (let index = 0; index < bytes.length; index += 1) {
        value = CRC_TABLE[(value ^ bytes[index]) & 0xff] ^ (value >>> 8);
    }
    return (value ^ 0xffffffff) >>> 0;
}

function concat(parts) {
    const size = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const output = new Uint8Array(size);
    let offset = 0;
    parts.forEach((part) => {
        output.set(part, offset);
        offset += part.byteLength;
    });
    return output;
}

function header(size) {
    return new DataView(new ArrayBuffer(size));
}

function asBytes(view) {
    return new Uint8Array(view.buffer);
}

export function createStoredZip(files) {
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;

    files.forEach((file) => {
        const name = encoder.encode(file.name);
        const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
        const checksum = crc32(data);
        const local = header(30);
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true);
        local.setUint16(6, 0x0800, true);
        local.setUint16(8, 0, true);
        local.setUint32(14, checksum, true);
        local.setUint32(18, data.byteLength, true);
        local.setUint32(22, data.byteLength, true);
        local.setUint16(26, name.byteLength, true);
        localParts.push(asBytes(local), name, data);

        const central = header(46);
        central.setUint32(0, 0x02014b50, true);
        central.setUint16(4, 20, true);
        central.setUint16(6, 20, true);
        central.setUint16(8, 0x0800, true);
        central.setUint16(10, 0, true);
        central.setUint32(16, checksum, true);
        central.setUint32(20, data.byteLength, true);
        central.setUint32(24, data.byteLength, true);
        central.setUint16(28, name.byteLength, true);
        central.setUint32(42, localOffset, true);
        centralParts.push(asBytes(central), name);
        localOffset += 30 + name.byteLength + data.byteLength;
    });

    const centralDirectory = concat(centralParts);
    const end = header(22);
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralDirectory.byteLength, true);
    end.setUint32(16, localOffset, true);
    return concat([...localParts, centralDirectory, asBytes(end)]);
}

export class StoredZipBlobBuilder {
    constructor() {
        this.localParts = [];
        this.centralParts = [];
        this.localOffset = 0;
        this.centralSize = 0;
        this.fileCount = 0;
        this.dataBytes = 0;
        this.metadataBytes = 22;
    }

    add(nameValue, dataValue) {
        const name = encoder.encode(String(nameValue));
        const data = dataValue instanceof Uint8Array
            ? dataValue
            : new Uint8Array(dataValue);
        const checksum = crc32(data);
        const local = header(30);
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true);
        local.setUint16(6, 0x0800, true);
        local.setUint16(8, 0, true);
        local.setUint32(14, checksum, true);
        local.setUint32(18, data.byteLength, true);
        local.setUint32(22, data.byteLength, true);
        local.setUint16(26, name.byteLength, true);
        this.localParts.push(asBytes(local), name, data);

        const central = header(46);
        central.setUint32(0, 0x02014b50, true);
        central.setUint16(4, 20, true);
        central.setUint16(6, 20, true);
        central.setUint16(8, 0x0800, true);
        central.setUint16(10, 0, true);
        central.setUint32(16, checksum, true);
        central.setUint32(20, data.byteLength, true);
        central.setUint32(24, data.byteLength, true);
        central.setUint16(28, name.byteLength, true);
        central.setUint32(42, this.localOffset, true);
        this.centralParts.push(asBytes(central), name);

        const localSize = 30 + name.byteLength + data.byteLength;
        const centralSize = 46 + name.byteLength;
        this.localOffset += localSize;
        this.centralSize += centralSize;
        this.fileCount += 1;
        this.dataBytes += data.byteLength;
        this.metadataBytes += 30 + 46 + name.byteLength * 2;
        return this;
    }

    get byteLength() {
        return this.localOffset + this.centralSize + 22;
    }

    get retainedBytes() {
        return this.dataBytes + this.metadataBytes;
    }

    toBlob() {
        const end = header(22);
        end.setUint32(0, 0x06054b50, true);
        end.setUint16(8, this.fileCount, true);
        end.setUint16(10, this.fileCount, true);
        end.setUint32(12, this.centralSize, true);
        end.setUint32(16, this.localOffset, true);
        return new Blob(
            [...this.localParts, ...this.centralParts, asBytes(end)],
            { type: 'application/zip' }
        );
    }
}

export function createStoredZipBlob(files) {
    const builder = new StoredZipBlobBuilder();
    files.forEach((file) => builder.add(file.name, file.data));
    return builder.toBlob();
}
