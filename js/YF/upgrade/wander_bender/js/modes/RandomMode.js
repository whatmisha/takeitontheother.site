/**
 * RandomMode - Random distribution mode
 * Generates elements with random position, rotation, and length variation
 */

import { BaseMode } from './BaseMode.js';
import { createShapeFromLine } from '../utils/ShapeGenerator.js';
import { renderUnitedPath, renderHitArea, renderExtractedShape, drawAreaBoundary } from '../utils/Renderer.js';
import { getPathDataAndRemove } from '../utils/PaperUtils.js';

export class RandomMode extends BaseMode {
    constructor(generator) {
        super(generator);
    }
    
    generate(params) {
        // Store params for regeneration
        this.currentParams = params;
        
        // Only regenerate elements if parameters changed
        if (this.paramsChanged(params)) {
            this.generateElements(params);
        }
        
        // Always re-render
        this.render();
    }
    
    generateElements(params) {
        let { count, areaWidth, areaHeight, lengthVariation, randomSeed, length, width, stroke, cornerRadius, arcAmount } = params;
        
        // Ensure corner radius doesn't exceed half of width
        cornerRadius = Math.min(cornerRadius, width / 2);
        
        // Initialize seeded random
        const random = this.seededRandom(randomSeed);
        
        // Store rectangles data
        this.elements = [];
        
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
            this.elements.push({
                line: [lineStart, lineEnd, arcAmount],
                x, y, angle, width, cornerRadius, pivotDistance
            });
        }
    }
    
    render() {
        const { stroke, areaWidth, areaHeight } = this.currentParams;
        
        // Clear group
        this.clearGroup();
        
        // Draw area boundary (subtle dark gray rectangle)
        drawAreaBoundary(this.centerX, this.centerY, areaWidth, areaHeight, this.group);
        
        // Create Paper.js paths for non-extracted rectangles
        let unitedPath = null;
        
        for (let i = 0; i < this.elements.length; i++) {
            if (this.extractedIndices.includes(i)) {
                // This rectangle is extracted, skip for united path
                continue;
            }
            
            const { line, x, y, angle, width, cornerRadius, pivotDistance } = this.elements[i];
            
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
        for (let i = 0; i < this.elements.length; i++) {
            if (this.extractedIndices.includes(i)) continue;
            
            const { line, x, y, angle, width, cornerRadius, pivotDistance } = this.elements[i];
            
            // Create shape from line for hit area
            const result = createShapeFromLine(line, width, cornerRadius, pivotDistance);
            if (!result) continue;
            
            const { shape, pivotPoint } = result;
            
            shape.translate(new paper.Point(x - pivotPoint.x, y - pivotPoint.y));
            shape.rotate(angle, new paper.Point(x, y));
            
            const pathData = getPathDataAndRemove(shape);
            
            // Create invisible hit area
            renderHitArea(pathData, i, 'rectIndex', (index) => this.extractElement(index), this.group);
        }
        
        // Render extracted rectangles in order of extraction (bottom to top)
        for (const index of this.extractedIndices) {
            const { line, x, y, angle, width, cornerRadius, pivotDistance } = this.elements[index];
            
            // Create shape from line
            const result = createShapeFromLine(line, width, cornerRadius, pivotDistance);
            if (!result) continue;
            
            const { shape, pivotPoint } = result;
            
            shape.translate(new paper.Point(x - pivotPoint.x, y - pivotPoint.y));
            shape.rotate(angle, new paper.Point(x, y));
            
            const pathData = getPathDataAndRemove(shape);
            
            // Create SVG path
            renderExtractedShape(pathData, stroke, index, 'rectIndex', (idx) => this.returnElement(idx), this.group);
        }
    }
}

