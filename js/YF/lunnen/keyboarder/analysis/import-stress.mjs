import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeSvgBlueprint } from '../app/kb/svg-blueprint.js';

const BASE = readFileSync('reference/lcakb23/LCAKB23.svg', 'utf8');
const WORKER_CANDIDATE_MS = 250;

const scenarios = [
    { id: 'base', paths: 0, cubicPaths: 0, diagonalLines: 0, metadataKb: 0 },
    { id: 'path-heavy', paths: 8000, cubicPaths: 1000, diagonalLines: 0, metadataKb: 256 },
    { id: 'line-heavy', paths: 0, cubicPaths: 0, diagonalLines: 6000, metadataKb: 256 },
    { id: 'mixed-heavy', paths: 4000, cubicPaths: 500, diagonalLines: 2500, metadataKb: 512 }
];

const rows = [];

for (const scenario of scenarios) {
    const svg = stressSvg(BASE, scenario);
    const analysis = analyzeSvgBlueprint(svg);
    assert.equal(analysis.groups.blueprint, true, `${scenario.id}: blueprint group`);
    assert.equal(analysis.groups.caps, true, `${scenario.id}: caps group`);
    assert.equal(analysis.recognized.keys.length, 110, `${scenario.id}: key count`);
    assert.equal(analysis.diagnostics.warnings.length, 0, `${scenario.id}: warnings`);
    assert.equal(analysis.layoutDraft.stats.keys, 110, `${scenario.id}: draft keys`);
    rows.push({
        scenario: scenario.id,
        kb: Math.round(svg.length / 102.4) / 10,
        lines: analysis.elements.lines,
        paths: analysis.elements.paths,
        totalMs: analysis.timings.totalMs,
        parseLinesMs: analysis.timings.parseLinesMs,
        pathArcsMs: analysis.timings.pathArcsMs,
        detectMs: analysis.timings.detectMs,
        draftMs: analysis.timings.draftMs
    });
}

printRows(rows);

const worst = rows.reduce((best, row) => row.totalMs > best.totalMs ? row : best, rows[0]);
console.log(`\nworker threshold ${WORKER_CANDIDATE_MS} ms: ${worst.totalMs >= WORKER_CANDIDATE_MS ? 'candidate' : 'not needed for this stress set'} (worst ${worst.scenario}, ${worst.totalMs} ms)`);
console.log('SVG import stress passed');

function stressSvg(svg, scenario) {
    const withMetadata = scenario.metadataKb
        ? injectAfterSvgOpen(svg, illustratorMetadata(scenario.metadataKb))
        : svg;
    return injectIntoGroup(withMetadata, 'blueprint', [
        noisePaths(scenario.paths),
        noiseCubicPaths(scenario.cubicPaths),
        noiseDiagonalLines(scenario.diagonalLines)
    ].join('\n'));
}

function injectAfterSvgOpen(svg, payload) {
    return String(svg).replace(/(<svg\b[^>]*>)/i, `$1\n${payload}`);
}

function injectIntoGroup(svg, id, payload) {
    if (!payload.trim()) return svg;
    const source = String(svg);
    const group = extractGroup(source, id);
    if (!group) throw new Error(`Group "${id}" not found`);
    const close = group.lastIndexOf('</g>');
    if (close < 0) throw new Error(`Group "${id}" has no closing tag`);
    const next = `${group.slice(0, close)}\n${payload}\n${group.slice(close)}`;
    return source.replace(group, next);
}

function extractGroup(svg, id) {
    const tagRe = /<\/?g\b[^>]*>/gi;
    let m;
    while ((m = tagRe.exec(svg))) {
        const tag = m[0];
        if (/^<\//.test(tag) || !new RegExp(`\\bid=["']${id}["']`).test(tag)) continue;
        const start = m.index;
        let depth = /\/\s*>$/.test(tag) ? 0 : 1;
        if (depth === 0) return tag;
        while ((m = tagRe.exec(svg))) {
            const next = m[0];
            if (/^<\//.test(next)) {
                depth -= 1;
                if (depth === 0) return svg.slice(start, tagRe.lastIndex);
            } else if (!/\/\s*>$/.test(next)) {
                depth += 1;
            }
        }
        return svg.slice(start);
    }
    return '';
}

function illustratorMetadata(kb) {
    const chunk = 'AI_PRIVATE_DATA_'.repeat(Math.ceil((kb * 1024) / 16)).slice(0, kb * 1024);
    return `<metadata><i:aipgf>${chunk}</i:aipgf></metadata>`;
}

function noisePaths(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
        const x = 1400 + (i % 200);
        const y = 900 + Math.floor(i / 200);
        out.push(`<path data-noise="p${i}" d="M${x} ${y} L${x + 2} ${y + 1} L${x + 3} ${y + 3}"/>`);
    }
    return out.join('\n');
}

function noiseCubicPaths(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
        const x = 1700 + (i % 120);
        const y = 1000 + Math.floor(i / 120);
        out.push(`<path data-noise="c${i}" d="M${x} ${y} c0.01 0.01 0.02 0.02 0.03 0.03"/>`);
    }
    return out.join('\n');
}

function noiseDiagonalLines(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
        const x = 1900 + (i % 240);
        const y = 1200 + Math.floor(i / 240);
        out.push(`<line data-noise="l${i}" x1="${x}" y1="${y}" x2="${x + 3}" y2="${y + 2}"/>`);
    }
    return out.join('\n');
}

function printRows(items) {
    const headers = ['scenario', 'kb', 'lines', 'paths', 'totalMs', 'parseLinesMs', 'pathArcsMs', 'detectMs', 'draftMs'];
    const widths = Object.fromEntries(headers.map((header) => [
        header,
        Math.max(header.length, ...items.map((row) => String(row[header]).length))
    ]));
    console.log(headers.map((header) => header.padEnd(widths[header])).join('  '));
    console.log(headers.map((header) => '-'.repeat(widths[header])).join('  '));
    for (const row of items) {
        console.log(headers.map((header) => String(row[header]).padEnd(widths[header])).join('  '));
    }
}
