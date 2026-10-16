import {SliderController} from '../infra/framework/src/index.js';
import {selectionValue,selectedLayers} from './selection.js?v=petal-motion-1';
import {kindLabels,kindModes,parameterRanges,sharedParameters,layerParameters} from './object-model.js?v=unified-document-1';
import {addObject,countLimits,countKey,resizeObjects,setParameterMode,editObjectParameters,editSharedParameters} from './object-actions.js?v=unified-document-1';
import {getLayers,MAX_LAYERS} from './layers.js?v=unified-document-1';
import {normalizeSettings} from './document.js?v=unified-document-1';
const byId=id=>document.getElementById(id);
const labels={floraCount:'Plants',fCount:'Flowers',fDensity:'Density',fMinSize:'Min size, %',fMaxSize:'Max size, %',fColorVariation:'Flower colors',fPetalColors:'Petal colors',scale:'Scale',complexity:'Complexity',flow:'Flow',folds:'Folds',horizon:'Horizon',relief:'Relief',floraScale:'Plant size',floraRecognition:'Recognizability',floraBranches:'Blossoms',floraOpening:'Opening',floraBend:'Bend',floraMerge:'Merge parts',floraFusion:'Merge plants',fScale:'Flower size',fPetals:'Petals',fOpening:'Opening',fWidth:'Petal width',fCurl:'Curl',fAsymmetry:'Asymmetry',fRecognition:'Recognizability',fTilt:'View angle',fRotation:'Rotation',fCenterX:'Center X',fCenterY:'Center Y',fStem:'Stem length',fBend:'Stem bend',fMerge:'Merge parts',fSizeVariation:'Size variation',fShapeVariation:'Shape variation',fPoseVariation:'Pose variation'};
const choices=kind=>kind==='flower'?['fType','Flower type',{fan:'Fan',cup:'Cup',lobed:'Lobed',radial:'Radial'}]:kind==='plant'?['floraLayout','Arrangement',{single:'Centered',cluster:'Cluster',field:'Field'}]:['layout','Layout',{auto:'Auto',basin:'Basin',ridge:'Ridge',valley:'Valley',fold:'Fold'}];
export class ObjectUI {
 constructor(tool,change,editor){
  Object.assign(this,{tool,change,editor});this.kind=tool.compositionKind??'flower';this.abort=new AbortController();this.bindings=new Map();
  this.sliders=new SliderController({get:id=>this.bindings.get(id).read().value,set:(id,value)=>{
   const binding=this.bindings.get(id),current=binding.read();
   if(current.mixed||value!==current.value)binding.write(value);
  }});
 }
 on(element,event,fn){element.addEventListener(event,fn,{signal:this.abort.signal});}
 selected(){return selectedLayers(this.tool.settings,this.editor.selection());}
 apply(settings,label){this.end();this.change(this.tool,settings,label);}
 end(){if(this.editing){this.editing=false;this.tool.history.endTransaction();}}
 live(settings,label){
  if(!this.editing){this.tool.history.flush();this.tool.history.beginTransaction(label);this.editing=true;}
  this.tool.applySnapshot(normalizeSettings(settings),{deferRender:true});this.tool.presets?.markDirty();
 }
 bindSlider(range,value,read,write,min,max,step){
  const abort=new AbortController();this.bindings.get(range.id)?.abort.abort();
  const binding={range,value,read,write,abort};this.bindings.set(range.id,binding);
  value.id ||= range.id+'-value';
  this.sliders.initSlider(range.id,{valueId:value.id,setting:range.id,min,max,baseStep:step,decimals:step<1?1:0,signal:abort.signal});
  for(const input of [range,value])for(const event of ['change','blur'])input.addEventListener(event,()=>this.end(),{signal:abort.signal});
  value.addEventListener('keydown',event=>{if(event.key==='Escape')this.syncSlider(binding);},{signal:abort.signal});
  value.addEventListener('blur',()=>this.syncSlider(binding),{signal:abort.signal});
  return binding;
 }
 syncSlider(binding,min,max){
  const {range,value,read}=binding,state=read(),config=this.sliders.sliders.get(range.id).config;
  if(min!=null){config.min=min;config.max=max;range.min=min;range.max=max;value.min=min;value.max=max;}
  range.value=state.value;range.setAttribute('aria-valuetext',state.mixed?'Mixed':String(state.value));
  if(document.activeElement!==value){value.value=state.mixed?'':Number(state.value).toFixed(config.decimals);value.placeholder=state.mixed?'Mixed':'';}
 }
 add(kind){this.end();try{const result=addObject(this.tool.settings,kind);this.apply(result.settings,'Add '+kindLabels[kind]);this.editor.select(result.id);this.editor.setTool('move');}catch(e){this.editor.report(e.message);}}
 init(){
  document.querySelectorAll('[data-add-kind]').forEach(b=>this.on(b,'click',()=>this.add(b.dataset.addKind)));
  document.querySelectorAll('[data-parameter-mode]').forEach(b=>this.on(b,'click',()=>{
   const next=this.editor.selection().reduce((s,id)=>setParameterMode(s,id,b.dataset.parameterMode),this.tool.settings);
   this.apply(next,'Parameter mode');
  }));
  this.on(byId('sharedObjectSettings'),'click',()=>{
   const l=this.editor.layer();if(!l)return;this.showKind(l.kind);
   const panel=byId('compositionPanel');if(panel.classList.contains('panel-collapsed'))panel.querySelector('.collapse-icon').click();
  });
  const tabs=[...document.querySelectorAll('[data-composition-kind]')];
  tabs.forEach((tab,i)=>{
   this.on(tab,'click',()=>this.showKind(tab.dataset.compositionKind));
   this.on(tab,'keydown',event=>{
    const next=event.key==='ArrowRight'?(i+1)%tabs.length:event.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
    if(next==null)return;event.preventDefault();this.showKind(tabs[next].dataset.compositionKind);tabs[next].focus();
   });
  });
  const keys=new Map();for(const kind of ['land','plant','flower'])for(const [key,range]of Object.entries(parameterRanges(kind)))keys.set(key,{kind,range});
  this.sharedFields=[];
  for(const [key,{kind,range:[min,max,step]}]of keys){
   const type=()=>kind==='land'?(['land','spot'].includes(this.kind)?this.kind:'land'):kind;
   const count=['floraCount','fCount'].includes(key);
   const binding=this.bindSlider(byId(key+'Slider'),byId(key+'Value'),()=>({value:count?countLimits(this.tool.settings,type()).value:sharedParameters(this.tool.settings,type())[key]}),
    value=>this.live(count?resizeObjects(this.tool.settings,type(),value):editSharedParameters(this.tool.settings,type(),{[key]:value}),kindLabels[type()]+' '+(labels[key]??key)),min,max,step);
   this.sharedFields.push({key,kind,binding});
  }
  for(const [id,kind]of [['fType','flower'],['fColorPattern','flower'],['floraLayout','plant']])this.on(byId(id),'change',()=>this.apply(editSharedParameters(this.tool.settings,kind,{[id]:byId(id).value}),kindLabels[kind]+' settings'));
  this.on(window,'blur',()=>this.end());return this;
 }
 showKind(kind){
  if(!Object.hasOwn(kindModes,kind))return;
  this.end();this.kind=kind;this.tool.compositionKind=kind;this.syncView();this.tool.uiRefresh?.();
 }
 followSelection(){
  const selected=this.selected();if(selected.length&&selected.every(l=>l.kind===selected[0].kind)&&!['drawn','vector'].includes(selected[0].mode))this.showKind(selected[0].kind);
 }
 syncView(){
  this.kind=this.tool.compositionKind??this.kind;
  document.querySelectorAll('[data-composition-kind]').forEach(tab=>{const selected=tab.dataset.compositionKind===this.kind;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
  for(const [id,kinds]of [['flowerComposition',['flower']],['floraComposition',['plant']],['landComposition',['land','spot']]]){
   const panel=byId(id);panel.hidden=!kinds.includes(this.kind);if(!panel.hidden)panel.setAttribute('aria-labelledby','settings-'+this.kind);
  }
  for(const key of ['horizon','relief'])byId(key+'Slider').closest('.control-group').hidden=this.kind!=='land';
  byId('newBlueLayers').hidden=this.kind!=='spot';
  for(const {key,kind,binding}of this.sharedFields??[]){const limits=['floraCount','fCount'].includes(key)?countLimits(this.tool.settings,kind):null;this.syncSlider(binding,limits?.min,limits?.max);}
  for(const [id,kind]of [['fType','flower'],['fColorPattern','flower'],['floraLayout','plant']])byId(id).value=sharedParameters(this.tool.settings,kind)[id];
 }
 buildFields(host,kind,local,id){
  const controls=[],selects=[choices(kind)];
  if(kind==='flower')selects.push(['fColorPattern','Color pattern',{grouped:'Grouped',alternating:'Alternating',scattered:'Scattered'}]);
  const read=key=>local?selectionValue(this.selected(),l=>layerParameters(this.tool.settings,l)[key]):{value:sharedParameters(this.tool.settings,kind)[key]};
  const patch=values=>Object.hasOwn(values,'floraCount')?resizeObjects(this.tool.settings,kind,values.floraCount):Object.hasOwn(values,'fCount')?resizeObjects(this.tool.settings,kind,values.fCount):local?this.editor.selection().reduce((s,id)=>editObjectParameters(s,id,values),this.tool.settings):editSharedParameters(this.tool.settings,kind,values);
  for(const [selectKey,selectLabel,options] of (local&&kind==='plant'?[]:selects)){
   const label=document.createElement('label');label.className='stacked-select-label';label.textContent=selectLabel;label.htmlFor=id+'-'+selectKey;
   const select=document.createElement('select');select.id=label.htmlFor;select.className='style-select';select.setAttribute('aria-label',kindLabels[kind]+' '+selectLabel);
   const mixed=document.createElement('option');mixed.value='';mixed.textContent='Mixed';mixed.disabled=true;mixed.hidden=true;select.append(mixed);
   for(const [value,name]of Object.entries(options)){const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option);}
   this.on(select,'change',()=>this.apply(patch({[selectKey]:select.value}),'Object '+selectLabel));host.append(label,select);controls.push({key:selectKey,input:select,read:()=>read(selectKey),mixed});
  }
  for(const [key,[min,max,step]]of Object.entries(parameterRanges(kind))){
   if(local&&(['floraCount','fCount','fDensity','fMinSize','fMaxSize'].includes(key)||key.endsWith('Variation')))continue;
   const row=document.createElement('div');row.className='control-group';
   const label=document.createElement('label'),name=document.createElement('span'),value=document.createElement('input'),range=document.createElement('input');name.textContent=labels[key]??key;
   range.type='range';range.min=min;range.max=max;range.step=step;range.id=id+'-'+key;label.htmlFor=range.id;range.setAttribute('aria-label',kindLabels[kind]+' '+name.textContent);
   value.type='text';value.inputMode='decimal';value.className='value-display';value.setAttribute('aria-label',kindLabels[kind]+' '+name.textContent+' value');
   label.append(name,value);row.append(label,range);host.append(row);
   const binding=this.bindSlider(range,value,()=>read(key),v=>this.live(patch({[key]:v}),'Object '+name.textContent),min,max,step);
   controls.push({key,input:range,value,binding});
  }
  return controls;
 }
 syncFields(controls,kind,local=false){
  const disabled=local&&!this.selected().some(l=>!l.locked);
  for(const c of controls??[]){
   c.input.disabled=disabled;if(c.value)c.value.disabled=disabled;
   if(c.binding){const limits=['floraCount','fCount'].includes(c.key)?countLimits(this.tool.settings,kind):null;this.syncSlider(c.binding,limits?.min,limits?.max);}
   else {const state=c.read();c.mixed.hidden=!state.mixed;c.input.value=state.mixed?'':state.value;}
  }
 }
 sync(){
  const s=this.tool.settings,stack=getLayers(s),selected=this.selected(),l=this.editor.layer();
  const procedural=selected.length>0&&selected.every(l=>kindModes[l.kind]&&!['drawn','vector'].includes(l.mode));
  const commonKind=procedural&&selected.every(item=>item.kind===l.kind),mode=selectionValue(selected,item=>item.parameterMode);
  const individual=commonKind&&!mode.mixed&&mode.value==='individual';
  const propertyKey=individual?selected.map(l=>l.id).join(':')+':'+l.kind:'';
  if(this.propertyKey!==propertyKey){
   this.end();this.propertyKey=propertyKey;
   for(const c of this.localFields??[])if(c.binding){c.binding.abort.abort();this.bindings.delete(c.input.id);this.sliders.sliders.delete(c.input.id);}
   const host=byId('individualObjectFields');host.replaceChildren();this.localFields=individual?this.buildFields(host,l.kind,true,'individual'):[];
  }
  byId('objectParameterControls').hidden=!procedural;byId('individualObjectFields').parentElement.hidden=!individual;
  if(procedural){
   document.querySelectorAll('[data-parameter-mode]').forEach(b=>{b.setAttribute('aria-pressed',String(!mode.mixed&&b.dataset.parameterMode===mode.value));b.disabled=!selected.some(l=>!l.locked);});
   byId('sharedObjectSettings').hidden=!commonKind||mode.mixed||mode.value==='individual';byId('sharedObjectSettings').textContent='Shared '+kindLabels[l.kind]+' settings';
   this.syncFields(this.localFields,l.kind,true);
  }
  this.syncView();
  document.querySelectorAll('[data-add-kind]').forEach(b=>{b.disabled=stack.length>=MAX_LAYERS;});
  for(const kind of ['plant','flower']){
   const limits=countLimits(s,kind),key=countKey(kind);this.syncSlider(this.bindings.get(key+'Slider'),limits.min,limits.max);
   byId(key+'Slider').title=limits.min?limits.min+' Individual, pinned or locked objects are protected.':'Total '+(kind==='plant'?'Plants':'Flowers')+' in this document.';
  }

 }
 destroy(){this.end();for(const binding of this.bindings.values())binding.abort.abort();this.bindings.clear();this.sliders.sliders.clear();this.abort.abort();}
}
