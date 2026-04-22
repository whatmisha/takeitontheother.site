/**
 * TextToPath — конвертация SVG <text> в <path> (кривые) через opentype.js.
 * Скопировано из grid_generator; пути к шрифтам по умолчанию относительно корня страницы (папка fonts/).
 *
 * @param {Object} [options]
 * @param {Record<string, string>} [options.fontPaths] — переопределение карты 'Family-Weight' → URL
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

    /**
     * `glyph.getPath(x, y, size)` in opentype.js always uses **y** as the
     * **alphabetic** baseline. SVG, however, interprets the same coordinate
     * according to `dominant-baseline` (e.g. `hanging` is **above** the
     * alphabetic line). If we copy `y` from `<text>` straight into
     * `getPath`, all `hanging` labels jump **up and left** relative to
     * browser/Illustrator rendering.
     */
    _svgYToOpenTypeAlphabeticBaseline(svgY, font, fontSize, dominantBaseline) {
        const scale = fontSize / font.unitsPerEm;
        const db = (dominantBaseline || 'auto').trim();
        if (db === 'auto' || db === 'alphabetic' || db === 'use-script' || !db) {
            return svgY;
        }
        // Ascent from alphabetic baseline to “top” of the em box (font units → px)
        const asc = (font.ascender != null ? font.ascender
            : (font.tables && font.tables.hhea && font.tables.hhea.ascender) || 0) * scale;
        // sCapHeight: distance from alphabetic baseline to top of Latin caps
        // (closer to how browsers position “top”-aligned one-line <text>).
        const os2 = font.tables && font.tables.os2;
        const capH = (os2 && (os2.sCapHeight != null) && os2.sCapHeight > 0)
            ? os2.sCapHeight * scale
            : 0.72 * fontSize;

        // `hanging` (and the rare SVG fallbacks) — the `y` value is a line
        // *above* the alphabetic baseline. Move the baseline down so it
        // matches the live `<text>` layout.
        if (db === 'hanging' || db === 'text-top' || db === 'text-before-edge' || db === 'top') {
            // For our keyboard labels, y with `hanging` marks the "top" row of
            // glyphs. opentype's `getPath(…, y, …)` always places the *alphabetic*
            // baseline on y, so: alphabeticY ≈ hangingY + capHeight. We use
            // OS/2 sCapHeight (when present) or 0.72em, matching Latin caps.
            return svgY + capH;
        }
        // `middle` / `central` — y is the vertical center of the em box
        if (db === 'middle' || db === 'central' || db === 'mathematical') {
            const d = 0.5 * ((asc || 0.88 * fontSize) + (Math.abs(
                (font.descender != null ? font.descender
                    : (font.tables && font.tables.hhea && font.tables.hhea.descender) || 0)
            ) * scale));
            return svgY - d;
        }
        if (db === 'ideographic' || db === 'bottom' || db === 'text-bottom' || db === 'text-after-edge') {
            // y near bottom of em: pull baseline *up* toward alphabetic
            return svgY - Math.abs(
                (font.descender != null ? font.descender
                    : (font.tables && font.tables.hhea && font.tables.hhea.descender) || 0)
            ) * scale;
        }
        return svgY;
    }

    async convertTextElementToPath(textElement) {
        try {
            const fontFamily = textElement.getAttribute('font-family')?.split(',')[0]?.trim() || 'TT Commons Classic';
            const fontWeight = textElement.getAttribute('font-weight') || '400';
            const fontSize = parseFloat(textElement.getAttribute('font-size') || '12');
            let x = parseFloat(textElement.getAttribute('x') || '0');
            let y = parseFloat(textElement.getAttribute('y') || '0');
            const letterSpacingAttr = textElement.getAttribute('letter-spacing') || '0';
            const fill = textElement.getAttribute('fill') || '#000000';
            const textAnchor = textElement.getAttribute('text-anchor') || 'start';
            const dominantBaseline = textElement.getAttribute('dominant-baseline') || 'auto';
            const text = textElement.textContent;

            if (!text) return null;

            const letterSpacingEm = parseFloat(letterSpacingAttr);

            const fontKey = `${fontFamily}-${fontWeight}`;

            const font = await this.loadFont(fontKey);

            const scale = fontSize / font.unitsPerEm;

            y = this._svgYToOpenTypeAlphabeticBaseline(y, font, fontSize, dominantBaseline);

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
            // Honour an opt-out marker: consumers can tag specific <text> elements
            // with data-no-outline="true" when the font is intentionally system-
            // provided (e.g. placeholder labels, UI hints) and should remain as
            // live <text> in the export.
            const textElements = svgElement.querySelectorAll('text:not([data-no-outline="true"])');

            if (textElements.length === 0) {
                return svgElement;
            }

            for (const textElement of textElements) {
                try {
                    const pathElement = await this.convertTextElementToPath(textElement);
                    if (pathElement) {
                        textElement.parentNode.replaceChild(pathElement, textElement);
                    }
                } catch (err) {
                    // Font not registered in fontPaths, 404, unknown glyph -- leave
                    // the original <text> in place rather than aborting the whole
                    // export. One warning per unique font keeps the console quiet.
                    const fontFamily = textElement.getAttribute('font-family') || 'TT Commons Classic';
                    const fontWeight = textElement.getAttribute('font-weight') || '400';
                    const key = `${fontFamily}-${fontWeight}`;
                    if (!this._warnedMissing) this._warnedMissing = new Set();
                    if (!this._warnedMissing.has(key)) {
                        this._warnedMissing.add(key);
                        console.warn(`[TextToPath] skipping outline conversion for "${key}" (${err?.message || err}); element kept as <text>.`);
                    }
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
