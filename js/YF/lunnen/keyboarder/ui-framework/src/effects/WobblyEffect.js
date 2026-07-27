/**
 * WobblyEffect - applies wobbly/jittery displacement to Canvas paths
 * 
 * Uses two integration strategies:
 * 1. Canvas proxy (WobblyCanvasProxy) - wraps canvas context to intercept all drawing,
 *    automatically densifies lines and arcs and applies noise displacement.
 *    This is transparent to existing draw code.
 * 2. SVG path generators - for VoidExporter SVG output.
 */

import { NoiseGenerator } from '../utils/NoiseGenerator.js';

export class WobblyEffect {
    constructor() {
        this.noise = new NoiseGenerator();
        this.enabled = false;
        this.amplitude = 3;      // displacement in pixels (0-20)
        this.frequency = 0.1;    // noise frequency (0.01-0.5)
        this.detail = 4;         // pixels per segment for densification
    }

    /**
     * Set wobbly parameters
     * @param {boolean} enabled - whether effect is active
     * @param {number} amplitude - displacement strength (px)
     * @param {number} frequency - noise scale
     */
    setParams(enabled, amplitude, frequency) {
        this.enabled = enabled;
        this.amplitude = amplitude;
        this.frequency = frequency;
    }

    /**
     * Reseed noise generator (for Update button)
     * @param {number} seed - new seed (optional, random if omitted)
     */
    reseed(seed) {
        this.noise.reseed(seed);
    }

    /**
     * Get current seed
     * @returns {number} current seed
     */
    getSeed() {
        return this.noise.seed;
    }

    /**
     * Apply wobble displacement to a single point (world-space)
     * @param {number} x - world-space X
     * @param {number} y - world-space Y
     * @returns {Object} {dx, dy} displacement offsets
     */
    getDisplacement(x, y) {
        if (!this.enabled || this.amplitude === 0) {
            return { dx: 0, dy: 0 };
        }
        return this.noise.getOffset(x, y, this.frequency, this.amplitude);
    }

    /**
     * Create a wobbly canvas proxy that wraps a real context.
     * The proxy intercepts beginPath/moveTo/lineTo/arc/stroke and applies
     * densification + noise displacement transparently.
     * @param {CanvasRenderingContext2D} ctx - real canvas context
     * @param {number} worldOffsetX - world-space offset X for noise
     * @param {number} worldOffsetY - world-space offset Y for noise
     * @returns {WobblyCanvasProxy} proxy context
     */
    createProxy(ctx, worldOffsetX = 0, worldOffsetY = 0) {
        return new WobblyCanvasProxy(ctx, this, worldOffsetX, worldOffsetY);
    }

    /**
     * Generate SVG path data for a wobbly line
     * @param {number} x1 - start X (local)
     * @param {number} y1 - start Y (local)
     * @param {number} x2 - end X (local)
     * @param {number} y2 - end Y (local)
     * @param {number} worldOffsetX - world-space offset X
     * @param {number} worldOffsetY - world-space offset Y
     * @returns {string} SVG path d attribute
     */
    getWobblyLinePath(x1, y1, x2, y2, worldOffsetX = 0, worldOffsetY = 0) {
        if (!this.enabled || this.amplitude === 0) {
            return `M ${x1} ${y1} L ${x2} ${y2}`;
        }

        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const segments = Math.max(2, Math.ceil(len / this.detail));

        let d = '';

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const px = x1 + dx * t;
            const py = y1 + dy * t;

            const worldX = worldOffsetX + px;
            const worldY = worldOffsetY + py;
            const offset = this.getDisplacement(worldX, worldY);

            const rx = Math.round((px + offset.dx) * 100) / 100;
            const ry = Math.round((py + offset.dy) * 100) / 100;

            if (i === 0) {
                d += `M ${rx} ${ry}`;
            } else {
                d += ` L ${rx} ${ry}`;
            }
        }

        return d;
    }

    /**
     * Generate SVG path data for a wobbly arc
     */
    getWobblyArcPath(centerX, centerY, radius, startAngle, endAngle, worldOffsetX = 0, worldOffsetY = 0) {
        if (!this.enabled || this.amplitude === 0) {
            const sx = centerX + radius * Math.cos(startAngle);
            const sy = centerY + radius * Math.sin(startAngle);
            const ex = centerX + radius * Math.cos(endAngle);
            const ey = centerY + radius * Math.sin(endAngle);
            return `M ${sx} ${sy} A ${radius} ${radius} 0 0 1 ${ex} ${ey}`;
        }

        const arcLength = Math.abs(radius * (endAngle - startAngle));
        const segments = Math.max(4, Math.ceil(arcLength / this.detail));
        const angleStep = (endAngle - startAngle) / segments;

        let d = '';

        for (let i = 0; i <= segments; i++) {
            const angle = startAngle + i * angleStep;
            const px = centerX + radius * Math.cos(angle);
            const py = centerY + radius * Math.sin(angle);

            const worldX = worldOffsetX + px;
            const worldY = worldOffsetY + py;
            const offset = this.getDisplacement(worldX, worldY);

            const rx = Math.round((px + offset.dx) * 100) / 100;
            const ry = Math.round((py + offset.dy) * 100) / 100;

            if (i === 0) {
                d += `M ${rx} ${ry}`;
            } else {
                d += ` L ${rx} ${ry}`;
            }
        }

        return d;
    }

    /**
     * Generate SVG path data for a wobbly polyline
     */
    getWobblyPolylinePath(points, worldOffsetX = 0, worldOffsetY = 0) {
        if (!this.enabled || this.amplitude === 0 || points.length < 2) {
            let d = `M ${points[0].x} ${points[0].y}`;
            for (let i = 1; i < points.length; i++) {
                d += ` L ${points[i].x} ${points[i].y}`;
            }
            return d;
        }

        let d = '';
        let isFirst = true;

        for (let seg = 0; seg < points.length - 1; seg++) {
            const p1 = points[seg];
            const p2 = points[seg + 1];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const segments = Math.max(2, Math.ceil(len / this.detail));

            const startI = isFirst ? 0 : 1;

            for (let i = startI; i <= segments; i++) {
                const t = i / segments;
                const px = p1.x + dx * t;
                const py = p1.y + dy * t;

                const worldX = worldOffsetX + px;
                const worldY = worldOffsetY + py;
                const offset = this.getDisplacement(worldX, worldY);

                const rx = Math.round((px + offset.dx) * 100) / 100;
                const ry = Math.round((py + offset.dy) * 100) / 100;

                if (isFirst && i === 0) {
                    d += `M ${rx} ${ry}`;
                } else {
                    d += ` L ${rx} ${ry}`;
                }
            }
            isFirst = false;
        }

        return d;
    }
}


