import { getLayers } from './layer-data.js?v=layers-zip-1';
import { SeededRandom } from '../infra/framework/src/index.js';
import { normalizeSettings, layouts, toneKeys, formSettingsKey } from './document.js?v=layers-zip-1';

// Geometry is independent of the palette, texture and raster resolution.
// Coordinates are normalized; this is the extension point for future painted fields.
function generatedScene(settings) {
    const s = normalizeSettings(settings);
    const random = new SeededRandom(s.seed).fork('landforms-v2');
    const between = (a, b) => random.float(a, b);
    // Each surface has its own center, width, elevation and lift. Side banks
    // extend outside the frame; the basin and foreground can occlude them.
    const layers = [
        [between(.24,.78), between(.13,.32), between(.04,.09), between(.23,.37)],
        [between(-.08,.08), between(.29,.44), between(-.06,.03), between(.48,.64)],
        [between(.22,.53), between(.18,.34), between(.24,.34), between(.14,.25)],
        [between(.92,1.08), between(.28,.46), between(-.06,.04), between(.47,.63)],
        [between(.43,.78), between(.12,.27), between(.32,.42), between(.12,.24)],
        [between(.49,.87), between(.13,.29), between(.44,.56), between(.16,.28)]
    ];
    const foldRandom = new SeededRandom(s.seed).fork('folds-v3');
    const foldFields = layers.map(() => [foldRandom.float(.2,.85), foldRandom.float(.16,.43),
        foldRandom.float(.16,.31), foldRandom.float(-2.6,2.6)]);
    const phases=Array.from({length:4},()=>between(0,Math.PI*2));
    const layerStyles=layers.map(()=>[between(-.13,.13),between(0,6.28),between(.55,1.5),between(-.07,.07)]);
    const fields=Array.from({length:6},()=>[between(-.1,1.1),between(.1,1.2),between(.12,.36),between(-1.1,1.1)]);
    // A separate random stream changes the layout without disturbing existing
    // basin seeds, material variation, or independent abstract compositions.
    const composition=new SeededRandom(s.seed).fork('composition-v4');
    const next=(a,b)=>composition.float(a,b);
    const auto=Math.floor(next(0,4));
    const family=s.mode==='abstract' ? 0 : (s.layout==='auto' ? auto : Object.keys(layouts).indexOf(s.layout)-1);
    let secondCrest=[fields[0][0],fields[0][2],(.04+.025*s.complexity)*Math.abs(fields[0][3])];
    let pocketStyle=[.14+layers[4][1]*.5,.065+s.relief/100*.065,0,.43];
    if(family===1) {
        // A long off-centre ridge and an open diagonal foreground.
        layers[0]=[next(.04,.25),next(.40,.62),next(.08,.13),next(.32,.44)];
        layerStyles[0][0]=next(.10,.18);
        layers[2]=[next(.56,.85),next(.30,.45),next(.27,.36),next(.10,.17)];
        layers[4][0]=next(.64,.92);layers[4][2]=next(.37,.47);
        layerStyles[2][0]=next(-.22,-.12);layerStyles[5][0]=next(.10,.20);
        layers[5][2]=next(.58,.69);secondCrest[2]*=.4;
    } else if(family===2) {
        // Two unequal shoulders around a valley, with a broad light passage.
        layers[0]=[next(.08,.24),next(.17,.26),next(.06,.10),next(.28,.42)];
        secondCrest=[next(.73,.94),next(.19,.32),next(.21,.36)];
        layers[2]=[next(.35,.62),next(.27,.40),next(.22,.29),next(.19,.30)];
        layers[4][0]=next(.12,.36);layers[4][2]=next(.39,.48);
        layers[5][2]=next(.56,.65);layerStyles[5][0]=next(-.20,-.10);
    } else if(family===3) {
        // One tall folded mass becomes the focus, rather than another low band.
        layers[0]=[next(.13,.35),next(.25,.40),next(.09,.14),next(.15,.26)];
        layers[4][0]=next(.58,.84);layers[4][2]=next(.10,.18);layers[4][3]=next(.25,.33);
        layers[2][2]=next(.27,.36);layers[5][2]=next(.61,.70);
        layerStyles[4][2]=next(.22,.45);
        pocketStyle=[next(.11,.17),next(.21,.27),next(-.35,.35),next(.49,.56)];
        foldFields[4]=[layers[4][0],layers[4][2]-.035,next(.20,.28),next(-2.1,2.1)];
        secondCrest[2]*=.35;
    }
    return {
        version:4, layoutFamily:family,
        foldFields, folds:s.folds/100, phases, layers, layerStyles, fields,
        secondCrest,pocketStyle,
        mode: s.mode === 'abstract' ? 1 : 0,
        scale: 100 / s.scale, complexity: s.complexity,
        flow: s.flow / 100, horizon: s.horizon / 100, relief: s.relief / 100
    };
}

