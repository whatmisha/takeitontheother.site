import { ASSETS, variantsFor } from './assets.js';
import { letterTextureUsage } from './letter-textures.js';

export const categoryName = category => (category || 'Object').replace(/[-_]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const objectNames = { blobs: 'Blob', crystals: 'Crystal', prism: 'Prism', sparky: 'Sparky', spheres: 'Sphere', sticks: 'Stick' };
export const layerName = item => item.kind === 'ground' ? 'Surface' : item.kind === 'letter' ? item.letter : objectNames[ASSETS[item.asset].category] || categoryName(ASSETS[item.asset].category);

export class VariantPicker {
    constructor(choose, signal, getItems = () => []) {
        this.choose = choose;
        this.getItems = getItems;
        this.dialog = document.getElementById('variantDialog');
        this.grid = document.getElementById('variantGrid');
        this.category = document.getElementById('variantCategory');
        this.category.addEventListener('change', () => this.render(), { signal });
        document.getElementById('closeVariantsBtn').addEventListener('click', () => this.dialog.close(), { signal });
        this.grid.addEventListener('click', event => {
            const button = event.target.closest('[data-asset]');
            if (!button) return;
            this.dialog.close(); this.choose(this.item.id, button.dataset.asset);
        }, { signal });
        this.dialog.addEventListener('click', event => { if (event.target === this.dialog) this.dialog.close(); }, { signal });
    }

    open(item) {
        if (!item) return;
        this.item = { ...item };
        this.choices = variantsFor(item);
        document.getElementById('variantDialogTitle').textContent = layerName(item) + ' alternates';
        this.category.replaceChildren(new Option('All objects', ''));
        for (const category of [...new Set(this.choices.map(id => ASSETS[id].category))].filter(Boolean).sort()) this.category.add(new Option(categoryName(category), category));
        this.category.closest('label').hidden = item.kind !== 'form';
        this.category.value = '';
        this.render(); this.dialog.showModal();
        const current = [...this.grid.children].find(button => button.dataset.asset === item.asset);
        current?.focus({ preventScroll: true }); current?.scrollIntoView({ block: 'nearest' });
    }

    render() {
        const usage = letterTextureUsage(this.getItems(), { excludeId: this.item.id });
        this.grid.replaceChildren(...this.choices.flatMap((id, index) => {
            const asset = ASSETS[id];
            if (this.category.value && asset.category !== this.category.value) return [];
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'variant-option'; button.dataset.asset = id;
            button.setAttribute('aria-label', (this.item.kind === 'letter' ? this.item.letter : this.item.kind === 'ground' ? 'Surface' : categoryName(asset.category)) + ' variant ' + (index + 1));
            button.setAttribute('aria-pressed', String(id === this.item.asset));
            button.title = button.getAttribute('aria-label');
            const image = document.createElement('img'); image.src = asset.preview || asset.src; image.alt = ''; image.loading = 'lazy'; image.draggable = false;
            button.append(image);
            if (this.item.kind === 'letter') {
                const users = asset.textureId ? usage.get(asset.textureId) || [] : [];
                button.title += asset.textureId ? '\nTexture: ' + asset.textureId : '\nTexture not classified';
                if (users.length) button.title += '\nUsed by: ' + users.map(item => `${item.letter} (${item.index + 1})${item.pinned ? ', pinned' : ''}`).join('; ');
                if (users.length || !asset.textureId) {
                    const badge = document.createElement('span'); badge.className = 'variant-texture-badge';
                    badge.textContent = asset.textureId ? 'Used ' + users.length : '?';
                    badge.setAttribute('aria-hidden', 'true'); button.append(badge);
                }
                button.setAttribute('aria-label', button.title.replace(/\n/g, '. '));
            }
            return [button];
        }));
    }
}
