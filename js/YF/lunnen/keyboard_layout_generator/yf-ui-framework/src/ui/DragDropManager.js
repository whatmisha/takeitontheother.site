/**
 * DragDropManager — управление drag & drop для SVG-объектов
 * 
 * Поддерживает snap to grid (если передан snapFunction), ограничения по границам.
 * Использует getScreenCTM().inverse() для корректной работы при любом зуме.
 * 
 * @param {Object} options
 * @param {Function} [options.snapFunction] — (x, y) => { x, y } для привязки к сетке
 * @param {Function} [options.onDragStart] — (elementId, type, data)
 * @param {Function} [options.onDrag] — (elementId, type, deltaX, deltaY, data)
 * @param {Function} [options.onDragEnd] — (elementId, type, position, data)
 * @param {Function} [options.onUpdate] — вызывается после завершения drag
 * @param {string} [options.svgSelector] — CSS-селектор SVG-элемента (по умолчанию '#mainSvg')
 */
export class DragDropManager {
    constructor(options = {}) {
        this.snapFunction = options.snapFunction || null;
        this.callbacks = {
            onDragStart: options.onDragStart || null,
            onDrag: options.onDrag || null,
            onDragEnd: options.onDragEnd || null,
            onUpdate: options.onUpdate || null,
        };
        this.svgSelector = options.svgSelector || '#mainSvg';
        
        this.dragState = {
            isDragging: false,
            element: null,
            elementId: null,
            type: null, // 'text' or 'graphics'
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            offsetX: 0,
            offsetY: 0,
            snapToGrid: true
        };

        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundMouseUp = this.onMouseUp.bind(this);
    }

    /**
     * Инициализация drag & drop для элемента
     */
    initDraggable(element, elementId, type, data) {
        if (!element) return;

        element.style.cursor = 'move';
        
        // Сохраняем данные в элементе
        element.dataset.elementId = elementId;
        element.dataset.elementType = type;
        
        // Обработчик начала перетаскивания
        element.addEventListener('mousedown', (e) => {
            this.onMouseDown(e, element, elementId, type, data);
        });
    }

    /**
     * Начало перетаскивания
     */
    onMouseDown(event, element, elementId, type, data) {
        // Игнорируем правую кнопку мыши
        if (event.button !== 0) return;

        event.preventDefault();
        event.stopPropagation();

        const svgElement = element.closest('svg') || document.querySelector(this.svgSelector);
        const point = this.getSVGPoint(event, svgElement);

        this.dragState = {
            isDragging: true,
            element: element,
            elementId: elementId,
            type: type,
            data: data,
            startX: point.x,
            startY: point.y,
            currentX: point.x,
            currentY: point.y,
            offsetX: 0,
            offsetY: 0,
            snapToGrid: !event.shiftKey // Shift отключает snap
        };

        // Поднимаем элемент наверх
        if (element.parentNode) {
            element.parentNode.appendChild(element);
        }

        // Добавляем глобальные обработчики
        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('mouseup', this.boundMouseUp);

        // Коллбэк начала перетаскивания
        if (this.callbacks.onDragStart) {
            this.callbacks.onDragStart(elementId, type, data);
        }
    }

    /**
     * Процесс перетаскивания
     */
    onMouseMove(event) {
        if (!this.dragState.isDragging) return;

        event.preventDefault();

        const svgElement = document.querySelector(this.svgSelector);
        const point = this.getSVGPoint(event, svgElement);

        const deltaX = point.x - this.dragState.startX;
        const deltaY = point.y - this.dragState.startY;

        this.dragState.currentX = point.x;
        this.dragState.currentY = point.y;
        this.dragState.offsetX = deltaX;
        this.dragState.offsetY = deltaY;

        // Обновляем позицию элемента
        this.updateElementPosition(deltaX, deltaY);

        // Коллбэк во время перетаскивания
        if (this.callbacks.onDrag) {
            this.callbacks.onDrag(
                this.dragState.elementId, 
                this.dragState.type,
                deltaX,
                deltaY,
                this.dragState.data
            );
        }
    }

