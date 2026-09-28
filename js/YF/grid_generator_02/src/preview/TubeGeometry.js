/** Unroll a cylinder without stretching the exterior artwork along the arc. */
export function tubePoint(panel, u, v, fold, radius = panel.radius) {
    const amount = Math.max(0, Math.min(1, fold));
    const angle = (u - 0.5) * Math.PI * 2 * amount;
    const x = amount < 1e-6 ? (u - 0.5) * Math.PI * 2 * radius : radius / amount * Math.sin(angle);
    const z = amount < 1e-6 ? 0 : radius / amount * (Math.cos(angle) - 1) + radius * amount;
    return [x, (v - 0.5) * panel.height, z];
}

export function tubePanelCenter(panel, definition, fold, opening) {
    const { parameters: p, net } = definition;
    const flat = net.height / 2 - panel.rect.y - panel.height / 2;
    const closed = panel.id === 'front' ? 0 : p.bodyHeight / 2 - p.overlap + p.capHeight / 2;
    const lift = panel.id === 'front' ? 0 : opening * (p.overlap + Math.max(20, p.capHeight * 0.65));
    return flat * (1 - fold) + (closed + lift) * fold;
}
