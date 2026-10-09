# Remote Settlement Change Detection System (RSCDS)

**Version 0.2 – browser-first Vercel/Aiven deployment and cloud analysis.** This is a candidate-change research prototype, **not a validated settlement classifier**. Sentinel-2 data often cannot resolve individual shelters. Every imported change feature starts unverified and requires independent human evidence.

## Deploy entirely via web dashboards

1. **GitHub:** Confirm the `Simmyt3r/RSCDS-Project` repository is available and CI tests pass.
2. **Aiven Console:** Open the PostgreSQL service → **PG Studio → SQL Editor**, paste [`scripts/schema.sql`](scripts/schema.sql), and run selected statements. The migration is additive and isolated under schema `rscds`; it never drops unrelated tables. PostGIS must be enabled (included in the script).
3. **Vercel Dashboard:** Add New → Project → Import `Simmyt3r/RSCDS-Project`. Framework **Other**, root `./`, output directory `public`, blank Build Command. `vercel.json` also declares `outputDirectory: public`.
4. **Vercel → Project Settings → Environment Variables:** Add **`DATABASE_URL`** (Aiven PostgreSQL URI with SSL) and **`ADMIN_API_KEY`** (unique random secret, at least 24 characters) as server-side sensitive/encrypted variables. Deploy or redeploy from the Vercel UI. **Never commit secrets.**
5. Open the deployed website's **Deploy & configure** tab to follow its browser-based checklist, generate a strong key client-side, copy the SQL script, and run the health check. Verify `/api/health` returns `database: ready` and `adminConfigured: true`.
6. **GitHub → Settings → Secrets and variables → Actions:** Add variable **`RSCDS_DEPLOY_URL`** (public HTTPS origin of your Vercel app) and secret **`RSCDS_ADMIN_API_KEY`** (same key used in Vercel). Under Actions → **Manual Satellite Analysis**, click **Run workflow** with a *non-sensitive* bbox and before/after date windows.
7. The GitHub runner executes the Python raster worker, then sends generated unverified GeoJSON directly to the authenticated `/api/detections` endpoint. **No sensitive map artifacts are published** in the workflow. Use Candidate detections / Review workspace to review results.

## Safety warning for public GitHub repositories

Your repository currently is public. Workflow dispatch fields and logs may be visible to the public. **Never enter sensitive, protected or humanitarian site locations into a public GitHub Actions run.** Use a private repository / isolated trusted worker for those study areas. Do not publish raw candidate coordinates or treat heuristic scores as probability of settlement.

## Architecture

- **Vercel:** Static HTML/CSS/JS dashboard with serverless API endpoints for STAC scene lookup, authenticated candidate import, audit review and health checks.
- **Aiven PostgreSQL + PostGIS:** Spatial schema (`rscds`) with candidate change polygons, provenance, evidence and duplicate fingerprints.
- **GitHub Actions / Python:** Separate on-demand `rasterio`/NumPy/SciPy analysis jobs; output pushed directly to the Vercel API through protected secrets.
- **Element84 Earth Search:** Public Sentinel-2 STAC discovery, no fabricated satellite imagery.

## Development and docs

The project includes 5 software engineering documents, Chapters 1–3 research proposal, Chapters 1–5 research report draft, and 7 corresponding DOCX deliverables. The **academic results have not been empirically validated**.

If working locally, the optional Python wizard `scripts/setup_ui.py` opens a browser on the loopback interface. **It is not needed for Vercel deployment.**

Testing: GitHub Actions runs `npm test` and Python tests automatically. The UI setup requires no terminal. Read [`docs/software/05_Deployment_and_Operations_Manual.md`](docs/software/05_Deployment_and_Operations_Manual.md) for a full browser-only guide.

Primary links: [Aiven Console](https://console.aiven.io/) • [Vercel new project](https://vercel.com/new) • [GitHub analysis form](https://github.com/Simmyt3r/RSCDS-Project/actions/workflows/satellite-analysis.yml).
