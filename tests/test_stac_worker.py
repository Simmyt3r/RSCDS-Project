"""Offline validation of the real satellite-worker STAC scene-selection logic."""
import datetime
import pathlib
import sys
from types import SimpleNamespace

sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'worker'))
from analyze import BANDS, choose_scene

class Search:
    def __init__(self, items):
        self._items=items
    def items(self):
        return iter(self._items)

class Catalog:
    def __init__(self, scenes):
        self.scenes=scenes
        self.options=None
    def search(self, **options):
        self.options=options
        return Search(self.scenes)

def scene(identifier, cloud, *, missing=(), when=7):
    return SimpleNamespace(id=identifier,
        datetime=datetime.datetime(2025,1,when,tzinfo=datetime.timezone.utc),
        assets={key:object() for key in BANDS if key not in missing},
        properties={'eo:cloud_cover':cloud})

def test_worker_uses_portable_core_stac_search_not_query_extension():
    catalog=Catalog([scene('cloudy',70),scene('good',7),scene('moderate',25)])
    selected=choose_scene(catalog,[8.2,7.6,8.25,7.65],'2025-01-01/2025-02-01',35)
    assert selected.id=='good'
    assert catalog.options['max_items']==80
    assert 'query' not in catalog.options
    assert catalog.options['collections']==['sentinel-2-c1-l2a']

def test_worker_skips_missing_bands_and_nonnumeric_cloud_values():
    catalog=Catalog([scene('bad-assets',1,missing=('scl',)),
                     scene('unknown-cloud',None),scene('usable',15)])
    assert choose_scene(catalog,[8.2,7.6,8.25,7.65],'2025-01-01/2025-02-01',35).id=='usable'

def test_worker_reports_absence_without_faking_scenes():
    catalog=Catalog([scene('clouded',80),scene('without-red',5,missing=('red',))])
    try:
        choose_scene(catalog,[8.2,7.6,8.25,7.65],'2025-01-01/2025-02-01',35)
    except RuntimeError as e:
        assert 'No usable scene' in str(e)
    else:
        assert False,'Expected the worker to fail rather than invent a scene'
