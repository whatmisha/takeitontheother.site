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
            
            // Определяем направление зума
            const delta = -Math.sign(e.deltaY);
            const zoomFactor = 1 + (delta * this.zoomStep);
            
            // Применяем новый зум с ограничениями
            const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));
            
            if (newZoom !== this.zoom) {
                const oldZoom = this.zoom;
                
                // Получаем позицию курсора относительно canvas container
                const rect = this.canvasContainer.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                // Получаем текущую позицию скролла
                const scrollLeft = this.canvasContainer.scrollLeft;
                const scrollTop = this.canvasContainer.scrollTop;
                
                this.zoom = newZoom;
                
                // Обновляем трансформацию
                this.updateTransform();
                this.updateZoomIndicator();
                
                // При зуме > 100% вычисляем позицию скролла
                if (this.zoom > 1.0) {
                    requestAnimationFrame(() => {
                        const svg = this.canvasInner.querySelector('#gridSvg');
                        if (!svg) return;
                        
                        const svgWidth = parseFloat(svg.getAttribute('width') || 0);
                        const svgHeight = parseFloat(svg.getAttribute('height') || 0);
                        
                        if (oldZoom === 1.0) {
                            // Первый зум от 100%: центрируем контент
                            const viewportWidth = this.canvasContainer.clientWidth;
                            const viewportHeight = this.canvasContainer.clientHeight;
                            
                            // Padding в пикселях
                            const paddingX = window.innerWidth * 0.5;
                            const paddingY = window.innerHeight * 0.5;
                            
                            // При transform-origin: center, canvasInner центрируется внутри padding
                            // Размеры с учетом zoom
                            const scaledWidth = svgWidth * this.zoom;
                            const scaledHeight = svgHeight * this.zoom;
                            
                            // Scroll для центрирования
                            this.canvasContainer.scrollLeft = paddingX + (scaledWidth - viewportWidth) / 2;
                            this.canvasContainer.scrollTop = paddingY + (scaledHeight - viewportHeight) / 2;
                        } else {
                            // Зум к курсору при transform-origin: center center
                            // При центральном origin нужна другая математика
                            const paddingX = window.innerWidth * 0.5;
                            const paddingY = window.innerHeight * 0.5;
                            
                            // Центр canvasInner в координатах scrollable area
                            const innerCenterX = paddingX + svgWidth * oldZoom / 2;
                            const innerCenterY = paddingY + svgHeight * oldZoom / 2;
                            
                            // Позиция курсора относительно центра (в координатах до зума)
                            const offsetX = (scrollLeft + mouseX - innerCenterX) / oldZoom;
                            const offsetY = (scrollTop + mouseY - innerCenterY) / oldZoom;
                            
                            // Новые размеры
                            const newInnerCenterX = paddingX + svgWidth * this.zoom / 2;
                            const newInnerCenterY = paddingY + svgHeight * this.zoom / 2;
                            
                            // Новый scroll чтобы курсор остался на той же точке
                            this.canvasContainer.scrollLeft = newInnerCenterX + offsetX * this.zoom - mouseX;
                            this.canvasContainer.scrollTop = newInnerCenterY + offsetY * this.zoom - mouseY;
                        }
                    });
                }
            }
        } else {
            // Pan mode (обычный скролл)
            // Браузер обрабатывает скролл автоматически
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

