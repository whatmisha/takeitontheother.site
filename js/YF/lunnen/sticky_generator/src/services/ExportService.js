/**
 * ExportService - Сервис для массового экспорта стикеров
 * Создание ZIP архивов, прогресс-бар, оптимизация производительности
 */
export class ExportService {
    constructor(settings, svgExporter) {
        this.settings = settings;
        this.svgExporter = svgExporter;
        this.isExporting = false;
        this.progressCallback = null;
    }

    /**
     * Установка коллбэка для отслеживания прогресса
     * @param {Function} callback - (current, total, message) => void
     */
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    /**
     * Обновление прогресса
     */
    updateProgress(current, total, message = '') {
        if (this.progressCallback) {
            this.progressCallback(current, total, message);
        }
    }

    /**
     * Массовый экспорт стикеров в ZIP архив
     * @param {Array<Function>} generators - Массив функций-генераторов SVG
     * @param {Object} options - Опции экспорта
     * @returns {Promise<Blob>} - ZIP архив
     */
    async exportToZip(generators, options = {}) {
        if (this.isExporting) {
            throw new Error('Export already in progress');
        }

        this.isExporting = true;

        try {
            // Проверяем наличие JSZip
            if (typeof JSZip === 'undefined') {
                throw new Error('JSZip library not loaded');
            }

            const zip = new JSZip();
            const total = generators.length;

            this.updateProgress(0, total, 'Начинаем экспорт...');

            // Параметры для имен файлов
            const { frontWidth, frontHeight, gridModule, columnCount, rowCount } = this.settings.getAll();
            const timestamp = this.generateTimestamp();
            const size = `${frontWidth}×${frontHeight}mm`;
            const cols = `${columnCount}col`;
            const rows = `${rowCount}rows`;
            const module = `${gridModule.toFixed(2)}mm`;

            // Генерируем SVG для каждого стикера
            for (let i = 0; i < total; i++) {
                const currentNumber = i + 1;
                this.updateProgress(currentNumber, total, `Генерация ${currentNumber} из ${total}...`);

                try {
                    // Вызываем генератор для получения SVG
                    const svgElement = await generators[i]();

                    if (!svgElement) {
                        console.warn(`Generator ${i} returned null, skipping`);
                        continue;
                    }

                    // Преобразуем SVG в строку
                    const svgString = await this.svgExporter.svgToString(svgElement, {
                        removeInteractive: options.removeInteractive !== false,
                        optimizeSize: options.optimizeSize !== false,
                        convertTextToOutlines: options.convertTextToOutlines || false
                    });

                    // Генерируем имя файла
                    const filename = `${size} ${cols} ${rows} ${module} row${currentNumber} ${timestamp}.svg`;

                    // Добавляем файл в архив
                    zip.file(filename, svgString);

                    // Даем браузеру передохнуть каждые 10 файлов
                    if (i % 10 === 0 && i > 0) {
                        await this.delay(10);
                    }

                } catch (error) {
                    console.error(`Error generating SVG ${i}:`, error);
                    // Продолжаем с следующим файлом
                }
            }

            this.updateProgress(total, total, 'Создание ZIP архива...');

            // Генерируем ZIP архив
            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            }, (metadata) => {
                // Прогресс создания архива
                const percent = metadata.percent.toFixed(0);
                this.updateProgress(total, total, `Сжатие архива: ${percent}%`);
            });

            this.updateProgress(total, total, 'Готово!');

            return zipBlob;

        } finally {
            this.isExporting = false;
        }
    }

    /**
     * Скачивание ZIP архива
     * @param {Blob} zipBlob - ZIP архив
     * @param {string} filename - Имя файла
     */
    downloadZip(zipBlob, filename = 'export.zip') {
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Освобождаем память через некоторое время
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /**
     * Генерация timestamp для имен файлов
     * @returns {string} - Timestamp в формате YYYYMMDD_HHMM
     */
    generateTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${year}${month}${day}_${hours}${minutes}`;
    }

    /**
     * Задержка для разгрузки браузера
     * @param {number} ms - Миллисекунды
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Отмена экспорта (для будущей реализации)
     */
    cancel() {
        this.isExporting = false;
    }

    /**
     * Проверка статуса экспорта
     * @returns {boolean}
     */
    isInProgress() {
        return this.isExporting;
    }

    /**
     * Оценка размера архива (примерная)
     * @param {number} fileCount - Количество файлов
     * @param {number} avgFileSize - Средний размер файла в KB
     * @returns {string} - Размер в читаемом формате
     */
    estimateZipSize(fileCount, avgFileSize = 50) {
        const totalKB = fileCount * avgFileSize * 0.3; // ~30% после сжатия
        if (totalKB < 1024) {
            return `${totalKB.toFixed(0)} KB`;
        }
        return `${(totalKB / 1024).toFixed(1)} MB`;
    }

    /**
     * Создание имени архива
     * @param {number} fileCount - Количество файлов
     * @returns {string}
     */
    generateZipFilename(fileCount) {
        const timestamp = this.generateTimestamp();
        const { frontWidth, frontHeight } = this.settings.getAll();
        return `stickers_${frontWidth}x${frontHeight}mm_${fileCount}files_${timestamp}.zip`;
    }
}

