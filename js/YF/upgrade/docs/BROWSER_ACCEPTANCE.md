# Browser acceptance

`qa/viewport.html` is a local-only test harness for deterministic responsive
checks. It embeds one Upgrade tool in an iframe with an explicit content
viewport and is not linked from the public hub or imported by any tool runtime.
`qa/file-intake.html`, `qa/pizza-file-intake.html`,
`qa/sparky-file-intake.html` and `qa/dither-file-intake.html` are same-origin
browser probes for FileIntake round-trips. They create in-memory `File` objects
or fetch checked-in Upgrade fixtures and do not open or write user files.

Example URLs:

- `../qa/viewport.html?tool=sparky&width=390&height=844`
- `../qa/viewport.html?tool=sparky&width=430&height=932`
- `../qa/viewport.html?tool=dither&width=1280&height=860`

Allowed `tool` values are the eight Upgrade directory names. Width and height
are clamped to safe finite ranges. All iframe sources remain relative and inside
`upgrade/`.

For Sparky, accept both mobile sizes only when the document and main stage fit
the iframe width without horizontal overflow, panels follow the mobile layout,
primary PNG/SVG ActionDock exports remain reachable, and desktop-only utility
actions and top navigation are hidden.

Accepted on 2026-09-02: at both 390×844 and 430×932, `html`, `body` and
`#mainSvg` equal the requested viewport with no horizontal overflow. The mobile
hint and primary export actions are visible; desktop panels, top links and
utility actions are hidden.

For Dither, the harness can reproduce the accepted 1280×860 layout, but a
screenshot is not a substitute for the required raw-RGBA comparison of the
579×600 Canvas. The harness reads same-origin `getImageData()` every 250 ms and
writes a hidden JSON record to `#qaCanvasHash`. Compare default, Bayer and Pixel
Size 4 against the preserved G6 prefixes `1b4c210c…`, `9f8f96ab…` and
`f93c0e2a…`.

Accepted on 2026-09-02 at 1280×860 with a 579×600 backing Canvas:

- default / Floyd–Steinberg / Pixel 1:
  `1b4c210c87d08f9b628d8f1fd8c146b3258544c82c1bef41822f4178abc7ff9e`;
- Bayer / Pixel 1:
  `9f8f96ab4f5f184a1e89f824a661ccd74c9794d135e7a56e52222d69083d4ce1`;
- Floyd–Steinberg / Pixel 4:
  `f93c0e2a0e8402df5182b479935ba7223dbc2d6212c21114061e12a8b3ef75df`.

For Wordplayer, `qa/file-intake.html` checks both FileIntake surfaces without
touching the filesystem. Accepted on 2026-09-02:

- invalid raster and SVG drops enter `error` and leave the Canvas unchanged;
- three repeated selections of the same raster reset the input each time and
  converge on `dd722b1dec1ef47c7e556b9987f030ce7f156618ae8648c585c0ad3be73ffe1b`;
- three repeated Forms SVG selections reset the input and converge on the same
  post-font Canvas hash; the initial late web-font raster paint is recorded but
  is not treated as an imported-geometry change;
- both surfaces expose `error → loading → ready` state transitions and no new
  browser errors.

For Pizza Boxer, `qa/pizza-file-intake.html` accepts the public 14-asset runtime:

- invalid JSON/SVG leaves the rendered SVG unchanged;
- three imports of `New.json` reset the input and retain exact SVG
  `4abbde0d74811c2d2997759ce0af21ac6d25321c8858a57cfafc2355e72240e4`
  and form-state
  `448f371864ee85e8301ca5ec022753fa0a7efb8e680db7221df430aa7a3c8349`;
- extension-only SVG with empty MIME is accepted three times, replaces one
  object instead of stacking copies and keeps one stable rendered SVG hash;
- picker/drop targets expose controls, descriptions and keyboard semantics.

For Sparky, `qa/sparky-file-intake.html` confirms that the existing 2 MB guard
rejects an oversized SVG before parsing, while an extension-only valid SVG
imports as `Imported · 5 points`, resets the input and leaves the trigger idle.
The 390×844 and 430×932 viewport records report one input/one controller and no
horizontal overflow.

For Dither, `qa/dither-file-intake.html` selects the checked-in source and
layout images three times each. All six runs reset the input and retain the
default raw-RGBA hash `1b4c210c…`; invalid text files enter `error` without
changing that hash. `viewport.html` additionally accepts `pattern` and
`pixelSize` query parameters and reproduces all three exact raster hashes above.

A live smoke of all six consumers confirms 14 inputs, paired status regions,
`aria-controls`, `aria-describedby`, `aria-live=polite` and idle triggers.

UPG-063 browser acceptance on 2026-09-02:

- Dither uses the shared `←Upgrade Tools` link and a centered ActionDock with
  zero horizontal overflow; its export radio segment is 36 px high and starts at 1×;
- Pizza Boxer, Keyboarder, Wordplayer, Pulsar Coder and Wander Bender expose
  button zoom indicators; Keyboarder and Wordplayer now have explicit fit labels;
- six preset consumers report `data-preset-keyboard-ready=true`; their rendered
  options receive roving programmatic focus and synchronized `aria-selected`;
- all checked entrypoints have an empty `data-module-error` state.
