import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PanelResizeController, panelPreferenceKey, readPanelHeights, readPanelPriority, fitPanelColumn, clampPanelHeight } from '../src/ui/PanelResizeController.js';

test('height preferences are scoped to the tool, not the serving root or preset URL', () => {
    assert.equal(panelPreferenceKey('/js/YF/wordplayer/'), panelPreferenceKey('/wordplayer/index.html'));
    assert.notEqual(panelPreferenceKey('/grid_generator/'), panelPreferenceKey('/grid_generator_02/'));
    assert.equal(panelPreferenceKey('/sparky/'), 'yf:panel-heights:v1:sparky');
});

test('only finite numeric heights and safe panel identifiers survive storage loading', () => {
    const storage = { getItem: () => '{"good":400,"small":1,"huge":9999999,"text":"300","__proto__":500,"constructor":600}' };
    assert.deepEqual([...readPanelHeights(storage, 'key')], [['good', 400]]);
    assert.equal(readPanelHeights({ getItem: () => '{broken' }, 'key').size, 0);
    assert.equal(readPanelHeights({ getItem() { throw Error('denied'); } }, 'key').size, 0);
});

test('viewport limits win over minimum panel height on a short screen', () => {
    assert.equal(clampPanelHeight(500, 127, 680), 500);
    assert.equal(clampPanelHeight(20, 127, 680), 127);
    assert.equal(clampPanelHeight(500, 127, 90), 90);
});

test('reload retains the last resized panel priority, not the first saved panel', () => {
    const { c, writes, event } = fixture('top');
    c.requested.set('neighbor', 413);
    c.start(event()); c.move(event({ clientY: 299 })); c.finish(event());
    assert.equal(writes.length, 0);
    c.start(event()); c.move(event({ clientY: 200 })); c.finish(event());
    const storage = { getItem: () => writes.at(-1)[1] };
    assert.equal(readPanelPriority(storage, c.key), 'main');
    assert.deepEqual([...readPanelHeights(storage, c.key)], [['neighbor', 413], ['main', 400]]);
    assert.equal(readPanelPriority({ getItem() { throw Error('denied'); } }, c.key), undefined);
});

test('a linked column gives the active panel space by shrinking neighbors', () => {
    const result = fitPanelColumn([{ height: 400, min: 127 }, { height: 304, min: 127 }], 614, 0);
    assert.deepEqual(result, [400, 214]);
    assert.deepEqual(fitPanelColumn([{ height: 400, min: 127 }, { height: 304, min: 127 }], 614, 1), [310, 304]);
});

test('collapsed neighbors keep their header while other panels shrink', () => {
    const result = fitPanelColumn([{ height: 800, min: 127 }, { height: 47, min: 47 }], 600, 0);
    assert.deepEqual(result, [553, 47]);
});

test('column allocation never exceeds its budget, including multiple saved heights', () => {
    for (const available of [0, 70, 140, 400, 1000]) {
        const result = fitPanelColumn([{ height: 600, min: 127 }, { height: 400, min: 127 }, { height: 47, min: 47 }], available, 0);
        assert.ok(result.every(height => height >= 0));
        assert.ok(result.reduce((a, b) => a + b, 0) <= available + 0.001);
    }
});

test('unused space does not stretch short neighboring panels', () => {
    assert.deepEqual(fitPanelColumn([{ height: 220, min: 127 }, { height: 180, min: 127 }], 800, 0), [220, 180]);
});

test('nested list minimum reserves space for fixed action rows as well as the list', () => {
    const c = new PanelResizeController();
    const state = { header: { getBoundingClientRect: () => ({ height: 47 }) }, body: { clientHeight: 260 } };
    assert.equal(c.minimum(state), 127);
    state.scroller = { clientHeight: 148 };
    assert.equal(c.minimum(state), 239);
});

for (const [name, compact, available, collapsed] of [
    ['Grainy Land Animation', 173, 656, 47],
    ['Wordplayer Dither', 304, 614, 0],
    ['Wander Wall General', 199, 440, 0],
    ['Random Lines Settings', 150, 424, 0],
    ['Rays Settings', 206, 524, 0]
]) {
    test(`${name}: growing a scrollable neighbor never creates overflow in a compact panel`, () => {
        const c = new PanelResizeController();
        const neighbor = { panel: { id: 'compact', classList: { contains: () => false } },
            naturalHeight: compact, autoOverflow: false, min: 127, eligible: true };
        const item = c.columnItem(neighbor);
        assert.equal(item.min, compact, 'past eligibility alone must not make this neighbor flexible');
        const items = [{ height: 1000, min: 127 }, item, ...(collapsed ? [{ height: collapsed, min: collapsed }] : [])];
        const fitted = fitPanelColumn(items, available, 0);
        assert.equal(fitted[1], compact);
        assert.equal(fitted[0], available - compact - collapsed);
    });
}

