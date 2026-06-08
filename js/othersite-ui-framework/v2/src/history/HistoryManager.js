/**
 * HistoryManager - Управление историей изменений для undo/redo
 * 
 * Использует snapshot-based подход: сохраняет полные снэпшоты состояния.
 * Поддерживает транзакции для группировки действий (например, drag операций).
 * 
 * @example
 * const history = new HistoryManager({ maxSize: 50 });
 * 
 * // Простое действие
 * history.beginAction('toggle columns');
 * state.showColumns = !state.showColumns;
 * history.commitAction(state);
 * 
 * // Транзакция (drag)
 * history.beginAction('drag text block');
 * // ... изменения состояния во время drag ...
 * history.commitAction(state);
 * 
 * // Undo
 * const previousState = history.undo();
 * if (previousState) {
 *   applyState(previousState);
 * }
 */
export class HistoryManager {
    /**
     * @param {Object} options - Параметры конфигурации
     * @param {number} options.maxSize - Максимальный размер истории (по умолчанию 50)
     * @param {Function} options.stateSerializer - Функция для сериализации состояния (по умолчанию JSON.parse(JSON.stringify))
     * @param {Function} options.stateComparator - Функция для сравнения состояний (по умолчанию JSON.stringify сравнение)
     */
    constructor(options = {}) {
        this.maxSize = options.maxSize || 50;
        this.stateSerializer = options.stateSerializer || this._defaultSerializer;
        this.stateComparator = options.stateComparator || this._defaultComparator;
        
        // История: массив снэпшотов состояния
        this.history = [];
        
        // Текущий индекс в истории (указывает на последнее сохраненное состояние)
        this.historyIndex = -1;
        
        // Текущая транзакция (если есть)
        this.currentTransaction = null;
        
        // Флаг для предотвращения сохранения во время восстановления состояния
        this.isRestoring = false;
    }
    
    /**
     * Сериализация состояния по умолчанию (глубокое копирование через JSON)
     * @private
     */
    _defaultSerializer(state) {
        return JSON.parse(JSON.stringify(state));
    }
    
    /**
     * Сравнение состояний по умолчанию (через JSON.stringify)
     * @private
     */
    _defaultComparator(state1, state2) {
        return JSON.stringify(state1) === JSON.stringify(state2);
    }
    
    /**
     * Начать транзакцию (группировку действий)
     * Сохраняет снэпшот "до" изменений
     * 
     * @param {string} label - Метка действия для отладки (опционально)
     * @param {Object} currentState - Текущее состояние (для сохранения "до")
     */
    beginAction(label = '', currentState = null) {
        if (this.isRestoring) {
            return; // Не начинаем транзакцию во время восстановления
        }
        
        // Если уже есть незавершенная транзакция, отменяем её
        if (this.currentTransaction) {
            this.cancelAction();
        }
        
        // Сохраняем состояние "до" изменений
        const beforeState = currentState ? this.stateSerializer(currentState) : null;
        
        this.currentTransaction = {
            label,
            beforeState,
            startIndex: this.historyIndex
        };
    }
    
    /**
     * Завершить транзакцию и сохранить состояние "после"
     * Сравнивает состояние "до" и "после", и если они отличаются - пушит в историю
     * 
     * @param {Object} afterState - Состояние после изменений
     * @returns {boolean} - true если состояние было сохранено, false если не изменилось
     */
    commitAction(afterState) {
        if (this.isRestoring) {
            return false; // Не сохраняем во время восстановления
        }
        
        if (!this.currentTransaction) {
            // Нет активной транзакции - просто сохраняем состояние
            return this.saveSnapshot(afterState);
        }
        
        const { beforeState, label } = this.currentTransaction;
        
        // Сериализуем состояние "после"
        const serializedAfter = this.stateSerializer(afterState);
        
        // Если есть состояние "до", сравниваем
        if (beforeState) {
            if (this.stateComparator(beforeState, serializedAfter)) {
                // Состояние не изменилось - отменяем транзакцию
                this.currentTransaction = null;
                return false;
            }
        }
        
        // Состояние изменилось - сохраняем
        
        // Удаляем все состояния после текущего индекса (при undo и новом действии)
        // Если история пуста (historyIndex = -1), slice(0, 0) → [] — это нормально,
        // мы просто добавим afterState как первый элемент.
        const safeIndex = Math.max(0, this.historyIndex);
        if (this.history.length > 0) {
            this.history = this.history.slice(0, safeIndex + 1);
        }
        
        // Добавляем новое состояние
        this.history.push({
            state: serializedAfter,
            label: label || 'action',
            timestamp: Date.now()
        });
        
        this.historyIndex = this.history.length - 1;
        
        // Ограничиваем размер истории
        if (this.history.length > this.maxSize) {
            this.history.shift();
            this.historyIndex--;
        }
        
        console.log(`[HISTORY] commitAction "${label}": historyIndex=${this.historyIndex}, historyLength=${this.history.length}`);
        
        // Завершаем транзакцию
        this.currentTransaction = null;
        
        return true;
    }
    
    /**
     * Отменить текущую транзакцию (не сохранять изменения)
     */
    cancelAction() {
        this.currentTransaction = null;
    }
    
