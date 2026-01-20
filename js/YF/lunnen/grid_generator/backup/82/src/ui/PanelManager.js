/**
 * PanelManager - Управление панелями (открытие, закрытие, перетаскивание, z-index)
 */
export class PanelManager {
    constructor() {
        this.panels = new Map();
        this.highestZIndex = 1000;
        this.dragState = {
            isDragging: false,
            panel: null,
            startX: 0,
            startY: 0,
            initialX: 0,
            initialY: 0
        };
    }

    /**
     * Регистрация панели
     */
    registerPanel(panelId, config = {}) {
        const panel = document.getElementById(panelId);
        const header = document.getElementById(config.headerId);
        
        if (!panel) {
            console.warn(`Panel not found: ${panelId}`);
            return;
        }

        const panelData = {
            element: panel,
            header: header,
            config: {
                draggable: config.draggable !== false,
                initialPosition: config.initialPosition || null,
                onOpen: config.onOpen || null,
                onClose: config.onClose || null,
                persistent: config.persistent || false // Не закрывается при клике вне
            },
            isOpen: !panel.style.display || panel.style.display !== 'none',
            position: { x: 0, y: 0 }
        };

        this.panels.set(panelId, panelData);

        // Инициализация drag & drop если включено
        if (panelData.config.draggable && header) {
            this.initDragging(panelId);
        }

        // Установка начальной позиции если указана
        if (panelData.config.initialPosition) {
            this.setPosition(panelId, 
                panelData.config.initialPosition.x, 
                panelData.config.initialPosition.y
            );
        }

        // Клик по панели поднимает её наверх
        panel.addEventListener('mousedown', () => this.bringToFront(panelId));
    }

    /**
     * Инициализация перетаскивания панели
     */
    initDragging(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData || !panelData.header) return;

        const header = panelData.header;
        
        header.style.cursor = 'grab';
        
        header.addEventListener('mousedown', (e) => {
            // Проверяем, что клик не по кнопке закрытия
            if (e.target.closest('.collapse-toggle, .modal-close')) {
                return;
            }
            
            this.startDragging(panelId, e);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.dragState.isDragging && this.dragState.panel === panelId) {
                this.onDragging(e);
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.dragState.isDragging && this.dragState.panel === panelId) {
                this.stopDragging();
            }
        });
    }

    /**
     * Начало перетаскивания
     */
    startDragging(panelId, event) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        event.preventDefault();

        const panel = panelData.element;
        const rect = panel.getBoundingClientRect();

        this.dragState = {
            isDragging: true,
            panel: panelId,
            startX: event.clientX,
            startY: event.clientY,
            initialX: rect.left,
            initialY: rect.top
        };

        if (panelData.header) {
            panelData.header.style.cursor = 'grabbing';
        }
        
        panel.style.transition = 'none';
        this.bringToFront(panelId);
    }

    /**
     * Процесс перетаскивания
     */
    onDragging(event) {
        if (!this.dragState.isDragging) return;

        const panelData = this.panels.get(this.dragState.panel);
        if (!panelData) return;

        const deltaX = event.clientX - this.dragState.startX;
        const deltaY = event.clientY - this.dragState.startY;

        const newX = this.dragState.initialX + deltaX;
        const newY = this.dragState.initialY + deltaY;

        // Ограничение по границам окна
        const panel = panelData.element;
        const rect = panel.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        const constrainedX = Math.max(0, Math.min(newX, maxX));
        const constrainedY = Math.max(0, Math.min(newY, maxY));

        this.setPosition(this.dragState.panel, constrainedX, constrainedY);
    }

    /**
     * Завершение перетаскивания
     */
    stopDragging() {
        if (!this.dragState.isDragging) return;

        const panelData = this.panels.get(this.dragState.panel);
        if (panelData && panelData.header) {
            panelData.header.style.cursor = 'grab';
        }

        const panel = panelData?.element;
        if (panel) {
            panel.style.transition = '';
        }

        this.dragState = {
            isDragging: false,
            panel: null,
            startX: 0,
            startY: 0,
            initialX: 0,
            initialY: 0
        };
    }

    /**
     * Установка позиции панели
     */
    setPosition(panelId, x, y) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        const panel = panelData.element;
        panel.style.left = `${x}px`;
        panel.style.top = `${y}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';

        panelData.position = { x, y };
    }

    /**
     * Открытие панели
     */
    open(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        panelData.element.style.display = 'block';
        panelData.isOpen = true;
        
        this.bringToFront(panelId);

        if (panelData.config.onOpen) {
            panelData.config.onOpen();
        }
    }

    /**
     * Закрытие панели
     */
    close(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        panelData.element.style.display = 'none';
        panelData.isOpen = false;

        if (panelData.config.onClose) {
            panelData.config.onClose();
        }
    }

    /**
     * Переключение видимости панели
     */
    toggle(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        if (panelData.isOpen) {
            this.close(panelId);
        } else {
            this.open(panelId);
        }
    }

    /**
     * Поднятие панели на передний план
     */
    bringToFront(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        this.highestZIndex++;
        panelData.element.style.zIndex = this.highestZIndex;
    }

    /**
     * Проверка открыта ли панель
     */
    isOpen(panelId) {
        const panelData = this.panels.get(panelId);
        return panelData ? panelData.isOpen : false;
    }

    /**
     * Закрытие всех непостоянных панелей
     */
    closeAll(except = []) {
        this.panels.forEach((panelData, panelId) => {
            if (!except.includes(panelId) && !panelData.config.persistent && panelData.isOpen) {
                this.close(panelId);
            }
        });
    }

    /**
     * Сброс позиции панели к начальной
     */
    resetPosition(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        const panel = panelData.element;
        panel.style.left = '';
        panel.style.top = '';
        panel.style.right = '';
        panel.style.bottom = '';

        if (panelData.config.initialPosition) {
            this.setPosition(panelId, 
                panelData.config.initialPosition.x, 
                panelData.config.initialPosition.y
            );
        }
    }

    /**
     * Получение текущей позиции панели
     */
    getPosition(panelId) {
        const panelData = this.panels.get(panelId);
        return panelData ? { ...panelData.position } : null;
    }

    /**
     * Центрирование панели на экране
     */
    center(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        const panel = panelData.element;
        const rect = panel.getBoundingClientRect();
        
        const x = (window.innerWidth - rect.width) / 2;
        const y = (window.innerHeight - rect.height) / 2;

        this.setPosition(panelId, x, y);
    }
}

