// Import framework modules
import { SliderController } from './ui/SliderController.js';
import { PanelManager } from './ui/PanelManager.js';
import { ZoomPanManager } from './ui/ZoomPanManager.js';
import { debounce, DEBOUNCE_DELAYS } from './utils/DebounceUtils.js';
import { getPointOnLine, createShapeFromLine } from './utils/ShapeGenerator.js';
import { renderUnitedPath, renderHitArea, renderExtractedShape, drawAreaBoundary } from './utils/Renderer.js';
import { unitePaths, getPathDataAndRemove } from './utils/PaperUtils.js';

// Settings storage
const settings = {
    mode: 'radial',
    
    global: {
        length: 125,
        width: 50,
        stroke: 45,
        strokeAuto: true,  // Auto calculate stroke based on width
        cornerRadius: 25,
        cornerRadiusMax: true,  // Keep corner radius at maximum
        arcAmount: 0  // Arc curvature (0-100)
    },
    
    radial: {
        rays: 3,
        rayRotation: 0
    },
    
    random: {
        count: 3,
        areaWidth: 200,
        areaHeight: 200,
        lengthVariation: 50,  // Percentage variation in length
        randomSeed: 12345
    },
    
    flowfield: {
        density: 50,          // Target number of elements
        areaWidth: 500,       // Width of area
        areaHeight: 500,      // Height of area
        flowScale: 100,       // Scale of Perlin noise field
        flowInfluence: 50,    // How much flow affects rotation (0-100)
        flowSeed: 12345,      // Seed for flow field generation
        spacing: 20           // Spacing between elements (-100 to 100, negative = overlap)
    },
    
    // Helper methods for backward compatibility
    get(key) {
        // Support dot notation (e.g., 'flowfield.density')
        if (key.includes('.')) {
            const [section, prop] = key.split('.');
            return this[section] && this[section][prop];
        }
        // Check global settings first
        if (this.global.hasOwnProperty(key)) {
            return this.global[key];
        }
        // Then check mode-specific settings
        if (this[this.mode] && this[this.mode].hasOwnProperty(key)) {
            return this[this.mode][key];
        }
        return undefined;
    },
    
    set(key, value) {
        // Support dot notation (e.g., 'flowfield.density')
        if (key.includes('.')) {
            const [section, prop] = key.split('.');
            if (this[section] && this[section].hasOwnProperty(prop)) {
                this[section][prop] = value;
            }
            return;
        }
        // Set in global settings if it exists there
        if (this.global.hasOwnProperty(key)) {
            this.global[key] = value;
        }
        // Otherwise set in mode-specific settings
        else if (this[this.mode] && this[this.mode].hasOwnProperty(key)) {
            this[this.mode][key] = value;
        }
    }
};

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

