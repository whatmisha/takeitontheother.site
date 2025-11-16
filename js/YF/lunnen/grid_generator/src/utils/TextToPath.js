/**
 * TextToPath - Конвертация текста в SVG paths (кривые)
 * Использует opentype.js для загрузки шрифтов и создания путей
 */

export class TextToPath {
    constructor() {
        this.fonts = new Map(); // Кэш загруженных шрифтов
        this.fontPaths = {
            'TT Commons Classic-400': 'fonts/TT Commons Classic Regular.otf',
            'TT Commons Classic-500': 'fonts/TT Commons Classic Medium.otf',
            'Lunnen Display-400': 'fonts/LunnenDisplay-VariableVF.ttf'
        };
        this.opentypeLoaded = false;
        this.loadingPromise = null;
    }

    /**
     * Загрузить библиотеку opentype.js
     */
    async loadOpentype() {
        if (this.opentypeLoaded) return true;
        
        if (this.loadingPromise) {
            return this.loadingPromise;
        }

        this.loadingPromise = new Promise((resolve, reject) => {
            // Проверяем, не загружена ли уже библиотека
            if (window.opentype) {
                this.opentypeLoaded = true;
                resolve(true);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.min.js';
            script.onload = () => {
                this.opentypeLoaded = true;
                resolve(true);
            };
            script.onerror = () => {
                reject(new Error('Failed to load opentype.js'));
            };
            document.head.appendChild(script);
        });

        return this.loadingPromise;
    }

    /**
     * Загрузить шрифт по ключу
     */
    async loadFont(fontKey) {
        // Если шрифт уже загружен, возвращаем его
        if (this.fonts.has(fontKey)) {
            return this.fonts.get(fontKey);
        }

        // Загружаем opentype.js если еще не загружена
        await this.loadOpentype();

        const fontPath = this.fontPaths[fontKey];
        if (!fontPath) {
            throw new Error(`Font not found: ${fontKey}`);
        }

        try {
            const font = await new Promise((resolve, reject) => {
                window.opentype.load(fontPath, (err, font) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(font);
                    }
                });
            });

            this.fonts.set(fontKey, font);
            return font;
        } catch (error) {
            console.error(`Failed to load font ${fontKey}:`, error);
            throw error;
        }
    }

    /**
     * Конвертировать SVG text элемент в path
     */
    async convertTextElementToPath(textElement) {
        try {
            // Получаем атрибуты text элемента
            const fontFamily = textElement.getAttribute('font-family')?.split(',')[0]?.trim() || 'TT Commons Classic';
            const fontWeight = textElement.getAttribute('font-weight') || '400';
            const fontSize = parseFloat(textElement.getAttribute('font-size') || '12');
            const x = parseFloat(textElement.getAttribute('x') || '0');
            const y = parseFloat(textElement.getAttribute('y') || '0');
            const letterSpacing = parseFloat(textElement.getAttribute('letter-spacing') || '0');
            const fill = textElement.getAttribute('fill') || '#000000';
            const text = textElement.textContent;

            if (!text) return null;

            // Создаем ключ для шрифта
            const fontKey = `${fontFamily}-${fontWeight}`;
            
            // Загружаем шрифт
            const font = await this.loadFont(fontKey);

            // Создаем path из текста
            const path = font.getPath(text, x, y, fontSize, {
                kerning: true,
                letterSpacing: letterSpacing * fontSize // letterSpacing в em, конвертируем в пиксели
            });

            // Создаем SVG path элемент
            const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathElement.setAttribute('d', path.toPathData());
            pathElement.setAttribute('fill', fill);
            
            // Копируем другие атрибуты
            const otherAttrs = ['class', 'id', 'transform', 'opacity', 'fill-opacity'];
            otherAttrs.forEach(attr => {
                const value = textElement.getAttribute(attr);
                if (value) {
                    pathElement.setAttribute(attr, value);
                }
            });

            return pathElement;
        } catch (error) {
            console.error('Error converting text to path:', error);
            return null;
        }
    }

    /**
     * Конвертировать все text элементы в SVG в paths
     */
    async convertAllTextToPaths(svgElement) {
        try {
            // Находим все text элементы
            const textElements = svgElement.querySelectorAll('text');
            
            if (textElements.length === 0) {
                return svgElement; // Нет текста для конвертации
            }

            // Показываем прогресс (опционально)
            console.log(`Converting ${textElements.length} text elements to paths...`);

            // Конвертируем каждый text элемент
            for (const textElement of textElements) {
                const pathElement = await this.convertTextElementToPath(textElement);
                
                if (pathElement) {
                    // Заменяем text на path
                    textElement.parentNode.replaceChild(pathElement, textElement);
                }
            }

            console.log('Text to paths conversion completed');
            return svgElement;
        } catch (error) {
            console.error('Error during text to paths conversion:', error);
            throw error;
        }
    }

    /**
     * Получить информацию о доступных шрифтах
     */
    getAvailableFonts() {
        return Object.keys(this.fontPaths);
    }
}

