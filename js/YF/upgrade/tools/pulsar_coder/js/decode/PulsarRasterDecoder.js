import { decodePulsarRays, RAY_PREFIX_BITS, readRayPrefix } from '../codec/PulsarCodec.js';

const TAU = Math.PI * 2;

function normalizeAngle(angle) {
    let result = angle % TAU;
    if (result < 0) result += TAU;
    return result;
}

function angularDistance(a, b) {
    const distance = Math.abs(normalizeAngle(a) - normalizeAngle(b));
    return Math.min(distance, TAU - distance);
}

function solveCenter(segments, tolerance = Infinity) {
    let active = segments;
    let center = null;
    for (let pass = 0; pass < 3; pass += 1) {
        let aa = 0;
        let ab = 0;
        let bb = 0;
        let ac = 0;
        let bc = 0;
        for (const segment of active) {
            const a = Math.cos(segment.angle);
            const b = Math.sin(segment.angle);
            const c = a * segment.x + b * segment.y;
            aa += a * a;
            ab += a * b;
            bb += b * b;
            ac += a * c;
            bc += b * c;
        }
        const determinant = aa * bb - ab * ab;
        if (Math.abs(determinant) < 1e-8) throw new Error('Cannot determine the convergence point');
        center = {
            x: (ac * bb - bc * ab) / determinant,
            y: (bc * aa - ac * ab) / determinant
        };
        if (!Number.isFinite(tolerance)) break;
        const residuals = active.map(segment => Math.abs(
            Math.cos(segment.angle) * (center.x - segment.x)
            + Math.sin(segment.angle) * (center.y - segment.y)
        ));
        const sorted = [...residuals].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)] || 0;
        const limit = Math.max(tolerance, median * 3.5);
        const filtered = active.filter((_, index) => residuals[index] <= limit);
        if (filtered.length < Math.max(6, active.length * 0.45) || filtered.length === active.length) break;
        active = filtered;
    }
    return center;
}

function connectedComponents(binary, width, height) {
    const visited = new Uint8Array(binary.length);
    const queue = new Int32Array(binary.length);
    const components = [];
    let foregroundCount = 0;
    for (const bit of binary) foregroundCount += bit ? 1 : 0;

    for (let start = 0; start < binary.length; start += 1) {
        if (!binary[start] || visited[start]) continue;
        let head = 0;
        let tail = 0;
        queue[tail++] = start;
        visited[start] = 1;
        let area = 0;
        let sumX = 0;
        let sumY = 0;
        let sumXX = 0;
        let sumYY = 0;
        let sumXY = 0;
        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;

        while (head < tail) {
            const index = queue[head++];
            const x = index % width;
            const y = Math.floor(index / width);
            area += 1;
            sumX += x;
            sumY += y;
            sumXX += x * x;
            sumYY += y * y;
            sumXY += x * y;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);

            for (let dy = -1; dy <= 1; dy += 1) {
                for (let dx = -1; dx <= 1; dx += 1) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                    const neighbor = ny * width + nx;
                    if (binary[neighbor] && !visited[neighbor]) {
                        visited[neighbor] = 1;
                        queue[tail++] = neighbor;
                    }
                }
            }
        }
        components.push({ area, sumX, sumY, sumXX, sumYY, sumXY, minX, minY, maxX, maxY });
    }
    return { components, foregroundCount };
}

function dilateSparseMarks(binary, width, height) {
    const dilated = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        if (!binary[index]) continue;
        const x = index % width;
        const y = Math.floor(index / width);
        for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && ny >= 0 && nx < width && ny < height) dilated[ny * width + nx] = 1;
            }
        }
    }
    return dilated;
}

function componentToSegment(component) {
    const x = component.sumX / component.area;
    const y = component.sumY / component.area;
    const xx = component.sumXX / component.area - x * x;
    const yy = component.sumYY / component.area - y * y;
    const xy = component.sumXY / component.area - x * y;
    const trace = xx + yy;
    const root = Math.sqrt(Math.max(0, (xx - yy) ** 2 + 4 * xy * xy));
    const major = Math.max(0, (trace + root) / 2);
    const minor = Math.max(0, (trace - root) / 2);
    const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
    return {
        x,
        y,
        angle,
        length: Math.sqrt(12 * major) + 1,
        width: Math.sqrt(12 * minor) + 1,
        area: component.area
    };
}

