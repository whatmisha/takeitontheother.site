import { EndingRenderer } from './ending-renderer.js';
import { WIDTH, HEIGHT, camera, layoutText, layoutKey, sceneAt, planLogoFade, planTextFade, framePlan } from './model.js';
const FONT_URL = new URL('../infra/framework/fonts/LunnenDisplay-VariableVF.woff2', import.meta.url);
let fontReady;
export function loadFont() {
    return fontReady ||= (async () => {
        // Enable the font’s NN / LUNNEN ligatures on the face itself so Canvas
        // text measurement, logo, crawl, ending and export workers shape alike.
        const font = new FontFace('Erik Lunnen', `url("${FONT_URL.href}")`, { weight: '100 400', style: 'normal', featureSettings: '"dlig" 1' });
        await font.load();
        (globalThis.document?.fonts || globalThis.fonts).add(font);
    })();
}
const vertexSource = `
attribute vec2 a_position;
varying vec2 v_uv;
varying float v_distance;
uniform vec4 u_tile;
uniform vec4 u_camera;
uniform float u_motion;
uniform float u_mode;
uniform vec2 u_logoSize;
void main() {
    v_uv = a_position;
    if (u_mode > 0.5) {
        gl_Position = vec4((a_position.x - 0.5) * u_logoSize.x / 960.0, (0.5 - a_position.y) * u_logoSize.y / 540.0, 0.0, 1.0);
        v_distance = 0.0;
        return;
    }
    float x = (a_position.x - 0.5) * u_tile.x;
    float d = u_motion - (u_tile.y + a_position.y * u_tile.z);
    float f = u_camera.x;
    float w = f + d * u_camera.y;
    gl_Position = vec4(x * u_camera.w / 960.0 * f, -(540.0 - d * u_camera.z * u_camera.w) / 540.0 * f, 0.0, w);
    v_distance = d;
}`;
const fragmentSource = `
precision highp float;
varying vec2 v_uv;
varying float v_distance;
uniform sampler2D u_texture;
uniform vec3 u_color;
uniform vec2 u_fade;
uniform float u_opacity;
void main() {
    if (v_distance < -240.0) discard;
    float alpha = u_opacity * texture2D(u_texture, v_uv).a * (1.0 - smoothstep(u_fade.x, u_fade.y, v_distance));
    gl_FragColor = vec4(u_color * alpha, alpha);
}`;
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
function makeCanvas(w, h) { return new OffscreenCanvas(w, h); }
function fontContext(context, settings, size) {
    context.font = `${settings.weight} ${size}px "Erik Lunnen"`;
    context.fontKerning = 'normal';
    context.letterSpacing = `${settings.tracking}px`;
    context.textBaseline = 'alphabetic';
}
// Read the actual glyph raster, including fallback glyphs, accents and outline strokes.
function inkRows(surface) {
    const { width, height } = surface;
    const pixels = surface.getContext('2d').getImageData(0, 0, width, height).data;
    let first = -1, last = -1;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) { first = Math.floor((i - 3) / 4 / width); break; }
    if (first < 0) return null;
    for (let i = pixels.length - 1; i >= 3; i -= 4) if (pixels[i]) { last = Math.floor((i - 3) / 4 / width); break; }
    return { top: first, bottom: last + 1 };
}
export class CrawlRenderer {
    constructor() {
        this.ending = new EndingRenderer();
        this.canvas = makeCanvas(WIDTH, HEIGHT);
        this.gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
        if (!this.gl) throw new Error('WebGL is unavailable. Enable graphics acceleration and reload Erik.');
        const gl = this.gl;
        const shaders = [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]].map(([type, source]) => {
            const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
            return shader;
        });
        this.program = gl.createProgram();
        shaders.forEach(shader => gl.attachShader(this.program, shader)); gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
        shaders.forEach(shader => gl.deleteShader(shader));
        gl.useProgram(this.program);
        this.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
        const location = gl.getAttribLocation(this.program, 'a_position');
        gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
        this.uniform = Object.fromEntries(['tile', 'camera', 'motion', 'color', 'fade', 'mode', 'logoSize', 'opacity'].map(name => [name, gl.getUniformLocation(this.program, `u_${name}`)]));
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        this.tiles = []; this.key = null; this.logo = null; this.logoKey = null; this.fadeKey = null;
    }
    makeTexture(surface) {
        const gl = this.gl, texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, surface);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.generateMipmap(gl.TEXTURE_2D);
        return texture;
    }
    prepareLogo(settings) {
        const key = JSON.stringify([settings.title, settings.weight]);
        if (key === this.logoKey) return;
        if (this.logo) this.gl.deleteTexture(this.logo.texture);
        this.logo = null; this.logoKey = key;
        const lines = settings.title.split('\n').map(line => line.trim()).filter(Boolean);
        if (!lines.length) return;
        const surface = makeCanvas(2048, 1024), ctx = surface.getContext('2d');
        const size = 360, padding = 32, gap = 24, stroke = 18;
        fontContext(ctx, { ...settings, tracking: 0 }, size);
        const metrics = lines.map(line => ctx.measureText(line));
        const inkWidth = Math.max(...metrics.map(m => m.actualBoundingBoxLeft + m.actualBoundingBoxRight));
        const heights = metrics.map(m => m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
        const inkHeight = heights.reduce((sum, value) => sum + value, 0) + gap * (lines.length - 1);
        if (!inkWidth || !inkHeight) return;
        const fit = Math.min((surface.width - 2 * padding) / (inkWidth + stroke), (surface.height - 2 * padding) / (inkHeight + stroke));
        ctx.translate(surface.width / 2, (surface.height - inkHeight * fit) / 2);
        ctx.scale(fit, fit); ctx.strokeStyle = '#fff'; ctx.lineWidth = stroke; ctx.lineJoin = 'round';
        let y = 0;
        const positions = metrics.map((m, i) => {
            const position = [-(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / 2 + m.actualBoundingBoxLeft, y + m.actualBoundingBoxAscent];
            y += heights[i] + gap;
            return position;
        });
        lines.forEach((line, i) => ctx.strokeText(line, ...positions[i]));
        // Remove the filled glyph union, including internal overlaps in variable-font outlines.
        ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#fff';
        lines.forEach((line, i) => ctx.fillText(line, ...positions[i]));
        // Fill both frame dimensions, preserving proportions and cropping any overflow.
        const cover = Math.max(WIDTH / (inkWidth * fit), HEIGHT / (inkHeight * fit));
        const ink = inkRows(surface);
        if (!ink) return;
        this.logo = {
            texture: this.makeTexture(surface), width: surface.width * cover, height: surface.height * cover,
            // Two texture pixels conservatively include the linear filtering footprint.
            inkBottom: Math.max(0, (ink.bottom + 2 - surface.height / 2) * cover)
        };
    }
    prepareFade(settings) {
        const key = JSON.stringify([this.logoKey, this.key, settings.tilt, settings.perspective, settings.logoGap]);
        if (key !== this.fadeKey) {
            this.layout.logoFade = planLogoFade(settings, { logoBottom: this.logo?.inkBottom, textTop: this.layout.inkTop });
            this.fadeKey = key;
        }
        return this.layout;
    }
    prepare(settings) {
        this.prepareLogo(settings);
        const key = layoutKey(settings);
        if (this.key === key) return this.prepareFade(settings);
        const gl = this.gl;
        this.tiles.forEach(tile => gl.deleteTexture(tile.texture)); this.tiles = []; this.key = null;
        const measuring = makeCanvas(1, 1).getContext('2d');
        const measure = (text, size) => { fontContext(measuring, settings, size); return measuring.measureText(text).width; };
        const layout = layoutText(settings, measure);
        layout.inkTop = null; layout.inkBottom = null; this.fadeKey = null;
        const scale = 1.5;
        const width = 2 ** Math.ceil(Math.log2((settings.columnWidth + 64) * scale));
        const tileHeight = 2048, worldWidth = width / scale, worldHeight = tileHeight / scale;
        if (width > gl.getParameter(gl.MAX_TEXTURE_SIZE)) throw new Error('The selected text size exceeds this GPU’s texture limit.');
        const tileCount = Math.ceil(layout.height / worldHeight);
        if (tileCount * width * tileHeight * 4 * 4 / 3 > 192 * 1024 * 1024) throw new Error('This text layout is too large. Shorten the text or reduce its size.');
        for (let index = 0; index < tileCount; index++) {
            const surface = makeCanvas(width, tileHeight), ctx = surface.getContext('2d');
            ctx.scale(scale, scale); ctx.translate(0, -index * worldHeight);
            ctx.fillStyle = '#fff';
            for (const line of layout.lines) {
                if (line.y + line.size * 1.5 < index * worldHeight || line.y > (index + 1) * worldHeight) continue;
                fontContext(ctx, settings, line.size);
                const metrics = ctx.measureText(line.text);
                const baseline = line.y + line.size;
                const lineWidth = line.width ?? settings.columnWidth;
                const left = (worldWidth - settings.columnWidth) / 2 + (line.x || 0);
                if ((line.alignment === 'justify-all' || line.alignment === 'justify' && !line.last) && line.text.includes(' ')) {
                    const words = line.text.split(' ');
                    const widths = words.map(word => ctx.measureText(word).width);
                    const gap = (lineWidth - widths.reduce((a, b) => a + b, 0)) / (words.length - 1);
                    let x = left;
                    words.forEach((word, i) => { ctx.fillText(word, x, baseline); x += widths[i] + gap; });
                } else {
                    const x = left + (line.alignment === 'center' ? (lineWidth - metrics.width) / 2 : line.alignment === 'right' ? lineWidth - metrics.width : 0);
                    ctx.fillText(line.text, x, baseline);
                }
            }
            const ink = inkRows(surface);
            if (ink) {
                if (layout.inkTop === null) layout.inkTop = index * worldHeight + Math.max(0, ink.top - 2) / scale;
                layout.inkBottom = index * worldHeight + (ink.bottom + 2) / scale;
            }
            const texture = this.makeTexture(surface);
            this.tiles.push({ texture, y: index * worldHeight, width: worldWidth, height: worldHeight });
        }
        this.layout = layout; this.key = key;
        return this.prepareFade(settings);
    }
    render(settings, time, { width = WIDTH, height = HEIGHT, transparent = false } = {}) {
        const layout = this.prepare(settings);
        const gl = this.gl;
        if (gl.isContextLost()) throw new Error('The graphics context was lost. Reload Erik to restore the preview.');
        if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
        gl.viewport(0, 0, width, height);
        const background = transparent ? [0, 0, 0, 0] : [...rgb(settings.backgroundColor), 1];
        gl.clearColor(...background); gl.clear(gl.COLOR_BUFFER_BIT);
        const c = camera(settings), scene = sceneAt(settings, time, layout.logoFade, planTextFade(settings, layout));
        gl.uniform4f(this.uniform.camera, c.focal, c.sin, c.cos, c.planeScale);
        gl.uniform1f(this.uniform.motion, scene.crawlDistance);
        gl.uniform3fv(this.uniform.color, rgb(settings.textColor));
        gl.uniform2f(this.uniform.fade, c.fadeStart, c.fadeEnd);
        gl.uniform1f(this.uniform.mode, 0); gl.uniform1f(this.uniform.opacity, scene.textAlpha);
        for (const tile of scene.crawlVisible && scene.textAlpha > 0 ? this.tiles : []) {
            if (scene.crawlDistance - tile.y < -240 || scene.crawlDistance - tile.y - tile.height > c.fadeEnd) continue;
            gl.bindTexture(gl.TEXTURE_2D, tile.texture);
            gl.uniform4f(this.uniform.tile, tile.width, tile.y, tile.height, 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        if (this.logo && scene.logoAlpha > 0) {
            gl.uniform1f(this.uniform.mode, 1); gl.uniform1f(this.uniform.opacity, scene.logoAlpha);
            gl.uniform2f(this.uniform.logoSize, this.logo.width * scene.logoScale, this.logo.height * scene.logoScale);
            gl.bindTexture(gl.TEXTURE_2D, this.logo.texture);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        return this.ending.render(this.canvas, settings, time, framePlan(settings, layout).ending);
    }
    loadEnding(settings, bitmap) { return this.ending.load(settings, bitmap); }
    destroy() {
        this.ending.destroy();
        if (this.logo) this.gl.deleteTexture(this.logo.texture);
        this.tiles.forEach(tile => this.gl.deleteTexture(tile.texture));
        this.gl.deleteBuffer(this.buffer); this.gl.deleteProgram(this.program);
        this.gl.getExtension('WEBGL_lose_context')?.loseContext();
        this.tiles = [];
    }
}
