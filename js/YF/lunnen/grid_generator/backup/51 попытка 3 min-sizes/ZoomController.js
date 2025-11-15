/**
 * ZoomController - управление масштабированием и панорамированием canvas
 * 
 * Функционал:
 * - Zoom при Cmd/Ctrl + scroll (приближение к курсору как в Figma)
 * - Панорамирование при обычном скролле
 * - Отображение процента зума
 * - Сброс зума при клике на индикатор
 */

export class ZoomController {
    constructor(canvasContainer, canvasInner, zoomIndicator) {
        this.canvasContainer = canvasContainer;
        this.canvasInner = canvasInner;
        this.zoomIndicator = zoomIndicator;
        
        // Zoom state
        this.zoom = 1.0;
        this.minZoom = 1.0; // Не позволяем зумить меньше 100%
        this.maxZoom = 10.0;
        this.zoomStep = 0.05; // Замедлили зум в 2 раза
        
        // Pan state
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.lastPanX = 0;
        this.lastPanY = 0;
        
        this.initEventListeners();
        this.updateTransform();
        this.updateZoomIndicator();
    }
    
    initEventListeners() {
        // Wheel event для зума и панорамирования
        this.canvasContainer.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        
        // Клик на индикатор зума для сброса
        this.zoomIndicator.addEventListener('click', () => this.resetZoom());
        
        // Панорамирование с помощью мыши (опционально)
        // Это для драга мышью, если нужно
        // this.canvasContainer.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        // this.canvasContainer.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        // this.canvasContainer.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        // this.canvasContainer.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
    }
    
    handleWheel(e) {
        // Проверяем нажатие Cmd (Mac) или Ctrl (Windows/Linux)
        const isZoomModifier = e.metaKey || e.ctrlKey;
        
        if (isZoomModifier) {
            // Zoom mode
            e.preventDefault();
            
            // Получаем позицию курсора относительно canvas container
            const rect = this.canvasContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Получаем текущую позицию скролла
            const scrollLeft = this.canvasContainer.scrollLeft;
            const scrollTop = this.canvasContainer.scrollTop;
            
            // Вычисляем позицию курсора в координатах canvas (до зума)
            const canvasX = (mouseX + scrollLeft) / this.zoom;
            const canvasY = (mouseY + scrollTop) / this.zoom;
            
            // Определяем направление зума (более плавный множитель)
            const delta = -Math.sign(e.deltaY);
            const zoomFactor = 1 + (delta * this.zoomStep);
            
            // Применяем новый зум с ограничениями
            const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));
            
            if (newZoom !== this.zoom) {
                const oldZoom = this.zoom;
                this.zoom = newZoom;
                
                // Обновляем трансформацию
                this.updateTransform();
                this.updateZoomIndicator();
                
                // При зуме > 100% вычисляем позицию скролла для зума к курсору
                if (this.zoom > 1.0) {
                    // Используем requestAnimationFrame для корректного рендеринга
                    requestAnimationFrame(() => {
                        // Если переходим от 100% к зуму, нужно учесть padding
                        if (oldZoom === 1.0) {
                            // Первый зум: центрируем контент и затем применяем зум к курсору
                            const rect = this.canvasContainer.getBoundingClientRect();
                            const svg = this.canvasInner.querySelector('#gridSvg');
                            if (svg) {
                                const svgRect = svg.getBoundingClientRect();
                                
                                // Центрируем с учетом padding
                                const centerX = rect.width / 2;
                                const centerY = rect.height / 2;
                                
                                this.canvasContainer.scrollLeft = centerX;
                                this.canvasContainer.scrollTop = centerY;
                            }
                        } else {
                            // Обычный зум: зум к курсору
                            const newScrollLeft = canvasX * this.zoom - mouseX;
                            const newScrollTop = canvasY * this.zoom - mouseY;
                            
                            this.canvasContainer.scrollLeft = newScrollLeft;
                            this.canvasContainer.scrollTop = newScrollTop;
                        }
                    });
                }
                // При 100% ничего не делаем - flexbox сам центрирует
            }
        } else {
            // Pan mode (обычный скролл)
            // Браузер обрабатывает скролл автоматически для Apple Magic Mouse
            // Дефолтное поведение уже обеспечивает плавный скролл
        }
    }
    
    updateTransform() {
        this.canvasInner.style.transform = `scale(${this.zoom})`;
        
        // Переключаем режим отображения в зависимости от зума
        if (this.zoom === 1.0) {
            // При 100% - flexbox центрирование
            this.canvasContainer.removeAttribute('data-zoomed');
            // Сбрасываем min-размеры
            this.canvasInner.style.minWidth = '';
            this.canvasInner.style.minHeight = '';
        } else {
            // При зуме > 100% - добавляем padding для доступа ко всем краям
            this.canvasContainer.setAttribute('data-zoomed', 'true');
            
            // КРИТИЧНО: Устанавливаем min-размеры для canvasInner
            // чтобы браузер понимал реальный размер увеличенного контента
            const svg = this.canvasInner.querySelector('#gridSvg');
            if (svg) {
                const svgWidth = parseFloat(svg.getAttribute('width') || 0);
                const svgHeight = parseFloat(svg.getAttribute('height') || 0);
                
                // Устанавливаем реальный размер с учетом zoom
                this.canvasInner.style.minWidth = `${svgWidth * this.zoom}px`;
                this.canvasInner.style.minHeight = `${svgHeight * this.zoom}px`;
            }
        }
    }
    
    updateZoomIndicator() {
        const percentage = Math.round(this.zoom * 100);
        this.zoomIndicator.textContent = `${percentage}%`;
    }
    
    resetZoom() {
        this.zoom = 1.0;
        
        // Обновляем трансформацию и индикатор
        this.updateTransform();
        this.updateZoomIndicator();
        
        // При 100% flexbox автоматически центрирует, ничего не делаем
    }
    
    // Опциональные методы для панорамирования мышью
    handleMouseDown(e) {
        // Если это средняя кнопка мыши или пробел зажат
        if (e.button === 1 || (e.button === 0 && e.spaceKey)) {
            this.isPanning = true;
            this.lastPanX = e.clientX;
            this.lastPanY = e.clientY;
            e.preventDefault();
        }
    }
    
    handleMouseMove(e) {
        if (this.isPanning) {
            const deltaX = e.clientX - this.lastPanX;
            const deltaY = e.clientY - this.lastPanY;
            
            this.canvasContainer.scrollLeft -= deltaX;
            this.canvasContainer.scrollTop -= deltaY;
            
            this.lastPanX = e.clientX;
            this.lastPanY = e.clientY;
            e.preventDefault();
        }
    }
    
    handleMouseUp(e) {
        this.isPanning = false;
    }
    
    // Публичные методы для управления зумом из кода
    setZoom(zoom) {
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
        this.updateTransform();
        this.updateZoomIndicator();
    }
    
    getZoom() {
        return this.zoom;
    }
    
    // Статический метод для получения текущего зума из любого места
    static getCurrentZoom() {
        // Ищем экземпляр ZoomController через DOM
        const zoomIndicator = document.getElementById('zoomIndicator');
        if (zoomIndicator && zoomIndicator.textContent) {
            const percentage = parseInt(zoomIndicator.textContent);
            return percentage / 100;
        }
        return 1.0; // По умолчанию 100%
    }
}

