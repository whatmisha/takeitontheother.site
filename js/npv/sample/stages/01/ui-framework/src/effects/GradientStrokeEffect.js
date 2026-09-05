/**
 * GradientStrokeEffect - applies per-stroke linear gradient along each stroke direction
 * 
 * Uses Canvas proxy pattern (like WobblyEffect) to intercept path drawing.
 * On each stroke(), creates a linearGradient from the first to last point 
 * of the collected path and applies it as strokeStyle.
 */

export class GradientStrokeEffect {
    constructor() {
        this.enabled = false;
        this.startColor = '#ff0000';
        this.endColor = '#0000ff';
    }

    /**
     * Set gradient parameters
     * @param {boolean} enabled - whether effect is active
     * @param {string} startColor - gradient start color (hex)
     * @param {string} endColor - gradient end color (hex)
     */
    setParams(enabled, startColor, endColor) {
        this.enabled = enabled;
        this.startColor = startColor || '#ff0000';
        this.endColor = endColor || '#0000ff';
    }

    /**
     * Create a gradient stroke proxy that wraps a real context.
     * Intercepts beginPath/moveTo/lineTo/arc/stroke and applies
     * per-stroke linear gradient along stroke direction.
     * @param {CanvasRenderingContext2D} ctx - real canvas context
     * @returns {GradientStrokeProxy} proxy context
     */
    createProxy(ctx) {
        return new GradientStrokeProxy(ctx, this);
    }
}


/**
 * GradientStrokeProxy - wraps a real CanvasRenderingContext2D
 * 
 * Intercepts path commands (beginPath, moveTo, lineTo, arc) and stroke().
 * On stroke(), computes the path's start and end points, creates a 
 * linearGradient between them, and sets it as strokeStyle before calling
 * the real stroke().
 */
class GradientStrokeProxy {
    constructor(realCtx, gradientEffect) {
        this._real = realCtx;
        this._effect = gradientEffect;
        this._firstPoint = null;  // {x, y} - first point in current path
        this._lastPoint = null;   // {x, y} - last point in current path

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
        this._firstPoint = null;
        this._lastPoint = null;
        this._real.beginPath();
    }

    _moveTo(x, y) {
        if (!this._firstPoint) {
            this._firstPoint = { x, y };
        }
        this._lastPoint = { x, y };
        this._real.moveTo(x, y);
    }

    _lineTo(x, y) {
        if (!this._firstPoint) {
            this._firstPoint = { x, y };
        }
        this._lastPoint = { x, y };
        this._real.lineTo(x, y);
    }

    _arc(cx, cy, radius, startAngle, endAngle, anticlockwise) {
        // Start of arc
        const sx = cx + radius * Math.cos(startAngle);
        const sy = cy + radius * Math.sin(startAngle);
        // End of arc
        const ex = cx + radius * Math.cos(endAngle);
        const ey = cy + radius * Math.sin(endAngle);
        
        if (!this._firstPoint) {
            this._firstPoint = { x: sx, y: sy };
        }
        this._lastPoint = { x: ex, y: ey };
        this._real.arc(cx, cy, radius, startAngle, endAngle, anticlockwise);
    }

    _stroke() {
        const ctx = this._real;
        
        if (this._firstPoint && this._lastPoint && this._effect.enabled) {
            const p1 = this._firstPoint;
            const p2 = this._lastPoint;
            
            // Only apply gradient if points are different (avoid zero-length gradient)
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 0.1) {
                const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
                grad.addColorStop(0, this._effect.startColor);
                grad.addColorStop(1, this._effect.endColor);
                ctx.strokeStyle = grad;
            }
        }
        
        ctx.stroke();
    }
}
