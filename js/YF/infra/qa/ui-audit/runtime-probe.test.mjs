import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('runtime-probe.js', import.meta.url), 'utf8');
function boot(search = '?ui-audit=test') {
    const listeners = new Map();
    const window = { addEventListener(type, listener) {
        const list = listeners.get(type) || []; list.push(listener); listeners.set(type, list);
    } };
    const context = vm.createContext({ window, location: { search }, URLSearchParams });
    const execute = () => vm.runInContext(source, context);
    execute();
    return { window, execute, listeners, emit(type, event) { for (const fn of listeners.get(type) || []) fn(event); } };
}

test('normal tool visits do not install diagnostic listeners or globals', () => {
    const app = boot('');
    assert.equal(app.listeners.size, 0);
    assert.equal(app.window.__upgradeRuntimeProbe, undefined);
});

test('captures filename/line/stack without preventing the original exception', () => {
    const app = boot();
    let prevented = false;
    app.emit('error', { target: app.window, message: 'fixture error', filename: 'fixture.js', lineno: 7, colno: 3,
        error: { stack: 'Error: fixture error\n at fixture.js:7:3' }, preventDefault() { prevented = true; } });
    const [record] = app.window.__upgradeRuntimeProbe.snapshot().records;
    assert.equal(record.source, 'fixture.js'); assert.equal(record.line, 7);
    assert.match(record.stack, /fixture.js:7:3/); assert.equal(prevented, false);
});

test('resource failures and promise rejections are captured separately', () => {
    const app = boot();
    app.emit('error', { target: { tagName: 'SCRIPT', src: 'missing.js' } });
    app.emit('unhandledrejection', { reason: new Error('promise fixture') });
    const records = app.window.__upgradeRuntimeProbe.snapshot().records;
    assert.equal(records[0].kind, 'resource'); assert.equal(records[0].source, 'missing.js');
    assert.equal(records[1].kind, 'unhandledrejection'); assert.match(records[1].stack, /promise fixture/);
});

test('bounded buffer, detached snapshots, no duplicate listeners on a second load', () => {
    const app = boot(); app.execute();
    assert.equal(app.listeners.get('error').length, 1);
    for (let i = 0; i < 105; i++) app.emit('error', { target: app.window, message: `error ${i}` });
    const first = app.window.__upgradeRuntimeProbe.snapshot();
    assert.equal(first.records.length, 100); assert.equal(first.dropped, 5);
    first.records[0].message = 'changed'; first.records.length = 0;
    assert.equal(app.window.__upgradeRuntimeProbe.snapshot().records[0].message, 'error 0');
});

test('all 16 tools install the opt-in probe before any application script', async () => {
    const root = new URL('../../../', import.meta.url);
    for (const id of ['sparky', 'grid_generator', 'label_generator', 'keyboarder', 'wordplayer', 'dither', 'wander_bender', 'pulsar_coder',
        'hyperspace', 'pattern_generator', 'pattern_generator_02', 'random_lines_generator', 'rays_pattern_generator', 'asterisk_pattern_generator', 'calendar-randomizer', 'chladni-sound-pattern']) {
        const html = await readFile(new URL(`${id}/index.html`, root), 'utf8');
        assert.match(html.match(/<script\b[^>]*>/i)?.[0] || '', /runtime-probe\.js/, id);
    }
});

test('empty image previews do not try to decode their own HTML document', async () => {
    const root = new URL('../../../', import.meta.url);
    for (const id of ['rays_pattern_generator', 'random_lines_generator']) {
        const html = await readFile(new URL(`${id}/index.html`, root), 'utf8');
        assert.doesNotMatch(html, /<img[^>]*src=["'](?:#|)["']/i);
        const script = await readFile(new URL(`${id}/script.js`, root), 'utf8');
        assert.doesNotMatch(script, /imagePreview\.src\s*=\s*["']#["']/);
    }
});

test('minimal navigation reproduction has no framework, p5 or MutationObserver calls', async () => {
    const parent = await readFile(new URL('observer-repro.html', import.meta.url), 'utf8');
    const child = await readFile(new URL('observer-empty.html', import.meta.url), 'utf8');
    const logic = await readFile(new URL('observer-repro.js', import.meta.url), 'utf8');
    const scripts = html => [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(scripts(parent), ['runtime-probe.js?v=2', 'observer-repro.js']);
    assert.deepEqual(scripts(child), ['runtime-probe.js?v=2']);
    assert.doesNotMatch(source + logic, /\bMutationObserver\b|\bimport\s*\(|\bfetch\s*\(|createElement\(/);
});
