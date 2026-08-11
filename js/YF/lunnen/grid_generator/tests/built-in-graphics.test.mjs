import test from 'node:test';
import assert from 'node:assert/strict';

import { BuiltInGraphicsController } from '../src/elements/BuiltInGraphicsController.js';
import { ObjectDocumentController } from '../src/elements/ObjectDocumentController.js';

const silentLogger = { log() {}, error() {} };

test('built-in graphics load and finalize once', async () => {
    const requested = [];
    const objectDocument = new ObjectDocumentController();
    let readyCalls = 0;
    const controller = new BuiltInGraphicsController({
        assetController: {
            async load(path) {
                requested.push(path);
                return {
                    width: path.includes('icons') ? 200 : 180,
                    height: 28,
                    content: `<g data-path="${path}"/>`
                };
            }
        },
        objectDocument,
        onReady: () => { readyCalls += 1; },
        logger: silentLogger
    });

    const results = await controller.initialize();

    assert.deepEqual(requested, ['graphics/icons.svg', 'graphics/yf_claim.svg']);
    assert.deepEqual(results, [
        { id: 'icons', loaded: true },
        { id: 'claim', loaded: true }
    ]);
    assert.equal(objectDocument.getGraphicsBlock('icons').originalWidth, 200);
    assert.equal(objectDocument.getGraphicsBlock('claim').originalWidth, 180);
    assert.match(objectDocument.getGraphicsBlock('icons').svgContent, /icons\.svg/);
    assert.equal(readyCalls, 1);
});

test('failed built-in asset keeps document fallback and still finalizes', async () => {
    const objectDocument = new ObjectDocumentController();
    const icons = objectDocument.getGraphicsBlock('icons');
    icons.svgContent = '<g id="fallback"/>';
    let readyResults;
    const controller = new BuiltInGraphicsController({
        assetController: {
            async load(path) {
                if (path.includes('icons')) throw new Error('offline');
                return null;
            }
        },
        objectDocument,
        onReady: results => { readyResults = results; },
        logger: silentLogger
    });

    const results = await controller.initialize();

    assert.deepEqual(results, [
        { id: 'icons', loaded: false },
        { id: 'claim', loaded: false }
    ]);
    assert.deepEqual(readyResults, results);
    assert.equal(icons.svgContent, '<g id="fallback"/>');
});

test('preset may omit an optional built-in object without reporting an error', async () => {
    const objectDocument = new ObjectDocumentController();
    objectDocument.replaceGraphicsBlocks([
        objectDocument.getGraphicsBlock('claim')
    ]);
    const errors = [];
    const controller = new BuiltInGraphicsController({
        assetController: {
            async load(path) {
                return { width: 100, height: 20, content: `<g data-path="${path}"/>` };
            }
        },
        objectDocument,
        logger: { log() {}, error: (...args) => errors.push(args) }
    });

    const results = await controller.initialize();

    assert.deepEqual(results[0], { id: 'icons', loaded: false, skipped: true });
    assert.deepEqual(results[1], { id: 'claim', loaded: true });
    assert.deepEqual(errors, []);
});
