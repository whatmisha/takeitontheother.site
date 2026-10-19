import { GlobalApp } from './GlobalApp.js';
import { PresetManager } from './core/presets.js';
import { PLANET_PRESETS, planetDefaults } from './core/planetPresets.js';
import { constrainSettings } from './geometry/globalGeometry.js';
import { buildPlanetScene, countryAtScreen } from './geometry/planetGeometry.js';
import { COUNTRY_BY_ID, searchCountries } from './geometry/planetGeography.js';
import { PanelManager } from './ui/PanelManager.js';

const SESSION_KEY = 'yfToolsPlanetSessionV1';
const cleanSelection = (settings) => constrainSettings({ ...planetDefaults(), ...settings, planetMode: true,
    selectedCountries: Array.isArray(settings?.selectedCountries) ? settings.selectedCountries.filter((id) => COUNTRY_BY_ID.has(id)) : [] });

export class PlanetApp extends GlobalApp {
    constructor() {
        super();
        const defaults = planetDefaults();
        this.presetManager = new PresetManager(defaults, {
            builtIns: PLANET_PRESETS, storageKey: 'yfToolsPlanetPresetsV1', defaultName: 'Planet'
        });
        this.settings = cleanSelection(defaults);
        this.history.reset(this.settings);
        const geographyPanels = new PanelManager(['planetPanel']);
        this.panels.panels.push(...geographyPanels.panels);
    }

    init() {
        super.init();
        this.bindCountryControls();
        return this;
    }

    sceneForSettings(settings, options = {}) {
        return buildPlanetScene(settings, options);
    }

    replaceSettings(settings, options) {
        super.replaceSettings(cleanSelection(settings), options);
    }

    loadSessionState() {
        try {
            const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
            if (!saved?.settings) return;
            this.settings = cleanSelection(saved.settings);
            const names = new Set([...this.presetManager.names(), 'Session', 'Shared', 'Untitled']);
            this.presetManager.currentName = names.has(saved.presetName) ? saved.presetName : 'Session';
            this.presetManager.dirty = Boolean(saved.dirty);
            this.history.reset(this.settings);
        } catch { /* Storage is optional. */ }
    }

    saveSessionState() {
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ settings: this.settings,
                presetName: this.presetManager.currentName, dirty: this.presetManager.dirty }));
        } catch { /* Storage is optional. */ }
    }

    loadSharedState() {
        super.loadSharedState();
        this.settings = cleanSelection(this.settings);
        this.history.reset(this.settings);
    }

    toggleCountry(id) {
        if (!COUNTRY_BY_ID.has(id)) return;
        const selected = new Set(this.settings.selectedCountries);
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        this.update({ selectedCountries: [...selected] });
        this.syncCountryUI();
    }

    pickCountry(point) {
        if (!point) return null;
        // A selected tiny country's representative may sit just outside its polygon.
        // Keep that visible point clickable, including when it falls in the ocean.
        let nearest = null;
        let distance = Infinity;
        this.scene?.elements.forEach((mark) => {
            if (!mark.frontPath || !mark.fallbackCountryIds?.length) return;
            const next = Math.hypot(point.x - mark.anchorX, point.y - mark.anchorY);
            if (next < Math.max(5, Math.min(16, mark.rx)) && next < distance) {
                nearest = COUNTRY_BY_ID.get(mark.fallbackCountryIds[0]);
                distance = next;
            }
        });
        return nearest || countryAtScreen(point.x, point.y, this.settings, this.rotationPreview?.offsets || {});
    }

    onSurfaceClick(point) {
        const country = this.pickCountry(point);
        if (country) this.toggleCountry(country.id);
    }

    bindCountryControls() {
        const search = document.getElementById('countrySearch');
        search.addEventListener('input', () => this.renderCountryResults());
        search.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                search.value = '';
                this.renderCountryResults();
                search.blur();
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                document.querySelector('#countryResults button')?.focus();
            } else if (event.key === 'Enter' && search.value.trim()) {
                event.preventDefault();
                const first = searchCountries(search.value)[0];
                if (first) this.toggleCountry(first.id);
            }
        });
        document.getElementById('clearCountries').addEventListener('click', () => {
            this.update({ selectedCountries: [] });
            this.syncCountryUI();
        });
        const tooltip = document.getElementById('countryTooltip');
        this.canvas.addEventListener('pointermove', (event) => {
            if (this.rotationDrag || this.zoom.drag || event.pointerType === 'touch') { tooltip.hidden = true; return; }
            const country = this.pickCountry(this.clientToArtboard(event.clientX, event.clientY));
            tooltip.hidden = !country;
            if (!country) return;
            tooltip.textContent = country.name;
            tooltip.style.left = `${Math.min(window.innerWidth - 180, event.clientX + 14)}px`;
            tooltip.style.top = `${Math.max(8, event.clientY - 30)}px`;
        });
        ['pointerleave', 'pointerdown'].forEach((type) => this.canvas.addEventListener(type, () => { tooltip.hidden = true; }));
    }

    syncControls() {
        super.syncControls();
        ['landGrowth', 'countryGrowth', 'landSoftness', 'countrySoftness'].forEach((key) => {
            document.getElementById(`${key}Value`).value = String(this.settings[key]);
        });
        this.syncCountryUI();
    }

    syncCountryUI() {
        const ids = this.settings.selectedCountries || [];
        document.getElementById('countrySelectionCount').textContent = ids.length ? `${ids.length} selected` : 'No countries selected';
        document.getElementById('clearCountries').disabled = ids.length === 0;
        const chips = document.getElementById('selectedCountries');
        chips.replaceChildren();
        ids.forEach((id) => {
            const country = COUNTRY_BY_ID.get(id);
            if (!country) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'country-chip';
            button.textContent = `${country.name} ×`;
            button.setAttribute('aria-label', `Remove ${country.name}`);
            button.addEventListener('click', () => this.toggleCountry(id));
            chips.appendChild(button);
        });
        const land = 1 + this.settings.landGrowth / 100;
        const group = land * (1 + this.settings.countryGrowth / 100);
        document.getElementById('planetScaleSummary').textContent = `Land ×${Number(land.toFixed(2))} · Selected ×${Number(group.toFixed(2))}`;
        this.renderCountryResults();
    }

    renderCountryResults() {
        const search = document.getElementById('countrySearch');
        const list = document.getElementById('countryResults');
        const focusedId = list.contains(document.activeElement) ? document.activeElement?.dataset.country : null;
        const scrollTop = list.scrollTop;
        list.replaceChildren();
        const selected = new Set(this.settings.selectedCountries);
        const countries = searchCountries(search.value);
        document.getElementById('countrySearchStatus').textContent = `${countries.length} countries`;
        if (!countries.length) {
            const message = document.createElement('p');
            message.className = 'country-empty';
            message.textContent = 'No matching countries';
            list.appendChild(message);
        }
        countries.forEach((country) => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'country-result';
            row.dataset.country = country.id;
            row.setAttribute('role', 'checkbox');
            row.setAttribute('aria-checked', String(selected.has(country.id)));
            row.textContent = country.name;
            const check = document.createElement('span');
            check.className = 'country-check';
            check.setAttribute('aria-hidden', 'true');
            check.textContent = selected.has(country.id) ? '✓' : '+';
            row.appendChild(check);
            row.addEventListener('click', () => this.toggleCountry(country.id));
            list.appendChild(row);
        });
        list.scrollTop = scrollTop;
        if (focusedId) list.querySelector(`[data-country="${focusedId}"]`)?.focus({ preventScroll: true });
    }
}
