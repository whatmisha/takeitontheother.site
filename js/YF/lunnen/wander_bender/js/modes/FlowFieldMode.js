/**
 * FlowFieldMode - Flow field distribution mode
 * Generates elements following a Perlin noise field pattern
 */

import { BaseMode } from './BaseMode.js';
import { createShapeFromLine } from '../utils/ShapeGenerator.js';
import { renderUnitedPath, renderHitArea, renderExtractedShape, drawAreaBoundary } from '../utils/Renderer.js';
import { getPathDataAndRemove } from '../utils/PaperUtils.js';
import { SpatialHash } from '../utils/SpatialHash.js';

// Perlin Noise Generator for Flow Field
class PerlinNoise {
    constructor(seed = 12345) {
        this.seed = seed;
        this.permutation = this.generatePermutation(seed);
        this.p = [...this.permutation, ...this.permutation]; // Duplicate for wrapping
    }
    
    generatePermutation(seed) {
        // Seeded random permutation of 0-255
        const p = [];
        for (let i = 0; i < 256; i++) p[i] = i;
        
        // Shuffle using seeded random
        let s = seed;
        for (let i = 255; i > 0; i--) {
            s = (s * 9301 + 49297) % 233280;
            const j = Math.floor((s / 233280) * (i + 1));
            [p[i], p[j]] = [p[j], p[i]];
        }
        return p;
    }
    