// Wander Bender Generator
class WanderBenderGenerator {
    constructor(svgElement) {
        this.svg = svgElement;
        this.group = document.getElementById('graphicsGroup');
        this.centerX = 250;
        this.centerY = 250;
        
        // Setup Paper.js
        paper.setup(new paper.Size(500, 500));
        
        // Store rectangles data for random mode
        this.randomRectangles = [];
        this.extractedIndices = []; // Array to preserve extraction order
        this.currentParams = null; // Store current generation parameters
        
        // Store rays data for radial mode
        this.radialRays = [];
        this.extractedRadialIndices = [];
        
        // Store elements data for flow field mode
        this.flowElements = [];
        this.extractedFlowIndices = [];
        this.perlinNoise = null; // Will be initialized when needed
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
    

    generateRadial(params) {
        let { rays, rayRotation, length, width, stroke, cornerRadius, arcAmount } = params;
        
        // Store params for regeneration
        this.currentParams = params;
        
        // Ensure corner radius doesn't exceed half of width
        cornerRadius = Math.min(cornerRadius, width / 2);
        
        // Clear previous graphics
        this.group.innerHTML = '';

        // Calculate angle step
        const angleStep = (2 * Math.PI) / rays;
        
        // Store rays data
        this.radialRays = [];
        
        for (let i = 0; i < rays; i++) {
            // Start at 6 o'clock position (90 degrees)
            const angle = (i * angleStep) + (Math.PI / 2);
            
            // Calculate center position
            const centerX = this.centerX;
            const centerY = this.centerY;
            
            // Define line: from (0,0) to length with arc
            const lineStart = { x: 0, y: 0 };
            const lineEnd = { x: length, y: 0 };
            
            // Pivot distance along the line (at cornerRadius distance from start)
            const pivotDistance = cornerRadius;
            
            // Store ray data (line includes arcAmount as third element)
            this.radialRays.push({
                line: [lineStart, lineEnd, arcAmount],
                angle: angle * 180 / Math.PI,
                rayRotation,
                centerX,
                centerY,
                pivotDistance,
                length,
                width,
                cornerRadius
            });
        }
        
        // Render the composition
        this.renderRadialComposition(stroke);
    }
    
    renderRadialComposition(stroke) {
        // Clear group
        this.group.innerHTML = '';
        
        // Create Paper.js paths for non-extracted rays
        let unitedPath = null;
        
        for (let i = 0; i < this.radialRays.length; i++) {
            if (this.extractedRadialIndices.includes(i)) {
                // This ray is extracted, skip for united path
                continue;
            }
            
            const { line, angle, rayRotation, centerX, centerY, pivotDistance, width, cornerRadius } = this.radialRays[i];
            
            // Create shape from line with pivot point
            const result = createShapeFromLine(line, width, cornerRadius, pivotDistance);
            if (!result) continue;
            
            const { shape, pivotPoint } = result;
            
            // Translate so that pivot point is at origin
            shape.translate(new paper.Point(-pivotPoint.x, -pivotPoint.y));
            
            // First rotate by radial angle (around origin = pivot point)
            shape.rotate(angle, new paper.Point(0, 0));
            
            // Then move to centerX, centerY
            shape.translate(new paper.Point(centerX, centerY));
            
            // Then rotate each ray around its own center
            if (rayRotation !== 0) {
                const shapeCenter = shape.bounds.center;
                shape.rotate(rayRotation, shapeCenter);
            }
            
            // Unite with previous shapes
            if (unitedPath === null) {
                unitedPath = shape;
            } else {
                unitedPath = unitedPath.unite(shape);
                shape.remove();
            }
        }
        
        // Render united path (if any rays remain united)
        renderUnitedPath(unitedPath, stroke, this.group);
        
        // Render interactive hit areas for non-extracted rays
        for (let i = 0; i < this.radialRays.length; i++) {
            if (this.extractedRadialIndices.includes(i)) continue;
            
            const { line, angle, rayRotation, centerX, centerY, pivotDistance, width, cornerRadius } = this.radialRays[i];
            
            // Create shape from line for hit area
            const result = createShapeFromLine(line, width, cornerRadius, pivotDistance);
            if (!result) continue;
            
            const { shape, pivotPoint } = result;
            
            shape.translate(new paper.Point(-pivotPoint.x, -pivotPoint.y));
            shape.rotate(angle, new paper.Point(0, 0));
            shape.translate(new paper.Point(centerX, centerY));
            if (rayRotation !== 0) {
                const shapeCenter = shape.bounds.center;
                shape.rotate(rayRotation, shapeCenter);
            }
            
            const pathData = getPathDataAndRemove(shape);
            
            // Create invisible hit area
            renderHitArea(pathData, i, 'rayIndex', (index) => this.extractRadialRay(index), this.group);
        }
        
        // Render extracted rays in order of extraction (bottom to top)
        for (const index of this.extractedRadialIndices) {
            const { line, angle, rayRotation, centerX, centerY, pivotDistance, width, cornerRadius } = this.radialRays[index];
            
            // Create shape from line
            const result = createShapeFromLine(line, width, cornerRadius, pivotDistance);
            if (!result) continue;
            
            const { shape, pivotPoint } = result;
            
            shape.translate(new paper.Point(-pivotPoint.x, -pivotPoint.y));
            shape.rotate(angle, new paper.Point(0, 0));
            shape.translate(new paper.Point(centerX, centerY));
            if (rayRotation !== 0) {
                const shapeCenter = shape.bounds.center;
                shape.rotate(rayRotation, shapeCenter);
            }
            
            const pathData = getPathDataAndRemove(shape);
            
            // Create SVG path
            renderExtractedShape(pathData, stroke, index, 'rayIndex', (idx) => this.returnRadialRay(idx), this.group);
        }
    }
    
    extractRadialRay(index) {
        // Add to extracted array if not already there
        if (!this.extractedRadialIndices.includes(index)) {
            this.extractedRadialIndices.push(index);
        }
        this.renderRadialComposition(this.currentParams.stroke);
    }
    
    returnRadialRay(index) {
        // Remove from extracted array
        const position = this.extractedRadialIndices.indexOf(index);
        if (position > -1) {
            this.extractedRadialIndices.splice(position, 1);
        }
        this.renderRadialComposition(this.currentParams.stroke);
    }
    
    resetRadialMode() {
        this.extractedRadialIndices = [];
        if (this.currentParams) {
            this.renderRadialComposition(this.currentParams.stroke);
        }
    }
    
    // Seeded random number generator for reproducibility
    seededRandom(seed) {
        let state = seed;
        return function() {
            state = (state * 9301 + 49297) % 233280;
            return state / 233280;
        };
    }
    
    generateRandom(params) {
        let { count, areaWidth, areaHeight, lengthVariation, randomSeed, length, width, stroke, cornerRadius, arcAmount } = params;
        
        // Store params for regeneration
        this.currentParams = params;
        
        // Ensure corner radius doesn't exceed half of width
        cornerRadius = Math.min(cornerRadius, width / 2);
        
        // Clear previous graphics
        this.group.innerHTML = '';
        
        // Initialize seeded random
        const random = this.seededRandom(randomSeed);
        
        // Store rectangles data
        this.randomRectangles = [];
        
        // Calculate area bounds (centered on canvas)
        const areaLeft = this.centerX - areaWidth / 2;
        const areaTop = this.centerY - areaHeight / 2;
        
        for (let i = 0; i < count; i++) {
            // Random position within area
            const x = areaLeft + random() * areaWidth;
            const y = areaTop + random() * areaHeight;
            
            // Random angle (0-360 degrees)
            const angle = random() * 360;
            
            // Random length variation
            const lengthMultiplier = 1 + (random() * 2 - 1) * (lengthVariation / 100);
            const actualLength = length * lengthMultiplier;
            
            // Define line: straight line of actualLength with arc
            const lineStart = { x: 0, y: 0 };
            const lineEnd = { x: actualLength, y: 0 };
            
            // Pivot distance (center of the line)
            const pivotDistance = actualLength / 2;
            
            // Store rectangle data (line includes arcAmount as third element)
            this.randomRectangles.push({
                line: [lineStart, lineEnd, arcAmount],
                x, y, angle, width, cornerRadius, pivotDistance
            });
        }
        
        // Render the composition
        this.renderRandomComposition(stroke, areaWidth, areaHeight);
    }
    
    renderRandomComposition(stroke, areaWidth, areaHeight) {
        // Clear group
        this.group.innerHTML = '';
        
        // Draw area boundary (subtle dark gray rectangle)
        drawAreaBoundary(this.centerX, this.centerY, areaWidth, areaHeight, this.group);
        
        // Create Paper.js paths for non-extracted rectangles
        let unitedPath = null;
        
        for (let i = 0; i < this.randomRectangles.length; i++) {
            if (this.extractedIndices.includes(i)) {
                // This rectangle is extracted, skip for united path
                continue;
            }
            
            const { line, x, y, angle, width, cornerRadius, pivotDistance } = this.randomRectangles[i];
            
            // Create shape from line
            const result = createShapeFromLine(line, width, cornerRadius, pivotDistance);
            if (!result) continue;
            
            const { shape, pivotPoint } = result;
            
            // Position pivot at x,y
            shape.translate(new paper.Point(x - pivotPoint.x, y - pivotPoint.y));
            
            // Rotate around x,y
            shape.rotate(angle, new paper.Point(x, y));
            
            // Unite with previous shapes
            if (unitedPath === null) {
                unitedPath = shape;
            } else {
                unitedPath = unitedPath.unite(shape);
                shape.remove();
            }
        }
        
        // Render united path (if any rectangles remain united)
        renderUnitedPath(unitedPath, stroke, this.group);
        
        // Render interactive hit areas for non-extracted rectangles
        for (let i = 0; i < this.randomRectangles.length; i++) {
            if (this.extractedIndices.includes(i)) continue;
            
            const { line, x, y, angle, width, cornerRadius, pivotDistance } = this.randomRectangles[i];
            
            // Create shape from line for hit area
            const result = createShapeFromLine(line, width, cornerRadius, pivotDistance);
            if (!result) continue;
            
            const { shape, pivotPoint } = result;
            
            shape.translate(new paper.Point(x - pivotPoint.x, y - pivotPoint.y));
            shape.rotate(angle, new paper.Point(x, y));
            
            const pathData = getPathDataAndRemove(shape);
            
            // Create invisible hit area
            renderHitArea(pathData, i, 'rectIndex', (index) => this.extractRectangle(index), this.group);
        }
        
        // Render extracted rectangles in order of extraction (bottom to top)
        for (const index of this.extractedIndices) {
            const { line, x, y, angle, width, cornerRadius, pivotDistance } = this.randomRectangles[index];
            
            // Create shape from line
            const result = createShapeFromLine(line, width, cornerRadius, pivotDistance);
            if (!result) continue;
            
            const { shape, pivotPoint } = result;
            
            shape.translate(new paper.Point(x - pivotPoint.x, y - pivotPoint.y));
            shape.rotate(angle, new paper.Point(x, y));
            
            const pathData = getPathDataAndRemove(shape);
            
            // Create SVG path
            renderExtractedShape(pathData, stroke, index, 'rectIndex', (idx) => this.returnRectangle(idx), this.group);
        }
    }
    
    extractRectangle(index) {
        // Add to extracted array if not already there
        if (!this.extractedIndices.includes(index)) {
            this.extractedIndices.push(index);
        }
        this.renderRandomComposition(
            this.currentParams.stroke, 
            this.currentParams.areaWidth, 
            this.currentParams.areaHeight
        );
    }
    
    returnRectangle(index) {
        // Remove from extracted array
        const position = this.extractedIndices.indexOf(index);
        if (position > -1) {
            this.extractedIndices.splice(position, 1);
        }
        this.renderRandomComposition(
            this.currentParams.stroke, 
            this.currentParams.areaWidth, 
            this.currentParams.areaHeight
        );
    }
    
    resetRandomMode() {
        this.extractedIndices = [];
        if (this.currentParams) {
            this.renderRandomComposition(
                this.currentParams.stroke, 
                this.currentParams.areaWidth, 
                this.currentParams.areaHeight
            );
        }
    }
    
    generate(params) {
        const mode = params.mode || 'radial';
        
        if (mode === 'radial') {
            this.generateRadial(params);
        } else if (mode === 'random') {
            this.generateRandom(params);
        } else if (mode === 'flowfield') {
            this.generateFlowField(params);
        }
    }
    
    // Flow Field mode methods (placeholder for now)
    // Check if two bounding boxes intersect (with margin for spacing)
    checkCollision(box1, box2, margin = 5) {
        return !(
            box1.x + box1.width + margin < box2.x ||
            box1.x > box2.x + box2.width + margin ||
            box1.y + box1.height + margin < box2.y ||
            box1.y > box2.y + box2.height + margin
        );
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
    
    generateFlowField(params) {
        // Clear previous graphics
        this.group.innerHTML = '';
        this.flowElements = [];
        this.extractedFlowIndices = [];
        
        // Store params for re-rendering
        this.currentParams = params;
        
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
            
            // Check collision with existing elements
            let hasCollision = false;
            for (const element of this.flowElements) {
                if (this.checkCollision(bounds, element.bounds, collisionMargin)) {
                    hasCollision = true;
                    break;
                }
            }
            
            if (!hasCollision) {
                // Place element
                this.flowElements.push({
                    x,
                    y,
                    line: [{ x: -length / 2, y: 0 }, { x: length / 2, y: 0 }, finalArc],
                    angle: flowAngle * 180 / Math.PI, // Convert to degrees
                    width,
                    cornerRadius,
                    pivotDistance: cornerRadius,
                    bounds
                });
                successfulPlacements++;
            }
        }
        
        // Render the composition
        this.renderFlowFieldComposition(stroke, areaWidth, areaHeight);
    }
    
    renderFlowFieldComposition(stroke, areaWidth, areaHeight) {
        // Clear group
        this.group.innerHTML = '';
        
        if (this.flowElements.length === 0) return;
        
        // Draw area boundary (subtle dark gray rectangle)
        drawAreaBoundary(this.centerX, this.centerY, areaWidth, areaHeight, this.group);
        
        // Get stroke width from params or default
        const strokeWidth = stroke !== undefined ? stroke : this.flowElements[0].width - 5;
        
        // Create Paper.js paths for non-extracted elements and unite them
        let unitedPath = null;
        
        for (let i = 0; i < this.flowElements.length; i++) {
            if (this.extractedFlowIndices.includes(i)) continue; // Skip extracted
            
            const el = this.flowElements[i];
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
        for (let i = 0; i < this.flowElements.length; i++) {
            if (this.extractedFlowIndices.includes(i)) continue;
            
            const el = this.flowElements[i];
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
            
            renderHitArea(pathData, i, 'flowIndex', (index) => this.extractFlowElement(index), this.group, { fill: 'rgba(0,0,0,0)' });
        }
        
        // Render extracted elements (in order of extraction for proper z-index)
        for (const index of this.extractedFlowIndices) {
            const el = this.flowElements[index];
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
            
            renderExtractedShape(pathData, strokeWidth, index, 'flowIndex', (idx) => this.returnFlowElement(idx), this.group, { strokeLinecap: 'round' });
        }
    }
    
    extractFlowElement(index) {
        if (!this.extractedFlowIndices.includes(index)) {
            this.extractedFlowIndices.push(index);
            this.renderFlowFieldComposition(
                this.currentParams ? this.currentParams.stroke : undefined,
                this.currentParams ? this.currentParams.areaWidth : 500,
                this.currentParams ? this.currentParams.areaHeight : 500
            );
        }
    }
    
    returnFlowElement(index) {
        const idx = this.extractedFlowIndices.indexOf(index);
        if (idx !== -1) {
            this.extractedFlowIndices.splice(idx, 1);
            this.renderFlowFieldComposition(
                this.currentParams ? this.currentParams.stroke : undefined,
                this.currentParams ? this.currentParams.areaWidth : 500,
                this.currentParams ? this.currentParams.areaHeight : 500
            );
        }
    }
    
    resetFlowFieldMode() {
        this.extractedFlowIndices = [];
        this.renderFlowFieldComposition(
            this.currentParams ? this.currentParams.stroke : undefined,
            this.currentParams ? this.currentParams.areaWidth : 500,
            this.currentParams ? this.currentParams.areaHeight : 500
        );
    }
}

// Initialize generator
const generator = new WanderBenderGenerator(document.getElementById('mainSvg'));

// Update visualization
function updateVisualization() {
    const params = {
        mode: settings.mode,
        length: settings.get('length'),
        width: settings.get('width'),
        stroke: settings.get('stroke'),
        cornerRadius: settings.get('cornerRadius'),
        arcAmount: settings.get('arcAmount')
    };
    
    // Add mode-specific parameters
    if (settings.mode === 'radial') {
        params.rays = settings.get('rays');
        params.rayRotation = settings.get('rayRotation');
    } else if (settings.mode === 'random') {
        params.count = settings.get('count');
        params.areaWidth = settings.get('areaWidth');
        params.areaHeight = settings.get('areaHeight');
        params.lengthVariation = settings.get('lengthVariation');
        params.randomSeed = settings.get('randomSeed');
    } else if (settings.mode === 'flowfield') {
        params.density = settings.get('flowfield.density');
        params.areaWidth = settings.get('flowfield.areaWidth');
        params.areaHeight = settings.get('flowfield.areaHeight');
        params.flowScale = settings.get('flowfield.flowScale');
        params.flowInfluence = settings.get('flowfield.flowInfluence');
        params.flowSeed = settings.get('flowfield.flowSeed');
        params.spacing = settings.get('flowfield.spacing');
    }
    
    generator.generate(params);
}

// Debounced update functions for different parameter categories
const updateVisualizationFast = debounce(updateVisualization, DEBOUNCE_DELAYS.FAST, 'visualization');
const updateVisualizationMedium = debounce(updateVisualization, DEBOUNCE_DELAYS.MEDIUM, 'visualization');
const updateVisualizationSlow = debounce(updateVisualization, DEBOUNCE_DELAYS.SLOW, 'visualization');

// Initialize SliderController
const sliderController = new SliderController(settings);

// Mode switcher
document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        settings.mode = e.target.value;
        
        // Show/hide mode-specific controls
        const radialControls = document.getElementById('radialControls');
        const randomControls = document.getElementById('randomControls');
        const flowFieldControls = document.getElementById('flowFieldControls');
        
        // Hide all
        radialControls.style.display = 'none';
        randomControls.style.display = 'none';
        flowFieldControls.style.display = 'none';
        
        // Show active
        if (settings.mode === 'radial') {
            radialControls.style.display = 'block';
        } else if (settings.mode === 'random') {
            randomControls.style.display = 'block';
        } else if (settings.mode === 'flowfield') {
            flowFieldControls.style.display = 'block';
        }
        
        updateVisualization();
    });
});

