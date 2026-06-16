/**
 * TextToPath — convert SVG <text> to <path> outlines via opentype.js.
 * Copied from grid_generator; default font paths are relative to the page root (fonts/).
 *
 * @param {Object} [options]
 * @param {Record<string, string>} [options.fontPaths] — override map from 'Family-Weight' to URL
 */
export class TextToPath {
    constructor(options = {}) {
        this.fonts = new Map();
        this.fontPaths = {
            'TT Commons Classic-400': 'fonts/TT Commons Classic Regular.otf',
            'TT Commons Classic-500': 'fonts/TT Commons Classic Medium.otf',
            'Lunnen Display-400': 'fonts/LunnenDisplay-VariableVF.ttf',
            ...options.fontPaths
        };
        this.opentypeLoaded = false;
        this.loadingPromise = null;
    }

    async loadOpentype() {
        if (this.opentypeLoaded) return true;

        if (this.loadingPromise) {
            return this.loadingPromise;
        }

        this.loadingPromise = new Promise((resolve, reject) => {
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

    async loadFont(fontKey) {
        if (this.fonts.has(fontKey)) {
            return this.fonts.get(fontKey);
        }

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

    async convertTextElementToPath(textElement) {
        try {
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

            const letterSpacingEm = parseFloat(letterSpacingAttr);

            const fontKey = `${fontFamily}-${fontWeight}`;

            const font = await this.loadFont(fontKey);

            const scale = fontSize / font.unitsPerEm;

            let textWidth = 0;
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const glyph = font.charToGlyph(char);
                if (glyph && glyph.index !== 0) {
                    let advance = glyph.advanceWidth * scale;
                    if (i < text.length - 1) {
                        const nextChar = text[i + 1];
                        const nextGlyph = font.charToGlyph(nextChar);
                        if (nextGlyph && nextGlyph.index !== 0) {
                            const kerning = font.getKerningValue(glyph, nextGlyph);
                            advance += kerning * scale;
                        }
                    }
                    advance += letterSpacingEm * fontSize;
                    textWidth += advance;
                } else {
                    textWidth += fontSize * 0.3 + letterSpacingEm * fontSize;
                }
            }

            if (textAnchor === 'end') {
                x = x - textWidth;
            } else if (textAnchor === 'middle') {
                x = x - textWidth / 2;
            }

            let currentX = x;
            let pathData = '';

            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const glyph = font.charToGlyph(char);

                if (!glyph || glyph.index === 0) {
                    console.warn(`Glyph not found for character: "${char}" (code: ${char.charCodeAt(0)})`);
                    const spaceGlyph = font.charToGlyph(' ');
                    if (spaceGlyph && spaceGlyph.index !== 0) {
                        const spacePath = spaceGlyph.getPath(currentX, y, fontSize);
                        pathData += spacePath.toPathData() + ' ';
                        currentX += spaceGlyph.advanceWidth * scale + letterSpacingEm * fontSize;
                    } else {
                        currentX += fontSize * 0.3 + letterSpacingEm * fontSize;
                    }
                    continue;
                }

                const glyphPath = glyph.getPath(currentX, y, fontSize);
                const pathDataForGlyph = glyphPath.toPathData();

                if (pathDataForGlyph && pathDataForGlyph.trim().length > 0) {
                    pathData += pathDataForGlyph + ' ';
                }

                let advance = glyph.advanceWidth * scale;

                if (i < text.length - 1) {
                    const nextChar = text[i + 1];
                    const nextGlyph = font.charToGlyph(nextChar);
                    if (nextGlyph && nextGlyph.index !== 0) {
                        const kerning = font.getKerningValue(glyph, nextGlyph);
                        advance += kerning * scale;
                    }
                }

                advance += letterSpacingEm * fontSize;

                currentX += advance;
            }

            const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathElement.setAttribute('d', pathData.trim());
            pathElement.setAttribute('fill', fill);

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

    async convertAllTextToPaths(svgElement) {
        try {
            const textElements = svgElement.querySelectorAll('text');

            if (textElements.length === 0) {
                return svgElement;
            }

            for (const textElement of textElements) {
                const pathElement = await this.convertTextElementToPath(textElement);

                if (pathElement) {
                    textElement.parentNode.replaceChild(pathElement, textElement);
                }
            }

            return svgElement;
        } catch (error) {
            console.error('Error during text to paths conversion:', error);
            throw error;
        }
    }

    getAvailableFonts() {
        return Object.keys(this.fontPaths);
    }
}