    /**
     * Завершение перетаскивания
     */
    onMouseUp(event) {
        if (!this.dragState.isDragging) return;

        event.preventDefault();

        // Финальная позиция
        const finalPosition = this.calculateFinalPosition();

        // Коллбэк завершения перетаскивания
        if (this.callbacks.onDragEnd) {
            this.callbacks.onDragEnd(
                this.dragState.elementId,
                this.dragState.type,
                finalPosition,
                this.dragState.data
            );
        }

        // Сброс состояния
        this.dragState.isDragging = false;
        this.dragState.element = null;

        // Удаляем глобальные обработчики
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('mouseup', this.boundMouseUp);

        // Обновление сетки
        if (this.callbacks.onUpdate) {
            this.callbacks.onUpdate();
        }
    }

    /**
     * Обновление позиции элемента во время перетаскивания
     */
    updateElementPosition(deltaX, deltaY) {
        const element = this.dragState.element;
        if (!element) return;

        // Получаем текущий transform
        const transform = element.getAttribute('transform') || '';
        const translateMatch = transform.match(/translate\(([^,]+),([^)]+)\)/);
        
        let currentX = 0;
        let currentY = 0;
        
        if (translateMatch) {
            currentX = parseFloat(translateMatch[1]) || 0;
            currentY = parseFloat(translateMatch[2]) || 0;
        }

        const newX = currentX + deltaX;
        const newY = currentY + deltaY;

        // Применяем новый transform
        const newTransform = transform.replace(/translate\([^)]+\)/, '').trim() + 
                           ` translate(${newX},${newY})`;
        
        element.setAttribute('transform', newTransform.trim());
        
        // Обновляем startX/Y для следующего движения
        this.dragState.startX = this.dragState.currentX;
        this.dragState.startY = this.dragState.currentY;
    }

    /**
     * Расчет финальной позиции с учетом snap to grid
     */
    calculateFinalPosition() {
        const element = this.dragState.element;
        if (!element) return null;

        // Получаем текущую позицию из transform
        const transform = element.getAttribute('transform') || '';
        const translateMatch = transform.match(/translate\(([^,]+),([^)]+)\)/);
        
        let x = 0;
        let y = 0;
        
        if (translateMatch) {
            x = parseFloat(translateMatch[1]) || 0;
            y = parseFloat(translateMatch[2]) || 0;
        }

        if (this.dragState.snapToGrid && this.snapFunction) {
            return this.snapFunction(x, y);
        }

        return { x, y };
    }

    /**
     * Получение SVG координат из события мыши
     */
    getSVGPoint(event, svgElement) {
        if (!svgElement || !svgElement.createSVGPoint) {
            // Fallback для не-SVG элементов
            return { x: event.clientX, y: event.clientY };
        }

        const point = svgElement.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;

        // Преобразуем координаты экрана в координаты SVG
        const ctm = svgElement.getScreenCTM();
        if (ctm) {
            const transformedPoint = point.matrixTransform(ctm.inverse());
            return { x: transformedPoint.x, y: transformedPoint.y };
        }

        return { x: event.clientX, y: event.clientY };
    }

    /**
     * Включение/отключение snap to grid
     */
    setSnapToGrid(enabled) {
        this.dragState.snapToGrid = enabled;
    }

    /**
     * Проверка идет ли сейчас перетаскивание
     */
    isDragging() {
        return this.dragState.isDragging;
    }

    /**
     * Получение текущего перетаскиваемого элемента
     */
    getCurrentElement() {
        return this.dragState.isDragging ? {
            id: this.dragState.elementId,
            type: this.dragState.type,
            element: this.dragState.element
        } : null;
    }

    /**
     * Программная остановка перетаскивания
     */
    cancelDrag() {
        if (!this.dragState.isDragging) return;

        // Сброс состояния без коллбэка
        this.dragState.isDragging = false;
        this.dragState.element = null;

        // Удаляем обработчики
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('mouseup', this.boundMouseUp);
    }

    /**
     * Очистка всех обработчиков
     */
    destroy() {
        this.cancelDrag();
        this.dragState = null;
        this.callbacks = null;
    }
}

