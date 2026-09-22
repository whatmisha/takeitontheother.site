/**
 * PaperUtils - Утилиты для работы с Paper.js
 * Обертки для общих операций с путями
 */

/**
 * Unite multiple Paper.js paths into a single path
 * @param {Array<paper.Path>} paths - Array of Paper.js paths to unite
 * @returns {paper.Path|null} United path, or null if no paths provided
 */
export function unitePaths(paths) {
    if (!paths || paths.length === 0) return null;
    
    let unitedPath = paths[0];
    
    for (let i = 1; i < paths.length; i++) {
        if (paths[i]) {
            unitedPath = unitedPath.unite(paths[i]);
            paths[i].remove();
        }
    }
    
    return unitedPath;
}

/**
 * Get path data from a Paper.js path and remove it
 * @param {paper.Path} path - Paper.js path
 * @returns {string} SVG path data
 */
export function getPathDataAndRemove(path) {
    if (!path) return '';
    const pathData = path.pathData;
    path.remove();
    return pathData;
}

