#!/usr/bin/env python3
"""Discover Earth Search scenes, read public COG assets, produce reviewable GeoJSON.

Cloud/scene filters and spectral preprocessing are mandatory, yet this prototype
is not a validated classifier of temporary human settlements.
"""
import argparse, json, math, pathlib, sys
import numpy as np
from pyproj import Transformer
from rasterio.transform import from_bounds
from rasterio.enums import Resampling
from rasterio.vrt import WarpedVRT
import rasterio
from pystac_client import Client
from detector import make_features

STAC='https://earth-search.aws.element84.com/v1'
COLLECTION='sentinel-2-c1-l2a'
BANDS=['blue','green','red','nir','swir16','scl']

def bbox_value(raw):
    try:v=[float(x) for x in raw.split(',')]
    except ValueError as e:raise argparse.ArgumentTypeError('Bounding box must be four numbers') from e
    if len(v)!=4 or not(-180<=v[0]<v[2]<=180) or not(-85<=v[1]<v[3]<=85) or v[2]-v[0]>.5 or v[3]-v[1]>.5:raise argparse.ArgumentTypeError('Invalid bounds or study region >0.5°')
    return v

def choose_scene(client,bbox,period,cloud_max):
    item_list=list(client.search(collections=[COLLECTION],bbox=bbox,datetime=period,query={'eo:cloud_cover':{'lte':cloud_max}},max_items=30).items())
    item_list=[i for i in item_list if all(k in i.assets for k in BANDS)]
    if not item_list:raise RuntimeError(f'No usable scene in {period}; change dates or cloud threshold')
    # Scene-wide cloud cover is only an initial filter. Pixelwise SCL mask is applied later.
    item_list.sort(key=lambda x:(float(x.properties.get('eo:cloud_cover',100)),x.datetime.isoformat() if x.datetime else ''))
    return item_list[0]

def target_grid(bbox):
    # EPSG:3857 area is an approximation, reasonably close for equatorial test AOIs.
    # Production work should use the locally appropriate UTM CRS and area calculations.
    tr=Transformer.from_crs('EPSG:4326','EPSG:3857',always_xy=True)
    w,s=tr.transform(bbox[0],bbox[1]);e,n=tr.transform(bbox[2],bbox[3])
    width=min(1024,max(32,math.ceil((e-w)/10)))
    height=min(1024,max(32,math.ceil((n-s)/10)))
    return from_bounds(w,s,e,n,width,height),width,height

def read_scene(item,grid):
    transform,width,height=grid;image={}
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',GDAL_HTTP_MAX_RETRY='3',GDAL_HTTP_RETRY_DELAY='1'):
        for key in BANDS:
            href=item.assets[key].href
            # Reject non-HTTPS links (not a user-supplied code/URL execution surface).
            if not href.startswith('https://'):raise RuntimeError('Only HTTPS public imagery assets supported')
            with rasterio.open(href) as src:
                with WarpedVRT(src,crs='EPSG:3857',transform=transform,width=width,height=height,resampling=Resampling.nearest if key=='scl' else Resampling.bilinear) as vrt:
                    val=vrt.read(1).astype(np.float32)
            if key != 'scl':
                # Apply raster:bands scale/offset when provided, otherwise Sentinel L2A nominal scaling.
                bandmeta=item.assets[key].extra_fields.get('raster:bands') or []
                scale=float(bandmeta[0].get('scale',0.0001)) if bandmeta else .0001
                offset=float(bandmeta[0].get('offset',0)) if bandmeta else 0.
                val=val*scale+offset
            image[key]=val
    valid=np.isin(image['scl'],[4,5,6,7])&(image['red']>0)&(image['nir']>0)
    for k in BANDS[:-1]:valid&=np.isfinite(image[k])
    return image,valid

def execute(bbox,before,after,output,cloud_max,min_pixels):
    client=Client.open(STAC)
    first=choose_scene(client,bbox,before,cloud_max)
    second=choose_scene(client,bbox,after,cloud_max)
    if first.id==second.id:raise RuntimeError('Identical scene selected for both observation periods')
    grid=target_grid(bbox)
    print(f'Selected {first.id} and {second.id} (grid {grid[1]} x {grid[2]})')
    image_a,valid_a=read_scene(first,grid);image_b,valid_b=read_scene(second,grid)
    if np.mean(valid_a&valid_b)<.3:raise RuntimeError('Less than 30% shared cloud-free pixels; choose other dates')
    features=make_features(image_a,image_b,valid_a,valid_b,grid[0],'EPSG:3857',min_pixels=min_pixels,scene_before=first.id,scene_after=second.id,source='Element84 Earth Search / Sentinel-2 Collection 1 L2A')
    result={'type':'FeatureCollection','features':features,'metadata':{'model':'explainable unvalidated change heuristic v0.1','status':'candidate_only','bbox':bbox,'before':first.id,'after':second.id,'before_date':first.datetime.isoformat(),'after_date':second.datetime.isoformat(),'cloud_max':cloud_max,'source':STAC,'valid_fraction':round(float(np.mean(valid_a&valid_b)),3),'warnings':['Do not infer people, displacement, or confirmed settlements from these results.','Requires independent labelled validation and human review.']}}
    path=pathlib.Path(output);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(result,indent=2))
    print(f'Exported {len(features)} UNVERIFIED change clusters to {path}')
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bbox',required=True,type=bbox_value)
    parser.add_argument('--before',required=True,help='YYYY-MM-DD/YYYY-MM-DD')
    parser.add_argument('--after',required=True,help='YYYY-MM-DD/YYYY-MM-DD')
    parser.add_argument('--out',default='outputs/change.geojson')
    parser.add_argument('--cloud-max',type=float,default=35)
    parser.add_argument('--min-pixels',type=int,default=9)
    args=parser.parse_args()
    if not (0<=args.cloud_max<=100):parser.error('cloud-max must be 0..100')
    if args.min_pixels<1:parser.error('min-pixels must be >=1')
    try:execute(args.bbox,args.before,args.after,args.out,args.cloud_max,args.min_pixels)
    except Exception as ex:print('Analysis failed:',ex,file=sys.stderr);sys.exit(2)
