// Material shader before the 15 October 2026 GPU optimization.
// Frozen visual reference; do not regenerate from the optimized shader.

precision highp float;
varying vec2 uv;
uniform vec2 artboard, rasterSize;
uniform vec4 renderRegion;
uniform vec4 formAffine[32], materialA[32], materialB[32];
uniform vec3 crests[32];
uniform vec4 pockets[32], formPhases[32], formTransforms[32];
uniform vec4 fields[32], layers[32], layerStyles[32], foldFields[32];
uniform vec4 geometryA[32], geometryB[32], formInfo[32];
uniform float editorPass, layerCount, backgroundAlpha, exportLayer;
uniform sampler2D paintAtlas, customPalette, floraAtlas, floraColors;
uniform vec4 floraBounds[32], floraMeta[32];
uniform vec2 floraAtlasSize, floraCellSize;
uniform float floraColumns, floraMode;
uniform vec4 paintBounds[32], paintMeta[32];
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
// Each atlas tile has its own bounds: displaced edge samples must never read
// a neighboring layer's pixels. Distances use the same coordinates as editing.
float floraDistanceAt(vec2 point, vec4 bounds, vec2 size, vec2 tile) {
    vec2 at=(point-bounds.xy)/bounds.zw;
    if(at.x<0.||at.x>1.||at.y<0.||at.y>1.)return -2.;
    vec2 pos=(tile*floraCellSize+at*(size-1.)+.5)/floraAtlasSize;
    return dot(texture2D(floraAtlas,pos).rg,vec2(65280.,255.))/65535.*2.-1.;
}
float paintedDistanceAt(float d, vec2 point, vec4 bounds, vec4 meta, vec2 tile) {
    if(meta.z<.5)return d;
    vec2 at=(point-bounds.xy)/bounds.zw;
    if(at.x<0.||at.x>1.||at.y<0.||at.y>1.)return d;
    vec2 pos=(tile*paintCellSize+at*(meta.xy-1.)+.5)/paintAtlasSize;
    vec4 encoded=texture2D(paintAtlas,pos);
    vec2 limits=vec2(dot(encoded.rg,vec2(65280.,255.)),dot(encoded.ba,vec2(65280.,255.)))/65535.*2.-1.;
    if(limits.y<.9999)d=min(d,limits.y);
    if(limits.x>-.9999)d=max(d,limits.x);
    return d;
}
vec2 foldPoint(vec2 p, vec4 f, float strength, float mode, float horizon) {
    vec2 center=vec2(f.x,(mode>.5 ? .13 : horizon)+f.y);
    vec2 v=p-center;
    float influence=exp(-dot(v/vec2(f.z,f.z*.85),v/vec2(f.z,f.z*.85)));
    float angle=f.w*influence*strength;
    return center+mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*v;
}

