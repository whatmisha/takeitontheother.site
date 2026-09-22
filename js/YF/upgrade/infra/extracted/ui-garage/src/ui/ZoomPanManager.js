/**
 * ZoomPanManager - Управление зумом и панорамированием canvas как в Figma
 * 
 * Функции:
 * - Zoom: колесо мыши с центром на курсоре (векторное через viewBox)
 * - Pan: пробел + drag или средняя кнопка мыши
 * - Pinch-to-zoom на тачпадах
 * - Fit to screen
 * - Reset zoom (100%)
 * 
 * ВАЖНО: Использует SVG viewBox для настоящего векторного масштабирования
 *
 * @param {HTMLElement} containerElement — обычно #canvasContainer (область между верхней и нижней панелями)
 * @param {SVGSVGElement} svgElement
 * @param {Object} [options]
 * @param {{ top?: number, right?: number, bottom?: number, left?: number }} [options.fitPadding]
 *        Отступы внутри контейнера при fitToScreen (по умолчанию небольшой inset — макет «вписывается» в слот канваса)
 * @param {boolean} [options.interactive=true] — attach wheel/keyboard/pointer listeners
 */
export class ZoomPanManager {
    constructor(containerElement, svgElement, options = {}) {
        this.container = containerElement;
        this.svg = svgElement;
        this.interactive = options.interactive !== false;

        const fp = options.fitPadding || {};
        this.fitPadding = {
            top:    fp.top    ?? 20,
            right:  fp.right  ?? 20,
            bottom: fp.bottom ?? 20,
            left:   fp.left   ?? 20
        };
        
        // Состояние трансформации
        this.zoom = 1;
        this.baseZoom = 1; // Зум, который считается за 100% (обычно fitToScreen)
        this.minZoom = 0.05; // Позволяем отдаляться меньше 1.0, иначе fit ломается на больших артбордах
        this.maxZoom = 10;
        this.panX = 0;
        this.panY = 0;
        
        // Исходные размеры SVG
        this.originalWidth = 0;
        this.originalHeight = 0;
        
        // Состояние перетаскивания
        this.isPanning = false;
        this.isSpacePressed = false;
        this.startX = 0;
        this.startY = 0;
        this.lastX = 0;
        this.lastY = 0;
        
        // Инициализируем SVG для векторного зума
        this.initializeSVG();
        
        // Инициализируем обработчики
        if (this.interactive) this.initEventListeners();
    }
    
    /**
     * Читает размеры SVG и настраивает стили контейнера.
     * НЕ трогает viewBox — им управляет только zoom-логика (fitToScreen / updateTransform).
     */
    initializeSVG() {
        this.reinitializeSVGDimensions();

        this.svg.style.width = '100%';
        this.svg.style.height = '100%';
        this.svg.style.shapeRendering = 'geometricPrecision';
        this.svg.style.textRendering = 'geometricPrecision';

        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';
        this.container.style.cursor = 'default';
    }
    
