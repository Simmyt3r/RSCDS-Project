# Remote Settlement Change Detection System (RSCDS)

**v0.3 · Browser-first deployment and private analysis queue.** Research prototype for satellite **change candidates**, not a scientifically validated detector of temporary settlements. Sentinel-2 10 m pixel data cannot reliably detect individual tents or infer occupants. All candidates remain unverified until independent human review.

**Start here:** [Open the six-step deployment guide](SETUP.md). The standalone browser setup assistant is [`public/setup.html`](public/setup.html). On Windows, double-click `START_SETUP_WINDOWS.bat` after downloading the repository. No local server or CLI is required for deployment.

## Deploy using browser dashboards only

1. **Vercel**: Open [New Project](https://vercel.com/new), import `Simmyt3r/RSCDS-Project`. Select framework **Other**, root `./`, output directory `public`, and leave the Build Command override disabled; `vercel.json` supplies `npm run build`. Vercel Git integration automatically redeploys after `main` updates.
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

## Vercel deploy validation (v0.3.2)

Deployment is deliberately **UI-led**: import this GitHub repository using [Vercel New Project](https://vercel.com/new). `vercel.json` sets the **Other** framework (`null`), `public` output, automatic preflight build, and the `sfo1` Functions region to colocate API requests with the current Aiven San Francisco database. No Vercel CLI is needed.

The build command `npm run build` validates the static assets, API endpoints, schema mirror, and setup instructions without requesting production secrets. GitHub Actions also runs this check on every push. If Vercel reports a build failure, inspect Deployments → Build Logs.

Set `DATABASE_URL`, `ADMIN_API_KEY` and `WORKER_API_KEY` as server-only Production environment variables before redeploying. The two keys **must be different**. Copy the same worker key into GitHub Actions secret `RSCDS_WORKER_API_KEY`; set repository variable `RSCDS_DEPLOY_URL` to the HTTPS site origin. The setup wizard checks readiness and protected endpoint status on the live site.

> This readiness validation checks source configuration and runtime guards, not scientific accuracy or a live end-to-end satellite analysis. Keep protected coordinates off public repository workflows.

## Imagery catalogue resilience (v0.3.3)

The Vercel `/api/scenes` endpoint now sends a basic, STAC-compliant Sentinel-2 search with date-only windows expanded to complete UTC days. It filters scene-wide cloud metadata and orders scenes locally. If Element84 rejects a POST request with a client/protocol error, a read-only GET fallback is attempted. Provider errors return HTTP 502 (504 for timeouts), while invalid user-supplied dates/bounds return HTTP 400. No sample or synthetic scenes are shown as real results.

The GitHub worker remains separate and requires the **Actions variable** `RSCDS_DEPLOY_URL=https://rscds.vercel.app` and the **Actions secret** `RSCDS_WORKER_API_KEY`. Set both in GitHub Settings → Secrets and variables → Actions; do not expose credentials in workflow inputs. Scheduled jobs may show as skipped until the variable is set. See `SETUP.md` for guided configuration.

## Satellite worker compatibility (v0.3.4)

The offline raster worker now matches the verified live catalogue lookup: it searches with portable core STAC fields and applies cloud-cover and band-availability screening locally. GitHub CI executes every Python test in `tests/`, including worker scene-selection checks. A green scheduled workflow with **no queued job** means the worker polled successfully but did not process imagery. Queue a non-sensitive test area from the RSCDS dashboard to start an actual analysis.

## Operator workflow and result provenance (v0.3.4)

A successful worker workflow does not necessarily mean imagery was processed: if the queue is empty, the GitHub job ends successfully and skips raster dependencies. The Satellite imagery screen now shows authenticated queue totals (queued, running, completed and failed), a clear explanation for idle workers, and automatic 60-second polling while its tab is visible. Each completed analysis has **View run results**, which scopes authenticated GeoJSON retrieval to that job. An analysis with zero changed polygons is **not** proof that no settlement change occurred.

The new Python worker STAC unit tests cover cloud filtering, missing bands and catalogue compatibility. GitHub CI executes all Python tests, including these offline test cases.

## Navigation reliability (v0.3.5)

RSCDS now loads independent navigation code before the map/dashboard script, so a Leaflet initialization error cannot disable the sidebar. Five sidebar destinations use real hash links that support reload, browser history, keyboard navigation and deep links. On narrow screens, use **Menu** to open a slide-in drawer; select a section, tap outside, tap the Close button, or press Escape to close it. The main JavaScript also binds critical controls before initializing the optional map and handles map failures gracefully. Credentials remain tab-local and never enter navigation URLs.

## Map basemap fix (v0.3.6)

The map no longer requests tiles from OpenStreetMap's volunteer-run standard tile servers, which returned HTTP 403 for the deployed app. It now uses OpenFreeMap's public no-API-key vector basemap through MapLibre GL (Leaflet adapter), with visible OpenFreeMap and OpenStreetMap attribution. See https://openfreemap.org/quick_start/ for the provider's official usage instructions. External tile availability is best effort.

**Coordinate-grid mode:** Select **Use coordinate grid** below the map to switch off third-party basemap requests and display a procedural coordinate grid instead. When the vector map fails to initialize, cannot use WebGL, reports repeated errors, or times out, the UI automatically falls back to this grid while preserving two-click study-area selection, review polygons, zoom, and pan. **Retry street map** is available after fallback. This grid provides orientation by coordinates only, not roads or real satellite imagery. The imagery analysis worker continues to use actual Sentinel-2 sources independently of the display basemap.

**Privacy:** A third-party street map can learn the approximate area being viewed through tile requests. Avoid navigating to sensitive humanitarian locations with the external basemap enabled; use coordinate grid for that work, and do not put sensitive study areas into public services.

## Independent satellite scene search (v0.3.7)

The **Search imagery** button is now owned by a small independent `public/imagery-search.js` script, not the map and dashboard initializers. It validates coordinates and date ranges before contacting the public `/api/scenes` endpoint, reports loading/partial-success/failure status in a live region, and renders each observation period even if the other fails. The **Use working example** button restores a non-sensitive example AOI and the 2025/2026 baseline dates. Source record links point to the original Element84 STAC metadata. Search results represent real acquisition records, not rendered imagery; the actual raster processing occurs through the separate secure analysis queue. If a person expects a satellite picture, searching the scene metadata is not the same as running or visualizing imagery.

## Visual Sentinel-2 photography comparison v0.4.0

After **Search imagery**, the system proposes the least-cloudy available Sentinel-2 true-colour acquisition in each time window. Operators can choose specific dated scenes with **Use as before image** and **Use as after image**, then click **Render satellite photographs**. RSCDS fetches canonical Earth Search item metadata and loads the genuine three-band true-colour `visual` GeoTIFF as a georeferenced, aligned before/after image comparison. Drag the **After image reveal** slider for a geographical swipe; pan and zoom retain map alignment. Actual public JPEG source quicklooks appear underneath for context (quicklooks themselves show wider scenes and are not aligned to the AOI).

This prototype uses the TiTiler **public demonstration endpoint** after an explicit user action. It shares requested map tile coordinates and public COG URLs with a third party, and may rate-limit or fail. **Never use it for sensitive humanitarian locations.** A privately hosted render service is required before operational use. External service failures leave the authentic source JPEG quicklooks visible.

**Overlay change polygons** uses only the administrator-authenticated protected `/api/detections` service and matches polygons against the exact selected `scene_before` and `scene_after` IDs. It doesn't invent polygons or show unrelated analysis results as if they belonged to the selected images. Polygons remain unverified unless independently reviewed. The administrator key is not sent to imagery providers or saved in browser storage.

## v0.5.0: Reproducible, private research evidence

For the first time, **completed** satellite jobs persist the actual before/after scene IDs, UTC acquisition timestamps, shared cloud-free pixel fraction, and the exact unvalidated processing method. The worker refuses completion if its own evidence metadata is missing, which avoids showing arbitrary scenes as evidence. An idle green GitHub workflow is still only a successful queue poll, not a completed satellite analysis.

The administrator-only API `/api/evidence?job_id=UUID&offset=0` returns one completed job's processing provenance, status counts, and paginated 100-feature GeoJSON records, including source scene pairs, review state and independent reviewer notes. Incomplete or failed jobs cannot appear as completed evidence. Exports must remain private. Fields are added through six additive, idempotent `ALTER TABLE` statements in `scripts/schema.sql`.

**Caution:** Provenance metadata and a human review trail improve reproducibility; they are not a scientifically validated settlement classification model.

## Linked visual evidence workspace (v0.5.0)

Open any completed run from the private analysis queue via **Open visual evidence**. The dedicated workspace uses administrator-only paginated evidence records, shows exact worker-selected source scenes, review counts and valid-pixel overlap, maps candidate polygons on a **local coordinate grid** (no public basemap requests), provides independent reviewer notes and status controls, and supports private export of provenance manifests and GeoJSON. A completed job without provenance is explicitly marked incomplete. Images are only sent to an external tile renderer after an explicit user action in the separate photo viewer. The application does not claim that an unvalidated spectral heuristic proves settlements.

## v0.5.1 reliability and data integrity

This is a quality release, not a feature expansion. Duplicate fingerprints are now scoped to each analysis job (or to manual imports), preserving repeat observations of the same candidate in independent runs. Fingerprints now include the analysis job ID, preventing collisions even with older globally unique indexes still present. The migration adds job-specific and manual-import indexes but does **not** drop an existing index or delete detection/review records.

Expired worker leases are reacquired within a database transaction, and any partial batches from an interrupted attempt are removed **only for the failed in-progress attempt** before reprocessing. Incoming batches lock the job's lease row before writing, so an outdated worker cannot race an expired lease recovery. Worker completion and failure also verify lease expiry. Observation-period validation now rejects impossible calendar dates rather than accepting JavaScript's rollover parsing.

Apply the idempotent `scripts/schema.sql` index statements to Aiven before deploying this version. The live rollout must follow the deployment limit policy; GitHub source and CI are not proof that production has updated.

**Compatibility note:** The Aiven connector cannot execute `DROP INDEX`. No manual index removal is needed: run-scoped fingerprints preserve per-run results under both new and historical schemas. The new partial indexes have already been added to RSCDS's isolated schema.

### Troubleshooting inconsistent deployment database readiness

The deployment's public health JSON now returns four non-sensitive booleans in `databaseChecks` if it connects: `detections`, `jobs`, `jobReference`, and `sceneProvenance`. It does **not** expose database connection strings, credentials, locations, or table content. If your Aiven PG Studio verifies all columns but the Vercel deployment reports a missing column, compare the configured Vercel `DATABASE_URL` against the correct Aiven service and database **inside those providers' secure consoles**. A successful check against one Aiven database does not prove that Vercel points at that same database. Do not roll out this version until the production target returns `database:"ready"`.

## October 2026 quality investigation: deployment target and spatial resolution

Production remains on the last known-good rollback until the newest deployment's database status is **ready**. The health JSON now distinguishes (1) connecting to the expected `defaultdb` database, (2) physically having the `scene_before` column in PostgreSQL's `pg_attribute` catalog, and (3) having visibility through `information_schema`. A missing physical column indicates the schema migration was applied to a **different database/instance**; a physical column present but hidden in `information_schema` indicates a permissions problem. The checks return only booleans and status text, never the database URI, credentials, or protected AOIs.

The Python worker now rejects study areas that require more than 1024 pixels in either direction on its 10-metre target grid. Previously those areas were silently downsampled, undermining the satellite detail. Choose a narrower bounding box if the worker reports this error. This does not make the Sentinel-2 spectral-change heuristic scientifically validated. Its 10-metre pixels still cannot resolve individual shelters reliably.

### Admission control and fail-closed queue checks

The queue validates the actual **Web Mercator 10 m pixel dimensions** before admitting a job, matching the worker's 1024×1024 cap even at higher latitudes. An operator receives the error immediately instead of after a failed GitHub Actions processing run. The protected jobs and worker-lease APIs now return HTTP 503 when the connected PostgreSQL database lacks the evidence provenance column, rather than accepting work destined to fail. The dashboard never marks a schema-mismatched system as healthy. Correct `DATABASE_URL` in the Vercel dashboard and create a fresh deployment to restore full processing.

## v0.6.0 administrative migrations and release integrity

An administrator may open **Deploy & configure → Apply database migrations securely**, supply the `ADMIN_API_KEY` in that browser tab, review the target database and the fixed migration list, explicitly confirm, and apply inside one PostgreSQL transaction protected by a transaction-scoped advisory lock. The endpoint accepts no SQL, object names, URLs, or file paths from callers. Each migration is recorded with a checksum and application timestamp in `rscds.schema_migrations`. Applied statements are skipped, and drift, stale snapshots or concurrent migrations are rejected. The feature runs only against the database configured by `DATABASE_URL` for that deployment; checking the intended Aiven instance before approval remains essential. An HTTP 200 build does not imply the correct database has been migrated.

Concurrent analysis submissions now serialize the capacity check with insertion; worker completion checks that **every stored candidate matches the exact source scene pair returned by the worker**, under the same row lock as batch insertion. Incorrect provenance prevents completion. These are engineering integrity tests, not independent settlement-classification validation.

## v0.6.0 defence and release documentation

- [Final QA/QC and release gate](docs/software/RELEASE_QA_QC_v0_6.md)
- [In-app migration operations manual](docs/software/ADMIN_MIGRATIONS_OPERATIONS.md)
- [Research defence brief, demonstration and panel Q&A](docs/research/RSCDS_DEFENCE_BRIEF.md)
- [Independent validation protocol](docs/research/VALIDATION_PROTOCOL.md)

**Gate is conditional:** unit tests and a built deployment do not establish live database readiness, an end-to-end real satellite analysis or scientific validity. Promotion requires verifying the correct Aiven instance and applying migrations explicitly in RSCDS.
