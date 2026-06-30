/**
 * Techstyler — web generator of single-layer textile weaves.
 *
 * This file is the ONLY place that knows about both the UI framework and the
 * weave domain. It wires the two together and contains no weave maths and no
 * framework internals:
 *
 *   PatternSpec      → structural parameters
 *   PatternGenerator → binary rapport (1 = warp over weft, 0 = weft over warp)
 *   PatternValidator → analysis / checks (shown in the matrix panel)
 *   ThreadModel      → matrix → renderer interface (future-proofs a thread graph)
 *   PatternRenderer  → SVG drawing (no formulas)
 *   ProjectSerializer→ JSON import/export
 *
 * The framework (defineTool) provides panels, sliders, colour pickers, zoom/pan,
 * undo/redo, presets, share links, dialogs, tooltips and SVG/PNG export.
 */

import { defineTool } from './src/core/defineTool.js';

import { Family, Faced, normalizeSpec, repeatSize, repairSatinStep, describeSpec } from './weave/PatternSpec.js';
import { generate } from './weave/PatternGenerator.js';
import { analyze, validateSpec } from './weave/PatternValidator.js';
import { matrixModel } from './weave/ThreadModel.js';
import { renderWeave } from './weave/PatternRenderer.js';
import * as Project from './weave/ProjectSerializer.js';
import { suggestPairs } from './weave/ColorMixer.js';

/** Hard cap on drawn cells per axis so big rapports + tiling stay performant. */
const MAX_AXIS = 96;

/** Settings keys that define the *structure* — editing any of them invalidates a
 *  hand-edited matrix (the generated rapport takes over again). */
const SPEC_KEYS = ['family', 'phase', 'warpGroup', 'weftGroup', 'over', 'under',
    'twillStep', 'direction', 'satinN', 'satinStep', 'faced'];

const GRAPHIC_FONT = "'TT Commons Classic', 'Lunnen Display', sans-serif";

/* -------------------------------------------------------------------------- */
/*  Settings → domain mapping                                                 */
/* -------------------------------------------------------------------------- */

/** Translate the flat settings store into a clean PatternSpec. */
function specFromSettings(s) {
    return {
        family: s.family,
        phase: s.phase,
        warpGroup: s.warpGroup,
        weftGroup: s.weftGroup,
        over: s.over,
        under: s.under,
        step: s.twillStep,
        direction: s.direction,
        n: s.satinN,
        satinStep: s.satinStep,
        faced: s.faced
    };
}

/** The rapport currently in effect: a hand-edited matrix, else generated. */
function currentMatrix(s) {
    const spec = specFromSettings(s);
    if (s.custom && Array.isArray(s.matrix) && s.matrix.length && Array.isArray(s.matrix[0])) {
        const { rows, cols } = repeatSize(spec);
        if (s.matrix.length === rows && s.matrix[0].length === cols) return s.matrix;
    }
    return generate(spec);
}

/** Tiling counts clamped so total drawn cells per axis never exceeds MAX_AXIS. */
function effectiveTiles(s, cols, rows) {
    const tx = Math.max(1, Math.min(s.tileX, Math.floor(MAX_AXIS / cols) || 1));
    const ty = Math.max(1, Math.min(s.tileY, Math.floor(MAX_AXIS / rows) || 1));
    return { tileX: tx, tileY: ty };
}

/* -------------------------------------------------------------------------- */
/*  Tool definition                                                           */
/* -------------------------------------------------------------------------- */