sliderController.initSlider('raysSlider', {
    valueId: 'raysValue',
    setting: 'rays',
    min: 1,
    max: 12,
    decimals: 0,
    baseStep: 1,
    shiftStep: 1,
    onUpdate: updateVisualizationMedium
});

sliderController.initSlider('rayRotationSlider', {
    valueId: 'rayRotationValue',
    setting: 'rayRotation',
    min: 0,
    max: 360,
    decimals: 0,
    baseStep: 1,
    shiftStep: 15,
    onUpdate: updateVisualizationMedium
});

// Random mode sliders
sliderController.initSlider('randomCountSlider', {
    valueId: 'randomCountValue',
    setting: 'count',
    min: 3,
    max: 50,
    decimals: 0,
    baseStep: 1,
    shiftStep: 5,
    onUpdate: updateVisualizationMedium
});

sliderController.initSlider('areaWidthSlider', {
    valueId: 'areaWidthValue',
    setting: 'areaWidth',
    min: 100,
    max: 500,
    decimals: 0,
    baseStep: 10,
    shiftStep: 50,
    onUpdate: updateVisualizationMedium
});

sliderController.initSlider('areaHeightSlider', {
    valueId: 'areaHeightValue',
    setting: 'areaHeight',
    min: 100,
    max: 500,
    decimals: 0,
    baseStep: 10,
    shiftStep: 50,
    onUpdate: updateVisualizationMedium
});