function clusterRadialSegments(segments, center) {
    const candidates = segments
        .map(segment => {
            const dx = segment.x - center.x;
            const dy = segment.y - center.y;
            const distance = Math.hypot(dx, dy);
            const rayAngle = normalizeAngle(Math.atan2(dy, dx));
            const alignment = Math.abs(Math.cos(segment.angle - rayAngle));
            return { ...segment, distance, rayAngle, alignment };
        })
        .filter(segment => segment.distance > 4 && segment.alignment < 0.38)
        .sort((a, b) => a.rayAngle - b.rayAngle);
    if (!candidates.length) throw new Error('No radial tick marks were found');

    const groups = [];
    const angleTolerance = 4 * Math.PI / 180;
    for (const segment of candidates) {
        const group = groups.at(-1);
        if (!group || angularDistance(group.angle, segment.rayAngle) > angleTolerance) {
            groups.push({ angle: segment.rayAngle, segments: [segment] });
        } else {
            group.segments.push(segment);
            const sx = group.segments.reduce((sum, item) => sum + Math.cos(item.rayAngle), 0);
            const sy = group.segments.reduce((sum, item) => sum + Math.sin(item.rayAngle), 0);
            group.angle = normalizeAngle(Math.atan2(sy, sx));
        }
    }
    if (groups.length > 1 && angularDistance(groups[0].angle, groups.at(-1).angle) <= angleTolerance) {
        const merged = [...groups.at(-1).segments, ...groups[0].segments];
        groups[0] = { angle: groups[0].angle, segments: merged };
        groups.pop();
    }
    return groups.filter(group => group.segments.length >= 8);
}

function refineCenterFromGroups(groups, fallback) {
    const axes = groups.flatMap(group => {
        if (group.segments.length < 3) return [];
        const meanX = group.segments.reduce((sum, segment) => sum + segment.x, 0) / group.segments.length;
        const meanY = group.segments.reduce((sum, segment) => sum + segment.y, 0) / group.segments.length;
        let xx = 0;
        let yy = 0;
        let xy = 0;
        for (const segment of group.segments) {
            const dx = segment.x - meanX;
            const dy = segment.y - meanY;
            xx += dx * dx;
            yy += dy * dy;
            xy += dx * dy;
        }
        const rayAngle = 0.5 * Math.atan2(2 * xy, xx - yy);
        return [{ x: meanX, y: meanY, angle: rayAngle + Math.PI / 2 }];
    });
    if (axes.length < 3) return fallback;
    try {
        return solveCenter(axes);
    } catch {
        return fallback;
    }
}

