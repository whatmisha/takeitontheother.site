/**
 * ElementsNavigator - Навигатор по объектам (текст и графика)
 * Список элементов, управление видимостью, удаление
 */
import { DOMUtils } from '../utils/DOMUtils.js';

export class ElementsNavigator {
    constructor(textBlockManager, graphicsManager, callbacks = {}) {
        this.textBlockManager = textBlockManager;
        this.graphicsManager = graphicsManager;
        this.callbacks = callbacks; // { onSelect, onDelete, onToggleVisibility, onUpdate }
        
        this.containerElement = null;
    }

    /**
     * Инициализация навигатора
     */
    init(containerId) {
        this.containerElement = document.getElementById(containerId);
        if (!this.containerElement) {
            console.warn(`Elements navigator container not found: ${containerId}`);
            return;
        }

        this.render();
    }

    /**
     * Отрисовка всего списка элементов
     */
    render(container) {
        // Если передан контейнер, используем его (иначе используем сохраненный)
        const targetContainer = container || this.containerElement;
        if (!targetContainer) return;
        
        // Сохраняем ссылку на контейнер для будущих вызовов
        if (container) {
            this.containerElement = container;
        }

        // Очищаем контейнер
        targetContainer.innerHTML = '';

        // Получаем все элементы
        const textBlocks = this.textBlockManager.getAllBlocks();
        const graphicsBlocks = this.graphicsManager.getAllBlocks();

        // Рендерим графические элементы
        graphicsBlocks.forEach(block => {
            const item = this.createElementItem('graphics', block);
            targetContainer.appendChild(item);
        });

        // Рендерим текстовые элементы
        textBlocks.forEach(block => {
            const item = this.createElementItem('text', block);
            targetContainer.appendChild(item);
        });

        // Если нет элементов - показываем заглушку
        if (textBlocks.length === 0 && graphicsBlocks.length === 0) {
            this.showEmptyState();
        }
    }

