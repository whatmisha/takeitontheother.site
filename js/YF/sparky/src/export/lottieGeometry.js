// Lottie contours keep the same vertices across every frame, including when a
// rounded corner becomes sharp or switches between circular and smooth caps.
const point = (x, y) => ({ x, y });
const lerp = (a, b, t) => point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
const delta = (a, b) => [a.x - b.x, a.y - b.y];
const coordinates = (p) => [p.x, p.y];

function circularSegments(corner) {
    if (corner.radius <= 1e-9) {
        return Array.from({ length: 3 }, () => [corner.vertex, corner.vertex, corner.vertex]);
    }
    const distance = Math.hypot(corner.start.x - corner.vertex.x, corner.start.y - corner.vertex.y);
    const bx = corner.towardPrevious.x + corner.towardNext.x;
    const by = corner.towardPrevious.y + corner.towardNext.y;
    const factor = distance / (Math.cos(Math.atan(Math.abs(corner.tangent))) * Math.hypot(bx, by));
    const center = point(corner.vertex.x + bx * factor, corner.vertex.y + by * factor);
    const start = Math.atan2(corner.start.y - center.y, corner.start.x - center.x);
    const end = Math.atan2(corner.end.y - center.y, corner.end.x - center.x);
    const tau = Math.PI * 2;
    let turn = corner.sweep ? (end - start + tau) % tau : -((start - end + tau) % tau);
    if (turn > Math.PI) turn -= tau;
    if (turn < -Math.PI) turn += tau;
    const step = turn / 3;
    const handle = 4 / 3 * Math.tan(step / 4) * corner.radius;
    const onCircle = (angle) => point(center.x + corner.radius * Math.cos(angle), center.y + corner.radius * Math.sin(angle));
    return Array.from({ length: 3 }, (_, index) => {
        const a = start + index * step;
        const b = a + step;
        const p = index === 0 ? corner.start : onCircle(a);
        const q = index === 2 ? corner.end : onCircle(b);
        return [point(p.x - handle * Math.sin(a), p.y + handle * Math.cos(a)),
            point(q.x + handle * Math.sin(b), q.y - handle * Math.cos(b)), q];
    });
}

export function roundedPolygonToLottie(rounded) {
    const shape = { c: true, v: [], i: [], o: [] };
    for (const corner of rounded.corners) {
        const transition = corner.transition;
        const segments = transition ? [
            [transition.incoming.lineControl, transition.incoming.tangentControl, transition.arcStart],
            [transition.cap.control1, transition.cap.control2, transition.arcEnd],
            [transition.outgoingReverse.tangentControl, transition.outgoingReverse.lineControl, corner.end]
        ] : circularSegments(corner);
        let previous = corner.start;
        shape.v.push(coordinates(previous));
        shape.i.push([0, 0]);
        shape.o.push([0, 0]);
        for (const [first, second, end] of segments) {
            shape.o[shape.o.length - 1] = delta(first, previous);
            shape.v.push(coordinates(end));
            shape.i.push(delta(second, end));
            shape.o.push([0, 0]);
            previous = end;
        }
    }
    return shape;
}

// Matches eyeGeometry.createClosedCurvePath, without parsing or flattening SVG.
export function eyeCurveToLottie(points) {
    const count = points.length;
    const outgoing = points.map((_, index) => delta(
        lerp(points[(index - 1 + count) % count], points[(index + 1) % count], 1 / 6),
        points[(index - 1 + count) % count]
    ));
    return {
        c: true,
        v: points.map(coordinates),
        i: outgoing.map(([x, y]) => [-x, -y]),
        o: outgoing
    };
}

export function packLottieShape(shape) {
    return [...shape.v.flat(), ...shape.i.flat(), ...shape.o.flat()];
}

export function unpackLottieShape(values) {
    const count = values.length / 6;
    const pairs = (offset) => Array.from({ length: count }, (_, index) =>
        values.slice(offset + index * 2, offset + index * 2 + 2));
    return { c: true, v: pairs(0), i: pairs(count * 2), o: pairs(count * 4) };
}
