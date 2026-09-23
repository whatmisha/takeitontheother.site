// Both output targets consume exactly the same ordered scene. No UI borders here.
export function paintRaysScene(ctx, scene, color = '#FFFFFF') {
    ctx.clearRect(0, 0, scene.width, scene.height);
    ctx.strokeStyle = color;
    for (const item of scene.items) {
        ctx.save();
        if (item.kind === 'module') ctx.translate(item.x, item.y);
        for (const line of item.kind === 'module' ? item.lines : [item]) {
            ctx.lineWidth = line.width;
            ctx.lineCap = line.cap;
            ctx.beginPath();
            ctx.moveTo(line.points[0], line.points[1]);
            ctx.lineTo(line.points[2], line.points[3]);
            ctx.stroke();
        }
        ctx.restore();
    }
}

export function raysSvgElement(scene, document) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('xmlns', ns);
    svg.setAttribute('width', scene.width);
    svg.setAttribute('height', scene.height);
    for (const item of scene.items) {
        const parent = item.kind === 'module' ? document.createElementNS(ns, 'g') : svg;
        if (parent !== svg) {
            parent.setAttribute('transform', `translate(${item.x}, ${item.y})`);
            svg.appendChild(parent);
        }
        for (const line of item.kind === 'module' ? item.lines : [item]) {
            const element = document.createElementNS(ns, 'line');
            for (const [index, name] of ['x1', 'y1', 'x2', 'y2'].entries()) element.setAttribute(name, line.points[index]);
            element.setAttribute('stroke', 'black');
            element.setAttribute('stroke-width', line.width);
            element.setAttribute('stroke-linecap', line.cap);
            parent.appendChild(element);
        }
    }
    return svg;
}
