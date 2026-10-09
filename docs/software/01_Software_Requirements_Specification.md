# Software Requirements Specification
## Remote Settlement Change Detection System (RSCDS)
**Version:** 1.0 (Research prototype)
**Date:** 9 October 2026
**Status:** Baseline specification; field validation pending

## 1. Introduction
The RSCDS identifies candidate areas of significant land-cover change using open multispectral satellite imagery and offers protected human review. Its motivating research problem is the difficulty of recognizing newly established temporary settlements in inaccessible terrain without regular physical surveys. This requirement document defines a verifiable, narrow initial deliverable: candidate change detection, evidence provenance, and structured review. It does not promise automated identification of people, households, displacement events, or tents that are below sensor resolution.

## 2. Stakeholders and user classes
**Researcher:** defines study area/date windows and interprets results. **GIS analyst:** checks source geometry, scene alignment, clouds, thresholds and polygons. **Review officer:** records independent evidence before verifying/rejecting a candidate. **System administrator:** configures connections and protects secrets. **Project supervisor:** evaluates reproducibility and research quality. No anonymous user may access sensitive candidate coordinates.

## 3. Functional requirements
- **FR-01** Create or edit an area of interest as an explicit WGS84 bounding box. Validate bounds and constrain workload.
- **FR-02** Search the open Earth Search STAC endpoint for Sentinel-2 Collection 1 L2A scenes across defined before/after windows.
- **FR-03** Present acquisition date, scene identifier, provider and scene-level cloud metadata. Never present STAC discovery as a detection.
- **FR-04** Run image processing in a separate Python worker, never in a time-limited website request.
- **FR-05** Read aligned red, green, blue, NIR, SWIR and SCL pixels; apply per-pixel cloud/no-data masks and compare dates.
- **FR-06** Generate candidate polygons from thresholded vegetation loss combined with brightness or built-up index change, with area and heuristic score.
- **FR-07** Export a GeoJSON FeatureCollection with source collection, before/after scene IDs, method and unverified state.
- **FR-08** Reject malformed and oversized GeoJSON, authenticate imports and store geometry/provenance in Aiven PostgreSQL/PostGIS.
- **FR-09** List candidate detections privately with review status, date, area and score.
- **FR-10** Require reviewer identity and evidence notes to verify or reject a candidate; maintain review time.
- **FR-11** Display setup health, migration state and required environment variables without exposing secrets.
- **FR-12** Document reproducible worker execution and optional grouped supervised training for an independently collected dataset.
- **FR-13** Export research methods and limitations in reproducible documentation.

## 4. Nonfunctional requirements
- **NFR-01 Reproducibility:** scene IDs, dates, algorithm version and source catalog must be recorded for each run.
- **NFR-02 Security:** admin API key must remain out of public source, URL query strings, logs and exports. Vercel production environment variables are required.
- **NFR-03 Privacy:** exact candidate coordinates must be access-controlled, and no public map should locate vulnerable individuals or communities.
- **NFR-04 Reliability:** empty catalog results, cloud-dominated scenes and storage errors must produce clear failure states.
- **NFR-05 Performance:** the worker must cap AOI size and raster pixel dimensions; interactive metadata search should time out predictably.
- **NFR-06 Usability:** the web application must be responsive on mobile, laptop and desktop browsers, with consistent status labels.
- **NFR-07 Portability:** Python 3.11+ and Node.js 20+; database schema is standard SQL plus PostGIS.
- **NFR-08 Accuracy governance:** no supervised performance claim is permitted before spatially held-out evaluation and independent ground truth.

## 5. External interfaces
Browser UI communicates with GET /api/health, GET /api/scenes, GET/POST /api/detections and POST /api/review. The imagery service is Earth Search STAC. The database interface is an SSL PostgreSQL connection to Aiven. The worker writes GeoJSON (RFC 7946 coordinate order: longitude, latitude). The workflow runner may be GitHub Actions with manually provided nonsecret AOI parameters; production deployment should protect sensitive run artifacts.

## 6. Data requirements
**Detection:** id, site_label, geometry, area_m2, score, source, before_scene, after_scene, review_status, reviewer, review_notes, reviewed_at, created_at. **Study area:** id, name, polygon geometry, sensitivity and creation date. A future release will add imagery scene catalog, run identifiers, versioned models, annotation datasets, role-based access and immutable audit events. No person-level characteristics are collected.

## 7. Acceptance criteria and traceability
| Requirement | Verification | Acceptance condition |
|---|---|---|
| FR-01 | Unit test / UI | Valid AOI accepted; oversized or reversed coordinates rejected |
| FR-02/03 | Live STAC integration | A real response displays source and image dates; empty results explained |
| FR-05/06 | Synthetic raster tests | Clear synthetic vegetation removal yields unverified candidate; unchanged imagery yields none |
| FR-07/08 | Integration test | Well-formed GeoJSON imports into isolated PostGIS schema |
| FR-09/10 | Authorization and workflow tests | Unauthenticated requests denied; reviewer evidence required |
| NFR-08 | Independent evaluation | Report precision, recall, F1, intersection-over-union and spatially held-out results before claiming settlement identification |

## 8. Scope exclusions and release conditions
The MVP excludes individual tent recognition, identifying occupants, high-frequency real-time surveillance, autonomous public alerts and claims of operational humanitarian accuracy. Any subsequent production rollout requires data-protection review, permission controls beyond a shared API key, a field-ground-truth protocol, and measured false-positive/false-negative costs.

## 9. Baseline sign-off
This document is an engineering baseline rather than a claim that all requirements have passed acceptance testing. Sign-off fields: Product owner __________; supervisor __________; date __________.