    /**
     * Инициализирует все обработчики событий
     */
    initEventListeners() {
        // Bind once so destroy() can detach the exact same references.
        this._onWheel = this.handleWheel.bind(this);
        this._onKeyDown = this.handleKeyDown.bind(this);
        this._onKeyUp = this.handleKeyUp.bind(this);
        this._onMouseDown = this.handleMouseDown.bind(this);
        this._onMouseMove = this.handleMouseMove.bind(this);
        this._onMouseUp = this.handleMouseUp.bind(this);
        this._onContextMenu = (e) => { if (e.button === 1) e.preventDefault(); };

        this.container.addEventListener('wheel', this._onWheel, { passive: false });
        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);
        this.container.addEventListener('mousedown', this._onMouseDown);
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mouseup', this._onMouseUp);
        this.container.addEventListener('contextmenu', this._onContextMenu);
    }
    
    /**
     * Обработчик колеса мыши для зума и панорамирования
     */
    handleWheel(e) {
        e.preventDefault();
        
        // Получаем координаты курсора относительно container
        const rect = this.container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Если зажат Cmd/Ctrl - зум (как в Figma/Apple приложениях)
        if (e.metaKey || e.ctrlKey) {
            // Определяем направление зума
            const delta = -Math.sign(e.deltaY);
            const zoomSpeed = 0.05; // Уменьшено в 2 раза (было 0.1)
            const newZoom = this.zoom * (1 + delta * zoomSpeed);
            
            // Применяем зум с центром на курсоре
            this.zoomTo(newZoom, mouseX, mouseY);
        } else {
            // Иначе - панорамирование (для Apple Magic Mouse и трекпадов)
            const viewBox = this.getViewBox();
            
            // Преобразуем движение в координаты SVG
            const deltaXSvg = (e.deltaX / rect.width) * viewBox.width;
            const deltaYSvg = (e.deltaY / rect.height) * viewBox.height;
            
            // Обновляем позицию viewBox
            this.panX += deltaXSvg;
            this.panY += deltaYSvg;
            
            this.updateTransform();
        }
    }
    
    /**
     * Зум к указанной точке
     */
    zoomTo(newZoom, mouseX, mouseY) {
        newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
        if (newZoom === this.zoom) return;

        const viewBox = this.getViewBox();
        const rect = this.container.getBoundingClientRect();

        const svgX = viewBox.x + (mouseX / rect.width) * viewBox.width;
        const svgY = viewBox.y + (mouseY / rect.height) * viewBox.height;

        const newWidth = rect.width / newZoom;
        const newHeight = rect.height / newZoom;

        this.panX = svgX - (mouseX / rect.width) * newWidth;
        this.panY = svgY - (mouseY / rect.height) * newHeight;
        this.zoom = newZoom;

        this.updateTransform();
        this.notifyZoomChange();
    }
    
    /**
     * Обработчик нажатия клавиш
     */
    handleKeyDown(e) {
        // Проверяем, что фокус не на input элементах
        if (e.target.tagName === 'INPUT' || 
            e.target.tagName === 'TEXTAREA' || 
            e.target.tagName === 'SELECT') {
            return;
        }
        
        if (e.code === 'Space' && !this.isSpacePressed) {
            e.preventDefault();
            this.isSpacePressed = true;
            this.container.style.cursor = 'grab';
        }
        
        // Cmd/Ctrl + Plus: Zoom in
        if ((e.metaKey || e.ctrlKey) && (e.key === '+' || e.key === '=')) {
            e.preventDefault();
            this.zoomIn();
        }
        
        // Cmd/Ctrl + Minus: Zoom out
        if ((e.metaKey || e.ctrlKey) && e.key === '-') {
            e.preventDefault();
            this.zoomOut();
        }
    }
    
    /**
     * Обработчик отпускания клавиш
     */
    handleKeyUp(e) {
        if (e.code === 'Space') {
            this.isSpacePressed = false;
            if (!this.isPanning) {
                this.container.style.cursor = 'default';
            }
        }
    }
    
    /**
     * Обработчик нажатия кнопки мыши
     */
    handleMouseDown(e) {
        // Пробел + левая кнопка или средняя кнопка мыши
        if ((this.isSpacePressed && e.button === 0) || e.button === 1) {
            e.preventDefault();
            e.stopPropagation(); // Предотвращаем всплытие события
            this.isPanning = true;
            this.startX = e.clientX;
            this.startY = e.clientY;
            this.lastX = this.panX;
            this.lastY = this.panY;
            this.container.style.cursor = 'grabbing';
        }
    }
    
    /**
     * Обработчик движения мыши
     */
    handleMouseMove(e) {
        if (this.isPanning) {
            e.preventDefault();
            
            // Вычисляем перемещение в пикселях
            const dxPixels = e.clientX - this.startX;
            const dyPixels = e.clientY - this.startY;
            
            // Преобразуем перемещение в координаты SVG
            const rect = this.container.getBoundingClientRect();
            const viewBox = this.getViewBox();
            const dxSvg = (dxPixels / rect.width) * viewBox.width;
            const dySvg = (dyPixels / rect.height) * viewBox.height;
            
            // Обновляем позицию (при панорамировании двигаем viewBox в обратную сторону)
            this.panX = this.lastX - dxSvg;
            this.panY = this.lastY - dySvg;
            
            this.updateTransform();
        }
    }
    
    /**
     * Обработчик отпускания кнопки мыши
     */
    handleMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.container.style.cursor = this.isSpacePressed ? 'grab' : 'default';
        }
    }
    
    /**
     * Получает текущий viewBox
     */
    getViewBox() {
        const viewBoxAttr = this.svg.getAttribute('viewBox');
        if (!viewBoxAttr) {
            return { x: 0, y: 0, width: this.originalWidth, height: this.originalHeight };
        }
        const [x, y, width, height] = viewBoxAttr.split(' ').map(Number);
        return { x, y, width, height };
    }

    /** Use stable logical artboard bounds when guides extend beyond the page. */
    getContentBounds() {
        if (this.svg.dataset?.fitArtboard === 'true') {
            return { x: 0, y: 0, width: this.originalWidth, height: this.originalHeight };
        }
        return this.svg.getBBox();
    }
    
    /**
     * Применяет текущую трансформацию через viewBox (векторное масштабирование).
     * viewBox всегда соответствует пропорциям контейнера, а не контента.
     */
    updateTransform() {
        const rect = this.container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const width = rect.width / this.zoom;
        const height = rect.height / this.zoom;

        this.svg.setAttribute('viewBox', `${this.panX} ${this.panY} ${width} ${height}`);
    }
    
    /**
     * Zoom in (увеличение)
     */
    zoomIn() {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        this.zoomTo(this.zoom * 1.2, centerX, centerY);
    }
    
    /**
     * Zoom out (уменьшение)
     */
    zoomOut() {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        this.zoomTo(this.zoom / 1.2, centerX, centerY);
    }
    
    /**
     * Сброс зума к текущему baseline (100% = baseZoom)
     */
    resetZoom() {
        this.zoom = this.baseZoom || 1;
        this.centerContent();
        this.notifyZoomChange();
    }

    /**
     * Центрирует содержимое SVG в контейнере без изменения зума.
     */
    centerContent() {
        const bbox = this.getContentBounds();
        const rect = this.container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const vbW = rect.width / this.zoom;
        const vbH = rect.height / this.zoom;

        this.panX = bbox.x + bbox.width / 2 - vbW / 2;
        this.panY = bbox.y + bbox.height / 2 - vbH / 2;

        this.updateTransform();
    }
    
    /**
     * Fit to screen — вписывает содержимое SVG в слот canvas-container с отступами.
     * Результирующий зум становится baseline и считается за 100%.
     */
    fitToScreen() {
        const bbox = this.getContentBounds();
        const containerRect = this.container.getBoundingClientRect();
        if (containerRect.width === 0 || containerRect.height === 0) return;

        const { top, right, bottom, left } = this.fitPadding;
        const availableWidth = Math.max(1, containerRect.width - left - right);
        const availableHeight = Math.max(1, containerRect.height - top - bottom);

        const safeWidth = Math.max(1, bbox.width);
        const safeHeight = Math.max(1, bbox.height);
        const scaleX = availableWidth / safeWidth;
        const scaleY = availableHeight / safeHeight;
        const scale = Math.min(scaleX, scaleY);

        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, scale));
        this.baseZoom = this.zoom;

        const vbW = containerRect.width / this.zoom;
        const vbH = containerRect.height / this.zoom;

        this.panX = bbox.x + bbox.width / 2 - vbW / 2;
        this.panY = bbox.y + bbox.height / 2 - vbH / 2;

        this.updateTransform();
        this.notifyZoomChange();
    }
    
    /**
     * Получить текущий уровень зума в процентах (относительно baseZoom)
     */
    getZoomPercent() {
        const base = this.baseZoom || 1;
        return Math.round((this.zoom / base) * 100);
    }
    
    /**
     * Уведомляет об изменении зума (для обновления UI)
     */
    notifyZoomChange() {
        const event = new CustomEvent('zoomchange', { 
            detail: { 
                zoom: this.zoom, 
                percent: this.getZoomPercent() 
            } 
        });
        this.container.dispatchEvent(event);
    }
    
    /**
     * Переинициализирует размеры SVG после изменения содержимого
     * Вызывается после updateGrid() для обновления originalWidth/Height
     */
    reinitializeSVGDimensions() {
        try {
            // Получаем размеры из атрибутов SVG
            const width = parseFloat(this.svg.getAttribute('width')) || this.originalWidth;
            const height = parseFloat(this.svg.getAttribute('height')) || this.originalHeight;
            
            if (width > 0 && height > 0) {
                this.originalWidth = width;
                this.originalHeight = height;
            }
        } catch (e) {
            console.warn('Could not reinitialize SVG dimensions', e);
        }
    }
    
    /**
     * Очистка обработчиков
     */
    destroy() {
        if (!this.interactive) return;
        this.container.removeEventListener('wheel', this._onWheel);
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        this.container.removeEventListener('mousedown', this._onMouseDown);
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup', this._onMouseUp);
        this.container.removeEventListener('contextmenu', this._onContextMenu);
    }
}
