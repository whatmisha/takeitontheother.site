export function exportPng(canvas, options = {}) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const suffix = options.transparent ? "transparent" : "canvas";
    link.download = `etica-${suffix}-${canvas.width}x${canvas.height}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}

export function exportJson(data, options = {}) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const width = data?.canvas?.width ?? "document";
  const height = data?.canvas?.height ?? "";
  const suffix = height ? `${width}x${height}` : width;
  downloadBlob(blob, options.filename || `etica-document-${suffix}.json`);
}

export function exportGif(frames, options = {}) {
  if (!Array.isArray(frames) || !frames.length) return;

  const width = frames[0].width;
  const height = frames[0].height;
  const delay = Math.max(2, Math.round(100 / Math.max(1, Number(options.fps ?? 8))));
  const alphaThreshold = Math.max(1, Math.min(255, Number(options.alphaThreshold ?? 96)));
  const encoder = new GifEncoder(width, height);

  encoder.writeHeader();
  encoder.writeLogicalScreenDescriptor();
  encoder.writeGlobalColorTable();
  encoder.writeNetscapeLoopExtension();

  for (const frame of frames) {
    const indices = canvasToIndexedPixels(frame, alphaThreshold);
    encoder.writeGraphicControlExtension(delay);
    encoder.writeImageDescriptor();
    encoder.writeImageData(indices);
  }

  encoder.writeTrailer();
  const blob = new Blob([encoder.toUint8Array()], { type: "image/gif" });
  downloadBlob(blob, `etica-boil-transparent-${width}x${height}-${frames.length}f.gif`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canvasToIndexedPixels(canvas, alphaThreshold) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const indices = new Uint8Array(canvas.width * canvas.height);

  for (let source = 0, target = 0; source < data.length; source += 4, target += 1) {
    if (data[source + 3] < alphaThreshold) {
      indices[target] = 0;
      continue;
    }
    indices[target] = quantizeRgbToGifIndex(data[source], data[source + 1], data[source + 2]);
  }

  return indices;
}

function quantizeRgbToGifIndex(red, green, blue) {
  const r = Math.round((red / 255) * 5);
  const g = Math.round((green / 255) * 5);
  const b = Math.round((blue / 255) * 5);
  return 1 + r * 36 + g * 6 + b;
}

class GifEncoder {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.bytes = [];
  }

  writeHeader() {
    this.writeAscii("GIF89a");
  }

  writeLogicalScreenDescriptor() {
    this.writeShort(this.width);
    this.writeShort(this.height);
    this.writeByte(0xf7);
    this.writeByte(0);
    this.writeByte(0);
  }

  writeGlobalColorTable() {
    this.writeByte(0);
    this.writeByte(0);
    this.writeByte(0);

    for (let r = 0; r < 6; r += 1) {
      for (let g = 0; g < 6; g += 1) {
        for (let b = 0; b < 6; b += 1) {
          this.writeByte(Math.round((r / 5) * 255));
          this.writeByte(Math.round((g / 5) * 255));
          this.writeByte(Math.round((b / 5) * 255));
        }
      }
    }

    for (let index = 217; index < 256; index += 1) {
      this.writeByte(0);
      this.writeByte(0);
      this.writeByte(0);
    }
  }

  writeNetscapeLoopExtension() {
    this.writeByte(0x21);
    this.writeByte(0xff);
    this.writeByte(11);
    this.writeAscii("NETSCAPE2.0");
    this.writeByte(3);
    this.writeByte(1);
    this.writeShort(0);
    this.writeByte(0);
  }

  writeGraphicControlExtension(delay) {
    this.writeByte(0x21);
    this.writeByte(0xf9);
    this.writeByte(4);
    this.writeByte(0x09);
    this.writeShort(delay);
    this.writeByte(0);
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

  writeImageData(indices) {
    this.writeByte(8);
    const data = lzwEncode(indices, 8);
    for (let offset = 0; offset < data.length; offset += 255) {
      const block = data.subarray(offset, offset + 255);
      this.writeByte(block.length);
      for (const byte of block) this.writeByte(byte);
    }
    this.writeByte(0);
  }

  writeTrailer() {
    this.writeByte(0x3b);
  }

  toUint8Array() {
    return new Uint8Array(this.bytes);
  }

  writeAscii(text) {
    for (let index = 0; index < text.length; index += 1) {
      this.writeByte(text.charCodeAt(index));
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

function lzwEncode(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  const output = [];
  let bitBuffer = 0;
  let bitCount = 0;
  let codesSinceClear = 0;

  const writeCode = (code) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      output.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  writeCode(clearCode);

  for (const value of indices) {
    if (codesSinceClear >= 254) {
      writeCode(clearCode);
      codeSize = minCodeSize + 1;
      codesSinceClear = 0;
    }
    writeCode(value);
    codesSinceClear += 1;
  }

  writeCode(endCode);

  if (bitCount > 0) output.push(bitBuffer & 0xff);
  return new Uint8Array(output);
}
