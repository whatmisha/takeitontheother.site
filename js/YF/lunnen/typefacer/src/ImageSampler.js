/**
 * ImageSampler — загрузка изображений/видео и извлечение карты яркости.
 *
 * Поддерживает:
 *   - loadFromURL(url)            — загрузить изображение по URL
 *   - loadFromFile(file)          — загрузить изображение из File
 *   - loadFromVideo(file)         — загрузить видео из File (первый кадр)
 *   - seekVideo(timeSec)          — перейти на указанное время и захватить кадр
 *   - playVideo() / pauseVideo()  — воспроизведение/пауза (loop=true)
 *   - captureCurrentVideoFrame()  — захватить текущий кадр для рендера
 */
export class ImageSampler {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.sourceImage = null;
        this.imageLoaded = false;

        this._videoEl  = null;
        this._videoURL = null;
        this.videoLoaded   = false;
        this.videoDuration = 0;
    }

    /* ---------------------------------------------------------------- */
    /*  Image loading                                                    */
    /* ---------------------------------------------------------------- */

    async loadFromURL(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this._releaseVideo();
                this.sourceImage = img;
                this.imageLoaded = true;
                resolve();
            };
            img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
            img.src = url;
        });
    }

    async loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this._releaseVideo();
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

    /* ---------------------------------------------------------------- */
    /*  Video loading & playback                                         */
    /* ---------------------------------------------------------------- */

    /**
     * Загрузить видео из File. Захватывает первый кадр (time=0).
     * @param {File} file
     * @returns {Promise<{ duration: number }>}
     */
    async loadFromVideo(file) {
        this._releaseVideo();

        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.muted       = true;
        video.playsInline = true;
        video.loop        = true;
        video.preload     = 'metadata';
        video.src         = url;

        this._videoEl  = video;
        this._videoURL = url;

        await new Promise((resolve, reject) => {
            video.onloadedmetadata = () => {
                this.videoDuration = video.duration;
                this.videoLoaded = true;
                resolve();
            };
            video.onerror = () => reject(new Error('Failed to load video'));
        });

        await this.seekVideo(0);
        return { duration: this.videoDuration };
    }

    /**
     * Перейти на указанное время в секундах и захватить кадр.
     * Если видео играет — просто устанавливает currentTime, seeked подхватит RAF.
     * @param {number} timeSec
     * @returns {Promise<void>}
     */
    seekVideo(timeSec) {
        const video = this._videoEl;
        if (!video) return Promise.resolve();

        return new Promise((resolve) => {
            const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                this.captureCurrentVideoFrame();
                resolve();
            };
            video.addEventListener('seeked', onSeeked);
            video.currentTime = Math.max(0, Math.min(timeSec, this.videoDuration));
        });
    }

    /**
     * Запустить воспроизведение (loop=true устанавливается при loadFromVideo).
     * @returns {Promise<void>}
     */
    playVideo() {
        const video = this._videoEl;
        if (!video) return Promise.resolve();
        video.loop = true;
        return video.play();
    }

    /** Поставить видео на паузу. */
    pauseVideo() {
        const video = this._videoEl;
        if (video && !video.paused) video.pause();
    }

    /** @returns {boolean} */
    isVideoPlaying() {
        const v = this._videoEl;
        return !!(v && !v.paused && !v.ended);
    }

    /** @returns {number} */
    getVideoCurrentTime() {
        return this._videoEl ? this._videoEl.currentTime : 0;
    }

    /**
     * Использовать текущий кадр видео как источник для getBrightnessMap.
     * HTMLVideoElement можно передавать напрямую в drawImage.
     */
    captureCurrentVideoFrame() {
        const video = this._videoEl;
        if (!video) return;
        this.sourceImage = video;
        this.imageLoaded = true;
    }

    /* ---------------------------------------------------------------- */
    /*  Brightness map                                                   */
    /* ---------------------------------------------------------------- */

    getBrightnessMap(cols, rows) {
        if (!this.imageLoaded || !this.sourceImage) {
            return this._emptyMap(cols, rows);
        }

        this.canvas.width  = cols;
        this.canvas.height = rows;
        this.ctx.clearRect(0, 0, cols, rows);

        const img  = this.sourceImage;
        const srcW = img.naturalWidth  || img.videoWidth  || cols;
        const srcH = img.naturalHeight || img.videoHeight || rows;

        const imgAspect    = srcW / srcH;
        const canvasAspect = cols / rows;

        let sx, sy, sw, sh;
        if (imgAspect > canvasAspect) {
            sh = srcH; sw = sh * canvasAspect;
            sx = (srcW - sw) / 2; sy = 0;
        } else {
            sw = srcW; sh = sw / canvasAspect;
            sx = 0; sy = (srcH - sh) / 2;
        }

        this.ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);

        const imageData = this.ctx.getImageData(0, 0, cols, rows);
        const pixels    = imageData.data;
        const map = [];

        for (let row = 0; row < rows; row++) {
            const rowData = new Float32Array(cols);
            for (let col = 0; col < cols; col++) {
                const i = (row * cols + col) * 4;
                rowData[col] = (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]) / 255;
            }
            map.push(rowData);
        }
        return map;
    }

    isLoaded()      { return this.imageLoaded; }
    isVideoLoaded() { return this.videoLoaded; }

    getImageDimensions() {
        if (!this.sourceImage) return null;
        return {
            width:  this.sourceImage.naturalWidth  || this.sourceImage.videoWidth  || 0,
            height: this.sourceImage.naturalHeight || this.sourceImage.videoHeight || 0,
        };
    }

    /* ---------------------------------------------------------------- */
    /*  Private                                                          */
    /* ---------------------------------------------------------------- */

    _releaseVideo() {
        if (this._videoEl) {
            this._videoEl.pause();
            this._videoEl = null;
        }
        if (this._videoURL) {
            URL.revokeObjectURL(this._videoURL);
            this._videoURL = null;
        }
        this.videoLoaded   = false;
        this.videoDuration = 0;
    }

    _emptyMap(cols, rows) {
        const map = [];
        for (let row = 0; row < rows; row++) {
            map.push(new Float32Array(cols).fill(0.5));
        }
        return map;
    }
}
