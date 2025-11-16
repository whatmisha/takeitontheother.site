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
 */
export class ZoomPanManager {
    constructor(containerElement, svgElement) {
        this.container = containerElement;
        this.svg = svgElement;
        
        // Состояние трансформации
        this.zoom = 1;
        this.baseZoom = 1; // Базовый зум (fit to screen), считается за 100%
        this.minZoom = 1.0; // Минимальный зум 100% (не позволяем зумить меньше)
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
        this.initEventListeners();
    }
    
    /**
     * Инициализирует SVG для векторного зума через viewBox
     */
    initializeSVG() {
        // Ждем следующий фрейм, чтобы SVG был отрисован
        requestAnimationFrame(() => {
            try {
                // Получаем размеры из атрибутов SVG, если они установлены
                const width = parseFloat(this.svg.getAttribute('width')) || 0;
                const height = parseFloat(this.svg.getAttribute('height')) || 0;
                
                if (width > 0 && height > 0) {
                    // Используем размеры из атрибутов
                    this.originalWidth = width;
                    this.originalHeight = height;
                } else {
                    // Fallback: используем getBBox
                    const bbox = this.svg.getBBox();
                    this.originalWidth = bbox.width || 1000;
                    this.originalHeight = bbox.height || 1000;
                }
                
                // Устанавливаем начальный viewBox (полный размер, зум 100%)
                const viewBoxWidth = this.originalWidth / this.zoom;
                const viewBoxHeight = this.originalHeight / this.zoom;
                this.panX = 0;
                this.panY = 0;
                
                this.svg.setAttribute('viewBox', `${this.panX} ${this.panY} ${viewBoxWidth} ${viewBoxHeight}`);
            } catch (e) {
                // Fallback если getBBox не работает
                console.warn('Could not get SVG dimensions, using fallback');
                this.originalWidth = 1000;
                this.originalHeight = 1000;
                this.svg.setAttribute('viewBox', `0 0 ${this.originalWidth} ${this.originalHeight}`);
            }
        });
        
        // Убираем фиксированные размеры, чтобы SVG масштабировался
        this.svg.style.width = '100%';
        this.svg.style.height = '100%';
        
        // Улучшаем качество рендеринга для четкости векторной графики
        this.svg.style.shapeRendering = 'geometricPrecision';
        this.svg.style.textRendering = 'geometricPrecision';
        
        // Делаем container позиционированным для правильной работы
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';
        this.container.style.cursor = 'default';
    }
    
    /**
     * Инициализирует все обработчики событий
     */
    initEventListeners() {
        // Zoom: колесо мыши
        this.container.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        
        // Pan: клавиша пробел
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        // Pan: мышь
        this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Предотвращаем контекстное меню на средней кнопке
        this.container.addEventListener('contextmenu', (e) => {
            if (e.button === 1) {
                e.preventDefault();
            }
        });
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
        // Ограничиваем зум
        newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
        
        if (newZoom === this.zoom) return;
        
        // Получаем текущий viewBox
        const viewBox = this.getViewBox();
        
        // Преобразуем координаты мыши в координаты SVG
        const rect = this.container.getBoundingClientRect();
        const svgX = viewBox.x + (mouseX / rect.width) * viewBox.width;
        const svgY = viewBox.y + (mouseY / rect.height) * viewBox.height;
        
        // Вычисляем новые размеры viewBox
        const newWidth = this.originalWidth / newZoom;
        const newHeight = this.originalHeight / newZoom;
        
        // Вычисляем новую позицию viewBox для зума относительно курсора
        const newX = svgX - (mouseX / rect.width) * newWidth;
        const newY = svgY - (mouseY / rect.height) * newHeight;
        
        this.zoom = newZoom;
        this.panX = newX;
        this.panY = newY;
        
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
        
        // Zoom shortcuts
        // Cmd/Ctrl + 0: Fit to screen
        if ((e.metaKey || e.ctrlKey) && e.key === '0') {
            e.preventDefault();
            this.fitToScreen();
        }
        
        // Cmd/Ctrl + 1: Reset to 100%
        if ((e.metaKey || e.ctrlKey) && e.key === '1') {
            e.preventDefault();
            this.resetZoom();
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
    
    /**
     * Применяет текущую трансформацию через viewBox (векторное масштабирование)
     */
    updateTransform() {
        const width = this.originalWidth / this.zoom;
        const height = this.originalHeight / this.zoom;
        
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
     * Сброс зума в 100% (возврат к baseZoom) с центрированием и отступами
     */
    resetZoom() {
        // При зуме 100% (baseZoom = 1.0) центрируем макет с отступами
        this.zoom = 1.0;
        this.baseZoom = 1.0;
        
        // Получаем размеры содержимого SVG
        const bbox = this.svg.getBBox();
        
        // Вычисляем размеры viewBox для зума 100%
        const viewBoxWidth = this.originalWidth / this.zoom;
        const viewBoxHeight = this.originalHeight / this.zoom;
        
        // Центрируем содержимое
        this.panX = bbox.x - (viewBoxWidth - bbox.width) / 2;
        this.panY = bbox.y - (viewBoxHeight - bbox.height) / 2;
        
        this.updateTransform();
        this.notifyZoomChange();
    }
    
    /**
     * Fit to screen - масштабирует содержимое по размеру контейнера с фиксированными отступами
     * Минимальный зум ограничен 100%
     */
    fitToScreen() {
        // Получаем размеры содержимого SVG
        const bbox = this.svg.getBBox();
        const containerRect = this.container.getBoundingClientRect();
        
        // Фиксированные отступы в пикселях
        const paddingHorizontal = 360; // 360px слева и справа
        const paddingVertical = 120;   // 120px сверху и снизу
        
        // Вычисляем доступную область для размещения макета
        const availableWidth = Math.max(100, containerRect.width - paddingHorizontal * 2);
        const availableHeight = Math.max(100, containerRect.height - paddingVertical * 2);
        
        // Вычисляем необходимый зум
        const scaleX = availableWidth / bbox.width;
        const scaleY = availableHeight / bbox.height;
        const scale = Math.min(scaleX, scaleY);
        
        // Ограничиваем зум (минимум 100%, то есть 1.0)
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, scale));
        
        // Если зум получился меньше 1.0 (что теперь невозможно из-за minZoom),
        // или равен 1.0, то это будет базовый зум 100%
        if (this.zoom <= 1.0) {
            this.zoom = 1.0;
            this.baseZoom = 1.0;
        } else {
            // Сохраняем этот зум как базовый (будет считаться за 100%)
            this.baseZoom = this.zoom;
        }
        
        // Вычисляем размеры viewBox
        const viewBoxWidth = this.originalWidth / this.zoom;
        const viewBoxHeight = this.originalHeight / this.zoom;
        
        // Центрируем содержимое
        this.panX = bbox.x - (viewBoxWidth - bbox.width) / 2;
        this.panY = bbox.y - (viewBoxHeight - bbox.height) / 2;
        
        this.updateTransform();
        this.notifyZoomChange();
    }
    
    /**
     * Получить текущий уровень зума в процентах (относительно baseZoom)
     */
    getZoomPercent() {
        return Math.round((this.zoom / this.baseZoom) * 100);
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
        this.container.removeEventListener('wheel', this.handleWheel);
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        this.container.removeEventListener('mousedown', this.handleMouseDown);
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
    }
}

