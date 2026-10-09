"""Explainable satellite change candidates, NOT proof of human settlement."""
from __future__ import annotations
import numpy as np
from scipy import ndimage
from rasterio.features import shapes
from rasterio.warp import transform_geom

EPS=1e-6

def index(a,b):
    a=np.asarray(a,dtype=np.float32);b=np.asarray(b,dtype=np.float32)
    return (a-b)/(a+b+EPS)

def make_features(before, after, valid_before, valid_after, transform, crs, *, min_pixels=9, source='Sentinel-2 L2A STAC', scene_before='', scene_after=''):
    """Before/after dicts need red, green, blue, nir, swir16 as reflectance 0..1.

    Brightness/NDVI/NDBI rules are transparent heuristics until an independently
    validated classifier is trained. Cloud and no-data masks must be supplied.
    """
    keys=('red','green','blue','nir','swir16')
    if not all(k in before and k in after for k in keys):raise ValueError('Missing band')
    sh=np.shape(before['red'])
    if not all(np.shape(before[k])==sh and np.shape(after[k])==sh for k in keys):raise ValueError('Misaligned images')
    vb=np.asarray(valid_before,dtype=bool);va=np.asarray(valid_after,dtype=bool)
    if vb.shape!=sh or va.shape!=sh:raise ValueError('Mask mismatch')
    valid=vb & va
    for k in keys:valid &= np.isfinite(before[k]) & np.isfinite(after[k])
    ndvi0=index(before['nir'],before['red']);ndvi1=index(after['nir'],after['red'])
    ndbi0=index(before['swir16'],before['nir']);ndbi1=index(after['swir16'],after['nir'])
    bright0=np.mean([before[k] for k in ('red','green','blue')],axis=0)
    bright1=np.mean([after[k] for k in ('red','green','blue')],axis=0)
    loss=np.maximum(0,ndvi0-ndvi1);gain=np.maximum(0,bright1-bright0);built=np.maximum(0,ndbi1-ndbi0)
    candidates=valid&(loss>=.22)&(ndvi1<.5)&((gain>=.035)|(built>=.08))
    # Small isolated pixels suppressed; morphological closing is intentionally not
    # used because it can bridge unrelated structures into false polygons.
    labels,n=ndimage.label(candidates,structure=np.ones((3,3),dtype=np.uint8))
    pixel_area=abs(transform.a*transform.e-transform.b*transform.d)
    kept=np.zeros(sh,dtype=np.uint8)
    scores=np.clip(.45*(loss/.5)+.30*(gain/.15)+.25*(built/.3),0,1)
    metadata=[]
    for component in range(1,n+1):
        mask=labels==component
        if int(mask.sum())<min_pixels:continue
        # Do not call output 'settlement' because the score is about change only.
        kept[mask]=component%255 or 255
        metadata.append((component,mask,int(mask.sum()),float(np.mean(scores[mask]))))
    features=[]
    for component,mask,npix,score in metadata:
        for geometry,v in shapes(mask.astype('uint8'),mask=mask,transform=transform):
            if v!=1:continue
            geom=transform_geom(crs,'EPSG:4326',geometry,precision=7)
            features.append({'type':'Feature','geometry':geom,'properties':{
                'site_label':'Land-cover change candidate','area_m2':float(npix*pixel_area),'score':round(score,4),
                'review_status':'unverified','source':source,
                'scene_before':scene_before,'scene_after':scene_after,
                'method':'vegetation-loss + brightness/NDBI change (unvalidated heuristic)'}})
    return features