function decodeMeasuredGroups(groups, center, source, diagnostics = {}) {
    const prepared = groups.map(group => {
        const ordered = [...group.segments].sort((a, b) => a.distance - b.distance);
        if (ordered.length < 12) throw new Error('A detected ray is too short');
        return { angle: group.angle, body: group.body || ordered.slice(3) };
    });
    const prefixLengths = prepared
        .flatMap(group => group.body.slice(0, RAY_PREFIX_BITS).map(mark => mark.length).filter(Number.isFinite))
        .sort((a, b) => a - b);
    if (prefixLengths.length < RAY_PREFIX_BITS) throw new Error('Ray prefixes are incomplete');
    const middle = Math.floor(prefixLengths.length / 2);
    const threshold = (prefixLengths[middle - 1] + prefixLengths[middle]) / 2;
    const lowValues = prefixLengths.filter(value => value <= threshold);
    const highValues = prefixLengths.filter(value => value > threshold);
    if (!lowValues.length || !highValues.length || prefixLengths.at(-1) === prefixLengths[0]) {
        throw new Error('Short and long ticks are indistinguishable');
    }
    const classes = {
        threshold,
        shortLength: lowValues.reduce((sum, value) => sum + value, 0) / lowValues.length,
        longLength: highValues.reduce((sum, value) => sum + value, 0) / highValues.length
    };
    const candidates = prepared.map(group => ({
        ...group,
        bits: group.body.map(mark => Number.isFinite(mark.length) ? (mark.length > classes.threshold ? 1 : 0) : null)
    }));
    const raysByIndex = new Map();
    for (const candidate of candidates) {
        try {
            for (let index = 0; index < RAY_PREFIX_BITS / 2; index += 1) {
                const inverseIndex = index + RAY_PREFIX_BITS / 2;
                if (candidate.bits[index] === null && candidate.bits[inverseIndex] !== null) {
                    candidate.bits[index] = 1 - candidate.bits[inverseIndex];
                } else if (candidate.bits[inverseIndex] === null && candidate.bits[index] !== null) {
                    candidate.bits[inverseIndex] = 1 - candidate.bits[index];
                }
            }
            const index = readRayPrefix(candidate.bits);
            if (!raysByIndex.has(index)) raysByIndex.set(index, candidate.bits);
        } catch {
            // Hough occasionally returns a short tick as a ray. The visual ray
            // prefix is deliberately checksummed so these candidates are safe
            // to discard before frame decoding.
        }
    }
    const raysBits = [...raysByIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, bits]) => bits);
    let result;
    try {
        result = decodePulsarRays(raysBits);
    } catch (error) {
        error.message += ` (recognized ${raysByIndex.size} of ${candidates.length} ray candidates)`;
        throw error;
    }
    return {
        ...result,
        source,
        geometry: {
            center,
            detectedRays: prepared.length,
            shortLength: classes.shortLength,
            longLength: classes.longLength,
            ...diagnostics
        }
    };
}

function decodeDisconnected(binary, width, height, components) {
    const segments = components
        .filter(component => component.area >= 2)
        .map(componentToSegment)
        .filter(segment => segment.length >= 2.5 && segment.length / Math.max(1, segment.width) >= 1.35);
    if (segments.length < 20) throw new Error('Not enough isolated tick marks were found');
    const roughCenter = solveCenter(segments, Math.max(1.5, Math.min(width, height) / 350));
    const initialGroups = clusterRadialSegments(segments, roughCenter);
    const center = refineCenterFromGroups(initialGroups, roughCenter);
    const groups = clusterRadialSegments(segments, center).map(group => {
        const ordered = [...group.segments].sort((a, b) => a.distance - b.distance);
        if (ordered.length < 4) return group;
        let step = (
            2 * (ordered[1].distance - ordered[0].distance)
            + 5 * (ordered[2].distance - ordered[0].distance)
        ) / 29;
        if (step < 1) return group;
        let start = ordered[0].distance + step * 8;
        const fitted = [];
        for (const mark of ordered.slice(3)) {
            const slot = Math.round((mark.distance - start) / step);
            if (slot < 0 || Math.abs(mark.distance - (start + slot * step)) > step * 0.48) continue;
            fitted.push({ slot, distance: mark.distance });
        }
        if (fitted.length >= 4) {
            const meanSlot = fitted.reduce((sum, item) => sum + item.slot, 0) / fitted.length;
            const meanDistance = fitted.reduce((sum, item) => sum + item.distance, 0) / fitted.length;
            const numerator = fitted.reduce((sum, item) => sum + (item.slot - meanSlot) * (item.distance - meanDistance), 0);
            const denominator = fitted.reduce((sum, item) => sum + (item.slot - meanSlot) ** 2, 0);
            if (denominator > 0) {
                step = numerator / denominator;
                start = meanDistance - step * meanSlot;
            }
        }
        const slots = [];
        for (const mark of ordered.slice(3)) {
            const slot = Math.round((mark.distance - start) / step);
            if (slot < 0) continue;
            const expected = start + slot * step;
            if (Math.abs(mark.distance - expected) > step * 0.38) continue;
            if (!slots[slot] || mark.length > slots[slot].length) slots[slot] = mark;
        }
        const body = Array.from({ length: slots.length }, (_, index) => slots[index] || {
            distance: start + index * step,
            length: Number.NaN
        });
        return { ...group, body };
    });
    return decodeMeasuredGroups(groups, center, 'raster', { mode: 'ticks-only' });
}

