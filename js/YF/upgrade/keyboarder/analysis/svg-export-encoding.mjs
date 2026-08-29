import assert from 'node:assert/strict';
import { svgDocumentString } from '../vendor/framework/src/export/SVGExporter.js';

const source = '<svg xmlns="http://www.w3.org/2000/svg"><text>Ё й →</text></svg>';
const encoded = svgDocumentString(source);

assert.match(encoded, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n/);
assert.equal(/[^\x00-\x7F]/u.test(encoded), false, 'export should stay ASCII-safe for strict SVG previewers');
assert.match(encoded, /<text>&#x401; &#x439; &#x2192;<\/text>/);

console.log('SVG UTF-8 export encoding passed');