export function createScene(settings) {
    const s = normalizeSettings(settings), scene = generatedScene(s);
    const edits = s[formSettingsKey(s.mode)];
    const sources = new Map([[s.seed + ':' + s.layout, scene]]);
    scene.formPhases = [];
    scene.formTransforms = [];
    scene.formSeeds = [];
    for (let i=0;i<6;i++) {
        const edit = edits?.[i];
        let source = scene;
        if (edit) {
            const key = edit.seed + ':' + edit.layout;
            if (!sources.has(key)) sources.set(key, generatedScene({...s,seed:edit.seed,layout:edit.layout}));
            source = sources.get(key);
        }
        // Build arrays first: the source scene may be the default scene itself.
        scene.formPhases.push([...source.phases]);
        scene.formTransforms.push(edit ? [edit.x,edit.y,edit.scaleX,edit.scaleY] : [0,0,1,1]);
        scene.formSeeds.push((edit?.seed ?? s.seed) % 16381);
        for (const key of ['layers','layerStyles','foldFields','fields']) scene[key][i] = [...source[key][i]];
        if (i===0) scene.secondCrest = [...source.secondCrest];
        if (i===4) scene.pocketStyle = [...source.pocketStyle];
    }
    return scene;
}

// Ordered layer slots carry their own geometry source and material role. Moving
// a row never changes the seed, source type or color group of that layer.
export function createLayerScene(settings) {
    const s=normalizeSettings(settings),stack=getLayers(s),sources=new Map();
    return stack.map(layer=>{
        const params=layer.mode==='drawn'?{...s,...layer.geometry}:s;
        const key=JSON.stringify([layer.seed,layer.layout,params.scale,params.complexity,params.flow,params.folds,params.horizon,params.relief]);
        if(!sources.has(key))sources.set(key,generatedScene({...params,seed:layer.seed,layout:layer.layout}));
        const source=sources.get(key),i=layer.source;
        return {...layer,phases:source.phases,transform:[layer.x,layer.y,layer.scaleX,layer.scaleY],
            field:source.fields[i],shape:source.layers[i],style:source.layerStyles[i],foldField:source.foldFields[i],
            crest:source.secondCrest,pocket:source.pocketStyle,
            geometryA:[source.scale,source.complexity,source.flow,source.folds],
            geometryB:[source.horizon,source.relief,source.mode,layer.hasBase?1:0],
            info:[i,['terrain','depth','light'].indexOf(layer.group),layer.visible?layer.opacity/100:0,layer.seed%16381]};
    });
}

export function hexRGB(hex) {
    return hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255);
}

// Perceptual interpolation keeps automatic half-tones luminous between anchors.
function toLab(rgb) {
    const [r,g,b] = rgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const l = Math.cbrt(.4122214708*r + .5363325363*g + .0514459929*b);
    const m = Math.cbrt(.2119034982*r + .6806995451*g + .1073969566*b);
    const s = Math.cbrt(.0883024619*r + .2817188376*g + .6299787005*b);
    return [.2104542553*l + .793617785*m - .0040720468*s,
        1.9779984951*l - 2.428592205*m + .4505937099*s,
        .0259040371*l + .7827717662*m - .808675766*s];
}
function linearRGB([L,a,b]) {
    const l = (L + .3963377774*a + .2158037573*b) ** 3;
    const m = (L - .1055613458*a - .0638541728*b) ** 3;
    const s = (L - .0894841775*a - 1.291485548*b) ** 3;
    return [4.0767416621*l - 3.3077115913*m + .2309699292*s,
        -1.2684380046*l + 2.6097574011*m - .3413193965*s,
        -.0041960863*l - .7034186147*m + 1.707614701*s];
}
function fromLab(lab) {
    return linearRGB(lab).map(v => {
            const c = v <= .0031308 ? v * 12.92 : 1.055 * Math.max(0, v) ** (1/2.4) - .055;
            return Math.round(Math.max(0, Math.min(1, c)) * 255);
        });
}
export function paletteLUT(settings) {
    const s = normalizeSettings(settings);
    const stops = [[0, s.depth], [.12, s.depth], [.36, s.terrain], [.63, s.terrain], [.88, s.light], [1, s.light]]
        .map(([at, hex]) => [at, toLab(hexRGB(hex))]);
    const data = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
        const x = i / 255;
        const j = Math.min(stops.length - 2, stops.findIndex((p, index) => index < stops.length - 1 && x <= stops[index+1][0]));
        const [start, a] = stops[Math.max(0, j)], [end, b] = stops[Math.max(0, j) + 1];
        let t = (x - start) / (end - start); t = Math.max(0, Math.min(1, (t-.5) / (.18 + s.softness/100*1.4) + .5)); t = t*t*(3-2*t);
        data.set([...fromLab(a.map((v,k) => v + (b[k]-v)*t)), 255], i*4);
    }
    return data;
}