function houghLines(binary, width, height) {
    const points = [];
    for (let index = 0; index < binary.length; index += 1) {
        if (binary[index]) points.push([index % width, Math.floor(index / width)]);
    }
    const stride = Math.max(1, Math.ceil(points.length / 24000));
    const thetaBins = 180;
    const diagonal = Math.ceil(Math.hypot(width, height));
    const rhoBins = diagonal * 2 + 1;
    const accumulator = new Uint16Array(thetaBins * rhoBins);
    const cosines = new Float64Array(thetaBins);
    const sines = new Float64Array(thetaBins);
    for (let theta = 0; theta < thetaBins; theta += 1) {
        const radians = theta * Math.PI / thetaBins;
        cosines[theta] = Math.cos(radians);
        sines[theta] = Math.sin(radians);
    }
    for (let pointIndex = 0; pointIndex < points.length; pointIndex += stride) {
        const [x, y] = points[pointIndex];
        for (let theta = 0; theta < thetaBins; theta += 1) {
            const rho = Math.round(x * cosines[theta] + y * sines[theta]) + diagonal;
            const index = theta * rhoBins + rho;
            if (accumulator[index] < 0xFFFF) accumulator[index] += 1;
        }
    }
    let maxVote = 0;
    for (const vote of accumulator) maxVote = Math.max(maxVote, vote);
    const raw = [];
    const minimum = Math.max(10, maxVote * 0.18);
    for (let theta = 0; theta < thetaBins; theta += 1) {
        for (let rhoIndex = 1; rhoIndex < rhoBins - 1; rhoIndex += 1) {
            const votes = accumulator[theta * rhoBins + rhoIndex];
            if (votes >= minimum) raw.push({ theta, rho: rhoIndex - diagonal, votes });
        }
    }
    raw.sort((a, b) => b.votes - a.votes);
    const selected = [];
    for (const line of raw) {
        if (selected.some(existing => Math.abs(existing.theta - line.theta) < 3 && Math.abs(existing.rho - line.rho) < 6)) continue;
        selected.push(line);
        if (selected.length >= 72) break;
    }
    return selected.map(line => ({
        ...line,
        normalAngle: line.theta * Math.PI / thetaBins,
        a: cosines[line.theta],
        b: sines[line.theta]
    }));
}

function intersectLines(first, second) {
    const determinant = first.a * second.b - second.a * first.b;
    if (Math.abs(determinant) < 0.08) return null;
    return {
        x: (first.rho * second.b - second.rho * first.b) / determinant,
        y: (first.a * second.rho - second.a * first.rho) / determinant
    };
}

function findHoughCenter(lines, width, height) {
    const cellSize = Math.max(4, Math.min(width, height) / 160);
    const cells = new Map();
    for (let first = 0; first < lines.length; first += 1) {
        for (let second = first + 1; second < lines.length; second += 1) {
            const point = intersectLines(lines[first], lines[second]);
            if (!point || point.x < -width * 0.1 || point.y < -height * 0.1 || point.x > width * 1.1 || point.y > height * 1.1) continue;
            const key = `${Math.round(point.x / cellSize)},${Math.round(point.y / cellSize)}`;
            const cell = cells.get(key) || { score: 0, x: 0, y: 0 };
            cell.score += Math.min(lines[first].votes, lines[second].votes);
            cell.x += point.x;
            cell.y += point.y;
            cells.set(key, cell);
        }
    }
    const winningEntry = [...cells.entries()].sort((a, b) => b[1].score - a[1].score)[0];
    if (!winningEntry) throw new Error('Cannot locate the convergence point');
    const [cellX, cellY] = winningEntry[0].split(',').map(Number);
    const rough = { x: cellX * cellSize, y: cellY * cellSize };
    const tolerance = Math.max(4, Math.min(width, height) / 100);
    const passing = lines.filter(line => Math.abs(line.a * rough.x + line.b * rough.y - line.rho) <= tolerance);
    if (passing.length < 3) throw new Error('Too few ray axes intersect at one point');

    let aa = 0;
    let ab = 0;
    let bb = 0;
    let ac = 0;
    let bc = 0;
    for (const line of passing) {
        aa += line.a * line.a;
        ab += line.a * line.b;
        bb += line.b * line.b;
        ac += line.a * line.rho;
        bc += line.b * line.rho;
    }
    const determinant = aa * bb - ab * ab;
    return {
        center: {
            x: (ac * bb - bc * ab) / determinant,
            y: (bc * aa - ac * ab) / determinant
        },
        passing
    };
}

