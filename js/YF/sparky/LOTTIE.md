# Lottie export

Select **Path** or **Bolid**, then **Lottie** in the export toolbar. The button
exports the current settings and authored/imported trajectory as
`<export-name>-lottie.json`. It shares export progress, cancellation and error
handling with MP4 and PNG ZIP.

The output contains vector shapes, solid fills, transforms and an animated
additive mask. It has a transparent background and retains the configured eye
color. Path deformation, eye inertia, blinks, expressions and the Bolid head
and eye color trails are included. Motion blur is intentionally omitted; the
button tooltip and accessible label state this. No cursor interaction is stored.

The composition uses the existing 1080 × 1080 / 60 fps profile and current loop
duration (1–10 seconds). All paths have stable vertex ordering. Circular corners
are approximated with three cubic segments; smoothed corners and eye curves use
the existing cubic construction. Linear keyframes are reduced with a 0.015-unit
per-coordinate tolerance in the 480-unit source artboard, rounded to 0.001 units.
An endpoint at `op` matches frame zero without adding a duplicate visible frame.

The exporter runs in the existing module worker. It needs neither Canvas,
WebCodecs, a server-side converter, nor a runtime dependency on lottie-web. Lottie
and raster export share timeline generation and eye-motion warmup. Animated
contours can still produce multi-megabyte JSON files, especially with color
trails; serve them with HTTP compression when embedding them on a website.

## Verification

Run `npm run test:sparky` from `js/YF`. The Lottie tests cover stable topology,
SVG eye-curve parity, keyframe error bounds, loops, imported paths, input
validation and the real worker with Canvas and WebCodecs disabled.

For browser verification, serve `js/YF`, open
`sparky/tests/lottie-browser.html`, and click **Run checks**. This test page loads
lottie-web 5.13.0 from unpkg. With a local player already loaded, the same check
can be run from the console:

```js
const { runLottieVisualChecks } = await import('./lottieBrowser.js');
await runLottieVisualChecks(window.lottie);
```

The fixture compares eight sampled frames per case against the existing Canvas
renderer in both SVG and Canvas Lottie players: Path with expressions/blinks,
Bolid with colored head/eye trails, 13-ray circular corners, and a sharp shape
with an imported trajectory. It checks transparency and returns to frame zero.
It fails above 1% mismatched pixels (channel difference >32/255) or a mean
premultiplied channel error above 1/255. Native mobile players have not been
verified.
