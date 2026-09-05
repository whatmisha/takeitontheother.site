import { ARTBOARD_SIZE } from '../geometry/globalGeometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const escapeXml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

export function createSvgElement(tag, attributes = {}) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([name, value]) => {
        if (value != null) element.setAttribute(name, String(value));
    });
    return element;
}

function markAttributes(mark, path, opacity, selected) {
    return {
        class: 'ellipse-mark',
        'data-ellipse-id': mark.id,
        'data-pair-index': mark.pairIndex,
        'data-selected': selected ? 'true' : 'false',
        d: path,
        fill: mark.color,
        opacity
    };
}

export function renderSceneToSvg(svg, scene, {
    selectedIds = new Set(),
    includeGuides = true
} = {}) {
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${scene.width} ${scene.height}`);

    const defs = createSvgElement('defs');
    const clip = createSvgElement('clipPath', { id: 'global-artboard-clip' });
    clip.appendChild(createSvgElement('rect', { width: scene.width, height: scene.height }));
    defs.appendChild(clip);
    svg.appendChild(defs);
    svg.appendChild(createSvgElement('rect', {
        width: scene.width,
        height: scene.height,
        fill: scene.settings.backgroundColor,
        'data-artboard-background': 'true'
    }));

    const backMarks = createSvgElement('g', { class: 'mark-layer mark-layer--back' });
    const frontMarks = createSvgElement('g', { class: 'mark-layer mark-layer--front' });
    scene.elements.forEach((mark) => {
        const colored = { ...mark, color: scene.settings.ellipseColor };
        if (mark.backPath) {
            backMarks.appendChild(createSvgElement('path', markAttributes(
                colored, mark.backPath, scene.backsideOpacity, selectedIds.has(mark.id)
            )));
        }
        if (mark.frontPath) {
            frontMarks.appendChild(createSvgElement('path', markAttributes(
                colored, mark.frontPath, 1, selectedIds.has(mark.id)
            )));
        }
    });
    svg.append(backMarks, frontMarks);

    if (includeGuides && (scene.settings.showGuides || scene.settings.magnetStrength > 0)) {
        const guides = createSvgElement('g', {
            class: 'guide-layer',
            'data-export-exclude': 'true'
        });
        if (scene.settings.showGuides) {
            guides.appendChild(createSvgElement('path', {
                class: 'guide-wireframe guide-wireframe--back',
                d: scene.wireframe.backPath
            }));
            guides.appendChild(createSvgElement('path', {
                class: 'guide-wireframe guide-wireframe--front',
                d: scene.wireframe.frontPath
            }));
        }
        if (scene.settings.magnetStrength > 0) {
            guides.appendChild(createSvgElement('path', {
                class: 'guide-magnet',
                d: scene.magnet.path
            }));
        }
        svg.appendChild(guides);
    }
}

export function sceneToSvgString(scene, { transparent = false } = {}) {
    const background = transparent
        ? ''
        : `<rect width="${scene.width}" height="${scene.height}" fill="${escapeXml(scene.settings.backgroundColor)}"/>`;
    const pathMarkup = (mark, path, opacity = 1) => path
        ? `<path d="${path}" fill="${escapeXml(scene.settings.ellipseColor)}" opacity="${opacity}"/>`
        : '';
    const backs = scene.elements.map((mark) => pathMarkup(mark, mark.backPath, scene.backsideOpacity)).join('');
    const fronts = scene.elements.map((mark) => pathMarkup(mark, mark.frontPath)).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>\n`
        + `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" `
        + `viewBox="0 0 ${scene.width} ${scene.height}"><defs><clipPath id="artboard"><rect width="${scene.width}" height="${scene.height}"/></clipPath></defs>`
        + `${background}<g>${backs}${fronts}</g></svg>`;
}

function fillPolygon(context, points, color, opacity) {
    if (points.length < 3) return;
    context.save();
    context.globalAlpha = opacity;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.closePath();
    context.fill();
    context.restore();
}

export function drawSceneOnContext(context, scene, {
    size = ARTBOARD_SIZE,
    transparent = false
} = {}) {
    const scale = size / ARTBOARD_SIZE;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, ARTBOARD_SIZE, ARTBOARD_SIZE);
    if (!transparent) {
        context.fillStyle = scene.settings.backgroundColor;
        context.fillRect(0, 0, ARTBOARD_SIZE, ARTBOARD_SIZE);
    }
    scene.elements.forEach((mark) => fillPolygon(
        context, mark.backPoints, scene.settings.ellipseColor, scene.backsideOpacity
    ));
    scene.elements.forEach((mark) => fillPolygon(
        context, mark.frontPoints, scene.settings.ellipseColor, 1
    ));
    context.setTransform(1, 0, 0, 1, 0, 0);
}