const app = defineTool({
    renderer: 'svg',
    autoStart: true,

    dom: { canvas: 'canvasContainer', surface: 'mainSvg', zoomIndicator: 'zoomIndicator' },

    settings: {
        family: 'twill',
        phase: 0,
        warpGroup: 2,
        weftGroup: 2,
        over: 2,
        under: 2,
        twillStep: 1,
        direction: 1,
        satinN: 5,
        satinStep: 2,
        faced: 'warp',
        viewMode: 'threads',
        tileX: 3,
        tileY: 3,
        thickness: 18,
        spacing: 4,
        showGrid: false,
        showLabel: true,
        warpColor: '#d8c9a3',
        weftColor: '#6f4e37',
        bg: '#0a0a0a',
        custom: false,
        matrix: [],
        targetColor: '',
        targetCode: '',
        targetName: '',
        separation: 0.5,
        paletteName: 'yarn-catalog'
    },

    controls: {
        sliders: [
            { id: 'phaseSlider', valueId: 'phaseValue', setting: 'phase', min: 0, max: 64, decimals: 0, baseStep: 1 },
            { id: 'warpGroupSlider', valueId: 'warpGroupValue', setting: 'warpGroup', min: 1, max: 12, decimals: 0, baseStep: 1 },
            { id: 'weftGroupSlider', valueId: 'weftGroupValue', setting: 'weftGroup', min: 1, max: 12, decimals: 0, baseStep: 1 },
            { id: 'overSlider', valueId: 'overValue', setting: 'over', min: 1, max: 16, decimals: 0, baseStep: 1 },
            { id: 'underSlider', valueId: 'underValue', setting: 'under', min: 1, max: 16, decimals: 0, baseStep: 1 },
            { id: 'twillStepSlider', valueId: 'twillStepValue', setting: 'twillStep', min: 1, max: 16, decimals: 0, baseStep: 1 },
            { id: 'satinNSlider', valueId: 'satinNValue', setting: 'satinN', min: 4, max: 24, decimals: 0, baseStep: 1 },
            { id: 'satinStepSlider', valueId: 'satinStepValue', setting: 'satinStep', min: 1, max: 23, decimals: 0, baseStep: 1 },
            { id: 'tileXSlider', valueId: 'tileXValue', setting: 'tileX', min: 1, max: 12, decimals: 0, baseStep: 1 },
            { id: 'tileYSlider', valueId: 'tileYValue', setting: 'tileY', min: 1, max: 12, decimals: 0, baseStep: 1 },
            { id: 'thicknessSlider', valueId: 'thicknessValue', setting: 'thickness', min: 4, max: 48, decimals: 0, baseStep: 1, suffix: 'px' },
            { id: 'spacingSlider', valueId: 'spacingValue', setting: 'spacing', min: 0, max: 24, decimals: 0, baseStep: 1, suffix: 'px' },
            { id: 'cmSeparationSlider', valueId: 'cmSeparationValue', setting: 'separation', min: 0, max: 1, decimals: 2, baseStep: 0.05 }
        ],
        toggles: true
    },

    panels: [
        { id: 'structurePanel', headerId: 'structurePanelHeader', persistent: true },
        { id: 'viewPanel', headerId: 'viewPanelHeader', persistent: true },
        { id: 'matrixPanel', headerId: 'matrixPanelHeader', persistent: true },
        { id: 'colorsPanel', headerId: 'colorsPanelHeader', persistent: true }
    ],

    colorPickers: {
        containerId: 'unifiedColorPickerContainer',
        swatches: [
            { type: 'warp', setting: 'warpColor', label: 'Warp', itemId: 'warpColorItem', dotId: 'warpColorPreview', hexId: 'warpColorHex', hsbSlotId: 'warpColorHsbSlot' },
            { type: 'weft', setting: 'weftColor', label: 'Weft', itemId: 'weftColorItem', dotId: 'weftColorPreview', hexId: 'weftColorHex', hsbSlotId: 'weftColorHsbSlot' },
            { type: 'bg', setting: 'bg', label: 'Background', itemId: 'bgColorItem', dotId: 'bgColorPreview', hexId: 'bgColorHex', hsbSlotId: 'bgColorHsbSlot' }
        ]
    },

    presets: {
        storageKey: 'techstylerWeave',
        basePath: 'presets',
        colorDots: (blob) => {
            const dots = [];
            if (blob.warpColor) dots.push({ kind: 'solid', value: blob.warpColor });
            if (blob.weftColor) dots.push({ kind: 'solid', value: blob.weftColor });
            return dots;
        }
    },

    share: { stripKeys: ['matrix'] },
    export: { filename: 'weave.svg' },

    /** Artboard size derives from rapport, tiling and thread pitch. */
    size(s) {
        const spec = specFromSettings(s);
        const { cols, rows } = repeatSize(spec);
        const pitch = s.thickness + s.spacing;
        const { tileX, tileY } = effectiveTiles(s, cols, rows);
        return { width: cols * tileX * pitch, height: rows * tileY * pitch };
    },

    render(ctx) {
        const { svg, create, width, height, settings: s, app } = ctx;

        // Keep satin step coprime with n; reflect the snap in the slider silently.
        if (s.family === Family.SATIN) {
            const fixed = repairSatinStep(s.satinStep, s.satinN);
            if (fixed !== s.satinStep) {
                ctx.store.set('satinStep', fixed, true);
                app.sliders?.setValue('satinStepSlider', fixed, false);
            }
        }

        const spec = specFromSettings(s);
        const matrix = currentMatrix(s);
        const model = matrixModel(matrix);
        const { tileX, tileY } = effectiveTiles(s, model.cols, model.rows);
        const pitch = s.thickness + s.spacing;

        renderWeave({
            model,
            create,
            root: svg,
            options: {
                viewMode: s.viewMode,
                tileX, tileY,
                width, height,
                warpColor: s.warpColor,
                weftColor: s.weftColor,
                bg: s.bg,
                gridColor: '#3a3a3a',
                threadFrac: s.thickness / pitch,
                showGrid: s.showGrid,
                label: s.showLabel ? describeSpec(spec) : '',
                labelColor: '#d2d2d2',
                fontFamily: GRAPHIC_FONT
            }
        });

        refreshEditor(app, matrix, spec);
    },

    /** Re-sync bespoke widgets (segmented controls + family sections) after
     *  preset switches and undo/redo. */
    syncControls(app) {
        syncSegments(app);
    },

    onReady(app) {
        wireSegments(app);
        syncSegments(app);

        // Editing a structural parameter discards a hand-edited matrix.
        SPEC_KEYS.forEach((key) => {
            app.settingsStore.subscribe(key, () => {
                if (app.settings.custom) {
                    app.settingsStore.set('custom', false, true);
                    app.settingsStore.set('matrix', [], true);
                }
            });
        });
        // Family switch also toggles which parameter section is visible.
        app.settingsStore.subscribe('family', () => syncSegments(app));

        document.getElementById('regenerateBtn')?.addEventListener('click', () => {
            app.settingsStore.set('matrix', []);
            app.settingsStore.set('custom', false);
        });
        document.getElementById('invertBtn')?.addEventListener('click', () => {
            const m = currentMatrix(app.settings).map((r) => r.map((v) => (v ? 0 : 1)));
            app.settingsStore.set('matrix', m);
            app.settingsStore.set('custom', true);
        });

        document.getElementById('exportSvgBtn')?.addEventListener('click', () => app.exportSVG());
        document.getElementById('exportPngBtn')?.addEventListener('click', () => app.exportPNG());
        document.getElementById('exportJsonBtn')?.addEventListener('click', () => exportProject(app));

        const importBtn = document.getElementById('importJsonBtn');
        const importInput = document.getElementById('importJsonInput');
        importBtn?.addEventListener('click', () => importInput?.click());
        importInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) importProject(app, file);
            e.target.value = '';
        });

        initColorMatch(app);

        document.getElementById('introHelpBtn')?.addEventListener('click', () => {
            app.dialog?.alert({
                title: 'Techstyler',
                text: 'A generator for single-layer textile weaves. 1 means warp over weft; 0 means weft over warp. '
                    + 'Choose a family (plain, basket, twill, satin), adjust the parameters, click the matrix '
                    + 'to edit the repeat manually, switch between Draft and Threads, and export SVG, PNG or JSON. '
                    + 'Cmd/Ctrl+Z to undo.'
            });
        });
    }
});

