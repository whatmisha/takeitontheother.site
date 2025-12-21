/**
 * BaseMode - Базовый класс для всех режимов генерации
 * Содержит общую логику, которая используется всеми режимами
 */

import { clearGroup } from '../utils/Renderer.js';

export class BaseMode {
    constructor(generator) {
        this.generator = generator;
        this.group = generator.group;
        this.centerX = generator.centerX;
        this.centerY = generator.centerY;
        
        // Storage for mode-specific data
        this.elements = [];
        this.extractedIndices = [];
        this.currentParams = null;
        
        // Performance optimization: cache last params to avoid unnecessary regeneration
        this.lastParamsHash = null;
    }
    
    /**
     * Generate hash from params for comparison
     * @param {Object} params - Parameters to hash
     * @returns {string} Hash string
     */
    getParamsHash(params) {
        // Create a simple hash from stringified params
        // Ignore extractedIndices as those don't require regeneration
        const paramsToHash = { ...params };
        delete paramsToHash.extractedIndices;
        return JSON.stringify(paramsToHash);
    }
    
    /**
     * Check if params have changed since last generation
     * @param {Object} params - Current parameters
     * @returns {boolean} True if params changed
     */
    paramsChanged(params) {
        const currentHash = this.getParamsHash(params);
        const changed = currentHash !== this.lastParamsHash;
        this.lastParamsHash = currentHash;
        return changed;
    }
    
    /**
     * Generate composition - must be implemented by child classes
     * @param {Object} params - Generation parameters
     */
    generate(params) {
        throw new Error('generate() must be implemented by child class');
    }
    
    /**
     * Render composition - must be implemented by child classes
     */
    render() {
        throw new Error('render() must be implemented by child class');
    }
    
    /**
     * Extract element at index
     * @param {number} index - Element index to extract
     */
    extractElement(index) {
        if (!this.extractedIndices.includes(index)) {
            this.extractedIndices.push(index);
        }
        this.render();
    }
    
    /**
     * Return extracted element back to united group
     * @param {number} index - Element index to return
     */
    returnElement(index) {
        const position = this.extractedIndices.indexOf(index);
        if (position > -1) {
            this.extractedIndices.splice(position, 1);
        }
        this.render();
    }
    
    /**
     * Reset all extracted elements
     */
    resetExtracted() {
        this.extractedIndices = [];
        if (this.currentParams) {
            this.render();
        }
    }
    
    /**
     * Clear the group efficiently
     */
    clearGroup() {
        clearGroup(this.group);
    }
    
    /**
     * Seeded random number generator for reproducibility
     * @param {number} seed - Random seed
     * @returns {Function} Random function
     */
    seededRandom(seed) {
        let state = seed;
        return function() {
            state = (state * 9301 + 49297) % 233280;
            return state / 233280;
        };
    }
}

