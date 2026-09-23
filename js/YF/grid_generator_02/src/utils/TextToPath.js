/**
 * TextToPath - Конвертация текста в SVG paths (кривые)
 * Использует opentype.js для загрузки шрифтов и создания путей
 */

import { loadOpentypeRuntime } from '../runtime/BrowserRuntimeLoader.js';

export class TextToPath {
    constructor({
        dependencyLoader = () => loadOpentypeRuntime()
    } = {}) {
        this.fonts = new Map(); // Кэш загруженных шрифтов
        this.dependencyLoader = dependencyLoader;
        this.opentype = null;
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

        this.loadingPromise = this.dependencyLoader()
            .then(opentype => {
                this.opentype = opentype;
                this.opentypeLoaded = true;
                return true;
            })
            .catch(error => {
                this.loadingPromise = null;
                throw new Error(`Failed to load opentype.js: ${error.message}`);
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
                this.opentype.load(fontPath, (err, font) => {
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
            let x = parseFloat(textElement.getAttribute('x') || '0');
            const y = parseFloat(textElement.getAttribute('y') || '0');
            const letterSpacingAttr = textElement.getAttribute('letter-spacing') || '0';
            const fill = textElement.getAttribute('fill') || '#000000';
            const textAnchor = textElement.getAttribute('text-anchor') || 'start';
            const text = textElement.textContent;

            if (!text) return null;

            // Парсим letter-spacing (в em)
            const letterSpacingEm = parseFloat(letterSpacingAttr);

            // Создаем ключ для шрифта
            const fontKey = `${fontFamily}-${fontWeight}`;
            
            // Загружаем шрифт
            const font = await this.loadFont(fontKey);

            const scale = fontSize / font.unitsPerEm;

            // Вычисляем ширину текста для корректировки координаты x при выравнивании
            let textWidth = 0;
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const glyph = font.charToGlyph(char);
                if (glyph && glyph.index !== 0) {
                    let advance = glyph.advanceWidth * scale;
                    // Добавляем кернинг если это не последний символ
                    if (i < text.length - 1) {
                        const nextChar = text[i + 1];
                        const nextGlyph = font.charToGlyph(nextChar);
                        if (nextGlyph && nextGlyph.index !== 0) {
                            const kerning = font.getKerningValue(glyph, nextGlyph);
                            advance += kerning * scale;
                        }
                    }
                    // Добавляем letter-spacing
                    advance += letterSpacingEm * fontSize;
                    textWidth += advance;
                } else {
                    // Fallback для отсутствующих символов
                    textWidth += fontSize * 0.3 + letterSpacingEm * fontSize;
                }
            }

            // Корректируем координату x в зависимости от text-anchor
            if (textAnchor === 'end') {
                // Для выравнивания по правому краю: x указывает на правый край текста
                // При конвертации в кривые мы начинаем с левого края, поэтому вычитаем ширину
                x = x - textWidth;
            } else if (textAnchor === 'middle') {
                // Для выравнивания по центру: x указывает на центр текста
                // При конвертации в кривые мы начинаем с левого края, поэтому вычитаем половину ширины
                x = x - textWidth / 2;
            }
            // Для 'start' (выравнивание по левому краю) координата x не меняется

            // Отрисовываем текст посимвольно для правильного учета letter-spacing
            let currentX = x;
            let pathData = '';
            
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const glyph = font.charToGlyph(char);
                
                // Проверяем, найден ли глиф (для кириллицы и других символов)
                if (!glyph || glyph.index === 0) {
                    // Если глиф не найден, используем .notdef или пробел
                    console.warn(`Glyph not found for character: "${char}" (code: ${char.charCodeAt(0)})`);
                    // Используем пробел как fallback
                    const spaceGlyph = font.charToGlyph(' ');
                    if (spaceGlyph && spaceGlyph.index !== 0) {
                        const spacePath = spaceGlyph.getPath(currentX, y, fontSize);
                        pathData += spacePath.toPathData() + ' ';
                        currentX += spaceGlyph.advanceWidth * scale + letterSpacingEm * fontSize;
                    } else {
                        // Если даже пробел не найден, просто пропускаем символ с минимальным продвижением
                        currentX += fontSize * 0.3 + letterSpacingEm * fontSize;
                    }
                    continue;
                }
                
                // Получаем path для глифа
                const glyphPath = glyph.getPath(currentX, y, fontSize);
                const pathDataForGlyph = glyphPath.toPathData();
                
                // Проверяем, что path не пустой
                if (pathDataForGlyph && pathDataForGlyph.trim().length > 0) {
                    pathData += pathDataForGlyph + ' ';
                }
                
                // Вычисляем продвижение (advance) с учетом letter-spacing
                let advance = glyph.advanceWidth * scale;
                
                // Добавляем кернинг если это не последний символ
                if (i < text.length - 1) {
                    const nextChar = text[i + 1];
                    const nextGlyph = font.charToGlyph(nextChar);
                    if (nextGlyph && nextGlyph.index !== 0) {
                        const kerning = font.getKerningValue(glyph, nextGlyph);
                        advance += kerning * scale;
                    }
                }
                
                // Добавляем letter-spacing (в em, относительно fontSize)
                advance += letterSpacingEm * fontSize;
                
                currentX += advance;
            }

            // Создаем SVG path элемент
            const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathElement.setAttribute('d', pathData.trim());
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
