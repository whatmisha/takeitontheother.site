const TOOL_NAMES = Object.freeze({
    sparky: 'Sparky',
    grid_generator: 'Pizza Boxer',
    label_generator: 'Sticky Fingers',
    keyboarder: 'Keyboarder',
    wordplayer: 'Wordplayer',
    dither: 'Dither',
    pulsar_coder: 'Pulsar Coder',
    wander_bender: 'Wander Bender'
});

const value = (documentRef, id, fallback = '—') => {
    const node = documentRef.getElementById(id);
    const raw = node?.value ?? node?.textContent;
    return String(raw ?? '').trim() || fallback;
};

const checkedValue = (documentRef, name, fallback = '—') => {
    const node = documentRef.querySelector(`input[name="${name}"]:checked`);
    return String(node?.value || fallback);
};

const titleCase = text => String(text || '').replace(/(^|[-_ ])([a-z])/gu, (_, gap, char) => `${gap}${char.toUpperCase()}`);

function summaryConfig(tool) {
    const configs = {
        sparky: {
            shapePanel: d => `${value(d, 'rayCountValue')} · ${value(d, 'rayLengthValue')}×${value(d, 'rayWidthValue')}`,
            focusPanel: d => {
                const mode = checkedValue(d, 'focusMode');
                if (mode !== 'manual') return titleCase(mode);
                return `Static · ${d.getElementById('followCursor')?.checked ? 'Follow' : 'Fixed'}`;
            },
            eyesPanel: d => `Size ${value(d, 'eyeSizeValue')} · Cute ${value(d, 'cuteValue')}`,
            colorsPanel: d => `${value(d, 'headColorHex')} · ${value(d, 'eyeColorHex')} · ${value(d, 'backgroundColorHex')}`
        },
        grid_generator: {
            surfacePanel: d => `${titleCase(checkedValue(d, 'surfaceSettings'))} · ${d.getElementById('surfaceVisibleToggle')?.checked ? 'On' : 'Off'}`
        },
        label_generator: {
            dataImportPanel: d => {
                const rows = d.querySelectorAll('#dataRowsList > *').length;
                const status = value(d, 'dataStatus', '').replace(/\s+/gu, ' ');
                return rows ? `${rows} rows${status ? ` · ${status}` : ''}` : status || 'Not loaded';
            },
            barcodePanel: d => `${String(value(d, 'barcodeType')).toUpperCase()} · ${value(d, 'barcodeWidth')}×${value(d, 'barcodeHeight')}`
        },
        keyboarder: {
            gridPanel: () => '110 · 412.5×116',
            typePanel: d => {
                const font = d.getElementById('fontSelect')?.selectedOptions?.[0]?.textContent?.trim() || 'Reference';
                const styles = d.querySelectorAll('#textStyleList .text-style-row').length;
                return `${font}${styles ? ` · ${styles} styles` : ''}`;
            },
            layersPanel: d => {
                const labels = [...d.querySelectorAll('#layersPanel input[type="checkbox"]:checked')]
                    .map(input => input.closest('label')?.textContent?.trim()).filter(Boolean);
                return labels.length > 3 ? `${labels.slice(0, 3).join(' · ')} +${labels.length - 3}` : labels.join(' · ') || 'None';
            },
            legendPanel: d => value(d, 'legendKeyWidthInput', 'No key'),
            colorsPanel: d => `${value(d, 'capColorHex')} · ${value(d, 'inkColorHex')} · ${value(d, 'bgColorHex')}`
        },
        wordplayer: {
            textPanel: d => {
                const mode = titleCase(checkedValue(d, 'mode', 'dither'));
                const preset = d.querySelector('#presetDropdownToggle .preset-dropdown-text')?.textContent?.trim();
                return preset && preset !== 'Presets' ? `${mode} · ${preset}` : `${mode} · ${value(d, 'widthValue')}×${value(d, 'heightValue')}`;
            },
            pixelsPanel: d => `W ${value(d, 'weightMinValue')}–${value(d, 'weightMaxValue')} · S ${value(d, 'sizeMinValue')}–${value(d, 'sizeMaxValue')}`,
            ditherPanel: d => `C ${value(d, 'contrastValue')} · ${value(d, 'blackPointValue')}–${value(d, 'whitePointValue')}`,
            formsPanel: d => `A ${value(d, 'formAttractionValue')} · F ${value(d, 'formFrictionValue')} · G ${value(d, 'formGravityValue')}`
        },
        dither: {},
        pulsar_coder: {
            mainPanel: d => `${value(d, 'rayCountValue', '14')} · ${value(d, 'charCounter', '22 chars').replace(' characters', ' chars')}`,
            encodingPanel: d => `${checkedValue(d, 'eccMode') === 'none' ? 'No ECC' : titleCase(checkedValue(d, 'eccMode'))} · ${value(d, 'tickShortValue', '4')}/${value(d, 'tickLongValue', '12')}`,
            visualPanel: d => `${value(d, 'marginValue', '50')} margin · ${value(d, 'preambleLengthValue', '16')} preamble`
        },
        wander_bender: {
            controlsPanel: d => `${titleCase(checkedValue(d, 'mode'))} · ${value(d, 'raysValue')} rays · ${value(d, 'lengthValue')}×${value(d, 'widthValue')}`
        }
    };
    return configs[tool] || {};
}

