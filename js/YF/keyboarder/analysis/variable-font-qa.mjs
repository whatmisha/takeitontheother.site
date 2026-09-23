#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NODE = process.execPath;

const CHECKS = [
    ['Syntax: variation engine', ['--check', 'app/kb/variations.js']],
    ['Syntax: typeface wrapper', ['--check', 'app/kb/typography.js']],
    ['Syntax: app tool', ['--check', 'app/tool.js']],
    ['Syntax: export renderer', ['--check', 'analysis/render-import-export.mjs']],
    ['Syntax: export regression', ['--check', 'analysis/export-variable-font-regression.mjs']],
    ['Syntax: browser smoke', ['--check', 'analysis/browser-variable-font-smoke.mjs']],
    ['Syntax: function drag smoke', ['--check', 'analysis/browser-function-drag-smoke.mjs']],
    ['Font probe invariants', ['analysis/fontprobe.mjs']],
    ['FontTools oracle comparison', ['analysis/verify-variable-font.mjs']],
    ['Outlined SVG export regression', ['analysis/export-variable-font-regression.mjs']]
];

for (const [label, args] of CHECKS) {
    console.log(`\n== ${label}`);
    execFileSync(NODE, args, {
        cwd: ROOT,
        stdio: 'inherit',
        maxBuffer: 64 * 1024 * 1024
    });
}

console.log('\nvariable font QA passed');
