import test from 'node:test';
import assert from 'node:assert/strict';
import { PresetDropdownView } from '../src/preset/PresetDropdownView.js';
import { PresetRepository } from '../src/preset/PresetRepository.js';

class FakeClassList {
    constructor(owner) {
        this.owner = owner;
        this.values = new Set();
    }
    add(...names) { names.forEach(name => this.values.add(name)); }
    remove(...names) { names.forEach(name => this.values.delete(name)); }
    toggle(name, force) {
        const active = force === undefined ? !this.values.has(name) : force;
        if (active) this.values.add(name);
        else this.values.delete(name);
        return active;
    }
    contains(name) { return this.values.has(name); }
}

class FakeElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.parentNode = null;
        this.dataset = {};
        this.attributes = {};
        this.style = {};
        this.listeners = new Map();
        this.classList = new FakeClassList(this);
        this.textContent = '';
        this.offsetWidth = 120;
    }
    set className(value) {
        this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean));
    }
    get className() { return [...this.classList.values].join(' '); }
    set innerHTML(_value) { this.children = []; }
    get firstChild() { return this.children[0] || null; }
    get nextSibling() {
        if (!this.parentNode) return null;
        const index = this.parentNode.children.indexOf(this);
        return this.parentNode.children[index + 1] || null;
    }
    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }
    insertBefore(child, reference) {
        child.parentNode = this;
        const index = reference ? this.children.indexOf(reference) : -1;
        if (index < 0) this.children.push(child);
        else this.children.splice(index, 0, child);
        return child;
    }
    remove() {
        if (!this.parentNode) return;
        this.parentNode.children = this.parentNode.children.filter(child => child !== this);
        this.parentNode = null;
    }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(listener);
    }
    emit(type, values = {}) {
        const event = { target: this, stopPropagation() {}, ...values };
        this.listeners.get(type)?.forEach(listener => listener(event));
    }
    matches(selector) {
        if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
        const dataFile = selector.match(/^\[data-file="(.+)"\]$/);
        return dataFile ? this.dataset.file === dataFile[1] : false;
    }
    querySelectorAll(selector) {
        const matches = [];
        const visit = node => node.children.forEach(child => {
            if (child.matches(selector)) matches.push(child);
            visit(child);
        });
        visit(this);
        return matches;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    contains(target) {
        return target === this || this.children.some(child => child.contains(target));
    }
}

class FakeDocument extends FakeElement {
    constructor() {
        super('document');
        this.body = new FakeElement('body');
        this.appendChild(this.body);
    }
    createElement(tagName) { return new FakeElement(tagName); }
}

test('preset repository owns manifest transport and cloned imported data', async () => {
    const requests = [];
    const repository = new PresetRepository({
        fetchImpl: async (url, options) => {
            requests.push({ url, options });
            return url.startsWith('presets/manifest')
                ? { ok: true, json: async () => ({ presets: [{ name: '+ New', file: 'New.json' }] }) }
                : { ok: true, json: async () => ({ presetName: 'A B' }) };
        },
        now: () => 123,
        random: () => 0.5
    });

    assert.deepEqual(await repository.loadManifest(), [{ name: '+ New', file: 'New.json' }]);
    assert.equal(requests[0].url, 'presets/manifest.json?ts=123');
    assert.equal(requests[0].options.cache, 'no-store');
    assert.deepEqual(await repository.loadBuiltIn('A B.json'), { presetName: 'A B' });
    assert.equal(requests[1].url, 'presets/A%20B.json');

    const source = { settings: { gridModule: 5 } };
    const imported = repository.addImported(source, 'Custom');
    source.settings.gridModule = 10;
    assert.match(imported.id, /^imported-123-/);
    assert.equal(repository.getImported(imported.id).data.settings.gridModule, 5);
});

test('preset dropdown view renders, selects and sizes built-in and imported items', () => {
    const documentRef = new FakeDocument();
    const dropdown = new FakeElement();
    const toggle = new FakeElement('button');
    const text = new FakeElement('span');
    text.className = 'preset-dropdown-text';
    toggle.appendChild(text);
    toggle.setAttribute('aria-expanded', 'false');
    const menu = new FakeElement('ul');
    dropdown.appendChild(toggle);
    dropdown.appendChild(menu);
    documentRef.body.appendChild(dropdown);
    const selections = [];
    const view = new PresetDropdownView({
        toggle,
        menu,
        dropdown,
        documentRef,
        onSelect: (file, name) => selections.push({ file, name })
    });
    view.measureTextWidth = value => value.length * 10 + 40;

    assert.equal(view.initialize([
        { name: '+ New', file: 'New.json' },
        { name: 'Products', file: null }
    ]), true);
    assert.equal(menu.querySelectorAll('.preset-dropdown-item').length, 2);
    assert.equal(view.presetWidths['New.json'], 90);

    view.applySelection('New.json', '+ New');
    const newItem = menu.querySelector('[data-file="New.json"]');
    assert.equal(newItem.classList.contains('selected'), true);
    assert.equal(text.textContent, '+ New');
    assert.equal(toggle.style.width, '90px');

    view.open();
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    newItem.emit('click');
    assert.deepEqual(selections, [{ file: 'New.json', name: '+ New' }]);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');

    view.addImportedPreset({ id: 'imported-1', displayName: 'Custom', data: {} });
    assert.ok(menu.querySelector('[data-file="imported-1"]'));
    assert.ok(menu.querySelector('.preset-dropdown-separator'));
});
