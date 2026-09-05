# UI Garage

UI Garage is a self-contained foundation for static SVG and Canvas graphics
tools. Runtime source, CSS, fonts, vendor libraries, licenses, tests and the
Component Lab are local to this folder.

Current version: `0.1.0-dev.1`. It is an extraction candidate, not a `1.0.0`
release.

Requirements:

- browser runtime: static same-origin HTTP hosting, no bundler;
- verification only: Node.js 24 or a compatible maintained version;
- no package installation is required for the current test suite.

Run from this directory:

```sh
npm test
npm run verify
```

Read `START_HERE.md` before creating an application and `CONTRACT.md` before
extending the public API.
