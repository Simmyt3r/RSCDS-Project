#!/usr/bin/env python3
"""Process one protected RSCDS job from GitHub Actions without logging its AOI.

Credentials and target URL belong in GitHub Actions secrets/variables. This script
never puts coordinates, scene IDs, imagery links or GeoJSON in workflow logs.
"""
import argparse
import contextlib
import io
import json
import os
import pathlib
import sys
import tempfile
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError


def endpoint():
    url=os.environ.get('RSCDS_DEPLOY_URL','').strip().rstrip('/')
    parsed=urlparse(url)
    if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path:
        raise ValueError('RSCDS_DEPLOY_URL must be a HTTPS origin without path or credentials')
    return url+'/api/worker'


def post(api,token,payload):
    body=json.dumps(payload,allow_nan=False).encode('utf-8')
    req=Request(api,data=body,method='POST',headers={
        'Authorization':'Bearer '+token,'Content-Type':'application/json',
        'Accept':'application/json','User-Agent':'RSCDS-protected-worker/1.0'})
    try:
        with urlopen(req,timeout=120) as response:
            return json.load(response)
    except HTTPError as exc:
        # Suppress the response body: proxy error pages may echo protected fields.
        raise RuntimeError(f'Protected API returned HTTP {exc.code}') from None


def run_job(api,token,job,analyzer):
    claim={'id':job['id'],'lease_token':job['lease_token']}
    try:
        # All imagery URLs, scene IDs, coordinates and provenance are protected.
        with tempfile.TemporaryDirectory(prefix='rscds-') as folder:
            target=pathlib.Path(folder)/'result.geojson'
            with contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):
                data=analyzer(
                    job['bbox'],job['before_window'],job['after_window'],str(target),
                    job['cloud_max'],job['min_pixels'])
            features=data['features']
            if not isinstance(features,list) or len(features)>5000:
                raise RuntimeError('Results exceed the permitted feature count')
            for offset in range(0,len(features),100):
                post(api,token,{**claim,'action':'batch','features':{
                    'type':'FeatureCollection','features':features[offset:offset+100]}})
            post(api,token,{**claim,'action':'complete'})
        print('Analysis completed. Candidate locations are available only to authenticated RSCDS reviewers.')
        return 0
    except Exception as exc:
        # Original errors go to the protected API only; it sanitizes them for storage.
        try:post(api,token,{**claim,'action':'fail','message':str(exc)})
        except Exception:pass
        print('Analysis failed. Review job status in the private RSCDS dashboard.',file=sys.stderr)
        return 1


def main():
    parser=argparse.ArgumentParser(description='Lease and process one private satellite analysis job')
    modes=parser.add_mutually_exclusive_group()
    modes.add_argument('--lease-to',help='Create protected temporary lease file and GITHUB_OUTPUT flag')
    modes.add_argument('--process-from',help='Process previously leased job from a temporary file')
    args=parser.parse_args()
    token=os.environ.get('RSCDS_WORKER_API_KEY','')
    if len(token)<24:
        print('Worker secret is not configured.',file=sys.stderr)
        return 2
    api=endpoint()
    if args.process_from:
        job=json.loads(pathlib.Path(args.process_from).read_text(encoding='utf-8'))
        sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'worker'))
        from analyze import execute
        return run_job(api,token,job,execute)
    response=post(api,token,{'action':'lease'})
    job=response.get('job')
    if not job:
        print('No queued analysis jobs.')
        return 0
    if args.lease_to:
        destination=pathlib.Path(args.lease_to)
        destination.write_text(json.dumps(job),encoding='utf-8')
        destination.chmod(0o600)
        if os.environ.get('GITHUB_OUTPUT'):
            with open(os.environ['GITHUB_OUTPUT'],'a',encoding='utf-8') as output:
                output.write('ready=true\n')
        print('Leased one protected job; processing dependencies will be installed.')
        return 0
    sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'worker'))
    from analyze import execute
    return run_job(api,token,job,execute)


if __name__=='__main__':
    try:sys.exit(main())
    except Exception:
        print('Unable to contact protected analysis API. Check GitHub Actions configuration.',file=sys.stderr)
        sys.exit(2)
