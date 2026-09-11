# Cascade

Standalone parametric selection-cascade generator built on Othersite UI Framework v3.

- Linear reproduces the 32→16→8→4→2→1 reference logic.
- Radial maps stages to concentric rings; Spiral is radial twist.
- Fan bends the same cascade toward a result point.
- Sierpinski is a separate flat mode: a downward recursive gasket whose depth follows Candidates → Finalists.
- Sphere wraps either flat pattern through longitude and latitude with XYZ rotation, perspective, guides, and an optional low-opacity back side. It intentionally has no Magnet.
- When Finalists is 1, a terminal empty stage follows it so the composition reads 32→16→8→4→2→1→0.
- Animation changes the active generation discretely on every beat, plays 32→0→32, and holds both endpoints for one extra beat.
- Static SVG/PNG and animated H.264 MP4/transparent PNG-sequence export are supported.

Serve the repository root and open `/cascade/`.