sliderController.initSlider('lengthVariationSlider', {
    valueId: 'lengthVariationValue',
    setting: 'lengthVariation',
    min: 0,
    max: 100,
    decimals: 0,
    baseStep: 1,
    shiftStep: 10,
    onUpdate: updateVisualizationMedium
});

sliderController.initSlider('randomSeedSlider', {
    valueId: 'randomSeedValue',
    setting: 'randomSeed',
    min: 1,
    max: 99999,
    decimals: 0,
    baseStep: 1,
    shiftStep: 100,
    onUpdate: updateVisualizationMedium
});

// Flow Field sliders
sliderController.initSlider('flowDensitySlider', {
    valueId: 'flowDensityValue',
    setting: 'flowfield.density',
    min: 10,
    max: 200,
    decimals: 0,
    baseStep: 1,
    shiftStep: 10,
    onUpdate: updateVisualizationSlow
});

sliderController.initSlider('flowAreaWidthSlider', {
    valueId: 'flowAreaWidthValue',
    setting: 'flowfield.areaWidth',
    min: 100,
    max: 500,
    decimals: 0,
    baseStep: 10,
    shiftStep: 50,
    onUpdate: updateVisualizationSlow
});

sliderController.initSlider('flowAreaHeightSlider', {
    valueId: 'flowAreaHeightValue',
    setting: 'flowfield.areaHeight',
    min: 100,
    max: 500,
    decimals: 0,
    baseStep: 10,
    shiftStep: 50,
    onUpdate: updateVisualizationSlow
});

