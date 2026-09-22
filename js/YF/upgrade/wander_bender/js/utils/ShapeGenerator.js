/**
 * ShapeGenerator - Утилиты для генерации форм из линий
 * Поддерживает прямые линии и дуги с закругленными концами
 */

/**
 * Get a point at a specific distance along a line
 * @param {Array} line - Line definition: [{x, y}, {x, y}] for straight, or [{x, y}, {x, y}, arcAmount] for arc
 * @param {number} distance - Distance along the line from the start
 * @returns {{x: number, y: number}} Point coordinates
 */
export function getPointOnLine(line, distance) {
    if (line.length < 2) return { x: 0, y: 0 };
    
    const start = line[0];
    const end = line[1];
    const arcAmount = line[2] || 0;
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lineLength = Math.sqrt(dx * dx + dy * dy);
    
    // Clamp distance to line length
    const t = Math.min(distance / lineLength, 1);
    
    // For straight line (arcAmount === 0)
    if (arcAmount === 0) {
        return {
            x: start.x + dx * t,
            y: start.y + dy * t
        };
    }
    
    // For circular arc (arcAmount > 0)
    const chord = lineLength;
    const sagitta = arcAmount;
    
    // Calculate radius of the circle: R = (chord² + 4·sagitta²) / (8·sagitta)
    const radius = (chord * chord + 4 * sagitta * sagitta) / (8 * sagitta);
    
    // Center of circle is at distance (R - sagitta) from chord midpoint
    const midX = start.x + dx * 0.5;
    const midY = start.y + dy * 0.5;
    
    const perpX = -dy / lineLength;
    const perpY = dx / lineLength;
    
    const centerX = midX + perpX * (radius - sagitta);
    const centerY = midY + perpY * (radius - sagitta);
    
    // Calculate angle span of the arc
    const halfChord = chord / 2;
    const angleSpan = 2 * Math.asin(halfChord / radius);
    
    // Start angle (from center to start point)
    const startAngle = Math.atan2(start.y - centerY, start.x - centerX);
    
    // Current angle along the arc
    const currentAngle = startAngle + angleSpan * t;
    
    return {
        x: centerX + radius * Math.cos(currentAngle),
        y: centerY + radius * Math.sin(currentAngle)
    };
}

/**
 * Create a shape from a line path
 * @param {Array} line - Line definition: [{x, y}, {x, y}] for straight, or [{x, y}, {x, y}, arcAmount] for arc
 * @param {number} width - Thickness of the resulting shape
 * @param {number} cornerRadius - Corner radius applied to the ends
 * @param {number} pivotDistance - Distance along the line where the pivot point should be
 * @returns {{shape: paper.Path, pivotPoint: {x: number, y: number}}|null} Shape and pivot point, or null if invalid
 */
