import { createScene, materialColors, adjacentColors, hexRGB } from './scene.js?v=ember-default-1';
import { normalizeSettings } from './document.js?v=ember-default-1';

const vertexSource = `
attribute vec2 position;
varying vec2 uv;
void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }
`;
const fragmentSource = `
precision highp float;
varying vec2 uv;
uniform vec2 artboard;
uniform vec4 phases, fields[6], layers[6], layerStyles[6];
uniform vec3 sky, colors[6], adjacent[6];
uniform float toneAmount, toneScale, toneBleed, toneCharacter;
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
    return noise(p)*.57 + noise(p*2.03+12.7)*.28 + noise(p*4.07+31.1)*.15;
}
float bell(float v) { return exp(-v*v); }

void main() {
    vec2 p = vec2(uv.x, 1.-uv.y);
    vec2 anchor = vec2(.5,mode>.5 ? .5 : horizon);
    vec2 q = (p-anchor)*scale+anchor;
    vec2 offset = phases.xy*2.;
    vec2 warp = vec2(fbm(q*3.+offset), fbm(q*3.+offset+20.))-.5;
    q += warp*flow*.27;
    if (phases.w > 3.141593) q.x = 1.-q.x;
    q.x += sin(q.y*5.+phases.z)*flow*.035;

    // The same pigment coordinates are sampled at every export resolution.
    vec2 gp = p*1920.*vec2(1.,artboard.y/artboard.x)/grainSize;
    float fine = hash(floor(gp*1.8)+vec2(seed,seed*.37))-.5;
    float particle = hash(floor(gp*.73)+vec2(seed*.17,seed))-.5;
    float clusters = fbm(gp*.085+offset);
    float dust = fine*.46+particle*.54;
    float density = .5+clusters*1.2;
    float mottling = fbm(q*32.+offset);
    vec3 color = sky;
    float coverage = 0.;

    for (int i=0; i<6; i++) {
        vec4 f = layers[i], style = layerStyles[i];
        float id = float(i);
        float x = q.x;
        float wave = sin(x*(5.+complexity)+style.y)*.023
            + sin(x*(11.+complexity*2.)+style.y*2.)*.009*(complexity-1.);
        float crest = bell((x-f.x)/f.y);
        float y = horizon+f.z-relief*f.w*crest+style.x*(x-.5);
        if (i==1) y = horizon+.15+relief*(f.z-.15+f.w*smoothstep(f.x-.12,f.x+f.y*1.7,x));
        if (i==3) y = horizon+.15+relief*(f.z-.15+f.w*(1.-smoothstep(f.x-f.y*1.7,f.x+.12,x)));
        if (i==0) y -= relief*(.04+.025*complexity)*abs(fields[0].w)*bell((x-fields[0].x)/fields[0].z);
        if (i==2) y += .21*bell((x+.06)/.26);
        // A foreground fold rises into the basin, then opens out of frame.
        if (i==4) y += .20*bell((x+.08)/.35);
        y += relief*flow*wave*2.;
        y += (fbm(vec2(x*(4.+complexity),id*9.)+offset)-.5)*.055*flow;
        float d = q.y-y;
        if (mode>.5) {
            // Independent rotated lobes; no periodic color ramp or horizon.
            float angle = style.y;
            vec2 v = q-fields[i].xy;
            v = mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*v;
            d = .21+fields[i].z*.5-length(v/vec2(1.35,.72));
            d += flow*(fbm(q*(3.+complexity)+id*7.+offset)-.5)*.45;
        }
        float localSoft = .55+.85*fbm(q*6.+id*11.+offset);
        float edge = (.002+softness*.045)*style.z*localSoft;
        float disturbance = grain*(dust*.033*density + (mottling-.5)*.018);
        float mask = smoothstep(-edge,edge,d+disturbance);

        vec3 base = colors[0];
        if (i==1 || i==3 || i==4) base = colors[1];
        if (i==2 || i==5) base = colors[2];
        float body = fbm(q*vec2(7.,10.)+id*13.+offset);
        float warmth = bell((x-f.x-style.w)/(.027+f.y*.06))
            *bell((d-.025)/.055);
        vec3 pigment = base;
        if (i==0) {
            pigment = mix(base,colors[2],.15*body*body);
            pigment = mix(pigment,colors[3],warmth*.83);
        } else if (i==2 || i==5) {
            pigment = mix(base,colors[0],.10+body*.13);
            pigment = mix(pigment,colors[4],.13+body*.35);
            pigment = mix(pigment,colors[0],.13*bell((body-.24)*8.));
            pigment = mix(pigment,colors[3],warmth*.30);
        } else {
            pigment = mix(base,colors[5],smoothstep(.01,.15,d)*.55+body*.2);
            pigment *= .86+.17*body+.1*smoothstep(.02,.20,d);
            pigment = mix(pigment,colors[0],bell(d/.022)*.14);
        }
        // Separate color fields keep hue variation independent of shape and grain.
        float frequency = mix(17.,2.,(toneScale-20.)/180.);
        float field = noise(q*frequency*.45+offset+id*8.3)*.8
            + noise(q*frequency+offset+id*8.3)*.2;
        float positive = pow(clamp((field-.18)/.72,0.,1.),1.7)*(.4+.6*bell(d/.22));
        float negative = pow(clamp((.80-field)/.75,0.,1.),1.8)*(.35+.5*smoothstep(.01,.18,d));
        positive = max(positive,warmth*.85);
        if (toneCharacter>.5 && toneCharacter<1.5) {
            float pearl = .5+.5*sin((q.x+q.y*.65)*frequency*.45+field*2.+style.y);
            positive = pow(pearl,1.5)*.85;
            negative = pow(1.-pearl,1.5)*.75;
        } else if (toneCharacter>1.5) {
            float rim = bell(d/(.055+.13*field));
            float heat = clamp(.3+field*.5+rim*.32,0.,1.);
            positive = smoothstep(.3,.99,heat)*.9;
            negative = (1.-field)*(.6-.35*rim)*.85;
        }
        vec3 low = adjacent[0], high = adjacent[3];
        if (i==1 || i==3 || i==4) { low=adjacent[1]; high=adjacent[4]; }
        if (i==2 || i==5) { low=adjacent[2]; high=adjacent[5]; }
        pigment = mix(pigment,low,negative*toneAmount*.92);
        pigment = mix(pigment,high,positive*toneAmount*.94);
        // Neighbor reflection extends inside a mass; softness still owns opacity.
        float bleed = toneAmount*toneBleed*bell((d-.024)/(.023+softness*.07))*(.3+.7*body);
        pigment = mix(pigment,color,bleed*.52);
        // Tonal relief belongs to each mass; it is not a sequence of stripes.
        pigment += (body-.5)*.05;
        pigment = (pigment-.5)*contrast+.5;
        float core = bell(d/(.004+softness*.01));
        float aura = bell(d/(.012+halo*.09));
        float illumination = .3+.7*fbm(q*5.+id*19.+offset);
        vec3 tint = mix(mix(colors[2],colors[3],.4),adjacent[5],toneAmount*.6);
        vec3 haloTint = mix(tint,adjacent[2],toneAmount*.75);
        pigment = mix(pigment,tint,glow*core*.78*illumination);
        pigment += glow*aura*illumination*vec3(.18,.12,.065);
        // Colored aggregates and finer particles mix pigments at the edges.
        float fleck = (dust*density*.09 + (clusters-.5)*.055)*grain;
        pigment += fleck;
        vec3 deposit = i==2 || i==5 ? colors[0] : colors[1];
        pigment = mix(pigment,deposit,grain*smoothstep(.24,.48,particle)*(.08+.16*clusters));
        float outsideHalo = aura*(1.-mask)*glow*.25*illumination;
        color = mix(color,haloTint,outsideHalo);
        float reflection = bell(d/(edge*2.5+.015))*(1.-mask)*toneAmount*toneBleed*.13;
        color = mix(color,haloTint,reflection);
        color = mix(color,clamp(pigment,0.,1.),mask);
        coverage = max(coverage,mask);
    }
    // Atmospheric pigment near the terrain leaves the open sky exact.
    color += (mottling-.5)*grain*.012*coverage;
    gl_FragColor = vec4(clamp(color,0.,1.),1.);
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
            contrast: s.contrast/100, grain: s.grain/100, grainSize: s.grainSize, seed: s.seed % 16381,
            toneAmount:s.toneAmount/100, toneScale:s.toneScale, toneBleed:s.toneBleed/100,
            toneCharacter:['pigment','pearlescent','radiant'].indexOf(s.toneCharacter) };
        for (const name of ['mode','scale','complexity','flow','horizon','relief','softness','glow','halo','contrast','grain','grainSize','seed','toneAmount','toneScale','toneBleed','toneCharacter']) {
            gl.uniform1f(this.location(name), values[name]);
        }
        gl.uniform2f(this.location('artboard'),s.width,s.height);
        gl.uniform4fv(this.location('phases'),scene.phases);
        gl.uniform4fv(this.location('fields[0]'),scene.fields.flat());
        gl.uniform3fv(this.location('sky'),hexRGB(s.sky));
        gl.uniform4fv(this.location('layers[0]'),scene.layers.flat());
        gl.uniform4fv(this.location('layerStyles[0]'),scene.layerStyles.flat());
        gl.uniform3fv(this.location('colors[0]'),materialColors(s).flat());
        gl.uniform3fv(this.location('adjacent[0]'),adjacentColors(s).flat());
        gl.drawArrays(gl.TRIANGLES,0,6);
        const error = gl.getError();
        if (error !== gl.NO_ERROR) throw new Error('Graphics allocation failed. Reduce export size.');
        this.cacheKey = key;
        return this.canvas;
    }
    destroy() {
        const gl = this.gl;
        gl.deleteBuffer(this.buffer); gl.deleteProgram(this.program);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        this.canvas.width = this.canvas.height = 1;
    }
}
