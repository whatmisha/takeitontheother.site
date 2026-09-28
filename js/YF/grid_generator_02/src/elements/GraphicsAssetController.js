import { loadRasterPreview } from './RasterAsset.js';
import { SvgSanitizer } from '../svg/SvgSanitizer.js';

/** Loads, normalizes and applies SVG assets used by graphics objects. */
export class GraphicsAssetController {
    constructor(host, { sanitizer = new SvgSanitizer() } = {}) {
        this.host = host;
        this.sanitizer = sanitizer;
    }

    async load(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const className = filePath.includes('icons.svg') ? 'icon-fill' : 'claim-fill';
            return this.process(await response.text(), className);
        } catch (error) {
            console.error(`Error loading SVG from ${filePath}:`, error);
            return null;
        }
    }

    async handleFile(file) {
        const editingId = this.host.currentEditingGraphicsId;
        const history = this.host.historyManager;
        const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
        const raster = isSvg ? null : await loadRasterPreview(file);
        const asset = isSvg ? this.process(await this.readFile(file), 'claim-fill') : null;
        if (isSvg && !asset) throw new Error('This file does not contain a valid SVG.');
        if (this.host.historyManager !== history) throw new Error('The preset changed while loading. Please add the file again.');
        const name = file.name;
        const fields = { svgContent: asset?.content || '', raster: raster || undefined, missingAsset: false, name,
            originalWidth: asset?.width || raster.width, originalHeight: asset?.height || raster.height };
        const placeholder = this.host.dom.fileUploadArea?.querySelector('.upload-placeholder p');
        if (editingId) {
            const block = this.host.objectDocument.getGraphicsBlock(editingId);
            if (!block) return null;
            history.beginAction('replace graphic asset', this.host.getStateSnapshot());
            // Relinking the same kind preserves the chosen frame and crop mode.
            if ((block.raster && raster) || (block.missingAsset && !raster)) {
                fields.originalWidth = block.originalWidth;
                fields.originalHeight = block.originalHeight;
                if (raster) fields.raster.fit = block.raster.fit || 'cover';
            }
            delete block.markings;
            Object.assign(block, fields);
            this.syncEditedBlock(block, placeholder);
            history.commitAction(this.host.getStateSnapshot());
            this.host.markAsChanged();
            if (this.host.currentEditingGraphicsId === editingId) this.host.objectEditorPanelController.openGraphicsPanel(editingId);
            return block;
        }
        const block = this.host.objectNavigatorController.addGraphics(fields);
        this.host.objectEditorPanelController.closeGraphicsPanel();
        return block;
    }

    process(svgContent, className = 'claim-fill') {
        const parser = new DOMParser();
        const svg = parser.parseFromString(svgContent, 'image/svg+xml').querySelector('svg');
        if (!svg) return null;
        this.sanitizer.sanitizeElement(svg);
        const viewBox = svg.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number);
        const width = viewBox?.length === 4 && Number.isFinite(viewBox[2])
            ? viewBox[2]
            : Number.parseFloat(svg.getAttribute('width')) || 100;
        const height = viewBox?.length === 4 && Number.isFinite(viewBox[3])
            ? viewBox[3]
            : Number.parseFloat(svg.getAttribute('height')) || 100;
        let content = GraphicsAssetController.normalizePaint(svg.innerHTML);
        content = content
            .replace(/class="st\d+"/gi, `class="${className}"`)
            .replace(/class='st\d+'/gi, `class='${className}'`);
        content = GraphicsAssetController.ensureCurrentColorClass(content, className);
        return { width, height, content };
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => resolve(event.target.result);
            reader.onerror = () => reject(new Error(`Failed to read ${file.name || 'SVG file'}`));
            reader.readAsText(file);
        });
    }

    syncEditedBlock(block, placeholder) {
        if (this.host.dom.graphicsPanelTitle) {
            const name = block.name || 'Graphic';
            this.host.dom.graphicsPanelTitle.textContent = name.length > 24
                ? `${name.slice(0, 24)}...`
                : name;
        }
        if (placeholder) {
            placeholder.textContent = `Current: ${block.name || 'Graphic'} — Upload an image or SVG to replace`;
        }
        this.host.objectNavigatorController.render();
        this.host.updateGrid();
    }

    static normalizePaint(content) {
        return content
            .replace(/fill="(?!none)[^"]*"/gi, 'fill="currentColor"')
            .replace(/fill='(?!none)[^']*'/gi, "fill='currentColor'")
            .replace(/stroke="(?!none)[^"]*"/gi, 'stroke="currentColor"')
            .replace(/stroke='(?!none)[^']*'/gi, "stroke='currentColor'")
            .replace(/style="([^"]*)"/gi, (match, styles) => {
                const normalized = GraphicsAssetController.normalizeStyleText(styles);
                return `style="${normalized}"`;
            })
            .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, styles) => (
                match.replace(styles, GraphicsAssetController.normalizeStyleText(styles))
            ));
    }

    static normalizeStyleText(styles) {
        return styles.replace(
            /(fill|stroke):\s*([^;"}]+)/gi,
            (match, property, value) => (
                /^none(?:\s*!important)?$/i.test(value.trim())
                    ? match
                    : `${property}: currentColor`
            )
        );
    }

    static ensureCurrentColorClass(content, className) {
        if (!content.includes(className) || content.includes(`.${className}`)) return content;
        const rule = `<style>.${className} { fill: currentColor; }</style>`;
        if (/<defs(?:\s[^>]*)?>/i.test(content)) {
            return content.replace(/<defs(?:\s[^>]*)?>/i, match => `${match}${rule}`);
        }
        return `<defs>${rule}</defs>${content}`;
    }
}
