/**
 * Утилиты для работы с DOM
 */
export class DOMUtils {
    /**
     * Создание SVG элемента с атрибутами
     * @param {string} type - тип элемента (rect, text, path и т.д.)
     * @param {Object} attrs - объект с атрибутами
     * @param {SVGElement} [container] - контейнер для добавления элемента
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
     * Кэширование DOM элементов
     * @param {Object} selectors - объект вида {name: 'selector'}
     * @returns {Object} - объект с элементами
     */
    static cacheElements(selectors) {
        const cache = {};
        for (const [name, selector] of Object.entries(selectors)) {
            cache[name] = document.getElementById(selector) || document.querySelector(selector);
        }
        return cache;
    }

    /**
     * Удаление всех дочерних элементов
     * @param {HTMLElement|SVGElement} element
     */
    static clearElement(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    /**
     * Добавление CSS класса с поддержкой нескольких классов
     * @param {HTMLElement} element
     * @param {string|string[]} classes
     */
    static addClass(element, classes) {
        const classList = Array.isArray(classes) ? classes : [classes];
        element.classList.add(...classList);
    }

    /**
     * Удаление CSS класса
     * @param {HTMLElement} element
     * @param {string|string[]} classes
     */
    static removeClass(element, classes) {
        const classList = Array.isArray(classes) ? classes : [classes];
        element.classList.remove(...classList);
    }

    /**
     * Переключение CSS класса
     * @param {HTMLElement} element
     * @param {string} className
     * @param {boolean} [force] - принудительное добавление/удаление
     */
    static toggleClass(element, className, force) {
        return element.classList.toggle(className, force);
    }

    /**
     * Установка динамических CSS стилей для слайдера
     * @param {string} sliderId - ID слайдера
     * @param {string} gradient - CSS градиент
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
     * Получение координат элемента относительно viewport
     * @param {HTMLElement} element
     * @returns {DOMRect}
     */
    static getElementRect(element) {
        return element.getBoundingClientRect();
    }

    /**
     * Проверка видимости элемента в viewport
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
     * Замена обработчиков событий путем клонирования элемента
     * @param {HTMLElement} element
     * @returns {HTMLElement} - новый элемент без обработчиков
     */
    static removeAllEventListeners(element) {
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
        return newElement;
    }
}

