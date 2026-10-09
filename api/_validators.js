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
export function validateGeometry(geom) {
 if(!geom || !['Polygon','MultiPolygon'].includes(geom.type)) throw Error('Unsupported geometry type');
 const polygons=geom.type==='Polygon'?[geom.coordinates]:geom.coordinates;
 if(!Array.isArray(polygons)||!polygons.length||polygons.length>100)throw Error('Invalid number of polygons');
 let count=0;
 for(const polygon of polygons){
  if(!Array.isArray(polygon)||!polygon.length||polygon.length>100)throw Error('Invalid polygon rings');
  for(const ring of polygon){
   if(!Array.isArray(ring)||ring.length<4||ring.length>10000)throw Error('Invalid polygon ring');
   const positions=ring.map(p=>{
    if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<-180||p[0]>180||p[1]<-85||p[1]>85)throw Error('Invalid coordinates');
    if(++count>10000)throw Error('Geometry vertex limit exceeded');
    return p;
   });
   if(positions[0][0]!==positions.at(-1)[0]||positions[0][1]!==positions.at(-1)[1])throw Error('Polygon ring must be closed');
  }
 }
 return true;
}
export function validateFeature(f){
 if(!f||f.type!=='Feature')throw Error('Expected GeoJSON Feature');
 validateGeometry(f.geometry);
 const p=f.properties||{};
 if(typeof p.area_m2!=='number'||!(p.area_m2>0)||!(p.area_m2<=1e8))throw Error('Invalid area_m2');
 if(typeof p.score!=='number'||p.score<0||p.score>1)throw Error('Score must range 0..1');
 const src=p.source;
 if(typeof src!=='string'||src.length>500)throw Error('Source provenance required');
 if(!['unverified','rejected','verified'].includes(p.review_status||'unverified'))throw Error('Invalid review status');
 if((p.review_status||'unverified')!=='unverified')throw Error('Imported features must begin unverified');
 return p;
}