    /**
     * Сохранить снэпшот состояния (без транзакции)
     * Используется для простых мгновенных действий
     * 
     * @param {Object} state - Состояние для сохранения
     * @param {string} label - Метка действия (опционально)
     * @returns {boolean} - true если состояние было сохранено
     */
    saveSnapshot(state, label = '') {
        if (this.isRestoring) {
            return false;
        }
        
        // Отменяем активную транзакцию, если есть
        if (this.currentTransaction) {
            this.cancelAction();
        }
        
        const serializedState = this.stateSerializer(state);
        
        // Проверяем, отличается ли от последнего сохраненного состояния
        if (this.history.length > 0 && this.historyIndex >= 0 && this.historyIndex < this.history.length) {
            const lastState = this.history[this.historyIndex].state;
            if (this.stateComparator(lastState, serializedState)) {
                // Состояние не изменилось
                return false;
            }
        }
        
        // Если история пуста, просто добавляем состояние
        if (this.history.length === 0) {
            this.history.push({
                state: serializedState,
                label: label || 'snapshot',
                timestamp: Date.now()
            });
            this.historyIndex = 0;
            return true;
        }
        
        // Удаляем все состояния после текущего индекса
        const safeIndex = Math.max(0, Math.min(this.historyIndex, this.history.length - 1));
        this.history = this.history.slice(0, safeIndex + 1);
        
        // Добавляем новое состояние
        this.history.push({
            state: serializedState,
            label: label || 'snapshot',
            timestamp: Date.now()
        });
        
        this.historyIndex = this.history.length - 1;
        
        // Ограничиваем размер истории
        if (this.history.length > this.maxSize) {
            this.history.shift();
            this.historyIndex--;
        }
        
        return true;
    }
    
    /**
     * Отменить последнее действие
     * @returns {Object|null} - Предыдущее состояние или null, если нет что отменять
     */
    undo() {
        if (!this.canUndo()) {
            console.log(`[HISTORY] undo: BLOCKED (canUndo=false, historyIndex=${this.historyIndex}, historyLength=${this.history.length})`);
            return null;
        }
        
        // Отменяем активную транзакцию, если есть
        if (this.currentTransaction) {
            this.cancelAction();
        }
        
        this.historyIndex--;
        
        // historyIndex никогда не должен быть меньше 0
        // Минимальное значение - 0 (первое состояние в истории)
        if (this.historyIndex < 0) {
            this.historyIndex = 0;
        }
        
        const label = this.history[this.historyIndex] ? this.history[this.historyIndex].label : '???';
        console.log(`[HISTORY] undo: → historyIndex=${this.historyIndex}, label="${label}", historyLength=${this.history.length}`);
        
        return this.history[this.historyIndex].state;
    }
    
    /**
     * Повторить отмененное действие
     * @returns {Object|null} - Следующее состояние или null, если нет что повторять
     */
    redo() {
        if (!this.canRedo()) {
            console.log(`[HISTORY] redo: BLOCKED (canRedo=false, historyIndex=${this.historyIndex}, historyLength=${this.history.length})`);
            return null;
        }
        
        // Отменяем активную транзакцию, если есть
        if (this.currentTransaction) {
            this.cancelAction();
        }
        
        this.historyIndex++;
        
        if (this.historyIndex >= this.history.length) {
            this.historyIndex = this.history.length - 1;
            return null;
        }
        
        const label = this.history[this.historyIndex] ? this.history[this.historyIndex].label : '???';
        console.log(`[HISTORY] redo: → historyIndex=${this.historyIndex}, label="${label}", historyLength=${this.history.length}`);
        
        return this.history[this.historyIndex].state;
    }
    
    /**
     * Можно ли отменить действие
     * @returns {boolean}
     */
    canUndo() {
        // Можно отменить только если есть история и мы не на первом состоянии
        return this.history.length > 0 && this.historyIndex > 0;
    }
    
    /**
     * Можно ли повторить действие
     * @returns {boolean}
     */
    canRedo() {
        return this.history.length > 0 && this.historyIndex < this.history.length - 1;
    }
    
    /**
     * Получить текущее состояние из истории
     * @returns {Object|null}
     */
    getCurrentState() {
        if (this.history.length === 0) {
            return null;
        }
        // Убеждаемся, что historyIndex в допустимых пределах
        const safeIndex = Math.max(0, Math.min(this.historyIndex, this.history.length - 1));
        return this.history[safeIndex].state;
    }
    
    /**
     * Очистить историю
     */
    clear() {
        this.history = [];
        this.historyIndex = -1;
        this.currentTransaction = null;
    }
    
    /**
     * Установить флаг восстановления (для предотвращения сохранения во время undo/redo)
     * @param {boolean} value
     */
    setRestoring(value) {
        this.isRestoring = value;
    }
    
    /**
     * Получить информацию о текущем состоянии истории (для отладки)
     * @returns {Object}
     */
    getHistoryInfo() {
        return {
            size: this.history.length,
            index: this.historyIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            hasTransaction: !!this.currentTransaction,
            transactionLabel: this.currentTransaction?.label || null
        };
    }
}
