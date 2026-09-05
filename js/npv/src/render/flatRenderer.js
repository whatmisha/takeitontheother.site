const SVG_NS = 'http://www.w3.org/2000/svg';

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
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${scene.width} ${scene.height}`);

    const defs = createSvgElement('defs');
    const clip = createSvgElement('clipPath', { id: 'flat-artboard-clip' });
    clip.appendChild(createSvgElement('rect', { width: scene.width, height: scene.height }));
    defs.appendChild(clip);
    svg.appendChild(defs);
    svg.appendChild(createSvgElement('rect', {
        width: scene.width,
        height: scene.height,
        fill: scene.settings.backgroundColor,
        'data-artboard-background': 'true'
    }));

    const marks = createSvgElement('g', { 'clip-path': 'url(#flat-artboard-clip)' });
    scene.elements.forEach((mark) => {
        marks.appendChild(createSvgElement('ellipse', ellipseAttributes(mark, scene.settings.ellipseColor)));
    });
    svg.appendChild(marks);

    if (includeGuides && scene.settings.showField) {
        const guides = createSvgElement('g', { class: 'guide-layer', 'data-export-exclude': 'true' });
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
        svg.appendChild(guides);
    }
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
