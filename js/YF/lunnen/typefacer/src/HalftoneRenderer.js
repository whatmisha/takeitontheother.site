/**
 * HalftoneRenderer — генерация текстового halftone-паттерна в SVG.
 *
 * Два режима:
 *   1. standard — кегль и жирность варьируются независимо,
 *      каждый со своим контрастом (sizeContrast, weightContrast).
 *   2. uniform  — кегль меняется, жирность компенсируется
 *      так, чтобы толщина штриха оставалась постоянной
 *      (K = maxFontSize × 100, weight = K / fontSize).
 *
 * Spacing масштабирует расстояние между буквами по обеим осям.
 * Rotation задаёт максимальный случайный поворот каждой буквы.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

const MIN_WEIGHT = 100;
const MAX_WEIGHT = 400;

export class HalftoneRenderer {

    render(svg, settings, brightnessMap) {
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        const w = settings.artboardWidth;
        const h = settings.artboardHeight;

        svg.setAttribute('width', w);
        svg.setAttribute('height', h);

        if (!svg._zoomManaged) {
            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        }

        const bg = document.createElementNS(SVG_NS, 'rect');
        bg.setAttribute('width', w);
        bg.setAttribute('height', h);
        bg.setAttribute('fill', settings.bgColor);
        svg.appendChild(bg);

        const resolution = settings.resolution;
        const spacing    = settings.spacing ?? 1.0;
        const baseCellSize = w / resolution;
        const step = baseCellSize * spacing;
        const cols = Math.ceil(w / step);
        const rows = Math.ceil(h / step);

        const text  = settings.text || 'A';
        const chars = [...text];
        const mode  = settings.renderMode;

        const sizeContrast   = (settings.sizeContrast ?? 70) / 100;
        const weightContrast = (settings.weightContrast ?? 0) / 100;
        const baseWeight     = settings.fontWeight ?? 200;
        const rotation       = settings.rotation ?? 0;

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

                const cx = col * step + step / 2;
                const cy = row * step + step / 2;

                let fontSize, fontWeight;

                if (mode === 'uniform') {
                    ({ fontSize, fontWeight } = this._calcUniform(brightness, baseCellSize, sizeContrast));
                } else {
                    ({ fontSize, fontWeight } = this._calcStandard(brightness, baseCellSize, sizeContrast, weightContrast, baseWeight));
                }

                if (fontSize < 1) continue;

                const el = document.createElementNS(SVG_NS, 'text');
                el.setAttribute('font-family', 'Lunnen Display');
                el.setAttribute('font-size', fontSize.toFixed(2));
                el.setAttribute('font-weight', Math.round(fontWeight));
                el.setAttribute('fill', settings.textColor);
                el.setAttribute('text-anchor', 'middle');
                el.setAttribute('dominant-baseline', 'central');

                if (rotation > 0) {
                    const angle = this._pseudoRandom(row, col) * rotation * 2 - rotation;
                    el.setAttribute('transform', `translate(${cx.toFixed(2)},${cy.toFixed(2)}) rotate(${angle.toFixed(2)})`);
                    el.setAttribute('x', '0');
                    el.setAttribute('y', '0');
                } else {
                    el.setAttribute('x', cx.toFixed(2));
                    el.setAttribute('y', cy.toFixed(2));
                }

                el.textContent = char;
                svg.appendChild(el);
            }
        }
    }

    /**
     * Standard: sizeContrast и weightContrast независимо управляют
     * диапазоном кегля и жирности. fontWeight slider задаёт минимум.
     */
    _calcStandard(brightness, cellSize, sizeContrast, weightContrast, baseWeight) {
        const maxSize = cellSize * 1.1;
        const minSize = maxSize * (1 - sizeContrast);
        const fontSize = minSize + (maxSize - minSize) * brightness;

        const maxW = baseWeight + (MAX_WEIGHT - baseWeight) * weightContrast;
        const fontWeight = baseWeight + (maxW - baseWeight) * brightness;

        return {
            fontSize: Math.max(fontSize, 0.5),
            fontWeight: this._clampWeight(fontWeight)
        };
    }

    /**
     * Uniform: кегль меняется, жирность = K / fontSize.
     * K = maxFontSize × MIN_WEIGHT, гарантируя weight=100 для max size.
     */
    _calcUniform(brightness, cellSize, sizeContrast) {
        const maxSize = cellSize * 1.1;
        const minSize = maxSize * (1 - sizeContrast);
        const fontSize = Math.max(minSize + (maxSize - minSize) * brightness, 0.5);
        const K = maxSize * MIN_WEIGHT;
        const fontWeight = this._clampWeight(K / fontSize);
        return { fontSize, fontWeight };
    }

    /**
     * Deterministic pseudo-random 0..1 for a grid cell.
     * Same (row, col) always produces the same value.
     */
    _pseudoRandom(row, col) {
        const v = Math.sin(row * 12.9898 + col * 78.233) * 43758.5453;
        return v - Math.floor(v);
    }

    _clampWeight(w) {
        return Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, w));
    }
}