    /**
     * Создание элемента списка
     */
    createElementItem(type, block) {
        const item = document.createElement('div');
        item.className = 'element-item';
        item.dataset.elementId = block.id;
        item.dataset.elementType = type;

        // Иконка типа
        const icon = document.createElement('span');
        icon.className = 'element-icon';
        icon.textContent = type === 'text' ? 'T' : 'G';
        item.appendChild(icon);

        // Название элемента
        const name = document.createElement('span');
        name.className = 'element-name';
        name.textContent = this.getElementName(type, block);
        item.appendChild(name);

        // Кнопка видимости
        const visibilityBtn = document.createElement('button');
        visibilityBtn.className = 'element-visibility-btn';
        visibilityBtn.type = 'button';
        visibilityBtn.innerHTML = block.visible ? '👁' : '👁‍🗨';
        visibilityBtn.title = block.visible ? 'Hide' : 'Show';
        visibilityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleVisibility(type, block.id);
        });
        item.appendChild(visibilityBtn);

        // Кнопка удаления (только для пользовательских элементов)
        if (type === 'text' || (type === 'graphics' && block.type === 'custom')) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'element-delete-btn';
            deleteBtn.type = 'button';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = 'Delete';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteElement(type, block.id);
            });
            item.appendChild(deleteBtn);
        }

        // Клик по элементу - выделение
        item.addEventListener('click', () => {
            this.selectElement(type, block.id);
        });

        // Добавляем класс если элемент не видим
        if (!block.visible) {
            item.classList.add('hidden-element');
        }

        return item;
    }

    /**
     * Получение имени элемента для отображения
     */
    getElementName(type, block) {
        if (type === 'text') {
            // Первые 30 символов текста
            const preview = block.content.substring(0, 30);
            return preview + (block.content.length > 30 ? '...' : '');
        } else if (type === 'graphics') {
            return block.name || 'Graphic';
        }
        return 'Unknown';
    }

    /**
     * Выделение элемента
     */
    selectElement(type, blockId) {
        // Снимаем выделение со всех элементов
        const items = this.containerElement.querySelectorAll('.element-item');
        items.forEach(item => item.classList.remove('active'));

        // Выделяем нужный элемент
        const item = this.containerElement.querySelector(
            `[data-element-id="${blockId}"]`
        );
        if (item) {
            item.classList.add('active');
        }

        // Вызываем коллбэк
        if (this.callbacks.onSelect) {
            this.callbacks.onSelect(type, blockId);
        }
    }

    /**
     * Переключение видимости элемента
     */
    toggleVisibility(type, blockId) {
        let success = false;

        if (type === 'text') {
            success = this.textBlockManager.toggleVisible(blockId);
        } else if (type === 'graphics') {
            success = this.graphicsManager.toggleVisible(blockId);
        }

        if (success) {
            // Обновляем UI элемента
            const item = this.containerElement.querySelector(
                `[data-element-id="${blockId}"]`
            );
            if (item) {
                const block = type === 'text' ? 
                    this.textBlockManager.getBlock(blockId) :
                    this.graphicsManager.getBlock(blockId);
                
                const visibilityBtn = item.querySelector('.element-visibility-btn');
                if (visibilityBtn) {
                    visibilityBtn.innerHTML = block.visible ? '👁' : '👁‍🗨';
                    visibilityBtn.title = block.visible ? 'Hide' : 'Show';
                }

                if (block.visible) {
                    item.classList.remove('hidden-element');
                } else {
                    item.classList.add('hidden-element');
                }
            }

            // Вызываем коллбэк
            if (this.callbacks.onToggleVisibility) {
                this.callbacks.onToggleVisibility(type, blockId);
            }

            // Обновление сетки
            if (this.callbacks.onUpdate) {
                this.callbacks.onUpdate();
            }
        }
    }

    /**
     * Удаление элемента
     */
    deleteElement(type, blockId) {
        // Подтверждение удаления
        if (!confirm('Delete this element?')) {
            return;
        }

        let success = false;

        if (type === 'text') {
            success = this.textBlockManager.deleteBlock(blockId);
        } else if (type === 'graphics') {
            success = this.graphicsManager.deleteBlock(blockId);
        }

        if (success) {
            // Удаляем из UI с анимацией
            const item = this.containerElement.querySelector(
                `[data-element-id="${blockId}"]`
            );
            if (item) {
                item.style.transition = 'opacity 0.2s, transform 0.2s';
                item.style.opacity = '0';
                item.style.transform = 'translateX(-20px)';
                
                setTimeout(() => {
                    item.remove();
                    
                    // Проверяем пустое состояние
                    if (this.containerElement.children.length === 0) {
                        this.showEmptyState();
                    }
                }, 200);
            }

            // Вызываем коллбэк
            if (this.callbacks.onDelete) {
                this.callbacks.onDelete(type, blockId);
            }

            // Обновление сетки
            if (this.callbacks.onUpdate) {
                this.callbacks.onUpdate();
            }
        }
    }

    /**
     * Показать пустое состояние
     */
    showEmptyState() {
        if (!this.containerElement) return;

        const emptyState = document.createElement('div');
        emptyState.className = 'elements-empty-state';
        emptyState.innerHTML = '<p>No objects yet</p><p>Add text or graphics to get started</p>';
        
        this.containerElement.appendChild(emptyState);
    }

    /**
     * Обновление одного элемента в списке
     */
    updateElement(type, blockId) {
        const item = this.containerElement.querySelector(
            `[data-element-id="${blockId}"]`
        );
        
        if (!item) return;

        // Получаем обновленные данные
        const block = type === 'text' ? 
            this.textBlockManager.getBlock(blockId) :
            this.graphicsManager.getBlock(blockId);

        if (!block) return;

        // Обновляем название
        const nameElement = item.querySelector('.element-name');
        if (nameElement) {
            nameElement.textContent = this.getElementName(type, block);
        }

        // Обновляем видимость
        const visibilityBtn = item.querySelector('.element-visibility-btn');
        if (visibilityBtn) {
            visibilityBtn.innerHTML = block.visible ? '👁' : '👁‍🗨';
            visibilityBtn.title = block.visible ? 'Hide' : 'Show';
        }

        if (block.visible) {
            item.classList.remove('hidden-element');
        } else {
            item.classList.add('hidden-element');
        }
    }

    /**
     * Снятие выделения со всех элементов
     */
    deselectAll() {
        const items = this.containerElement.querySelectorAll('.element-item');
        items.forEach(item => item.classList.remove('active'));
    }

    /**
     * Получение количества элементов
     */
    getCount() {
        const textCount = this.textBlockManager.getCount();
        const graphicsCount = this.graphicsManager.getCount();
        return textCount + graphicsCount;
    }

    /**
     * Полное обновление навигатора
     */
    update() {
        this.render();
    }

    /**
     * Очистка навигатора
     */
    clear() {
        if (this.containerElement) {
            this.containerElement.innerHTML = '';
            this.showEmptyState();
        }
    }

    /**
     * Фильтрация элементов по типу
     */
    filterByType(type) {
        if (!this.containerElement) return;

        const items = this.containerElement.querySelectorAll('.element-item');
        
        items.forEach(item => {
            if (type === 'all') {
                item.style.display = '';
            } else {
                const itemType = item.dataset.elementType;
                item.style.display = itemType === type ? '' : 'none';
            }
        });
    }

    /**
     * Сортировка элементов
     */
    sort(sortBy = 'order') {
        // Можно добавить различные варианты сортировки
        // Пока просто перерисовываем
        this.render();
    }
}

