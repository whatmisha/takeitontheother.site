export const MAX_EXPORT_SIDE = 32768;
export const MAX_EXPORT_PIXELS = 268435456;
export const canvasDefaults = {canvasUnit:'px',dpi:300,printWidthMM:null,printHeightMM:null};
const number = (v,fallback,min,max) => v!=null && v!=='' && Number.isFinite(Number(v)) ? Math.max(min,Math.min(max,Number(v))) : fallback;
export const mmToPixels = (mm,dpi) => Math.max(1,Math.round(mm*dpi/25.4));
export const pixelsToMM = (px,dpi) => px*25.4/dpi;
export function assertExportSize(width,height) {
    if(Math.max(width,height)>MAX_EXPORT_SIDE || width*height>MAX_EXPORT_PIXELS)
        throw new RangeError('Export is too large. Reduce size or resolution (maximum 32768 px per side / 256 megapixels).');
    return {width,height};
}
export function normalizeCanvas(value,defaults) {
    const out={...canvasDefaults,width:Math.round(number(value.width,defaults.width,1,MAX_EXPORT_SIDE)),
        height:Math.round(number(value.height,defaults.height,1,MAX_EXPORT_SIDE)),
        dpi:Math.round(number(value.dpi,300,36,1200)),
        exportScale:[1,2,3].includes(Number(value.exportScale))?Number(value.exportScale):1};
    if(value.canvasUnit!=='mm')return out;
    out.canvasUnit='mm';out.exportScale=1;
    for(const [axis,key] of [['width','printWidthMM'],['height','printHeightMM']]) {
        out[key]=Number(number(value[key],pixelsToMM(out[axis],out.dpi),.01,6000).toFixed(6));
        out[axis]=mmToPixels(out[key],out.dpi);
    }
    assertExportSize(out.width,out.height);
    return out;
}
// Changing units preserves the current export's pixel dimensions. Physical
// dimensions remain the source of truth while editing DPI in millimetres.
export function editCanvas(settings,patch) {
    let next={...settings,...patch};
    if(patch.canvasUnit==='mm' && settings.canvasUnit!=='mm') {
        next.printWidthMM=pixelsToMM(settings.width*settings.exportScale,settings.dpi);
        next.printHeightMM=pixelsToMM(settings.height*settings.exportScale,settings.dpi);
    }
    if(patch.canvasUnit==='px' && settings.canvasUnit==='mm')next.exportScale=1;
    return {...next,...normalizeCanvas(next,settings)};
}
