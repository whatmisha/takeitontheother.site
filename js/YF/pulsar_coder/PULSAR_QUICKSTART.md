# 🚀 Pulsar Coder - Quick Start

## Instant Launch

### Option 1: Local Server (Recommended)

```bash
cd pulsar_coder
python3 -m http.server 8080
```

Then open: **http://localhost:8080/index.html**

### Option 2: Direct Open

Open `index.html` directly in browser (some browsers may block ES6 modules from `file://` protocol)

---

## First Use (60 seconds)

1. **Enter your message** in the "Payload" field
   - Default: "Hello, Universe! 🌌"
   - Try: Your name, coordinates, secret message

2. **Click "Generate"**
   - Watch the pulsar map render in real-time

3. **Explore presets** (dropdown at top)
   - **Voyager 14**: Classic Voyager Golden Record style
   - **Dense 20**: Maximum data density
   - **Minimal 8**: Clean and bold

4. **Adjust parameters** with sliders
   - Ray Count, Length, Step
   - Tick sizes
   - Visual style

5. **Export your creation**
   - **Download SVG**: Save to file
   - **Copy SVG**: Clipboard → paste in Figma/Illustrator
   - **Verify**: Check encoding integrity

---

## Key Controls

| Control | Action |
|---------|--------|
| **Generate** | Re-encode and render |
| **Download SVG** | Save to file |
| **Copy SVG** | Copy to clipboard |
| **Verify** | Decode and check CRC |

---

## Quick Tips

- **More rays** = more data capacity, denser pattern
- **Longer rays** = easier to read visually
- **ECC 2x** = good balance of redundancy vs. size
- **Reference ray** (at 0°) helps orientation
- **Black background** for screens, **White** for print

---

## Example Workflows

### 1. Encode Personal Coordinates
```
Payload: "40.7128° N, 74.0060° W"
Preset: Voyager 14
ECC: 2x
Export: Download SVG
```

### 2. Create Generative Art
```
Payload: "Your favorite quote"
Preset: Dense 20
Random Angles: ON
Rotation: Adjust until perfect
Export: Copy to Figma
```

### 3. Encode Secret Message
```
Payload: Your message
ECC: 3x (triple redundancy)
Verify: Check integrity
Export: Download for sharing
```

---

## Troubleshooting

**Q: "Module not found" error**
- A: Run local server (ES6 modules require HTTP)

**Q: SVG looks pixelated**
- A: It's vector! Zoom in or increase viewBox size

**Q: Message too long**
- A: Increase ray count (20-24) or reduce ECC

**Q: Verification fails**
- A: Ensure parameters match encoding (ray count, ECC)

---

## Next Steps

- Read **PULSAR_README.md** for full documentation
- Explore **Advanced** section for custom parameters
- Experiment with **Random Angles** and **Seeds**
- Try different **Bit Modes** (Tick Length vs Gap/Solid)

---

**Have fun encoding! 🌌**







