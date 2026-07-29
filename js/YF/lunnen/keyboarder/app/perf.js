const DEFAULT_LIMIT = 120;
const PERF_STATE_ID = 'keyboarderPerfState';

const state = {
    initialized: false,
    enabled: false,
    limit: DEFAULT_LIMIT,
    samples: {
        startup: [],
        layout: [],
        render: [],
        import: [],
        export: []
    },
    counters: {}
};

const startupEvents = new Map();

export function perfEnabled() {
    return !!state.enabled;
}

export function perfNow() {
    return globalThis.performance?.now ? globalThis.performance.now() : Date.now();
}

export function perfSince(start) {
    return roundMs(perfNow() - start);
}

export function perfMarkStartup(event, detail = {}) {
    const key = String(event || '').trim();
    if (!key) return null;
    const at = perfNow();
    startupEvents.set(key, { at, detail: { ...detail } });
    const sample = buildStartupSample(key, detail, at);
    if (state.enabled) perfRecord('startup', sample);
    return sample;
}

export function perfRecord(kind, sample = {}) {
    if (!state.enabled) return null;
    if (!state.samples[kind]) state.samples[kind] = [];
    const row = cleanSample({
        at: new Date().toISOString(),
        ...sample
    });
    state.samples[kind].push(row);
    while (state.samples[kind].length > state.limit) state.samples[kind].shift();
    syncDocumentState();
    return row;
}

export function perfCount(name, delta = 1) {
    if (!state.enabled) return;
    const key = String(name || '').trim();
    if (!key) return;
    state.counters[key] = (state.counters[key] || 0) + delta;
}

export function perfSnapshot() {
    return {
        enabled: state.enabled,
        limit: state.limit,
        counters: { ...state.counters },
        summary: Object.fromEntries(
            Object.entries(state.samples).map(([kind, rows]) => [kind, summarizeRows(rows)])
        ),
        samples: Object.fromEntries(
            Object.entries(state.samples).map(([kind, rows]) => [kind, rows.map((row) => ({ ...row }))])
        )
    };
}

export function perfReset(kind = null) {
    if (kind && state.samples[kind]) {
        state.samples[kind] = [];
        syncDocumentState();
        return;
    }
    for (const key of Object.keys(state.samples)) state.samples[key] = [];
    state.counters = {};
    syncDocumentState();
}

export function installKeyboarderPerf(app = null) {
    if (typeof window === 'undefined') return null;
    if (!state.initialized) {
        state.enabled = initialEnabled();
        state.initialized = true;
    }
    replayStartupEvents();
    syncDocumentState();
    const api = {
        get enabled() {
            return state.enabled;
        },
        enable() {
            setEnabled(true);
            return perfSnapshot();
        },
        disable() {
            setEnabled(false);
            return perfSnapshot();
        },
        reset(kind = null) {
            perfReset(kind);
            return perfSnapshot();
        },
        snapshot: perfSnapshot,
        log(kind = null) {
            const snap = perfSnapshot();
            if (kind && snap.samples[kind]) console.table(snap.samples[kind]);
            else console.log(snap);
            return snap;
        },
        benchRepaint(iterations = 30) {
            return benchRepaint(app, iterations);
        }
    };
    window.KeyboarderPerf = api;
    if (app) app.KeyboarderPerf = api;
    return api;
}

function initialEnabled() {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('perf')) return params.get('perf') !== '0';
        return window.localStorage?.getItem('keyboarder.perf') === '1';
    } catch {
        return false;
    }
}

function setEnabled(value) {
    state.enabled = !!value;
    replayStartupEvents();
    syncDocumentState();
    try {
        window.localStorage?.setItem('keyboarder.perf', state.enabled ? '1' : '0');
    } catch {
        // localStorage is optional in private/restricted browser contexts.
    }
}

