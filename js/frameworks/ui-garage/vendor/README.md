# Shared local vendor libraries

This directory contains browser-ready dependencies used by UI Garage. Runtime
code must load them from this folder rather than from a CDN.

Bundled libraries:

- jsPDF;
- svg2pdf;
- OpenType;
- Paper.js.

Each dependency must have a version, source file hash, license reference and explicit consumers before it is activated.
