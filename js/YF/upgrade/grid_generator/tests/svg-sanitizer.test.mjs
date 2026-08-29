import assert from 'node:assert/strict';
import test from 'node:test';

import { SvgSanitizer } from '../src/svg/SvgSanitizer.js';

class FakeElement {
    constructor(localName, attributes = {}, children = [], textContent = '') {
        this.localName = localName;
        this.attributes = Object.entries(attributes).map(([name, value]) => ({ name, value }));
        this.children = children;
        this.textContent = textContent;
        children.forEach(child => { child.parent = this; });
    }

    querySelectorAll() {
        return this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
    }

    remove() {
        if (!this.parent) return;
        this.parent.children = this.parent.children.filter(child => child !== this);
    }

    removeAttribute(name) {
        this.attributes = this.attributes.filter(attribute => attribute.name !== name);
    }

    setAttribute(name, value) {
        const attribute = this.attributes.find(candidate => candidate.name === name);
        if (attribute) attribute.value = value;
        else this.attributes.push({ name, value });
    }

    getAttribute(name) {
        return this.attributes.find(attribute => attribute.name === name)?.value ?? null;
    }
}

test('SVG sanitizer removes executable nodes, handlers and external references', () => {
    const unsafePath = new FakeElement('path', {
        onload: 'alert(1)',
        style: 'fill:url(https://example.test/a.svg);stroke:url(#safe)'
    });
    const unsafeUse = new FakeElement('use', { href: 'javascript:alert(1)' });
    const safeUse = new FakeElement('use', { href: '#symbol' });
    const style = new FakeElement(
        'style',
        {},
        [],
        '@import "https://example.test/a.css";.a{fill:url(https://example.test/a.svg)}.b{clip-path:url(#clip)}'
    );
    const root = new FakeElement('svg', {}, [
        new FakeElement('script'),
        new FakeElement('foreignObject'),
        unsafePath,
        unsafeUse,
        safeUse,
        style
    ]);

    new SvgSanitizer().sanitizeElement(root);

    assert.deepEqual(root.children.map(child => child.localName), ['path', 'use', 'use', 'style']);
    assert.equal(unsafePath.getAttribute('onload'), null);
    assert.equal(unsafePath.getAttribute('style'), 'fill:none;stroke:url(#safe)');
    assert.equal(unsafeUse.getAttribute('href'), null);
    assert.equal(safeUse.getAttribute('href'), '#symbol');
    assert.doesNotMatch(style.textContent, /@import|https:/);
    assert.match(style.textContent, /url\(#clip\)/);
});
