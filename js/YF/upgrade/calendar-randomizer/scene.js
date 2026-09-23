// Calendar owns SVG semantics; the shared UI host never rewrites artwork.
const graphics = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'image', 'use']);
const definitions = 'defs, symbol, clipPath, mask, pattern, marker, filter';

export function calendarElements(svg) {
    // Keep the original three-level choreography, excluding non-rendered resources.
    return [...svg.querySelectorAll(':scope > *, :scope > g > *, :scope > g > g > *')]
        .filter(element => graphics.has(element.localName) && !element.closest(definitions));
}

export function recolorDeclarations(text, color) {
    return text.replace(/(^|[;{]\s*)(fill|stroke)\s*:\s*([^;}]+)/gi, (declaration, prefix, property, value) => {
        const priority = /\s*!important\s*$/i.test(value) ? ' !important' : '';
        const paint = value.replace(/\s*!important\s*$/i, '').trim();
        return solidPaint(paint) ? `${prefix}${property}: ${recoloredPaint(paint, color)}${priority}` : declaration;
    });
}

export function solidPaint(value) {
    if (/^(?:none|transparent|currentcolor|inherit|initial|unset|revert(?:-layer)?|context-fill|context-stroke)$/i.test(value)) return false;
    if (/^(?:url|var)\(/i.test(value)) return false;
    return /^(?:#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})|(?:rgb|hsl)a?\([^)]*\)|[a-z]+)$/i.test(value);
}

function recoloredPaint(paint, color) {
    // A new foreground hue must not make semitransparent artwork opaque.
    if (/^#[\da-f]{4}$/i.test(paint)) return color + paint[4].repeat(2);
    if (/^#[\da-f]{8}$/i.test(paint)) return color + paint.slice(-2);
    const alpha = paint.match(/\/\s*([^/)]+)\s*\)$/)?.[1]
        || paint.match(/^(?:rgba|hsla)\([^,]+,[^,]+,[^,]+,\s*([^,)]+)\)$/i)?.[1];
    if (alpha && /^#[\da-f]{6}$/i.test(color)) {
        const rgb = [1,3,5].map(offset => parseInt(color.slice(offset, offset+2), 16));
        return `rgba(${rgb.join(', ')}, ${alpha.trim()})`;
    }
    return color;
}

export function createCalendarScene(svg, { random = Math.random, getStyle = element => getComputedStyle(element) } = {}) {
    const elements = calendarElements(svg);
    // Capture before the first transition, never from an intermediate animated frame.
    const bases = elements.map(element => ({
        transform: getStyle(element).transform || 'none',
        priority: element.style.getPropertyPriority('transform')
    }));
    const displacement = range => random() * range * 2 - range;
    const transform = (base, x, y) => `translate(${x}px, ${y}px)${base.transform === 'none' ? '' : ` ${base.transform}`}`;
    function move({ range = 0, speed = 0, easing = 'linear' }, reset = false) {
        elements.forEach((element, index) => {
            element.style.transition = `transform ${speed}s ${easing}`;
            element.style.setProperty('transform', transform(bases[index], reset ? 0 : displacement(range), reset ? 0 : displacement(range)), bases[index].priority);
        });
    }
    return {
        randomize: options => move(options),
        reset: options => move(options, true),
        recolor(color) {
            svg.querySelectorAll('style').forEach(style => { style.textContent = recolorDeclarations(style.textContent, color); });
            [svg, ...svg.querySelectorAll('*')].forEach(element => {
                // Gradients, masks and clipping geometry are resources, not foreground paint.
                if (element.closest(definitions)) return;
                for (const name of ['fill', 'stroke']) {
                    const value = element.getAttribute(name);
                    if (value && solidPaint(value.trim())) element.setAttribute(name, recoloredPaint(value.trim(), color));
                }
                const style = element.getAttribute('style');
                if (style) element.setAttribute('style', recolorDeclarations(style, color));
            });
        },
        exportClone({ range = 0 } = {}) {
            const clone = svg.cloneNode(true);
            calendarElements(clone).forEach((element, index) => {
                const x = displacement(range), y = displacement(range);
                const base = bases[index];
                // Preserve the original re-randomizing export, including during a transition.
                // Only replace animation transforms, not fill/opacity/filter/etc. styles.
                element.style.removeProperty('transition');
                element.style.setProperty('transform', transform(base, x, y), base.priority);
                const matrix = base.transform === 'none' ? '' : ` ${base.transform}`;
                element.setAttribute('transform', `translate(${x}, ${y})${matrix}`);
            });
            return clone;
        }
    };
}
