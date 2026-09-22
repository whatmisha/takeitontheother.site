const FORM_SETTLE_STEPS = 75;
const FORM_SETTLE_MIN = 12;
const FORM_SETTLE_MAX = 180;
const EMPTY_TONE = 0.05;
const masks = new Map();
let latestRequestId = 0;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const roundWeight = (value) => clamp(Math.round(Number(value) / 100) * 100, 100, 900);

function makeGrid(width, height, resolution, density = 0) {
    const cols = Math.max(1, Math.round(resolution));
    const rows = Math.max(1, Math.round(cols * height / width));
    const cellW = width / cols;
    const cellH = height / rows;
    const densityValue = clamp(Number(density || 0) / 100, -1, 1);
    const pitchScale = densityValue >= 0 ? lerp(1, 0.62, densityValue) : lerp(1, 1.28, -densityValue);
    const pitchW = cellW * pitchScale;
    const pitchH = cellH * pitchScale;
    return {
        cols,
        rows,
        cellW,
        cellH,
        pitchW,
        pitchH,
        originX: width / 2 - ((cols - 1) * pitchW) / 2,
        originY: height / 2 - ((rows - 1) * pitchH) / 2
    };
}

function signedNoise(index, salt) {
    const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453123;
    return (value - Math.floor(value)) * 2 - 1;
}

function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
        value += 0x6D2B79F5;
        let result = value;
        result = Math.imul(result ^ result >>> 15, result | 1);
        result ^= result + Math.imul(result ^ result >>> 7, result | 61);
        return ((result ^ result >>> 14) >>> 0) / 4294967296;
    };
}

function buildNearestBoundaryMap(inside, width, height) {
    const length = width * height;
    let sourceX = new Int16Array(length);
    let sourceY = new Int16Array(length);
    let targetX = new Int16Array(length);
    let targetY = new Int16Array(length);
    sourceX.fill(-1);
    sourceY.fill(-1);
    let boundaryCount = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;
            const value = inside[index];
            let boundary = false;
            for (let oy = -1; oy <= 1 && !boundary; oy++) {
                for (let ox = -1; ox <= 1; ox++) {
                    if (ox === 0 && oy === 0) continue;
                    const nx = x + ox;
                    const ny = y + oy;
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                        if (value) boundary = true;
                    } else if (inside[ny * width + nx] !== value) {
                        boundary = true;
                    }
                    if (boundary) break;
                }
            }
            if (boundary) {
                sourceX[index] = x;
                sourceY[index] = y;
                boundaryCount++;
            }
        }
    }
    if (!boundaryCount) return null;

    let jump = 1;
    while (jump < Math.max(width, height)) jump *= 2;
    for (jump /= 2; jump >= 1; jump /= 2) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                let bestX = sourceX[index];
                let bestY = sourceY[index];
                let bestDistance = bestX >= 0 ? (bestX - x) ** 2 + (bestY - y) ** 2 : Infinity;
                for (let oy = -jump; oy <= jump; oy += jump) {
                    for (let ox = -jump; ox <= jump; ox += jump) {
                        const nx = x + ox;
                        const ny = y + oy;
                        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                        const nextIndex = ny * width + nx;
                        const candidateX = sourceX[nextIndex];
                        const candidateY = sourceY[nextIndex];
                        if (candidateX < 0) continue;
                        const distance = (candidateX - x) ** 2 + (candidateY - y) ** 2;
                        if (distance < bestDistance) {
                            bestDistance = distance;
                            bestX = candidateX;
                            bestY = candidateY;
                        }
                    }
                }
                targetX[index] = bestX;
                targetY[index] = bestY;
            }
        }
        [sourceX, targetX] = [targetX, sourceX];
        [sourceY, targetY] = [targetY, sourceY];
    }
    return { width, height, inside, nearestX: sourceX, nearestY: sourceY };
}