function pixelAt(binary, width, height, x, y) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= width || iy >= height) return 0;
    return binary[iy * width + ix];
}

function directionOccupancy(binary, width, height, center, angle) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const maxDistance = Math.hypot(width, height);
    let hits = 0;
    let samples = 0;
    for (let distance = 5; distance < maxDistance; distance += 2) {
        const x = center.x + dx * distance;
        const y = center.y + dy * distance;
        if (x < 0 || y < 0 || x >= width || y >= height) break;
        let hit = 0;
        for (let offset = -2; offset <= 2; offset += 1) {
            hit ||= pixelAt(binary, width, height, x - dy * offset, y + dx * offset);
        }
        hits += hit ? 1 : 0;
        samples += 1;
    }
    return samples ? hits / samples : 0;
}

function rayDirections(binary, width, height, center, lines) {
    const directions = [];
    for (const line of lines) {
        const base = normalizeAngle(line.normalAngle + Math.PI / 2);
        for (const initialAngle of [base, normalizeAngle(base + Math.PI)]) {
            let angle = initialAngle;
            let occupancy = -1;
            for (let step = -24; step <= 24; step += 1) {
                const candidateAngle = normalizeAngle(initialAngle + step * 0.05 * Math.PI / 180);
                const candidateOccupancy = directionOccupancy(binary, width, height, center, candidateAngle);
                if (candidateOccupancy > occupancy) {
                    angle = candidateAngle;
                    occupancy = candidateOccupancy;
                }
            }
            if (occupancy < 0.22) continue;
            if (directions.some(item => angularDistance(item.angle, angle) < 3 * Math.PI / 180)) continue;
            directions.push({ angle, occupancy });
        }
    }
    return directions.sort((a, b) => a.angle - b.angle);
}

function transverseWidth(binary, width, height, center, angle, distance, maxCross) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const x = center.x + dx * distance;
    const y = center.y + dy * distance;
    let best = 0;
    for (let centerOffset = -6; centerOffset <= 6; centerOffset += 1) {
        let negative = 0;
        let positive = 0;
        for (let offset = 0; offset <= maxCross; offset += 1) {
            if (!pixelAt(binary, width, height, x - dy * (centerOffset - offset), y + dx * (centerOffset - offset))) break;
            negative = offset;
        }
        for (let offset = 1; offset <= maxCross; offset += 1) {
            if (!pixelAt(binary, width, height, x - dy * (centerOffset + offset), y + dx * (centerOffset + offset))) break;
            positive = offset;
        }
        best = Math.max(best, negative + positive + 1);
    }
    return best;
}

