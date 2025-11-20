/**
 * DataService - Сервис для работы с внешними данными
 * Загрузка данных из Google Sheets, кэширование, парсинг CSV
 */
export class DataService {
    constructor(settings) {
        this.settings = settings;
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 минут
        this.loadedData = null;
    }

    /**
     * Загрузка данных из Google Sheets
     * @param {string} url - URL Google Sheets
     * @returns {Promise<Array<Array<string>>>} - Массив строк данных
     */
    async loadFromGoogleSheets(url) {
        if (!url || !url.trim()) {
            throw new Error('URL таблицы не может быть пустым');
        }

        const csvUrl = this.convertSheetUrlToCsv(url);
        
        // Проверяем кэш
        const cached = this.getFromCache(csvUrl);
        if (cached) {
            console.log('📦 Данные загружены из кэша');
            return cached;
        }

        console.log('🌐 Загрузка данных из Google Sheets...', csvUrl);

        try {
            const response = await fetch(csvUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const csvText = await response.text();
            const rows = this.parseCsv(csvText);

            // Сохраняем в кэш
            this.saveToCache(csvUrl, rows);

            // Сохраняем загруженные данные
            this.loadedData = rows;

            console.log(`✅ Загружено строк: ${rows.length}`);
            return rows;

        } catch (error) {
            console.error('❌ Ошибка загрузки:', error);
            throw new Error(`Не удалось загрузить данные: ${error.message}. Убедитесь, что таблица опубликована для просмотра.`);
        }
    }

    /**
     * Конвертация URL Google Sheets в CSV формат
     * @param {string} url - URL Google Sheets
     * @returns {string} - CSV URL
     */
    convertSheetUrlToCsv(url) {
        try {
            // Извлекаем ID таблицы и GID листа
            const spreadsheetIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
            const gidMatch = url.match(/[#&]gid=([0-9]+)/);
            
            if (!spreadsheetIdMatch) {
                throw new Error('Неверный формат URL. Не найден ID таблицы.');
            }

            const spreadsheetId = spreadsheetIdMatch[1];
            const gid = gidMatch ? gidMatch[1] : '0';

            // Формируем URL для CSV экспорта
            return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
        } catch (error) {
            throw new Error(`Ошибка обработки URL: ${error.message}`);
        }
    }

    /**
     * Парсинг CSV текста в массив строк
     * @param {string} csvText - CSV текст
     * @returns {Array<Array<string>>} - Массив строк данных
     */
    parseCsv(csvText) {
        const rows = [];
        const lines = csvText.split(/\r?\n/);

        for (const line of lines) {
            if (!line.trim()) continue;

            const row = [];
            let currentCell = '';
            let insideQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];

                if (char === '"') {
                    if (insideQuotes && nextChar === '"') {
                        // Escaped quote
                        currentCell += '"';
                        i++; // Skip next quote
                    } else {
                        // Toggle quotes
                        insideQuotes = !insideQuotes;
                    }
                } else if (char === ',' && !insideQuotes) {
                    // End of cell
                    row.push(currentCell);
                    currentCell = '';
                } else {
                    currentCell += char;
                }
            }

            // Add last cell
            row.push(currentCell);
            rows.push(row);
        }

        return rows;
    }

    /**
     * Получение данных из кэша
     * @param {string} key - Ключ кэша
     * @returns {*|null} - Данные или null
     */
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const now = Date.now();
        if (now > cached.expires) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    /**
     * Сохранение данных в кэш
     * @param {string} key - Ключ кэша
     * @param {*} data - Данные
     */
    saveToCache(key, data) {
        this.cache.set(key, {
            data: data,
            expires: Date.now() + this.cacheTTL
        });
    }

    /**
     * Очистка кэша
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Кэш очищен');
    }

    /**
     * Получение последних загруженных данных
     * @returns {Array<Array<string>>|null}
     */
    getLoadedData() {
        return this.loadedData;
    }

    /**
     * Проверка наличия загруженных данных
     * @returns {boolean}
     */
    hasLoadedData() {
        return this.loadedData !== null && this.loadedData.length > 0;
    }

    /**
     * Получение количества строк в загруженных данных
     * @returns {number}
     */
    getRowCount() {
        return this.loadedData ? this.loadedData.length : 0;
    }

    /**
     * Получение строки по индексу
     * @param {number} index - Индекс строки (0-based)
     * @returns {Array<string>|null}
     */
    getRow(index) {
        if (!this.loadedData || index < 0 || index >= this.loadedData.length) {
            return null;
        }
        return this.loadedData[index];
    }

    /**
     * Маппинг строки данных в объект с именованными полями
     * @param {Array<string>} row - Строка данных
     * @returns {Object} - Объект с именованными полями
     */
    mapRowToFields(row) {
        const dataMapping = this.settings.get('dataMapping');
        const result = {};

        for (const [key, config] of Object.entries(dataMapping)) {
            const value = row[config.column];
            result[config.blockName] = value ? value.trim() : '';
        }

        return result;
    }

    /**
     * Получение всех строк как объектов с именованными полями
     * @returns {Array<Object>}
     */
    getAllRowsAsObjects() {
        if (!this.hasLoadedData()) {
            return [];
        }

        return this.loadedData.map(row => this.mapRowToFields(row));
    }

    /**
     * Экспорт статистики
     * @returns {Object}
     */
    getStats() {
        return {
            hasData: this.hasLoadedData(),
            rowCount: this.getRowCount(),
            cacheSize: this.cache.size,
            cacheTTL: this.cacheTTL
        };
    }
}

