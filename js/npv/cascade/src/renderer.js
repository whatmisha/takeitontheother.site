import { buildCascadeScene, normalizeCascadeSettings } from './cascadeGeometry.js';
import { buildCascadeSphereScene, sphereGuidePathData } from './sphereGeometry.js';

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

function appendSphereSvg(svg, create, scene) {
    if (scene.backPolygons.length) {
        svg.appendChild(create('path', {
            d: cascadePathData(scene.backPolygons),
            fill: scene.settings.foregroundColor,
            opacity: scene.backsideOpacity
        }));
    }
    svg.appendChild(create('path', {
        d: cascadePathData(scene.frontPolygons),
        fill: scene.settings.foregroundColor
    }));
    if (scene.settings.sphereGuides) {
        const group = create('g', { 'data-export-exclude': 'true' });
        group.appendChild(create('path', {
            d: sphereGuidePathData(scene.guides.back),
            fill: 'none',
            stroke: scene.settings.foregroundColor,
            'stroke-width': Math.max(0.65, scene.radius / 360),
            opacity: 0.16,
            'vector-effect': 'non-scaling-stroke'
        }));
        group.appendChild(create('path', {
            d: sphereGuidePathData(scene.guides.front),
            fill: 'none',
            stroke: scene.settings.foregroundColor,
            'stroke-width': Math.max(0.65, scene.radius / 360),
            opacity: 0.46,
            'vector-effect': 'non-scaling-stroke'
        }));
        group.appendChild(create('circle', {
            cx: scene.center.x,
            cy: scene.center.y,
            r: scene.radius,
            fill: 'none',
            stroke: scene.settings.foregroundColor,
            'stroke-width': Math.max(0.8, scene.radius / 300),
            opacity: 0.55,
            'vector-effect': 'non-scaling-stroke'
        }));
        svg.appendChild(group);
    }
}

export function renderCascadeSvgDom(svg, create, width, height, source = {}, options = {}) {
    const settings = normalizeCascadeSettings(source);
    if (!settings.transparentExport || options.forceBackground) {
        svg.appendChild(create('rect', {
            x: 0, y: 0, width, height,
            fill: settings.backgroundColor
        }));
    }
    if (settings.surfaceType === 'sphere') {
        const sphereScene = buildCascadeSphereScene(settings, { width, height, generation: options.generation });
        appendSphereSvg(svg, create, sphereScene);
        return sphereScene;
    }
    const scene = buildCascadeScene(settings, { width, height, generation: options.generation });
    const path = create('path', {
        d: cascadePathData(scene.polygons),
        fill: settings.foregroundColor,
        'fill-rule': 'nonzero'
    });
    if (settings.layoutMode === 'linear' && settings.patternType === 'stripes') {
        path.setAttribute('shape-rendering', 'crispEdges');
    }
    svg.appendChild(path);
    return scene;
}

function fillPolygons(context, polygons, color, opacity = 1) {
    context.save();
    context.globalAlpha = opacity;
    context.fillStyle = color;
    context.beginPath();
    for (const polygon of polygons) {
        const [first, ...rest] = polygon.points;
        if (!first) continue;
        context.moveTo(first.x, first.y);
        rest.forEach((point) => context.lineTo(point.x, point.y));
        context.closePath();
    }
    context.fill();
    context.restore();
}

export function renderCascadeCanvas(context, width, height, source = {}, options = {}) {
    const settings = normalizeCascadeSettings(source);
    const transparent = options.transparent ?? settings.transparentExport;
    context.clearRect(0, 0, width, height);
    if (!transparent) {
        context.fillStyle = settings.backgroundColor;
        context.fillRect(0, 0, width, height);
    }
    if (settings.surfaceType === 'sphere') {
        const sphereScene = buildCascadeSphereScene(settings, { width, height, generation: options.generation });
        fillPolygons(context, sphereScene.backPolygons, settings.foregroundColor, sphereScene.backsideOpacity);
        fillPolygons(context, sphereScene.frontPolygons, settings.foregroundColor);
        return sphereScene;
    }
    const scene = buildCascadeScene(settings, { width, height, generation: options.generation });
    fillPolygons(context, scene.polygons, settings.foregroundColor);
    return scene;
}

export function renderCascadeSvgString(width, height, source = {}, options = {}) {
    const settings = normalizeCascadeSettings(source);
    const background = settings.transparentExport && !options.forceBackground
        ? ''
        : `<rect width="${round(width)}" height="${round(height)}" fill="${settings.backgroundColor}"/>`;
    if (settings.surfaceType === 'sphere') {
        const scene = buildCascadeSphereScene(settings, { width, height, generation: options.generation });
        const back = scene.backPolygons.length
            ? `<path d="${cascadePathData(scene.backPolygons)}" fill="${settings.foregroundColor}" opacity="${scene.backsideOpacity}"/>`
            : '';
        return `<svg xmlns="${XML_NS}" width="${round(width)}" height="${round(height)}" viewBox="0 0 ${round(width)} ${round(height)}">`
            + background
            + back
            + `<path d="${cascadePathData(scene.frontPolygons)}" fill="${settings.foregroundColor}"/>`
            + '</svg>';
    }
    const scene = buildCascadeScene(settings, { width, height, generation: options.generation });
    const crisp = settings.layoutMode === 'linear' && settings.patternType === 'stripes'
        ? ' shape-rendering="crispEdges"'
        : '';
    return `<svg xmlns="${XML_NS}" width="${round(width)}" height="${round(height)}" viewBox="0 0 ${round(width)} ${round(height)}">`
        + background
        + `<path d="${cascadePathData(scene.polygons)}" fill="${settings.foregroundColor}"${crisp}/>`
        + '</svg>';
}
