import { createScene, paletteLUT, hexRGB } from './scene.js';
import { normalizeSettings } from './document.js';

const vertexSource = `
attribute vec2 position;
varying vec2 uv;
void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }
`;
const fragmentSource = `
precision highp float;
varying vec2 uv;
uniform sampler2D palette;
uniform vec2 resolution, artboard;
uniform vec4 phases;
uniform vec4 fields[5];
uniform vec3 sky, lightColor;
uniform float mode, scale, complexity, flow, horizon, relief;
uniform float softness, glow, halo, contrast, grain, grainSize, seed;

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p) {
    return noise(p)*.58 + noise(p*2.03+12.7)*.28 + noise(p*4.07+31.1)*.14;
}
void main() {
    vec2 p = vec2(uv.x, 1.-uv.y);
    vec2 q = (p-.5)*scale+.5;
    vec2 offset = phases.xy*2.;
    vec2 warp = vec2(sin(q.y*5.+sin(q.x*4.+phases.x)+phases.y),
                     sin(q.x*4.8+sin(q.y*4.+phases.z)+phases.w));
    q += warp * flow * .24;
    q += (vec2(fbm(q*3.+offset), fbm(q*3.+offset+20.))- .5) * flow * .19;

    float wave = .64*sin(q.x*4.8+phases.x) + .28*sin(q.x*9.7+phases.y);
    float skyline = horizon + relief * .24 * wave;
    float distance = p.y - skyline;
    if (mode > .5) {
        distance = .3 + .7*sin(q.x*3.+q.y*2.+phases.x)
            + .24*sin(q.y*6.-q.x*2.+phases.z);
    }
    float field = q.y*(2.2+complexity*.58)
        + .75*sin(q.x*(3.3+complexity*.42)+phases.z)
        + .42*sin(q.x*6.1+q.y*4.+phases.w);
    for (int i=0; i<5; i++) {
        vec2 d = (q-fields[i].xy) / vec2(fields[i].z*1.25, fields[i].z);
        field += fields[i].w * exp(-dot(d,d)) * (.5+flow);
    }
    float tone = .5+.5*sin(field*2.6);
    float crest = exp(-pow(distance/.11,2.)) * (1.-mode);
    tone = mix(tone, .52 + .07*sin(q.x*8.+phases.y), crest*.88);
    float detail = fbm(q*13.+offset);
    tone += (detail-.5)*.04;

    // Grain lives in artwork coordinates, so export scale never rerolls it.
    vec2 gp = p * 1920. * vec2(1., artboard.y/artboard.x) / grainSize;
    vec2 cell = floor(gp);
    float speckle = hash(cell + vec2(seed, seed*.37)) - .5;
    float micro = hash(floor(gp*2.7) + seed*.71)-.5;
    float grainValue = speckle*.8 + micro*.2;
    float transition = .003 + softness*.042;
    float edgeJitter = grainValue * grain * .027;
    float land = smoothstep(-transition, transition, distance+edgeJitter);
    float pigment = clamp((tone-.5)*contrast+.5 + grainValue*grain*.16, 0., 1.);
    vec3 color = texture2D(palette, vec2(pigment, .5)).rgb;

    // A narrow luminous core and a wider, tinted halo are separate from contrast.
    float ridgeDistance = abs(tone-.72);
    float core = exp(-pow(ridgeDistance/(.016+softness*.038), 2.));
    float aura = exp(-pow(ridgeDistance/(.035+halo*.19), 2.));
    vec3 glowTint = mix(lightColor, vec3(1.,.97,.91), .55);
    color = mix(color, glowTint, clamp(glow*(core*.86 + aura*.34),0.,1.));
    color += glow * aura * vec3(.045,.026,.012);
    color += grainValue * grain * .075 * (1.-glow*core*.65);
    color = mix(sky, clamp(color,0.,1.), land);

    float skyHalo = exp(-pow(distance/(.005+halo*.027),2.)) * (1.-land);
    color = mix(color, lightColor, skyHalo*glow*.52*(.55+.45*detail));
    // Keep the open sky at the selected exact base color.
    gl_FragColor = vec4(clamp(color, 0., 1.), 1.);
}
`;

export class LandscapeRenderer {
    constructor() {
        this.canvas = document.createElement('canvas');
        const gl = this.canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
        if (!gl) throw new Error('Grainy Land needs WebGL. Enable hardware acceleration and reload.');
        this.gl = gl;
        const shader = (type, source) => {
            const object = gl.createShader(type);
            gl.shaderSource(object, source); gl.compileShader(object);
            if (!gl.getShaderParameter(object, gl.COMPILE_STATUS)) {
                const error = gl.getShaderInfoLog(object); gl.deleteShader(object); throw new Error(error);
            }
            return object;
        };
        const vs = shader(gl.VERTEX_SHADER, vertexSource), fs = shader(gl.FRAGMENT_SHADER, fragmentSource);
        this.program = gl.createProgram();
        gl.attachShader(this.program, vs); gl.attachShader(this.program, fs); gl.linkProgram(this.program);
        gl.deleteShader(vs); gl.deleteShader(fs);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
        gl.useProgram(this.program);
        this.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(this.program, 'position');
        gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        this.texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.locations = new Map(); this.cacheKey = '';
        this.canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.cacheKey = ''; });
    }
    location(name) {
        if (!this.locations.has(name)) this.locations.set(name, this.gl.getUniformLocation(this.program, name));
        return this.locations.get(name);
    }
    render(raw, width, height) {
        const s = normalizeSettings(raw), gl = this.gl;
        if (gl.isContextLost()) throw new Error('Graphics context lost. Reload to restore the renderer.');
        const max = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
        if (width > max || height > max) throw new Error('This GPU cannot render that size. Reduce export scale.');
        const key = JSON.stringify([s,width,height]);
        if (key === this.cacheKey) return this.canvas;
        this.canvas.width = width; this.canvas.height = height;
        gl.viewport(0,0,width,height); gl.useProgram(this.program);
        const scene = createScene(s);
        const values = { ...scene, softness: s.softness/100, glow: s.glow/100, halo: s.halo/100,
            contrast: s.contrast/100, grain: s.grain/100, grainSize: s.grainSize, seed: s.seed % 16381 };
        for (const name of ['mode','scale','complexity','flow','horizon','relief','softness','glow','halo','contrast','grain','grainSize','seed']) {
            gl.uniform1f(this.location(name), values[name]);
        }
        gl.uniform2f(this.location('resolution'),width,height);
        gl.uniform2f(this.location('artboard'),s.width,s.height);
        gl.uniform4fv(this.location('phases'),scene.phases);
        gl.uniform4fv(this.location('fields[0]'),scene.fields.flat());
        gl.uniform3fv(this.location('sky'),hexRGB(s.sky));
        gl.uniform3fv(this.location('lightColor'),hexRGB(s.light));
        gl.bindTexture(gl.TEXTURE_2D,this.texture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,paletteLUT(s));
        gl.uniform1i(this.location('palette'),0);
        gl.drawArrays(gl.TRIANGLES,0,6);
        const error = gl.getError();
        if (error !== gl.NO_ERROR) throw new Error('Graphics allocation failed. Reduce export size.');
        this.cacheKey = key;
        return this.canvas;
    }
    destroy() {
        const gl = this.gl;
        gl.deleteTexture(this.texture); gl.deleteBuffer(this.buffer); gl.deleteProgram(this.program);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        this.canvas.width = this.canvas.height = 1;
    }
}