/* -------------------------------------------------------------------------- */
/*  Matrix editor (tool-specific DOM widget)                                  */
/* -------------------------------------------------------------------------- */

function refreshEditor(app, matrix, spec) {
    const editor = document.getElementById('matrixEditor');
    if (!editor) return;
    const rows = matrix.length;
    const cols = rows ? matrix[0].length : 0;

    editor.style.setProperty('--cell-warp', app.settings.warpColor);
    editor.style.setProperty('--cell-weft', app.settings.weftColor);

    const sig = `${cols}x${rows}|${JSON.stringify(matrix)}`;
    if (editor.__sig !== sig) {
        editor.__sig = sig;
        editor.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        editor.innerHTML = '';
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.className = 'matrix-cell';
                cell.dataset.warp = matrix[y][x];
                cell.setAttribute('role', 'gridcell');
                cell.setAttribute('aria-label', `${x + 1},${y + 1}: ${matrix[y][x] ? 'warp' : 'weft'}`);
                const cx = x, cy = y;
                cell.addEventListener('click', () => toggleCell(app, cx, cy));
                editor.appendChild(cell);
            }
        }
    }
    updateMeta(app, matrix, spec);
}

function toggleCell(app, x, y) {
    const base = currentMatrix(app.settings);
    const m = base.map((row) => row.slice());
    m[y][x] = m[y][x] ? 0 : 1;
    app.settingsStore.set('matrix', m);
    app.settingsStore.set('custom', true);
}

