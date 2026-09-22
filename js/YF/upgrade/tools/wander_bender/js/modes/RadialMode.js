/**
 * RadialMode - Radial distribution mode
 * Generates rays emanating from a central point
 */

import { BaseMode } from './BaseMode.js';
import { createShapeFromLine } from '../utils/ShapeGenerator.js';
import { renderUnitedPath, renderHitArea, renderExtractedShape } from '../utils/Renderer.js';
import { getPathDataAndRemove } from '../utils/PaperUtils.js';

export class RadialMode extends BaseMode {
    constructor(generator) {
        super(generator);
    }
    
    generate(params) {
        // Store params for regeneration
        this.currentParams = params;
        
        // Only regenerate elements if shape parameters changed
        // Extraction state changes don't require regeneration
        if (this.paramsChanged(params)) {
            this.generateElements(params);
        }
        
        // Always re-render (extraction state might have changed)
        this.render();
    }
    
    generateElements(params) {
        let { rays, rayRotation, length, width, stroke, cornerRadius, arcAmount } = params;
        
        // Ensure corner radius doesn't exceed half of width
        cornerRadius = Math.min(cornerRadius, width / 2);
        
        // Calculate angle step
        const angleStep = (2 * Math.PI) / rays;
        
        // Store rays data
        this.elements = [];
        
        for (let i = 0; i < rays; i++) {
            // Start at 6 o'clock position (90 degrees)
            const angle = (i * angleStep) + (Math.PI / 2);
            
            // Define line: from (0,0) to length with arc
            const lineStart = { x: 0, y: 0 };
            const lineEnd = { x: length, y: 0 };
            
            // Pivot distance along the line (at cornerRadius distance from start)
            const pivotDistance = cornerRadius;
            
            // Store ray data (line includes arcAmount as third element)
            this.elements.push({
                line: [lineStart, lineEnd, arcAmount],
                angle: angle * 180 / Math.PI,
                rayRotation,
                centerX: this.centerX,
                centerY: this.centerY,
                pivotDistance,
                length,
                width,
                cornerRadius
            });
        }
    }
    
    render() {
        const stroke = this.currentParams.stroke;
        
        // Clear group
        this.clearGroup();
        
        // Create Paper.js paths for non-extracted rays
        let unitedPath = null;
        
        for (let i = 0; i < this.elements.length; i++) {
            if (this.extractedIndices.includes(i)) {
                // This ray is extracted, skip for united path
                continue;
            }
            
            const { line, angle, rayRotation, centerX, centerY, pivotDistance, width, cornerRadius } = this.elements[i];
            
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
        for (let i = 0; i < this.elements.length; i++) {
            if (this.extractedIndices.includes(i)) continue;
            
            const { line, angle, rayRotation, centerX, centerY, pivotDistance, width, cornerRadius } = this.elements[i];
            
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
            renderHitArea(pathData, i, 'rayIndex', (index) => this.extractElement(index), this.group);
        }
        
        // Render extracted rays in order of extraction (bottom to top)
        for (const index of this.extractedIndices) {
            const { line, angle, rayRotation, centerX, centerY, pivotDistance, width, cornerRadius } = this.elements[index];
            
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
            renderExtractedShape(pathData, stroke, index, 'rayIndex', (idx) => this.returnElement(idx), this.group);
        }
    }
}

