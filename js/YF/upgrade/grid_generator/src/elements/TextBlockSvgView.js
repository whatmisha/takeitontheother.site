const DISPLAY_FEATURES = ['salt', 'aalt', 'ss01', 'ss02', 'tnum', 'dlig'];

/** Creates SVG nodes and editor affordances from a prepared render model. */
export class TextBlockSvgView {
    constructor({ createSvgElement, attachInteractions, attachResize, isDragging }) {
        this.createSvgElement = createSvgElement;
        this.attachInteractions = attachInteractions;
        this.attachResize = attachResize;
        this.isDragging = isDragging;
    }

    draw(container, block, model, scale) {
        const group = this.createSvgElement('g', {
            id: `text-group-${block.id}`,
            style: 'cursor: move;',
            'data-block-id': block.id
        }, container);
        if (model.kind === 'placeholder') {
            this.drawPlaceholder(group, block, model, scale);
            return group;
        }

        const attributes = this.createTextAttributes(block, model.style, model.anchor, model.color, scale);
        model.lines.forEach(line => {
            const element = this.createSvgElement('text', {
                ...attributes,
                x: line.x,
                y: line.y
            }, group);
            element.textContent = line.text;
        });
        if (model.editor) this.drawEditorControls(container, group, block, model.editor, model.color);
        return group;
    }

    drawPlaceholder(group, block, model, scale) {
        const placeholder = this.createSvgElement('text', {
            x: model.x,
            y: model.y,
            'font-family': 'TT Commons Classic, -apple-system, BlinkMacSystemFont, sans-serif',
            'font-size': `${14 * scale}`,
            fill: model.color,
            'fill-opacity': '0.3',
            style: 'cursor: move;'
        }, group);
        placeholder.textContent = 'Click to add text';
        this.attachInteractions(group, block);
    }

    createTextAttributes(block, style, anchor, color, scale) {
        const attributes = {
            'font-family': `${style.fontFamily}, -apple-system, BlinkMacSystemFont, sans-serif`,
            'font-weight': (block.styleRef === 'lunnenDisplay' && block.fontWeight
                ? block.fontWeight
                : style.fontWeight).toString(),
            'font-size': `${style.fontSize * scale}`,
            'text-anchor': anchor,
            fill: color,
            'fill-opacity': '1',
            'letter-spacing': `${style.tracking}em`
        };
        if (block.styleRef !== 'lunnenDisplay') return attributes;

        const inlineStyles = [];
        if (block.fontWeight) {
            const weight = `'wght' ${block.fontWeight}`;
            attributes['font-variation-settings'] = weight;
            inlineStyles.push(`font-variation-settings: ${weight}`);
        }
        const features = DISPLAY_FEATURES
            .filter(feature => block.fontFeatures?.[feature])
            .map(feature => `'${feature}' 1`);
        if (features.length > 0) {
            const value = features.join(', ');
            attributes['font-feature-settings'] = value;
            inlineStyles.push(`font-feature-settings: ${value}`);
        }
        if (inlineStyles.length > 0) attributes.style = `${inlineStyles.join('; ')};`;
        return attributes;
    }

    drawEditorControls(container, group, block, geometry, color) {
        const common = { 'data-block-id': block.id };
        const hover = this.createSvgElement('rect', {
            id: `hover-area-${block.id}`,
            x: geometry.x,
            y: geometry.y,
            width: geometry.width,
            height: geometry.height,
            fill: 'transparent',
            'fill-opacity': '0',
            stroke: 'none',
            style: 'pointer-events: all; cursor: move;',
            ...common
        }, container);
        const bounds = this.createSvgElement('rect', {
            id: `bounds-${block.id}`,
            x: geometry.x,
            y: geometry.y,
            width: geometry.width,
            height: geometry.height,
            fill: 'rgba(255, 255, 255, 0.05)',
            stroke: color,
            'stroke-width': '1',
            'stroke-opacity': '0',
            'fill-opacity': '0',
            style: 'pointer-events: none; transition: opacity 0.2s;',
            ...common
        }, container);
        const handle = this.createSvgElement('rect', {
            id: `resize-handle-${block.id}`,
            x: geometry.handleX,
            y: geometry.y,
            width: 4,
            height: geometry.height,
            fill: color,
            'fill-opacity': '0',
            stroke: 'none',
            style: 'cursor: ew-resize; pointer-events: all; transition: opacity 0.2s;',
            'vector-effect': 'non-scaling-size',
            ...common
        }, container);
        group.boundsElement = bounds;
        group.hoverArea = hover;
        group.resizeHandle = handle;
        this.attachInteractions(hover, block);
        this.attachResize(handle, block);
        hover.addEventListener('mouseenter', () => {
            if (!this.isDragging()) {
                bounds.setAttribute('stroke-opacity', '0.5');
                bounds.setAttribute('fill-opacity', '0.05');
            }
            handle.setAttribute('fill-opacity', '0.2');
        });
        hover.addEventListener('mouseleave', () => {
            if (!this.isDragging()) {
                bounds.setAttribute('stroke-opacity', '0');
                bounds.setAttribute('fill-opacity', '0');
            }
            handle.setAttribute('fill-opacity', '0');
        });
    }
}
