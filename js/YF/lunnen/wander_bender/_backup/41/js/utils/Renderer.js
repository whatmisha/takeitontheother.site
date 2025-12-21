/**
 * Renderer - Утилиты для рендеринга SVG элементов
 * Общие функции для создания paths, hit areas, extracted shapes и boundaries
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Render a united path (combined shape with stroke)
 * @param {paper.Path} unitedPath - Paper.js path to render
 * @param {number} stroke - Stroke width
 * @param {HTMLElement} group - SVG group element to append to
 * @returns {SVGPathElement} Created SVG path element
 */
export function renderUnitedPath(unitedPath, stroke, group) {
    if (!unitedPath) return null;
    
    const pathData = unitedPath.pathData;
    unitedPath.remove();
    
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#ffffff');
    path.setAttribute('stroke-width', stroke);
    path.setAttribute('stroke-linejoin', 'round');
    path.classList.add('united-shape');
    
    group.appendChild(path);
    return path;
}

/**
 * Render a hit area for interactive elements
 * @param {string} pathData - SVG path data
 * @param {number} index - Element index
 * @param {string} indexAttribute - Attribute name for index (e.g., 'rayIndex', 'rectIndex')
 * @param {Function} onClick - Click handler function
 * @param {HTMLElement} group - SVG group element to append to
 * @param {Object} options - Additional options (fill, etc.)
 * @returns {SVGPathElement} Created hit area element
 */
export function renderHitArea(pathData, index, indexAttribute, onClick, group, options = {}) {
    const hitArea = document.createElementNS(SVG_NS, 'path');
    hitArea.setAttribute('d', pathData);
    hitArea.setAttribute('fill', options.fill || 'transparent');
    hitArea.setAttribute('stroke', 'none');
    hitArea.style.cursor = 'pointer';
    hitArea.classList.add('hit-area');
    hitArea.dataset[indexAttribute] = index;
    
    hitArea.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick(index);
    });
    
    group.appendChild(hitArea);
    return hitArea;
}

/**
 * Render an extracted shape (separated from united group)
 * @param {string} pathData - SVG path data
 * @param {number} stroke - Stroke width
 * @param {number} index - Element index
 * @param {string} indexAttribute - Attribute name for index
 * @param {Function} onClick - Click handler function (to return to group)
 * @param {HTMLElement} group - SVG group element to append to
 * @param {Object} options - Additional options (strokeLinecap, etc.)
 * @returns {SVGPathElement} Created extracted shape element
 */
export function renderExtractedShape(pathData, stroke, index, indexAttribute, onClick, group, options = {}) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', '#000000'); // Black fill like background
    path.setAttribute('stroke', '#ffffff');
    path.setAttribute('stroke-width', stroke);
    path.setAttribute('stroke-linejoin', 'round');
    
    if (options.strokeLinecap) {
        path.setAttribute('stroke-linecap', options.strokeLinecap);
    }
    
    path.classList.add('extracted-shape');
    path.dataset[indexAttribute] = index;
    path.style.cursor = 'pointer';
    
    path.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick(index);
    });
    
    group.appendChild(path);
    return path;
}

/**
 * Draw area boundary rectangle
 * @param {number} centerX - Center X coordinate
 * @param {number} centerY - Center Y coordinate
 * @param {number} areaWidth - Width of the area
 * @param {number} areaHeight - Height of the area
 * @param {HTMLElement} group - SVG group element to append to
 * @returns {SVGRectElement} Created rectangle element
 */
export function drawAreaBoundary(centerX, centerY, areaWidth, areaHeight, group) {
    const areaRect = document.createElementNS(SVG_NS, 'rect');
    areaRect.setAttribute('x', centerX - areaWidth / 2);
    areaRect.setAttribute('y', centerY - areaHeight / 2);
    areaRect.setAttribute('width', areaWidth);
    areaRect.setAttribute('height', areaHeight);
    areaRect.setAttribute('fill', 'none');
    areaRect.setAttribute('stroke', '#333333');
    areaRect.setAttribute('stroke-width', '0.5');
    areaRect.classList.add('area-boundary');
    
    group.appendChild(areaRect);
    return areaRect;
}

