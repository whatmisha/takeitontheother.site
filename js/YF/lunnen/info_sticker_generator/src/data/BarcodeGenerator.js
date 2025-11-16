const JSBARCODE_CDN_URL = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/+esm';

let jsBarcodePromise = null;

async function loadJsBarcode() {
    if (!jsBarcodePromise) {
        jsBarcodePromise = import(JSBARCODE_CDN_URL);
    }
    return jsBarcodePromise;
}

export class BarcodeGenerator {
    static async generate(value, options = {}) {
        if (!value) {
            throw new Error('Пустое значение штрихкода');
        }

        const JsBarcodeModule = await loadJsBarcode();
        const JsBarcode = JsBarcodeModule.default || JsBarcodeModule;

        const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

        JsBarcode(svgNode, value, {
            format: options.format || 'CODE128',
            width: options.barWidth || 1.6,
            height: options.barHeight || 60,
            displayValue: options.displayValue ?? true,
            fontSize: options.fontSize || 18,
            font: options.font || 'TT Commons Classic, sans-serif',
            margin: options.margin ?? 12,
            background: 'transparent',
            lineColor: options.lineColor || '#000000'
        });

        const viewBox = svgNode.getAttribute('viewBox');
        let originalWidth = 0;
        let originalHeight = 0;

        if (viewBox) {
            const parts = viewBox.split(/\s+/).map(Number);
            originalWidth = parts[2] || 200;
            originalHeight = parts[3] || 80;
        } else {
            originalWidth = parseFloat(svgNode.getAttribute('width')) || 200;
            originalHeight = parseFloat(svgNode.getAttribute('height')) || 80;
        }

        return {
            svg: svgNode.outerHTML,
            width: originalWidth,
            height: originalHeight
        };
    }
}

