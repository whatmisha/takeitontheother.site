import { TextBlockRenderModel } from './TextBlockRenderModel.js';
import { TextBlockSvgView } from './TextBlockSvgView.js';

/** Coordinates surface-aware text layout and SVG presentation. */
export class TextBlockRenderer {
    constructor({
        settings,
        createSvgElement,
        getContrastColor,
        getStyleSettings,
        getFontMetrics,
        layout,
        attachInteractions = () => {},
        attachResize = () => {},
        isDragging = () => false,
        renderModel = null,
        view = null
    }) {
        this.renderModel = renderModel || new TextBlockRenderModel({
            settings,
            getContrastColor,
            getStyleSettings,
            getFontMetrics,
            layout
        });
        this.view = view || new TextBlockSvgView({
            createSvgElement,
            attachInteractions,
            attachResize,
            isDragging
        });
    }

    draw(container, block, frontX, frontY, _frontWidth, _frontHeight, scale) {
        const model = this.renderModel.create(block, frontX, frontY, scale);
        return this.view.draw(container, block, model, scale);
    }

    getStyleSizeInModules(styleRef = 'text') {
        return this.renderModel.getStyleSizeInModules(styleRef);
    }

    calculateGlyphMetrics(styleRef, useXHeight, scale) {
        return this.renderModel.calculateGlyphMetrics(styleRef, useXHeight, scale);
    }

    calculateFirstLineY(options) {
        return this.renderModel.calculateFirstLineY(options);
    }

    getHorizontalPlacement(textAlign, left, width) {
        return this.renderModel.getHorizontalPlacement(textAlign, left, width);
    }

    createTextAttributes(block, style, anchor, color, scale) {
        return this.view.createTextAttributes(block, style, anchor, color, scale);
    }
}
