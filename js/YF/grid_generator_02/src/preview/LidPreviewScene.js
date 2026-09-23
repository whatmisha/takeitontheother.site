import * as THREE from '../../vendor/three/three.module.js';
import { OrbitControls } from '../../vendor/three/OrbitControls.js';
import { createLidPanels, foldAngle, panelUV } from './LidGeometry.js';

const VIEWS = {
    iso: [1, 1.25, 1.5], front: [0, 1, 0.001], inside: [0, -1, 0.001],
    left: [-1, 0, 0], right: [1, 0, 0], top: [0, 0, -1], bottom: [0, 0, 1]
};

/** Disposable, on-demand WebGL view. It never writes to the design document. */
export class LidPreviewScene {
    constructor(container, { onSelect, onError }) {
        this.container = container;
        this.onSelect = onSelect;
        this.onError = onError;
        this.fold = 1;
        this.visible = true;
        this.disposed = false;
        this.panels = [];
        this.selected = null;
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setClearColor(0x000000, 0);
        const canvas = this.renderer.domElement;
        canvas.tabIndex = 0;
        canvas.setAttribute('aria-label', 'Packaging model. Drag to orbit, scroll to zoom, click a face to select.');
        canvas.setAttribute('role', 'img');
        container.appendChild(canvas);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20000);
        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = false;
        this.controls.cursorStyle = 'grab';
        this.render = this.render.bind(this);
        this.controls.addEventListener('change', this.render);
        this.controls.listenToKeyEvents(canvas);
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb5bac9, 2));
        const key = new THREE.DirectionalLight(0xffffff, 2.5);
        key.position.set(-2, 4, 3);
        this.scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 1);
        fill.position.set(3, -2, -1);
        this.scene.add(fill);
        this.model = new THREE.Group();
        this.model.rotation.x = -Math.PI / 2;
        this.scene.add(this.model);
        this.raycaster = new THREE.Raycaster();
        this.abort = new AbortController();
        const options = { signal: this.abort.signal };
        canvas.addEventListener('pointerdown', e => { this.pointerStart = [e.clientX, e.clientY]; }, options);
        canvas.addEventListener('pointerup', e => this.pick(e), options);
        canvas.addEventListener('webglcontextlost', e => {
            e.preventDefault();
            this.onError('3D graphics were interrupted. Return to 2D and reopen 3D to retry.');
        }, options);
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(container);
    }

    setModel(settings) {
        const specs = createLidPanels(settings);
        const key = JSON.stringify(specs);
        this.settings = settings;
        if (key === this.modelKey) return;
        const firstModel = !this.modelKey;
        this.modelKey = key;
        this.clearPanels();
        this.panels = specs.map(spec => {
            const hinge = new THREE.Group();
            hinge.position.fromArray(spec.hinge);
            const geometry = new THREE.PlaneGeometry(spec.width, spec.height);
            const uv = geometry.attributes.uv;
            for (let i = 0; i < uv.count; i++) uv.setXY(i, ...panelUV(spec, uv.getX(i), uv.getY(i)));
            const printed = new THREE.MeshStandardMaterial({ map: this.texture || null, color: this.texture ? 0xffffff : settings.boxColor, roughness: 0.85, metalness: 0 });
            const exterior = new THREE.Mesh(geometry, printed);
            exterior.position.fromArray(spec.offset);
            exterior.userData.surface = spec.id;
            // A separate unprinted inside avoids mirrored artwork through the board.
            const interior = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xe5e1d8, roughness: 1, side: THREE.BackSide }));
            interior.position.copy(exterior.position);
            interior.userData.surface = spec.id;
            const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x777777, transparent: true, opacity: 0.35 }));
            outline.position.copy(exterior.position);
            hinge.add(exterior, interior, outline);
            this.model.add(hinge);
            return { spec, hinge, exterior, interior, outline };
        });
        this.setFold(this.fold);
        this.select(this.selected);
        if (firstModel) this.setView('iso');
        else this.render();
    }

    setTexture(canvas) {
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 8);
        const previous = this.texture;
        this.texture = texture;
        this.panels.forEach(({ exterior }) => {
            exterior.material.map = texture;
            exterior.material.color.set(0xffffff);
            exterior.material.needsUpdate = true;
        });
        previous?.dispose();
        this.render();
    }

    setFold(value) {
        this.fold = Math.max(0, Math.min(1, value));
        this.panels.forEach(({ hinge, spec }) => { hinge.rotation[spec.axis] = foldAngle(spec, this.fold); });
        this.render();
    }

    setView(view) {
        if (!this.settings || !VIEWS[view]) return;
        const { frontWidth: w, frontHeight: h, thickness: d } = this.settings;
        this.model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(this.model);
        const center = box.getCenter(new THREE.Vector3());
        const radius = box.getSize(new THREE.Vector3()).length() / 2;
        const halfFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * Math.min(this.camera.aspect, 1));
        const distance = radius / Math.sin(halfFov) * 1.12;
        this.controls.target.copy(center);
        this.camera.position.copy(center).add(new THREE.Vector3(...VIEWS[view]).normalize().multiplyScalar(distance));
        this.camera.near = Math.max(0.05, Math.min(w, h, d) / 100);
        this.camera.far = distance * 30;
        this.camera.updateProjectionMatrix();
        this.controls.minDistance = Math.min(w, h) * 0.15;
        this.controls.maxDistance = distance * 8;
        this.controls.update();
        this.render();
    }

    pick(event) {
        if (!this.pointerStart || event.button !== 0 || Math.hypot(event.clientX - this.pointerStart[0], event.clientY - this.pointerStart[1]) > 5) return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), this.camera);
        const hit = this.raycaster.intersectObjects(this.panels.flatMap(p => [p.exterior, p.interior]))[0];
        this.select(hit?.object.userData.surface || null);
        this.onSelect(this.selected);
    }

    select(id) {
        this.selected = this.panels.some(p => p.spec.id === id) ? id : null;
        this.panels.forEach(({ spec, outline }) => {
            outline.material.color.set(spec.id === this.selected ? 0xc4f36c : 0x777777);
            outline.material.opacity = spec.id === this.selected ? 1 : 0.35;
        });
        this.render();
    }

    resize() {
        const { width, height } = this.container.getBoundingClientRect();
        if (!width || !height || this.disposed) return;
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.render();
    }

    render() { if (!this.disposed && this.visible) this.renderer.render(this.scene, this.camera); }

    clearPanels() {
        this.panels.forEach(({ hinge, exterior, interior, outline }) => {
            this.model.remove(hinge);
            exterior.geometry.dispose();
            exterior.material.dispose();
            interior.material.dispose();
            outline.geometry.dispose();
            outline.material.dispose();
        });
        this.panels = [];
    }

    dispose() {
        this.disposed = true;
        this.abort.abort();
        this.observer.disconnect();
        this.controls.dispose();
        this.clearPanels();
        this.texture?.dispose();
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }
}
