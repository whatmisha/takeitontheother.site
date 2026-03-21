/**
 * ImageSampler — загрузка изображений и извлечение карты яркости.
 *
 * Работает через offscreen <canvas>: изображение рисуется на canvas нужного
 * размера (cols × rows), затем из каждого пикселя считывается яркость.
 */
export class ImageSampler {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.sourceImage = null;
        this.imageLoaded = false;
    }

    /**
     * Загрузить изображение по URL (относительному или абсолютному).
     * @param {string} url
     * @returns {Promise<void>}
     */
    async loadFromURL(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.sourceImage = img;
                this.imageLoaded = true;
                resolve();
            };
            img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
            img.src = url;
        });
    }

    /**
     * Загрузить изображение из File (drag-drop или <input type="file">).
     * @param {File} file
     * @returns {Promise<string>} data URL для превью
     */
    async loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.sourceImage = img;
                    this.imageLoaded = true;
                    resolve(e.target.result);
                };
                img.onerror = () => reject(new Error('Failed to decode image'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Извлечь карту яркости с разрешением cols × rows.
     *
     * Изображение масштабируется (cover-fit) на canvas cols×rows,
     * затем для каждого пикселя вычисляется яркость по формуле
     * L = 0.299R + 0.587G + 0.114B, нормализованная в [0, 1].
     *
     * @param {number} cols — количество столбцов
     * @param {number} rows — количество строк
     * @returns {Float32Array[]} — двумерный массив [row][col], значения 0..1
     */
    getBrightnessMap(cols, rows) {
        if (!this.imageLoaded || !this.sourceImage) {
            return this._emptyMap(cols, rows);
        }

        this.canvas.width = cols;
        this.canvas.height = rows;

        this.ctx.clearRect(0, 0, cols, rows);

        const img = this.sourceImage;
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const canvasAspect = cols / rows;

        let sx, sy, sw, sh;
        if (imgAspect > canvasAspect) {
            sh = img.naturalHeight;
            sw = sh * canvasAspect;
            sx = (img.naturalWidth - sw) / 2;
            sy = 0;
        } else {
            sw = img.naturalWidth;
            sh = sw / canvasAspect;
            sx = 0;
            sy = (img.naturalHeight - sh) / 2;
        }

        this.ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);

        const imageData = this.ctx.getImageData(0, 0, cols, rows);
        const pixels = imageData.data;

        const map = [];
        for (let row = 0; row < rows; row++) {
            const rowData = new Float32Array(cols);
            for (let col = 0; col < cols; col++) {
                const i = (row * cols + col) * 4;
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];
                rowData[col] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            }
            map.push(rowData);
        }

        return map;
    }

    /** @returns {boolean} */
    isLoaded() {
        return this.imageLoaded;
    }

    /** @returns {{ width: number, height: number } | null} */
    getImageDimensions() {
        if (!this.sourceImage) return null;
        return {
            width: this.sourceImage.naturalWidth,
            height: this.sourceImage.naturalHeight
        };
    }

    /** @private */
    _emptyMap(cols, rows) {
        const map = [];
        for (let row = 0; row < rows; row++) {
            map.push(new Float32Array(cols).fill(0.5));
        }
        return map;
    }
}