test('explicitly resized and naturally overflowing panels still share a column budget', () => {
    const c = new PanelResizeController();
    const state = { panel: { id: 'panel', classList: { contains: () => false } }, naturalHeight: 304, autoOverflow: true, min: 127 };
    assert.deepEqual(c.columnItem(state), { height: 304, min: 127, fixed: false });
    state.autoOverflow = false;
    c.requested.set('panel', 200);
    assert.deepEqual(c.columnItem(state), { height: 200, min: 127, fixed: false });
    c.requested.delete('panel');
    assert.deepEqual(c.columnItem(state), { height: 304, min: 304, fixed: true });
});

test('a crowded Pizza Boxer stack cannot squeeze Grid to satisfy the other panel minimum', () => {
    assert.deepEqual(fitPanelColumn([
        { height: 574, min: 574, fixed: true }, { height: 150, min: 127, fixed: false }
    ], 626, 1), [574, 52]);
});

function automaticLayoutFixture() {
    const byId = new Map();
    const d = { querySelectorAll: () => [], getElementById: id => byId.get(id) };
    const c = new PanelResizeController({ ownerDocument: d, ownerWindow: { innerHeight: 720 } });
    c.bound = true; c.tool = 'grainy_land'; c.scan = () => {}; c.desktop = () => true;
    const add = (id, height, content, collapsed = false) => {
        const properties = new Map();
        const panel = { id, dataset: {}, style: { getPropertyValue: key => properties.get(key), setProperty: (key, value) => properties.set(key, value) },
            classList: { contains: () => collapsed }, closest: () => null, matches: () => false,
            getClientRects: () => [{}], getBoundingClientRect() {
                const size = 'uiGroupHeight' in this.dataset ? parseFloat(properties.get('--ui-group-height')) : height;
                return { height: size, top: 20, bottom: 20 + size };
            } };
        const body = { scrollTop: 12, get clientHeight() { return panel.getBoundingClientRect().height - 47; },
            get scrollHeight() { return Math.max(this.clientHeight, content); } };
        const state = { panel, body, header: { getBoundingClientRect: () => ({ height: 47 }) },
            handle: { dataset: {}, setAttribute() {} }, eligible: false };
        byId.set(id, panel); c.panels.set(panel, state);
        return state;
    };
    add('canvasPanel', 47, 0, true);
    const composition = add('compositionPanel', 436, 712);
    const animation = add('animationPanel', 173, 126);
    return { c, composition, animation };
}

test('sync measures native layout before eligibility, including saved heights and repeated passes', () => {
    const { c, composition, animation } = automaticLayoutFixture();
    c.requested.set('compositionPanel', 482);
    animation.panel.dataset.uiGroupHeight = '';
    animation.panel.style.setProperty('--ui-group-height', '127px');
    assert.equal(animation.body.scrollHeight - animation.body.clientHeight, 46);
    for (let i = 0; i < 5; i++) {
        c.sync();
        assert.equal(animation.panel.getBoundingClientRect().height, 173);
        assert.equal(animation.eligible, false);
        assert.equal(animation.handle.hidden, true);
        assert.equal(composition.panel.getBoundingClientRect().height, 436);
        assert.equal(composition.max, 436);
        assert.equal(animation.body.scrollTop, 12);
    }
    c.reset(composition);
    assert.equal('uiGroupHeight' in animation.panel.dataset, false);
    assert.equal(animation.panel.getBoundingClientRect().height, 173);
});

test('linked limits protect compact neighbors before the very first resize', () => {
    const { c, composition, animation } = automaticLayoutFixture();
    c.sync();
    assert.equal(composition.max, 436);
    assert.ok(composition.group);
    assert.equal('uiGroupHeight' in animation.panel.dataset, false, 'automatic layout remains native until requested');
});

test('automatic measurements follow content changes and preserve genuine eligibility', () => {
    const { c, animation } = automaticLayoutFixture();
    c.measureAutomatic(animation);
    assert.equal(animation.eligible, false);
    Object.defineProperty(animation.body, 'scrollHeight', { get: () => 326 });
    c.measureAutomatic(animation);
    assert.equal(animation.eligible, true);
    assert.equal(animation.naturalHeight, 373);
    Object.defineProperty(animation.body, 'scrollHeight', { get: () => 126 });
    c.measureAutomatic(animation);
    assert.equal(animation.eligible, true, 'expanding or removing content keeps the resize affordance');
    assert.equal(c.columnItem(animation).min, 173, 'but a compact neighbor is protected again');
});