/**
 * WobblyCanvasProxy - wraps a real CanvasRenderingContext2D
 * 
 * Intercepts path commands (beginPath, moveTo, lineTo, arc) and stroke(),
 * collecting them into segments. On stroke(), replays the segments with
 * densification and noise displacement applied to each point.
 * 
 * All property reads/writes and non-path method calls are forwarded
 * to the real context transparently.
 */
class WobblyCanvasProxy {
    constructor(realCtx, wobblyEffect, worldOffsetX = 0, worldOffsetY = 0) {
        this._real = realCtx;
        this._effect = wobblyEffect;
        this._worldOffsetX = worldOffsetX;
        this._worldOffsetY = worldOffsetY;
        this._segments = []; // collected path segments
        this._currentX = 0;
        this._currentY = 0;

        // Return a Proxy that forwards all property access/writes to real context
        // but intercepts path-related methods
        return new Proxy(this, {
            get(target, prop) {
                // Intercepted methods
                if (prop === 'beginPath') return target._beginPath.bind(target);
                if (prop === 'moveTo') return target._moveTo.bind(target);
                if (prop === 'lineTo') return target._lineTo.bind(target);
                if (prop === 'arc') return target._arc.bind(target);
                if (prop === 'stroke') return target._stroke.bind(target);
                
                // Forward everything else to real context
                const val = realCtx[prop];
                if (typeof val === 'function') {
                    return val.bind(realCtx);
                }
                return val;
            },
            set(target, prop, value) {
                realCtx[prop] = value;
                return true;
            }
        });
    }

    _beginPath() {
        this._segments = [];
    }

    _moveTo(x, y) {
        this._segments.push({ type: 'move', x, y });
        this._currentX = x;
        this._currentY = y;
    }

    _lineTo(x, y) {
        this._segments.push({ type: 'line', x1: this._currentX, y1: this._currentY, x2: x, y2: y });
        this._currentX = x;
        this._currentY = y;
    }

    _arc(cx, cy, radius, startAngle, endAngle, anticlockwise) {
        this._segments.push({ type: 'arc', cx, cy, radius, startAngle, endAngle, anticlockwise: anticlockwise || false });
        // Update current position to end of arc
        this._currentX = cx + radius * Math.cos(endAngle);
        this._currentY = cy + radius * Math.sin(endAngle);
    }

    _stroke() {
        const ctx = this._real;
        const detail = this._effect.detail;
        
        ctx.beginPath();

        for (const seg of this._segments) {
            if (seg.type === 'move') {
                const worldX = this._worldOffsetX + seg.x;
                const worldY = this._worldOffsetY + seg.y;
                const offset = this._effect.getDisplacement(worldX, worldY);
                ctx.moveTo(seg.x + offset.dx, seg.y + offset.dy);
            } else if (seg.type === 'line') {
                const dx = seg.x2 - seg.x1;
                const dy = seg.y2 - seg.y1;
                const len = Math.sqrt(dx * dx + dy * dy);
                const numSegs = Math.max(2, Math.ceil(len / detail));

                for (let i = 1; i <= numSegs; i++) {
                    const t = i / numSegs;
                    const px = seg.x1 + dx * t;
                    const py = seg.y1 + dy * t;
                    const worldX = this._worldOffsetX + px;
                    const worldY = this._worldOffsetY + py;
                    const offset = this._effect.getDisplacement(worldX, worldY);
                    ctx.lineTo(px + offset.dx, py + offset.dy);
                }
            } else if (seg.type === 'arc') {
                const arcLen = Math.abs(seg.radius * (seg.endAngle - seg.startAngle));
                const numSegs = Math.max(4, Math.ceil(arcLen / detail));
                const angleStep = (seg.endAngle - seg.startAngle) / numSegs;

                for (let i = 0; i <= numSegs; i++) {
                    const angle = seg.startAngle + i * angleStep;
                    const px = seg.cx + seg.radius * Math.cos(angle);
                    const py = seg.cy + seg.radius * Math.sin(angle);
                    const worldX = this._worldOffsetX + px;
                    const worldY = this._worldOffsetY + py;
                    const offset = this._effect.getDisplacement(worldX, worldY);

                    if (i === 0) {
                        // If arc is the first segment, moveTo; otherwise lineTo
                        const isFirstSeg = this._segments.indexOf(seg) === 0;
                        if (isFirstSeg) {
                            ctx.moveTo(px + offset.dx, py + offset.dy);
                        } else {
                            ctx.lineTo(px + offset.dx, py + offset.dy);
                        }
                    } else {
                        ctx.lineTo(px + offset.dx, py + offset.dy);
                    }
                }
            }
        }

        ctx.stroke();
    }
}
