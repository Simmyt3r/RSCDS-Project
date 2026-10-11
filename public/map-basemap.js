/* RSCDS basemap controller. Public OpenFreeMap vector maps with no API key,
   with a fully local coordinate grid fallback for outages or sensitive work.
   Never use the volunteer-run OSM standard tile servers as an app backend. */
(function(){
  'use strict';
  const STYLE='https://tiles.openfreemap.org/styles/liberty';
  const modes=['streets','grid'];
  let leafletMap=null;
  let activeLayer=null;
  let activeGL=null;
  let watchdog=null;
  let mode='streets';
  let failures=0;
  let loaded=false;
  let requestId=0;
  const $=id=>document.getElementById(id);
  function status(message,kind){
    const label=$('map-status');
    if(label){label.textContent=message;label.dataset.status=kind||'info';}
  }
  function updateButtons(){
    const toggle=$('map-grid-only');
    if(toggle){
      toggle.textContent=mode==='grid'?'Show street basemap':'Use coordinate grid';
      toggle.setAttribute('aria-pressed',String(mode==='grid'));
    }
    const retry=$('map-retry');
    if(retry)retry.hidden=mode!=='grid';
  }
  function clear(){
    if(watchdog){clearTimeout(watchdog);watchdog=null;}
    if(activeLayer){try{leafletMap.removeLayer(activeLayer);}catch{}}
    activeLayer=null;activeGL=null;
    failures=0;loaded=false;
  }
  function lon(x,z){return (x/Math.pow(2,z))*360-180;}
  function lat(y,z){return Math.atan(Math.sinh(Math.PI*(1-2*y/Math.pow(2,z))))*180/Math.PI;}
  function gridLayer(){
    const layer=L.gridLayer({tileSize:256,updateWhenIdle:true});
    layer.createTile=coords=>{
      const canvas=document.createElement('canvas');
      canvas.width=256;canvas.height=256;
      const ctx=canvas.getContext?.('2d');
      if(!ctx)return canvas;
      ctx.fillStyle=(coords.x+coords.y)%2?'#edf5f4':'#f4f9f8';
      ctx.fillRect(0,0,256,256);
      ctx.strokeStyle='#bfd9da';ctx.lineWidth=1;
      ctx.strokeRect(.5,.5,255,255);
      for(let i=64;i<256;i+=64){
        ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,256);ctx.moveTo(0,i);ctx.lineTo(256,i);ctx.stroke();
      }
      const x=lon(coords.x,coords.z),y=lat(coords.y,coords.z);
      ctx.fillStyle='#587f85';ctx.font='12px system-ui';
      ctx.fillText(x.toFixed(2)+'° lon, '+y.toFixed(2)+'° lat',12,24);
      return canvas;
    };
    return layer;
  }
  function showGrid(message){
    mode='grid';requestId++;clear();
    if(leafletMap&&typeof L!=='undefined'&&typeof L.gridLayer==='function'){
      activeLayer=gridLayer();activeLayer.addTo(leafletMap);
    }
    updateButtons();
    status(message||'Coordinate grid only. Click two map corners to select an area. No external basemap requests.','grid');
  }
  function startStreets(){
    if(!leafletMap)return;
    mode='streets';requestId++;const generation=requestId;clear();
    updateButtons();
    if(typeof L==='undefined'||typeof L.maplibreGL!=='function'||!window.maplibregl){
      showGrid('Map library unavailable. Coordinate grid active; select two corners as usual.');
      return;
    }
    try{
      if(typeof window.maplibregl.supported==='function'&&!window.maplibregl.supported()){
        showGrid('WebGL is unavailable. Coordinate grid active; select two corners as usual.');
        return;
      }
      status('Loading OpenFreeMap streets and boundaries…','loading');
      const layer=L.maplibreGL({
        style:STYLE,
        attribution:'© <a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
      });
      activeLayer=layer;
      layer.addTo(leafletMap);
      const gl=layer.getMaplibreMap?.();
      activeGL=gl;
      if(!gl||typeof gl.on!=='function'){
        showGrid('Vector map integration unavailable. Coordinate grid active.');
        return;
      }
      gl.on('load',()=>{
        if(generation!==requestId)return;
        loaded=true;
        if(watchdog){clearTimeout(watchdog);watchdog=null;}
        status('Street basemap ready · OpenFreeMap and OpenStreetMap contributors','ready');
      });
      gl.on('error',()=>{
        if(generation!==requestId)return;
        failures++;
        if(failures>=3)showGrid('Street map tiles failed. Switched to the coordinate grid; area selection remains available.');
      });
      watchdog=setTimeout(()=>{
        if(generation===requestId&&!loaded)showGrid('Street map is taking too long. Coordinate grid active; use Retry map when available.');
      },18000);
    }catch{
      showGrid('Street map could not initialize. Coordinate grid active; area selection remains available.');
    }
  }
  function setMode(value){
    if(!modes.includes(value))return;
    if(value==='grid')showGrid();
    else startStreets();
  }
  function attach(map){
    leafletMap=map;
    $('map-grid-only')?.addEventListener('click',()=>setMode(mode==='grid'?'streets':'grid'));
    $('map-retry')?.addEventListener('click',()=>startStreets());
    startStreets();
  }
  window.RSCDSBaseMap={attach,setMode,mode:()=>mode};
})();
