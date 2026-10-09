import importlib.util
from pathlib import Path
import pytest
spec=importlib.util.spec_from_file_location('import_candidates',Path(__file__).resolve().parents[1]/'scripts'/'import_candidates.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def test_batches_chunk_100():
    chunks=list(mod.batches(list(range(205))))
    assert list(map(len,chunks))==[100,100,5]

def test_reject_http_or_token_in_url():
    for url in ['http://example.com','https://user:pass@example.com','https://example.com/?api_key=abc']:
        with pytest.raises(ValueError):mod.endpoint_from_origin(url)

def test_accepted_deployment_origin():
    assert mod.endpoint_from_origin('https://example.vercel.app/')=='https://example.vercel.app/api/detections'
