#!/usr/bin/env python3
"""Import generated candidate GeoJSON directly to protected RSCDS API in batches.

For trusted CI/worker use. Coordinates must never be written to public logs/artifacts.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


def batches(features, size=100):
    if not isinstance(features, list):
        raise ValueError('Expected a FeatureCollection features array')
    for offset in range(0, len(features), size):
        yield features[offset:offset+size]


def endpoint_from_origin(value):
    parts=urlsplit(value.strip())
    if parts.scheme!='https' or not parts.hostname or parts.username or parts.password or parts.query or parts.fragment or parts.path not in ('','/'):
        raise ValueError('RSCDS_DEPLOY_URL must be an HTTPS origin only, e.g. https://example.vercel.app')
    return value.strip().rstrip('/')+'/api/detections'


def upload(file_path, origin, secret):
    if not secret or len(secret)<24:
        raise ValueError('RSCDS_ADMIN_API_KEY secret must be configured')
    endpoint=endpoint_from_origin(origin)
    obj=json.loads(Path(file_path).read_text(encoding='utf-8'))
    if obj.get('type')!='FeatureCollection' or not isinstance(obj.get('features'),list):
        raise ValueError('Input must be a GeoJSON FeatureCollection')
    total=0;skipped=0
    for batch in batches(obj['features']):
        body=json.dumps({'type':'FeatureCollection','features':batch}).encode('utf-8')
        request=Request(endpoint,data=body,headers={'Authorization':'Bearer '+secret,'Content-Type':'application/json','User-Agent':'RSCDS-private-worker/0.2'},method='POST')
        try:
            with urlopen(request,timeout=60) as response:
                payload=json.load(response)
        except HTTPError as error:
            raise RuntimeError('Protected import failed with HTTP '+str(error.code)) from None
        except URLError:
            raise RuntimeError('Protected import connection failed') from None
        total+=int(payload.get('imported',0));skipped+=int(payload.get('skipped_duplicates',0))
    print(f'Protected import finished: {total} new candidates, {skipped} duplicates skipped. No geometry printed.')
    return total,skipped


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file',required=True)
    args=parser.parse_args()
    try:
        upload(args.file,os.environ.get('RSCDS_DEPLOY_URL',''),os.environ.get('RSCDS_ADMIN_API_KEY',''))
    except Exception as exc:
        parser.exit(2,f'Import error: {exc}\n')
