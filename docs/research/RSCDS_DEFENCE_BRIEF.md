# RSCDS Research Defence Brief and Demonstration Script

**Project title:** Satellite Image-Based Identification of Newly Established Temporary Settlements in Remote Areas (RSCDS prototype).

**Precise claim:** RSCDS is a **reproducible Sentinel-2 land-cover change screening and human-review system**. It can present candidate changed areas for further investigation. It has **not** demonstrated reliable classification of temporary settlements. With nominal 10 m pixels, small shelters or individual tents may not be detectable at all.

## A 10–12 minute defence structure

| Segment | Time | Key points / exhibit |
|---|---:|---|
| Problem and motivation | 1 min | Remote landscapes change; unverified reports and repeated site visits are difficult; automated geospatial screening is potentially helpful |
| Research gap | 1 min | Scene discovery alone is not a traceable detection and review workflow; change alone is not settlement identification |
| Objectives and delimitations | 1 min | Identify candidate change, link exact dated scenes, preserve geometry and provenance, support human review; do **not** infer population |
| System architecture | 1 min | Browser → Vercel API → Aiven/PostGIS; GitHub Actions private worker → Earth Search STAC/COGs |
| Scientific method | 2 min | Sentinel-2 L2A surface reflectance; acquisition matching, cloud and SCL screening, common projected grid, NDVI, NDBI, visible brightness, connected-component threshold and GeoJSON |
| Security and data correctness | 1 min | Admin/worker bearer separation, private coordinates, immutable scene provenance, lease/transaction handling and versioned admin migrations |
| Working demonstration | 2 min | Review example AOI, search dates, inspect true-colour images, queue safe test job, open completed evidence and review candidate |
| Validation and limitations | 1.5 min | External ground truth needed, mixed pixels, seasonality, cloud/land clearing/construction confusion, uncertain area in Web Mercator |
| Contribution and next work | 0.5 min | An auditable prototype for geospatial screening, not evidence of actual encampments |

## System workflow
1. User selects a nonsensitive bounding box and baseline/comparison periods.
2. RSCDS discovers actual Sentinel-2 L2A scenes with Element84 Earth Search and metadata including acquisition date and cloud fraction.
3. An authenticated administrator queues an analysis job without exposing coordinates through GitHub workflow inputs.
4. A worker securely leases a job; selects the lowest-cloud suitable scenes with required multispectral bands; reads public COGs.
5. Worker resamples/co-registers scene bands to a common grid, uses SCL pixel masks, and calculates NDVI and NDBI plus visible brightness.
6. It identifies clustered pixels with vegetation decline and brightness or built-up-index increase. Thresholds are heuristics.
7. Candidate polygons are saved in PostGIS, with exact source scene IDs, time stamps, job reference and score; they start **unverified**.
8. A reviewer inspects authentic before/after imagery and records independent evidence, reviewer identity and reasoning before verifying/rejecting a candidate.
9. Restricted GeoJSON and evidence manifests support audit and subsequent GIS examination.

## Equations used
- **NDVI** = (NIR − Red) / (NIR + Red + ε)
- **NDBI** = (SWIR − NIR) / (SWIR + NIR + ε)
- **Brightness** = mean(Red, Green, Blue).
- Candidate example rule as implemented: valid pixel in both dates, vegetation loss at least 0.22, post-image NDVI below 0.5, and either brightness gain at least 0.035 or NDBI gain at least 0.08; minimum connected area defaults to nine pixels.
- The score is a **relative change score** computed from the strength of those changes. **It is not a calibrated probability of settlement.**

Thresholds and formulas should be tied directly to `worker/detector.py`; do not substitute a theoretical model not present in code.

## Demonstration procedure: live and fallback
- Show `/api/health` reporting a connected database, distinct configured secrets and `ready`; do not expose the underlying keys or URI.
- In **Deploy & configure**, show the no-login initial migration status and explain the one-time allowlist, confirmation and automatic closure of public writes. Never show private database connection settings.
- Open Satellite imagery, use the non-sensitive example area, search before and after periods, and inspect genuine STAC scene records.
- Render true-colour images using the external preview service if available. If the third-party tile service is down, show source quicklooks and clearly explain the fallback.
- Open a **real completed** job and display its exact acquisition IDs and candidate register; do not show a fabricated job.
- For a verified review outcome, show independent reference evidence; without that, keep the candidate unverified.
- If a live worker has never completed a real job, demonstrate only the verified components and state that real-processing validation is outstanding.

