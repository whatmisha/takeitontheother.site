const pigment=await (await fetch('./pigment-settings.json')).json();
const ember=await (await fetch('../../../presets/ember.json')).json();
const cases=[];
for(const [name,preset] of [['Ember',ember],['Pigment',pigment]]) for(const seed of [1565559100,80423,925731,247109]) cases.push({label:name+' · '+seed,settings:{...preset,seed}});
cases.push({label:'Ember · Glow 82',settings:{...ember,glow:82}});
cases.push({label:'Abstract',settings:{...pigment,mode:'abstract',seed:925731,scale:125,flow:85,complexity:3,glow:34}});
const filename=(i,after)=>String(i*2+(after?2:1)).padStart(2,'0')+'.png';
function mount(){document.getElementById('grid').replaceChildren();cases.forEach((entry,i)=>{for(const after of [false,true]){const f=document.createElement('figure'),a=document.createElement('a'),img=new Image(),label=document.createElement('figcaption');img.src=filename(i,after)+'?v='+Date.now();img.alt=entry.label+(after?' · после':' · до');label.textContent=img.alt;a.href=img.src;a.append(img);f.append(a,label);document.getElementById('grid').append(f);}});}
mount();
