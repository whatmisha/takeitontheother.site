#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const MM_PER_PT = 25.4 / 72;
const PT_PER_MM = 72 / 25.4;

export const EXPORT_QA_PRESETS = {
    lcakb23: {
        mm: [412.462, 115.954],
        caps: 110,
        guides: 0,
        glyphPaths: 176,
        glyphTexts: 0,
        icons: 15,
        fIcons: 13,
        selection: 0,
        interactive: 0
    },
    ansiCompact78: {
        mm: [275.887, 114.862],
        caps: 78,
        guides: 0,
        glyphPaths: 138,
        glyphTexts: 0,
        icons: 0,
        fIcons: 13,
        selection: 0,
        interactive: 0
    },
    ansiNav89: {
        mm: [334.504, 114.855],
        caps: 89,
        guides: 0,
        glyphPaths: 149,
        glyphTexts: 0,
        icons: 0,
        fIcons: 13,
        selection: 0,
        interactive: 0
    }
};

const EXPORT_QA_PRESET_FLAGS = {
    '--lcakb23': 'lcakb23',
    '--ansi-compact-78': 'ansiCompact78',
    '--ansiCompact78': 'ansiCompact78',
    '--ansi-nav-89': 'ansiNav89',
    '--ansiNav89': 'ansiNav89'
};

if (isCliEntrypoint()) {
    const ok = runCli(process.argv.slice(2));
    if (!ok) process.exit(process.exitCode || 1);
}

export function runCli(argv = process.argv.slice(2)) {
    const args = parseArgs(argv);
    if (!args.file) {
        console.error('Usage: node analysis/export-artifact-qa.mjs <export.svg|export.pdf> [--lcakb23|--ansi-compact-78|--ansi-nav-89] [--mm WxH] [--caps N] [--glyph-paths N] [--glyph-texts N] [--icons N] [--f-icons N]');
        process.exitCode = 2;
        return false;
    }
    const expected = expectedFromArgs(args);
    const file = args.file;
    const result = inspectArtifactFile(file, expected);
    printResult(file, result);
    process.exitCode = result.pass ? 0 : 1;
    return result.pass;
}

export function inspectArtifactFile(file, expected = {}) {
    const ext = extname(file).toLowerCase();
    const bytes = readFileSync(file);
    return ext === '.pdf'
        ? inspectPdf(bytes, expected)
        : inspectSvg(bytes.toString('utf8'), expected);
}

export function inspectCleanSvgSnapshot(snapshot, expected = {}) {
    const data = typeof snapshot === 'string'
        ? { svg: snapshot }
        : { ...(snapshot || {}) };
    const svg = String(data.svg || '');
    const result = inspectSvg(svg, expected);
    const checks = [...result.checks];
    const summary = { ...result.summary };

    const bytes = Number(data.bytes);
    const actualBytes = utf8ByteLength(svg);
    summary.bytes = actualBytes;
    if (Number.isFinite(bytes)) {
        summary.snapshotBytes = bytes;
        checks.push(checkEqual(bytes, actualBytes, 'snapshot bytes'));
    }
    if ('hasInteractive' in data) {
        summary.snapshotHasInteractive = !!data.hasInteractive;
        checks.push(check(data.hasInteractive === false, 'snapshot hasInteractive false'));
    }
    if (data.layerCounts && typeof data.layerCounts === 'object') {
        summary.snapshotLayerCounts = { ...data.layerCounts };
        for (const key of ['caps', 'guides', 'glyphPaths', 'glyphTexts', 'icons', 'fIcons', 'selection', 'interactive']) {
            if (Number.isFinite(data.layerCounts[key])) {
                checks.push(checkEqual(data.layerCounts[key], result.summary[key], `snapshot ${key}`));
            }
        }
    }

    return {
        ...result,
        kind: 'clean-svg-snapshot',
        pass: checks.every((row) => row.pass),
        checks,
        summary
    };
}

export function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('--') && !out.file) {
            out.file = arg;
            continue;
        }
        if (EXPORT_QA_PRESET_FLAGS[arg]) {
            out.preset = EXPORT_QA_PRESET_FLAGS[arg];
            continue;
        }
        const key = arg.replace(/^--/, '').replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
            out[key] = next;
            i += 1;
        } else {
            out[key] = true;
        }
    }
    return out;
}

export function expectedFromArgs(args) {
    const preset = args.preset ? { ...(EXPORT_QA_PRESETS[args.preset] || {}) } : {};
    const numeric = (key) => args[key] == null ? undefined : Number(args[key]);
    const out = { ...preset };
    for (const key of ['caps', 'guides', 'glyphPaths', 'glyphTexts', 'icons', 'fIcons', 'selection', 'interactive']) {
        const value = numeric(key);
        if (Number.isFinite(value)) out[key] = value;
    }
    if (args.mm) {
        const mm = String(args.mm).split(/[x,]/i).map((part) => Number(part.trim()));
        if (mm.length === 2 && mm.every(Number.isFinite)) out.mm = mm;
    }
    return out;
}

