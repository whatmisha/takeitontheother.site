export class SurfaceLayerFactory {
    constructor({ surfaceManager, createSvgElement }) {
        this.surfaceManager = surfaceManager;
        this.createSvgElement = createSvgElement;
    }

    create(container, surface, layout, suffix = 'display') {
        const geometry = this.surfaceManager.getGeometry(surface, layout);
        const clipId = `surface-clip-${suffix}-${surface}`;
        let defs = container.querySelector(':scope > defs[data-surface-defs]');
        if (!defs) defs = this.createSvgElement('defs', { 'data-surface-defs': suffix }, container);
        const clipPath = this.createSvgElement('clipPath', {
            id: clipId,
            clipPathUnits: 'userSpaceOnUse'
        }, defs);
        this.createSvgElement('rect', {
            x: 0,
            y: 0,
            width: geometry.localWidth,
            height: geometry.localHeight
        }, clipPath);
        const layer = this.createSvgElement('g', {
            id: `surface-${suffix}-${surface}`,
            transform: geometry.transform,
            'clip-path': `url(#${clipId})`,
            'data-surface': surface
        }, container);
        return { layer, geometry };
    }
}
