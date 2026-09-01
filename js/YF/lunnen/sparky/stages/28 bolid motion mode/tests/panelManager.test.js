import assert from 'node:assert/strict';
import test from 'node:test';

import { PanelManager } from '../framework/src/ui/PanelManager.js';

function fakeClassList(initial = []) {
    const values = new Set(initial);
    return {
        contains: (name) => values.has(name),
        toggle(name, force) {
            if (force === undefined ? !values.has(name) : force) values.add(name);
            else values.delete(name);
        }
    };
}

function fakePanel(collapsed = false) {
    const icon = { classList: fakeClassList(collapsed ? ['collapsed'] : []) };
    return {
        isOpen: true,
        element: {
            classList: fakeClassList(collapsed ? ['panel-collapsed'] : []),
            querySelector: () => icon
        },
        icon
    };
}

test('global panel toggle restores only panels that were previously expanded', () => {
    const manager = new PanelManager();
    const general = fakePanel();
    const focus = fakePanel(true);
    const eyes = fakePanel();
    manager.panels.set('general', general);
    manager.panels.set('focus', focus);
    manager.panels.set('eyes', eyes);

    assert.deepEqual(manager.toggleAllCollapsed(), {
        collapsed: true,
        panelIds: ['general', 'eyes']
    });
    assert.equal(general.element.classList.contains('panel-collapsed'), true);
    assert.equal(focus.element.classList.contains('panel-collapsed'), true);
    assert.equal(eyes.element.classList.contains('panel-collapsed'), true);

    assert.deepEqual(manager.toggleAllCollapsed(), {
        collapsed: false,
        panelIds: ['general', 'eyes']
    });
    assert.equal(general.element.classList.contains('panel-collapsed'), false);
    assert.equal(focus.element.classList.contains('panel-collapsed'), true);
    assert.equal(eyes.element.classList.contains('panel-collapsed'), false);
    assert.equal(general.icon.classList.contains('collapsed'), false);
    assert.equal(focus.icon.classList.contains('collapsed'), true);
});
