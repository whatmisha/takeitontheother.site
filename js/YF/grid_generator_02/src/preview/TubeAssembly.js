import * as THREE from '../../vendor/three/three.module.js';
import { panelUV } from './LidGeometry.js';
import { tubePoint, tubePanelCenter } from './TubeGeometry.js';

const SEGMENTS = 128;

function shellGeometry(spec) {
    const geometry = new THREE.PlaneGeometry(spec.width, spec.height, SEGMENTS, 1);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ...panelUV(spec, (i % (SEGMENTS + 1)) / SEGMENTS, i <= SEGMENTS ? 1 : 0));
    return geometry;
}
function curve(geometry, spec, fold, radius) {
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setXYZ(i, ...tubePoint(spec, (i % (SEGMENTS + 1)) / SEGMENTS, i <= SEGMENTS ? 1 : 0, fold, radius));
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
}
function boundary(spec, fold) {
    const points = [];
    for (const v of [0, 1]) for (let i = 0; i < SEGMENTS; i++) {
        points.push(...tubePoint(spec, i / SEGMENTS, v, fold), ...tubePoint(spec, (i + 1) / SEGMENTS, v, fold));
    }
    for (const u of [0, 1]) points.push(...tubePoint(spec, u, 0, fold), ...tubePoint(spec, u, 1, fold));
    return new Float32Array(points);
}

/** Curved lateral artwork plus uneditable round closures; no changes to document data. */
export class TubeAssembly {
    constructor(definition, settings, texture, outlineColor) {
        this.definition = definition;
        this.group = new THREE.Group();
        this.endPieces = [];
        const p = definition.parameters;
        this.panels = definition.panels.filter(spec => !settings.visibleSurfaces || settings.visibleSurfaces.includes(spec.id)).map(spec => {
            const hinge = new THREE.Group();
            this.group.add(hinge);
            const exterior = new THREE.Mesh(shellGeometry(spec), new THREE.MeshStandardMaterial({
                map: texture || null, color: texture ? 0xffffff : settings.boxColor, roughness: 0.85
            }));
            const interior = new THREE.Mesh(shellGeometry(spec), new THREE.MeshStandardMaterial({ color: 0xe5e1d8, roughness: 1, side: THREE.BackSide }));
            exterior.userData.surface = interior.userData.surface = spec.id;
            const edge = new THREE.BufferGeometry();
            edge.setAttribute('position', new THREE.BufferAttribute(boundary(spec, 1), 3));
            const outline = new THREE.LineSegments(edge, new THREE.LineBasicMaterial({ color: outlineColor, transparent: true, opacity: 0.35 }));
            hinge.add(exterior, interior, outline);
            const ends = [];
            for (const top of [false, true]) {
                const closed = definition.type === 'tube' || (spec.id === 'front' ? !top : top);
                const geometry = closed
                    ? new THREE.CylinderGeometry(spec.radius, spec.radius, p.wall, SEGMENTS)
                    : new THREE.RingGeometry(spec.radius - p.wall, spec.radius, SEGMENTS);
                const end = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xe5e1d8, roughness: 1, side: THREE.DoubleSide }));
                if (!closed) end.rotation.x = -Math.PI / 2;
                end.position.y = (top ? 1 : -1) * (spec.height / 2 - (closed ? p.wall / 2 : 0));
                end.userData.previewOnly = true;
                hinge.add(end);
                ends.push(end);
                this.endPieces.push(end);
            }
            return { spec, hinge, exterior, interior, outline, ends };
        });
    }

    update(fold, opening) {
        const p = this.definition.parameters;
        for (const { spec, hinge, exterior, interior, outline, ends } of this.panels) {
            curve(exterior.geometry, spec, fold, spec.radius);
            curve(interior.geometry, spec, fold, spec.radius - p.wall);
            hinge.position.y = tubePanelCenter(spec, this.definition, fold, opening);
            outline.geometry.attributes.position.array.set(boundary(spec, fold));
            outline.geometry.attributes.position.needsUpdate = true;
            outline.geometry.computeBoundingSphere();
            ends.forEach(end => { end.visible = fold > 0.999; });
        }
    }

    disposeEnds() {
        this.endPieces.forEach(end => { end.geometry.dispose(); end.material.dispose(); });
        this.endPieces = [];
    }
}