// Derive warm crests and cool reflected light from the user's anchors. No
// reference-specific RGB colors are baked into the material or the geometry.
export function materialColors(settings) {
    const s = normalizeSettings(settings);
    const terrain = toLab(hexRGB(s.terrain)), light = toLab(hexRGB(s.light));
    const sky = toLab(hexRGB(s.sky)), depth = toLab(hexRGB(s.depth));
    const chroma = Math.hypot(terrain[1], terrain[2]);
    const angle = Math.atan2(terrain[2], terrain[1]) + .62;
    const warm = [Math.min(.94,terrain[0]+.075), chroma*Math.cos(angle), chroma*Math.sin(angle)];
    const cool = light.map((v,i) => (v*.90 + sky[i]*.10) * (i === 0 ? .98 : 1.35));
    const earth = depth.map((v,i) => v*.82 + terrain[i]*.18);
    return [hexRGB(s.terrain), hexRGB(s.depth), hexRGB(s.light),
        ...[warm,cool,earth].map(lab => fromLab(lab).map(v => v/255))];
}

// Low/high neighbors for terrain, depth and light, in that order. All endpoints
// are derived from the four anchors in OKLCH unless explicitly overridden.
// Null overrides keep following the anchors; neither mode changes geometry.
export function adjacentColors(settings) {
    const s = normalizeSettings(settings), spread = s.toneSpread/100;
    const labs = [s.terrain,s.depth,s.light,s.sky].map(hex => toLab(hexRGB(hex)));
    const polar = labs.map(([L,a,b]) => [L,Math.hypot(a,b),Math.atan2(b,a)]);
    const profile = {
        pigment: { hue: .8, light: .09, chroma: 1.1 },
        pearlescent: { hue: 1.3, light: .12, chroma: 1.3 },
        radiant: { hue: 1.05, light: .18, chroma: 1.15 }
    }[s.toneCharacter];
    const delta = (a,b) => Math.atan2(Math.sin(b-a),Math.cos(b-a));
    const encode = (L,C,h) => {
        L=Math.max(.06,Math.min(.99,L));
        const lab=c=>[L,c*Math.cos(h),c*Math.sin(h)];
        const fits=c=>linearRGB(lab(c)).every(v=>v>=0 && v<=1);
        // Reduce chroma before conversion instead of clipping RGB channels and
        // unintentionally changing the hue of bright neighboring colors.
        if(!fits(C)) {
            let lo=0,hi=C;
            for(let step=0;step<12;step++) { const mid=(lo+hi)/2;if(fits(mid))lo=mid;else hi=mid; }
            C=lo;
        }
        return fromLab(lab(C)).map(v=>v/255);
    };
    const low=[],high=[];
    for (let i=0;i<3;i++) {
        const [L,C,h]=polar[i];
        let lowHue=h-spread*profile.hue*.95, highHue=h+spread*profile.hue*.6;
        let lowC=C*(1+spread*.18), highC=C*(1+spread*(profile.chroma-1));
        let lowL=L-profile.light*.65, highL=L+profile.light*.65;
        if(i===1) {
            highHue=h+delta(h,polar[0][2])*spread*.55;
            highL=L+profile.light;
        }
        if(i===2) {
            lowHue=h+delta(h,polar[3][2])*spread*profile.hue;
            lowC=C+(Math.max(C,polar[0][1]*.65)-C)*spread;
            lowL=L-profile.light*.6;
            highHue=h+delta(h,polar[0][2])*spread*.35;
            highC=C*(1-spread*.35);
            highL=L+profile.light*.6;
        }
        low.push(encode(lowL,lowC,lowHue));
        high.push(encode(highL,highC,highHue));
    }
    return [...low,...high].map((automatic, i) => s[toneKeys[i]] ? hexRGB(s[toneKeys[i]]) : automatic);
}
