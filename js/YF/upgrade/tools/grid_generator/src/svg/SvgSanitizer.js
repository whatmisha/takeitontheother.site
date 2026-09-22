const BLOCKED_ELEMENTS = new Set([
    'script', 'foreignobject', 'iframe', 'object', 'embed', 'link', 'meta',
    'audio', 'video', 'canvas', 'animate', 'animatemotion',
    'animatetransform', 'set', 'discard'
]);

const REFERENCE_ATTRIBUTES = new Set(['href', 'xlink:href', 'src']);
const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp);base64,/i;

/** Removes executable and externally loaded content from user-provided SVG. */
export class SvgSanitizer {
    constructor({
        DOMParserClass = globalThis.DOMParser
    } = {}) {
        this.DOMParserClass = DOMParserClass;
    }

    sanitizeFragment(content = '') {
        if (!content) return '';
        if (!this.DOMParserClass) {
            throw new Error('SVG sanitizer requires DOMParser');
        }
        const parser = new this.DOMParserClass();
        const document = parser.parseFromString(
            `<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`,
            'image/svg+xml'
        );
        if (document.querySelector('parsererror')) {
            throw new Error('Invalid SVG markup');
        }
        const root = document.documentElement;
        this.sanitizeElement(root);
        return root.innerHTML;
    }

    sanitizeElement(root) {
        if (!root) return root;
        Array.from(root.querySelectorAll('*')).forEach(element => {
            if (BLOCKED_ELEMENTS.has(element.localName?.toLowerCase())) element.remove();
        });

        [root, ...Array.from(root.querySelectorAll('*'))].forEach(element => {
            Array.from(element.attributes || []).forEach(attribute => {
                const name = attribute.name.toLowerCase();
                const value = attribute.value || '';
                if (name.startsWith('on') || /javascript\s*:/i.test(value)) {
                    element.removeAttribute(attribute.name);
                    return;
                }
                if (REFERENCE_ATTRIBUTES.has(name) && !this.isSafeReference(value)) {
                    element.removeAttribute(attribute.name);
                    return;
                }
                if (name === 'style' || /url\s*\(/i.test(value)) {
                    const sanitized = this.sanitizeCss(value);
                    if (sanitized.trim()) element.setAttribute(attribute.name, sanitized);
                    else element.removeAttribute(attribute.name);
                }
            });
            if (element.localName?.toLowerCase() === 'style') {
                element.textContent = this.sanitizeCss(element.textContent || '');
            }
        });
        return root;
    }

    isSafeReference(value) {
        const normalized = value.trim();
        return normalized.startsWith('#') || SAFE_DATA_IMAGE.test(normalized);
    }

    sanitizeCss(value) {
        return value
            .replace(/@import\s+(?:url\([^)]*\)|["'][^"']*["'])\s*;?/gi, '')
            .replace(/expression\s*\([^)]*\)/gi, '')
            .replace(/url\s*\(\s*(["']?)(.*?)\1\s*\)/gi, (match, quote, reference) => (
                reference.trim().startsWith('#') ? `url(${reference.trim()})` : 'none'
            ));
    }
}
