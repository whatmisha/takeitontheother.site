import { axesForSettings, buildGlobalScene, constrainSettings, projectPoint, cameraModel, rotateVector, screenToWorldSurface, worldRotationForScreenSettings } from './globalGeometry.js';
import { BOUNDARIES, COUNTRIES, countryAt, geographicToSurface, planetMaskForAxes, surfaceToGeographic } from './planetGeography.js';

export function countryAtScreen(x, y, settings, options = {}) {
    const point = screenToWorldSurface(x, y, settings, options);
    if (!point) return null;
    const { longitude, latitude } = surfaceToGeographic(point);
    return countryAt(longitude, latitude);
}

function outlinePaths(settings, options) {
    const camera = cameraModel(settings);
    const rotation = worldRotationForScreenSettings(settings, options);
    const selected = new Set(settings.selectedCountries);
    const paths = { normal: [], selected: [] };
    const rotate = (point) => rotateVector(point, rotation.x, rotation.y, rotation.z);
    const position = (point) => {
        const p = projectPoint(point, settings, camera);
        return `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    };
    const append = (first, second, bucket) => {
        let a = first;
        let b = second;
        const visibleA = a.z >= camera.horizonZ;
        const visibleB = b.z >= camera.horizonZ;
        if (!visibleA && !visibleB) return;
        if (visibleA !== visibleB) {
            let front = visibleA ? a : b;
            let back = visibleA ? b : a;
            for (let step = 0; step < 14; step += 1) {
                const middle = { x: front.x + back.x, y: front.y + back.y, z: front.z + back.z };
                const magnitude = Math.hypot(middle.x, middle.y, middle.z);
                middle.x /= magnitude; middle.y /= magnitude; middle.z /= magnitude;
                if (middle.z >= camera.horizonZ) front = middle;
                else back = middle;
            }
            if (visibleA) b = front;
            else a = front;
        }
        bucket.push(`M${position(a)}L${position(b)}`);
    };
    BOUNDARIES.forEach(([owner, neighbor, coordinates]) => {
        const selectedOwner = selected.has(COUNTRIES[owner].id);
        const selectedNeighbor = neighbor >= 0 && selected.has(COUNTRIES[neighbor].id);
        const bucket = selectedOwner !== selectedNeighbor ? paths.selected : paths.normal;
        for (let index = 1; index < coordinates.length; index += 1) {
            const a = coordinates[index - 1];
            const b = coordinates[index];
            const delta = ((b[0] - a[0] + 540) % 360) - 180;
            const count = Math.max(1, Math.ceil(Math.max(Math.abs(delta), Math.abs(b[1] - a[1])) / 2));
            let previous = rotate(geographicToSurface(...a));
            for (let step = 1; step <= count; step += 1) {
                const t = step / count;
                const current = rotate(geographicToSurface(a[0] + delta * t, a[1] + (b[1] - a[1]) * t));
                append(previous, current, bucket);
                previous = current;
            }
        }
    });
    return { normal: paths.normal.join(''), selected: paths.selected.join('') };
}

export function buildPlanetScene(rawSettings, options = {}) {
    const settings = constrainSettings({ ...rawSettings, planetMode: true });
    const axes = axesForSettings(settings);
    const surfaceEffects = planetMaskForAxes(axes, settings);
    const scene = buildGlobalScene(settings, { ...options, surfaceEffects });
    scene.planet = settings.showCountryBorders && options.includeGeographyGuides !== false
        ? outlinePaths(settings, options)
        : null;
    return scene;
}
