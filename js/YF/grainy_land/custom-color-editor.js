import { UnifiedColorPicker } from '../infra/framework/src/index.js?v=tool-ui-4';
import { MAX_CUSTOM_COLORS, addCustomColor, removeCustomColor, colorIsUsed } from './custom-colors.js?v=vector-1';

const byId=id=>document.getElementById(id);
const node=(tag,className)=>{const el=document.createElement(tag);el.className=className;return el;};
export class CustomColorEditor {
    constructor(tool,change,report) {this.tool=tool;this.change=change;this.report=report;this.key=null;this.picker=null;}
    init() {
        this.listeners=new AbortController();
        byId('addCustomColor').addEventListener('click',()=>{
            try {
                const result=addCustomColor(this.tool.settings);
                this.change(this.tool,result.settings,'Add color');
                // Open the same inline HSB editor as the existing swatches.
                const dot=byId(result.id+'ColorPreview');dot?.click();dot?.focus({preventScroll:true});
                dot?.closest('.color-swatch-row').scrollIntoView({block:'nearest'});
            } catch(error) {this.report(error.message);}
        },{signal:this.listeners.signal});
        this.sync();return this;
    }
    sync() {
        const colors=this.tool.settings.customColors??[],key=JSON.stringify(colors.map(({id,name})=>[id,name]));
        if(key!==this.key) {
            this.key=key;this.picker=null;
            const list=byId('customColorList');list.replaceChildren();
            for(const color of colors) {
                const row=node('div','color-swatch-row'),line=node('div','custom-color-line');
                const item=node('div','color-swatch-compact');item.id=color.id+'ColorItem';
                const dot=node('button','color-dot color-dot--expandable');dot.id=color.id+'ColorPreview';dot.type='button';dot.setAttribute('aria-label','Open '+color.name+' color');
                const label=node('span','color-label');label.textContent=color.name;label.title=color.name;
                const hex=node('input','color-swatch-hex');hex.id=color.id+'ColorHex';hex.setAttribute('aria-label',color.name+' color hex');hex.spellcheck=false;
                item.append(dot,label,hex);
                const remove=node('button','ui-icon-button');remove.type='button';remove.dataset.removeColor=color.id;remove.setAttribute('aria-label','Remove '+color.name);
                remove.innerHTML='<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
                remove.addEventListener('click',()=>{
                    try {this.change(this.tool,removeCustomColor(this.tool.settings,color.id),'Remove color');byId('addCustomColor').focus({preventScroll:true});}
                    catch(error){this.report(error.message);}
                });
                const slot=node('div','color-hsb-slot');slot.id=color.id+'ColorHsbSlot';
                line.append(item,remove);row.append(line,slot);list.append(row);
            }
            if(colors.length) {
                const container=document.createElement('div');container.id='customColorPickerContainer';byId(colors[0].id+'ColorHsbSlot').append(container);
                this.picker=new UnifiedColorPicker({containerId:container.id,
                    settings:{
                        get:id=>this.tool.settings.customColors.find(color=>color.id===id)?.color??'#808080',
                        set:(id,hex)=>{
                            const color=hex.toUpperCase(),current=this.tool.settings.customColors;
                            if(!current.some(item=>item.id===id&&item.color!==color))return;
                            this.tool.settingsStore.set('customColors',current.map(item=>item.id===id?{...item,color}:item));
                        }
                    },
                    swatches:colors.map(({id})=>({type:id,setting:id,itemId:id+'ColorItem',dotId:id+'ColorPreview',hexId:id+'ColorHex',hsbSlotId:id+'ColorHsbSlot'}))
                });
                this.picker.init();
            }
        }
        this.picker?.sync();
        for(const button of byId('customColorList').querySelectorAll('[data-remove-color]')) {
            const used=colorIsUsed(this.tool.settings,button.dataset.removeColor);button.disabled=used;
            button.title=used?'Used by layers. Assign another color to those layers first.':'Remove color';
        }
        byId('addCustomColor').disabled=colors.length>=MAX_CUSTOM_COLORS;
        byId('addCustomColor').title=colors.length>=MAX_CUSTOM_COLORS?'Maximum '+MAX_CUSTOM_COLORS+' custom colors':'Add a custom color';
    }
    destroy() {this.listeners?.abort();this.picker=null;byId('customColorList').replaceChildren();}
}