## Anticipated panel questions
**Q1. Does your system actually identify temporary settlements?** Not conclusively. It flags spectral changes requiring independent confirmation; these may arise from farming, land clearing, flood impacts or construction.

**Q2. Why Sentinel-2?** Open multispectral time series, suitable for repeat landscape monitoring, with 10 m visible/NIR and coarser SWIR bands. Cost, coverage and open access suit a prototype, but spatial resolution limits object identification.

**Q3. Why use NDVI and NDBI?** They offer transparent indicators of vegetation loss and built-up-like spectral changes, not direct identification of human occupancy.

**Q4. Can you detect an individual tent?** Not reliably. An individual shelter may be below one 10 m pixel and confused with mixed land-cover signals.

**Q5. How are clouds handled?** Scene cloud percentage screens acquisitions; the SCL band screens cloud, shadow and invalid pixels where data are usable. Residual contamination remains a concern.

**Q6. How do you distinguish a dry-season farm from a new settlement?** The current algorithm cannot reliably do so on its own. Comparable-season acquisitions and independent higher-resolution checks are necessary; quantify false positives.

**Q7. What does a confidence score mean?** It is a bounded heuristic change-strength score, not a calibrated statistical probability.

**Q8. How was the accuracy evaluated?** Automated code tests verify engineering behavior. A representative, independently labelled reference dataset and a confusion matrix have **not yet been produced**. Do not invent precision or recall.

**Q9. What is novel?** The integration of secured job processing, exact scene provenance, image comparison, geospatial candidate storage and an auditable human review workflow. Individual techniques are established.

**Q10. What happens when external services fail?** STAC failures produce an error; map fallback provides a coordinate grid; photo previews may remain available when public raster tiles fail. No fake imagery is synthesized.

**Q11. How is the database secure?** Private analysis and worker APIs still use distinct bearer keys. Initial database setup deliberately requires no login, but is limited to a one-time allowlist of fixed/checksummed, additive migrations and closes after completion. During setup, anyone can initiate those fixed changes; explain this trade-off rather than claiming it is authenticated. Private geometries still require authorization. Stronger identity and rate limiting remain future controls.

**Q12. Why is a completed GitHub workflow not proof of successful detection?** The workflow may poll an empty queue. Real completion is shown by a completed database job, actual source scenes and candidate result/provenance record.

**Q13. How do you measure area?** Pixel-cluster area is approximated on a projected analysis grid. Web Mercator distorts area; for defensible regional area reporting, switch to a locally appropriate UTM/equal-area CRS and verify against a geodetic reference.

**Q14. Is the system safe for humanitarian deployments?** Not yet. Sensitive locations require a privacy impact review, trusted infrastructure, private imagery rendering, user-specific authorization, retention policy and governance.

## Results slide: what can and cannot appear
- Allowed: number of automated tests actually executed, observed STAC responses, specific successful deployment/version, a genuine screen capture, a real job ID with masked sensitive coordinates, and migration history.
- Prohibited: invented detection accuracy, fabricated satellite photos, fictitious settlements, fake manually reviewed sites, and unsupported claims of lives saved or population detected.

## Recommended citations (verify against your institution's style guide)
1. Olofsson, P., Foody, G. M., Herold, M., Stehman, S. V., Woodcock, C. E., & Wulder, M. A. (2014). Good practices for estimating area and assessing accuracy of land change. *Remote Sensing of Environment, 148*, 42–57. https://doi.org/10.1016/j.rse.2014.02.015
2. Element 84. *Earth Search STAC documentation*. https://github.com/Element84/earth-search
3. European Space Agency. *Copernicus Sentinel-2 mission*. https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-2
4. RSCDS source: `worker/detector.py`, `worker/analyze.py`, and `api/_migrations.js`. Cite the exact release SHA in your own technical appendix.

**Defence standard:** Present the completed engineering prototype as a prototype. An empirical claim of settlement detection requires independently validated case studies, not a polished interface.
