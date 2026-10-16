# RSCDS v0.6.0 — Final QA/QC and Release Gate

**Document status:** Engineering release checklist. A successful CI run is not evidence of live scientific accuracy.

## System under test
- Static browser interface with Leaflet/MapLibre, STAC scene discovery, sidebars, photo comparison, evidence workspace and setup panel.
- Serverless Vercel APIs with distinct admin and worker API keys.
- PostgreSQL/PostGIS `rscds` schema and an administrator-controlled, versioned migration runner.
- GitHub Actions worker: leases one job, reads Sentinel-2 Level-2A, screens masks, produces change-candidate geometries, attaches scene metadata and submits candidate batches.
- All candidate outputs are **unverified land-cover changes**, not a verified temporary-settlement classification.

## Release blockers and acceptance criteria

| Area | Required gate | Test or evidence |
|---|---|---|
| CI | JS tests, Python tests and preflight pass on release SHA | GitHub Actions run URL and exact commit |
| App assets | All sidebar anchors work; map error cannot disable search | Manual desktop + mobile browser tests |
| Database identity | Verified intended Aiven host, database, permissions | Operator checks secure Vercel & Aiven consoles; do not screenshot secrets |
| Migration | No-login initial bootstrap; fixed schema versions, consent, closure after completion; no arbitrary SQL | Browser demonstration + `rscds.schema_migrations` status |
| Authentication | Anonymous and wrong-key requests blocked | Protected endpoints return 401 or 503 when unconfigured |
| SQL injection | No submitted SQL or identifiers; static migrations only | `tests/migrations_security.test.js` |
| Migration concurrency | Transaction/advisory lock, checksum mismatch refusal | Test and database-backed contention rehearsal |
| Queue capacity | Two simultaneous submissions cannot exceed five | Test + database-backed stress rehearsal |
| Worker leases | Expired/replayed lease cannot upload results | DB integration test; inspect private status |
| Provenance | Saved scene IDs match worker-selected scenes | Mismatched pair rejection test and completed job evidence |
| Spatial detail | No silent downsampling larger than worker grid | `tests/test_spatial_grid.py` |
| Raster correctness | Actual before/after scene acquisitions; cloud/valid-pixel screening | Real nonsensitive case and georeferenced map |
| Geometry | Projected area, valid polygons, correct SRID | PostGIS `ST_IsValid`, coordinate and area checks |
| Review | Review requires reviewer and notes; no silent overwrite | Authenticated review workflow |
| Export | No stale job data, no incomplete paginated export | Browser tests and private export audit |
| Image provider | Real scene photos or explicit error/quicklook fallback | Live image rendering, no invented screenshots |
| Privacy | Never expose AOI or lease in logs/URLs/artifacts | Workflow-log review, network inspector |
| Accuracy | Independently labelled reference sample; confusion matrix and uncertainty | Research evidence, **NOT YET MEASURED** |

## Admin migration QA procedure
1. Deploy the candidate commit to a nonpublic preview environment backed by an intended, restorable test database.
2. Confirm the no-login initial setup endpoint is limited to the fixed approved versions. Only version status and non-sensitive information may be shown anonymously. All analysis, evidence and review APIs must still require authentication.
3. In **Deploy & configure**, select **Check migrations** without a key. Inspect the approved list, then verify the actual connected database service in the private Vercel settings.
4. Verify the correct database endpoint and service using provider consoles, not just a matching database name.
5. Tick the authorization box and **Apply pending migrations**. Confirm that only `rscds` tables/indexes and the PostGIS extension are created/altered.
6. Refresh. All versions must report `applied`. Repeat with a newly fetched empty pending list; nothing should change.
7. Simulate two administrators applying simultaneously; only one transaction may proceed.
8. Corrupt a checksum **only on a throwaway test database** and confirm the runner refuses to continue.
9. Query `/api/health`; require `database: "ready"` and valid configured independent secrets.
10. Verify the migration audit table `rscds.schema_migrations` in a private database interface.

**Caution:** The runner changes whichever database Vercel currently points at. It cannot prove that the hostname belongs to the intended Aiven service. Never use an unreviewed production target.

## Negative and recovery testing
- Blank/wrong admin token, worker token used as admin, missing origin, spoofed cross-origin POST.
- Invalid migration confirmation, stale pending-version list, checksum mismatch and interrupted transaction.
- Lost internet, STAC response 400/5xx, empty acquisition window, clouded imagery, malformed STAC metadata.
- No WebGL, blocked external vector tiles, unavailable public TiTiler, browser refresh while a scene is loading.
- Zero candidates, 100 candidates, 101 candidates across pages, duplicate batch replay, interrupted upload.
- Feature polygon outside AOI; scene pair mismatch; manual import with invalid self-crossing geometry.
- Cloud mask zero overlap, minimum pixel cluster, unchanged imagery and agricultural seasonal changes.
- Python worker exception, expired lease and retry after partially written batches.

## Observed versus pending results
**Confirmed in earlier checks:** GitHub Actions tests pass on multiple commits; satellite STAC metadata was retrieved for nonsensitive examples; Aiven `defaultdb` contains required provenance columns; newer Vercel builds were ready. The public domain had previously been deliberately rolled back to v0.3.7.

**Must be rechecked for v0.6.0:** correct live database identity, successful admin migration **on the actual Vercel target**, status `ready`, authenticated live worker lease and full non-sensitive raster-processing job, true-colour raster comparison and third-party tile availability, DB-backed concurrency tests, and independent validation metrics.

### Release decision
- **CI / static build passed:** engineering candidate only.
- **Live DB migration + whole-system run passed:** operational pilot.
- **Independent reference-data evaluation passed with reported uncertainty:** scientifically evaluated research prototype.
- Do not describe the system as an accurate or validated temporary-settlement detector without the third gate.