function updateMeta(app, matrix, spec) {
    const meta = document.getElementById('matrixMeta');
    if (!meta) return;
    const a = analyze(matrix);
    const v = validateSpec(spec);
    const parts = [];
    parts.push(`<div>Repeat: <strong>${a.cols}\u00d7${a.rows}</strong> · warp on face <strong>${Math.round(a.warpRatio * 100)}%</strong></div>`);
    parts.push(`<div>Max. float: warp <strong>${a.maxWarpFloat}</strong>, weft <strong>${a.maxWeftFloat}</strong></div>`);
    parts.push(a.interlaced
        ? '<div class="ok">Interlacement: all threads are bound</div>'
        : `<div class="warn">Loose threads — warp: ${a.looseWarps.length}, weft: ${a.looseWefts.length}</div>`);
    if (app.settings.custom) parts.push('<div class="warn">Matrix edited manually</div>');
    v.errors.forEach((e) => parts.push(`<div class="warn">${e}</div>`));
    v.warnings.forEach((w) => parts.push(`<div class="warn">${w}</div>`));
    meta.innerHTML = parts.join('');
}

/* -------------------------------------------------------------------------- */
/*  Segmented controls (family / direction / faced / viewMode)               */
/* -------------------------------------------------------------------------- */

function wireSegments(app) {
    document.querySelectorAll('.segmented-control[data-segment] input[type="radio"]').forEach((radio) => {
        const key = radio.closest('[data-segment]').dataset.segment;
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            const value = key === 'direction' ? Number(radio.value) : radio.value;
            app.settingsStore.set(key, value);
        });
    });
}

function syncSegments(app) {
    const s = app.settings;
    document.querySelectorAll('.segmented-control[data-segment] input[type="radio"]').forEach((radio) => {
        const key = radio.closest('[data-segment]').dataset.segment;
        radio.checked = String(s[key]) === String(radio.value);
    });
    document.querySelectorAll('.fam-section').forEach((section) => {
        section.classList.toggle('is-hidden', section.dataset.family !== s.family);
    });
}

/* -------------------------------------------------------------------------- */
/*  Color match (target colour → suggested warp/weft yarn pair)               */
/* -------------------------------------------------------------------------- */

/** Map a ΔE2000 value to a coarse match-quality bucket for the UI badge. */
function matchQuality(dE) {
    if (dE < 2) return { cls: 'cm-q-good', label: 'great' };
    if (dE < 5) return { cls: 'cm-q-ok', label: 'good' };
    return { cls: 'cm-q-poor', label: 'rough' };
}

