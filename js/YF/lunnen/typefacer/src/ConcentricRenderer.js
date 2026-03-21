/**
 * ConcentricRenderer — текст по концентрическим окружностям.
 *
 * Каждое кольцо — строка текста, расположенная по дуге окружности.
 * Символы размещаются через rotate + translate на каждый символ.
 * Содержимое обрезается по границам артборда.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export class ConcentricRenderer {

    /**
     * @param {SVGSVGElement} svg
     * @param {Object} settings — proxy Settings
     */
    render(svg, settings) {
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        const w = settings.artboardWidth;
        const h = settings.artboardHeight;

        svg.setAttribute('width', w);
        svg.setAttribute('height', h);
        svg.setAttribute('overflow', 'hidden');

        if (!svg._zoomManaged) {
            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        }

        const cx = w * (settings.concentricCenterX ?? 50) / 100;
        const cy = h * (settings.concentricCenterY ?? 50) / 100;

        const circleCount  = settings.concentricCount ?? 10;
        const fontSize    = settings.concentricFontSize ?? 24;
        const fontWeight  = settings.concentricFontWeight ?? 200;
        const letterSpacing = settings.concentricLetterSpacing ?? 1.0;
        const startAngle  = settings.concentricStartAngle ?? 0;

        const minRadius = settings.concentricMinRadius ?? 40;
        const maxRadiusToFit = Math.min(cx, w - cx, cy, h - cy);
        const maxRadius = settings.concentricMaxRadius > 0
            ? Math.min(settings.concentricMaxRadius, maxRadiusToFit)
            : maxRadiusToFit;

        const text  = settings.text || 'A';
        const chars = [...text];
        const fill  = settings.textColor;

        const charWidthFactor = 0.6;
        const charWidth = fontSize * charWidthFactor * letterSpacing;

        const defs = document.createElementNS(SVG_NS, 'defs');
        const clipPath = document.createElementNS(SVG_NS, 'clipPath');
        clipPath.setAttribute('id', 'artboardClip');
        const clipRect = document.createElementNS(SVG_NS, 'rect');
        clipRect.setAttribute('width', w);
        clipRect.setAttribute('height', h);
        clipPath.appendChild(clipRect);
        defs.appendChild(clipPath);
        svg.appendChild(defs);

        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('clip-path', 'url(#artboardClip)');

        const bg = document.createElementNS(SVG_NS, 'rect');
        bg.setAttribute('width', w);
        bg.setAttribute('height', h);
        bg.setAttribute('fill', settings.bgColor);
        g.appendChild(bg);

        for (let i = 0; i < circleCount; i++) {
            const t = circleCount === 1 ? 0 : i / (circleCount - 1);
            const radius = minRadius + (maxRadius - minRadius) * t;

            if (radius < 1) continue;

            const circumference = 2 * Math.PI * radius;
            const totalChars = Math.max(1, Math.floor(circumference / charWidth));
            const angleStep = 360 / totalChars;

            for (let c = 0; c < totalChars; c++) {
                const char = chars[c % chars.length];
                const angleDeg = startAngle + c * angleStep;
                const angleRad = (angleDeg * Math.PI) / 180;

                const x = cx + radius * Math.cos(angleRad);
                const y = cy + radius * Math.sin(angleRad);

                const el = document.createElementNS(SVG_NS, 'text');
                el.setAttribute('x', '0');
                el.setAttribute('y', '0');
                el.setAttribute('font-family', 'Lunnen Display');
                el.setAttribute('font-size', fontSize.toFixed(2));
                el.setAttribute('font-weight', Math.round(fontWeight));
                el.setAttribute('fill', fill);
                el.setAttribute('text-anchor', 'middle');
                el.setAttribute('dominant-baseline', 'central');
                el.setAttribute(
                    'transform',
                    `translate(${x.toFixed(2)}, ${y.toFixed(2)}) rotate(${(angleDeg + 90).toFixed(2)})`
                );
                el.textContent = char;
                g.appendChild(el);
            }
        }

        svg.appendChild(g);
    }
}
