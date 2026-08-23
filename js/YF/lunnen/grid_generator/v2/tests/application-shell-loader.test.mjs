import assert from 'node:assert/strict';
import test from 'node:test';

import { loadApplicationShell } from '../src/ui/ApplicationShellLoader.js';

const fragmentNames = [
    'workspace', 'actions', 'objects', 'typography', 'object-editors', 'help'
];

function createDocument() {
    const slots = new Map(fragmentNames.map(name => [name, {
        replacement: null,
        replaceWith(content) { this.replacement = content; }
    }]));
    return {
        documentElement: { dataset: {} },
        querySelector(selector) {
            const name = selector.match(/data-ui-fragment="([^"]+)"/)?.[1];
            return slots.get(name) || null;
        },
        createElement(tagName) {
            assert.equal(tagName, 'template');
            const template = { content: { html: '' } };
            Object.defineProperty(template, 'innerHTML', {
                set(value) { template.content.html = value; }
            });
            return template;
        },
        slots
    };
}

test('application shell fetches each static fragment once before reporting ready', async () => {
    const documentRef = createDocument();
    const requests = [];
    const fetchImpl = async url => {
        requests.push(url);
        const name = new URL(url).pathname.split('/').at(-1).replace('.html', '');
        return { ok: true, status: 200, text: async () => `<section>${name}</section>` };
    };
    const options = { fetchImpl, fragmentsBaseUrl: new URL('https://example.test/fragments/') };

    const firstLoad = loadApplicationShell(documentRef, options);
    const duplicateLoad = loadApplicationShell(documentRef, options);
    assert.equal(firstLoad, duplicateLoad);
    assert.equal(await firstLoad, true);
    assert.equal(documentRef.documentElement.dataset.applicationShell, 'ready');
    assert.equal(requests.length, fragmentNames.length);
    fragmentNames.forEach(name => {
        assert.equal(documentRef.slots.get(name).replacement.html, `<section>${name}</section>`);
    });
    assert.equal(await loadApplicationShell(documentRef, options), false);
    assert.equal(requests.length, fragmentNames.length);
});

test('application shell exposes a deterministic error state on an HTTP failure', async () => {
    const documentRef = createDocument();
    const fetchImpl = async url => ({
        ok: !url.endsWith('/objects.html'),
        status: 404,
        text: async () => ''
    });

    await assert.rejects(
        loadApplicationShell(documentRef, {
            fetchImpl,
            fragmentsBaseUrl: new URL('https://example.test/fragments/')
        }),
        /objects \(404\)/
    );
    assert.equal(documentRef.documentElement.dataset.applicationShell, 'error');
    fragmentNames.forEach(name => assert.equal(documentRef.slots.get(name).replacement, null));
});
