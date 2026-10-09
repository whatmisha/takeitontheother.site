import { ASSETS } from './assets.js';

export function groundDimensions(item, scene) {
    const [, , width, height] = ASSETS[item.asset].metrics.bounds;
    const scale = Math.max(scene.width / width, scene.height * scene.groundHeight / 100 / height);
    return { width: width * scale, height: height * scale };
}

export function anchorGround(item, scene) {
    const size = groundDimensions(item, scene);
    // Keep the horizon in the bottom band; crop surplus foreground, never stretch it.
    return { ...item, x: .5, y: 1 - scene.groundHeight / 100 + size.height / (2 * scene.height),
        rotation: 0, scale: scene.groundHeight / 100 };
}
