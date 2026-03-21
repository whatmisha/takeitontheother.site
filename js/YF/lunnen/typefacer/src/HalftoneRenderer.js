/**
 * HalftoneRenderer — генерация текстового halftone-паттерна в SVG.
 *
 * Четыре режима отрисовки:
 *   1. size     — кегль меняется, жирность фиксирована
 *   2. weight   — жирность меняется, кегль фиксирован
 *   3. combined — оба параметра меняются одновременно
 *   4. uniform  — кегль меняется, жирность автоматически компенсируется
 *                 так, чтобы толщина штриха оставалась постоянной
 *
 * Ключевая пропорция шрифта Lunnen Display Variable:
 *   fontSize 56.76 @ weight 400  ≈  fontSize 225.29 @ weight 100
 *   → fontSize × weight ≈ 22 616 для одинаковой толщины штриха.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const MIN_WEIGHT = 100;
const MAX_WEIGHT = 400;
const STROKE_CONST = 22616;

export class HalftoneRenderer {

    /**
     * @param {SVGSVGElement} svg
     * @param {Object} settings — proxy Settings
     * @param {number[][]} brightnessMap — [row][col], значения 0..1
     */
    render(svg, settings, brightnessMap) {
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        const w = settings.artboardWidth;
        const h = settings.artboardHeight;

        svg.setAttribute('width', w);
        svg.setAttribute('height', h);

        if (!svg._zoomManaged) {
            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        }

        // Background
        const bg = document.createElementNS(SVG_NS, 'rect');
        bg.setAttribute('width', w);
        bg.setAttribute('height', h);
        bg.setAttribute('fill', settings.bgColor);
        svg.appendChild(bg);

        const cols = settings.resolution;
        const spacing = settings.spacing ?? 1.0;
        const baseCellSize = w / cols;
        const step = baseCellSize * spacing;
        const rows = Math.ceil(h / step);

        const text = settings.text || 'A';
        const chars = [...text];
        const mode = settings.renderMode;
        const contrast = settings.contrast / 100;

        for (let row = 0; row < rows; row++) {
            const mapRow = Math.min(row, brightnessMap.length - 1);

            for (let col = 0; col < cols; col++) {
                const mapCol = Math.min(col, (brightnessMap[mapRow]?.length ?? 1) - 1);
                let brightness = brightnessMap[mapRow]?.[mapCol] ?? 0.5;

                if (settings.invertBrightness) {
                    brightness = 1 - brightness;
                }

                const charIndex = (row * cols + col) % chars.length;
                const char = chars[charIndex];

                const cx = col * baseCellSize + baseCellSize / 2;
                const cy = row * step + step / 2;

                let fontSize, fontWeight;

                switch (mode) {
                    case 'size':
                        ({ fontSize, fontWeight } = this._calcSize(brightness, baseCellSize, contrast, settings.fontWeight));
                        break;
                    case 'weight':
                        ({ fontSize, fontWeight } = this._calcWeight(brightness, baseCellSize, contrast));
                        break;
                    case 'combined':
                        ({ fontSize, fontWeight } = this._calcCombined(brightness, baseCellSize, contrast));
                        break;
                    case 'uniform':
                        ({ fontSize, fontWeight } = this._calcUniform(brightness, baseCellSize, contrast));
                        break;
                    default:
                        ({ fontSize, fontWeight } = this._calcSize(brightness, baseCellSize, contrast, settings.fontWeight));
                }

                if (fontSize < 1) continue;

                const el = document.createElementNS(SVG_NS, 'text');
                el.setAttribute('x', cx);
                el.setAttribute('y', cy);
                el.setAttribute('font-family', 'Lunnen Display');
                el.setAttribute('font-size', fontSize.toFixed(2));
                el.setAttribute('font-weight', Math.round(fontWeight));
                el.setAttribute('fill', settings.textColor);
                el.setAttribute('text-anchor', 'middle');
                el.setAttribute('dominant-baseline', 'central');
                el.textContent = char;
                svg.appendChild(el);
            }
        }
    }

    /** Режим 1: кегль меняется, жирность фиксирована. */
    _calcSize(brightness, cellSize, contrast, fixedWeight) {
        const maxSize = cellSize * 1.1;
        const minSize = maxSize * (1 - contrast);
        const fontSize = minSize + (maxSize - minSize) * brightness;
        return { fontSize: Math.max(fontSize, 0.5), fontWeight: fixedWeight };
    }

    /** Режим 2: жирность меняется, кегль фиксирован. */
    _calcWeight(brightness, cellSize, contrast) {
        const fontSize = cellSize * 0.9;
        const midWeight = (MIN_WEIGHT + MAX_WEIGHT) / 2;
        const halfRange = ((MAX_WEIGHT - MIN_WEIGHT) / 2) * contrast;
        const minW = Math.max(MIN_WEIGHT, midWeight - halfRange);
        const maxW = Math.min(MAX_WEIGHT, midWeight + halfRange);
        const fontWeight = minW + (maxW - minW) * brightness;
        return { fontSize, fontWeight: this._clampWeight(fontWeight) };
    }

    /** Режим 3: оба параметра меняются. */
    _calcCombined(brightness, cellSize, contrast) {
        const maxSize = cellSize * 1.1;
        const minSize = maxSize * (1 - contrast);
        const fontSize = minSize + (maxSize - minSize) * brightness;

        const weightRange = (MAX_WEIGHT - MIN_WEIGHT) * contrast;
        const fontWeight = MIN_WEIGHT + weightRange * brightness;

        return {
            fontSize: Math.max(fontSize, 0.5),
            fontWeight: this._clampWeight(fontWeight)
        };
    }

    /**
     * Режим 4: кегль меняется, жирность компенсируется
     * так, чтобы толщина штриха оставалась постоянной.
     * weight = STROKE_CONST / fontSize, clamped to [100, 400].
     */
    _calcUniform(brightness, cellSize, contrast) {
        const maxSize = cellSize * 1.1;
        const minSize = maxSize * (1 - contrast);
        const fontSize = Math.max(minSize + (maxSize - minSize) * brightness, 0.5);
        const fontWeight = this._clampWeight(STROKE_CONST / fontSize);
        return { fontSize, fontWeight };
    }

    /** @private */
    _clampWeight(w) {
        return Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, w));
    }
}
