import { addCustomColor, removeCustomColor } from '../custom-colors.js?v=custom-colors-1';
import { editCanvas } from '../canvas-size.js?v=custom-colors-1';
import { renderPNG } from '../png-export.js?v=custom-colors-1';
import {getLayers,withLayers,editLayer,addLayer,duplicateLayer,removeLayer,reorderLayer,convertLayer,MAX_LAYERS} from '../layers.js?v=custom-colors-1';
import { ShareCodec } from '../../infra/framework/src/preset/ShareCodec.js';
import { LandscapeRenderer } from '../render.js?v=custom-colors-1';
import { defaults as currentDefaults, palettes, toneKeys, makeDocument, readDocument, editForm, regenerate, normalizeSettings } from '../document.js?v=custom-colors-1';
import { adjacentColors } from '../scene.js?v=custom-colors-1';
const defaults={...currentDefaults,blueLayers:false};
const renderer = new LandscapeRenderer(), results = [], urls = [];
const check = (name, condition) => { results.push((condition ? 'PASS ' : 'FAIL ') + name); if (!condition) throw new Error(name); };
const capture = (settings,width=480,height=270,transparent=false) => {
    const canvas = document.createElement('canvas'); canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(renderer.render(settings,width,height,0,transparent),0,0);
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
    const tonedSky={...defaults,skyToneAmount:85,skyLow:'#182A91',skyHigh:'#5A92EE'};
    check('Background tones at zero preserve the exact old artwork',equal(initial,capture({...tonedSky,skyToneAmount:0}).pixels));
    check('Global tone Amount zero also disables Background tones',equal(capture({...defaults,toneAmount:0}).pixels,capture({...tonedSky,toneAmount:0}).pixels));
    const skyOnly=withLayers(tonedSky,[]),skyPixels=capture(skyOnly).pixels;
    check('Background tones create opaque color variation',skyPixels.every((v,i)=>i%4!==3||v===255)&&!equal(skyPixels.slice(0,4),skyPixels.slice(400*4,401*4)));
    for(const toneCharacter of ['pigment','pearlescent','radiant']) {
        const s={...skyOnly,toneCharacter},p=capture(s).pixels;
        check(toneCharacter+' colors the Background',!equal(p,capture({...s,skyToneAmount:0}).pixels));
        check(toneCharacter+' is seed-repeatable',equal(p,capture(s).pixels)&&!equal(p,capture({...s,seed:s.seed+1}).pixels));
    }
    for(const [key,value] of Object.entries({skyToneAmount:15,toneScale:20,toneSpread:5,sky:'#B76129',skyLow:'#F077BB',skyHigh:'#88FFCC'})) {
        const s={...skyOnly,skyLow:null,skyHigh:null};
        check(key+' controls Background colors',!equal(capture(s).pixels,capture({...s,[key]:value}).pixels));
    }
    check('Background tones leave picking unchanged',equal(renderer.formMap(defaults,480,270).ids,renderer.formMap(tonedSky,480,270).ids));
    check('Transparent empty Background stays completely clear with tones enabled',capture(skyOnly,480,270,true).pixels.every(v=>v===0));
    check('Background tones survive JSON pixel for pixel',equal(capture(tonedSky).pixels,capture(readDocument(JSON.parse(JSON.stringify(makeDocument(tonedSky))))).pixels));
    const skyCodec=new ShareCodec({pristineDefaults:defaults});
    const toneShare=await skyCodec.decode(await skyCodec.encode(tonedSky));
    check('Background tones survive share links',equal(capture(tonedSky).pixels,capture(toneShare.full).pixels));
    for(const mode of ['landscape','abstract']) {
        const s={...tonedSky,mode,glow:75},opaque=capture(s),paint=capture(s,480,270,true),base=capture(withLayers(s,[]));
        base.ctx.drawImage(paint.canvas,0,0);const combined=base.ctx.getImageData(0,0,480,270).data;
        const error=combined.reduce((n,v,i)=>n+Math.abs(v-opaque.pixels[i]),0)/combined.length;
        check(mode+' transparent paint recomposes over the toned Background ('+error.toFixed(3)+' MAE)',error<1);
    }
    await artifact('background-tones-1920',tonedSky,1920,1080);
    const blueTemplate=currentDefaults,bluePair=withLayers(blueTemplate,getLayers(blueTemplate).slice(0,2));
    for(const mode of ['landscape','abstract']) {
        const settings={...blueTemplate,mode},pair={...bluePair,mode,abstractLayers:getLayers(bluePair)};
        const map=renderer.formMap(pair,480,270),transparent=capture(pair,480,270,true).pixels;
        check(mode+' both blue coats are independently selectable',map.ids.some(id=>id===1)&&map.ids.some(id=>id===2));
        check(mode+' blue coats remain in transparent output',transparent.some((v,i)=>i%4===3&&v>0)&&transparent.some((v,i)=>i%4===3&&v===0));
        check(mode+' blue coats receive sprayed coverage',!equal(capture({...pair,grain:0}).pixels,capture({...pair,grain:100}).pixels));
        check(mode+' new template has eight independently rendered layers',getLayers(settings).length===8&&!equal(capture(settings).pixels,capture({...settings,blueLayers:false}).pixels));
    }
    const blueId='blue-1',movedBlue=editLayer(bluePair,blueId,{x:.14},{manual:true});
    check('Blue layer moves independently',!equal(capture(bluePair).pixels,capture(movedBlue).pixels));
    check('Pinned blue layer survives Generate',equal(capture(withLayers(movedBlue,[getLayers(movedBlue)[0]])).pixels,capture(regenerate(withLayers(movedBlue,[getLayers(movedBlue)[0]]),42)).pixels));
    const drawnBlue=convertLayer(movedBlue,blueId);
    check('Converting blue coat to Drawn preserves pixels',equal(capture(movedBlue).pixels,capture(drawnBlue).pixels));
    const brushBlue=editLayer(bluePair,blueId,{strokes:[{kind:'paint',rx:.05,ry:.08,points:[[.8,.8],[.9,.8]]}]},{manual:true});
    check('Blue coat accepts brush edits',!equal(capture(bluePair).pixels,capture(brushBlue).pixels));
    check('Blue material follows the editable blue anchor',!equal(capture(bluePair).pixels,capture({...bluePair,sky:'#934FBA'}).pixels));
    check('Blue material follows Background low/high tones',!equal(capture(bluePair).pixels,capture({...bluePair,skyLow:'#173BBB',skyHigh:'#82BBFF'}).pixels));
    await artifact('blue-layers-1920',blueTemplate,1920,1080);
    await artifact('blue-layers-isolated-1920',bluePair,1920,1080);
    const paletteFirst=addCustomColor(defaults),paletteSecond=addCustomColor(paletteFirst.settings);
    check('Unused custom colors leave the original artwork pixel-identical',equal(initial,capture(paletteSecond.settings).pixels));
    for(const mode of ['landscape','abstract']) {
        const seed={...paletteSecond.settings,mode};
        const colored=editLayer(seed,'form-0',{group:paletteSecond.id});
        const image=capture(colored).pixels;
        check(mode+' custom color changes the assigned layer material',!equal(capture(seed).pixels,image));
        check(mode+' assigning a custom color preserves picking geometry',equal(renderer.formMap(seed,480,270).ids,renderer.formMap(colored,480,270).ids));
        check(mode+' removing an unused color preserves all remaining pixels',equal(image,capture(removeCustomColor(colored,paletteFirst.id)).pixels));
        check(mode+' custom palette survives JSON exactly',equal(image,capture(readDocument(JSON.parse(JSON.stringify(makeDocument(colored))))).pixels));
        const solo=withLayers(colored,[getLayers(colored)[0]]);
        check(mode+' custom paint responds to advanced tones',!equal(capture(solo).pixels,capture({...solo,toneCharacter:'pigment',toneSpread:0}).pixels));
        check(mode+' custom paint responds to its hex anchor',!equal(capture(solo).pixels,capture({...solo,customColors:solo.customColors.map(c=>c.id===paletteSecond.id?{...c,color:'#AC28DC'}:c)}).pixels));
        check(mode+' custom paint retains transparent spray edges',capture(solo,480,270,true).pixels.some((v,i)=>i%4===3&&v>0&&v<255));
    }
    await artifact('custom-color-1920',editLayer(paletteSecond.settings,'form-0',{group:paletteSecond.id}),1920,1080);
    const transparentSettings={...defaults,transparentBackground:true};
    check('Transparent export option leaves the working preview unchanged',equal(initial,capture(transparentSettings).pixels));
    for(const mode of ['landscape','abstract']) {
        const settings={...transparentSettings,mode,glow:75};
        const transparent=capture(settings,480,270,true),opaque=capture(settings).pixels;
        const alpha=transparent.pixels.filter((v,i)=>i%4===3);
        check(mode+' transparent paint has clear sky, solid paint and soft edges',alpha.some(a=>a===0)&&alpha.some(a=>a===255)&&alpha.some(a=>a>0&&a<255));
        const composite=document.createElement('canvas');composite.width=480;composite.height=270;
        const ctx=composite.getContext('2d',{willReadFrequently:true});ctx.fillStyle=settings.sky;ctx.fillRect(0,0,480,270);ctx.drawImage(transparent.canvas,0,0);
        const pixels=ctx.getImageData(0,0,480,270).data;
        const error=pixels.reduce((sum,v,i)=>sum+Math.abs(v-opaque[i]),0)/pixels.length;
        check(mode+' transparent paint recomposes over its sky without a matte ('+error.toFixed(3)+' MAE)',error<1);
    }
    const clearSettings=withLayers(transparentSettings,[]);
    check('An empty transparent layer stack exports entirely clear pixels',capture(clearSettings,160,90,true).pixels.every(v=>v===0));
    const faintSettings=withLayers({...transparentSettings,glow:0},[{...getLayers(defaults)[0],opacity:25}]);
    const faintAlpha=capture(faintSettings,160,90,true).pixels.filter((v,i)=>i%4===3);
    check('Layer opacity remains part of export alpha',Math.max(...faintAlpha)<=66&&Math.max(...faintAlpha)>=63);
    const transparentSmall={...transparentSettings,width:320,height:180,exportScale:2};
    for(const settings of [transparentSmall,editCanvas({...transparentSmall,exportScale:1},{canvasUnit:'mm'})]) {
        const artifact=await renderPNG(renderer,settings),bitmap=await createImageBitmap(artifact.blob);
        const decoded=document.createElement('canvas');decoded.width=artifact.width;decoded.height=artifact.height;
        const ctx=decoded.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close();
        check(settings.canvasUnit+' transparent PNG survives encoding at its export resolution',artifact.width===settings.width*settings.exportScale&&equal(ctx.getImageData(0,0,artifact.width,artifact.height).data,capture(settings,artifact.width,artifact.height,true).pixels));
        const url=URL.createObjectURL(artifact.blob);urls.push(url);
        const figure=document.createElement('figure'),img=document.createElement('img'),link=document.createElement('a');
        img.src=url;img.alt='Transparent '+settings.canvasUnit+' PNG on checkerboard';img.style.background='repeating-conic-gradient(#ddd 0% 25%,#fff 0% 50%) 0 / 20px 20px';
        link.href=url;link.download='grainy-transparent-'+settings.canvasUnit+'.png';link.textContent='Download transparent '+settings.canvasUnit+' PNG';figure.append(img,link);document.getElementById('artifacts').append(figure);
    }
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
    check('Grain zero also disables grain size',equal(
        capture({...defaults,grain:0,grainSize:.5}).pixels,capture({...defaults,grain:0,grainSize:4}).pixels));
    check('Softness changes transitions', !equal(capture({...defaults,softness:0}).pixels,capture({...defaults,softness:100}).pixels));
    check('Abstract ignores disabled horizon and relief controls',equal(
        capture({...defaults,mode:'abstract',horizon:15,relief:0}).pixels,
        capture({...defaults,mode:'abstract',horizon:80,relief:100}).pixels));
    const basin=capture({...defaults,layout:'basin'}).pixels;
    for(const layout of ['ridge','valley','fold']) {
        const settings={...defaults,layout};
        const pixels=capture(settings).pixels;
        check(layout+' changes composition at the same seed',!equal(basin,pixels));
        check(layout+' preserves distant sky',equal(pixels.slice(0,4),new Uint8Array([35,83,219,255])));
    }
    check('Abstract ignores stored landscape layout',equal(
        capture({...defaults,mode:'abstract',layout:'fold'}).pixels,capture({...defaults,mode:'abstract',layout:'ridge'}).pixels));
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
    const automatic = adjacentColors(defaults);
    const exactOverrides = Object.fromEntries(toneKeys.map((key,i) => [key, '#' + automatic[i].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('')]));
    check('Fixing automatic endpoints preserves every default pixel', equal(initial,capture({...defaults,...exactOverrides}).pixels));
    for (const key of toneKeys.slice(0,6)) {
        check(key+' changes rendered material', !equal(initial,capture({...defaults,[key]:'#169DAB'}).pixels));
    }
    const manual = {...defaults,terrainLow:'#169DAB',depthHigh:'#CB39BC',lightLow:'#624DB2'};
    const manualPixels = capture(manual).pixels;
    check('Manual tones leave distant sky exact', equal(manualPixels.slice(0,4),initial.slice(0,4)));
    check('Manual tones survive JSON with identical rendering', equal(manualPixels,capture(readDocument(JSON.parse(JSON.stringify(makeDocument(manual))))).pixels));
    check('Zero tone amount disables manual colors', equal(plain,capture({...manual,toneAmount:0}).pixels));
    check('Resetting overrides restores the default render', equal(initial,capture({...manual,...Object.fromEntries(toneKeys.map(key=>[key,null]))}).pixels));
    await artifact('manual-tones-1920',manual,1920,1080);
    const brush={kind:'paint',rx:.075,ry:.133333,points:[[.32,.12],[.65,.25]]};
    const eraser={kind:'erase',rx:.035,ry:.062222,points:[[.5,.191]]};
    const at=(map,x,y)=>map.ids[Math.floor(y*map.height)*map.width+Math.floor(x*map.width)];
    let painted=editForm(defaults,5,{strokes:[brush],locked:true});
    const paintedPixels=capture(painted).pixels;
    check('Brush creates a connected form in empty sky',at(renderer.formMap(painted,480,270),.5,.19)===6);
    check('Brush changes material pixels',!equal(initial,paintedPixels));
    check('Brush uses the editable base colors',!equal(paintedPixels,capture({...painted,light:'#32AB89'}).pixels));
    check('Brush receives glow and spray',!equal(paintedPixels,capture({...painted,glow:100,grain:100}).pixels));
    const erased=editForm(painted,5,{strokes:[brush,eraser]});
    check('Eraser opens a hole in the brush stroke',at(renderer.formMap(erased,480,270),.5,.191)!==6);
    const repainted=editForm(painted,5,{strokes:[brush,eraser,brush]});
    check('Painting after erasing fills the hole again',at(renderer.formMap(repainted,480,270),.5,.191)===6);
    check('Clearing strokes restores original pixels',equal(initial,capture(editForm(painted,5,{strokes:[]})).pixels));
    check('Paint survives JSON with identical pixels',equal(paintedPixels,capture(readDocument(JSON.parse(JSON.stringify(makeDocument(painted))))).pixels));
    check('Paint geometry survives Generate when locked',at(renderer.formMap(regenerate(painted,333),480,270),.5,.19)===6);
    check('Paint travels with the form transform',at(renderer.formMap(editForm(painted,5,{x:.2,y:.2}),480,270),.7,.39)===6);
    const lowMap=renderer.formMap(painted,480,270),highMap=renderer.formMap(painted,1920,1080);
    check('Brush proportions agree at preview and export resolutions',[[.25,.15],[.5,.19],[.7,.3],[.1,.1]].every(p=>at(lowMap,...p)===at(highMap,...p)));
    const portraitBrush={kind:'paint',rx:.133333,ry:.075,points:[[.5,.15]]};
    const portraitPaint=editForm({...defaults,width:1080,height:1920},5,{strokes:[portraitBrush],locked:true});
    const portraitMap=renderer.formMap(portraitPaint,270,480);
    check('Portrait brush keeps a round silhouette',at(portraitMap,.60,.15)===6 && at(portraitMap,.5,.20625)===6 && at(portraitMap,.66,.15)!==6);
    const abstractPaint=editForm({...defaults,mode:'abstract'},5,{strokes:[brush,eraser],locked:true});
    check('Painting also works in Abstract mode',!equal(capture(abstractPaint).pixels,capture({...defaults,mode:'abstract'}).pixels));
    await artifact('painted-forms-1920',erased,1920,1080);
    const codec=new ShareCodec({pristineDefaults:defaults}),payload=await codec.encode(erased);
    check('Paint share link restores identical pixels',equal(capture(erased).pixels,capture((await codec.decode(payload)).full).pixels));
    const paintedLink=document.createElement('a');paintedLink.id='paintedShare';paintedLink.href='../#p='+payload;paintedLink.textContent='Open painted forms in the editor';document.getElementById('artifacts').append(paintedLink);
    let layered=withLayers(defaults,getLayers(defaults));
    check('Explicit layer migration preserves every default pixel',equal(initial,capture(layered).pixels));
    const hidden=editLayer(layered,'form-5',{visible:false});
    check('Hidden layer is absent from color and picking',!equal(initial,capture(hidden).pixels)&&!renderer.formMap(hidden,320,180).ids.includes(6));
    check('Zero opacity matches hiding a layer',equal(capture(hidden).pixels,capture(editLayer(layered,'form-5',{opacity:0})).pixels));
    const reordered=reorderLayer(layered,'form-0','form-5','before');
    check('Layer order changes compositing',!equal(initial,capture(reordered).pixels));
    check('Reordering retains the exact isolated silhouette',equal(renderer.formMap(layered,320,180,0).ids.map(n=>n?1:0),renderer.formMap(reordered,320,180,5).ids.map(n=>n?1:0)));
    check('Changing layer color group changes material',!equal(initial,capture(editLayer(layered,'form-5',{group:'depth'})).pixels));
    for(const l of getLayers(layered))layered=convertLayer(layered,l.id);
    check('Converting every layer to Drawn preserves every pixel',equal(initial,capture(layered).pixels));
    const frozen=regenerate({...layered,scale:200,flow:0,horizon:15,relief:0,complexity:6,folds:0},909);
    check('Converted Drawn scene ignores Generate and all geometry controls',equal(initial,capture(frozen).pixels));
    let blank=withLayers(defaults,[]);const created=addLayer(blank);blank=created.settings;
    check('New Drawn layer starts completely empty',capture(blank).pixels.every((v,i)=>v===[35,83,219,255][i%4]));
    let customPaint=editLayer(blank,created.id,{strokes:[brush],group:'light'},{manual:true});
    check('Pure Drawn layer renders brush without procedural terrain',at(renderer.formMap(customPaint,480,270),.5,.19)===1&&at(renderer.formMap(customPaint,480,270),.5,.9)===0);
    check('Pure Drawn layer survives Generate and geometry changes pixel for pixel',equal(capture(customPaint).pixels,capture(regenerate({...customPaint,scale:40,flow:100,folds:100,horizon:80,relief:0},414)).pixels));
    const translucent=editLayer(customPaint,created.id,{opacity:45});
    check('Layer opacity blends material with the background',!equal(capture(customPaint).pixels,capture(translucent).pixels)&&!equal(capture(blank).pixels,capture(translucent).pixels));
    const dup=duplicateLayer(customPaint,created.id);
    check('Duplicate keeps the same silhouette',equal(renderer.formMap(dup.settings,320,180,0).ids.map(n=>n?1:0),renderer.formMap(dup.settings,320,180,1).ids.map(n=>n?1:0)));
    check('Deleting the last layer leaves only Background',capture(removeLayer(customPaint,created.id)).pixels.every((v,i)=>v===[35,83,219,255][i%4]));
    const paintedConversion=convertLayer(withLayers(painted,getLayers(painted)),'form-5');
    check('Converting a painted parametric layer preserves its image',equal(paintedPixels,capture(paintedConversion).pixels));
    let fullStack=customPaint;
    while(getLayers(fullStack).length<MAX_LAYERS)fullStack=duplicateLayer(fullStack,created.id).settings;
    check('All sixteen painted layer slots render and pick',at(renderer.formMap(fullStack,240,135),.5,.19)===MAX_LAYERS);
    check('Sixteen-layer JSON reproduces every pixel',equal(capture(fullStack,240,135).pixels,capture(readDocument(JSON.parse(JSON.stringify(makeDocument(fullStack)))),240,135).pixels));
    await artifact('layered-drawn-1920',customPaint,1920,1080);
    const pick=renderer.formMap(defaults,320,180);
    check('Form picking distinguishes six paints and the background',new Set(pick.ids).size===7 && Math.max(...pick.ids)===6);
    check('Form picking leaves the exported image unchanged',equal(initial,capture(defaults).pixels));
    for (const mode of ['landscape','abstract']) {
        const baseline={...defaults,mode};
        let locked=baseline;
        for(let i=0;i<6;i++)locked=editForm(locked,i,{locked:true});
        check(mode+' locking forms preserves every pixel',equal(capture(baseline).pixels,capture(locked).pixels));
        check(mode+' fully locked composition survives Generate',equal(capture(locked).pixels,capture(regenerate(locked,444)).pixels));
        const moved=editForm(baseline,0,{x:.16,y:-.10,locked:true});
        check(mode+' moving a form changes pixels',!equal(capture(baseline).pixels,capture(moved).pixels));
        const scaled=editForm(moved,0,{scaleX:.7,scaleY:1.5});
        check(mode+' resizing a form changes pixels',!equal(capture(moved).pixels,capture(scaled).pixels));
        check(mode+' edited forms round-trip with identical rendering',equal(capture(scaled).pixels,capture(readDocument(JSON.parse(JSON.stringify(makeDocument(scaled))))).pixels));
        check(mode+' reset restores the generated form',equal(capture(baseline).pixels,capture(editForm(scaled,0,null)).pixels));
    }
    await artifact('edited-forms-1920',editForm(defaults,0,{x:.1,y:-.07,scaleX:1.1,locked:true}),1920,1080);
    // A fixed seed makes this a reproducible material regression: an interior
    // region of the central hill must retain detail without growing a coarse crust.
    const smooth=capture({...defaults,grain:0},1920,1080);
    const sprayed=capture({...defaults,grain:100},1920,1080);
    const residual=(a,b,x,y,w,h,block=1)=>{
        let sum=0,count=0;
        for(let by=y;by<y+h;by+=block) for(let bx=x;bx<x+w;bx+=block) for(let c=0;c<3;c++){
            let delta=0;
            for(let dy=0;dy<block;dy++)for(let dx=0;dx<block;dx++){
                const index=((by+dy)*1920+bx+dx)*4+c;delta+=a[index]-b[index];
            }
            sum+=(delta/(block*block))**2;count++;
        }
        return Math.sqrt(sum/count);
    };
    const interior=residual(sprayed.pixels,smooth.pixels,880,560,160,80);
    const clumps=residual(sprayed.pixels,smooth.pixels,880,560,160,80,16);
    const edge=residual(sprayed.pixels,smooth.pixels,820,395,160,80);
    check('Dense paint retains subtle fine texture ('+interior.toFixed(2)+' RGB RMS)',interior>.2 && interior<5);
    check('Grain does not form coarse interior patches ('+clumps.toFixed(2)+' RGB RMS)',clumps<1.5);
    check('Spray is stronger in transitions than inside paint',edge>interior*1.5);
    const reduced=document.createElement('canvas');reduced.width=960;reduced.height=540;
    const reducedCtx=reduced.getContext('2d',{willReadFrequently:true});
    reducedCtx.drawImage(sprayed.canvas,0,0,960,540);
    const reducedPixels=reducedCtx.getImageData(0,0,960,540).data;
    const preview=capture({...defaults,grain:100},960,540).pixels;
    let previewError=0;
    for(let i=0;i<preview.length;i++)if(i%4!==3)previewError+=Math.abs(preview[i]-reducedPixels[i]);
    previewError/=960*540*3;
    check('Preview stays close to downsampled export ('+previewError.toFixed(2)+' RGB MAE)',previewError<2);
    const png1=await artifact('ember-default-1920',defaults,1920,1080);
    check('Repeated 1920 render is unchanged after PNG encoding',equal(png1,capture(defaults,1920,1080).pixels));
    await artifact('ember-3840',ember,3840,2160);
    await artifact('abstract-1920',{...defaults,mode:'abstract',seed:925731,scale:125,flow:85,complexity:3,glow:34},1920,1080);
    const printDefault=editCanvas(defaults,{canvasUnit:'mm'});
    check('Switching to millimetres preserves every preview pixel',equal(initial,capture(printDefault).pixels));
    check('DPI changes preserve normalized artwork at an exact aspect ratio',equal(initial,capture(editCanvas(printDefault,{dpi:150})).pixels));
    const printA4=normalizeSettings({...defaults,canvasUnit:'mm',printWidthMM:210,printHeightMM:297,dpi:300});
    const printArtifact=await renderPNG(renderer,printA4),printBitmap=await createImageBitmap(printArtifact.blob);
    check('A4 at 300 DPI exports a decodable 2480 by 3508 PNG',printBitmap.width===2480&&printBitmap.height===3508);
    const printCanvas=document.createElement('canvas');printCanvas.width=2480;printCanvas.height=3508;
    const printCtx=printCanvas.getContext('2d',{willReadFrequently:true});printCtx.drawImage(printBitmap,0,0);printBitmap.close();
    check('DPI metadata leaves exported paint pixels intact',equal(printCtx.getImageData(0,0,2480,3508).data,capture(printA4,2480,3508).pixels));
    const printBytes=new Uint8Array(await printArtifact.blob.arrayBuffer()),printView=new DataView(printBytes.buffer);
    check('Print PNG includes 300 DPI in both axes',String.fromCharCode(...printBytes.slice(37,41))==='pHYs'&&printView.getUint32(41)===11811&&printView.getUint32(45)===11811&&printBytes[49]===1);
    const printURL=URL.createObjectURL(printArtifact.blob);urls.push(printURL);
    const printLink=document.createElement('a');printLink.href=printURL;printLink.download='grainy-land-a4-300dpi.png';printLink.textContent='Download A4 at 300 DPI';document.getElementById('artifacts').append(printLink);
    document.getElementById('results').textContent=results.join('\n')+'\nAll renderer checks passed.';
} catch(error) {
    document.getElementById('results').textContent=results.join('\n')+'\nERROR '+error.message;
} finally { renderer.destroy(); }
window.addEventListener('pagehide',()=>urls.forEach(url=>URL.revokeObjectURL(url)),{once:true});
