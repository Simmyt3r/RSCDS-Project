"""Offline tests for job runner privacy and batching."""
import importlib.util
import json
from pathlib import Path
from unittest.mock import patch

FILE=Path(__file__).resolve().parents[1]/'scripts'/'run_queued_analysis.py'
spec=importlib.util.spec_from_file_location('queue_runner',FILE)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def sample_job():
    return {'id':'123e4567-e89b-42d3-a456-426614174000',
            'lease_token':'123e4567-e89b-42d3-a456-426614174001',
            'bbox':[8.2,7.6,8.25,7.65],
            'before_window':'2025-01-01/2025-03-31',
            'after_window':'2026-01-01/2026-03-31',
            'cloud_max':35,'min_pixels':9}


def test_endpoint_validation_rejects_insecure_origin(monkeypatch):
    monkeypatch.setenv('RSCDS_DEPLOY_URL','http://example.com')
    try:module.endpoint()
    except ValueError:pass
    else:assert False,'Expected rejection'
    monkeypatch.setenv('RSCDS_DEPLOY_URL','https://example.com')
    assert module.endpoint()=='https://example.com/api/worker'


def test_worker_batches_and_suppresses_scene_logging(capsys):
    features=[{'type':'Feature','id':i} for i in range(225)]
    calls=[]
    def sender(api,token,body):
        calls.append(body)
        return {'status':'ok'}
    def analyzer(bbox,before,after,out,cloud,pixels):
        print('CONFIDENTIAL: satellite scene coordinates '+str(bbox))
        Path(out).write_text(json.dumps({'features':features}))
        return {'features':features}
    with patch.object(module,'post',side_effect=sender):
        assert module.run_job('https://example.com/api/worker','a'*30,sample_job(),analyzer)==0
    captured=capsys.readouterr()
    assert 'CONFIDENTIAL' not in captured.out
    assert '8.2' not in captured.out
    assert [x['action'] for x in calls]==['batch','batch','batch','complete']
    assert [len(x['features']['features']) for x in calls[:-1]]==[100,100,25]


def test_worker_failure_reports_only_generic_message(capsys):
    calls=[]
    def sender(api,token,body):
        calls.append(body)
        return {}
    def fail(*args):raise RuntimeError('Scene ID SECRET-LOCATION-123')
    with patch.object(module,'post',side_effect=sender):
        assert module.run_job('https://example.com/api/worker','a'*30,sample_job(),fail)==1
    output=capsys.readouterr()
    assert 'SECRET-LOCATION-123' not in output.err
    assert calls[-1]['action']=='fail'
