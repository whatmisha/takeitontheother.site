# Pulsar Coder

**Voyager/Pioneer-style pulsar map encoder for arbitrary data**

Transform any text into a beautiful, scientifically-inspired radial visualization reminiscent of the Golden Record's pulsar map.

---

## 🌟 Features

### Encoding
- **UTF-8 Support**: Encode any text, including emojis and Unicode characters
- **Robust Framing**: Automatic preamble, length field, and CRC32 checksum
- **Error Correction**: Built-in repetition codes (2x/3x) for resilience
- **Deterministic**: Same input + parameters = identical output

### Visual
- **Voyager Aesthetic**: Clean, black-and-white line graphics
- **Customizable Rays**: 8-24 rays with adjustable length, spacing, and rotation
- **Two Encoding Modes**:
  - **Tick Length**: 0 = short tick, 1 = long tick
  - **Gap/Solid**: 0 = gap, 1 = tick (like Morse code)
- **Reference Ray**: Highlighted ray for orientation
- **Calibrator Scale**: Built-in scale marker for reference

### Export
- **Pure SVG**: Vector graphics with viewBox, perfect for print/Figma/Illustrator
- **Metadata Embedded**: SVG includes codec version, parameters, CRC
- **One-Click Export**: Download or copy to clipboard

### Verification
- **Built-in Decoder**: Verify message integrity with CRC checking
- **Error Detection**: Preamble validation and checksum verification

---

## 🚀 Quick Start

1. **Open** `index.html` in your browser
2. **Enter** your message in the payload field
3. **Click** "Generate" to create your pulsar map
4. **Adjust** parameters with sliders and controls
5. **Download** SVG or copy to clipboard

---

## 🎚️ Parameters

### Payload
- Any UTF-8 text (ASCII, Unicode, emojis supported)
- Character count displayed below input

### Ray Parameters
- **Ray Count** (8-24): Number of radial spokes
- **Ray Length** (200-500px): Base length of each ray
- **Bit Step** (4-16px): Distance between bit markers
- **Rotation** (0-360°): Rotate entire pattern

### Encoding
- **Bit Mode**:
  - `Tick Length`: Variable length ticks (0=short, 1=long)
  - `Gap/Solid`: Presence/absence (0=gap, 1=tick)
- **Tick Short/Long** (2-20px): Size of tick marks
- **ECC Mode**:
  - `No ECC`: Raw data
  - `2x`: Each bit repeated twice
  - `3x`: Each bit repeated three times

### Visual Style
- **Stroke Width** (0.5-4px): Line thickness
- **Center Radius** (4-30px): Size of central marker
- **Background**: Transparent, White, or Black
- **Show Calibrator**: Display scale reference
- **Highlight Reference Ray**: Emphasize 0° ray

### Advanced
- **Seed**: String seed for deterministic random angles
- **Random Angles**: Enable/disable uniform vs. random distribution
- **Margin** (20-100px): Gap between center and first bit
- **Preamble Length** (8-32 bits): Sync pattern length

---

## 🔬 Technical Details

### Binary Structure

```
[PREAMBLE] [LENGTH] [PAYLOAD] [CRC32]
    |         |         |         |
  16-32b     16b       n bits    32b
```

1. **Preamble**: Alternating `1010...` pattern for synchronization
2. **Length**: 16-bit unsigned integer (payload bit count)
3. **Payload**: UTF-8 encoded message as bit stream
4. **CRC32**: IEEE 802.3 polynomial checksum

### Error Correction

**Repetition Codes** (simple but effective):
- `2x`: Each bit repeated twice → 50% redundancy
- `3x`: Each bit repeated thrice → 66% redundancy
- Decoding: Majority voting

### Ray Distribution

Bits are distributed **round-robin** across rays:
```
Bit 0 → Ray 0
Bit 1 → Ray 1
...
Bit N → Ray (N mod rayCount)
```

This ensures even distribution and natural read pattern (spiral outward).