function measureVisibleRay(binary, width, height, center, angle) {
    const maxDistance = Math.ceil(Math.hypot(width, height));
    const maxCross = Math.max(12, Math.min(80, Math.round(Math.min(width, height) * 0.07)));
    const widths = [];
    for (let distance = 0; distance < maxDistance; distance += 1) {
        const x = center.x + Math.cos(angle) * distance;
        const y = center.y + Math.sin(angle) * distance;
        if (x < 0 || y < 0 || x >= width || y >= height) break;
        widths.push(transverseWidth(binary, width, height, center, angle, distance, maxCross));
    }
    const positives = widths.filter(value => value > 0).sort((a, b) => a - b);
    let centers = [
        positives[0] || 1,
        positives[Math.floor(positives.length * 0.7)] || 3,
        positives.at(-1) || 6
    ];
    for (let iteration = 0; iteration < 10; iteration += 1) {
        const buckets = [[], [], []];
        for (const value of positives) {
            let best = 0;
            for (let index = 1; index < centers.length; index += 1) {
                if (Math.abs(value - centers[index]) < Math.abs(value - centers[best])) best = index;
            }
            buckets[best].push(value);
        }
        centers = centers.map((centerValue, index) => buckets[index].length
            ? buckets[index].reduce((sum, value) => sum + value, 0) / buckets[index].length
            : centerValue).sort((a, b) => a - b);
    }
    const threshold = (centers[0] + centers[1]) / 2;
    const peaks = [];
    let start = null;
    for (let index = 6; index <= widths.length; index += 1) {
        const elevated = index < widths.length && widths[index] >= threshold;
        if (elevated && start === null) start = index;
        if (!elevated && start !== null) {
            const end = index - 1;
            let peakIndex = start;
            for (let cursor = start + 1; cursor <= end; cursor += 1) {
                if (widths[cursor] > widths[peakIndex]) peakIndex = cursor;
            }
            peaks.push({ distance: (start + end) / 2, length: widths[peakIndex] });
            start = null;
        }
    }
    // Intersections close to the center are not data marks. The first valid
    // triple has equal, extra-long widths with 2-step and 3-step gaps.
    let pilotTriple = null;
    let pilotScore = -Infinity;
    for (let firstIndex = 0; firstIndex < peaks.length - 2; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex <= Math.min(peaks.length - 2, firstIndex + 3); secondIndex += 1) {
            const first = peaks[firstIndex];
            const second = peaks[secondIndex];
            const firstGap = second.distance - first.distance;
            if (firstGap < 4 || firstGap > Math.min(width, height) * 0.06) continue;
            const bitStep = firstGap / 2;
            const expectedThird = first.distance + bitStep * 5;
            let third = null;
            let positionError = Infinity;
            for (let thirdIndex = secondIndex + 1; thirdIndex < peaks.length; thirdIndex += 1) {
                const candidate = peaks[thirdIndex];
                const error = Math.abs(candidate.distance - expectedThird);
                if (error < positionError) {
                    third = candidate;
                    positionError = error;
                }
                if (candidate.distance > expectedThird + bitStep) break;
            }
            if (!third || positionError > Math.max(2, bitStep * 0.45)) continue;
            const largest = Math.max(first.length, second.length, third.length);
            const smallest = Math.max(1, Math.min(first.length, second.length, third.length));
            const ratio = largest / smallest;
            const score = smallest * 2 - ratio - positionError / bitStep - first.distance * 0.0005;
            if (ratio <= 1.5 && score > pilotScore) {
                pilotTriple = [first, second, third];
                pilotScore = score;
            }
        }
    }
    if (!pilotTriple) return null;
    const [firstPilot, secondPilot, thirdPilot] = pilotTriple;
    const bitStep = (secondPilot.distance - firstPilot.distance) / 2;
    if (bitStep < 2) return null;
    const sampled = [firstPilot, secondPilot, thirdPilot];
    let missing = 0;
    for (let bitIndex = 0; bitIndex < 65536; bitIndex += 1) {
        const distance = firstPilot.distance + bitStep * (8 + bitIndex);
        if (distance >= widths.length - 2) break;
        let measured = 0;
        for (let offset = -2; offset <= 2; offset += 1) {
            measured = Math.max(measured, widths[Math.round(distance + offset)] || 0);
        }
        if (measured >= threshold) {
            missing = 0;
            sampled.push({ distance, length: measured });
        } else {
            missing += 1;
            sampled.push({ distance, length: centers[0] });
            if (missing >= 3) {
                sampled.splice(-3);
                break;
            }
        }
    }
    return sampled;
}

function decodeConnected(binary, width, height) {
    const lines = houghLines(binary, width, height);
    if (lines.length < 3) throw new Error('Not enough ray axes were detected');
    const { center, passing } = findHoughCenter(lines, width, height);
    const directions = rayDirections(binary, width, height, center, passing);
    const groups = [];
    for (const direction of directions) {
        const peaks = measureVisibleRay(binary, width, height, center, direction.angle);
        if (!peaks || peaks.length < 12) continue;
        groups.push({
            angle: direction.angle,
            segments: peaks.map(mark => ({ ...mark, distance: mark.distance }))
        });
    }
    try {
        return decodeMeasuredGroups(groups, center, 'raster', { mode: 'visible-rays', houghLines: passing.length });
    } catch (error) {
        error.message += `; detected center: ${center.x.toFixed(2)},${center.y.toFixed(2)}; directions: ${directions.length}`;
        throw error;
    }
}

