const SVG_NS = 'http://www.w3.org/2000/svg';
const surfaces = new WeakMap();

const escapeXml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

function createSvgElement(tag, attributes = {}) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([name, value]) => {
        if (value != null) element.setAttribute(name, String(value));
    });
    return element;
}

function ellipseAttributes(mark, color) {
    return {
        class: 'flat-mark',
        'data-flat-id': mark.id,
        'data-flat-role': mark.role,
        cx: mark.cx.toFixed(3),
        cy: mark.cy.toFixed(3),
        rx: mark.rx.toFixed(3),
        ry: mark.ry.toFixed(3),
        fill: color
    };
}

export function renderFlatSceneToSvg(svg, scene, { includeGuides = true } = {}) {
    let surface = surfaces.get(svg);
    if (!surface || surface.count !== scene.elements.length) {
        svg.replaceChildren();
        const defs = createSvgElement('defs');
        const clip = createSvgElement('clipPath', { id: 'flat-artboard-clip' });
        const clipRect = createSvgElement('rect');
        clip.appendChild(clipRect);
        defs.appendChild(clip);
        const background = createSvgElement('rect', { 'data-artboard-background': 'true' });
        const marks = createSvgElement('g', { 'clip-path': 'url(#flat-artboard-clip)' });
        const nodes = scene.elements.map(() => createSvgElement('ellipse'));
        nodes.forEach((node) => marks.appendChild(node));
        const guides = createSvgElement('g', { class: 'guide-layer', 'data-export-exclude': 'true' });
        svg.append(defs, background, marks, guides);
        surface = { count: nodes.length, clipRect, background, nodes, guides };
        surfaces.set(svg, surface);
    }
    svg.setAttribute('viewBox', `0 0 ${scene.width} ${scene.height}`);
    for (const rect of [surface.clipRect, surface.background]) {
        rect.setAttribute('width', scene.width);
        rect.setAttribute('height', scene.height);
    }
    surface.background.setAttribute('fill', scene.settings.backgroundColor);
    scene.elements.forEach((mark, index) => {
        const node = surface.nodes[index];
        Object.entries(ellipseAttributes(mark, scene.settings.ellipseColor)).forEach(([key, value]) => {
            if (node.getAttribute(key) !== String(value)) node.setAttribute(key, value);
        });
    });
    surface.guides.replaceChildren();
    if (includeGuides && scene.settings.showField) {
        const guides = surface.guides;
        (scene.fields || [scene.field]).filter(Boolean).forEach((field) => {
            guides.appendChild(createSvgElement('circle', {
                class: `guide-field guide-field--${field.kind}`,
                'data-field-id': field.id,
                cx: field.x,
                cy: field.y,
                r: field.radius
            }));
            guides.appendChild(createSvgElement('circle', {
                class: `guide-field-point guide-field-point--${field.kind}`,
                'data-field-id': field.id,
                cx: field.x,
                cy: field.y,
                r: 2.5
            }));
            if (field.head && field.shoulders) {
                guides.appendChild(createSvgElement('line', {
                    class: 'guide-field-axis',
                    'data-field-id': field.id,
                    x1: field.head.cx,
                    y1: field.head.cy,
                    x2: field.shoulders.cx,
                    y2: field.shoulders.cy
                }));
            }
        });
    }
}

export function drawFlatSceneOnContext(context, scene, { width, height, transparent = false }) {
    context.setTransform(width / scene.width, 0, 0, height / scene.height, 0, 0);
    context.clearRect(0, 0, scene.width, scene.height);
    if (!transparent) {
        context.fillStyle = scene.settings.backgroundColor;
        context.fillRect(0, 0, scene.width, scene.height);
    }
    context.fillStyle = scene.settings.ellipseColor;
    context.beginPath();
    for (const mark of scene.elements) {
        if (mark.rx <= 0 || mark.ry <= 0) continue;
        context.moveTo(mark.cx + mark.rx, mark.cy);
        context.ellipse(mark.cx, mark.cy, mark.rx, mark.ry, 0, 0, Math.PI * 2);
    }
    context.fill();
    context.setTransform(1, 0, 0, 1, 0, 0);
}

export function flatSceneToSvgString(scene, { transparent = false } = {}) {
    const background = transparent
        ? ''
        : `<rect width="${scene.width}" height="${scene.height}" fill="${escapeXml(scene.settings.backgroundColor)}"/>`;
    const ellipses = scene.elements.map((mark) => (
        `<ellipse cx="${mark.cx.toFixed(3)}" cy="${mark.cy.toFixed(3)}" `
        + `rx="${mark.rx.toFixed(3)}" ry="${mark.ry.toFixed(3)}" `
        + `fill="${escapeXml(scene.settings.ellipseColor)}"/>`
    )).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>\n`
        + `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" `
        + `viewBox="0 0 ${scene.width} ${scene.height}">`
        + `<defs><clipPath id="artboard"><rect width="${scene.width}" height="${scene.height}"/></clipPath></defs>`
        + `${background}<g clip-path="url(#artboard)">${ellipses}</g></svg>`;
}