function getMask(payload) {
    if (masks.has(payload.maskKey)) return masks.get(payload.maskKey);
    if (!payload.maskSource) return null;
    const inside = new Uint8Array(payload.maskSource.inside);
    const mask = buildNearestBoundaryMap(inside, payload.maskSource.width, payload.maskSource.height);
    if (mask) {
        masks.clear();
        masks.set(payload.maskKey, mask);
    }
    return mask;
}

function insideMask(mask, x, y, settings) {
    const mx = clamp(Math.round(x / settings.width * (mask.width - 1)), 0, mask.width - 1);
    const my = clamp(Math.round(y / settings.height * (mask.height - 1)), 0, mask.height - 1);
    return !!mask.inside[my * mask.width + mx];
}

function allowedByForm(mask, x, y, settings) {
    const inside = insideMask(mask, x, y, settings);
    return settings.formInsideOut === true ? !inside : inside;
}

function signedMaskDistance(mask, px, py, settings) {
    const x = clamp(px, 0, mask.width - 1);
    const y = clamp(py, 0, mask.height - 1);
    const index = y * mask.width + x;
    const nearestX = mask.nearestX[index];
    const nearestY = mask.nearestY[index];
    if (nearestX < 0) return 0;
    const scaleX = settings.width / Math.max(1, mask.width - 1);
    const scaleY = settings.height / Math.max(1, mask.height - 1);
    const distance = Math.hypot((nearestX - x) * scaleX, (nearestY - y) * scaleY);
    return mask.inside[index] ? distance : -distance;
}

function sampleFormField(mask, x, y, settings) {
    const px = clamp(Math.round(x / settings.width * (mask.width - 1)), 0, mask.width - 1);
    const py = clamp(Math.round(y / settings.height * (mask.height - 1)), 0, mask.height - 1);
    const index = py * mask.width + px;
    const nearestPixelX = mask.nearestX[index];
    const nearestPixelY = mask.nearestY[index];
    if (nearestPixelX < 0) return null;
    const nearX = nearestPixelX / Math.max(1, mask.width - 1) * settings.width;
    const nearY = nearestPixelY / Math.max(1, mask.height - 1) * settings.height;
    const dx = nearX - x;
    const dy = nearY - y;
    const distance = Math.hypot(dx, dy);
    let normalX = 0;
    let normalY = 1;
    if (distance > 0.0001) {
        normalX = dx / distance;
        normalY = dy / distance;
    } else {
        const left = signedMaskDistance(mask, px - 1, py, settings);
        const right = signedMaskDistance(mask, px + 1, py, settings);
        const top = signedMaskDistance(mask, px, py - 1, settings);
        const bottom = signedMaskDistance(mask, px, py + 1, settings);
        const gx = right - left;
        const gy = bottom - top;
        const length = Math.hypot(gx, gy);
        if (length > 0.0001) {
            const direction = mask.inside[index] ? -1 : 1;
            normalX = gx / length * direction;
            normalY = gy / length * direction;
        }
    }
    return { kind: 'form', x: nearX, y: nearY, distance, normalX, normalY };
}

function sampleCanvasField(x, y, width, height) {
    const candidates = [
        { kind: 'canvas', x: 0, y: clamp(y, 0, height), distance: Math.abs(x), normalX: -1, normalY: 0 },
        { kind: 'canvas', x: width, y: clamp(y, 0, height), distance: Math.abs(width - x), normalX: 1, normalY: 0 },
        { kind: 'canvas', x: clamp(x, 0, width), y: 0, distance: Math.abs(y), normalX: 0, normalY: -1 },
        { kind: 'canvas', x: clamp(x, 0, width), y: height, distance: Math.abs(height - y), normalX: 0, normalY: 1 }
    ];
    return candidates.reduce((best, candidate) => candidate.distance < best.distance ? candidate : best);
}

