# Deployment, Configuration and Operations Manual
## Remote Settlement Change Detection System (RSCDS)
**Version:** 1.0
**Target:** Vercel website, Aiven PostgreSQL/PostGIS, Python worker

## 1. Requirements and environment
Install Node.js 20+ and Python 3.11+. The Python worker requires rasterio/GDAL, SciPy, NumPy, Shapely, PyProj and pystac-client. Aiven PostgreSQL 18 (other PostGIS-supported versions may work) needs an SSL connection and a dedicated app database or well-isolated schema. Vercel will host static files and simple serverless API endpoints. Use separate processing infrastructure for imagery.

## 2. First-run scripted setup
Run `python scripts/setup_ui.py` from the project root to open the local browser setup wizard, or `python scripts/setup.py` for terminal prompts. It prompts for the Aiven URL without echoing passwords, generates or accepts an ADMIN_API_KEY, and writes a gitignored `.env.local`. Windows users may use `powershell -ExecutionPolicy Bypass -File scripts/setup.ps1` after reviewing the script. Do not put the URL or API key into an issue, chat transcript or Git repository.

## 3. Database provisioning
In the Aiven console select the project and preferably create a dedicated DB if service capacity permits. Create a least-privilege application identity. From a trusted environment, set the local DATABASE_URL and run `PGDATABASE="$DATABASE_URL" psql -X -v ON_ERROR_STOP=1 -f scripts/schema.sql`. The migration creates PostGIS and `rscds` schema tables and indexes. Check that a web `/api/health` response reads `database: ready`. A known existing free Aiven service has the correct extension available, but do not assume it is available exclusively for this application.

## 4. Web deployment on Vercel
Keep the code in a Git repository. In a linked Vercel project select the repository root (not `worker/`) and deploy. Or use the Vercel CLI: `npx vercel --prod`. Store `DATABASE_URL` and `ADMIN_API_KEY` in Vercel encrypted project environment variables, with production and preview scopes appropriate to each stage. Redeploy after changing production environment variables, then test `/api/health`. Verify that the website's public route does not reveal candidate polygons.

## 5. Raster worker installation and invocation
Run `python -m pip install -r requirements-worker.txt`. Example invocation: `python worker/analyze.py --bbox 8.20,7.60,8.25,7.65 --before 2025-01-01/2025-03-31 --after 2026-01-01/2026-03-31 --out outputs/change.geojson`. These coordinates are an illustrative search extent, not a known settlement. The worker searches source scenes, reads HTTPS COGs, normalizes bands, masks cloudy pixels, identifies spectral change clusters, and writes unverified GeoJSON. It may legitimately find zero candidates.

## 6. Import and human review
Open Candidate detections, enter the administrator API key, select the worker GeoJSON and click Upload. The server authenticates, checks geometry and provenance, and imports with `unverified` status. Open Review workspace, document reviewer name and at least ten characters of evidence notes, and verify or reject. Verifying a candidate means that independent investigation supports the classification; do not treat threshold scores as probabilities.

## 7. GitHub Actions option
The repository includes `satellite-analysis.yml` with manual `workflow_dispatch` parameters: bbox, before and after windows. Use this only in a private project with appropriate artifact and run-access controls where exact coordinates are sensitive. The output is a seven-day review artifact. It does not automatically publish detections. The standard tests workflow checks Python unit tests and JavaScript validators.

## 8. Health checks, logging and recovery
Use GET `/api/health` to check version and database readiness. Interpret `not configured`, `migration required` and `connection error` separately. Do not include full database URLs, authorization tokens or protected coordinates in logs. For failed imagery jobs, record scene IDs, provider HTTP errors, valid-pixel percentage and deterministic algorithm parameters. Aiven restore procedures depend on plan and must be verified in the service dashboard. Roll back Vercel code deployments through normal Git-based release controls.

## 9. Security and responsible use checklist
- Rotate secrets after any accidental exposure; never keep secrets in client code or Git history.
- Restrict who can execute analysis in sensitive regions and access unredacted output.
- Upgrade single shared admin key to named user accounts, least-privilege roles, MFA and immutable audit history before field use.
- Keep raw imagery/source attributions, cloud masks, uncertainty and human-review evidence.
- Do not identify or track individuals or make vulnerable settlement coordinates public.
- Run scientific validation before presenting the project as a reliable settlement detector.

## 10. Troubleshooting
**No scenes found:** broaden dates, choose another season, or raise cloud threshold within scientifically reasonable bounds. **Scene too cloudy:** choose alternate dates or implement multi-scene compositing. **COG read failed:** check network access and GDAL/rasterio installation. **Database not configured:** add DATABASE_URL server-side and run migration. **HTTP 401:** verify API key without placing it in URLs. **HTTP 503 on authenticated calls:** ADMIN_API_KEY is missing. **Import SQL error:** verify PostGIS extension and schema permissions. **Vercel build error:** inspect Node version, dependencies and root directory. Never remove database access controls as a troubleshooting shortcut.