sliderController.initSlider('flowScaleSlider', {
    valueId: 'flowScaleValue',
    setting: 'flowfield.flowScale',
    min: 50,
    max: 500,
    decimals: 0,
    baseStep: 10,
    shiftStep: 50,
    onUpdate: updateVisualizationSlow
});

sliderController.initSlider('flowInfluenceSlider', {
    valueId: 'flowInfluenceValue',
    setting: 'flowfield.flowInfluence',
    min: 0,
    max: 100,
    decimals: 0,
    baseStep: 1,
    shiftStep: 10,
    onUpdate: updateVisualizationSlow
});

sliderController.initSlider('flowSeedSlider', {
    valueId: 'flowSeedValue',
    setting: 'flowfield.flowSeed',
    min: 1,
    max: 99999,
    decimals: 0,
    baseStep: 1,
    shiftStep: 100,
    onUpdate: updateVisualizationSlow
});

sliderController.initSlider('flowSpacingSlider', {
    valueId: 'flowSpacingValue',
    setting: 'flowfield.spacing',
    min: -100,
    max: 100,
    decimals: 0,
    baseStep: 1,
    shiftStep: 10,
    onUpdate: updateVisualizationSlow
});

sliderController.initSlider('lengthSlider', {
    valueId: 'lengthValue',
    setting: 'length',
    min: 25,
    max: 500,
    decimals: 0,
    baseStep: 1,
    shiftStep: 10,
    onUpdate: updateVisualizationFast
});

