/**
 * SpatialHash - Spatial hashing for fast collision detection
 * Divides space into grid cells for O(1) neighbor lookup
 */

export class SpatialHash {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }
    
    /**
     * Get cell key for coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {string} Cell key
     */
    getCellKey(x, y) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return `${cellX},${cellY}`;
    }
    
    /**
     * Insert an element into the spatial hash
     * @param {Object} element - Element with bounds {x, y, width, height}
     * @param {number} index - Element index
     */
    insert(element, index) {
        const { x, y, width, height } = element.bounds;
        
        // Calculate which cells this element occupies
        const minCellX = Math.floor(x / this.cellSize);
        const minCellY = Math.floor(y / this.cellSize);
        const maxCellX = Math.floor((x + width) / this.cellSize);
        const maxCellY = Math.floor((y + height) / this.cellSize);
        
        // Insert into all occupied cells
        for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
            for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
                const key = `${cellX},${cellY}`;
                if (!this.grid.has(key)) {
                    this.grid.set(key, []);
                }
                this.grid.get(key).push({ element, index });
            }
        }
    }
    
    /**
     * Get potential collision candidates for a bounding box
     * @param {Object} bounds - Bounding box {x, y, width, height}
     * @returns {Array} Array of potential collision candidates
     */
    query(bounds) {
        const { x, y, width, height } = bounds;
        
        const minCellX = Math.floor(x / this.cellSize);
        const minCellY = Math.floor(y / this.cellSize);
        const maxCellX = Math.floor((x + width) / this.cellSize);
        const maxCellY = Math.floor((y + height) / this.cellSize);
        
        const candidates = new Set();
        
        for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
            for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
                const key = `${cellX},${cellY}`;
                const cell = this.grid.get(key);
                if (cell) {
                    for (const item of cell) {
                        candidates.add(item);
                    }
                }
            }
        }
        
        return Array.from(candidates);
    }
    
    /**
     * Clear all data from the spatial hash
     */
    clear() {
        this.grid.clear();
    }
}