    fade(t) {
        // Smoothstep function: 6t^5 - 15t^4 + 10t^3
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    lerp(a, b, t) {
        return a + t * (b - a);
    }
    
    grad(hash, x, y) {
        // Convert hash to gradient direction
        const h = hash & 3;
        const u = h < 2 ? x : y;
        const v = h < 2 ? y : x;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    
    noise(x, y) {
        // Find unit square containing point
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        
        // Find relative x, y in square
        x -= Math.floor(x);
        y -= Math.floor(y);
        
        // Compute fade curves
        const u = this.fade(x);
        const v = this.fade(y);
        
        // Hash coordinates of square corners
        const a = this.p[X] + Y;
        const b = this.p[X + 1] + Y;
        
        // Blend results from corners
        return this.lerp(
            this.lerp(
                this.grad(this.p[a], x, y),
                this.grad(this.p[b], x - 1, y),
                u
            ),
            this.lerp(
                this.grad(this.p[a + 1], x, y - 1),
                this.grad(this.p[b + 1], x - 1, y - 1),
                u
            ),
            v
        );
    }
}

export class FlowFieldMode extends BaseMode {
    constructor(generator) {
        super(generator);
        this.perlinNoise = null;
    }
    
    // Get flow direction at a point (x, y) using Perlin noise
    getFlowDirection(x, y, scale) {
        if (!this.perlinNoise) return 0;
        
        // Sample Perlin noise at scaled coordinates
        const noiseValue = this.perlinNoise.noise(x / scale, y / scale);
        
        // Map noise (-1 to 1) to angle (0 to 2π)
        return (noiseValue + 1) * Math.PI; // 0 to 2π
    }
    
    // Get flow-influenced arc amount at a point
    getFlowArcAmount(x, y, scale, influence, baseArc) {
        if (!this.perlinNoise) return baseArc;
        
        // Use different offset for arc variation
        const noiseValue = this.perlinNoise.noise((x / scale) + 100, (y / scale) + 100);
        
        // Map noise (-1 to 1) to variation around base arc
        // influence controls the amount of variation (0-100%)
        const variation = noiseValue * (influence / 100);
        return baseArc + (baseArc * variation); // Vary around baseArc
    }
    
    // Check if two bounding boxes intersect (with margin for spacing)
    checkCollision(box1, box2, margin = 5) {
        return !(
            box1.x + box1.width + margin < box2.x ||
            box1.x > box2.x + box2.width + margin ||
            box1.y + box1.height + margin < box2.y ||
            box1.y > box2.y + box2.height + margin
        );
    }
    
    // Check collision with spatial hash optimization
    checkCollisionWithSpatialHash(bounds, spatialHash, margin) {
        const candidates = spatialHash.query(bounds);
        for (const candidate of candidates) {
            if (this.checkCollision(bounds, candidate.element.bounds, margin)) {
                return true;
            }
        }
        return false;
    }
    
    // Get approximate bounding box for an element
    getElementBounds(x, y, length, width, angle) {
        // Simplified bounding box calculation
        // For a rotated rectangle, we calculate the AABB (axis-aligned bounding box)
        const halfLength = length / 2;
        const halfWidth = width / 2;
        
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        // Four corners of the rectangle (centered at origin)
        const corners = [
            { x: -halfLength, y: -halfWidth },
            { x: halfLength, y: -halfWidth },
            { x: halfLength, y: halfWidth },
            { x: -halfLength, y: halfWidth }
        ];
        
        // Rotate and translate corners
        const rotatedCorners = corners.map(c => ({
            x: x + c.x * cos - c.y * sin,
            y: y + c.x * sin + c.y * cos
        }));
        
        // Find min/max to get AABB
        const xs = rotatedCorners.map(c => c.x);
        const ys = rotatedCorners.map(c => c.y);
        
        return {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }
    
    generate(params) {
        // Store params for re-rendering
        this.currentParams = params;
        
        // Only regenerate elements if parameters changed
        if (this.paramsChanged(params)) {
            this.generateElements(params);
        }
        
        // Always re-render
        this.render();
    }
    
    generateElements(params) {
        // Clear previous data
        this.elements = [];
        this.extractedIndices = [];
        
        const {
            length, width, stroke, cornerRadius, arcAmount,
            density, areaWidth, areaHeight, flowScale, flowInfluence, flowSeed, spacing
        } = params;
        
        // Calculate margin based on spacing
        // spacing: -100 to 100, where negative allows overlap
        const spacingMultiplier = spacing / 100; // -1.0 to 1.0
        const collisionMargin = width * spacingMultiplier;
        
        // Initialize Perlin noise with seed
        this.perlinNoise = new PerlinNoise(flowSeed);
        
        // Calculate area bounds (centered on canvas)
        const areaLeft = this.centerX - areaWidth / 2;
        const areaTop = this.centerY - areaHeight / 2;
        const margin = Math.max(length, width);
        
        // Seeded random for reproducible placement
        let seed = flowSeed;
        const random = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
        
        // Optimize: reduce max attempts based on density
        const maxAttempts = Math.min(density * 100, 5000);
        let attempts = 0;
        let successfulPlacements = 0;
        
        // Use spatial hash for fast collision detection
        // Cell size should be roughly the size of objects
        const cellSize = Math.max(length, width) * 2;
        const spatialHash = new SpatialHash(cellSize);
        
        while (successfulPlacements < density && attempts < maxAttempts) {
            attempts++;
            
            // Try random position within area
            const x = areaLeft + margin + random() * (areaWidth - 2 * margin);
            const y = areaTop + margin + random() * (areaHeight - 2 * margin);
            
            // Skip if outside area bounds
            if (x < areaLeft + margin || x > areaLeft + areaWidth - margin ||
                y < areaTop + margin || y > areaTop + areaHeight - margin) {
                continue;
            }
            
            // Get flow direction at this point
            const flowAngle = this.getFlowDirection(x, y, flowScale);
            
            // Get arc amount with flow variation
            // flowInfluence controls how much the flow field varies the arc around base arcAmount
            const finalArc = this.getFlowArcAmount(x, y, flowScale, flowInfluence, arcAmount);
            
            // Calculate bounding box for this element
            const bounds = this.getElementBounds(x, y, length, width, flowAngle);
            
            // Check if it's within area
            if (bounds.x < areaLeft || bounds.y < areaTop || 
                bounds.x + bounds.width > areaLeft + areaWidth || 
                bounds.y + bounds.height > areaTop + areaHeight) {
                continue; // Skip if out of area bounds
            }
            
            // Check collision using spatial hash (much faster than checking all elements)
            if (this.checkCollisionWithSpatialHash(bounds, spatialHash, collisionMargin)) {
                continue;
            }
            
            // No collision - place element
            const element = {
                x,
                y,
                line: [{ x: -length / 2, y: 0 }, { x: length / 2, y: 0 }, finalArc],
                angle: flowAngle * 180 / Math.PI, // Convert to degrees
                width,
                cornerRadius,
                pivotDistance: cornerRadius,
                bounds
            };
            
            this.elements.push(element);
            spatialHash.insert(element, successfulPlacements);
            successfulPlacements++;
        }
    }
    
    render() {
        const { stroke, areaWidth, areaHeight } = this.currentParams;
        
        // Clear group
        this.clearGroup();
        
        if (this.elements.length === 0) return;
        
        // Draw area boundary (subtle dark gray rectangle)
        drawAreaBoundary(this.centerX, this.centerY, areaWidth, areaHeight, this.group);
        
        // Get stroke width from params or default
        const strokeWidth = stroke !== undefined ? stroke : this.elements[0].width - 5;
        
        // Create Paper.js paths for non-extracted elements and unite them
        let unitedPath = null;
        
        for (let i = 0; i < this.elements.length; i++) {
            if (this.extractedIndices.includes(i)) continue; // Skip extracted
            
            const el = this.elements[i];
            const result = createShapeFromLine(
                el.line,
                el.width,
                el.cornerRadius,
                el.pivotDistance
            );
            
            if (!result) continue;
            const { shape } = result;
            
            // Transform: rotate around center, then translate to position
            shape.rotate(el.angle, new paper.Point(0, 0));
            shape.translate(new paper.Point(el.x, el.y));
            
            // Unite with existing shapes
            if (!unitedPath) {
                unitedPath = shape;
            } else {
                unitedPath = unitedPath.unite(shape);
                shape.remove();
            }
        }
        
        // Render united path
        const unitedPathElement = renderUnitedPath(unitedPath, strokeWidth, this.group);
        if (unitedPathElement) {
            unitedPathElement.setAttribute('stroke-linecap', 'round');
        }
        
        // Render invisible hit areas for non-extracted elements
        for (let i = 0; i < this.elements.length; i++) {
            if (this.extractedIndices.includes(i)) continue;
            
            const el = this.elements[i];
            const result = createShapeFromLine(
                el.line,
                el.width,
                el.cornerRadius,
                el.pivotDistance
            );
            
            if (!result) continue;
            const { shape } = result;
            
            shape.rotate(el.angle, new paper.Point(0, 0));
            shape.translate(new paper.Point(el.x, el.y));
            
            const pathData = getPathDataAndRemove(shape);
            
            renderHitArea(pathData, i, 'flowIndex', (index) => this.extractElement(index), this.group, { fill: 'rgba(0,0,0,0)' });
        }
        
        // Render extracted elements (in order of extraction for proper z-index)
        for (const index of this.extractedIndices) {
            const el = this.elements[index];
            const result = createShapeFromLine(
                el.line,
                el.width,
                el.cornerRadius,
                el.pivotDistance
            );
            
            if (!result) continue;
            const { shape } = result;
            
            shape.rotate(el.angle, new paper.Point(0, 0));
            shape.translate(new paper.Point(el.x, el.y));
            
            const pathData = getPathDataAndRemove(shape);
            
            renderExtractedShape(pathData, strokeWidth, index, 'flowIndex', (idx) => this.returnElement(idx), this.group, { strokeLinecap: 'round' });
        }
    }
}