export function decodePulsarBinaryImage(binary, width, height) {
    if (!(binary instanceof Uint8Array) || binary.length !== width * height) throw new Error('Invalid binary image');
    const { components, foregroundCount } = connectedComponents(binary, width, height);
    if (!foregroundCount) throw new Error('The image is blank');
    const largest = components.reduce((maximum, component) => Math.max(maximum, component.area), 0);
    const connectedArtwork = largest > foregroundCount * 0.16 || largest > Math.min(width, height) * 3;
    if (connectedArtwork) return decodeConnected(binary, width, height);
    const repairedBinary = dilateSparseMarks(binary, width, height);
    const repairedComponents = connectedComponents(repairedBinary, width, height).components;
    return decodeDisconnected(repairedBinary, width, height, repairedComponents);
}

function otsuThreshold(gray) {
    const histogram = new Uint32Array(256);
    for (const value of gray) histogram[value] += 1;
    const total = gray.length;
    let sum = 0;
    for (let index = 0; index < 256; index += 1) sum += index * histogram[index];
    let backgroundWeight = 0;
    let backgroundSum = 0;
    let bestVariance = -1;
    let threshold = 127;
    for (let index = 0; index < 256; index += 1) {
        backgroundWeight += histogram[index];
        if (!backgroundWeight) continue;
        const foregroundWeight = total - backgroundWeight;
        if (!foregroundWeight) break;
        backgroundSum += index * histogram[index];
        const backgroundMean = backgroundSum / backgroundWeight;
        const foregroundMean = (sum - backgroundSum) / foregroundWeight;
        const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
        if (variance > bestVariance) {
            bestVariance = variance;
            threshold = index;
        }
    }
    return threshold;
}

function imageDataToGray(imageData) {
    const { data, width, height } = imageData;
    const gray = new Uint8Array(width * height);
    for (let index = 0; index < gray.length; index += 1) {
        const offset = index * 4;
        const alpha = data[offset + 3] / 255;
        const red = data[offset] * alpha + 255 * (1 - alpha);
        const green = data[offset + 1] * alpha + 255 * (1 - alpha);
        const blue = data[offset + 2] * alpha + 255 * (1 - alpha);
        gray[index] = Math.round(red * 0.2126 + green * 0.7152 + blue * 0.0722);
    }
    return gray;
}

function extremeInkBinaries(gray) {
    const histogram = new Uint32Array(256);
    for (const value of gray) histogram[value] += 1;
    const occupied = [...histogram.keys()].filter(value => histogram[value] > 0);
    if (occupied.length < 2) return [];
    const backgroundSeed = occupied.reduce((best, value) => histogram[value] > histogram[best] ? value : best, occupied[0]);
    const foregroundSeed = occupied.reduce((best, value) => (
        Math.abs(value - backgroundSeed) > Math.abs(best - backgroundSeed) ? value : best
    ), occupied[0]);
    const contrast = Math.abs(backgroundSeed - foregroundSeed);
    if (contrast < 48) return [];
    const foregroundIsDark = foregroundSeed < backgroundSeed;
    return [0.08, 0.14, 0.18].map(fraction => {
        const threshold = foregroundSeed + (backgroundSeed - foregroundSeed) * fraction;
        const binary = new Uint8Array(gray.length);
        for (let index = 0; index < gray.length; index += 1) {
            binary[index] = foregroundIsDark
                ? Number(gray[index] <= threshold)
                : Number(gray[index] >= threshold);
        }
        return binary;
    });
}