sliderController.initSlider('widthSlider', {
    valueId: 'widthValue',
    setting: 'width',
    min: 10,
    max: 200,
    decimals: 0,
    baseStep: 1,
    shiftStep: 5,
    onUpdate: (value) => {
        // Update stroke if auto mode is enabled
        if (settings.get('strokeAuto')) {
            const autoStroke = value - 5;
            settings.set('stroke', autoStroke);
            document.getElementById('strokeValue').value = autoStroke;
            document.getElementById('strokeSlider').value = autoStroke;
        }
        
        // Update corner radius maximum to half of width
        const cornerRadiusSlider = document.getElementById('cornerRadiusSlider');
        const maxCornerRadius = value / 2;
        cornerRadiusSlider.setAttribute('max', maxCornerRadius);
        
        // If "Max" checkbox is checked, automatically update corner radius
        if (settings.get('cornerRadiusMax')) {
            settings.set('cornerRadius', maxCornerRadius);
            document.getElementById('cornerRadiusValue').value = maxCornerRadius;
            cornerRadiusSlider.value = maxCornerRadius;
        }
        // Otherwise, just clamp if it exceeds maximum
        else if (settings.get('cornerRadius') > maxCornerRadius) {
            settings.set('cornerRadius', maxCornerRadius);
            document.getElementById('cornerRadiusValue').value = maxCornerRadius;
            cornerRadiusSlider.value = maxCornerRadius;
        }
        
        updateVisualizationFast();
    }
});

