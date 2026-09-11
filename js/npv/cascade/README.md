# Cascade

Standalone parametric selection-cascade generator built on Othersite UI Framework v3.

- Linear reproduces the 32→16→8→4→2→1 reference logic.
- Radial maps stages to concentric rings; Spiral is radial twist.
- Fan bends the same cascade toward a result point.
- When Finalists is 1, a terminal empty stage follows it so the composition reads 32→16→8→4→2→1→0.
- Animation changes the active generation discretely on every beat, plays 32→0→32, and holds both endpoints for one extra beat.
- Static SVG/PNG and animated H.264 MP4/transparent PNG-sequence export are supported.

Serve the repository root and open `/cascade/`.
