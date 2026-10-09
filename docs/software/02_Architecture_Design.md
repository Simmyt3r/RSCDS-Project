# Software Design and Architecture Document
## Remote Settlement Change Detection System (RSCDS)
**Version:** 1.0
**Date:** 9 October 2026

## 1. Architecture rationale
The design separates user interaction, persistent geospatial evidence and computational image processing. A Vercel-hosted web application provides scene discovery and protected review. The Aiven PostgreSQL/PostGIS store holds geometry and review metadata. An independent Python worker accesses Sentinel-2 L2A cloud-optimized GeoTIFFs through Earth Search's STAC catalog and exports GeoJSON. Splitting these responsibilities avoids assuming that a short-lived web function can process gigabyte-scale raster archives.

## 2. Context and boundaries
The browser is untrusted. A serverless API must validate every parameter and authenticate private endpoints. The satellite catalog is a public third-party data source and may return errors, delayed ingestion and unusable cloudy imagery. The Python worker has outbound HTTPS access to source assets. The database is a privileged service; access credentials must remain server-side and under encrypted environment configuration. GIS analysts establish provenance before relying on outputs.

## 3. Component view
- **Presentation tier:** responsive HTML/CSS/JavaScript dashboard, Leaflet interactive map, guided setup and review forms.
- **Discovery API:** `GET /api/scenes` validates AOI/date windows and proxies standardized Sentinel-2 metadata.
- **Private API:** `GET/POST /api/detections` and `POST /api/review` require a bearer API key, parameterize SQL and constrain imports.
- **Database tier:** PostGIS spatial data types, GiST indexes and review status constraints within the isolated `rscds` schema.
- **Processing tier:** `worker/analyze.py` runs STAC discovery, scene selection, resampling, cloud masks and two-date spectral differences.
- **Optional learning tier:** `worker/train_model.py` trains a random forest against independently verified features with study-area-based holdout.
- **CI tier:** test workflow validates the code; a manually triggered satellite-analysis workflow can produce an unverified private artifact.

## 4. Operational data flow
**A. Acquisition:** analyst chooses a bounded AOI and two nonoverlapping time windows. STAC returns scene metadata and links to cloud-optimized pixel assets. **B. Preprocessing:** each band is reprojected onto a common grid; SCL is used to exclude cloud/shadow/invalid pixels. **C. Analysis:** NDVI, NDBI and visible-band brightness changes are computed; thresholded pixels are clustered into candidate objects. **D. Review:** candidate objects are exported as unverified polygons with scene IDs and source details, imported by an authenticated administrator, then accepted or rejected after documented evidence review.

## 5. Core algorithm
For band reflectances NIR and RED, NDVI = (NIR - RED) / (NIR + RED + epsilon). For SWIR and NIR, NDBI = (SWIR - NIR) / (SWIR + NIR + epsilon). Brightness approximates the mean visible reflectance. A candidate requires NDVI drop of at least 0.22, after-date NDVI below 0.50, and either brightness increase of at least 0.035 or NDBI increase of at least 0.08. A connected component needs at least nine pixels by default. These heuristics are tunable research baselines, not empirically calibrated probabilities. The stored `score` is an uncalibrated ranking score, never a validated posterior probability.

## 6. Technology decisions
| Decision | Choice | Justification | Risk |
|---|---|---|---|
| Imagery | Sentinel-2 Collection 1 L2A | Open multispectral history, common indices | 10m bands insufficient for tiny shelters |
| Catalog | Element84 Earth Search STAC | Structured metadata and source-backed COGs | No guaranteed SLA |
| Geo processing | Python, rasterio, NumPy, SciPy | Native raster operations and testability | GDAL installation requirements |
| Web | Vercel serverless/static | Simple cloud deployment | Function/storage limits |
| Spatial database | Aiven PostgreSQL + PostGIS | Geometry validation, indexes and SQL | Requires controlled credentials / service capacity |
| Map | Leaflet + OpenStreetMap | Low complexity | Tile availability / attribution |
| Learning | Optional Random Forest baseline | Fast and interpretable with small labels | Needs representative labels and independent validation |

## 7. Security and responsible data design
Detection coordinates are accessible only through authenticated endpoints. Imported data are explicitly unverified; ordinary public browsing cannot fetch precise feature geometry. Secrets must be injected through environment variables. Shared API-key authentication is acceptable only as a constrained research prototype and must be replaced with user accounts, MFA, roles, activity logs and row-level policy enforcement for real deployments. Humanitarian-sensitive locations should be generalized, suppressed or shared only on a need-to-know basis. Never use change candidates to profile individuals or target communities.

## 8. Failure handling
When Earth Search returns no scene, the worker exits with a specific message and suggests changing the window or cloud threshold. When less than 30% of AOI pixels are valid across both dates, processing stops. Missing Aiven connection yields a health indicator and prevents persistence, rather than silently claiming an import. Oversized AOIs, malformed polygons and attempts to import preverified features are rejected.

## 9. Deployment topology
The root project contains `public/` for static web assets, `api/` for Vercel functions, `worker/` for geospatial processing, `scripts/` for setup/migrations, `tests/`, `.github/workflows/` and `docs/`. Use one Vercel project, one dedicated database within Aiven or isolated schema with permission design, and one GitHub repository for controlled code releases. Do not run Python raster jobs in public-facing web requests.

## 10. Design constraints and next iteration
V0.1 selects the least cloudy single scene per period, so differences in sun angle, seasonality and acquisition geometry may still trigger false positives. Future work should implement multi-scene median composites, locally appropriate projected CRS, robust morphology/object features, scene-overlap checks, time-series persistence, spatial cross-validation, authenticated reviewer accounts, safe export controls and higher-resolution corroboration where legally available.
