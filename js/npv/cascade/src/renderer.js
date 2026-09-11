import { buildCascadeScene, normalizeCascadeSettings } from './cascadeGeometry.js';

const XML_NS = 'http://www.w3.org/2000/svg';
const round = (value) => Number(value.toFixed(3));

export function cascadePathData(polygons) {
    return polygons.map(({ points }) => {
        if (!points.length) return '';
        return `M${round(points[0].x)} ${round(points[0].y)}`
            + points.slice(1).map((point) => `L${round(point.x)} ${round(point.y)}`).join('')
            + 'Z';
    }).join('');
}

export function renderCascadeSvgDom(svg, create, width, height, source = {}, options = {}) {
    const settings = normalizeCascadeSettings(source);
    const scene = buildCascadeScene(settings, { width, height, generation: options.generation });
    if (!settings.transparentExport || options.forceBackground) {
        svg.appendChild(create('rect', {
            x: 0, y: 0, width, height,
            fill: settings.backgroundColor
        }));
    }
    const path = create('path', {
        d: cascadePathData(scene.polygons),
        fill: settings.foregroundColor,
        'fill-rule': 'nonzero'
    });
    if (settings.layoutMode === 'linear') path.setAttribute('shape-rendering', 'crispEdges');
    svg.appendChild(path);
    return scene;
}

export function renderCascadeCanvas(context, width, height, source = {}, options = {}) {
    const settings = normalizeCascadeSettings(source);
    const transparent = options.transparent ?? settings.transparentExport;
    context.clearRect(0, 0, width, height);
    if (!transparent) {
        context.fillStyle = settings.backgroundColor;
        context.fillRect(0, 0, width, height);
    }
    const scene = buildCascadeScene(settings, { width, height, generation: options.generation });
    context.fillStyle = settings.foregroundColor;
    context.beginPath();
    for (const polygon of scene.polygons) {
        const [first, ...rest] = polygon.points;
        if (!first) continue;
        context.moveTo(first.x, first.y);
        rest.forEach((point) => context.lineTo(point.x, point.y));
        context.closePath();
    }
    context.fill();
    return scene;
}

export function renderCascadeSvgString(width, height, source = {}, options = {}) {
    const settings = normalizeCascadeSettings(source);
    const scene = buildCascadeScene(settings, { width, height, generation: options.generation });
    const background = settings.transparentExport && !options.forceBackground
        ? ''
        : `<rect width="${round(width)}" height="${round(height)}" fill="${settings.backgroundColor}"/>`;
    const crisp = settings.layoutMode === 'linear' ? ' shape-rendering="crispEdges"' : '';
    return `<svg xmlns="${XML_NS}" width="${round(width)}" height="${round(height)}" viewBox="0 0 ${round(width)} ${round(height)}">`
        + background
        + `<path d="${cascadePathData(scene.polygons)}" fill="${settings.foregroundColor}"${crisp}/>`
        + '</svg>';
}