function nearestAttractor(mask, x, y, settings, preferredKind = null) {
    const form = sampleFormField(mask, x, y, settings);
    const canvas = settings.formCanvasEdges !== false
        ? sampleCanvasField(x, y, settings.width, settings.height)
        : null;
    if (preferredKind === 'form') return form;
    if (preferredKind === 'canvas') return canvas;
    if (!form) return canvas;
    if (!canvas) return form;
    return form.distance <= canvas.distance ? form : canvas;
}

function gravityVector(degrees) {
    const angle = Number(degrees || 0) * Math.PI / 180;
    return { x: Math.sin(angle), y: Math.cos(angle) };
}

function metricFor(table, char, weight, size) {
    const metric = table[`${char}|${roundWeight(weight)}`] || table[`?|${roundWeight(weight)}`];
    if (!metric) {
        return { halfWidth: size * 0.25, halfHeight: size * 0.48, anchorOffset: size * 0.28 };
    }
    return {
        halfWidth: metric[0] * size,
        halfHeight: metric[1] * size,
        anchorOffset: metric[2] * size
    };
}

function makeParticles(payload, mask) {
    const { settings, chars, fontMetrics } = payload;
    const grid = makeGrid(settings.width, settings.height, settings.resolution, settings.density);
    const base = Math.max(1, Math.min(grid.cellW, grid.cellH) * 0.74);
    const weightMin = Math.min(settings.weightMin, settings.weightMax);
    const weightMax = Math.max(settings.weightMin, settings.weightMax);
    const sizeMin = clamp(Math.min(settings.sizeMin, settings.sizeMax) / 100, 0.01, 4);
    const sizeMax = clamp(Math.max(settings.sizeMin, settings.sizeMax) / 100, 0.01, 4);
    const noiseMin = clamp(Number(settings.noiseMin || 0) / 100, 0, 4);
    const noiseMax = clamp(Number(settings.noiseMax || 0) / 100, 0, 4);
    const edgeSpread = Math.max(1, Math.min(settings.width, settings.height) * clamp(Number(settings.formEdgeSpread || 15) / 100, 0.02, 1));
    const hideTiny = settings.hideTinyLetters !== false;
    const particles = [];
    let sourceIndex = 0;

    for (let row = 0; row < grid.rows; row++) {
        for (let col = 0; col < grid.cols; col++, sourceIndex++) {
            const pointX = grid.originX + col * grid.pitchW;
            const pointY = grid.originY + row * grid.pitchH;
            if (!allowedByForm(mask, pointX, pointY, settings)) continue;
            const initialField = sampleFormField(mask, pointX, pointY, settings);
            if (!initialField) continue;
            const initialEdgeTone = 1 - clamp(initialField.distance / edgeSpread);
            const initialTone = settings.invertDither ? 1 - initialEdgeTone : initialEdgeTone;
            const noise = settings.noiseEnabled === false ? 0 : lerp(noiseMin, noiseMax, initialTone);
            const pitch = Math.min(grid.pitchW, grid.pitchH);
            const jitter = pitch * clamp(0.28 + noise * 0.36, 0.28, 0.95);
            let baselineX = pointX;
            let baselineY = pointY;
            for (let attempt = 0; attempt < 6; attempt++) {
                const candidateX = pointX + signedNoise(sourceIndex, 31 + attempt * 2) * jitter;
                const candidateY = pointY + signedNoise(sourceIndex, 32 + attempt * 2) * jitter;
                if (allowedByForm(mask, candidateX, candidateY, settings)) {
                    baselineX = candidateX;
                    baselineY = candidateY;
                    break;
                }
            }
            const field = sampleFormField(mask, baselineX, baselineY, settings);
            if (!field) continue;
            const edgeTone = 1 - clamp(field.distance / edgeSpread);
            const tone = settings.invertDither ? 1 - edgeTone : edgeTone;
            const size = base * (settings.sizeEnabled === false ? sizeMax : lerp(sizeMin, sizeMax, tone));
            if (hideTiny && size <= Math.max(0.35, base * EMPTY_TONE)) continue;
            const weight = roundWeight(settings.weightEnabled === false ? weightMax : lerp(weightMin, weightMax, tone));
            const rotation = settings.rotationEnabled === false
                ? 0
                : lerp(Number(settings.rotationMin || 0), Number(settings.rotationMax || 0), tone);
            const char = chars[sourceIndex % chars.length];
            const collision = metricFor(fontMetrics, char, weight, size);
            const padding = size * clamp(Number(settings.formLetterSpacing || 25) / 100) / 2;
            const halfWidth = collision.halfWidth + padding;
            const halfHeight = collision.halfHeight + padding;
            const styleRotation = rotation * Math.PI / 180;
            const weightMass = lerp(0.62, 1.38, clamp((weight - 100) / 800));
            const mass = clamp((size / Math.max(0.1, base)) ** 2 * weightMass, 0.35, 3.5);
            particles.push({
                index: particles.length,
                char,
                size,
                weight,
                styleRotation,
                angle: styleRotation,
                angularVelocity: 0,
                anchorOffset: collision.anchorOffset,
                visualHalfWidth: collision.halfWidth,
                visualHalfHeight: collision.halfHeight,
                halfWidth,
                halfHeight,
                collisionRadius: Math.hypot(halfWidth, halfHeight),
                mass,
                x: baselineX + Math.sin(styleRotation) * collision.anchorOffset,
                y: baselineY - Math.cos(styleRotation) * collision.anchorOffset,
                vx: 0,
                vy: 0,
                attachedTo: null,
                attachCooldown: 0,
                bondNormalX: 0,
                bondNormalY: 1,
                orientationX: 0,
                orientationY: 1
            });
        }
    }
    return particles;
}