export function createShapeFromLine(line, width, cornerRadius, pivotDistance) {
    if (line.length < 2) return null;
    
    const start = line[0];
    const end = line[1];
    const arcAmount = line[2] || 0;
    
    // Calculate pivot point on the line
    const pivotPoint = getPointOnLine(line, pivotDistance);
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    // For straight line (arcAmount === 0), create a rounded rectangle
    if (arcAmount === 0) {
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        const rect = new paper.Path.Rectangle({
            point: [start.x, start.y - width / 2],
            size: [length, width],
            radius: cornerRadius
        });
        
        if (angle !== 0) {
            rect.rotate(angle, new paper.Point(start.x, start.y));
        }
        
        return { shape: rect, pivotPoint };
    }
    
    // For circular arc, create a curved path with proper rounded ends
    const chord = length;
    // arcAmount is the sagitta (height of arc) directly
    const sagitta = arcAmount;
    
    // Skip arc if sagitta is too small
    if (sagitta < 0.1) {
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        const rect = new paper.Path.Rectangle({
            point: [start.x, start.y - width / 2],
            size: [length, width],
            radius: cornerRadius
        });
        
        if (angle !== 0) {
            rect.rotate(angle, new paper.Point(start.x, start.y));
        }
        
        return { shape: rect, pivotPoint };
    }
    
    // Caps should be INSIDE the line length to maintain total length
    const capLength = width / 2;
    const tStart = capLength / length;
    const tEnd = 1 - capLength / length;
    
    // Calculate radius of the circle
    const radius = (chord * chord + 4 * sagitta * sagitta) / (8 * sagitta);
    
    // Center of circle
    const midX = start.x + dx * 0.5;
    const midY = start.y + dy * 0.5;
    const perpX = -dy / length;
    const perpY = dx / length;
    const centerX = midX + perpX * (radius - sagitta);
    const centerY = midY + perpY * (radius - sagitta);
    
    // Calculate angle span
    const halfChord = chord / 2;
    const angleSpan = 2 * Math.asin(halfChord / radius);
    const startAngle = Math.atan2(start.y - centerY, start.x - centerX);
    
    const segments = 30;
    const shape = new paper.Path();
    
    // Top edge of the arc (from tStart to tEnd)
    for (let i = 0; i <= segments; i++) {
        const t = tStart + (tEnd - tStart) * (i / segments);
        
        // Point on circular arc
        const currentAngle = startAngle + angleSpan * t;
        const arcX = centerX + radius * Math.cos(currentAngle);
        const arcY = centerY + radius * Math.sin(currentAngle);
        
        // Tangent to circle at this point
        const tangentX = -Math.sin(currentAngle);
        const tangentY = Math.cos(currentAngle);
        
        // Normal (perpendicular to tangent, pointing outward)
        const normalX = Math.cos(currentAngle);
        const normalY = Math.sin(currentAngle);
        
        shape.add(new paper.Point(
            arcX + normalX * width / 2,
            arcY + normalY * width / 2
        ));
    }
    
    // Add rounded end cap (right side)
    const endT = tEnd;
    const endAngle = startAngle + angleSpan * endT;
    const endCenterX = centerX + radius * Math.cos(endAngle);
    const endCenterY = centerY + radius * Math.sin(endAngle);
    
    const endTangentX = -Math.sin(endAngle);
    const endTangentY = Math.cos(endAngle);
    const endNormalX = Math.cos(endAngle);
    const endNormalY = Math.sin(endAngle);
    
    // Semicircle at end
    const capSteps = 10;
    for (let i = 1; i <= capSteps; i++) {
        const capAngle = (i / capSteps) * Math.PI;
        const capX = endCenterX + endNormalX * Math.cos(capAngle) * width / 2 + 
                    endTangentX * Math.sin(capAngle) * width / 2;
        const capY = endCenterY + endNormalY * Math.cos(capAngle) * width / 2 + 
                    endTangentY * Math.sin(capAngle) * width / 2;
        shape.add(new paper.Point(capX, capY));
    }
    
    // Bottom edge (reverse, from tEnd to tStart)
    for (let i = segments; i >= 0; i--) {
        const t = tStart + (tEnd - tStart) * (i / segments);
        
        const currentAngle = startAngle + angleSpan * t;
        const arcX = centerX + radius * Math.cos(currentAngle);
        const arcY = centerY + radius * Math.sin(currentAngle);
        
        const normalX = Math.cos(currentAngle);
        const normalY = Math.sin(currentAngle);
        
        shape.add(new paper.Point(
            arcX - normalX * width / 2,
            arcY - normalY * width / 2
        ));
    }
    
    // Add rounded end cap (left side)
    const startT = tStart;
    const startCircleAngle = startAngle + angleSpan * startT;
    const startCenterX = centerX + radius * Math.cos(startCircleAngle);
    const startCenterY = centerY + radius * Math.sin(startCircleAngle);
    
    const startTangentX = -Math.sin(startCircleAngle);
    const startTangentY = Math.cos(startCircleAngle);
    const startNormalX = Math.cos(startCircleAngle);
    const startNormalY = Math.sin(startCircleAngle);
    
    // Semicircle at start
    for (let i = 1; i <= capSteps; i++) {
        const capAngle = (i / capSteps) * Math.PI;
        const capX = startCenterX - startNormalX * Math.cos(capAngle) * width / 2 - 
                    startTangentX * Math.sin(capAngle) * width / 2;
        const capY = startCenterY - startNormalY * Math.cos(capAngle) * width / 2 - 
                    startTangentY * Math.sin(capAngle) * width / 2;
        shape.add(new paper.Point(capX, capY));
    }
    
    shape.closePath();
    
    // Apply cornerRadius as smoothing if needed
    if (cornerRadius > 0) {
        shape.smooth({ type: 'continuous', factor: Math.min(cornerRadius / width, 0.5) });
    }
    
    return { shape, pivotPoint };
}