function initColorMatch(app) {
    const search = document.getElementById('cmSearch');
    const list = document.getElementById('cmSearchList');
    const swatch = document.getElementById('cmTargetSwatch');

    // Load the yarn catalogue; it serves both as the target source and the pool
    // of real yarn colours suggestions snap to.
    fetch(`palettes/${app.settings.paletteName}.json`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('palette ' + r.status))))
        .then((data) => {
            app._palette = Array.isArray(data.colors) ? data.colors : [];
            updateTargetUI(app);
            renderCandidates(app);
        })
        .catch(() => {
            app._palette = [];
            const box = document.getElementById('cmCandidates');
            if (box) box.innerHTML = '<div class="cm-empty">Palette could not be loaded.</div>';
        });

    // Search → filtered option list.
    search?.addEventListener('input', () => renderSearchList(app, search.value));
    search?.addEventListener('focus', () => renderSearchList(app, search.value));
    swatch?.addEventListener('click', () => search?.focus());

    // Close the dropdown on outside click / Escape.
    document.addEventListener('click', (e) => {
        if (list && !list.contains(e.target) && e.target !== search) list.hidden = true;
    });
    search?.addEventListener('keydown', (e) => { if (e.key === 'Escape') list.hidden = true; });

    // Recompute when the target or the contrast preference changes…
    ['targetColor', 'separation'].forEach((k) =>
        app.settingsStore.subscribe(k, () => { updateTargetUI(app); scheduleCandidates(app); }));
    // …and when the structure changes (warp ratio drives the optical mix).
    [...SPEC_KEYS, 'matrix'].forEach((k) =>
        app.settingsStore.subscribe(k, () => scheduleCandidates(app)));

    updateTargetUI(app);
}

let _cmTimer = null;
function scheduleCandidates(app) {
    clearTimeout(_cmTimer);
    _cmTimer = setTimeout(() => renderCandidates(app), 120);
}

function updateTargetUI(app) {
    const s = app.settings;
    const swatch = document.getElementById('cmTargetSwatch');
    const nameEl = document.getElementById('cmTargetName');
    const codeEl = document.getElementById('cmTargetCode');
    if (swatch) swatch.style.background = s.targetColor || '#222';
    if (nameEl) nameEl.textContent = s.targetColor ? (s.targetName || s.targetColor) : 'No target';
    if (codeEl) codeEl.textContent = s.targetColor ? [s.targetCode, s.targetColor].filter(Boolean).join(' · ') : '';
}

function renderSearchList(app, query) {
    const list = document.getElementById('cmSearchList');
    if (!list) return;
    const palette = app._palette || [];
    const q = query.trim().toLowerCase();
    const matches = (q
        ? palette.filter((c) =>
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.code && c.code.toLowerCase().includes(q)) ||
            (c.hex && c.hex.toLowerCase().includes(q)))
        : palette
    ).slice(0, 40);

    if (!matches.length) {
        list.innerHTML = '<div class="cm-search-empty">No colours found.</div>';
        list.hidden = false;
        return;
    }
    list.innerHTML = '';
    matches.forEach((c) => {
        const opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'cm-option';
        opt.innerHTML =
            `<span class="cm-chip" style="background:${c.hex}"></span>` +
            `<span class="cm-opt-name">${c.name || c.hex}</span>` +
            `<span class="cm-opt-code">${c.code || ''}</span>`;
        opt.addEventListener('click', () => {
            app.settingsStore.setMultiple({
                targetColor: c.hex,
                targetCode: c.code || '',
                targetName: c.name || ''
            });
            const search = document.getElementById('cmSearch');
            if (search) search.value = c.name || c.hex;
            list.hidden = true;
        });
        list.appendChild(opt);
    });
    list.hidden = false;
}

