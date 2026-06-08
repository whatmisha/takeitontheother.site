import { SeededRandom } from './SeededRandom.js';

const TWO_PI = Math.PI * 2;

const PALETTES = {
    vivid: ['#075fff', '#f52a75', '#fff13b', '#ff8a2b', '#25d5df', '#66d878', '#bd2ce0', '#ff4338'],
    soft: ['#8fd4ff', '#ff96bc', '#ffe878', '#ffbd78', '#96eced', '#9ce5a7', '#d99af4', '#ff9f93'],
    electric: ['#075fff', '#ff2aa3', '#dfff18', '#00c8ff', '#ff6c00', '#6bff70', '#7a20ff', '#111111']
};

export class PencilRenderer {
    constructor() {
        this.characterSvg = null;
    }

    setCharacterSvg(svgText) {
        this.characterSvg = parseCharacterSvg(svgText);
    }

    render(canvas, settings) {
        const startedAt = performance.now();
        const width = Math.round(settings.width);
        const height = Math.round(settings.height);
        const rng = new SeededRandom(settings.seed);
        const transparent = Boolean(settings.transparentBackground);
        const ctx = canvas.getContext('2d', { alpha: transparent });

        canvas.width = width;
        canvas.height = height;
        canvas.style.aspectRatio = `${width} / ${height}`;

        if (transparent) {
            ctx.clearRect(0, 0, width, height);
        } else {
            this.drawPaper(ctx, width, height, settings, rng);
        }

        const palette = this.createPalette(settings);
        const globalShape = this.createGlobalShape(width, height, settings, rng);
        const spots = this.createSpots(width, height, settings, palette, globalShape, rng);

        ctx.save();
        ctx.globalCompositeOperation = this.getSpotCompositeMode(settings);
        spots.forEach((spot) => this.drawSpot(ctx, spot, globalShape, settings, rng));
        ctx.restore();

        this.drawCharacter(ctx, width, height, settings);

        if (!transparent) {
            this.drawPaperVignette(ctx, width, height);
        }

        const metrics = this.sampleCanvas(ctx, width, height);

        return {
            width,
            height,
            seed: settings.seed,
            palette,
            spotCount: spots.length,
            coloredSamples: metrics.coloredSamples,
            durationMs: Math.round(performance.now() - startedAt)
        };
    }