export function inspectSvg(svg, expected = {}) {
    const root = svg.match(/<svg\b[^>]*>/i)?.[0] || '';
    const width = numberAttr(root, 'width');
    const height = numberAttr(root, 'height');
    const viewBox = attr(root, 'viewBox').split(/\s+/).map(Number).filter(Number.isFinite);
    const groups = {
        caps: extractElementById(svg, 'g', 'caps'),
        glyphs: extractElementById(svg, 'g', 'glyphs'),
        icons: extractElementById(svg, 'g', 'icons'),
        fIcons: extractElementById(svg, 'g', 'f-icons')
    };
    const counts = {
        caps: countTags(groups.caps, 'rect'),
        guides: countTags(extractElementById(svg, 'g', 'guides'), 'rect'),
        glyphPaths: countTags(groups.glyphs, 'path'),
        glyphTexts: countTags(groups.glyphs, 'text'),
        icons: countTags(groups.icons, 'path'),
        fIcons: countTags(groups.fIcons, 'path'),
        selection: countId(svg, 'selection'),
        interactive: countAttr(svg, 'data-interactive', 'true')
    };
    const checks = [
        check(!/class=["'][^"']*(resize-handle|hover-overlay)[^"']*["']/i.test(svg), 'no handle/hover classes')
    ];
    if (expected.mm) {
        checks.push(checkClose(width, expected.mm[0] * PT_PER_MM, 0.05, 'svg width pt'));
        checks.push(checkClose(height, expected.mm[1] * PT_PER_MM, 0.05, 'svg height pt'));
        checks.push(checkClose(viewBox[2], expected.mm[0] * PT_PER_MM, 0.05, 'viewBox width pt'));
        checks.push(checkClose(viewBox[3], expected.mm[1] * PT_PER_MM, 0.05, 'viewBox height pt'));
    }
    for (const [key, value] of Object.entries(expected)) {
        if (key === 'mm') continue;
        if (Number.isFinite(value)) checks.push(checkEqual(counts[key], value, key));
    }
    return {
        kind: 'svg',
        pass: checks.every((row) => row.pass),
        checks,
        summary: {
            width,
            height,
            mm: [round(width * MM_PER_PT, 3), round(height * MM_PER_PT, 3)],
            viewBox,
            ...counts
        }
    };
}

export function inspectPdf(bytes, expected = {}) {
    const text = bytes.toString('latin1');
    const mediaBox = text.match(/\/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]/);
    const widthPt = mediaBox ? Number(mediaBox[1]) : NaN;
    const heightPt = mediaBox ? Number(mediaBox[2]) : NaN;
    const checks = [
        check(bytes.subarray(0, 5).toString('latin1') === '%PDF-', 'pdf header'),
        check(!!mediaBox, 'MediaBox present')
    ];
    if (expected.mm) {
        checks.push(checkClose(widthPt, expected.mm[0] * PT_PER_MM, 0.05, 'pdf width pt'));
        checks.push(checkClose(heightPt, expected.mm[1] * PT_PER_MM, 0.05, 'pdf height pt'));
    }
    return {
        kind: 'pdf',
        pass: checks.every((row) => row.pass),
        checks,
        summary: {
            bytes: bytes.length,
            widthPt,
            heightPt,
            mm: [round(widthPt * MM_PER_PT, 3), round(heightPt * MM_PER_PT, 3)]
        }
    };
}

function attr(tag, name) {
    return tag.match(new RegExp(`${name}=["']([^"']+)["']`, 'i'))?.[1] || '';
}

function numberAttr(tag, name) {
    const raw = attr(tag, name);
    if (!raw) return NaN;
    const value = Number(raw);
    return Number.isFinite(value) ? value : NaN;
}

function countTags(source, tag) {
    if (!source) return 0;
    return source.match(new RegExp(`<${tag}\\b`, 'gi'))?.length || 0;
}

function countId(source, id) {
    return source.match(new RegExp(`\\bid=["']${escapeRegExp(id)}["']`, 'gi'))?.length || 0;
}

function countAttr(source, name, value) {
    return source.match(new RegExp(`\\b${escapeRegExp(name)}=["']${escapeRegExp(value)}["']`, 'gi'))?.length || 0;
}

function extractElementById(source, tagName, id) {
    const tagRe = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
    let m;
    while ((m = tagRe.exec(source))) {
        const tag = m[0];
        if (tag.startsWith('</')) continue;
        if (!new RegExp(`\\bid=["']${escapeRegExp(id)}["']`, 'i').test(tag)) continue;
        const start = m.index;
        if (/\/>$/.test(tag)) return tag;
        let depth = 1;
        while ((m = tagRe.exec(source))) {
            if (m[0].startsWith('</')) depth -= 1;
            else if (!/\/>$/.test(m[0])) depth += 1;
            if (depth === 0) return source.slice(start, tagRe.lastIndex);
        }
        return source.slice(start);
    }
    return '';
}

function check(pass, label) {
    return { label, pass: !!pass };
}

function checkEqual(actual, expected, label) {
    return {
        label,
        pass: actual === expected,
        actual,
        expected
    };
}

function checkClose(actual, expected, tolerance, label) {
    return {
        label,
        pass: Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
        actual: round(actual, 4),
        expected: round(expected, 4),
        tolerance
    };
}

export function printResult(file, result) {
    console.log(`${basename(file)} ${result.kind} export QA ${result.pass ? 'passed' : 'failed'}`);
    console.log(JSON.stringify(result.summary, null, 2));
    for (const row of result.checks) {
        const meta = row.actual !== undefined ? ` actual=${row.actual} expected=${row.expected}` : '';
        console.log(`${row.pass ? 'ok' : 'FAIL'} ${row.label}${meta}`);
    }
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function round(value, digits = 3) {
    if (!Number.isFinite(value)) return null;
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function utf8ByteLength(text) {
    return new TextEncoder().encode(String(text || '')).length;
}

function isCliEntrypoint() {
    return !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}
