# Deployment, Configuration and Operations Manual
## Remote Settlement Change Detection System (RSCDS)
**Version:** 1.1 (browser-only cloud setup)
**Target:** Vercel dashboard, Aiven PG Studio/PostGIS, GitHub Actions analysis runner

## 1. Objective and deployment model

All routine provisioning and deployment occur using the graphical web interfaces of GitHub, Aiven and Vercel. The user does not need Vercel CLI, psql CLI or a local Python installation. Python processing remains automated inside GitHub Actions, because large multispectral image analysis should not run in serverless web requests. A local script wizard remains available for optional offline developer testing, not production setup.

## 2. Step 1: GitHub source verification

Visit https://github.com/Simmyt3r/RSCDS-Project and ensure the repository contains `api/`, `public/`, `scripts/schema.sql`, `worker/`, `vercel.json` and `.github/workflows/`. Verify Actions → Test RSCDS passed. The repository is currently public; do not store secrets, real protected candidate coordinates or high-risk study-area bounds in committed files, issue comments, run parameters, or artifacts.

## 3. Step 2: Aiven schema in PG Studio

In https://console.aiven.io/ select the intended project and PostgreSQL service. Open PG Studio → SQL editor. Open `scripts/schema.sql` from GitHub or click *Copy complete SQL* in the RSCDS deployed Setup page, paste into the editor, and execute selected statements. The script requests PostGIS if absent and creates the namespaced tables and indexes without deleting existing database objects. Confirm PG Studio shows `rscds.detections` and `rscds.study_areas`. Select an isolated database or use a dedicated least-privilege application user where possible. A pre-existing Aiven service may be shared with another application; do not reset or delete it.

## 4. Step 3: Import to Vercel from its interface

Visit https://vercel.com/new, choose Add New → Project, and import `Simmyt3r/RSCDS-Project` from GitHub. Choose Framework Preset: **Other**. Root Directory: `./`. Output Directory: **public** (also declared in `vercel.json`). Build Command: leave blank. The repository's `/api/*.js` files are Vercel Functions. If no GitHub repository is shown, use Vercel's GitHub integration connection flow and grant the necessary repository access.

## 5. Step 4: Server-side environment variables

In Vercel → Project → Settings → Environment Variables enter the variables for the Production target before clicking Deploy:

- **DATABASE_URL:** Aiven PostgreSQL URI using SSL, acquired from Aiven Connection information. This is a secret.
- **ADMIN_API_KEY:** Unique random administrator key, at least 24 characters. The RSCDS setup page can generate a cryptographically random 384-bit hexadecimal key locally in the browser (not transmitted by the generator).

Save variables in encrypted/sensitive fields, never in a public `.env`, GitHub commit, URL query or screenshot. If variables are added after first deployment, return to Deployments and select Redeploy to use the new environment. Avoid giving sensitive values to anyone else.

## 6. Step 5: Verify Vercel deployment

Open the production URL and select **Deploy & configure → Check this website**. Expected results: Website online, Database ready, Admin configured yes. The backend `GET /api/health` is intentionally non-sensitive. Missing database connection, unapplied migrations and unconfigured administrator key produce distinct statuses. Vercel logs must be checked using its Dashboard Logs view, with no secret copying.

## 7. Step 6: Configure GitHub Actions in the UI

In the GitHub repository select Settings → Secrets and variables → Actions. Add a **repository variable** `RSCDS_DEPLOY_URL` containing the exact HTTPS origin, for example `https://your-app.vercel.app` with no path, query or secret. Add a **repository secret** `RSCDS_ADMIN_API_KEY` containing the same key stored under Vercel settings. The GitHub workflow will validate both values, analyze a public/non-sensitive study area and POST at most 100 features per request to the authenticated API. The API's fingerprints make retries deduplicate instead of creating duplicate candidates. The workflow does **not** upload raw candidate geometry as a public Actions artifact.

GitHub documentation: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow . Open Actions → Manual Satellite Analysis → Run workflow. Copy the bounding box and date-window values from the RSCDS Satellite imagery page. For sensitive communities, run in a private repository / trusted processor instead; even inputs to public workflow runs may be exposed.

## 8. Validation and human review

In Candidate detections, use the administrator API key only in a trusted HTTPS browser tab. Upload non-sensitive worker GeoJSON manually if needed or refresh records after the cloud action. Candidate scores describe spectral change only. Accept or reject each unverified candidate using independent evidence, reviewer identity and explanatory notes. Keep evidence provenance and protected coordinates out of public reports. The workflow may legitimately return zero change candidates.

## 9. Rollback, monitoring and costs

Use Vercel → Deployments → Redeploy or promote a prior deployment, after checking schema compatibility. Use Aiven PG Studio to inspect service health and tables. Consult the Aiven service's storage, connection and backup limits; a free-tier database is not necessarily dedicated to RSCDS. GitHub Actions storage and runner minutes may be limited by the GitHub plan. Keep imagery out of Postgres; store geometries and metadata only.

## 10. Security and research constraints

- Protect API key access and rotate it after exposure. This prototype does not yet provide named accounts, MFA, role-based authorization or immutable audit logs.
- Do not make protected study-area coordinates public through GitHub inputs, stdout, Vercel URLs, or downloadable artifacts.
- Verify Sentinel-2 scene dates, cloud fractions and source attribution; reject unsupported certainty claims.
- Independent field verification, labelled datasets, train/evaluation separation and quantitative evaluation are required before calling the system a validated temporary-settlement detector.
- Do not infer population, humanitarian status, political identity or displacement history from satellite imagery alone.

## 11. Troubleshooting

**Website loads but database not ready:** confirm Vercel environment values, HTTPS URL encoding for passwords, Aiven SSL and executed schema. **No Admin configured:** set `ADMIN_API_KEY` under Vercel settings and redeploy. **GitHub analysis reports missing settings:** add the GitHub variable and secret in Settings → Secrets and variables → Actions. **Unexpected duplicate candidate:** confirm PostGIS unique fingerprint index exists. **No scenes or no candidates:** broaden the date window, compare seasons and inspect actual cloud masking. **SQL schema copy fails:** open `scripts/schema.sql` directly in GitHub and copy it into Aiven PG Studio. Do not disable authentication to diagnose a failure.
