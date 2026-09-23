/* Passive, opt-in diagnostics. Load before application scripts; no telemetry,
 * storage, console interception, observer patches or swallowed errors. */
(() => {
    const explicit = typeof document !== 'undefined' && document.currentScript?.hasAttribute('data-audit-probe');
    if ((!explicit && !new URLSearchParams(location.search).has('ui-audit')) || window.__upgradeRuntimeProbe) return;
    const records = [];
    let dropped = 0;
    const append = record => {
        if (records.length >= 100) { dropped++; return; }
        records.push({ ...record, at: new Date().toISOString() });
    };
    const text = value => String(value ?? '').slice(0, 12000);
    window.addEventListener('error', event => {
        const resource = event.target !== window && event.target?.tagName;
        append({
            kind: resource ? 'resource' : 'error',
            message: resource ? `Could not load ${event.target.tagName}` : text(event.message),
            source: text(event.filename || (resource && (event.target.src || event.target.href)) || ''),
            line: event.lineno || 0, column: event.colno || 0,
            stack: text(event.error?.stack)
        });
    }, true);
    window.addEventListener('unhandledrejection', event => append({
        kind: 'unhandledrejection', message: text(event.reason?.message ?? event.reason),
        source: '', line: 0, column: 0, stack: text(event.reason?.stack)
    }));
    const startedAt = new Date().toISOString();
    Object.defineProperty(window, '__upgradeRuntimeProbe', { value: Object.freeze({
        snapshot: () => ({ version: 1, startedAt, dropped, records: records.map(record => ({ ...record })) })
    }) });
})();
