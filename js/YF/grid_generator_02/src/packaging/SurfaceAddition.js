import { activePanelIds, constructionType, packagingNet, panelNames } from './PackagingModel.js';

/** The same available additions drive the panel and the net handles. */
export function surfaceAdditions(settings, isVisible) {
    const type = constructionType(settings), net = packagingNet(settings), names = panelNames(settings);
    const additions = activePanelIds(settings).filter(id => id !== 'front' && !isVisible(id)).map(id => ({
        id, name: names[id], restore: true, rect: net.panels[id],
        anchor: { x: net.panels[id].x + net.panels[id].width / 2, y: net.panels[id].y + net.panels[id].height / 2 }
    }));
    if (type === 'lid') {
        const edge = net.panels.top;
        additions.push({ id: 'base', name: names.base, type: 'box',
            rect: { x: edge.x, y: edge.y - settings.frontHeight, width: edge.width, height: settings.frontHeight },
            anchor: { x: edge.x + edge.width / 2, y: edge.y }, outside: -1 });
    } else if (type === 'box') {
        const edge = net.panels.front, height = Math.min(settings.flapDepth ?? 20, settings.thickness);
        additions.push({ id: 'flap', name: names.flap, type: 'tuck-box',
            rect: { x: edge.x, y: edge.y + edge.height, width: edge.width, height },
            anchor: { x: edge.x + edge.width / 2, y: edge.y + edge.height }, outside: 1 });
    }
    return additions;
}

export class SurfaceAdditionCommands {
    constructor({ settings, surfaceManager, begin, commit, changed, render, fit }) {
        Object.assign(this, { settings, surfaceManager, begin, commit, changed, render, fit });
    }
    available() { return surfaceAdditions(this.settings.getAll(), id => this.surfaceManager.isVisible(id)); }
    add(id) {
        const candidate = this.available().find(item => item.id === id);
        if (!candidate) return false;
        this.begin(`add ${candidate.name.toLowerCase()}`);
        if (candidate.type) this.settings.set('constructionType', candidate.type, true);
        this.surfaceManager.update(id, { visible: true });
        if (candidate.type === 'box') this.surfaceManager.update('top', { visible: true });
        this.surfaceManager.syncMasterVisibility();
        this.render();
        this.commit();
        this.changed();
        if (candidate.type) this.fit();
        return true;
    }
}