export function imageDataToBinary(imageData) {
    const gray = imageDataToGray(imageData);
    const histogram = new Uint32Array(256);
    for (const value of gray) histogram[value] += 1;
    const occupied = [...histogram.keys()].filter(value => histogram[value] > 0);
    const backgroundSeed = occupied.reduce((best, value) => histogram[value] > histogram[best] ? value : best, occupied[0]);
    const foregroundSeed = occupied.reduce((best, value) => (
        Math.abs(value - backgroundSeed) > Math.abs(best - backgroundSeed) ? value : best
    ), occupied[0]);
    const middleSeed = occupied.reduce((best, value) => {
        const distance = Math.min(Math.abs(value - backgroundSeed), Math.abs(value - foregroundSeed));
        const score = histogram[value] * distance * distance;
        const bestDistance = Math.min(Math.abs(best - backgroundSeed), Math.abs(best - foregroundSeed));
        const bestScore = histogram[best] * bestDistance * bestDistance;
        return score > bestScore ? value : best;
    }, occupied[0]);
    let centers = [backgroundSeed, foregroundSeed, middleSeed];
    let weights = [0, 0, 0];
    for (let iteration = 0; iteration < 16; iteration += 1) {
        const sums = [0, 0, 0];
        weights = [0, 0, 0];
        for (let value = 0; value < 256; value += 1) {
            if (!histogram[value]) continue;
            let best = 0;
            for (let index = 1; index < centers.length; index += 1) {
                if (Math.abs(value - centers[index]) < Math.abs(value - centers[best])) best = index;
            }
            sums[best] += value * histogram[value];
            weights[best] += histogram[value];
        }
        centers = centers.map((center, index) => weights[index] ? sums[index] / weights[index] : center);
    }
    const clusters = centers.map((center, index) => ({ center, weight: weights[index] })).sort((a, b) => a.center - b.center);
    const hasThreeTones = clusters.every(cluster => cluster.weight > 0)
        && clusters[1].center - clusters[0].center > 18
        && clusters[2].center - clusters[1].center > 18;
    const binary = new Uint8Array(gray.length);
    if (hasThreeTones) {
        const background = clusters.reduce((largest, cluster) => cluster.weight > largest.weight ? cluster : largest);
        if (background === clusters[2]) {
            const threshold = (clusters[0].center + clusters[1].center) / 2;
            for (let index = 0; index < gray.length; index += 1) binary[index] = Number(gray[index] <= threshold);
        } else if (background === clusters[0]) {
            const threshold = (clusters[1].center + clusters[2].center) / 2;
            for (let index = 0; index < gray.length; index += 1) binary[index] = Number(gray[index] >= threshold);
        } else {
            const darkDistance = Math.abs(background.center - clusters[0].center);
            const lightDistance = Math.abs(background.center - clusters[2].center);
            const foreground = darkDistance > lightDistance ? clusters[0] : clusters[2];
            const threshold = (background.center + foreground.center) / 2;
            for (let index = 0; index < gray.length; index += 1) {
                binary[index] = foreground.center < background.center ? Number(gray[index] <= threshold) : Number(gray[index] >= threshold);
            }
        }
    } else {
        const threshold = otsuThreshold(gray);
        let dark = 0;
        for (const value of gray) if (value <= threshold) dark += 1;
        const foregroundIsDark = dark <= gray.length - dark;
        for (let index = 0; index < gray.length; index += 1) {
            binary[index] = foregroundIsDark ? Number(gray[index] <= threshold) : Number(gray[index] > threshold);
        }
    }
    return binary;
}

export function decodePulsarImageData(imageData) {
    const gray = imageDataToGray(imageData);
    const attempts = [imageDataToBinary(imageData), ...extremeInkBinaries(gray)];
    let firstError = null;
    const retryErrors = [];
    for (const binary of attempts) {
        try {
            return decodePulsarBinaryImage(binary, imageData.width, imageData.height);
        } catch (error) {
            firstError ||= error;
            retryErrors.push(error.message);
        }
    }
    if (!firstError) throw new Error('The raster image could not be decoded');
    if (retryErrors.length > 1) firstError.message += `; high-contrast retries: ${retryErrors.slice(1).join(' | ')}`;
    throw firstError;
}

export async function decodePulsarRaster(file, {
    createImageBitmapFn = globalThis.createImageBitmap,
    documentRef = globalThis.document,
    maxDimension = 2400
} = {}) {
    if (typeof createImageBitmapFn !== 'function' || !documentRef) throw new Error('Raster decoding is not available in this browser');
    const bitmap = await createImageBitmapFn(file);
    try {
        const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = documentRef.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(bitmap, 0, 0, width, height);
        const imageData = context.getImageData(0, 0, width, height);
        return decodePulsarImageData(imageData);
    } finally {
        bitmap.close?.();
    }
}
