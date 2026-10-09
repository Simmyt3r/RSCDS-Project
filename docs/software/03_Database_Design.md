# Database Design and Data Dictionary
## Remote Settlement Change Detection System (RSCDS)
**Version:** 1.0
**Database:** Aiven PostgreSQL 18 with PostGIS

## 1. Logical design and isolation
The initial relational model has two application-specific tables in schema `rscds`. This isolation avoids collisions with other applications on the same PostgreSQL instance. The design is intentionally minimal. Imagery assets are not stored as BLOBs in a 1 GB free-tier database; the service retains lightweight polygon geometry, scores, provenance and reviews. `CREATE EXTENSION IF NOT EXISTS postgis` supplies spatial functions and geometry types.

## 2. Entity definitions
**Entity A: `rscds.study_areas`.** An AOI is a labelled WGS84 polygon and includes an `is_sensitive` flag. One study area may have several detection runs in the future (proposed relationship; not yet represented as a foreign key in v0.1).

**Entity B: `rscds.detections`.** A candidate polygon captures one observed cluster of changed land cover with source metadata and human review state. Multiple features may derive from one pair of Sentinel scenes. Every record begins with `unverified` status, and review columns are filled only after an explicit review action.

## 3. Data dictionary: study areas
| Column | Type | Constraint | Meaning |
|---|---|---|---|
| id | BIGSERIAL | Primary key | Stable internal identifier |
| name | TEXT | Not null | Human-readable research area label |
| geom | geometry(Polygon,4326) | Not null | WGS84 area polygon |
| is_sensitive | BOOLEAN | Default true | Controls conservative sharing policy |
| created_at | TIMESTAMPTZ | Default now() | Time of registration |

## 4. Data dictionary: detections
| Column | Type | Constraint | Meaning |
|---|---|---|---|
| id | BIGSERIAL | Primary key | Internal candidate ID |
| site_label | VARCHAR(120) | Not null | Neutral label, not settlement confirmation |
| geom | geometry(Geometry,4326) | Not null | Polygon or multipolygon candidate geometry |
| area_m2 | FLOAT8 | Greater than 0 | Approximate area of changed object |
| score | FLOAT8 | 0 to 1 | Uncalibrated candidate ranking score |
| source | TEXT | Not null | Collection/catalog provenance |
| scene_before | TEXT | Nullable | Baseline STAC scene identifier |
| scene_after | TEXT | Nullable | Comparison STAC scene identifier |
| review_status | TEXT | unverified/verified/rejected | Verification state |
| reviewer | VARCHAR(120) | Nullable | Reviewing analyst |
| review_notes | TEXT | Nullable | Evidence and rationale |
| reviewed_at | TIMESTAMPTZ | Nullable | Review timestamp |
| created_at | TIMESTAMPTZ | Default now() | Import timestamp |

## 5. Spatial indexes and SQL examples
`rscds_geom_idx` is a GiST index on candidate geometry. `rscds_study_geom_idx` indexes study areas. `rscds_review_idx` supports private review-queue queries. Use parameterized SQL from the application rather than constructing statements with user input. Geospatial queries should set an explicit projected metric CRS for accurate measurements outside near-equatorial test locations.

## 6. Integrity and migrations
The `scripts/schema.sql` migration is idempotent and creates no global application tables. API imports require valid GeoJSON FeatureCollections with at most 100 features per request; inputs are subject to PostGIS geometry parsing. The application rejects any incoming record that claims `verified` status. A database administrator should apply a least-privilege user to this schema and keep connection strings in environment variables, never GitHub.

## 7. Backup, retention and capacity planning
Confirm Aiven plan backup/retention policy through the service console, because free plans may not provide production-grade recovery. Set a retention period proportionate to research and safeguarding requirements, and avoid saving identifiable or sensitive field evidence in open repositories. The 1 GB tier should be used for metadata and lightweight geometry only, not tiled satellite archives. Larger catalog and annotation data should move to controlled object storage if needed.

## 8. Planned v2 schema
The next normalized iteration should introduce `analysis_runs(id,aoi_id,model_version,parameters,created_at)`, `satellite_scenes(id,provider,acquired_at,cloud_cover,stac_url)`, `labels(id,feature_id,label,analyst,evidence_type,created_at)`, `users(id,role,mfa_state)` and `audit_events(...)`. Introduce foreign keys and immutable decision history before multi-user operational use.


## v0.2 provenance and duplicate protection
The `rscds.detections.feature_hash` column stores a 64-character SHA-256 fingerprint of canonical GeoJSON geometry, source, scene_before and scene_after. A unique index, `rscds_feature_hash_idx`, suppresses repeat inserts. The migration is idempotent, adding the column if an older table exists. `rscds.review_status` remains `unverified` on ingestion. Updating review status applies only to unverified records, requiring independent reviewer notes. The shared Aiven database is not renamed or reset by this script.
