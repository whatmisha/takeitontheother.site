/**
 * DOM utilities
 */
export class DOMUtils {
    /**
     * Create an SVG element with attributes
     * @param {string} type - element type (rect, text, path, etc.)
     * @param {Object} attrs - attributes object
     * @param {SVGElement} [container] - container to append the element to
     * @returns {SVGElement}
     */
    static createSVGElement(type, attrs, container = null) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', type);
        Object.entries(attrs).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
        if (container) {
            container.appendChild(element);
        }
        return element;
    }

    /**
     * Cache DOM elements
     * @param {Object} selectors - object shaped like {name: 'selector'}
     * @returns {Object} - object with elements
     */
    static cacheElements(selectors) {
        const cache = {};
        for (const [name, selector] of Object.entries(selectors)) {
            cache[name] = document.getElementById(selector) || document.querySelector(selector);
        }
        return cache;
    }

    /**
     * Remove all child elements
     * @param {HTMLElement|SVGElement} element
     */
    static clearElement(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    /**
     * Add CSS class(es)
     * @param {HTMLElement} element
     * @param {string|string[]} classes
     */
    static addClass(element, classes) {
        const classList = Array.isArray(classes) ? classes : [classes];
        element.classList.add(...classList);
    }

    /**
     * Remove CSS class(es)
     * @param {HTMLElement} element
     * @param {string|string[]} classes
     */
    static removeClass(element, classes) {
        const classList = Array.isArray(classes) ? classes : [classes];
        element.classList.remove(...classList);
    }

    /**
     * Toggle CSS class
     * @param {HTMLElement} element
     * @param {string} className
     * @param {boolean} [force] - force add/remove
     */
    static toggleClass(element, className, force) {
        return element.classList.toggle(className, force);
    }

    /**
     * Set dynamic CSS styles for a slider
     * @param {string} sliderId - slider ID
     * @param {string} gradient - CSS gradient
     */
    static updateSliderGradient(sliderId, gradient) {
        const styleId = `${sliderId}-track-style`;
        let existingStyle = document.getElementById(styleId);
        
        if (existingStyle) {
            existingStyle.remove();
        }
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #${sliderId}::-webkit-slider-runnable-track {
                background: ${gradient};
            }
            #${sliderId}::-moz-range-track {
                background: ${gradient};
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Get element coordinates relative to the viewport
     * @param {HTMLElement} element
     * @returns {DOMRect}
     */
    static getElementRect(element) {
        return element.getBoundingClientRect();
    }

    /**
     * Check whether an element is visible in the viewport
     * @param {HTMLElement} element
     * @returns {boolean}
     */
    static isElementInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    /**
     * Remove event handlers by cloning the element
     * @param {HTMLElement} element
     * @returns {HTMLElement} - new element without handlers
     */
    static removeAllEventListeners(element) {
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
        return newElement;
    }
}