function benchRepaint(app, iterations = 30) {
    const n = Math.max(1, Math.min(200, Math.floor(Number(iterations) || 30)));
    const wasEnabled = state.enabled;
    state.enabled = true;
    syncDocumentState();
    const renderStart = state.samples.render.length;
    const layoutStart = state.samples.layout.length;
    const started = perfNow();
    for (let i = 0; i < n; i++) app?.renderNow?.();
    const totalMs = perfSince(started);
    const renderRows = state.samples.render.slice(renderStart);
    const layoutRows = state.samples.layout.slice(layoutStart);
    if (!wasEnabled) {
        state.enabled = false;
        syncDocumentState();
    }
    return {
        iterations: n,
        totalMs,
        render: summarizeRows(renderRows),
        layout: summarizeRows(layoutRows),
        cacheHits: layoutRows.filter((row) => row.hit).length,
        cacheMisses: layoutRows.filter((row) => !row.hit).length
    };
}

function replayStartupEvents() {
    if (!state.enabled) return;
    const recorded = new Set((state.samples.startup || []).map((row) => row.event));
    for (const [event, row] of startupEvents.entries()) {
        if (!recorded.has(event)) perfRecord('startup', buildStartupSample(event, row.detail, row.at));
    }
}

function buildStartupSample(event, detail = {}, at = perfNow()) {
    const domReady = startupTime('dom-ready');
    const firstRender = startupTime('first-render');
    const appReady = startupTime('app-ready');
    const fontStart = startupTime('font-load-start');
    const fontReady = startupTime('font-ready');
    return {
        event,
        ms: deltaFrom(domReady, at),
        eventAtMs: roundMs(at),
        domReadyMs: roundMaybe(domReady),
        firstRenderMs: roundMaybe(firstRender),
        appReadyMs: roundMaybe(appReady),
        fontReadyMs: roundMaybe(fontReady),
        domToFirstRenderMs: deltaBetween(domReady, firstRender),
        domToAppReadyMs: deltaBetween(domReady, appReady),
        domToFontReadyMs: deltaBetween(domReady, fontReady),
        fontLoadMs: deltaBetween(fontStart, fontReady),
        ...detail
    };
}

function startupTime(event) {
    return startupEvents.get(event)?.at ?? null;
}

function deltaFrom(from, to) {
    return Number.isFinite(from) && Number.isFinite(to) ? roundMs(to - from) : roundMs(to);
}

function deltaBetween(from, to) {
    return Number.isFinite(from) && Number.isFinite(to) ? roundMs(to - from) : null;
}

function roundMaybe(value) {
    return Number.isFinite(value) ? roundMs(value) : null;
}

function markDomReady() {
    if (!startupEvents.has('dom-ready')) perfMarkStartup('dom-ready');
}

try {
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', markDomReady, { once: true });
        } else {
            markDomReady();
        }
    }
} catch {
    // Non-DOM contexts can still import the perf helpers.
}

function syncDocumentState() {
    try {
        document.documentElement.dataset.keyboarderPerf = state.enabled ? 'on' : 'off';
        let node = document.getElementById(PERF_STATE_ID);
        if (!node) {
            node = document.createElement('script');
            node.id = PERF_STATE_ID;
            node.type = 'application/json';
            (document.head || document.documentElement).appendChild(node);
        }
        node.textContent = JSON.stringify(perfSnapshot());
    } catch {
        // Node checks and non-DOM contexts do not expose document.
    }
}

function summarizeRows(rows = []) {
    const values = rows
        .map((row) => Number(row.ms ?? row.totalMs))
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
    if (!values.length) return { count: rows.length };
    const total = values.reduce((sum, value) => sum + value, 0);
    const lastRow = rows[rows.length - 1] || {};
    const lastValue = Number(lastRow.ms ?? lastRow.totalMs);
    return {
        count: rows.length,
        avgMs: roundMs(total / values.length),
        minMs: roundMs(values[0]),
        maxMs: roundMs(values[values.length - 1]),
        p95Ms: roundMs(values[Math.min(values.length - 1, Math.floor(values.length * 0.95))]),
        lastMs: Number.isFinite(lastValue) ? roundMs(lastValue) : null
    };
}

function cleanSample(sample) {
    const out = {};
    for (const [key, value] of Object.entries(sample)) {
        out[key] = Number.isFinite(value) && !Number.isInteger(value) ? roundMs(value) : value;
    }
    return out;
}

function roundMs(value) {
    return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}
