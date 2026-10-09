# Remote Settlement Change Detection System (RSCDS)

**v0.3 · Browser-first deployment and private analysis queue.** Research prototype for satellite **change candidates**, not a scientifically validated detector of temporary settlements. Sentinel-2 10 m pixel data cannot reliably detect individual tents or infer occupants. All candidates remain unverified until independent human review.

**Start here:** [Open the six-step deployment guide](SETUP.md). The standalone browser setup assistant is [`public/setup.html`](public/setup.html). On Windows, double-click `START_SETUP_WINDOWS.bat` after downloading the repository. No local server or CLI is required for deployment.

## Deploy using browser dashboards only

1. **Vercel**: Open [New Project](https://vercel.com/new), import `Simmyt3r/RSCDS-Project`. Select framework **Other**, root `./`, output directory `public`, and leave Build Command blank. Vercel Git integration automatically redeploys after `main` updates.
2. **Aiven**: In [Aiven Console](https://console.aiven.io/), open the existing PostgreSQL service and PG Studio SQL editor. Apply `scripts/schema.sql` (idempotent, namespaced `rscds`). It adds a private analysis queue and candidates tables with PostGIS indexes and **never erases unrelated databases**. If this schema was already applied and updated by your administrator, skip reapplying.
3. **Vercel** → Project Settings → Environment Variables (server-side sensitive, Production):
   - `DATABASE_URL`: Aiven PostgreSQL URI, TLS enabled; never put it in public source or in the client browser.
   - `ADMIN_API_KEY`: generate a unique secret at least 24 characters; use the deployment page's local secure generator.
   - `WORKER_API_KEY`: generate a **different** strong secret for GitHub's analysis worker (never share admin key with worker).
4. **GitHub** → Repository Settings → Secrets and variables → Actions:
   - **Variable** `RSCDS_DEPLOY_URL`: HTTPS origin of deployed Vercel site (for example `https://your-project.vercel.app`, without a slash or path).
   - **Secret** `RSCDS_WORKER_API_KEY`: exactly the same value as Vercel's `WORKER_API_KEY`, **not** the admin key.
5. Return to Vercel → Deployments → **Redeploy** after setting secrets. Open **Deploy & configure** to inspect health. Then use **Satellite imagery** → enter AOI/dates → unlock with admin key → **Queue secure analysis**.
6. A scheduled GitHub Action checks the private queue every 30 minutes (scheduling can be delayed). To run sooner use GitHub → Actions → **Private Satellite Analysis Queue** → **Run workflow**. **No coordinates or date inputs appear in the GitHub workflow form.** The job is leased from your private API, analyzed in the runner, and results are transferred in protected batches directly to your Aiven-backed review workspace. No geometry is printed into logs and no artifact is uploaded.

**The browser-based deployment wizard helps configure external services; it cannot bypass Vercel/GitHub secret permissions.** If you have not deployed yet, the website and queue remain local source code.

## Secure workflow overview

```text
Browser (authenticated admin) ── POST /api/jobs ──► Aiven rscds.analysis_jobs
                 ↑                               │
                 │                        worker lease token
           GET /api/jobs                          ▼
                 │                 GitHub Actions (private API only)
                 │                               │
                 ▼                        cloud-masked Sentinel-2
     Review workspace ◄─ rscds.detections ◄─ batch API imports
```

- Private study areas, date windows, failures and review records remain behind admin authentication. The worker authenticates separately with `WORKER_API_KEY`; leases expire and retries are bounded.
- A study area submitted for analysis is limited to 0.09° × 0.09° to avoid the worker's capped 1024-pixel raster grid silently producing coarse imagery. Scene *search* permits larger bounding boxes.
- Queue at most 5 analyses at a time. The workflow processes one queued job per run; GitHub Actions scheduled checks may be delayed and are not a guaranteed near-real-time service.
- Candidate geometry from an incomplete or failed job is not visible to reviewers; manual retry clears abandoned batches. Duplicate fingerprints are skipped.
- **Public repository warning:** even without public coordinates, GitHub workflow timing and metadata remain observable. For vulnerable populations or high-risk locations use a private repository and trusted controlled runner, apply strong access controls, and conduct a protection impact review before operational use.
- Never use candidate pixels as evidence of population, migration, displacement, or confirmed settlement status.

## Local development (optional)

- Node 20+: `npm install`, `npm test`; run Vercel emulation if developing locally. Browser deployment requires no local tools.
- Python 3.11+: `pip install -r requirements-worker.txt` and `python -m pytest tests -q`.
- The optional local setup wizard is `python scripts/setup_ui.py`; **Vercel dashboard setup does not require this script**.
- Worker and per-feature provenance: `worker/analyze.py`, `worker/detector.py`, `api/_ingest.js`.

## Research and engineering deliverables

Five software engineering documents and Chapters 1–3 / Chapters 1–5 editable manuscripts live in `docs/` and `deliverables/`. The Word documents were generated for the initial research prototype; the latest browser-only operational configuration is maintained in `docs/software/05_Deployment_and_Operations_Manual.md`. No real-world accuracy metrics have yet been validated.

Primary sources: [ESA Sentinel-2](https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-2) · [Element84 Earth Search STAC](https://earth-search.aws.element84.com/v1) · [Aiven PostGIS](https://aiven.io/docs/products/postgresql/reference/list-of-extensions) · [Vercel Git deployments](https://vercel.com/docs/deployments/git).
