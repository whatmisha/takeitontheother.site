# Pulsar Coder v2

Pulsar Coder turns UTF-8 text into a Voyager-inspired radial code and decodes
its own SVG and raster exports.

Version 2 is a clean format break. Images produced by the earlier encoder are
outside the decoder's scope and are rejected rather than decoded heuristically.

## Use

1. Open `index.html` through a local web server.
2. Type a message; the graphic updates automatically.
3. Optionally change ray count, average length, length variation, spacing, ECC,
   or hide the radial axes.
4. Drag the canvas to move the convergence point.
5. Export SVG, copy its source, or export a high-resolution transparent PNG.
6. Use **Decode file**, or drop a Pulsar v2 SVG/PNG/JPEG/WebP/BMP on the canvas.

**Verify** checks the current in-memory encoding. Imported files are decoded
from their geometry and validated independently.

## What makes v2 decodable

- Every ray contains a checksummed visual index.
- Ray 0 contains version, ECC, ray count, byte length, and a header checksum.
- Three pilot ticks on every ray recover spacing without visible ray lines.
- Longitudinal spacing and decorative tail length vary deterministically by ray.
- Short and long ticks encode zero and one.
- Payload CRC32 prevents plausible-looking corrupted output.
- SVG metadata is informative only; it is not the source of decoded bits.

The moved-center plus hidden-ray case is supported. For raster input, the
decoder estimates the invisible center from transverse-tick orientations,
groups ticks by polar angle, and uses pilot spacing and ray prefixes to rebuild
the stream.

See [FORMAT_V2.md](FORMAT_V2.md) for the binary layout, visual grammar,
algorithm, and practical image-quality limits.

## Tests

From `upgrade/`:

```bash
npm run test:pulsar
```

Coverage includes Unicode, all ECC modes, checksum failures, SVG with visible
and hidden axes, preserved marks after moving the center, and raster decoding
with the center moved and axes hidden.
