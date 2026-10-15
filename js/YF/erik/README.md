# Erik

Desktop perspective crawl in Lunnen Display. Open `erik/` through the YF HTTP server. No build, external services or runtime dependencies.

- Optional outlined logo, defaulting to two lines: Lunnen / Airis. It fills both frame dimensions with overflow cropped, recedes upright at the same constant world speed as the ribbon. It starts closer to the camera; both elements use the same perspective projection. Its fade is distance-based and automatically finishes before the crawl reaches it, with a 24 px clearance at 1080p. The normal fade window (5.5–8.5 seconds at speed 120) moves earlier when the actual glyph geometry requires it. The logo-to-text gap is a spatial offset along their shared motion path: entry time is gap ÷ speed. The default gap is 360 (00:03:00 at speed 120); a gap of 240 restores 00:02:00. Removing the logo starts the crawl immediately.
- The supplied 14 credit lines are the default body. Default Lunnen Blue is `#2353DB`, matching Pizza Boxer. Manual line breaks and paragraphs are supported.
- Font size (32–120) and line spacing (0.8–3 × font size) are directly below the text editor. Logo → text gap (0–2400) is below the logo, with a live entry time. Weight, tracking, alignment and text measure are in Typography. All-line justification keeps the credit rows in a trapezoid.
- The ribbon’s lower corners are pinned to the frame’s lower corners at every tilt, perspective and text measure.
- Tilt, perspective and one shared constant speed for logo and crawl (10–400); duration includes the intro, final fade and a short empty tail. Defaults produce 1,181 frames (39.37 seconds).
- 1920 × 1080, 30 fps, no audio. MP4 uses H.264 with the chosen solid background. PNG frame and ZIP sequence always retain alpha.
- Play/pause (Space), frame steps (arrows), exact frame scrubbing, MP4 (Cmd/Ctrl+E).
- Undo/redo outside text inputs and a local draft at `upgrade:erik:draft:v1`. Draft schema v4 adds the gap setting, upgrades untouched v1 demo fields and corrects “graphical” to “graphic” in unchanged v2 default credits, while preserving authored fields.

## Implementation

`model.js` owns normalization, line wrapping, camera parameters, logo/crawl timeline and the frame plan. `renderer.js` uses the framework's font file, Canvas text shaping and mipmapped WebGL texture tiles. `render(settings, time)` is shared by preview and export. The renderer measures the rasterized logo and crawl ink once per layout, then analytically solves their projected separation to prepare the logo fade deadline. Gap, camera and typography edits invalidate this calculation; speed only retimes it. This also works with random seeking, leading blank lines and extreme logo proportions. If there is no safe lead-in, the logo is already hidden when the text enters. Preview is 1280 × 720; exported frames are 1920 × 1080.

`export-worker.js` renders exports off the UI thread. `exporter.js` owns worker lifetime, immediate cancellation and retry. `video.js` probes actual 1080p/30 H.264 support before encoding, applies encoder backpressure, and uses framework MP4 muxing. Sequence output uses the existing framework ZIP writer and zero-based padded filenames. Neither export changes the document or playback position.

Framework UI comes from the public barrel. `framework-export.js` is the documented worker adapter for the DOM-free `mp4Muxer` and `StoredZipWriter` modules; it avoids importing the UI dependency graph into a dedicated worker. Erik does not import another tool.

Browser requirements: WebGL, OffscreenCanvas, worker FontFace/FontFaceSet and Intl.Segmenter. MP4 additionally requires WebCodecs H.264 encoding, probed at runtime. When unavailable, PNG exports remain enabled. Serve over HTTPS or localhost.

Resource limits: title 200 characters, body 5000; text textures 192 MiB, compressed MP4 samples 256 MiB, ZIP 512 MiB. Limits show an error instead of producing an incomplete download.

## Verification

Run `npm run test:erik`. Open `erik/tests/browser.html` for actual browser artifact checks: deterministic frames, Fill coverage, shared logo/crawl speed, font size, gap and line spacing in preview/export, visible opening logo, simultaneous logo/crawl visibility without contact, geometry-edit invalidation, empty last frame, transparent alpha, worker/preview equality, Cyrillic, complete ZIP, cancellation/retry, and full MP4 decode/seek/dimensions/duration. Artifacts stay in the test page until explicitly downloaded. Browser results are recorded in `tests/acceptance.json`; `tests/preview.png` shows the four stages at 0, 1, 3.7 and 9 seconds. `tests/collision-preview.png` reproduces the reported contact configuration, showing the fade and the corrected 00:05:28 frame. Model tests cover 2,160 geometry combinations at three speeds, including zero gap and extreme glyph bounds; browser checks compare actual glyph alpha masks and worker output.

Repository-wide catalog checks currently also encounter unrelated existing issues: unregistered `grid_generator_02`, Wander Wall's encoded back-arrow differing from a literal-arrow assertion, and unversioned Sparky dependency edges. These sources were not changed for Erik.