function particleAnchor(particle) {
    return {
        x: particle.x - Math.sin(particle.angle) * particle.anchorOffset,
        y: particle.y + Math.cos(particle.angle) * particle.anchorOffset
    };
}

function applyFormForces(particles, settings, mask) {
    const attractionRange = Math.max(1, Math.min(settings.width, settings.height) * clamp(Number(settings.formEdgeSpread || 15) / 100, 0.02, 1));
    const lineGravity = clamp(Number(settings.formAttraction || 25) / 100);
    const stickiness = clamp(Number(settings.formStickiness || 25) / 100);
    const friction = clamp(Number(settings.formFriction || 50) / 100);
    const gravityLevel = clamp(Number(settings.formGravity || 50) / 100);
    const gravity = gravityVector(settings.formGravityDirection);
    const gravityAcceleration = gravityLevel * 0.15;
    const lineForceLimit = lineGravity * 0.24;
    const maximumBondForce = lineForceLimit * 0.45 + Math.pow(stickiness, 1.45) * 0.22;
    const springStrength = 0.055 + stickiness * 0.12;
    const contactDamping = 0.18;
    const tangentialFriction = friction * 0.22;

    for (const particle of particles) {
        if (particle.attachCooldown > 0) particle.attachCooldown--;
        const anchor = particleAnchor(particle);
        let attractor = nearestAttractor(mask, anchor.x, anchor.y, settings, particle.attachedTo);
        let forceX = gravity.x * gravityAcceleration * particle.mass;
        let forceY = gravity.y * gravityAcceleration * particle.mass;
        let lineIntentX = 0;
        let lineIntentY = 0;

        if (particle.attachedTo && attractor) {
            const dx = attractor.x - anchor.x;
            const dy = attractor.y - anchor.y;
            const distance = Math.hypot(dx, dy);
            const normalX = distance > 0.0001 ? dx / distance : particle.bondNormalX;
            const normalY = distance > 0.0001 ? dy / distance : particle.bondNormalY;
            if (distance > 0.0001) {
                particle.bondNormalX = normalX;
                particle.bondNormalY = normalY;
            }
            const anchorVelocityX = particle.vx - Math.cos(particle.angle) * particle.anchorOffset * particle.angularVelocity;
            const anchorVelocityY = particle.vy - Math.sin(particle.angle) * particle.anchorOffset * particle.angularVelocity;
            const normalVelocity = anchorVelocityX * normalX + anchorVelocityY * normalY;
            const springForce = distance * springStrength - normalVelocity * particle.mass * contactDamping;
            if (Math.abs(springForce) > maximumBondForce || distance > Math.max(3, particle.size * 1.1)) {
                particle.attachedTo = null;
                particle.attachCooldown = 12;
                attractor = nearestAttractor(mask, anchor.x, anchor.y, settings);
            } else {
                const tangentX = -normalY;
                const tangentY = normalX;
                const tangentVelocity = anchorVelocityX * tangentX + anchorVelocityY * tangentY;
                forceX += normalX * springForce - tangentX * tangentVelocity * particle.mass * tangentialFriction;
                forceY += normalY * springForce - tangentY * tangentVelocity * particle.mass * tangentialFriction;
                const intent = lineForceLimit + maximumBondForce * 0.5;
                lineIntentX = normalX * intent;
                lineIntentY = normalY * intent;
            }
        }

        if (!particle.attachedTo && attractor) {
            const dx = attractor.x - anchor.x;
            const dy = attractor.y - anchor.y;
            const distance = Math.hypot(dx, dy);
            const normalX = distance > 0.0001 ? dx / distance : attractor.normalX;
            const normalY = distance > 0.0001 ? dy / distance : attractor.normalY;
            const falloff = distance < attractionRange ? Math.pow(1 - distance / attractionRange, 2.2) : 0;
            const lineForce = lineForceLimit * falloff;
            forceX += normalX * lineForce;
            forceY += normalY * lineForce;
            lineIntentX = normalX * lineForce;
            lineIntentY = normalY * lineForce;
            if (stickiness > 0 && particle.attachCooldown === 0 && distance <= Math.max(0.9, particle.size * 0.18)) {
                particle.attachedTo = attractor.kind;
                particle.bondNormalX = normalX;
                particle.bondNormalY = normalY;
            }
        }

        particle.orientationX = gravity.x * gravityAcceleration * particle.mass + lineIntentX;
        particle.orientationY = gravity.y * gravityAcceleration * particle.mass + lineIntentY;
        particle.vx += forceX / particle.mass;
        particle.vy += forceY / particle.mass;
    }
}