void main() {
    vec2 p = (renderRegion.xy+vec2(gl_FragCoord.x,renderRegion.w-gl_FragCoord.y))/rasterSize;

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
    if(floraMode>.5 && grain>0.)background*=1.+grain*.4*(spray(gp+vec2(41.7),1.,footprint).y-.5)*resolve;
    vec3 color=background*backgroundAlpha, underpaint=background;
    float alpha=backgroundAlpha;

    float picked = 0.; float previousFloraDistance=-2.;
    for (int i=0; i<32; i++) {
        if(float(i)>=layerCount || (exportLayer>=0. && float(i)>exportLayer))break;
        bool isolated=editorPass>1.5;
        if(isolated&&abs(float(i)-(editorPass-2.))>.1)continue;
        float grain=materialA[i].x,grainSize=materialA[i].y,softness=materialA[i].z,glow=materialA[i].w;
        float edgeVariation=materialB[i].x,halo=materialB[i].y,glowCoverage=materialB[i].z,contrast=materialB[i].w;
        vec2 gp=p*2688.*vec2(1.,artboard.y/artboard.x)/grainSize;
        float footprint=max(2688./rasterSize.x,2688.*artboard.y/artboard.x/rasterSize.y)/grainSize;
        float resolve=min(1.,1.5/footprint);
        vec4 info=formInfo[i], ga=geometryA[i], gb=geometryB[i];
        float opacity=info.z;
        if(!isolated&&opacity<=0.)continue;
        int kind=int(info.x), group=int(info.y);
        float scale=ga.x, complexity=ga.y, flow=ga.z, folds=ga.w;
        float horizon=gb.x, relief=gb.y, mode=gb.z;
        vec3 secondCrest=crests[i];vec4 pocketStyle=pockets[i];
        vec4 phases = formPhases[i], transform = formTransforms[i];
        vec2 point = p;
        vec4 affine=formAffine[i];
        if (transform != vec4(0.,0.,1.,1.) || affine != vec4(1.,0.,1.,1.)) {
            float aspect=artboard.x/artboard.y;
            vec2 v=(p-.5-transform.xy)*vec2(aspect,1.);
            v=vec2(v.x*affine.x+v.y*affine.y,-v.x*affine.y+v.y*affine.x);
            point=v/vec2(aspect,1.)/transform.zw*affine.zw+.5;
        }
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
        vec4 floraSample=vec4(0.);vec4 flowerColor=vec4(0.);
        if(mode>1.5){
            vec4 b=floraBounds[i];vec2 at=(point-b.xy)/b.zw;d=-2.;
            if(at.x>=0.&&at.x<=1.&&at.y>=0.&&at.y<=1.){
                vec2 tile=vec2(mod(float(i),floraColumns),floor(float(i)/floraColumns));
                vec2 pos=(tile*floraCellSize+at*(floraMeta[i].xy-1.)+.5)/floraAtlasSize;
                floraSample=texture2D(floraAtlas,pos);flowerColor=texture2D(floraColors,pos);
                d=dot(floraSample.rg,vec2(65280.,255.))/65535.*2.-1.;
            }
            surface=point; x=point.x; id=info.w*.013+floraMeta[i].z;
        }
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
        float floraBridge=0.;
        if(mode>1.5){
            float original=d;
            if(!isolated&&floraMeta[i].w>0.) {
                float radius=.07*floraMeta[i].w;
                float proximity=max(1.-abs(d-previousFloraDistance)/radius,0.);
                // Add only the local bridge between nearby contours. Taking the
                // full union copies a neighbor's edge; switching it off at d=0
                // creates a discontinuity through the soft alpha gradient.
                floraBridge=radius*.25*proximity*proximity;
                d+=floraBridge;
            }
            if(!isolated&&floraMeta[i].w>=0.)previousFloraDistance=max(previousFloraDistance,original);
        }
        float edgeField=fbm(surface*vec2(5.,8.)+id*11.+offset);
        float localSoft=mix(1.,mix(.20,2.1,smoothstep(.25,.75,edgeField)),edgeVariation);
        float floraSoft=mix(1.,mix(.13,1.85,smoothstep(.28,.72,edgeField)),edgeVariation);
        float edge=mode>1.5?(.004+softness*.052)*floraSoft:(.002+softness*.045)*style.z*localSoft;
        float smoothMask=smoothstep(-edge,edge,d);
        if (editorPass > .5) {
            if (smoothMask >= .5) picked = float(i+1);
            continue;
        }
        if(mode>1.5 && edgeVariation>0.) {
            // A short directional exposure, varied over broad patches of each
            // plant. Convolve coverage before spray, so pigment flecks stay fine.
            vec2 flowPoint=point*vec2(artboard.x/artboard.y,1.);
            float drift=noise(flowPoint*2.7+offset+id*3.1);
            float angle=hash(vec2(info.w,floraMeta[i].z+43.))*6.283185+(drift-.5)*1.8;
            float travel=(.008+softness*.085)*edgeVariation*mix(.12,1.,smoothstep(.25,.72,drift));
            vec2 direction=vec2(cos(angle)*artboard.y/artboard.x,sin(angle));
            // Outside this band all taps have the same opaque/clear coverage.
            if(abs(d)<edge+travel*1.17+.006) {
                vec2 floraTile=vec2(mod(float(i),floraColumns),floor(float(i)/floraColumns));
                vec2 paintTile=vec2(mod(float(i),paintColumns),floor(float(i)/paintColumns));
                float coverage=smoothMask,weight=1.;
                // Keep adjacent taps overlapping even at the sharpest setting.
                float tapEdge=max(edge,travel/6.);
                for(int tap=1;tap<=6;tap++) {
                    float t=float(tap)/6.,w=1.-.75*t;
                    vec2 samplePoint=point-direction*travel*t;
                    float sampleD=floraDistanceAt(samplePoint,floraBounds[i],floraMeta[i].xy,floraTile);
                    sampleD=paintedDistanceAt(sampleD,samplePoint,paintBounds[i],paintMeta[i],paintTile);
                    coverage+=w*smoothstep(-tapEdge,tapEdge,sampleD+floraBridge);
                    weight+=w;
                }
                smoothMask=mix(smoothMask,coverage/weight,.85);
            }
        }
        vec2 droplets=vec2(smoothMask,.5);
        if (grain>0. && smoothMask>0.) {
            // Rotate and offset each coat: adjacent paints never share a stencil.
            float angle=id*2.399963;
            vec2 point=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*gp;
            point+=vec2(info.w*.17,info.w*.37)+id*vec2(107.,191.);
            droplets=spray(point,smoothMask,footprint);
        }
        float sprayAmount=grain*resolve*(mode>1.5?1.65:1.);
        float mask=mix(smoothMask,droplets.x,min(1.,sprayAmount))*opacity;

        vec3 base = colors[0];
        if (group==1) base = colors[1];
        if (group==2) base = colors[2];
        if (group==3) base = sky;
        float customRow=(float(group)-4.+.5)/float(16);
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
        if(mode>1.5){
            float assigned=smoothstep(.03,.12,length(base-flowerColor.rgb))*flowerColor.a;
            low=mix(low,flowerColor.rgb*.58,assigned);
            high=mix(high,mix(flowerColor.rgb,colors[2],.48),assigned);
            base=mix(base,flowerColor.rgb,flowerColor.a);
            // Broad pigment fields cross petals and stems instead of shading
            // every part as an inflated object. Their frequency follows Patch size.
            vec2 growth=point*vec2(artboard.x/artboard.y,1.);
            vec2 fieldOffset=offset+vec2(17.3,49.1);
            float wash=noise(growth*frequency*.38+fieldOffset)*.76
                +noise(growth*frequency*.85+fieldOffset+31.)*.24;
            float lightPatch=smoothstep(.43,.68,wash);
            if(toneCharacter>.5&&toneCharacter<1.5)
                lightPatch=smoothstep(.25,.8,.5+.5*sin((growth.x+growth.y*.6)*frequency*.7+wash*3.));
            float darkPatch=1.-smoothstep(.24,.43,wash);
            float edgeAccent=bell(d/(.015+.055*wash))*smoothstep(.50,.72,patch);
            float bright=clamp(lightPatch*.85+edgeAccent*.26,0.,1.);
            vec3 lightPigment=mix(high,colors[2],smoothstep(.68,.86,wash)*.60);
            pigment=mix(base,low,darkPatch*.18*toneAmount);
            pigment=mix(pigment,lightPigment,bright*toneAmount);
            // Fine color flecks concentrate where pigments meet. No broad noise
            // islands or per-petal shadow masks; Grain 0 removes all speckles.
            float colorTransition=4.*bright*(1.-bright);
            float fleck=clamp((droplets.y-.5)*3.4,-1.,1.);
            float scatter=grain*resolve*toneAmount*(.12+.55*colorTransition);
            pigment=mix(pigment,lightPigment,max(fleck,0.)*scatter);
            pigment=mix(pigment,base,max(-fleck,0.)*scatter);

        }
        // Broad reflected color and narrow folds share the surface coordinates.
        float reflectionPatch=smoothstep(.44,.72,patch)*bell((d-.065)/.15);
        vec3 reflected=mix(colors[4],adjacent[2],.55);
        if(group<3&&mode<1.5)pigment=mix(pigment,reflected,reflectionPatch*toneAmount*toneBleed*.42);
        if (group==1&&mode<1.5) pigment=mix(pigment,colors[0],crease*warmth*toneAmount*.45);
        // Neighbor reflection extends inside a mass; softness still owns opacity.
        float bleed = toneAmount*toneBleed*bell((d-.024)/(.023+softness*.07))*(.3+.7*body);
        pigment = mix(pigment,underpaint,bleed*(mode>1.5?.07:.52));
        // Tonal relief belongs to each mass; it is not a sequence of stripes.
        pigment += (body-.5)*(mode>1.5?.012:.05);
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
        pigment*=1.+grain*(mode>1.5?.65:.16)*(.5-droplets.y)*resolve;
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