### Angles

- **Uniform**: `angle[i] = (360° / rayCount) × i`
- **Random**: Seeded PRNG with minimum separation constraint

---

## 🎨 Presets

| Preset | Rays | Style | Use Case |
|--------|------|-------|----------|
| **Voyager 14** | 14 | Classic | Authentic retro-futurism |
| **Dense 20** | 20 | Compact | Maximum data density |
| **Minimal 8** | 8 | Bold | Clean, readable design |
| **Accurate 16** | 16 | Random angles | Unique layouts |

---

## 🔐 Verification

Click **"Verify"** to decode and validate your pulsar map:

✅ **Success**: Message decoded, CRC matches
- Shows original payload
- Displays CRC32 checksum
- Confirms preamble validity

❌ **Failure**: Data corrupted or parameters mismatch
- Indicates CRC mismatch
- May show partially decoded message

---

## 📦 Export Formats

### SVG Features
- **viewBox**: `0 0 1000 1000` (scalable)
- **Embedded metadata**: `data-*` attributes
  - `data-codec="pulsar-v1"`
  - `data-ray-count`
  - `data-ecc`
  - `data-crc`
  - `data-payload-len`
  - `data-seed`
- **Clean structure**: All geometry in `<g id="pulsar-code">`
- **No raster**: Pure vector graphics

### Usage
- **Download SVG**: Save to file
- **Copy SVG**: Clipboard (paste into Figma/Illustrator)
- Opens directly in browsers, Inkscape, Adobe Illustrator

---

## 🧪 Examples

### Hello World
```
Payload: "Hello, World!"
Rays: 14
ECC: None
Output: ~150 bits → 14 rays × ~11 bits each
```

### With Emoji
```
Payload: "🚀 Mars 2030"
Rays: 16
ECC: 2x
Output: ~300 bits (UTF-8 multibyte + repetition)
```

### Dense Message
```
Payload: "The quick brown fox jumps over the lazy dog"
Rays: 20
ECC: 3x
Output: ~1200 bits (long message + triple redundancy)
```

---

## 🎯 Use Cases

- **Generative Art**: Beautiful, data-driven graphics
- **Personal Messages**: Encode quotes, coordinates, dates
- **Branding**: Unique visual identifiers from company names
- **Education**: Learn about binary encoding and error correction
- **Laser Engraving**: Export SVG for physical fabrication

---

## ⚙️ Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6 modules required
- No external dependencies

---

## 📝 Technical Notes

### Performance
- Encoding: O(n) where n = message length
- Ray generation: O(r × b) where r = rays, b = bits per ray
- SVG generation: O(total bits)

### Limitations
- Maximum practical message: ~500 characters (depends on ray count)
- Very long messages → long rays (may exceed viewBox)
- Random angles may cluster with weak seeds

### Tips
- Use **2x ECC** for moderate redundancy without bloat
- **Dense 20** preset for long messages
- **Black background** for screen display, **White** for print
- **Seed** should be unique per project for consistent random angles

---

## 🛠️ Customization

All parameters are exposed in UI. For advanced customization:

1. Edit `pulsar-main.js`:
   - Modify `addFraming()` for custom frame structure
   - Change `applyECC()` for different error correction
   - Adjust `buildSvg()` for visual tweaks

2. Edit `pulsar-styles.css`:
   - Customize colors, spacing, animations

3. Fork and extend:
   - Add Hamming codes
   - Implement QR-style finder patterns
   - Create animated SVG variants

---

## 📜 License

Part of **YF Tools** framework. Use freely for personal and commercial projects.

---

## 🌌 Inspiration

Inspired by the **Voyager Golden Record** pulsar map (1977), designed by Frank Drake and Carl Sagan. The map encodes positions of 14 pulsars relative to our Sun, allowing extraterrestrial civilizations to locate Earth.

This project reimagines that iconic visualization as a general-purpose data encoder.

---

**Made with ❤️ for the cosmos**



