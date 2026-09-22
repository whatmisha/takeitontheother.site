import { DEFAULT_FORM_URL, DEFAULT_IMAGE_URL } from '../config/defaults.js';
import { hashString } from '../core/math.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function normalizeFormSvg(svgText) {
    const parsed = new DOMParser().parseFromString(String(svgText || ''), 'image/svg+xml');
    if (parsed.querySelector('parsererror')) return null;
    const svg = parsed.querySelector('svg');
    if (!svg) return null;
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.querySelectorAll('script, metadata, style, title, desc').forEach((node) => node.remove());
    svg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline').forEach((node) => {
        node.removeAttribute('class');
        node.removeAttribute('style');
        node.removeAttribute('opacity');
        node.removeAttribute('fill-opacity');
        node.removeAttribute('stroke');
        node.removeAttribute('stroke-width');
        node.setAttribute('fill', '#000');
    });
    return new XMLSerializer().serializeToString(svg);
}

function imageFromUrl(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
    });
}

function readFile(file, method) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(`Could not read ${file.name || 'this file'}.`));
        reader[method](file);
    });
}

export class AssetController {
    constructor({ ditherEngine, formsEngine, getApp }) {
        this.ditherEngine = ditherEngine;
        this.formsEngine = formsEngine;
        this.getApp = getApp;
        this.imageLabel = 'default-image.avif';
        this.formLabel = 'default-form.svg';
        this.formPromise = null;
        this.formVersion = 0;
    }

    syncLabels() {
        const imageStatus = document.getElementById('imageStatus');
        if (imageStatus) imageStatus.textContent = this.imageLabel;
        const formStatus = document.getElementById('formStatus');
        if (formStatus) formStatus.textContent = this.formLabel;
    }

    async loadImageUrl(url, label = 'default-image.avif') {
        const image = await imageFromUrl(url);
        this.imageLabel = label;
        this.ditherEngine.setImage(image, `${label}:${image.naturalWidth}x${image.naturalHeight}`);
        this.syncLabels();
        this.getApp()?.renderNow();
    }

    async loadImageFile(file) {
        if (!file) return;
        await this.loadImageUrl(String(await readFile(file, 'readAsDataURL')), file.name);
    }

    async loadFormText(svgText, label = 'default-form.svg') {
        const normalized = normalizeFormSvg(svgText);
        if (!normalized) throw new Error('Could not read this SVG.');
        const formKey = `svg:${hashString(normalized)}`;
        if (this.formsEngine.formImage && this.formsEngine.formKey === formKey) {
            this.formLabel = label;
            this.syncLabels();
            this.getApp()?.renderNow();
            return;
        }
        const version = ++this.formVersion;
        const blobUrl = URL.createObjectURL(new Blob([normalized], { type: 'image/svg+xml' }));
        try {
            const image = await imageFromUrl(blobUrl);
            if (version !== this.formVersion) return;
            this.formLabel = label;
            this.formsEngine.setFormImage(image, formKey);
            this.syncLabels();
            this.getApp()?.renderNow();
        } finally {
            URL.revokeObjectURL(blobUrl);
        }
    }

    async loadFormUrl(url, label = 'default-form.svg') {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not load ${url}`);
        await this.loadFormText(await response.text(), label);
    }

    async loadFormFile(file) {
        if (!file) return;
        await this.loadFormText(String(await readFile(file, 'readAsText')), file.name);
    }

    loadDefaultImage() {
        return this.loadImageUrl(DEFAULT_IMAGE_URL, 'default-image.avif').catch((error) => this.showError('Image', error));
    }

    ensureDefaultForm() {
        if (!this.formPromise) {
            this.formPromise = this.loadFormUrl(DEFAULT_FORM_URL, 'default-form.svg')
                .catch((error) => {
                    this.formPromise = null;
                    this.showError('SVG form', error);
                });
        }
        return this.formPromise;
    }

    showError(title, error) {
        console.error(error);
        this.getApp()?.dialog?.alert({
            title,
            text: title === 'SVG form'
                ? 'Could not load this SVG. Try a file with a filled vector shape.'
                : 'Could not load this image.'
        });
    }
}
