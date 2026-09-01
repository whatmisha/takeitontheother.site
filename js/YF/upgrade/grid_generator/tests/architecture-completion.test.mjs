import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    createApplicationEventPort,
    createExportDocumentPort,
    createExportPort,
    createGridSettingsPort,
    createObjectEditorPort,
    createPresetApplicationPort
} from '../src/core/ApplicationPorts.js';
import { RenderScheduler } from '../src/core/RenderScheduler.js';
import { SvgAssetTemplateCache } from '../src/svg/SvgAssetTemplateCache.js';
import { ErrorPresenter } from '../src/ui/ErrorPresenter.js';

const projectDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function createApplication() {
    const calls = [];
    const application = {
        lifecycle: { private: true },
        svgSanitizer: {},
        svgExporter: {},
        presetManager: {},
        historyManager: {},
        currentPresetName: 'New',
        presetHistories: new Map(),
        settingsModule: {},
        surfaceManager: {},
        objectDocument: {},
        gridSettingsController: {},
        objectNavigatorController: {},
        objectEditorPanelController: {},
        objectPlacementController: {},
        surfaceCoordinates: {},
        canvasRenderer: {},
        surfaceRenderer: {},
        gridRenderer: {},
        textRenderer: {},
        graphicsRenderer: {},
        textStyleResolver: {},
        exportDocumentBuilder: {},
        dom: {},
        errorPresenter: {},
        typographyUnitController: {},
        colorPanelController: {},
        exportController: {},
        currentEditingBlock: null,
        currentEditingGraphicsId: null
    };
    for (const method of [
        'resetChangesFlag', 'syncApplicationUI', 'updateGrid', 'mmToColumns',
        'recalculateGraphicsWidthFromHeight', 'importSettings', 'undo', 'redo',
        'getStateSnapshot', 'markAsChanged', 'updateEyeIcon', 'syncSurfaceControls',
        'constrainAllObjectsToGrid', 'updateGridDebounced', 'columnsToMm', 'getBlockY',
        'getStyleDisplayName', 'getSurfaceGridContext', 'moveBlockToSurface',
        'rowBaselineToY', 'yToRowBaseline'
    ]) application[method] = function (...args) { calls.push([method, this, args]); };
    return { application, calls };
}

test('composition ports expose bounded capabilities and preserve application binding', () => {
    const { application, calls } = createApplication();
    const ports = [
        createPresetApplicationPort(application),
        createExportDocumentPort(application),
        createExportPort(application),
        createApplicationEventPort(application),
        createGridSettingsPort(application),
        createObjectEditorPort(application)
    ];

    ports.forEach(port => {
        assert.equal(Object.isFrozen(port), true);
        assert.equal('lifecycle' in port, false);
    });
    ports[0].updateGrid('immediate');
    assert.deepEqual(calls.at(-1), ['updateGrid', application, ['immediate']]);
    application.currentPresetName = 'Airis';
    assert.equal(ports[0].currentPresetName, 'Airis');
    assert.equal(ports[2].currentPresetName, 'Airis');
});

test('render scheduler reports deterministic duration metrics', () => {
    const clock = [10, 13, 20, 25];
    let renders = 0;
    const scheduler = new RenderScheduler({
        render: () => { renders += 1; },
        now: () => clock.shift(),
        frameMs: 0
    });

    scheduler.immediate();
    scheduler.immediate();
    assert.equal(renders, 2);
    assert.deepEqual(scheduler.getMetrics(), {
        count: 2,
        totalMs: 8,
        lastMs: 5,
        maxMs: 5,
        averageMs: 4
    });
    scheduler.dispose();
});

test('SVG template cache deduplicates pending work and retries empty or failed loads', async () => {
    const cache = new SvgAssetTemplateCache();
    let loads = 0;
    const first = cache.load('logo', async () => ({ id: ++loads }));
    const second = cache.load('logo', async () => ({ id: ++loads }));
    assert.equal(first, second);
    assert.deepEqual(await second, { id: 1 });
    assert.deepEqual(cache.getMetrics(), { entries: 1, requests: 1, hits: 1 });

    assert.equal(await cache.load('empty', async () => null), null);
    assert.deepEqual(await cache.load('empty', async () => ({ id: ++loads })), { id: 2 });
    await assert.rejects(cache.load('broken', async () => { throw new Error('broken'); }));
    assert.deepEqual(await cache.load('broken', async () => ({ id: ++loads })), { id: 3 });
});

class FakeElement {
    constructor() {
        this.children = [];
        this.attributes = {};
        this.hidden = false;
        this.isConnected = false;
        this.textContent = '';
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    replaceChildren() { this.children = []; }
    append(...children) { this.children.push(...children); }
    remove() { this.isConnected = false; }
}

test('error presenter uses one disposable live region without blocking dialogs', () => {
    const body = new FakeElement();
    body.appendChild = element => {
        element.isConnected = true;
        body.children.push(element);
    };
    const documentRef = {
        body,
        createElement: () => new FakeElement()
    };
    const presenter = new ErrorPresenter({ documentRef, timeoutMs: 60_000 });

    assert.equal(presenter.show(new Error('Network unavailable'), { title: 'Import failed' }), true);
    assert.equal(body.children.length, 1);
    assert.equal(body.children[0].attributes.role, 'alert');
    assert.deepEqual(body.children[0].children.map(child => child.textContent), [
        'Import failed',
        'Network unavailable'
    ]);
    presenter.show('Second failure');
    assert.equal(body.children.length, 1);
    assert.equal(presenter.dispose(), true);
    assert.equal(body.children[0].isConnected, false);
});

test('root shell stays minimal while HTML and CSS modules retain unique element ids', () => {
    const index = fs.readFileSync(path.join(projectDir, 'index.html'), 'utf8');
    const style = fs.readFileSync(path.join(projectDir, 'style.css'), 'utf8');
    const fragmentsDir = path.join(projectDir, 'src', 'ui', 'fragments');
    const fragmentNames = [
        'workspace', 'actions', 'objects', 'typography', 'object-editors'
    ];
    const fragments = fragmentNames.map(name => (
        fs.readFileSync(path.join(fragmentsDir, `${name}.html`), 'utf8')
    ));

    fragmentNames.forEach(name => assert.match(index, new RegExp(`data-ui-fragment="${name}"`)));
    assert.ok(index.split('\n').length < 50);
    assert.equal((style.match(/^@import /gm) || []).length, 8);

    const ids = fragments.flatMap(fragment => (
        [...fragment.matchAll(/\sid="([^"]+)"/g)].map(match => match[1])
    ));
    assert.ok(ids.length > 100);
    assert.equal(new Set(ids).size, ids.length);
});
