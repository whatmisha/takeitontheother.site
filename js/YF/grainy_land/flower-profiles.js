// Data-only recipes for the shared F generator. Lengths are fractions of Size;
// angles are radians. Zero coefficients disable a deformation, not a code path.
// Contour points describe one closed petal: u is distance from its attachment,
// side is lateral direction, width is a numeric profile or the variable 'neck'.
const tapered=[
 {u:.20,side:-1,width:'neck'},{u:.52,side:-1,width:.78},
 {u:.82,side:-1,width:1},{u:1,side:0,width:0},
 {u:.82,side:1,width:.92,widthNoise:1},{u:.48,side:1,width:.72},
 {u:.18,side:1,width:'neck'}
];
const flared=[
 {u:.18,side:-1,width:'neck'},{u:.50,side:-1,width:.65},
 {u:.85,side:-1,width:1},{u:1,side:-.55,width:.9,tipShift:1},
 {u:.98,side:.45,width:.98,tipShift:-1},{u:.80,side:1,width:.94},
 {u:.45,side:1,width:.70},{u:.17,side:1,width:'neck'}
];
const paddle=[
 {u:.18,side:-1,width:'neck'},{u:.48,side:-1,width:.88},
 {u:.78,side:-1,width:1},{u:1,side:-.36,width:.8,tipShift:1},
 {u:1.03,side:.35,width:.9,tipShift:-1},{u:.65,side:1,width:1.10},
 {u:.37,side:1,width:.83},{u:.16,side:1,width:'neck'}
];
const circular={span:Math.PI*2,openingSpan:0,origin:0,includeEnd:false,phase:.28,phaseBase:1,phaseAsymmetry:0,jitter:.26};
const arc={span:0,openingSpan:0,origin:.5,includeEnd:true,phase:.3,phaseBase:0,phaseAsymmetry:1,jitter:.40};
const neutralGrowth={asymmetry:0,abstraction:0,bias:0,wave:0,shear:0,warp:0};
const organicGrowth={asymmetry:.50,abstraction:.28,bias:0,wave:.12,shear:.32,warp:.17};
const narrowWidth={base:.11,control:.40,abstraction:0,multiplier:1,noise:[-.25,.25]};
const broadWidth={base:.10,control:.36,abstraction:.16,multiplier:1,noise:[-.25,.28]};
const straightBend={lateralNoise:.65,lateralCurl:0,retreat:0,skew:0,tip:0,contourNoise:.22};
const curledBend={lateralNoise:.70,lateralCurl:.28,retreat:.14,skew:.24,tip:.16,contourNoise:0};
const arch={spread:.55,openingSpread:.45,linear:0,openingLinear:0,arch:.08,closingArch:.50,curl:.50,depthOffset:0};
const roundedLength={radius:.31,noise:[-.35,.28],min:null,max:null,edge:1,edgeWave:0};
const organicLength={radius:.35,noise:[-.35,.25],min:.38,max:1.65,edge:1,edgeWave:0};
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export const flowerProfiles=freeze({
 fan:{label:'Fan',arrangement:{...arc,span:1.05,openingSpan:2.9},
  length:{...organicLength,edge:.83,edgeWave:.17},width:{...broadWidth,multiplier:1.10},
  neck:{base:.12,abstraction:.42},growth:organicGrowth,bend:curledBend,
  projection:arch,contour:flared,maxRadius:.43},
 cup:{label:'Cup',arrangement:circular,length:roundedLength,width:narrowWidth,
  neck:{base:.10,abstraction:.22},growth:neutralGrowth,bend:straightBend,
  projection:{...arch,spread:.30,openingSpread:.70,linear:1.35,openingLinear:-.45,arch:0,closingArch:0,depthOffset:.4},
  contour:tapered,maxRadius:null},
 lobed:{label:'Lobed',arrangement:{...arc,span:2.2,openingSpan:2.4},
  length:organicLength,width:{...broadWidth,multiplier:1.20},
  neck:{base:.12,abstraction:.42},growth:{...organicGrowth,bias:.12},bend:curledBend,
  projection:{...arch,spread:.67,openingSpread:.24},contour:paddle,maxRadius:.43},
 radial:{label:'Radial',arrangement:circular,length:roundedLength,width:narrowWidth,
  neck:{base:.10,abstraction:.22},growth:neutralGrowth,bend:straightBend,
  projection:{...arch,closingArch:.55},contour:tapered,maxRadius:null}
});
