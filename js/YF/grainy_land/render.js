import { MAX_CUSTOM_COLORS } from './custom-colors.js?v=custom-colors-1';
import { createLayerScene, materialColors, adjacentColors, customMaterialColors, hexRGB } from './scene.js?v=custom-colors-1';
import { bakePaint } from './paint.js?v=custom-colors-1';
import { MAX_LAYERS } from './layer-data.js?v=custom-colors-1';
import { normalizeSettings } from './document.js?v=custom-colors-1';

const vertexSource = `
attribute vec2 position;
varying vec2 uv;
void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }
`;
const fragmentSource = `
precision highp float;
varying vec2 uv;
uniform vec2 artboard, rasterSize;
uniform vec3 crests[${MAX_LAYERS}];
uniform vec4 pockets[${MAX_LAYERS}], formPhases[${MAX_LAYERS}], formTransforms[${MAX_LAYERS}];
uniform vec4 fields[${MAX_LAYERS}], layers[${MAX_LAYERS}], layerStyles[${MAX_LAYERS}], foldFields[${MAX_LAYERS}];
uniform vec4 geometryA[${MAX_LAYERS}], geometryB[${MAX_LAYERS}], formInfo[${MAX_LAYERS}];
uniform float editorPass, layerCount, backgroundAlpha, exportLayer;
uniform sampler2D paintAtlas, customPalette;
uniform vec4 paintBounds[${MAX_LAYERS}], paintMeta[${MAX_LAYERS}];
uniform vec2 paintAtlasSize, paintCellSize;
uniform float paintColumns;
uniform vec3 sky, colors[6], adjacent[8];
uniform float skyToneAmount, toneAmount, toneScale, toneBleed, toneCharacter;
uniform float edgeVariation, glowCoverage;
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
// Independent, jittered droplets. Filtering accounts for the pixel footprint so
// the same artwork coordinates stay fine in previews and round in larger PNGs.
vec2 spray(vec2 point, float coverage, float footprint) {
    vec2 cell=floor(point), local=fract(point);
    float paint=0., texture=0., total=0.;
    float filterWidth=min(footprint,1.5);
    for (int y=-1; y<=1; y++) for (int x=-1; x<=1; x++) {
        vec2 neighbor=vec2(float(x),float(y));
        vec2 key=cell+neighbor;
        vec2 center=vec2(hash(key+17.1),hash(key+83.7));
        vec2 delta=neighbor+center-local;
        float radius=mix(.24,.38,hash(key+41.3));
        float variance=radius*radius+filterWidth*filterWidth/12.;
        float weight=exp(-dot(delta,delta)/(2.*variance))/variance;
        // Several thin passes leave translucent flecks instead of opaque dots.
        float passes=step(hash(key+127.9),coverage)+step(hash(key+319.7),coverage)
            +step(hash(key+451.3),coverage);
        paint+=weight*passes/3.;
        texture+=weight*hash(key+231.4);
        total+=weight;
    }
    return vec2(paint,texture)/max(total,.0001);
}
float bell(float v) { return exp(-v*v); }
float smoothUnion(float a, float b, float k) {
    float h=clamp(.5+.5*(a-b)/k,0.,1.);
    return mix(b,a,h)+k*h*(1.-h);
}
vec2 foldPoint(vec2 p, vec4 f, float strength, float mode, float horizon) {
    vec2 center=vec2(f.x,(mode>.5 ? .13 : horizon)+f.y);
    vec2 v=p-center;
    float influence=exp(-dot(v/vec2(f.z,f.z*.85),v/vec2(f.z,f.z*.85)));
    float angle=f.w*influence*strength;
    return center+mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*v;
}

void main() {
    vec2 p = vec2(uv.x, 1.-uv.y);

    // Grain size is relative to the artwork, independent of export resolution.
    vec2 gp=p*2688.*vec2(1.,artboard.y/artboard.x)/grainSize;
    float footprint=max(2688./rasterSize.x,2688.*artboard.y/artboard.x/rasterSize.y)/grainSize;
    float resolve=min(1.,1.5/footprint);
    // Background tones are an optional opaque color field, independent of land geometry.
    // Keep it in underpaint even for transparent/layer exports so reflected colors agree.
    vec3 background=sky;
    float backgroundAmount=skyToneAmount*toneAmount;
    if(backgroundAmount>0.) {
        float frequency=mix(17.,2.,(toneScale-20.)/180.);
        vec2 offset=vec2(mod(seed,137.),floor(seed/137.))+vec2(47.3,91.7);
        vec2 q=p*vec2(1.,artboard.y/artboard.x);
        q+=(vec2(fbm(q*3.+offset),fbm(q*3.+offset+27.))-.5)*.15;
        float field=noise(q*frequency*.45+offset)*.7+noise(q*frequency+offset)*.3;
        float positive=pow(smoothstep(.3,.85,field),1.4);
        float negative=pow(1.-smoothstep(.18,.7,field),1.4);
        if(toneCharacter>.5 && toneCharacter<1.5) {
            float pearl=.5+.5*sin((q.x+q.y*.65)*frequency*.8+field*3.+offset.x);
            positive=pow(pearl,1.5)*.85;
            negative=pow(1.-pearl,1.5)*.75;
        } else if(toneCharacter>1.5) {
            positive=pow(smoothstep(.32,.82,field),2.)*.95;
            negative=smoothstep(.25,.75,1.-field)*.85;
        }
        background=mix(background,adjacent[6],negative*backgroundAmount*.92);
        background=mix(background,adjacent[7],positive*backgroundAmount*.88);
        // Use the same filtered pigment texture, without changing the opaque background alpha.
        if(grain>0.)background*=1.+grain*.04*backgroundAmount*(.5-spray(gp+offset,1.,footprint).y)*resolve;
    }
    vec3 color=background*backgroundAlpha, underpaint=background;
    float alpha=backgroundAlpha;

    float picked = 0.;
    for (int i=0; i<${MAX_LAYERS}; i++) {
        if(float(i)>=layerCount || (exportLayer>=0. && float(i)>exportLayer))break;
        bool isolated=editorPass>1.5;
        if(isolated&&abs(float(i)-(editorPass-2.))>.1)continue;
        vec4 info=formInfo[i], ga=geometryA[i], gb=geometryB[i];
        float opacity=info.z;
        if(!isolated&&opacity<=0.)continue;
        int kind=int(info.x), group=int(info.y);
        float scale=ga.x, complexity=ga.y, flow=ga.z, folds=ga.w;
        float horizon=gb.x, relief=gb.y, mode=gb.z;
        vec3 secondCrest=crests[i];vec4 pocketStyle=pockets[i];
        vec4 phases = formPhases[i], transform = formTransforms[i];
        vec2 point = p;
        if (transform != vec4(0.,0.,1.,1.)) point = (p-.5-transform.xy)/transform.zw+.5;
        vec2 anchor = vec2(.5,mode>.5 ? .5 : horizon);
        vec2 q = (point-anchor)*scale+anchor;
        vec2 offset = phases.xy*2.;
        vec2 warp = vec2(fbm(q*3.+offset), fbm(q*3.+offset+20.))-.5;
        q += warp*flow*.27;
        if (phases.w > 3.141593) q.x = 1.-q.x;
        q.x += sin(q.y*5.+phases.z)*flow*.035;

        vec4 f = layers[i], style = layerStyles[i];
        float id = info.x;
        // Local two-dimensional deformation lets one surface curl around another.
        vec2 surface = foldPoint(q,foldFields[i],folds*(kind==0 ? .25 : (kind==4 ? .65 : 1.)),mode,horizon);
        float x = surface.x;
        float wave = sin(x*(5.+complexity)+style.y)*.023
            + sin(x*(11.+complexity*2.)+style.y*2.)*.009*(complexity-1.);
        float crest = bell((x-f.x)/f.y);
        float y = horizon+f.z-relief*f.w*crest+style.x*(x-.5);
        if (kind==1) y = horizon+.15+relief*(f.z-.15+f.w*smoothstep(f.x-.12,f.x+f.y*1.7,x));
        if (kind==3) y = horizon+.15+relief*(f.z-.15+f.w*(1.-smoothstep(f.x-f.y*1.7,f.x+.12,x)));
        if (kind==0) y -= relief*secondCrest.z*bell((x-secondCrest.x)/secondCrest.y);
        if (kind==2) y += .21*bell((x+.06)/.26);
        // A foreground fold rises into the basin, then opens out of frame.
        if (kind==4) y += .20*bell((x+.08)/.35);
        y += relief*flow*wave*2.;
        y += (fbm(vec2(x*(4.+complexity),id*9.)+offset)-.5)*.055*flow;
        float d = surface.y-y;
        if (mode<.5 && kind==4) {
            // A rounded pocket with an open tail, independent of the horizon graph.
            vec2 v=surface-vec2(f.x,horizon+f.z-.065);
            v.y-=sin(v.x*6.+style.y)*.035;
            v=mat2(cos(pocketStyle.z),-sin(pocketStyle.z),sin(pocketStyle.z),cos(pocketStyle.z))*v;
            float pocket=(1.-length(v/pocketStyle.xy))*.09;
            float tail=surface.y-(horizon+pocketStyle.w+.08*sin(x*4.+style.y));
            d=mix(d,smoothUnion(pocket,tail,.055),folds);
        }
        if (mode>.5 && kind<6) {
            // Independent rotated lobes; no periodic color ramp or horizon.
            float angle = style.y;
            vec2 v = surface-fields[i].xy;
            v = mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*v;
            d = .21+fields[i].z*.5-length(v/vec2(1.35,.72));
            d += flow*(fbm(q*(3.+complexity)+id*7.+offset)-.5)*.45;
        }
        if(kind>=6) {
            // Two broad, independently editable sky coats, with irregular sprayed silhouettes.
            vec2 v=q-fields[i].xy;
            float angle=style.y;
            v=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*v;
            v+=(vec2(fbm(q*3.+offset+id*11.),fbm(q*3.+offset+id*11.+27.))-.5)*flow*.12;
            d=(1.-length(v/fields[i].zw))*min(fields[i].z,fields[i].w);
            d+=flow*(fbm(q*(3.+complexity*.4)+offset+id*7.)-.5)*.045;
        }
        if(gb.w<.5)d=-2.;
        if (paintMeta[i].z > .5) {
            vec4 bounds=paintBounds[i];
            vec2 at=(point-bounds.xy)/bounds.zw;
            if(at.x>=0. && at.x<=1. && at.y>=0. && at.y<=1.) {
                vec2 tile=vec2(mod(float(i),paintColumns),floor(float(i)/paintColumns));
                at=(tile*paintCellSize+at*(paintMeta[i].xy-1.)+.5)/paintAtlasSize;
                vec4 encoded=texture2D(paintAtlas,at);
                vec2 limits=vec2(dot(encoded.rg,vec2(65280.,255.)),dot(encoded.ba,vec2(65280.,255.)))/65535.*2.-1.;
                if(limits.y<.9999)d=min(d,limits.y);
                if(limits.x>-.9999)d=max(d,limits.x);
            }
        }
        float edgeField=fbm(surface*vec2(5.,8.)+id*11.+offset);
        float localSoft=mix(1.,mix(.20,2.1,smoothstep(.25,.75,edgeField)),edgeVariation);
        float edge=(.002+softness*.045)*style.z*localSoft;
        float smoothMask=smoothstep(-edge,edge,d);
        if (editorPass > .5) {
            if (smoothMask >= .5) picked = float(i+1);
            continue;
        }
        vec2 droplets=vec2(smoothMask,.5);
        if (grain>0. && smoothMask>0.) {
            // Rotate and offset each coat: adjacent paints never share a stencil.
            float angle=id*2.399963;
            vec2 point=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*gp;
            point+=vec2(info.w*.17,info.w*.37)+id*vec2(107.,191.);
            droplets=spray(point,smoothMask,footprint);
        }
        float mask=mix(smoothMask,droplets.x,grain*resolve)*opacity;

        vec3 base = colors[0];
        if (group==1) base = colors[1];
        if (group==2) base = colors[2];
        if (group==3) base = sky;
        float customRow=(float(group)-4.+.5)/float(${MAX_CUSTOM_COLORS});
        if (group>=4) base=texture2D(customPalette,vec2(1./6.,customRow)).rgb;
        float body = fbm(surface*vec2(5.,8.)+id*13.+offset);
        float patch=fbm(surface*vec2(4.,6.)+offset+id*5.7);
        float crease=bell((d-.04-.07*patch)/(.012+.024*body));
        float warmth = bell((x-f.x-style.w)/(.027+f.y*.06))
            *bell((d-.025)/.055);
        vec3 pigment = base;
        if (group==0) {
            pigment = mix(base,colors[2],.05*body*body);
            pigment = mix(pigment,colors[3],warmth*.66);
        } else if (group==2) {
            pigment = mix(base,colors[0],.13+smoothstep(.38,.72,patch)*.32);
            pigment = mix(pigment,colors[4],.18+body*.44);
            pigment = mix(pigment,colors[0],.13*bell((body-.24)*8.));
            pigment = mix(pigment,colors[3],warmth*.42);
        } else if(group>=4) {
            pigment=base*(.92+.12*body);
        } else if(group==3) {
            // Shade within the blue anchor; neighboring blue tones supply the variation.
            pigment=base*(kind==6 ? .84+.14*body : 1.02+.12*body);
        } else {
            pigment = mix(base,colors[5],smoothstep(.01,.15,d)*.32+body*.14);
            pigment *= .78+.20*body+.09*smoothstep(.02,.20,d);
            pigment = mix(pigment,colors[0],bell(d/.022)*.14);
        }
        // Separate color fields keep hue variation independent of shape and grain.
        float frequency = mix(17.,2.,(toneScale-20.)/180.);
        vec2 colorPoint=surface+vec2(sin(surface.y*7.+style.y),cos(surface.x*6.+style.y))*.025;
        float field = noise(colorPoint*frequency*.45+offset+id*8.3)*.7
            + noise(colorPoint*frequency+offset+id*8.3)*.3;
        float positive = pow(clamp((field-.18)/.72,0.,1.),1.7)*(.4+.6*bell(d/.22));
        float negative = pow(clamp((.80-field)/.75,0.,1.),1.8)*(.35+.5*smoothstep(.01,.18,d));
        positive = max(positive,warmth*.85);
        if (toneCharacter>.5 && toneCharacter<1.5) {
            float pearl = .5+.5*sin((q.x+q.y*.65)*frequency*.45+field*2.+style.y);
            positive = pow(pearl,1.5)*.85;
            negative = pow(1.-pearl,1.5)*.75;
        } else if (toneCharacter>1.5) {
            float rim=bell(d/(.025+.065*field));
            float accent=smoothstep(.34,.78,patch);
            positive=pow(field,2.8)*.40+rim*accent*.65+warmth*.48;
            negative=smoothstep(.28,.7,1.-field)*(.5+.25*crease);
            positive=clamp(positive,0.,.95);
        }
        vec3 low = adjacent[0], high = adjacent[3];
        if (group==1) { low=adjacent[1]; high=adjacent[4]; }
        if (group==2) { low=adjacent[2]; high=adjacent[5]; }
        if (group==3) { low=adjacent[6]; high=adjacent[7]; }
        if (group>=4) {
            low=texture2D(customPalette,vec2(.5,customRow)).rgb;
            high=texture2D(customPalette,vec2(5./6.,customRow)).rgb;
        }
        if (group==1) { negative*=.62; positive*=.62; }
        pigment = mix(pigment,low,negative*toneAmount*.92);
        pigment = mix(pigment,high,positive*toneAmount*.88);
        // Broad reflected color and narrow folds share the surface coordinates.
        float reflectionPatch=smoothstep(.44,.72,patch)*bell((d-.065)/.15);
        vec3 reflected=mix(colors[4],adjacent[2],.55);
        if(group<3)pigment=mix(pigment,reflected,reflectionPatch*toneAmount*toneBleed*.42);
        if (group==1) pigment=mix(pigment,colors[0],crease*warmth*toneAmount*.45);
        // Neighbor reflection extends inside a mass; softness still owns opacity.
        float bleed = toneAmount*toneBleed*bell((d-.024)/(.023+softness*.07))*(.3+.7*body);
        pigment = mix(pigment,underpaint,bleed*.52);
        // Tonal relief belongs to each mass; it is not a sequence of stripes.
        pigment += (body-.5)*.05;
        pigment = (pigment-.5)*contrast+.5;
        float lightField=fbm(surface*vec2(4.,7.)+id*19.+offset);
        float threshold=mix(.76,.12,glowCoverage);
        float illumination=smoothstep(threshold-.12,threshold+.16,lightField);
        float core=bell(d/((.003+softness*.012)*(.45+1.2*lightField)));
        float aura=bell(d/(.008+halo*.085));
        vec3 tint = mix(mix(colors[2],colors[3],.4),adjacent[5],toneAmount*.6);
        vec3 haloTint = mix(tint,adjacent[2],toneAmount*.75);
        if(group==3) { tint=mix(sky,adjacent[7],toneAmount);haloTint=tint; }
        if(group>=4) { tint=mix(base,high,toneAmount);haloTint=tint; }
        pigment = mix(pigment,tint,glow*core*.93*illumination);
        pigment += glow*aura*illumination*tint*.15;
        // Lighting samples untextured paint, never the grain in lower coats.
        float outsideHalo=aura*(1.-smoothMask)*glow*.25*illumination*opacity;
        float reflection=bell(d/(edge*2.5+.015))*(1.-smoothMask)*toneAmount*toneBleed*.13*opacity;
        underpaint=mix(underpaint,haloTint,outsideHalo);
        underpaint=mix(underpaint,haloTint,reflection);
        underpaint=mix(underpaint,clamp(pigment,0.,1.),smoothMask*opacity);
        // A dense coat retains only a very faint variation in its own pigment.
        // No gray noise, foreign-color deposits or mid-scale clumps are added.
        pigment*=1.+grain*.16*(.5-droplets.y)*resolve;
        // Premultiplied source-over coverage preserves translucent spray and glow.
        // Keep lower coats in underpaint for reflected colors, but output only this layer.
        if(exportLayer<0. || abs(float(i)-exportLayer)<.1) {
            alpha=mix(alpha,1.,outsideHalo);
            alpha=mix(alpha,1.,reflection);
            alpha=mix(alpha,1.,mask);
            color=mix(color,haloTint,outsideHalo);
            color=mix(color,haloTint,reflection);
            color=mix(color,clamp(pigment,0.,1.),mask);
        }
    }
    gl_FragColor = editorPass > .5 ? vec4(picked/255.,0.,0.,1.) : vec4(clamp(color,0.,1.),alpha);
}
`;

