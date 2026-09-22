# Pulsar v2 format

Pulsar v2 is a new, self-describing visual format. The decoder deliberately
does not support artwork made by the former encoder.

## Logical frame

The input string is encoded as strict UTF-8. Its payload frame is:

```text
[payload bytes] [CRC32: 32 bits]
```

The selected repetition code (`none`, `repeat2`, or `repeat3`) is applied to
that complete frame. Encoded bits are distributed round-robin over data rays
1 through N−1. Ray 0 carries the global header.

Every ray starts with a 10-bit identity prefix:

```text
[ray index: 5 bits] [bitwise inverse of ray index: 5 bits]
```

The inverted copy detects wrong orientation, false ray candidates, and most
prefix damage.

Ray 0 continues with a 47-bit global header:

| Field | Bits |
|---|---:|
| Magic (`0xD35`) | 12 |
| Version (`2`) | 4 |
| ECC mode | 2 |
| Ray count | 5 |
| UTF-8 payload byte length | 16 |
| Header CRC8 | 8 |

SVG metadata mirrors these fields for inspection, but decoding uses measured
tick lengths and the visual header rather than trusting the metadata.

## Visual grammar

- A `0` is a short transverse tick; a `1` is a long transverse tick.
- Long ticks must be at least 1.5 times the short-tick length.
- Each ray begins with three extra-long pilot ticks at lattice positions 0, 2,
  and 5. Data starts at lattice position 8.
- Visible radial axes are decorative. Exported axes use a lighter tone than
  the information ticks so raster preprocessing can remove them.
- The SVG contains explicit ray groups and bit order, but never stores bit
  values as metadata.

## Decoding

### SVG

The importer reads v2 ray groups, orders ticks by their bit index, measures
their geometric length, reconstructs each ray, then validates the header,
UTF-8 payload, and CRC32.

### Raster

The importer composites transparency onto white and separates background,
decorative axes, and information ticks by tone. With hidden axes, each tick is
an isolated connected component. Its principal direction supplies a line
constraint for the invisible convergence point; many such constraints recover
the center by robust least squares. Midpoints are then grouped by polar angle.

The three pilot ticks recover the longitudinal step and the first data slot.
The 10-bit ray prefix recovers ray order. Short/long classification, global
header parsing, ECC decoding, strict UTF-8, and CRC32 complete the validation.

## Moved center with hidden axes

This case is feasible and supported. The convergence point is inferred from
the orientation and midpoint of the transverse ticks, so it does not need to
be drawn or remain at the canvas center. Pilot ticks recover spacing and start
position; ray prefixes recover ordering.

The guarantee applies to clean exports from Pulsar v2 at a resolution where
short and long ticks remain distinguishable. Heavy perspective distortion,
cropping, severe blur, or aggressive JPEG compression can erase required
geometry and are reported as decode failures rather than guessed data.

## Implementation

- `js/codec/PulsarCodec.js`: framing, ECC, CRC, ray distribution.
- `js/geometry/PulsarGeometry.js`: deterministic geometry and SVG output.
- `js/decode/PulsarSvgDecoder.js`: vector importer.
- `js/decode/PulsarRasterDecoder.js`: raster segmentation and reconstruction.
- `tests/codec.test.mjs` and `tests/decode.test.mjs`: round-trip and corruption
  coverage, including moved-center, hidden-axis raster input.