    drawPaper(ctx, width, height, settings, rng) {
        ctx.fillStyle = normalizeColor(settings.backgroundColor, '#ffffff');
        ctx.fillRect(0, 0, width, height);

        if (!settings.showPaperGrain || settings.paperGrain <= 0) return;

        const grain = settings.paperGrain / 100;
        const scale = Math.max(2, Math.round(Math.min(width, height) / 520));
        const tw = Math.ceil(width / scale);
        const th = Math.ceil(height / scale);
        const texture = document.createElement('canvas');
        const textureCtx = texture.getContext('2d');
        texture.width = tw;
        texture.height = th;

        const image = textureCtx.createImageData(tw, th);
        const data = image.data;

        for (let i = 0; i < data.length; i += 4) {
            const fiber = rng.gaussian(0, 1) * 12 * grain;
            const warm = rng.range(-2, 3) * grain;
            const value = Math.max(220, Math.min(255, 242 + fiber));
            data[i] = value + warm;
            data[i + 1] = value + warm * 0.6;
            data[i + 2] = value - 4;
            data[i + 3] = 255;
        }

        textureCtx.putImageData(image, 0, 0);
        ctx.save();
        ctx.globalAlpha = 0.38 + 0.34 * grain;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(texture, 0, 0, width, height);
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.03 * grain;
        ctx.strokeStyle = '#9c9488';
        ctx.lineWidth = 1;
        for (let y = rng.range(-20, 20); y < height + 20; y += rng.range(8, 20)) {
            ctx.beginPath();
            ctx.moveTo(0, y + rng.gaussian(0, 1.8));
            for (let x = 0; x <= width; x += 90) {
                ctx.lineTo(x, y + rng.gaussian(0, 2.5));
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    drawPaperVignette(ctx, width, height) {
        const gradient = ctx.createRadialGradient(width * 0.48, height * 0.42, width * 0.18, width * 0.5, height * 0.5, width * 0.72);
        gradient.addColorStop(0, 'rgba(255,255,255,0.08)');
        gradient.addColorStop(1, 'rgba(210,204,194,0.14)');
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }

    drawCharacter(ctx, width, height, settings) {
        if (!settings.showCharacter || !this.characterSvg) return;

        const { viewBox, elements } = this.characterSvg;
        const sourceWidth = viewBox.width || 1200;
        const sourceHeight = viewBox.height || 1200;
        const scale = Math.min(width / sourceWidth, height / sourceHeight);
        const targetWidth = sourceWidth * scale;
        const targetHeight = sourceHeight * scale;
        const x = (width - targetWidth) / 2;
        const y = (height - targetHeight) / 2;
        const colors = {
            eyes: normalizeColor(settings.eyesColor, '#000000'),
            legs: normalizeColor(settings.legsColor, '#000000')
        };

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.translate(-viewBox.x, -viewBox.y);
        elements.forEach((element) => this.drawCharacterElement(ctx, element, colors[element.group]));
        ctx.restore();
    }

    drawCharacterElement(ctx, element, color) {
        ctx.save();

        if (element.type === 'ellipse') {
            ctx.fillStyle = color;
            ctx.translate(element.cx, element.cy);
            if (element.rotation) {
                ctx.rotate(element.rotation);
            }
            ctx.beginPath();
            ctx.ellipse(0, 0, element.rx, element.ry, 0, 0, TWO_PI);
            ctx.fill();
        }

        if (element.type === 'path' && typeof Path2D !== 'undefined') {
            ctx.strokeStyle = color;
            ctx.lineWidth = element.strokeWidth;
            ctx.lineCap = element.lineCap;
            ctx.stroke(new Path2D(element.d));
        }

        ctx.restore();
    }

    getSpotCompositeMode(settings) {
        if (settings.transparentBackground) return 'source-over';
        return settings.spotBlendMode === 'overlap' ? 'source-over' : 'multiply';
    }

    createPalette(settings) {
        const source = PALETTES[settings.paletteMode] || PALETTES.vivid;
        return source.slice(0, Math.max(1, settings.colorCount));
    }

    createGlobalShape(width, height, settings, rng) {
        const minDim = Math.min(width, height);
        const character = settings.shapeCharacter / 100;
        const spread = settings.spread / 100;
        const center = {
            x: width * (0.5 + rng.gaussian(0, 0.025)),
            y: height * (0.48 + rng.gaussian(0, 0.03))
        };
        const rx = lerp(minDim * 0.22, minDim * 0.38, spread);
        const ry = lerp(minDim * 0.2, minDim * 0.34, spread) * rng.range(0.84, 1.12);
        const rotation = rng.range(-0.22, 0.22);
        const count = 192;
        const radii = [];

        const boubaWaves = [
            { freq: 2, amp: rng.range(0.09, 0.18), phase: rng.range(0, TWO_PI) },
            { freq: 3, amp: rng.range(0.05, 0.12), phase: rng.range(0, TWO_PI) },
            { freq: 5, amp: rng.range(0.018, 0.055), phase: rng.range(0, TWO_PI) }
        ];
        const spikeCount = rng.int(9, 15);
        const spikes = Array.from({ length: spikeCount }, () => ({
            angle: rng.range(0, TWO_PI),
            width: rng.range(0.035, 0.085),
            height: rng.range(0.28, 0.9)
        }));

        for (let i = 0; i < count; i += 1) {
            const angle = (i / count) * TWO_PI;
            let bouba = 0.9;
            boubaWaves.forEach((wave) => {
                bouba += Math.sin(angle * wave.freq + wave.phase) * wave.amp;
            });
            bouba = clamp(bouba, 0.66, 1.15);

            let kiki = 0.62 + rng.gaussian(0, 0.022);
            spikes.forEach((spike) => {
                const d = angularDistance(angle, spike.angle);
                const t = Math.max(0, 1 - d / spike.width);
                kiki += spike.height * t;
            });
            kiki += Math.sin(angle * rng.int(13, 19) + rng.range(0, TWO_PI)) * 0.045;
            kiki = clamp(kiki, 0.46, 1.48);

            const mixed = lerp(bouba, kiki, smoothstep(0.08, 0.95, character));
            radii.push(mixed);
        }

        return {
            center,
            rx,
            ry,
            rotation,
            radii,
            feather: lerp(minDim * 0.038, minDim * 0.018, character)
        };
    }

    createSpots(width, height, settings, palette, globalShape, rng) {
        const minDim = Math.min(width, height);
        const spread = settings.spread / 100;
        const character = settings.shapeCharacter / 100;
        const colorCount = Math.max(1, settings.colorCount);
        const extraSpots = Math.floor((colorCount + 7) * Math.pow(spread, 1.55));
        const spotCount = Math.max(colorCount, colorCount + extraSpots);
        const spots = [];
        const sizeScale = lerp(1.65, 0.5, clamp((spotCount - 1) / 13, 0, 1));

        for (let i = 0; i < spotCount; i += 1) {
            const local = character > 0.58 && rng.chance(lerp(0.12, 0.72, character))
                ? this.randomPointNearShapeEdge(globalShape, rng, character)
                : this.randomPointInShape(globalShape, rng, lerp(0.42, 0.9, spread));
            const color = palette[i % palette.length];
            const sizeJitter = rng.range(0.78, 1.25);
            const rx = minDim * lerp(0.13, 0.21, spread) * sizeJitter * sizeScale * rng.range(0.86, 1.24);
            const ry = minDim * lerp(0.12, 0.2, spread) * sizeJitter * sizeScale * rng.range(0.82, 1.22);
            const angle = rng.range(-Math.PI * 0.42, Math.PI * 0.42) + rng.choice([-1, 1]) * rng.range(0.03, 0.72);

            spots.push({
                id: i,
                color,
                x: local.x,
                y: local.y,
                rx,
                ry,
                angle,
                phase: rng.range(0, TWO_PI),
                pressure: rng.range(0.82, 1.18),
                edgeFeather: lerp(0.18, 0.08, character)
            });
        }

        return spots;
    }

    randomPointNearShapeEdge(shape, rng, character) {
        let bestAngle = rng.range(0, TWO_PI);
        let bestRadius = 0;
        for (let i = 0; i < 7; i += 1) {
            const candidate = rng.range(0, TWO_PI);
            const radius = this.radiusAt(shape, candidate);
            if (radius > bestRadius) {
                bestRadius = radius;
                bestAngle = candidate;
            }
        }

        const radial = bestRadius * rng.range(lerp(0.46, 0.56, character), lerp(0.66, 0.74, character));
        const local = rotatePoint(
            Math.cos(bestAngle) * radial * shape.rx,
            Math.sin(bestAngle) * radial * shape.ry,
            shape.rotation
        );

        return {
            x: shape.center.x + local.x,
            y: shape.center.y + local.y
        };
    }

    randomPointInShape(shape, rng, maxRadius = 0.9) {
        for (let attempt = 0; attempt < 80; attempt += 1) {
            const angle = rng.range(0, TWO_PI);
            const r = Math.sqrt(rng.next()) * maxRadius * this.radiusAt(shape, angle);
            const local = rotatePoint(r * Math.cos(angle) * shape.rx, r * Math.sin(angle) * shape.ry, shape.rotation);
            const point = {
                x: shape.center.x + local.x,
                y: shape.center.y + local.y
            };
            if (this.globalFalloff(point.x, point.y, shape) > 0.5) return point;
        }
        return { ...shape.center };
    }

    drawSpot(ctx, spot, globalShape, settings, rng) {
        const density = settings.strokeDensity / 100;
        const softness = settings.pencilSoftness / 100;
        const deviation = settings.hatchDeviation / 100;
        const pencilWidth = settings.pencilWidth;
        const layerCount = Math.round(lerp(1, 4, density) + lerp(0, 2, softness));

        for (let layer = 0; layer < layerCount; layer += 1) {
            const spacing = pencilWidth * lerp(4.4, 0.92, density) * rng.range(0.9, 1.18);
            const offset = rng.gaussian(0, spacing * 0.45);
            const path = this.makeZigzagPath(spot, globalShape, settings, rng, spacing, offset, layer);
            this.drawPencilPath(ctx, path, spot.color, {
                width: pencilWidth * rng.range(0.86, 1.24),
                softness,
                deviation,
                intensity: (settings.intensity / 100) * spot.pressure,
                rng
            });
        }
    }

    makeZigzagPath(spot, globalShape, settings, rng, spacing, offset, layer) {
        const density = settings.strokeDensity / 100;
        const deviation = settings.hatchDeviation / 100;
        const softness = settings.pencilSoftness / 100;
        const points = [];
        const rowStart = -spot.ry + offset;
        const rowEnd = spot.ry;
        const rowCount = Math.max(2, Math.floor((rowEnd - rowStart) / spacing));
        const localAngle = spot.angle + rng.gaussian(0, deviation * 0.18);

        for (let row = 0; row <= rowCount; row += 1) {
            const normalizedRow = rowCount ? row / rowCount : 0;
            const wave = Math.sin(normalizedRow * Math.PI * 2 + spot.phase + layer * 0.7);
            const v = rowStart + row * spacing + rng.gaussian(0, spacing * lerp(0.03, 0.38, deviation));
            const ellipseT = clamp(1 - (v * v) / (spot.ry * spot.ry), 0, 1);
            if (ellipseT <= 0.02) continue;

            const half = spot.rx * Math.sqrt(ellipseT) * rng.range(0.78, 1.08);
            const samples = Math.max(6, Math.round(lerp(7, 16, deviation) + half / 70));
            const reversed = row % 2 === 1;
            const u0 = reversed ? half : -half;
            const u1 = reversed ? -half : half;

            for (let i = 0; i <= samples; i += 1) {
                const t = i / samples;
                const u = lerp(u0, u1, t);
                const alongNoise = Math.sin(t * Math.PI * 2 + wave * 2.2) * spacing * 0.05 * deviation;
                const rowNoise = rng.gaussian(0, spacing * lerp(0.015, 0.18, deviation));
                const wobble = Math.sin(t * Math.PI * rng.range(1.0, 2.4) + spot.phase) * spacing * lerp(0.012, 0.16, deviation);
                const p = this.localToWorld(spot, u + alongNoise, v + rowNoise + wobble, localAngle);
                const edge = Math.min(t, 1 - t);
                const spotAlpha = this.spotFalloff(u, v, spot);
                const globalAlpha = this.globalFalloff(p.x, p.y, globalShape);
                const edgeDissolve = smoothstep(0, lerp(0.04, 0.16, softness), edge);
                points.push({
                    x: p.x,
                    y: p.y,
                    pressure: spotAlpha * globalAlpha * lerp(0.3, 1, edgeDissolve),
                    breakBefore: row > 0 && i === 0
                });
            }
        }

        return points.filter((point) => point.pressure > 0.01);
    }

    localToWorld(spot, u, v, angle) {
        const rotated = rotatePoint(u, v, angle);
        return {
            x: spot.x + rotated.x,
            y: spot.y + rotated.y
        };
    }

    spotFalloff(u, v, spot) {
        const r = Math.sqrt((u * u) / (spot.rx * spot.rx) + (v * v) / (spot.ry * spot.ry));
        return clamp((1 - r) / spot.edgeFeather, 0, 1);
    }

    globalFalloff(x, y, shape) {
        const dx = x - shape.center.x;
        const dy = y - shape.center.y;
        const local = rotatePoint(dx, dy, -shape.rotation);
        const nx = local.x / shape.rx;
        const ny = local.y / shape.ry;
        const angle = Math.atan2(ny, nx);
        const r = Math.hypot(nx, ny);
        const limit = this.radiusAt(shape, angle);
        const depth = limit - r;
        const feather = shape.feather / Math.max(shape.rx, shape.ry);
        return clamp((depth + feather * 0.35) / feather, 0, 1);
    }

    radiusAt(shape, angle) {
        const normalized = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
        const position = (normalized / TWO_PI) * shape.radii.length;
        const index = Math.floor(position);
        const next = (index + 1) % shape.radii.length;
        const t = position - index;
        return lerp(shape.radii[index], shape.radii[next], t);
    }

    drawPencilPath(ctx, points, color, options) {
        if (points.length < 2) return;

        const { width, softness, deviation, intensity, rng } = options;
        const rgb = hexToRgb(color);
        const passCount = Math.round(lerp(4, 10, softness) + Math.min(5, width * 0.12));
        const alphaBase = 0.1 * intensity * lerp(0.86, 1.45, softness);

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let pass = 0; pass < passCount; pass += 1) {
            const jittered = jitterPath(points, width * lerp(0.1, 0.36, softness), rng);
            const lineWidth = Math.max(0.75, width * rng.range(0.13, 0.34));
            ctx.lineWidth = lineWidth;

            for (let i = 1; i < jittered.length; i += 1) {
                const a = jittered[i - 1];
                const b = jittered[i];
                if (b.breakBefore) continue;
                const pressure = (a.pressure + b.pressure) * 0.5;
                if (pressure <= 0.018) continue;

                const alpha = alphaBase * pressure * rng.range(0.58, 1.5);
                ctx.strokeStyle = rgba(rgb, alpha);
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                if (deviation < 0.56) {
                    const mx = (a.x + b.x) * 0.5 + rng.gaussian(0, width * 0.025);
                    const my = (a.y + b.y) * 0.5 + rng.gaussian(0, width * 0.025);
                    ctx.quadraticCurveTo(mx, my, b.x, b.y);
                } else {
                    ctx.lineTo(b.x, b.y);
                }
                ctx.stroke();
            }
        }

        this.drawPencilGrain(ctx, points, rgb, {
            width,
            softness,
            intensity,
            rng
        });

        ctx.restore();
    }

    drawPencilGrain(ctx, points, rgb, options) {
        const { width, softness, intensity, rng } = options;
        const length = measurePath(points);
        const count = Math.min(820, Math.floor(length * width * lerp(0.035, 0.115, softness)));
        ctx.fillStyle = rgba(rgb, 0.11 * intensity);

        for (let i = 0; i < count; i += 1) {
            const sample = samplePath(points, rng.range(0, length));
            if (!sample || sample.pressure <= 0.02) continue;
            const spread = width * lerp(0.12, 0.52, softness);
            const offset = rng.gaussian(0, spread);
            const x = sample.x + sample.nx * offset + rng.gaussian(0, 0.6);
            const y = sample.y + sample.ny * offset + rng.gaussian(0, 0.6);
            const r = rng.range(0.25, Math.max(0.55, width * 0.065));
            ctx.globalAlpha = sample.pressure * rng.range(0.12, 0.62) * intensity;
            ctx.fillRect(x, y, r * rng.range(0.7, 2.8), r);
        }

        ctx.globalAlpha = 1;
    }

    sampleCanvas(ctx, width, height) {
        let coloredSamples = 0;
        const steps = 16;
        for (let y = 0; y < steps; y += 1) {
            for (let x = 0; x < steps; x += 1) {
                const px = Math.floor((x + 0.5) * width / steps);
                const py = Math.floor((y + 0.5) * height / steps);
                const data = ctx.getImageData(px, py, 1, 1).data;
                const paperish = data[0] > 220 && data[1] > 216 && data[2] > 205;
                if (!paperish) coloredSamples += 1;
            }
        }
        return { coloredSamples };
    }
}

function parseCharacterSvg(svgText) {
    if (typeof DOMParser === 'undefined') return null;

    const document = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svg = document.querySelector('svg');
    if (!svg) return null;

    const viewBox = parseViewBox(svg.getAttribute('viewBox'));
    const elements = Array.from(svg.querySelectorAll('ellipse, path')).map((node, index) => {
        const group = index < 2 ? 'eyes' : 'legs';
        if (node.tagName.toLowerCase() === 'ellipse') {
            return {
                type: 'ellipse',
                group,
                cx: readNumber(node, 'cx'),
                cy: readNumber(node, 'cy'),
                rx: readNumber(node, 'rx'),
                ry: readNumber(node, 'ry'),
                rotation: parseRotation(node.getAttribute('transform'))
            };
        }

        return {
            type: 'path',
            group,
            d: node.getAttribute('d') || '',
            strokeWidth: readNumber(node, 'stroke-width', 1),
            lineCap: node.getAttribute('stroke-linecap') || 'butt'
        };
    });

    return { viewBox, elements };
}

function parseViewBox(value) {
    const numbers = String(value || '0 0 1200 1200').trim().split(/\s+/).map(Number);
    return {
        x: numbers[0] || 0,
        y: numbers[1] || 0,
        width: numbers[2] || 1200,
        height: numbers[3] || 1200
    };
}

function parseRotation(value) {
    const match = String(value || '').match(/rotate\((-?\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) * Math.PI / 180 : 0;
}

function readNumber(node, attribute, fallback = 0) {
    const value = Number(node.getAttribute(attribute));
    return Number.isFinite(value) ? value : fallback;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

function angularDistance(a, b) {
    const d = Math.abs(((a - b + Math.PI) % TWO_PI) - Math.PI);
    return Math.min(d, TWO_PI - d);
}

function rotatePoint(x, y, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: x * cos - y * sin,
        y: x * sin + y * cos
    };
}

function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

function normalizeColor(value, fallback) {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function rgba(rgb, alpha) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function jitterPath(points, amount, rng) {
    return points.map((point, index) => {
        const prev = points[Math.max(0, index - 1)];
        const next = points[Math.min(points.length - 1, index + 1)];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const offset = rng.gaussian(0, amount);
        return {
            ...point,
            x: point.x + nx * offset + rng.gaussian(0, amount * 0.16),
            y: point.y + ny * offset + rng.gaussian(0, amount * 0.16)
        };
    });
}

function measurePath(points) {
    let length = 0;
    for (let i = 1; i < points.length; i += 1) {
        length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return length;
}

function samplePath(points, distance) {
    let walked = 0;
    for (let i = 1; i < points.length; i += 1) {
        const a = points[i - 1];
        const b = points[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const segment = Math.hypot(dx, dy);
        if (walked + segment >= distance) {
            const t = segment ? (distance - walked) / segment : 0;
            const len = segment || 1;
            return {
                x: a.x + dx * t,
                y: a.y + dy * t,
                nx: -dy / len,
                ny: dx / len,
                pressure: lerp(a.pressure, b.pressure, t)
            };
        }
        walked += segment;
    }
    return null;
}
