# Pulsar Coder - Examples

## Example 1: Voyager Tribute

**Message**: `"Voyager 1977 Golden Record"`

**Parameters**:
```
Preset: Voyager 14
Ray Count: 14
Bit Step: 8px
ECC: None
Background: Transparent
```

**Result**: Classic 14-ray pulsar map, authentic retro-futurism aesthetic

**Use case**: Tribute to the original Voyager mission, educational display

---

## Example 2: Coordinates Encoding

**Message**: `"40.7128°N 74.0060°W"` (New York City)

**Parameters**:
```
Preset: Accurate 16
Ray Count: 16
Random Angles: Yes
ECC: 2x (double redundancy)
Seed: "nyc-coordinates"
```

**Result**: Unique radial pattern encoding geographic location with error correction

**Use case**: Encode personal locations, waypoints, geocaching clues

---

## Example 3: Emoji Art

**Message**: `"🚀🌍🌙⭐🌌"` (Space emojis)

**Parameters**:
```
Preset: Dense 20
Ray Count: 20
Bit Step: 6px
ECC: None
Tick Long: 10px
Background: Black
```

**Result**: Dense, intricate pattern from UTF-8 multibyte encoding

**Use case**: Generative art from emoji sequences, visual exploration of Unicode

---

## Example 4: Secret Message

**Message**: `"Meet at midnight. Code 42."`

**Parameters**:
```
Preset: Minimal 8
Ray Count: 8
ECC: 3x (triple redundancy)
Stroke Width: 2px
Rotation: 45°
```

**Result**: Bold, error-resistant encoding with rotated orientation

**Use case**: Hidden messages, cryptographic art, steganography base

---

## Example 5: Quote Encoding

**Message**: 
```
"The cosmos is within us. 
We are made of star-stuff. 
We are a way for the universe to know itself." 
― Carl Sagan
```

**Parameters**:
```
Preset: Dense 20
Ray Count: 24 (maximum)
Bit Step: 5px
Ray Length: 480px
ECC: 2x
Background: White (for print)
```

**Result**: Complex, high-density pattern suitable for large-format printing

**Use case**: Inspirational posters, wall art, book covers

---

## Example 6: Date Encoding

**Message**: `"2030.01.01 Mars Landing"` (Future mission)

**Parameters**:
```
Preset: Voyager 14
Ray Count: 14
Random Angles: No
Reference Ray: Yes
Calibrator: Yes
```

**Result**: Clean, symmetric pattern with reference markers

**Use case**: Commemorative graphics, timeline visualizations, mission patches

---

## Example 7: Minimal Identity

**Message**: `"YF"` (Brand initials)

**Parameters**:
```
Preset: Minimal 8
Ray Count: 8
Bit Step: 12px
Tick Short: 6px
Tick Long: 12px
Center Radius: 15px
Stroke Width: 3px
```

**Result**: Bold, highly readable pattern, perfect for logos

**Use case**: Brand identity, logos, personal marks

---

## Example 8: Random Exploration

**Message**: `"Randomize!"` (Any text)

**Parameters**:
```
Click: "Randomize All" button
Random Angles: Yes
Rotation: Random
Seed: Random
```

**Result**: Unique pattern every click, never repeats

**Use case**: Exploration, discovering interesting layouts, generative design

---

## Example 9: Maximum Redundancy

**Message**: `"SOS"` (Emergency)

**Parameters**:
```
Preset: Accurate 16
Ray Count: 16
ECC: 3x (triple redundancy)
Tick Long: 15px
Stroke Width: 2.5px
Background: Black
Show Calibrator: No
```

**Result**: High-contrast, maximum error correction, bold visibility

**Use case**: Critical messages, error-prone transmission, resilience testing

---

## Example 10: Laser Engraving

**Message**: `"Made with Pulsar Coder 2025"`

**Parameters**:
```
Preset: Dense 20
Ray Count: 20
Background: Transparent
Stroke Width: 1px (thin for precision)
Bit Step: 7px
Tick Short: 3px
Tick Long: 6px
```

**Result**: Clean vector paths, optimized for CNC/laser cutting

**Use case**: Physical fabrication, jewelry, medallions, plaques

**Export**: Download SVG → import to LaserWeb, LightBurn, or similar

---

## Testing Workflow

### Quick Test
1. Open `index.html`
2. Enter: `"Test 123"`
3. Click "Generate"
4. Click "Verify" → should show ✓ Success

### Full Round-Trip Test
1. Enter any message
2. Generate with specific parameters
3. Click "Verify"
4. Check: 
   - Preamble valid ✓
   - CRC match ✓
   - Decoded message matches input ✓

### Error Resilience Test
1. Generate with `ECC: 3x`
2. Verify → should succeed
3. Manually corrupt 1-2 bits (conceptually)
4. Majority voting should recover original

---

## Parameter Combinations

### Best for Reading
```
Ray Count: 8-10
Bit Step: 10-12px
Tick sizes: Large (8-12px)
Stroke: 2px+
```

### Best for Data Density
```
Ray Count: 20-24
Bit Step: 5-6px
Tick sizes: Small (3-6px)
Stroke: 1-1.5px
ECC: None
```

### Best for Art
```
Random Angles: Yes
Unique seed per generation
Rotation: Experiment
Background: Black or Transparent
```

### Best for Printing
```
Background: White
Stroke: 1.5-2px
High contrast
Calibrator: Yes (for scale reference)
```

---

## Advanced Tricks

### Deterministic Art Series
```
Seed: "series-001", "series-002", ...
Keep all other params same
Generate unique but related patterns
```

### Hidden Orientation
```
Rotation: 0°
Reference Ray: Yes
Known orientation for decoding
```

### Maximum Capacity
```
Ray Count: 24
Ray Length: 500px
Bit Step: 4px
ECC: None
≈ 3000 bits capacity
```

### Color Inversion
```
Generate with Background: White
Open SVG in editor
Invert: White → Black, Black → White
Creates "negative" style
```

---

## Export Tips

### For Web
- Format: SVG
- Background: Transparent
- Embed in HTML with `<img>` or inline `<svg>`

### For Print
- Format: SVG
- Background: White
- Open in Illustrator/Inkscape
- Set page size, add crop marks
- Export PDF for professional printing

### For Laser
- Format: SVG
- Background: Transparent
- Stroke Width: 0.1-0.5mm (check machine specs)
- Remove fill colors (strokes only)
- Import to LaserWeb/LightBurn

### For Figma/Illustrator
- Click "Copy SVG"
- Paste directly into canvas
- Scales infinitely (vector)
- Edit paths, colors, effects

---

**Experiment and create! The cosmos awaits your message. 🌌**






