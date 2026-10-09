import { ASSETS, variantsFor } from './assets.js';

export const categoryName = category => (category || 'Object').replace(/[-_]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
export const layerName = item => item.kind === 'ground' ? 'Ground' : item.kind === 'letter' ? 'Letter ' + item.letter + ' ' + (item.index + 1) : categoryName(ASSETS[item.asset].category) + ' ' + (item.index + 1);

export class VariantPicker {
    constructor(choose, signal) {
        this.choose = choose;
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
        document.getElementById('variantDialogTitle').textContent = layerName(item) + ' variants';
        this.category.replaceChildren(new Option('All objects', ''));
        for (const category of [...new Set(this.choices.map(id => ASSETS[id].category))].filter(Boolean).sort()) this.category.add(new Option(categoryName(category), category));
        this.category.closest('label').hidden = item.kind !== 'form';
        this.category.value = '';
        this.render(); this.dialog.showModal();
        const current = [...this.grid.children].find(button => button.dataset.asset === item.asset);
        current?.focus({ preventScroll: true }); current?.scrollIntoView({ block: 'nearest' });
    }

    render() {
        this.grid.replaceChildren(...this.choices.flatMap((id, index) => {
            const asset = ASSETS[id];
            if (this.category.value && asset.category !== this.category.value) return [];
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'variant-option'; button.dataset.asset = id;
            button.setAttribute('aria-label', (this.item.kind === 'letter' ? this.item.letter : categoryName(asset.category)) + ' variant ' + (index + 1));
            button.setAttribute('aria-pressed', String(id === this.item.asset));
            button.title = button.getAttribute('aria-label');
            const image = document.createElement('img'); image.src = asset.preview || asset.src; image.alt = ''; image.loading = 'lazy'; image.draggable = false;
            button.append(image); return [button];
        }));
    }
}