function renderCandidates(app) {
    const box = document.getElementById('cmCandidates');
    if (!box) return;
    const s = app.settings;
    const palette = app._palette;

    if (!palette) { box.innerHTML = '<div class="cm-loading">Loading palette…</div>'; return; }
    if (!s.targetColor) {
        box.innerHTML = '<div class="cm-empty">Pick a target color to see thread suggestions.</div>';
        return;
    }

    const ratio = analyze(currentMatrix(s)).warpRatio;
    const pairs = suggestPairs({
        target: s.targetColor,
        ratio,
        palette,
        count: 4,
        separation: s.separation
    });

    if (!pairs.length) { box.innerHTML = '<div class="cm-empty">No suggestions.</div>'; return; }

    box.innerHTML = '';
    pairs.forEach((p) => {
        const q = matchQuality(p.deltaE);
        const card = document.createElement('div');
        card.className = 'cm-card';
        card.innerHTML =
            `<span class="cm-card-preview" style="background:${p.predicted}"></span>` +
            `<span class="cm-card-threads">` +
                `<span style="background:${p.warp.hex}" title="warp ${p.warp.code || ''}"></span>` +
                `<span style="background:${p.weft.hex}" title="weft ${p.weft.code || ''}"></span>` +
            `</span>` +
            `<span class="cm-card-info">` +
                `<span class="cm-card-de">ΔE <strong>${p.deltaE.toFixed(1)}</strong>` +
                    `<span class="cm-q ${q.cls}">${q.label}</span></span>` +
                `<span class="cm-card-yarns">${p.warp.name || p.warp.hex} + ${p.weft.name || p.weft.hex}</span>` +
            `</span>`;
        const apply = document.createElement('button');
        apply.type = 'button';
        apply.className = 'cm-apply';
        apply.textContent = 'Apply';
        apply.addEventListener('click', () => applyCandidate(app, p.warp.hex, p.weft.hex));
        card.appendChild(apply);
        box.appendChild(card);
    });
}

function applyCandidate(app, warpHex, weftHex) {
    app.settingsStore.setMultiple({ warpColor: warpHex, weftColor: weftHex });
    app._syncControls?.();
}

/* -------------------------------------------------------------------------- */
/*  JSON import / export                                                      */
/* -------------------------------------------------------------------------- */

function projectStateFromApp(app) {
    const s = app.settings;
    return {
        spec: specFromSettings(s),
        render: {
            viewMode: s.viewMode, tileX: s.tileX, tileY: s.tileY,
            thickness: s.thickness, spacing: s.spacing,
            warpColor: s.warpColor, weftColor: s.weftColor, bg: s.bg,
            showGrid: s.showGrid, showLabel: s.showLabel,
            targetColor: s.targetColor, targetCode: s.targetCode, targetName: s.targetName,
            separation: s.separation, paletteName: s.paletteName
        },
        matrix: s.custom ? s.matrix : null
    };
}

function exportProject(app) {
    const json = Project.toJSON(projectStateFromApp(app));
    const name = describeSpec(specFromSettings(app.settings)).toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'weave';
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importProject(app, file) {
    let parsed;
    try {
        parsed = Project.fromJSON(await file.text());
    } catch (err) {
        app.dialog?.alert({ title: 'Import Error', text: 'Could not read the project file: ' + err.message });
        return;
    }
    const { spec, render, matrix } = parsed;
    const updates = {
        family: spec.family, phase: spec.phase,
        warpGroup: spec.warpGroup, weftGroup: spec.weftGroup,
        over: spec.over, under: spec.under, twillStep: spec.step, direction: spec.direction,
        satinN: spec.n, satinStep: spec.satinStep, faced: spec.faced
    };
    const rk = ['viewMode', 'tileX', 'tileY', 'thickness', 'spacing', 'warpColor', 'weftColor', 'bg', 'showGrid', 'showLabel',
        'targetColor', 'targetCode', 'targetName', 'separation', 'paletteName'];
    rk.forEach((k) => { if (render[k] !== undefined) updates[k] = render[k]; });
    if (matrix) { updates.custom = true; updates.matrix = matrix; }
    else { updates.custom = false; updates.matrix = []; }

    // Apply silently (so the spec-key listeners don't wipe an imported matrix),
    // then sync the UI, render and record one history step.
    app.settingsStore.setMultiple(updates, true);
    app._syncControls();
    app.renderNow();
    app.presets?.markDirty();
    app.history?.notifyChange('import');
    app._refreshChrome?.();
}

export default app;
