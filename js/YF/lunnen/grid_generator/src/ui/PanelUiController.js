const TEXT_STYLE_SECTIONS = [
    ['headline', 'headlineHeader', 'headlineContent'],
    ['text', 'textHeader', 'textContent'],
    ['caption', 'captionHeader', 'captionContent'],
    ['lunnenDisplay', 'lunnenDisplayHeader', 'lunnenDisplayContent']
];

const FONT_WEIGHT_SELECTS = [
    ['headlineStyleDropdown', 'headlineFontWeight'],
    ['textStyleDropdown', 'textFontWeight'],
    ['captionStyleDropdown', 'captionFontWeight']
];

export class PanelUiController {
    constructor(host, documentRef = document, windowRef = window) {
        this.host = host;
        this.document = documentRef;
        this.window = windowRef;
        this.textStylesState = Object.fromEntries(
            TEXT_STYLE_SECTIONS.map(([style]) => [style, false])
        );
    }

    bindPanelCollapse() {
        this.document.querySelectorAll('.collapse-icon').forEach(icon => {
            const panel = icon.closest('.controls-panel');
            const header = icon.closest('.panel-header');
            const content = panel?.querySelector('.panel-content');
            if (!panel || !header || !content) return;

            const initiallyCollapsed = panel.classList.contains('panel-collapsed');
            this.syncCollapseIcon(icon, initiallyCollapsed);

            const bottomAnchored = panel.classList.contains('elements-navigator') ||
                panel.classList.contains('controls-panel-text');
            const textPanel = panel.classList.contains('controls-panel-text');
            if (bottomAnchored && !panel.dataset.originalTop) {
                panel.dataset.originalTop = panel.getBoundingClientRect().top;
            }

            const toggle = event => {
                event.stopPropagation();
                const collapsed = panel.classList.contains('panel-collapsed');

                if (collapsed) {
                    panel.classList.remove('panel-collapsed');
                    this.syncCollapseIcon(icon, false);
                    if (textPanel) this.restoreTextStylesState();
                } else {
                    if (textPanel) this.saveTextStylesState();
                    if (bottomAnchored) {
                        panel.style.top = `${panel.getBoundingClientRect().top}px`;
                        panel.style.bottom = 'auto';
                    }
                    panel.classList.add('panel-collapsed');
                    this.syncCollapseIcon(icon, true);
                }
                this.updatePanelParams();
            };

            icon.addEventListener('click', toggle);
            icon.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                toggle(event);
            });
        });
    }

    syncCollapseIcon(icon, collapsed) {
        icon.classList.toggle('collapsed', collapsed);
        icon.setAttribute('aria-expanded', String(!collapsed));
        icon.setAttribute('aria-label', collapsed ? 'Expand panel' : 'Collapse panel');
    }

    saveTextStylesState() {
        TEXT_STYLE_SECTIONS.forEach(([style, headerId]) => {
            const toggle = this.document.querySelector(`#${headerId} .collapse-toggle`);
            if (toggle) {
                this.textStylesState[style] = toggle.getAttribute('aria-expanded') === 'true';
            }
        });
    }

    restoreTextStylesState() {
        TEXT_STYLE_SECTIONS.forEach(([style, headerId, contentId]) => {
            const toggle = this.document.querySelector(`#${headerId} .collapse-toggle`);
            const content = this.document.getElementById(contentId);
            if (!toggle || !content) return;

            const expanded = this.textStylesState[style];
            toggle.setAttribute('aria-expanded', String(expanded));
            content.classList.toggle('collapsed', !expanded);
        });
    }

    updatePanelParams() {
        const settings = this.host.settingsModule;
        this.setText(
            'gridParams',
            `Mod ${settings.get('gridModule').toFixed(2)}  •  Col ${settings.get('columnCount')}  •  Row ${settings.get('rowCount')}`
        );
        this.setText(
            'dimensionsParams',
            `${Math.round(settings.get('frontWidth'))}\u2009×\u2009${Math.round(settings.get('frontHeight'))}\u2009×\u2009${Math.round(settings.get('thickness'))} mm`
        );
        this.setText(
            'objectsParams',
            `Txt ${this.host.objectDocument.textBlocks.length}  •  Obj ${this.host.objectDocument.graphicsBlocks.length}`
        );
        this.setText(
            'textStylesParams',
            `${this.getTextStylesCount()} styles`
        );
    }

    setText(elementId, text) {
        const element = this.document.getElementById(elementId);
        if (element) element.textContent = text;
    }

    getTextStylesCount() {
        return new Set(
            this.host.objectDocument.textBlocks.map(block => block.styleRef).filter(Boolean)
        ).size;
    }

    bindCollapsibleSections() {
        this.document.querySelectorAll('.collapsible-header').forEach(header => {
            const toggle = header.querySelector('.collapse-toggle');
            const content = this.document.getElementById(header.id.replace('Header', 'Content'));
            if (!toggle || !content) return;

            header.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const expanded = toggle.getAttribute('aria-expanded') !== 'true';
                toggle.setAttribute('aria-expanded', String(expanded));
                content.classList.toggle('collapsed', !expanded);
            });
            header.addEventListener('mousedown', event => event.stopPropagation());
        });
    }

    bindDropdowns() {
        this.document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
            const dropdown = this.document.getElementById(toggle.getAttribute('data-target'));
            const container = toggle.closest('.value-input-with-dropdown');
            const input = container?.querySelector('.value-display');
            if (!dropdown || !input) return;
            const sliderId = input.id.replace('Value', 'Slider');

            toggle.addEventListener('click', event => {
                event.stopPropagation();
                this.document.querySelectorAll('.dropdown-menu.active').forEach(menu => {
                    if (menu !== dropdown) menu.classList.remove('active');
                });
                dropdown.classList.toggle('active');
                this.updateDropdownSelection(dropdown, input.value);
            });

            dropdown.querySelectorAll('.dropdown-item').forEach(item => {
                item.addEventListener('click', event => {
                    event.stopPropagation();
                    this.host.historyManager.beginAction(
                        `select ${sliderId} dropdown`,
                        this.host.getStateSnapshot()
                    );
                    this.host.sliderController.setValue(
                        sliderId,
                        Number.parseFloat(item.getAttribute('data-value')),
                        true
                    );
                    dropdown.classList.remove('active');
                    this.host.historyManager.commitAction(this.host.getStateSnapshot());
                });
            });
        });

        this.document.addEventListener('click', event => {
            if (event.target.closest('.value-input-with-dropdown')) return;
            this.document.querySelectorAll('.dropdown-menu.active').forEach(menu => {
                menu.classList.remove('active');
            });
        });

        this.syncFontWeights();
    }

    updateDropdownSelection(dropdown, currentValue) {
        const value = Number.parseFloat(currentValue);
        dropdown.querySelectorAll('.dropdown-item').forEach(item => {
            const itemValue = Number.parseFloat(item.getAttribute('data-value'));
            item.classList.toggle('selected', Math.abs(itemValue - value) < 0.01);
        });
    }

    syncFontWeights(settings = this.host.settingsModule.getAll()) {
        FONT_WEIGHT_SELECTS.forEach(([elementId, setting]) => {
            const select = this.document.getElementById(elementId);
            if (select && settings[setting] !== undefined) {
                select.value = String(settings[setting]);
            }
        });
    }
}
