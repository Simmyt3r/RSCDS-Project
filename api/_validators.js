export function parseBBox(v){
 let bbox=(typeof v==='string'?v.split(','):v).map(Number);
 if(bbox.length!==4||!bbox.every(Number.isFinite))throw Error('bbox must be minLon,minLat,maxLon,maxLat');
 let [w,s,e,n]=bbox;
 if(w< -180||e>180||s< -85||n>85||w>=e||s>=n)throw Error('Invalid bounding box');
 if(e-w>0.5||n-s>0.5)throw Error('Study area too large. Use a bbox no wider/taller than 0.5 degrees.');
 return bbox;
}
export function validPeriod(v){
 if(typeof v!=='string'|| !/^\d{4}-\d\d-\d\d\/\d{4}-\d\d-\d\d$/.test(v))throw Error('Use YYYY-MM-DD/YYYY-MM-DD');
 let [a,b]=v.split('/');
 if(!Number.isFinite(Date.parse(a))||!Number.isFinite(Date.parse(b))||a>b)throw Error('Invalid observation dates');
 return v;
}
export function validateFeature(f){
 if(!f||f.type!=='Feature'||!f.geometry||!['Polygon','MultiPolygon'].includes(f.geometry.type))throw Error('Feature geometry must be Polygon/MultiPolygon');
 const p=f.properties||{};
 if(typeof p.area_m2!=='number'||!(p.area_m2>0)||!(p.area_m2<=1e8))throw Error('Invalid area_m2');
 if(typeof p.score!=='number'||p.score<0||p.score>1)throw Error('Score must range 0..1');
 const src=p.source;
 if(typeof src!=='string'||src.length>500)throw Error('Source provenance required');
 if(!['unverified','rejected','verified'].includes(p.review_status||'unverified'))throw Error('Invalid review status');
 if((p.review_status||'unverified')!=='unverified')throw Error('Imported features must begin unverified');
 return p;
}
