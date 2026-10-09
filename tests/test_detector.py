import sys,pathlib
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'worker'))
import numpy as np
from rasterio.transform import from_origin
from detector import make_features,index

def bands(red=.16,green=.18,blue=.13,nir=.54,swir16=.15,shape=(20,20)):
    return {k:np.full(shape,v,dtype=np.float32) for k,v in locals().copy().items() if k in ('red','green','blue','nir','swir16')}

def test_ndvi_index():
    assert round(float(index(0.6,0.2)),2)==.5

def test_vegetation_removal_triggers_candidate():
    a=bands();b=bands(red=.32,green=.37,blue=.3,nir=.33,swir16=.41)
    features=make_features(a,b,np.ones((20,20),bool),np.ones((20,20),bool),from_origin(900000,1000000,10,10),'EPSG:3857')
    assert len(features)>=1
    assert features[0]['properties']['review_status']=='unverified'
    assert features[0]['properties']['area_m2']>=40000

def test_cloud_or_missing_pixels_excluded():
    a=bands();b=bands(red=.32,green=.37,blue=.3,nir=.33,swir16=.41)
    features=make_features(a,b,np.zeros((20,20),bool),np.ones((20,20),bool),from_origin(900000,1000000,10,10),'EPSG:3857')
    assert not features

def test_no_change_is_not_candidate():
    a=bands()
    features=make_features(a,a,np.ones((20,20),bool),np.ones((20,20),bool),from_origin(900000,1000000,10,10),'EPSG:3857')
    assert not features

def test_minimum_area_filter():
    a=bands();b={k:v.copy() for k,v in a.items()}
    for k,v in {'red':.32,'green':.37,'blue':.3,'nir':.33,'swir16':.41}.items():b[k][0:2,0:2]=v
    features=make_features(a,b,np.ones((20,20),bool),np.ones((20,20),bool),from_origin(900000,1000000,10,10),'EPSG:3857',min_pixels=9)
    assert not features
