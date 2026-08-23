export function normalizeRotation(rotation) {
    return ((Number(rotation) % 360) + 360) % 360;
}

export function getSvgViewportSize(rect, rotation = 0) {
    const normalized = normalizeRotation(rotation);
    return normalized === 90 || normalized === 270
        ? { width: rect.height, height: rect.width }
        : { width: rect.width, height: rect.height };
}

export function getSvgRenderScale(rect, viewBox, rotation = 0) {
    const viewport = getSvgViewportSize(rect, rotation);
    return Math.min(viewport.width / viewBox.width, viewport.height / viewBox.height) || 1;
}

export function screenDeltaToSvg(deltaX, deltaY, rect, viewBox, rotation = 0) {
    const normalized = normalizeRotation(rotation);
    let localX = deltaX;
    let localY = deltaY;

    if (normalized === 90) {
        localX = deltaY;
        localY = -deltaX;
    } else if (normalized === 180) {
        localX = -deltaX;
        localY = -deltaY;
    } else if (normalized === 270) {
        localX = -deltaY;
        localY = deltaX;
    }

    const scale = getSvgRenderScale(rect, viewBox, normalized);
    return { x: localX / scale, y: localY / scale };
}

export function clientToSvgPoint(clientX, clientY, rect, viewBox, rotation = 0) {
    const normalized = normalizeRotation(rotation);
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = -normalized * Math.PI / 180;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const localScreenX = centerX + dx * Math.cos(angle) - dy * Math.sin(angle);
    const localScreenY = centerY + dx * Math.sin(angle) + dy * Math.cos(angle);
    const viewport = getSvgViewportSize(rect, normalized);
    const viewportLeft = centerX - viewport.width / 2;
    const viewportTop = centerY - viewport.height / 2;
    const renderScale = getSvgRenderScale(rect, viewBox, normalized);
    const offsetX = (viewport.width - viewBox.width * renderScale) / 2;
    const offsetY = (viewport.height - viewBox.height * renderScale) / 2;

    return {
        x: viewBox.x + (localScreenX - viewportLeft - offsetX) / renderScale,
        y: viewBox.y + (localScreenY - viewportTop - offsetY) / renderScale
    };
}

export function calculateZoomView({
    requestedZoom,
    currentZoom,
    minZoom,
    maxZoom,
    mouseX,
    mouseY,
    rect,
    viewBox,
    originalWidth,
    originalHeight
}) {
    const zoom = Math.max(minZoom, Math.min(maxZoom, requestedZoom));
    if (zoom === currentZoom) return null;

    const xRatio = mouseX / (rect.width || 1);
    const yRatio = mouseY / (rect.height || 1);
    const svgX = viewBox.x + xRatio * viewBox.width;
    const svgY = viewBox.y + yRatio * viewBox.height;
    const width = originalWidth / zoom;
    const height = originalHeight / zoom;

    return {
        zoom,
        panX: svgX - xRatio * width,
        panY: svgY - yRatio * height
    };
}

export function calculateCenteredPan(bbox, originalWidth, originalHeight, zoom) {
    const viewBoxWidth = originalWidth / zoom;
    const viewBoxHeight = originalHeight / zoom;
    return {
        panX: bbox.x - (viewBoxWidth - bbox.width) / 2,
        panY: bbox.y - (viewBoxHeight - bbox.height) / 2
    };
}

export function calculateFitView({
    bbox,
    containerRect,
    originalWidth,
    originalHeight,
    minZoom,
    maxZoom,
    paddingHorizontal = 360,
    paddingVertical = 120
}) {
    const availableWidth = Math.max(100, containerRect.width - paddingHorizontal * 2);
    const availableHeight = Math.max(100, containerRect.height - paddingVertical * 2);
    const scale = Math.min(availableWidth / bbox.width, availableHeight / bbox.height);
    const zoom = Math.max(minZoom, Math.min(maxZoom, scale));

    return {
        zoom,
        baseZoom: zoom,
        ...calculateCenteredPan(bbox, originalWidth, originalHeight, zoom)
    };
}
