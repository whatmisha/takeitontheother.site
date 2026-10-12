import { defaults, normalizeSettings } from '../document.js?v=flower-f-2';
import { getLayers, withLayers } from '../layers.js?v=flower-f-2';
import { floraParts } from '../flora.js?v=flower-f-2';

// Inspect actual GPU alpha, independent of palette, illumination, and spray noise.
export function checkFloraEdges(renderer, check) {
    const s = normalizeSettings({...defaults, mode:'flora', width:640, height:640,
        grain:0, toneAmount:0, glow:0, edgeVariation:0, softness:100, floraMerge:0});
    const rectangle = (id, x0, x1) => {
        const layer = {...getLayers(s)[0], id};
        const path = [[x0,.5],[x1,.5],[x1,.9],[x0,.9]].map(([x,y]) =>
            ({x,y,in:[x,y],out:[x,y],smooth:false}));
        const edits = Object.fromEntries(floraParts(layer,s).map(part => [part.id,{hidden:true}]));
        edits.p0 = {path,detached:true,origin:[0,0]};
        return {...layer,flora:{...layer.flora,edits}};
    };
    const alpha = (settings, index=-1) => {
        const c = document.createElement('canvas'); c.width=c.height=640;
        const ctx = c.getContext('2d',{willReadFrequently:true});
        ctx.drawImage(renderer.render(settings,640,640,0,true,index),0,0);
        return ctx.getImageData(0,0,640,640).data.filter((_,i)=>i%4===3);
    };
    const separate = withLayers(s,[rectangle('left',.08,.32),rectangle('right',.68,.92)]);
    const before = alpha({...separate,floraFusion:0},1), after = alpha({...separate,floraFusion:100},1);
    check('Distant plants do not copy neighboring edges into a layer',before.every((v,i)=>v===after[i]));
    const solo = withLayers({...s,floraFusion:0,softness:55},[rectangle('solo',.1,.9)]);
    const uniform = alpha({...solo,edgeVariation:0}), directed = alpha({...solo,edgeVariation:100});
    const profiles = a => Array.from({length:7},(_,i)=>{
        const x=128+i*64;
        const crossing = threshold => {for(let y=180;y<450;y++)if(a[y*640+x]>=threshold)return y;return 450;};
        return {width:crossing(230)-crossing(25),center:crossing(128)};
    });
    const plainProfiles=profiles(uniform),driftProfiles=profiles(directed);
    const widths=driftProfiles.map(p=>p.width);
    check('Zero Edge variation keeps a uniform transition',Math.max(...plainProfiles.map(p=>p.width))-Math.min(...plainProfiles.map(p=>p.width))<=1);
    check('Directional edges alternate sharp and soft patches ('+widths.join(', ')+')',Math.max(...widths)-Math.min(...widths)>=8);
    check('Directional exposure creates an asymmetric trail',driftProfiles.some((p,i)=>Math.abs(p.center-plainProfiles[i].center)>=2));
    let worstDrop=0;
    for(let x=128;x<=512;x+=64)for(let y=200;y<420;y++)worstDrop=Math.max(worstDrop,directed[y*640+x]-directed[(y+1)*640+x]);
    check('Directional transitions stay continuous ('+worstDrop+'/255)',worstDrop<=1);
    check('Directional exposure preserves opaque interiors and clear background',directed[450*640+320]===255&&directed[100*640+320]===0);
    const plainPick=renderer.formMap({...solo,edgeVariation:0},640,640).ids;
    const driftPick=renderer.formMap({...solo,edgeVariation:100},640,640).ids;
    check('Directional trails do not move the editable contour',plainPick.every((v,i)=>v===driftPick[i]));
    const overlap = withLayers(s,[rectangle('back',.1,.9),rectangle('front',.1,.9)]);
    for (const fusion of [0,35,100]) {
        const a = alpha({...overlap,floraFusion:fusion});
        let worstDrop = 0;
        for(let y=285;y<354;y++) worstDrop=Math.max(worstDrop,a[y*640+320]-a[(y+1)*640+320]);
        check('Merged edge alpha has no inward step at '+fusion+'% ('+worstDrop+'/255)',worstDrop<=1);
    }
}