function normalizeAngle(angle) {
    let result = angle;
    while (result > Math.PI) result -= Math.PI * 2;
    while (result < -Math.PI) result += Math.PI * 2;
    return result;
}

function settleAngles(particles) {
    for (const particle of particles) {
        const forceLength = Math.hypot(particle.orientationX, particle.orientationY);
        if (forceLength <= 0.0001) continue;
        const target = Math.atan2(-particle.orientationX, particle.orientationY) + particle.styleRotation;
        particle.angularVelocity += normalizeAngle(target - particle.angle) * 0.075 / Math.sqrt(particle.mass);
        particle.angularVelocity *= 0.72;
        particle.angle = normalizeAngle(particle.angle + particle.angularVelocity);
    }
}

function projectionRadius(particle, axisX, axisY, collisionBounds = true) {
    const cos = Math.cos(particle.angle);
    const sin = Math.sin(particle.angle);
    const halfWidth = collisionBounds ? particle.halfWidth : particle.visualHalfWidth;
    const halfHeight = collisionBounds ? particle.halfHeight : particle.visualHalfHeight;
    return Math.abs(cos * axisX + sin * axisY) * halfWidth
        + Math.abs(-sin * axisX + cos * axisY) * halfHeight;
}

function rectangleContact(first, second) {
    const deltaX = second.x + second.vx - first.x - first.vx;
    const deltaY = second.y + second.vy - first.y - first.vy;
    const firstCos = Math.cos(first.angle);
    const firstSin = Math.sin(first.angle);
    const secondCos = Math.cos(second.angle);
    const secondSin = Math.sin(second.angle);
    const axes = [[firstCos, firstSin], [-firstSin, firstCos], [secondCos, secondSin], [-secondSin, secondCos]];
    let minimumOverlap = Infinity;
    let normalX = 0;
    let normalY = 0;
    for (const [axisX, axisY] of axes) {
        const centerDistance = deltaX * axisX + deltaY * axisY;
        const overlap = projectionRadius(first, axisX, axisY) + projectionRadius(second, axisX, axisY) - Math.abs(centerDistance);
        if (overlap <= 0) return null;
        if (overlap < minimumOverlap) {
            minimumOverlap = overlap;
            const direction = centerDistance < 0 ? -1 : 1;
            normalX = axisX * direction;
            normalY = axisY * direction;
        }
    }
    return { overlap: minimumOverlap, normalX, normalY };
}