sliderController.initSlider('strokeSlider', {
    valueId: 'strokeValue',
    setting: 'stroke',
    min: 1,
    max: 100,
    decimals: 0,
    baseStep: 1,
    shiftStep: 5,
    onUpdate: (value) => {
        // Deactivate "auto" button when manually changing stroke
        const autoBtn = document.getElementById('strokeAutoBtn');
        if (autoBtn.classList.contains('active')) {
            autoBtn.classList.remove('active');
            settings.set('strokeAuto', false);
        }
        updateVisualizationFast();
    }
});

// Stroke Auto button
const strokeAutoBtn = document.getElementById('strokeAutoBtn');
const strokeSlider = document.getElementById('strokeSlider');
const strokeValue = document.getElementById('strokeValue');

// Set initial state
if (settings.get('strokeAuto')) {
    strokeAutoBtn.classList.add('active');
    strokeSlider.disabled = true;
    strokeValue.disabled = true;
}

strokeAutoBtn.addEventListener('click', () => {
    const isActive = strokeAutoBtn.classList.toggle('active');
    settings.set('strokeAuto', isActive);
    
    if (isActive) {
        // Calculate and set auto stroke (width - 5 for 10px counterform)
        const autoStroke = settings.get('width') - 5;
        settings.set('stroke', autoStroke);
        strokeValue.value = autoStroke;
        strokeSlider.value = autoStroke;
        strokeSlider.disabled = true;
        strokeValue.disabled = true;
    } else {
        // Enable slider
        strokeSlider.disabled = false;
        strokeValue.disabled = false;
    }
    
    updateVisualization();
});

sliderController.initSlider('cornerRadiusSlider', {
    valueId: 'cornerRadiusValue',
    setting: 'cornerRadius',
    min: 0,
    max: settings.get('width') / 2,
    decimals: 0,
    baseStep: 1,
    shiftStep: 5,
    onUpdate: (value) => {
        // Deactivate "Max" button when manually changing corner radius
        const maxBtn = document.getElementById('cornerRadiusMaxBtn');
        if (maxBtn.classList.contains('active')) {
            maxBtn.classList.remove('active');
            settings.set('cornerRadiusMax', false);
        }
        updateVisualizationFast();
    }
});