export class UnifiedUiController {
    constructor({ ownerDocument = globalThis.document, ownerWindow = globalThis.window } = {}) {
        this.document = ownerDocument;
        this.window = ownerWindow;
        this.tool = '';
        this.expandedPanels = null;
        this.exportTimers = new WeakMap();
        this.bound = false;
        this.handleClick = this.handleClick.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleMouseover = this.handleMouseover.bind(this);
        this.handleMouseout = this.handleMouseout.bind(this);
        this.handleZoomChange = this.handleZoomChange.bind(this);
        this.handleMutation = this.handleMutation.bind(this);
        this.handleSummaryChange = this.handleSummaryChange.bind(this);
    }

    init() {
        if (!this.document || this.bound) return this;
        this.tool = this.detectTool();
        this.sync();
        this.document.addEventListener('click', this.handleClick, true);
        this.document.addEventListener('keydown', this.handleKeydown, true);
        this.document.addEventListener('mouseover', this.handleMouseover, true);
        this.document.addEventListener('mouseout', this.handleMouseout, true);
        this.document.addEventListener('zoomchange', this.handleZoomChange, true);
        this.document.addEventListener('input', this.handleSummaryChange, true);
        this.document.addEventListener('change', this.handleSummaryChange, true);
        this.observer = new this.window.MutationObserver(this.handleMutation);
        this.observer.observe(this.document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'aria-busy']
        });
        this.summaryInterval = this.window.setInterval(() => this.refreshSummaries(), 500);
        this.bound = true;
        return this;
    }

    destroy() {
        if (!this.bound) return;
        this.document.removeEventListener('click', this.handleClick, true);
        this.document.removeEventListener('keydown', this.handleKeydown, true);
        this.document.removeEventListener('mouseover', this.handleMouseover, true);
        this.document.removeEventListener('mouseout', this.handleMouseout, true);
        this.document.removeEventListener('zoomchange', this.handleZoomChange, true);
        this.document.removeEventListener('input', this.handleSummaryChange, true);
        this.document.removeEventListener('change', this.handleSummaryChange, true);
        this.observer?.disconnect();
        this.window.clearInterval?.(this.summaryInterval);
        this.bound = false;
    }

    detectTool() {
        const path = String(this.window?.location?.pathname || '');
        return Object.keys(TOOL_NAMES).find(name => path.includes(`/${name}/`)) || '';
    }

    sync() {
        this.syncZoomHover();
        this.ensureShortcutHelp();
        this.ensureSummaries();
        this.refreshSummaries();
        this.syncExportStates();
    }

    handleMutation() {
        this.sync();
    }

    handleSummaryChange() {
        this.refreshSummaries();
    }

    syncZoomHover() {
        const indicator = this.document.querySelector('.zoom-indicator');
        if (!indicator || indicator.dataset.uiZoomHovered !== 'true') return;
        const current = indicator.textContent?.trim();
        if (current && current !== 'Fit') indicator.dataset.uiZoomValue = current;
        if (current !== 'Fit') indicator.textContent = 'Fit';
    }

    helpButton() {
        return this.document.querySelector('[data-shortcut-help-button]');
    }

    helpPopup() {
        return this.document.querySelector('[data-shortcut-help-popup]');
    }

    ensureShortcutHelp() {
        const dock = this.document.querySelector('.action-dock');
        if (!dock) return;
        let utility = dock.querySelector('.action-dock__slot--utility');
        if (!utility) {
            utility = this.document.createElement('div');
            utility.className = 'action-dock__slot action-dock__slot--utility';
            dock.prepend(utility);
        }
        let button = dock.querySelector('#shortcutHelpBtn, #aboutBtn, #introHelpBtn, #helpButton, [data-shortcut-help-button]');
        if (!button) {
            button = this.document.createElement('button');
            button.type = 'button';
            button.className = 'btn-fixed btn-intro-help';
            button.textContent = '?';
            utility.prepend(button);
        }
        let root = button.closest('.ui-shortcut-help, .sparky-shortcut-help');
        if (!root) {
            root = this.document.createElement('div');
            utility.insertBefore(root, button);
            root.append(button);
        }
        root.classList.add('ui-shortcut-help');
        button.dataset.shortcutHelpButton = 'true';
        button.setAttribute('aria-label', 'Keyboard shortcuts');
        button.setAttribute('aria-haspopup', 'dialog');
        if (!button.hasAttribute('aria-expanded')) button.setAttribute('aria-expanded', 'false');

        let popup = root.querySelector('[data-shortcut-help-popup], #shortcutHelpPopup');
        if (!popup) {
            popup = this.document.createElement('div');
            popup.hidden = true;
            root.append(popup);
        }
        popup.dataset.shortcutHelpPopup = 'true';
        popup.className = 'ui-shortcut-help__popup';
        popup.setAttribute('role', 'dialog');
        popup.setAttribute('aria-label', `${TOOL_NAMES[this.tool] || 'Tool'} keyboard shortcuts`);
        const rows = this.shortcutRows();
        const content = `<dl class="ui-shortcut-help__list">${rows.map(([label, keys]) => `<dt>${label}</dt><dd>${keys}</dd>`).join('')}</dl>`;
        if (popup.innerHTML !== content) popup.innerHTML = content;
    }

    shortcutRows() {
        const rows = [];
        if (this.tool === 'sparky') {
            rows.push(['Play / pause', 'Space'], ['Guides', 'G']);
        }
        if (this.document.querySelector('[data-action-dock-primary-export]')) rows.push(['Export', '⌘E']);
        if (this.document.querySelector('[data-action-dock-json-export]')) rows.push(['JSON export', '⌘J']);
        if (this.document.querySelector('[data-action-dock-json-import]')) rows.push(['JSON import', '⇧⌘J']);
        if (this.document.querySelector('[data-action-dock-extra]')) rows.push(['JSON actions', 'J']);
        if (this.mainFileTrigger()) rows.push(['Open file', '⌘O']);
        if (this.document.querySelector('#undoBtn, [data-history-undo]') || this.tool === 'sparky') rows.push(['Undo / redo', '⌘Z / ⇧⌘Z']);
        if (this.eligiblePanels().length) rows.push(['Collapse panels', '⌘\\']);
        rows.push(['Shortcuts', '?']);
        return rows;
    }

    setHelpOpen(open) {
        const button = this.helpButton();
        const popup = this.helpPopup();
        if (!button || !popup) return false;
        popup.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
        return true;
    }

    mainFileTrigger() {
        const selectors = {
            dither: '#uploadBtnFixed',
            wordplayer: '#imageLoadBtn:not([hidden]), #formLoadBtn:not([hidden])',
            keyboarder: '#newLayoutBtn'
        };
        const selector = selectors[this.tool];
        if (!selector) return null;
        return [...this.document.querySelectorAll(selector)].find(node => (
            this.window?.getComputedStyle?.(node).display !== 'none'
            && (typeof node.getClientRects !== 'function' || node.getClientRects().length > 0)
        )) || null;
    }

    eligiblePanels() {
        return [...this.document.querySelectorAll('.controls-panel')].filter(panel => {
            if (panel.matches('.paragraph-settings-panel, #paragraphPanel, #graphicsPanel')) return false;
            if (!panel.querySelector(':scope > .panel-header .collapse-icon')) return false;
            return this.window?.getComputedStyle?.(panel).display !== 'none';
        });
    }

    setPanelCollapsed(panel, collapsed) {
        panel.classList.toggle('panel-collapsed', collapsed);
        const icon = panel.querySelector(':scope > .panel-header .collapse-icon');
        icon?.classList.toggle('collapsed', collapsed);
        icon?.setAttribute('aria-expanded', String(!collapsed));
        icon?.setAttribute('aria-label', collapsed ? 'Expand panel' : 'Collapse panel');
    }

    togglePanels() {
        if (this.expandedPanels !== null) {
            const panels = this.expandedPanels;
            this.expandedPanels = null;
            panels.forEach(panel => this.setPanelCollapsed(panel, false));
            return true;
        }
        const panels = this.eligiblePanels().filter(panel => !panel.classList.contains('panel-collapsed'));
        this.expandedPanels = panels;
        panels.forEach(panel => this.setPanelCollapsed(panel, true));
        return panels.length > 0;
    }

    ensureSummaries() {
        const config = summaryConfig(this.tool);
        Object.keys(config).forEach(panelId => {
            const panel = this.document.getElementById(panelId);
            const title = panel?.querySelector(':scope > .panel-header > span:first-child');
            if (!title || title.querySelector('.panel-params')) return;
            const summary = this.document.createElement('span');
            summary.className = 'panel-params upgrade-panel-summary';
            title.append(summary);
        });
    }

    compactSummary(summary, target) {
        const normalized = String(summary || '').replace(/\s+/gu, ' ').trim();
        const isOverflowing = Number(target?.clientWidth) > 0
            && Number(target?.scrollWidth) > Number(target?.clientWidth);
        if (!isOverflowing) return normalized;
        return normalized
            .replace(/\b(\d+(?:[.,]\d+)?)\s*(?:mm|keys?)\b/giu, '$1')
            .replace(/\bcharacters?\b/giu, 'chars')
            .replace(/\s*·\s*/gu, ' · ')
            .trim();
    }

    refreshSummaries() {
        const config = summaryConfig(this.tool);
        Object.entries(config).forEach(([panelId, provider]) => {
            const panel = this.document.getElementById(panelId);
            const target = panel?.querySelector(':scope > .panel-header .panel-params');
            if (!target) return;
            const fullSummary = String(provider(this.document) || '').trim();
            if (target.textContent !== fullSummary) target.textContent = fullSummary;
            const summary = this.compactSummary(fullSummary, target);
            if (target.textContent !== summary) target.textContent = summary;
            if (summary !== fullSummary) target.title = fullSummary;
            else target.removeAttribute?.('title');
        });
    }

    showExportFeedback(button) {
        if (!button || button.disabled) return;
        const timers = this.exportTimers.get(button) || [];
        timers.forEach(id => this.window.clearTimeout(id));
        button.dataset.exportFeedbackState = 'success';
        const clear = this.window.setTimeout(() => {
            delete button.dataset.exportFeedbackState;
            this.exportTimers.delete(button);
        }, 620);
        this.exportTimers.set(button, [clear]);
    }

    handleMouseover(event) {
        const indicator = event.target.closest?.('.zoom-indicator');
        if (!indicator || indicator.contains?.(event.relatedTarget)) return;
        if (indicator.textContent?.trim() !== 'Fit') {
            indicator.dataset.uiZoomValue = indicator.textContent?.trim() || '100%';
        }
        indicator.dataset.uiZoomHovered = 'true';
        indicator.textContent = 'Fit';
    }

    handleMouseout(event) {
        const indicator = event.target.closest?.('.zoom-indicator');
        if (!indicator || indicator.contains?.(event.relatedTarget)) return;
        delete indicator.dataset.uiZoomHovered;
        indicator.textContent = indicator.dataset.uiZoomValue || indicator.textContent || '100%';
    }

    handleZoomChange(event) {
        const indicator = this.document.querySelector('.zoom-indicator');
        const percent = Number(event.detail?.percent);
        if (!indicator || !Number.isFinite(percent)) return;
        indicator.dataset.uiZoomValue = `${Math.round(percent)}%`;
        if (indicator.dataset.uiZoomHovered !== 'true') return;
        const defer = this.window.queueMicrotask || (callback => Promise.resolve().then(callback));
        defer(() => {
            if (indicator.dataset.uiZoomHovered === 'true') indicator.textContent = 'Fit';
        });
    }

    exportButtons() {
        return [...this.document.querySelectorAll(
            '.action-dock button[data-action-dock-primary-export], '
            + '.action-dock button[data-action-dock-json-export], '
            + '.action-dock button[id^="export"], '
            + '.action-dock button[id^="generate"], '
            + '.action-dock button[id^="download"]'
        )];
    }

    syncExportStates() {
        this.exportButtons().forEach(button => {
            const busy = button.disabled || button.getAttribute('aria-busy') === 'true';
            const wasBusy = button.dataset.exportFeedbackObservedBusy === 'true';
            if (busy) {
                (this.exportTimers.get(button) || []).forEach(id => this.window.clearTimeout(id));
                this.exportTimers.delete(button);
                button.dataset.exportFeedbackObservedBusy = 'true';
                button.dataset.exportFeedbackState = 'working';
            } else if (wasBusy) {
                delete button.dataset.exportFeedbackObservedBusy;
                this.showExportFeedback(button);
            }
        });
    }

    handleClick(event) {
        const help = event.target.closest?.('[data-shortcut-help-button]');
        if (help) {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.setHelpOpen(help.getAttribute('aria-expanded') !== 'true');
            return;
        }
        if (!event.target.closest?.('[data-shortcut-help-popup]')) this.setHelpOpen(false);
        const exportButton = event.target.closest?.('.action-dock button');
        if (exportButton?.matches('[data-action-dock-primary-export], [data-action-dock-json-export], [id^="export"], [id^="generate"], [id^="download"]')) {
            this.showExportFeedback(exportButton);
        }
    }

    handleKeydown(event) {
        if (event.repeat) return;
        const key = String(event.key || '').toLowerCase();
        const command = event.metaKey || event.ctrlKey;
        if (command && !event.altKey && !event.shiftKey && key === '\\') {
            if (!this.togglePanels()) return;
        } else if (command && !event.altKey && !event.shiftKey && key === 'o') {
            const trigger = this.mainFileTrigger();
            if (!trigger) return;
            trigger.click();
        } else if (!command && !event.altKey && key === '?') {
            this.setHelpOpen(this.helpButton()?.getAttribute('aria-expanded') !== 'true');
        } else if (key === 'escape' && !this.helpPopup()?.hidden) {
            this.setHelpOpen(false);
            this.helpButton()?.focus?.();
        } else {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
    }
}

export function initUnifiedUi(options) {
    return new UnifiedUiController(options).init();
}