function fixture(edge = 'bottom') {
    const writes = [], document = { documentElement: { dataset: {} } };
    const c = new PanelResizeController({ ownerDocument: document, ownerWindow: {} });
    c.key = 'yf:panel-heights:v1:fixture'; c.storage = { setItem: (...args) => writes.push(args) };
    c.desktop = () => true; c.sync = () => {}; c.schedule = () => {}; c.intrinsic = () => 800;
    const panel = { id: 'main', dataset: {}, getBoundingClientRect: () => ({ height: 300 }) };
    const handle = { hidden: false, dataset: { edge }, parentElement: panel, setPointerCapture() {}, hasPointerCapture: () => false };
    const state = { panel, handle, min: 127, max: 600 };
    c.panels.set(panel, state);
    const event = (extra = {}) => ({ target: { closest: () => handle }, pointerId: 7, button: 0, pointerType: 'mouse', clientY: 300,
        preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra });
    return { c, state, writes, event };
}

test('bottom-edge pointer drag changes height and persists only at release', () => {
    const { c, writes, event } = fixture();
    const down = event(); c.start(down);
    assert.ok(down.prevented && down.stopped);
    c.move(event({ clientY: 400 }));
    assert.equal(c.requested.get('main'), 400); assert.equal(writes.length, 0);
    c.finish(event());
    assert.equal(writes.length, 1); assert.equal(c.drag, null);
});

test('top-edge drag grows upward without changing its bottom anchor', () => {
    const { c, event } = fixture('top'); c.start(event()); c.move(event({ clientY: 200 }));
    assert.equal(c.requested.get('main'), 400);
});

test('a click without movement does not freeze an automatic height', () => {
    const { c, writes, event } = fixture(); c.start(event()); c.move(event({ clientY: 301 })); c.finish(event());
    assert.equal(c.requested.size, 0); assert.equal(writes.length, 0);
});

test('touch, secondary buttons and unrelated pointer IDs cannot resize panels', () => {
    const { c, event } = fixture();
    c.start(event({ pointerType: 'touch' })); assert.equal(c.drag, null);
    c.start(event({ button: 2 })); assert.equal(c.drag, null);
    c.start(event()); c.move(event({ pointerId: 8, clientY: 500 }));
    assert.equal(c.requested.size, 0);
});

test('pointer cancellation restores the previous requested height without persisting', () => {
    const { c, writes, event } = fixture(); c.requested.set('main', 280);
    c.requested.set('neighbor', 400);
    c.priorityId = 'neighbor';
    c.start(event()); c.move(event({ clientY: 450 })); c.finish(event(), true);
    assert.equal(c.requested.get('main'), 280); assert.equal(writes.length, 0);
    assert.equal(c.priorityId, 'neighbor');
    assert.deepEqual([...c.requested.keys()], ['main', 'neighbor']);
});

test('resizing records per-stack recency in stable preference order', () => {
    const { c } = fixture();
    c.remember('top', 300); c.remember('bottom', 400); c.remember('top', 350); c.remember('otherColumn', 250);
    assert.deepEqual([...c.requested.keys()], ['bottom', 'top', 'otherColumn']);
});

test('Escape cancels captured resizing even when keyboard focus is outside the handle', () => {
    const { c, event } = fixture(); c.start(event()); c.move(event({ clientY: 450 }));
    c.keydown(event({ key: 'Escape', target: { closest: () => null } }));
    assert.equal(c.requested.size, 0); assert.equal(c.drag, null);
});

test('Escape without a drag remains available to the tool and its popover', () => {
    const { c, event } = fixture(); const escape = event({ key: 'Escape' });
    c.keydown(escape); assert.equal(escape.prevented, undefined);
});

test('double click resets only the current panel and tolerates denied storage', () => {
    const { c, event } = fixture(); c.requested.set('main', 400); c.requested.set('other', 500);
    c.storage.setItem = () => { throw Error('denied'); };
    assert.doesNotThrow(() => c.resetEvent(event()));
    assert.deepEqual([...c.requested], [['other', 500]]);
});

test('keyboard arrows use the same direction and Home restores automatic height', () => {
    const { c, event } = fixture('top');
    c.keydown(event({ key: 'ArrowUp', shiftKey: true })); assert.equal(c.requested.get('main'), 350);
    c.keydown(event({ key: 'Home' })); assert.equal(c.requested.size, 0);
});

