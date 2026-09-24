import { PANEL_NAMES as FACE_NAMES, CONSTRUCTION_NAMES, constructionType, panelNames } from '../packaging/PackagingModel.js';

export class PackagingPreviewController {
    constructor({ getModel, buildArtwork, editSurface, onSelectFace = () => {} }) {
        this.getModel = getModel;
        this.buildArtwork = buildArtwork;
        this.editSurface = editSurface;
        this.onSelectFace = onSelectFace;
        this.mode = '2d';
        this.selectedFace = null;
        this.revision = 0;
        this.fold = 1;
        this.disposed = false;
        this.section = document.getElementById('packagingPreview');
        this.viewport = document.getElementById('previewViewport');
        this.status = document.getElementById('previewStatus');
        this.abort = new AbortController();
        const listen = (element, event, action) => element.addEventListener(event, action, { signal: this.abort.signal });
        this.modeInputs = [...document.querySelectorAll('[data-workspace-mode]')];
        this.modeInputs.forEach(input => listen(input, 'change', () => { if (input.checked) this.setMode(input.dataset.workspaceMode); }));
        document.querySelectorAll('[data-camera-view]').forEach(button => listen(button, 'click', () => {
            const view = button.dataset.cameraView;
            if (view === 'inside' && constructionType(this.getModel()) !== 'lid') {
                this.setOpening(1);
                this.scene?.setView('iso');
            } else this.scene?.setView(view);
            this.selectFace(FACE_NAMES[view] ? view : null);
        }));
        this.openInput = document.getElementById('previewOpen');
        listen(this.openInput, 'input', () => this.setOpening(Number(this.openInput.value) / 100));
        this.foldInput = document.getElementById('previewFold');
        listen(this.foldInput, 'input', () => this.setFold(Number(this.foldInput.value) / 100));
        listen(document.getElementById('previewUnfold'), 'click', () => this.animateFold(0));
        listen(document.getElementById('previewFoldClosed'), 'click', () => this.animateFold(1));
        listen(document.getElementById('previewEditFace'), 'click', () => {
            if (!this.selectedFace) return;
            this.setMode('2d');
            this.editSurface(this.selectedFace);
        });
    }

    async setMode(mode) {
        if (this.disposed) return;
        this.mode = mode;
        document.body.dataset.workspaceView = mode;
        this.section.hidden = mode !== '3d';
        document.getElementById('canvasContainer').inert = mode === '3d';
        this.modeInputs.forEach(input => { input.checked = input.dataset.workspaceMode === mode; });
        if (this.scene) this.scene.visible = mode === '3d';
        if (mode !== '3d') { cancelAnimationFrame(this.animation); return; }
        try {
            if (!this.scene) {
                this.status.textContent = 'Preparing 3D preview…';
                if (!this.scenePromise) this.scenePromise = import('./LidPreviewScene.js').then(({ LidPreviewScene }) => {
                    if (this.disposed) return;
                    this.scene = new LidPreviewScene(this.viewport, {
                        onSelect: id => this.selectFace(id),
                        onError: message => {
                            this.status.textContent = message;
                            this.scene?.dispose();
                            this.scene = null;
                            this.scenePromise = null;
                        }
                    });
                });
                await this.scenePromise;
            }
            if (this.disposed || this.mode !== '3d') return;
            this.scene.visible = true;
            this.scene.resize();
            this.scene.setModel(this.getModel());
            this.scene.setFold(this.fold);
            this.scene.select(this.selectedFace);
            this.invalidate();
        } catch (error) {
            this.scenePromise = null;
            this.status.textContent = '3D could not start. Check that WebGL is enabled in your browser. You can continue in 2D.';
            console.error('3D preview:', error);
        }
    }

    invalidate() {
        this.revision++;
        if (this.mode !== '3d' || !this.scene || this.disposed) return;
        const model = this.getModel();
        this.scene.setModel(model);
        if (this.selectedFace && !model.visibleSurfaces.includes(this.selectedFace)) this.selectFace(null);
        document.getElementById('previewDimensions').textContent = `${model.frontWidth} × ${model.frontHeight} × ${model.thickness} mm`;
        document.querySelector('.preview-heading > span').textContent = CONSTRUCTION_NAMES[constructionType(model)];
        const isLid = constructionType(model) === 'lid';
        document.getElementById('previewOpenRow').hidden = isLid;
        this.section.classList.toggle('has-opening', !isLid);
        document.querySelectorAll('[data-camera-view]').forEach(button => {
            button.disabled = Boolean(FACE_NAMES[button.dataset.cameraView] && !model.visibleSurfaces.includes(button.dataset.cameraView));
        });
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.refreshArtwork(), 120);
    }

    async refreshArtwork() {
        if (this.disposed || this.mode !== '3d' || !this.scene || this.rendering) return;
        const revision = this.revision;
        this.rendering = true;
        this.status.textContent = 'Updating artwork…';
        try {
            const canvas = await this.buildArtwork();
            if (!this.disposed && this.scene && revision === this.revision) {
                this.scene.setTexture(canvas);
                this.status.textContent = '';
            }
        } catch (error) {
            if (!this.disposed) this.status.textContent = 'Artwork preview could not update. Switch to 2D and reopen 3D to retry.';
            console.error('3D artwork:', error);
        } finally {
            this.rendering = false;
            if (!this.disposed && revision !== this.revision) void this.refreshArtwork();
        }
    }

    setOpening(value) {
        this.openInput.value = Math.round(value * 100);
        document.getElementById('previewOpenValue').value = `${Math.round(value * 100)}%`;
        this.scene?.setOpening(value);
    }

    setFold(value) {
        cancelAnimationFrame(this.animation);
        this.fold = value;
        this.foldInput.value = Math.round(value * 100);
        document.getElementById('previewFoldValue').value = `${Math.round(value * 100)}%`;
        this.foldInput.setAttribute('aria-valuetext', `${Math.round(value * 100)}% folded`);
        this.scene?.setFold(value);
    }

    animateFold(target) {
        cancelAnimationFrame(this.animation);
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) { this.setFold(target); return; }
        const from = this.fold, start = performance.now();
        const tick = now => {
            const progress = Math.min(1, (now - start) / 600);
            this.setFold(from + (target - from) * (progress * progress * (3 - 2 * progress)));
            if (progress < 1 && !this.disposed && this.mode === '3d') this.animation = requestAnimationFrame(tick);
            else if (!this.disposed && this.mode === '3d') this.scene?.setView('iso');
        };
        this.animation = requestAnimationFrame(tick);
    }

    selectFace(id, { notify = true } = {}) {
        this.selectedFace = id;
        if (notify) this.onSelectFace(id);
        this.scene?.select(id);
        document.getElementById('previewSelectedFace').textContent = id ? `${panelNames(this.getModel())[id]} selected` : 'Select a face to edit its layout';
        document.getElementById('previewEditFace').hidden = !id;
        document.querySelectorAll('[data-camera-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.cameraView === id)));
    }

    dispose() {
        this.disposed = true;
        this.revision++;
        clearTimeout(this.timer);
        cancelAnimationFrame(this.animation);
        this.abort.abort();
        this.scene?.dispose();
        delete document.body.dataset.workspaceView;
    }
}