function collide(particles) {
    const largestRadius = particles.reduce((largest, particle) => Math.max(largest, particle.collisionRadius), 0.5);
    const cellSize = Math.max(1, largestRadius * 2);
    const buckets = new Map();
    for (const particle of particles) {
        const key = `${Math.floor((particle.x + particle.vx) / cellSize)},${Math.floor((particle.y + particle.vy) / cellSize)}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(particle);
    }
    for (const first of particles) {
        const cellX = Math.floor((first.x + first.vx) / cellSize);
        const cellY = Math.floor((first.y + first.vy) / cellSize);
        for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
                const nearby = buckets.get(`${cellX + ox},${cellY + oy}`);
                if (!nearby) continue;
                for (const second of nearby) {
                    if (second.index <= first.index) continue;
                    const dx = second.x + second.vx - first.x - first.vx;
                    const dy = second.y + second.vy - first.y - first.vy;
                    const broadRadius = first.collisionRadius + second.collisionRadius;
                    if (dx * dx + dy * dy >= broadRadius * broadRadius) continue;
                    const contact = rectangleContact(first, second);
                    if (!contact) continue;
                    const inverseFirst = 1 / first.mass;
                    const inverseSecond = 1 / second.mass;
                    const inverseTotal = inverseFirst + inverseSecond;
                    const correction = Math.min(contact.overlap, Math.min(first.halfHeight, second.halfHeight)) * 0.78;
                    const firstShare = inverseFirst / inverseTotal;
                    const secondShare = inverseSecond / inverseTotal;
                    first.x -= contact.normalX * correction * firstShare;
                    first.y -= contact.normalY * correction * firstShare;
                    second.x += contact.normalX * correction * secondShare;
                    second.y += contact.normalY * correction * secondShare;
                    const relativeVelocity = (second.vx - first.vx) * contact.normalX + (second.vy - first.vy) * contact.normalY;
                    if (relativeVelocity < 0) {
                        const impulse = -relativeVelocity / inverseTotal;
                        first.vx -= contact.normalX * impulse * inverseFirst;
                        first.vy -= contact.normalY * impulse * inverseFirst;
                        second.vx += contact.normalX * impulse * inverseSecond;
                        second.vy += contact.normalY * impulse * inverseSecond;
                    }
                }
            }
        }
    }
}

function constrain(particles, settings) {
    if (settings.formCanvasEdges === false) return;
    for (const particle of particles) {
        const extentX = Math.min(projectionRadius(particle, 1, 0, false), settings.width / 2);
        const extentY = Math.min(projectionRadius(particle, 0, 1, false), settings.height / 2);
        if (particle.x < extentX) {
            particle.x = extentX;
            particle.vx = Math.max(0, particle.vx) * 0.08;
        } else if (particle.x > settings.width - extentX) {
            particle.x = settings.width - extentX;
            particle.vx = Math.min(0, particle.vx) * 0.08;
        }
        if (particle.y < extentY) {
            particle.y = extentY;
            particle.vy = Math.max(0, particle.vy) * 0.08;
        } else if (particle.y > settings.height - extentY) {
            particle.y = settings.height - extentY;
            particle.vy = Math.min(0, particle.vy) * 0.08;
        }
    }
}

function constrainOutsideForm(particles, settings, mask) {
    if (settings.formInsideOut !== true) return;
    for (const particle of particles) {
        const maskPixel = Math.max(
            settings.width / Math.max(1, mask.width - 1),
            settings.height / Math.max(1, mask.height - 1)
        );
        const clearance = Math.max(maskPixel * 2.25, particle.size * 0.04);
        let normalX = 0;
        let normalY = 0;
        let corrected = false;
        for (let attempt = 0; attempt < 4; attempt++) {
            const anchor = particleAnchor(particle);
            if (!insideMask(mask, anchor.x, anchor.y, settings)) break;
            const field = sampleFormField(mask, anchor.x, anchor.y, settings);
            if (!field) break;
            corrected = true;
            normalX = field.normalX;
            normalY = field.normalY;
            const anchorX = field.x + normalX * clearance * (attempt + 1);
            const anchorY = field.y + normalY * clearance * (attempt + 1);
            particle.x = anchorX + Math.sin(particle.angle) * particle.anchorOffset;
            particle.y = anchorY - Math.cos(particle.angle) * particle.anchorOffset;
        }
        if (!corrected) continue;
        const inwardVelocity = particle.vx * normalX + particle.vy * normalY;
        if (inwardVelocity < 0) {
            particle.vx -= normalX * inwardVelocity;
            particle.vy -= normalY * inwardVelocity;
        }
        particle.attachedTo = null;
        particle.attachCooldown = Math.max(particle.attachCooldown, 2);
    }
}

async function simulate(payload, mask) {
    const particles = makeParticles(payload, mask);
    const random = seededRandom(hashString(payload.key));
    for (const particle of particles) {
        particle.vx = (random() - 0.5) * 1e-6;
        particle.vy = (random() - 0.5) * 1e-6;
    }
    const steps = clamp(Math.round(Number(payload.settings.formSettlingTime || FORM_SETTLE_STEPS)), FORM_SETTLE_MIN, FORM_SETTLE_MAX);
    for (let step = 0; step < steps; step++) {
        if (payload.id !== latestRequestId) return null;
        applyFormForces(particles, payload.settings, mask);
        collide(particles);
        for (const particle of particles) {
            particle.vx *= 0.895;
            particle.vy *= 0.895;
            particle.x += particle.vx;
            particle.y += particle.vy;
        }
        settleAngles(particles);
        constrain(particles, payload.settings);
        constrainOutsideForm(particles, payload.settings, mask);
        if (step % 8 === 7) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return particles;
}

async function run(payload) {
    const mask = getMask(payload);
    if (!mask || payload.id !== latestRequestId) return;
    const particles = await simulate(payload, mask);
    if (!particles || payload.id !== latestRequestId) return;
    const weights = new Uint16Array(particles.length);
    const values = new Float32Array(particles.length * 4);
    const chars = new Array(particles.length);
    for (let index = 0; index < particles.length; index++) {
        const particle = particles[index];
        const anchor = particleAnchor(particle);
        chars[index] = particle.char;
        weights[index] = particle.weight;
        values[index * 4] = anchor.x;
        values[index * 4 + 1] = anchor.y;
        values[index * 4 + 2] = particle.size;
        values[index * 4 + 3] = particle.angle * 180 / Math.PI;
    }
    self.postMessage({
        type: 'result',
        id: payload.id,
        key: payload.key,
        chars,
        weights: weights.buffer,
        values: values.buffer
    }, [weights.buffer, values.buffer]);
}

self.onmessage = (event) => {
    const payload = event.data;
    if (payload.type !== 'compute') return;
    latestRequestId = payload.id;
    void run(payload);
};