sliderController.initSlider('arcAmountSlider', {
    valueId: 'arcAmountValue',
    setting: 'arcAmount',
    min: 0,
    max: 100,
    decimals: 0,
    baseStep: 1,
    shiftStep: 10,
    onUpdate: updateVisualizationFast
});

// Corner Radius Max button
const cornerRadiusMaxBtn = document.getElementById('cornerRadiusMaxBtn');
const cornerRadiusSlider = document.getElementById('cornerRadiusSlider');
const cornerRadiusValue = document.getElementById('cornerRadiusValue');

// Set initial state
if (settings.get('cornerRadiusMax')) {
    cornerRadiusMaxBtn.classList.add('active');
    cornerRadiusSlider.disabled = true;
    cornerRadiusValue.disabled = true;
}

cornerRadiusMaxBtn.addEventListener('click', () => {
    const isActive = cornerRadiusMaxBtn.classList.toggle('active');
    settings.set('cornerRadiusMax', isActive);
    
    if (isActive) {
        // Set to maximum and disable slider
        const maxValue = settings.get('width') / 2;
        settings.set('cornerRadius', maxValue);
        cornerRadiusValue.value = maxValue;
        cornerRadiusSlider.value = maxValue;
        cornerRadiusSlider.disabled = true;
        cornerRadiusValue.disabled = true;
    } else {
        // Enable slider
        cornerRadiusSlider.disabled = false;
        cornerRadiusValue.disabled = false;
    }
    
    updateVisualization();
});

// Reset Extracted button for Random mode
document.getElementById('resetExtractedBtn').addEventListener('click', () => {
    generator.resetRandomMode();
});

document.getElementById('resetFlowExtractedBtn').addEventListener('click', () => {
    generator.resetFlowFieldMode();
});

// Reset Extracted button for Radial mode
document.getElementById('resetExtractedRadialBtn').addEventListener('click', () => {
    generator.resetRadialMode();
});

// Initialize PanelManager
const panelManager = new PanelManager();
panelManager.registerPanel('controlsPanel', {
    headerId: 'controlsPanelHeader',
    draggable: true,
    persistent: true
});

// Initialize ZoomPanManager
const zoomPanManager = new ZoomPanManager(
    document.getElementById('canvasContainer'),
    document.getElementById('mainSvg')
);

// Update zoom indicator
document.getElementById('canvasContainer').addEventListener('zoomchange', (e) => {
    document.getElementById('zoomIndicator').textContent = e.detail.percent + '%';
});

// Reset zoom on click
document.getElementById('zoomIndicator').addEventListener('click', () => {
    zoomPanManager.resetZoom();
});

// Panel collapse
document.querySelectorAll('.collapse-icon').forEach(icon => {
    icon.addEventListener('click', function() {
        this.closest('.controls-panel').classList.toggle('panel-collapsed');
        this.classList.toggle('collapsed');
    });
});

// Copy SVG to clipboard functionality
document.getElementById('copyBtn').addEventListener('click', async () => {
    const svgElement = document.getElementById('mainSvg');
    const clone = svgElement.cloneNode(true);
    
    // Remove area-boundary from the clone (should not be copied)
    const areaBoundary = clone.querySelector('.area-boundary');
    if (areaBoundary) {
        areaBoundary.remove();
    }
    
    const svgData = new XMLSerializer().serializeToString(clone);
    
    try {
        await navigator.clipboard.writeText(svgData);
        // Visual feedback - temporarily change button text
        const copyBtn = document.getElementById('copyBtn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy SVG to clipboard:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = svgData;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            const copyBtn = document.getElementById('copyBtn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        } catch (fallbackErr) {
            console.error('Fallback copy also failed:', fallbackErr);
            alert('Failed to copy SVG to clipboard. Please use Export SVG instead.');
        }
        document.body.removeChild(textArea);
    }
});

// Export functionality
document.getElementById('exportBtn').addEventListener('click', () => {
    const svgElement = document.getElementById('mainSvg');
    const clone = svgElement.cloneNode(true);
    
    // Remove area-boundary from the clone (should not be exported)
    const areaBoundary = clone.querySelector('.area-boundary');
    if (areaBoundary) {
        areaBoundary.remove();
    }
    
    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wander-bender-${settings.get('rays')}-rays.svg`;
    link.click();
    URL.revokeObjectURL(url);
});

// Initialize
updateVisualization();

