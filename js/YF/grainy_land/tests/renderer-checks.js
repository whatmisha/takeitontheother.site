import { LandscapeRenderer } from '../render.js?v=forms-3';
import { defaults, palettes } from '../document.js?v=forms-3';
const renderer = new LandscapeRenderer(), results = [], urls = [];
const check = (name, condition) => { results.push((condition ? 'PASS ' : 'FAIL ') + name); if (!condition) throw new Error(name); };
const capture = (settings,width=480,height=270) => {
    const canvas = document.createElement('canvas'); canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(renderer.render(settings,width,height),0,0);
    return {canvas,ctx,pixels:ctx.getImageData(0,0,width,height).data};
};
const equal = (a,b) => a.length===b.length && a.every((v,i)=>v===b[i]);
const artifact = async (name, settings, width, height) => {
    const {canvas, pixels} = capture(settings,width,height);
    const blob = await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    check(name+' encodes PNG', blob?.type==='image/png' && blob.size>1000);
    const bitmap=await createImageBitmap(blob);
    check(name+' has requested dimensions', bitmap.width===width && bitmap.height===height);
    bitmap.close();
    const url=URL.createObjectURL(blob);urls.push(url);
    const figure=document.createElement('figure');
    const image=document.createElement('img');image.src=url;image.alt=name+' rendered artwork';
    const link=document.createElement('a');link.href=url;link.download=name+'.png';link.textContent='Download '+name+' PNG';
    figure.append(image,link);document.getElementById('artifacts').append(figure);
    return pixels;
};
try {
    const initial=capture(defaults).pixels;
    check('Open sky is exactly #2353DB', equal(initial.slice(0,4),new Uint8Array([35,83,219,255])));
    const other=capture({...defaults,seed:defaults.seed+1}).pixels;
    check('Seed changes geometry', !equal(initial,other));
    check('Returning to a seed reproduces every pixel', equal(initial,capture(defaults).pixels));
    const ember={...defaults,...palettes.ember,glow:82,halo:65,contrast:118,softness:38};
    check('Ember changes material', !equal(initial,capture(ember).pixels));
    const noGlow=capture({...ember,glow:0}).pixels, glow=capture(ember).pixels;
    check('Glow changes pixel values independently of palette', !equal(noGlow,glow));
    check('Glow leaves distant sky unchanged',equal(noGlow.slice(0,4),glow.slice(0,4)));
    check('Editable sky color is honored',equal(capture({...defaults,sky:'#123456'}).pixels.slice(0,4),new Uint8Array([18,52,86,255])));
    check('Abstract creates an independent all-over composition',!equal(initial,capture({...defaults,mode:'abstract'}).pixels));
    check('Background remains editable in abstract mode',!equal(capture({...defaults,mode:'abstract'}).pixels,capture({...defaults,mode:'abstract',sky:'#123456'}).pixels));
    check('Grain zero removes texture', !equal(initial,capture({...defaults,grain:0}).pixels));
    check('Softness changes transitions', !equal(capture({...defaults,softness:0}).pixels,capture({...defaults,softness:100}).pixels));
    check('Abstract ignores disabled horizon and relief controls',equal(
        capture({...defaults,mode:'abstract',horizon:15,relief:0}).pixels,
        capture({...defaults,mode:'abstract',horizon:80,relief:100}).pixels));
    const custom=capture({...defaults,terrain:'#14765A',depth:'#083540',light:'#E8F7A1'}).pixels;
    check('Custom material anchors affect the rendered terrain',!equal(initial,custom));
    check('Contrast changes material independently of glow',!equal(
        capture({...defaults,glow:0,contrast:70}).pixels,capture({...defaults,glow:0,contrast:140}).pixels));
    check('Grain size changes the pigment structure',!equal(
        capture({...defaults,grainSize:.5}).pixels,capture({...defaults,grainSize:3}).pixels));
    for (const [name,settings] of Object.entries({
        minimal:{scale:220,complexity:1,flow:0,relief:0,softness:0,grain:0},
        maximal:{scale:40,complexity:6,flow:100,relief:100,softness:100,grain:100},
        portrait:{width:1200,height:1600}, square:{width:1600,height:1600}
    })) {
        const dimensions={...defaults,...settings};
        const pixels=capture(dimensions,Math.round(270*dimensions.width/dimensions.height),270).pixels;
        check(name+' remains opaque and nonuniform',pixels.filter((_,i)=>i%4===3).every(v=>v===255)
            && pixels.some((v,i)=>i%4!==3 && v!==pixels[i%4]));
    }
    check('Folds change the silhouette without grain or adjacent tones',!equal(
        capture({...defaults,grain:0,toneAmount:0,folds:0}).pixels,capture({...defaults,grain:0,toneAmount:0,folds:100}).pixels));
    check('Edge variation changes diffusion independently of grain',!equal(
        capture({...defaults,grain:0,edgeVariation:0}).pixels,capture({...defaults,grain:0,edgeVariation:100}).pixels));
    check('Glow coverage controls localized lighting',!equal(
        capture({...defaults,glow:100,glowCoverage:0}).pixels,capture({...defaults,glow:100,glowCoverage:100}).pixels));
    check('Glow zero disables all glow coverage changes',equal(
        capture({...defaults,glow:0,glowCoverage:0}).pixels,capture({...defaults,glow:0,glowCoverage:100}).pixels));
    check('New material controls leave distant sky exact',equal(
        capture({...defaults,folds:100,edgeVariation:100,glow:100,glowCoverage:100}).pixels.slice(0,4),new Uint8Array([35,83,219,255])));
    const plain=capture({...defaults,toneAmount:0}).pixels;
    check('Zero tone amount disables every adjacent-tone control',equal(plain,capture({...defaults,toneAmount:0,toneSpread:100,toneScale:20,toneBleed:100,toneCharacter:'radiant'}).pixels));
    for(const toneCharacter of ['pigment','pearlescent','radiant']) {
        const settings={...defaults,toneCharacter,toneAmount:90,toneSpread:70};
        const colored=capture(settings).pixels;
        check(toneCharacter+' adds tones without needing glow',!equal(capture({...settings,glow:0,toneAmount:0}).pixels,capture({...settings,glow:0}).pixels));
        check(toneCharacter+' preserves exact distant sky',equal(colored.slice(0,4),new Uint8Array([35,83,219,255])));
    }
    check('Tone characters produce different color patterns',!equal(capture({...defaults,toneCharacter:'pearlescent'}).pixels,capture({...defaults,toneCharacter:'radiant'}).pixels));
    for(const key of ['toneSpread','toneScale','toneBleed']) {
        const lo=key==='toneScale'?20:0, hi=key==='toneScale'?200:100;
        check(key+' affects rendered color',!equal(capture({...defaults,[key]:lo}).pixels,capture({...defaults,[key]:hi}).pixels));
    }
    const png1=await artifact('ember-default-1920',defaults,1920,1080);
    check('Repeated 1920 render is unchanged after PNG encoding',equal(png1,capture(defaults,1920,1080).pixels));
    await artifact('ember-3840',ember,3840,2160);
    await artifact('abstract-1920',{...defaults,mode:'abstract',seed:925731,scale:125,flow:85,complexity:3,glow:34},1920,1080);
    document.getElementById('results').textContent=results.join('\n')+'\nAll renderer checks passed.';
} catch(error) {
    document.getElementById('results').textContent=results.join('\n')+'\nERROR '+error.message;
} finally { renderer.destroy(); }
window.addEventListener('pagehide',()=>urls.forEach(url=>URL.revokeObjectURL(url)),{once:true});
