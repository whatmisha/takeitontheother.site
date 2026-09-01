const textEncoder = new TextEncoder();

const bytes = (...values) => new Uint8Array(values);
const text = (value) => textEncoder.encode(value);

function concat(parts) {
    const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    parts.forEach((part) => {
        output.set(part, offset);
        offset += part.byteLength;
    });
    return output;
}

function uint16(value) {
    return bytes((value >>> 8) & 0xff, value & 0xff);
}

function uint32(value) {
    return bytes(
        (value >>> 24) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 8) & 0xff,
        value & 0xff
    );
}

function box(type, ...payload) {
    const body = concat(payload);
    return concat([uint32(body.byteLength + 8), text(type), body]);
}

function fullBox(type, version, flags, ...payload) {
    return box(type, bytes(version, (flags >>> 16) & 0xff, (flags >>> 8) & 0xff, flags & 0xff), ...payload);
}

const MATRIX = concat([
    uint32(0x00010000), uint32(0), uint32(0),
    uint32(0), uint32(0x00010000), uint32(0),
    uint32(0), uint32(0), uint32(0x40000000)
]);

function makeFtyp() {
    return box('ftyp', text('iso6'), uint32(1), text('iso6'), text('avc1'), text('mp41'));
}

function makeMvhd(timescale, duration) {
    return fullBox('mvhd', 0, 0,
        uint32(0), uint32(0), uint32(timescale), uint32(duration),
        uint32(0x00010000), uint16(0x0100), uint16(0),
        new Uint8Array(8), MATRIX, new Uint8Array(24), uint32(2)
    );
}

function makeTkhd(width, height, duration) {
    return fullBox('tkhd', 0, 7,
        uint32(0), uint32(0), uint32(1), uint32(0), uint32(duration),
        new Uint8Array(8), uint16(0), uint16(0), uint16(0), uint16(0),
        MATRIX, uint32(width << 16), uint32(height << 16)
    );
}

function makeMdhd(timescale, duration) {
    return fullBox('mdhd', 0, 0,
        uint32(0), uint32(0), uint32(timescale), uint32(duration),
        uint16(0x55c4), uint16(0)
    );
}

function makeHdlr() {
    return fullBox('hdlr', 0, 0,
        uint32(0), text('vide'), new Uint8Array(12), text('VideoHandler\0')
    );
}

function makeDinf() {
    const url = fullBox('url ', 0, 1);
    return box('dinf', fullBox('dref', 0, 0, uint32(1), url));
}

function makeAvc1(width, height, decoderConfig) {
    const compressorName = new Uint8Array(32);
    const visualSampleEntry = concat([
        new Uint8Array(6), uint16(1),
        uint16(0), uint16(0), new Uint8Array(12),
        uint16(width), uint16(height),
        uint32(0x00480000), uint32(0x00480000), uint32(0),
        uint16(1), compressorName, uint16(0x0018), uint16(0xffff),
        box('avcC', decoderConfig)
    ]);
    return box('avc1', visualSampleEntry);
}

function makeCompositionOffsets(offsets) {
    if (!offsets.some((offset) => offset !== 0)) return null;
    const runs = [];
    offsets.forEach((offset) => {
        const previous = runs[runs.length - 1];
        if (previous?.offset === offset) previous.count += 1;
        else runs.push({ count: 1, offset });
    });
    return fullBox('ctts', 1, 0,
        uint32(runs.length),
        ...runs.flatMap((run) => [uint32(run.count), uint32(run.offset)])
    );
}

function makeStbl({
    width, height, decoderConfig, sizes, sampleDuration, keyframes, chunkOffset,
    compositionOffsets
}) {
    const stsd = fullBox('stsd', 0, 0, uint32(1), makeAvc1(width, height, decoderConfig));
    const stts = fullBox('stts', 0, 0, uint32(1), uint32(sizes.length), uint32(sampleDuration));
    const stsc = fullBox('stsc', 0, 0, uint32(1), uint32(1), uint32(sizes.length), uint32(1));
    const stsz = fullBox('stsz', 0, 0, uint32(0), uint32(sizes.length), ...sizes.map(uint32));
    const stco = fullBox('stco', 0, 0, uint32(1), uint32(chunkOffset));
    const stss = fullBox('stss', 0, 0, uint32(keyframes.length), ...keyframes.map(uint32));
    const ctts = makeCompositionOffsets(compositionOffsets);
    return box('stbl', stsd, stts, stsc, stsz, stco, stss, ...(ctts ? [ctts] : []));
}

function makeMoov(options, chunkOffset) {
    const { width, height, timescale, duration } = options;
    const stbl = makeStbl({ ...options, chunkOffset });
    const minf = box('minf', fullBox('vmhd', 0, 1, uint16(0), new Uint8Array(6)), makeDinf(), stbl);
    const mdia = box('mdia', makeMdhd(timescale, duration), makeHdlr(), minf);
    const trak = box('trak', makeTkhd(width, height, duration), mdia);
    return box('moov', makeMvhd(timescale, duration), trak);
}

export function muxAvcToMp4({ chunks, decoderConfig, width, height, fps }) {
    if (!chunks.length) throw new Error('Cannot create MP4 without encoded frames.');
    const configuration = decoderConfig instanceof Uint8Array
        ? decoderConfig
        : new Uint8Array(decoderConfig);
    if (!configuration.byteLength) throw new Error('The H.264 encoder did not provide an AVC configuration record.');
    // WebCodecs emits AVC samples in decode order. Their timestamps retain the
    // presentation order, so keeping callback order and writing CTTS offsets
    // also supports encoders that choose B-frames in quality mode.
    const ordered = [...chunks];
    const samples = ordered.map((chunk) => (
        chunk.data instanceof Uint8Array ? chunk.data : new Uint8Array(chunk.data)
    ));
    const sizes = samples.map((sample) => sample.byteLength);
    const keyframes = ordered
        .map((chunk, index) => chunk.type === 'key' ? index + 1 : null)
        .filter(Boolean);
    if (!keyframes.length) keyframes.push(1);
    const timescale = 90000;
    const sampleDuration = Math.round(timescale / fps);
    const duration = sampleDuration * samples.length;
    const compositionOffsets = ordered.map((chunk, index) => (
        Math.round(chunk.timestamp * timescale / 1_000_000) - index * sampleDuration
    ));
    const options = {
        width, height, timescale, duration, decoderConfig: configuration,
        sizes, sampleDuration, keyframes, compositionOffsets
    };
    const ftyp = makeFtyp();
    let moov = makeMoov(options, 0);
    const chunkOffset = ftyp.byteLength + moov.byteLength + 8;
    moov = makeMoov(options, chunkOffset);
    return concat([ftyp, moov, box('mdat', ...samples)]);
}