test('mobile breakpoints and coarse pointer devices do not acquire edge handles', () => {
    const c = new PanelResizeController({ ownerWindow: { innerWidth: 1280, innerHeight: 720 } });
    c.pointerMedia = { matches: true }; c.tool = 'wordplayer'; assert.ok(c.desktop());
    c.pointerMedia.matches = false; assert.equal(c.desktop(), false);
    c.pointerMedia.matches = true; c.window.innerWidth = 768; assert.equal(c.desktop(), false);
    c.window.innerWidth = 1199; c.tool = 'grainy_land'; assert.equal(c.desktop(), false);
    c.window.innerWidth = 900; c.window.innerHeight = 500; c.tool = 'wander_wall'; assert.equal(c.desktop(), false);
});

test('bottom panels use the upper edge, but detached panels and Legend popovers do not', () => {
    const c = new PanelResizeController(); c.tool = 'keyboarder';
    const panel = { id: 'typePanel', dataset: {}, style: {}, closest: () => null, matches: () => false };
    assert.equal(c.bottom({ panel }), true);
    panel.dataset.panelPosition = 'manual'; assert.equal(c.bottom({ panel }), false);
    delete panel.dataset.panelPosition;
    panel.id = 'legendPanel'; panel.matches = selector => selector === '.ui-simple #legendPanel';
    assert.equal(c.bottom({ panel }), false);
    panel.matches = () => false; panel.closest = () => ({});
    assert.equal(c.bottom({ panel }), false);
});

test('lifecycle owns one listener set, coalesces frames and releases everything on destroy', () => {
    const listeners = new Map(), frames = new Map(), observers = [];
    let serial = 0, syncs = 0;
    const target = name => ({
        addEventListener(type, fn) { const key = `${name}:${type}`; if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key).add(fn); },
        removeEventListener(type, fn) { listeners.get(`${name}:${type}`)?.delete(fn); }
    });
    class Observer {
        constructor(callback) { this.callback = callback; observers.push(this); }
        observe() {} unobserve() {} disconnect() { this.disconnected = true; }
    }
    const d = { ...target('document'), body: {}, createElement() {}, querySelectorAll: () => [] };
    const w = { ...target('window'), location: { pathname: '/fixture/' }, ResizeObserver: Observer, MutationObserver: Observer,
        matchMedia: () => ({ ...target('media'), matches: true }),
        requestAnimationFrame(fn) { frames.set(++serial, fn); return serial; }, cancelAnimationFrame(id) { frames.delete(id); } };
    const c = new PanelResizeController({ ownerDocument: d, ownerWindow: w });
    c.sync = () => { syncs++; }; c.init(); c.init();
    assert.equal(listeners.get('document:pointerdown').size, 1);
    const svg = { nodeType: 1, namespaceURI: 'http://www.w3.org/2000/svg', querySelector() { throw Error('do not scan generated artwork'); } };
    observers[1].callback([{ target: svg, type: 'childList', addedNodes: [svg], removedNodes: [] }]);
    observers[1].callback([{ target: {}, type: 'childList', addedNodes: [svg], removedNodes: [] }]);
    assert.equal(frames.size, 0);
    c.schedule(); c.schedule(); assert.equal(frames.size, 1);
    const replacement = new PanelResizeController({ ownerDocument: d, ownerWindow: w });
    replacement.sync = () => {}; replacement.init();
    assert.equal(c.bound, false); assert.equal(frames.size, 0);
    assert.equal(listeners.get('document:pointerdown').size, 1);
    replacement.destroy(); c.schedule();
    assert.equal(frames.size, 0);
    assert.ok(observers.every(observer => observer.disconnected));
    assert.equal([...listeners.values()].reduce((count, set) => count + set.size, 0), 0);
    assert.equal(syncs, 1);
    c.init(); assert.equal(c.bound, true); c.destroy();
});

test('every catalog tool and Pizza Boxer 02 load one common resize module and current stylesheet', async () => {
    const root = new URL('../../../', import.meta.url);
    const catalog = JSON.parse(await readFile(new URL('infra/TOOL_CATALOG.json', root), 'utf8'));
    for (const id of [...catalog.tools.map(tool => tool.id), 'grid_generator_02']) {
        const html = await readFile(new URL(`${id}/index.html`, root), 'utf8');
        assert.equal((html.match(/panelResizeAutoInit\.js/g) || []).length, 1, id);
        assert.match(html, /ui-contract\.css\?v=panel-resize-1/, id);
    }
    for (const id of ['grid_generator', 'grid_generator_02']) {
        const template = await readFile(new URL(`${id}/src/ui/ApplicationDocument.html`, root), 'utf8');
        assert.equal((template.match(/panelResizeAutoInit\.js/g) || []).length, 1, `${id}: future releases must retain resizing`);
        assert.match(template, /ui-contract\.css\?v=panel-resize-1/);
    }
});
