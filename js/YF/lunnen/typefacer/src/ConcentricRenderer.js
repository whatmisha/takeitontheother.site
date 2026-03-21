/**
 * ConcentricRenderer — текст по концентрическим окружностям.
 *
 * Каждое кольцо — строка текста, расположенная по дуге окружности.
 * Символы размещаются через rotate + translate на каждый символ.
 * Содержимое обрезается по границам артборда через clipPath.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export class ConcentricRenderer {

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

        const circleCount   = settings.concentricCount ?? 10;
        const fontSize      = settings.concentricFontSize ?? 24;
        const fontWeight    = settings.concentricFontWeight ?? 200;
        const letterSpacing = settings.concentricLetterSpacing ?? 1.0;
        const startAngle    = settings.concentricStartAngle ?? 0;
        const rotation      = settings.rotation ?? 0;
        const rndmStart     = (settings.concentricRndmStart ?? 0) / 100;
        const rndmSpacing   = (settings.concentricRndmSpacing ?? 0) / 100;
        const fontFeatures  = this._buildFontFeatures(settings);

        const minRadius = settings.concentricMinRadius ?? 40;
        const maxRadiusAuto = Math.max(
            Math.hypot(cx, cy),
            Math.hypot(w - cx, cy),
            Math.hypot(cx, h - cy),
            Math.hypot(w - cx, h - cy)
        );
        const maxRadius = settings.concentricMaxRadius > 0
            ? settings.concentricMaxRadius
            : maxRadiusAuto;

        const text  = settings.text || 'A';
        const chars = this._tokenize(text, settings.otDlig);
        const fill  = settings.textColor;

        const charWidthFactor = 0.6;
        const baseCharWidth = fontSize * charWidthFactor * letterSpacing;

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
            const totalChars = Math.max(1, Math.floor(circumference / baseCharWidth));
            const baseAngleStep = 360 / totalChars;

            const ringStartOffset = rndmStart > 0
                ? this._pseudoRandom(i, 9999) * 360 * rndmStart
                : 0;

            let angleCursor = startAngle + ringStartOffset;
            let charIdx = 0;

            while (charIdx < totalChars) {
                const char = chars[charIdx % chars.length];

                let localStep = baseAngleStep;
                const minStepMultiplier = 1.0 / letterSpacing;
                const minStep = baseAngleStep * minStepMultiplier;
                if (rndmSpacing > 0) {
                    const r = this._pseudoRandom(i, charIdx);
                    const groupRand = this._pseudoRandom(i, charIdx + 7777);
                    const keepBase = groupRand > rndmSpacing;
                    if (keepBase) {
                        localStep = baseAngleStep;
                    } else {
                        localStep = baseAngleStep * (1 + (r * 2 - 1) * rndmSpacing * 3);
                        if (localStep < minStep) localStep = minStep;
                    }
                }

                const angleDeg = angleCursor;
                const angleRad = (angleDeg * Math.PI) / 180;

                const x = cx + radius * Math.cos(angleRad);
                const y = cy + radius * Math.sin(angleRad);

                let rot = angleDeg + 90;
                if (rotation > 0) {
                    const rand = this._pseudoRandom(i, charIdx) * rotation * 2 - rotation;
                    rot += rand;
                }

                const el = document.createElementNS(SVG_NS, 'text');
                el.setAttribute('x', '0');
                el.setAttribute('y', '0');
                el.setAttribute('font-family', 'Lunnen Display');
                el.setAttribute('font-size', fontSize.toFixed(2));
                el.setAttribute('font-weight', Math.round(fontWeight));
                el.setAttribute('fill', fill);
                el.setAttribute('text-anchor', 'middle');
                el.setAttribute('dominant-baseline', 'central');
                if (fontFeatures) el.setAttribute('style', `font-feature-settings: ${fontFeatures};`);
                el.setAttribute(
                    'transform',
                    `translate(${x.toFixed(2)}, ${y.toFixed(2)}) rotate(${rot.toFixed(2)})`
                );
                el.textContent = char;
                g.appendChild(el);

                angleCursor += localStep;
                charIdx++;
            }
        }

        svg.appendChild(g);
    }

    _pseudoRandom(ring, index) {
        const v = Math.sin(ring * 12.9898 + index * 78.233) * 43758.5453;
        return v - Math.floor(v);
    }

    static LIGATURES = ['LUNNEN', 'LNN', 'NN', 'ИИ', 'ИЙ'];

    _tokenize(text, dligEnabled) {
        if (!dligEnabled) return [...text];
        const tokens = [];
        const upper = text.toUpperCase();
        let i = 0;
        while (i < text.length) {
            let matched = false;
            for (const lig of ConcentricRenderer.LIGATURES) {
                if (upper.startsWith(lig, i)) {
                    tokens.push(text.slice(i, i + lig.length));
                    i += lig.length;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                tokens.push(text[i]);
                i++;
            }
        }
        return tokens;
    }

    _buildFontFeatures(settings) {
        const map = [
            ['otSalt', 'salt'],
            ['otAalt', 'aalt'],
            ['otSs01', 'ss01'],
            ['otSs02', 'ss02'],
            ['otDlig', 'dlig'],
            ['otTnum', 'tnum'],
        ];
        const active = map.filter(([k]) => settings[k]).map(([, tag]) => `"${tag}" 1`);
        if (!active.length) return '';
        const base = ['"kern" 1', '"liga" 1'];
        return [...base, ...active].join(', ');
    }
}
