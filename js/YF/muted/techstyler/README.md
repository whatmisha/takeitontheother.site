# Techstyler — Textile Weave Generator

A web tool for building **single-layer** textile weaves. The structure is
represented as a binary repeat matrix:

- `1` — the **warp** thread passes over the weft (warp on the face);
- `0` — the **weft** thread passes over the warp (weft on the face).

Four families are supported: **plain**, **basket**, **twill** and **satin**.
Multi-layer, pile and leno weaves are not implemented in the first version.

The tool is built on the UI framework from `framework/` (copied into the root as
`css/`, `src/` and `fonts/` so the app is self-contained). The interface keeps
the same UI font as the framework (CoFo Sans). Fonts from `fonts/` (TT Commons
Classic, Lunnen Display) are used **only in the generated graphic** — for the
weave label inside the SVG.

## Run

ES modules require an HTTP server (`file://` blocks `import`):

```bash
npm run serve     # python3 -m http.server 8000
# open http://localhost:8000/
```

## Tests

All weave math is covered by unit tests (no dependencies, using `node:test`):

```bash
npm test          # node --test
```

## Architecture

Domain modules (`weave/`) are fully independent from the UI and DOM:

| Module | Purpose |
|--------|-----------|
| `PatternSpec.js` | Structural parameters: family, phase, groups, over/under, step, n and face side. Normalisation, repeat size and description. |
| `PatternGenerator.js` | Binary repeat generation for each family. UI-independent. |
| `PatternValidator.js` | Structural analysis (float length, balance, interlacement/loose threads) and spec validation. |
| `ThreadModel.js` | Matrix-to-model adapter with `warpOnTop(x, y)`. |
| `PatternRenderer.js` | SVG visualisation of the model. **Contains no weave formulas.** |
| `ProjectSerializer.js` | JSON project import/export (versioned format). |
| `mathUtils.js` | Positive `mod`, `gcd`, coprimality checks and cyclic run length. |
| `colorMath.js` | sRGB ↔ linear-RGB ↔ XYZ ↔ CIELAB, linear-light mixing and CIEDE2000 ΔE. |
| `ColorMixer.js` | Forward optical mix (`predictCloth`) and inverse yarn-pair search (`suggestPairs`). |

`tool.js` is the only place that connects the UI framework with the domain
modules.

### Formulas

- **Plain:** `matrix[y][x] = (x + y + phase) mod 2`
- **Basket:** `matrix[y][x] = (⌊x/warpGroup⌋ + ⌊y/weftGroup⌋ + phase) mod 2`
- **Twill:** a base row of `over` ones and `under` zeroes; each next row is
  cyclically shifted by `direction * step` (Z — right, S — left).
- **Satin:** on a square repeat of size `n`, one binding point is placed in each
  row and column: `x = (phase + y * step) mod n`, with `gcd(step, n) = 1`.
  Switches between warp-faced and weft-faced variants.

The code always uses a **correct positive modulo**.

### Color match

From a distance the eye averages the warp and weft surfaces, so a woven cloth
reads as a single optical colour. The **Color match** section inverts this:

1. Pick a **target colour** from the bundled catalogue (`palettes/yarn-catalog.json`,
   searchable by name, code or hex).
2. The tool searches catalogue yarn pairs and proposes the warp/weft combinations
   whose optical mix is closest to the target.

The mix is computed in **linear light** at the weave's own warp ratio
(`cloth ≈ mixLinear(warp, weft, warpRatio)`, gaps ignored), and match quality is
the **CIEDE2000 ΔE** between the prediction and the target. The **Yarn contrast**
slider biases suggestions from solid (identical yarns) through heather/mélange to
shot (high-contrast) effects. `Apply` sets the warp and weft colours. The
catalogue is an open, approximate palette and is **not** affiliated with or
derived from Pantone.

### Interface

Parameter panel · cell matrix editor (click to switch a crossing) · SVG preview
with zoom/pan · Draft/Threads switch · seamless repeat (X/Y tiling) · colour,
thread thickness and spacing controls · **colour matching** (target colour →
suggested warp/weft yarn pair) · history (Cmd/Ctrl+Z), presets, share links ·
**SVG / PNG / JSON** export.

### Extensibility

The renderer does not read the matrix directly; it talks to the `ThreadModel`
interface (`warpOnTop(x, y)`). This makes it possible to replace the binary
matrix later with a general **graph of threads and crossings** by implementing
the same interface, without changing `PatternRenderer`.
