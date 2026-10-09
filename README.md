# Remote Settlement Change Detection System (RSCDS)

**Status: v0.1 candidate-detection prototype, not a validated settlement classifier.** The system discovers real Sentinel-2 imagery, performs raster-based multi-date change analysis in a Python worker, generates reviewable GeoJSON, and offers an Aiven/PostGIS-backed Vercel review dashboard. It never labels detections as proven settlements without review.

## Quick start

1. `npm install`; start web: `npx vercel dev` (installs Vercel CLI if needed).
2. Run `python scripts/setup_ui.py` to configure through a localhost browser wizard, or `python scripts/setup.py` for a terminal wizard. Credentials are written to `.env.local` which is gitignored.
3. On Aiven PostgreSQL (dedicated database preferred), run `PGDATABASE="$DATABASE_URL" psql -X -v ON_ERROR_STOP=1 -f scripts/schema.sql`.
4. Configure DATABASE_URL and ADMIN_API_KEY in Vercel environment settings. `npx vercel --prod` deploys the web UI.
5. Install Python worker: `python -m pip install -r requirements-worker.txt`.
6. Run `python worker/analyze.py --bbox 8.2,7.6,8.25,7.65 --before 2025-01-01/2025-03-31 --after 2026-01-01/2026-03-31 --out outputs/change.geojson` (example bbox, no claim about a settlement). Requires network access to public COGs and sufficiently clear scenes.
7. In the admin UI, enter your admin API key, upload the generated GeoJSON, and review detections.

## Boundaries

- Sentinel-2 is 10m resolution, so small temporary shelters may not be visible. Algorithm detects **candidate change clusters** only; manual review and independent evidence required.
- No pretrained model is represented as validated. Optional labelled-feature ML training is in `worker/train_model.py`.
- Vercel handles the website and small requests; raster processing runs in CI/worker infrastructure.
- Do not publish precise locations of vulnerable displaced people, private facilities or sensitive sites. Results are admin-authenticated, and exports should be reviewed for protection risks.
- Temporal misalignment, seasonality, agricultural clearing, clouds, construction and fire can cause false positives.

## Security

Admin API key is required for detection import/read/review. Use production authentication and role-based access before extending access beyond a small research team. Rotate leaked credentials. Restrict Aiven firewall from open CIDRs where feasible. Never use the demo data as actual detections.

## Primary sources

- ESA Sentinel-2 https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-2
- Earth Search https://element84.com/earth-search/examples/
- Aiven PostGIS https://aiven.io/docs/products/postgresql/reference/list-of-extensions
- Vercel Functions https://vercel.com/docs/functions/limitations