export class LandscapeRenderer {
    constructor() {
        this.canvas = document.createElement('canvas');
        const gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
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
        this.customTexture=gl.createTexture();this.customPaletteKey='';
        this.paintTexture=gl.createTexture();this.paintKeys=[];this.atlasShape='';
        this.canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.cacheKey = ''; });
    }
    location(name) {
        if (!this.locations.has(name)) this.locations.set(name, this.gl.getUniformLocation(this.program, name));
        return this.locations.get(name);
    }
    render(raw, width, height, editorPass = 0, transparent = false, exportLayer = -1) {
        const s = normalizeSettings(raw), gl = this.gl;
        if (gl.isContextLost()) throw new Error('Graphics context lost. Reload to restore the renderer.');
        const max = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
        if (width > max || height > max) throw new Error('This GPU cannot render that size. Reduce export scale.');
        const key = JSON.stringify([s,width,height,editorPass,transparent,exportLayer]);
        if (key === this.cacheKey) return this.canvas;
        this.canvas.width = width; this.canvas.height = height;
        gl.viewport(0,0,width,height); gl.useProgram(this.program);
        const scene = createLayerScene(s);
        this.uploadPaint(scene);
        this.uploadCustomColors(s);
        const values = { softness: s.softness/100, glow: s.glow/100, halo: s.halo/100,
            contrast: s.contrast/100, grain: s.grain/100, grainSize: s.grainSize, seed: s.seed % 16381,
            skyToneAmount:s.skyToneAmount/100, toneAmount:s.toneAmount/100, toneScale:s.toneScale, toneBleed:s.toneBleed/100,
            edgeVariation:s.edgeVariation/100, glowCoverage:s.glowCoverage/100,
            toneCharacter:['pigment','pearlescent','radiant'].indexOf(s.toneCharacter) };
        for (const name of ['softness','glow','halo','contrast','grain','grainSize','seed','skyToneAmount','toneAmount','toneScale','toneBleed','toneCharacter','edgeVariation','glowCoverage']) {
            gl.uniform1f(this.location(name), values[name]);
        }
        gl.uniform2f(this.location('artboard'),s.width,s.height);
        gl.uniform2f(this.location('rasterSize'),width,height);
        gl.uniform1f(this.location('editorPass'),editorPass);
        gl.uniform1f(this.location('backgroundAlpha'),transparent?0:1);
        gl.uniform1f(this.location('exportLayer'),exportLayer);
        gl.uniform1f(this.location('layerCount'),scene.length);
        for(const [uniform,key] of Object.entries({formPhases:'phases',formTransforms:'transform',fields:'field',layers:'shape',layerStyles:'style',foldFields:'foldField',pockets:'pocket',geometryA:'geometryA',geometryB:'geometryB',formInfo:'info'})) {
            const data=Array.from({length:MAX_LAYERS},(_,i)=>scene[i]?.[key]??[0,0,0,0]).flat();
            gl.uniform4fv(this.location(uniform+'[0]'),data);
        }
        gl.uniform3fv(this.location('crests[0]'),Array.from({length:MAX_LAYERS},(_,i)=>scene[i]?.crest??[0,0,0]).flat());
        gl.uniform3fv(this.location('sky'),hexRGB(s.sky));
        gl.uniform3fv(this.location('colors[0]'),materialColors(s).flat());
        gl.uniform3fv(this.location('adjacent[0]'),adjacentColors(s).flat());
        gl.drawArrays(gl.TRIANGLES,0,6);
        const error = gl.getError();
        if (error !== gl.NO_ERROR) throw new Error('Graphics allocation failed. Reduce export size.');
        this.cacheKey = key;
        return this.canvas;
    }
    uploadCustomColors(settings) {
        const gl=this.gl,key=JSON.stringify([settings.customColors,settings.toneCharacter,settings.toneSpread]);
        gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.customTexture);
        if(key!==this.customPaletteKey) {
            const pixels=new Uint8Array(3*MAX_CUSTOM_COLORS*4);
            customMaterialColors(settings).forEach((colors,row)=>colors.forEach((rgb,col)=>pixels.set([...rgb.map(v=>Math.round(v*255)),255],(row*3+col)*4)));
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,3,MAX_CUSTOM_COLORS,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
            this.customPaletteKey=key;
        }
        gl.uniform1i(this.location('customPalette'),1);
    }
    uploadPaint(scene) {
        const gl=this.gl,fields=scene.map(layer=>layer.strokes.length?bakePaint(layer.strokes):null);
        const any=fields.some(Boolean),columns=any?Math.min(4,scene.length):1,rows=any?Math.ceil(scene.length/columns):1;
        const cellW=Math.max(1,...fields.map(f=>f?.width??0)),cellH=Math.max(1,...fields.map(f=>f?.height??0));
        const width=cellW*columns,height=cellH*rows,shape=width+':'+height+':'+cellW+':'+cellH;
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.paintTexture);
        if(shape!==this.atlasShape) {
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
            this.paintKeys=[];this.atlasShape=shape;
        }
        for(let i=0;i<fields.length;i++) {
            const field=fields[i];
            if(field&&this.paintKeys[i]!==field.key)gl.texSubImage2D(gl.TEXTURE_2D,0,(i%columns)*cellW,Math.floor(i/columns)*cellH,field.width,field.height,gl.RGBA,gl.UNSIGNED_BYTE,field.pixels);
            this.paintKeys[i]=field?.key??null;
        }
        gl.uniform1i(this.location('paintAtlas'),0);
        gl.uniform2f(this.location('paintAtlasSize'),width,height);gl.uniform2f(this.location('paintCellSize'),cellW,cellH);gl.uniform1f(this.location('paintColumns'),columns);
        gl.uniform4fv(this.location('paintBounds[0]'),Array.from({length:MAX_LAYERS},(_,i)=>fields[i]?.bounds??[0,0,1,1]).flat());
        gl.uniform4fv(this.location('paintMeta[0]'),Array.from({length:MAX_LAYERS},(_,i)=>[fields[i]?.width??1,fields[i]?.height??1,fields[i]?1:0,0]).flat());
    }
    formMap(settings, width, height, isolatedIndex = null) {
        this.render(settings,width,height,isolatedIndex==null?1:isolatedIndex+2);
        const pixels = new Uint8Array(width*height*4), ids = new Uint8Array(width*height);
        this.gl.readPixels(0,0,width,height,this.gl.RGBA,this.gl.UNSIGNED_BYTE,pixels);
        for (let y=0;y<height;y++) for (let x=0;x<width;x++) ids[y*width+x]=pixels[((height-1-y)*width+x)*4];
        return {width,height,ids};
    }
    destroy() {
        const gl = this.gl;
        gl.deleteTexture(this.paintTexture);gl.deleteTexture(this.customTexture);
        gl.deleteBuffer(this.buffer); gl.deleteProgram(this.program);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        this.canvas.width = this.canvas.height = 1;
    }
}
