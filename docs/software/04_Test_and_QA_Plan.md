# Software Testing and Quality Assurance Plan
## Remote Settlement Change Detection System (RSCDS)
**Version:** 1.0
**Date:** 9 October 2026

## 1. Quality objectives
The project must demonstrate that software mechanisms operate correctly and separately determine whether remote-sensing predictions correspond to field-observed temporary settlement establishment. These are different standards. Passing unit tests is not evidence of field classification accuracy. All results must be reproducible using versioned scenes, code and AOI metadata.

## 2. Test levels
**Unit tests** cover AOI validation, period parsing, NDVI arithmetic, vegetation removal, no-change response, cloud masks and minimum polygon size. **Integration tests** should cover actual Earth Search search responses, COG reads, PostGIS migration/import/review and authorization failures. **End-to-end tests** should run the dashboard -> scene discovery -> worker -> private import -> manual review workflow. **Acceptance tests** should involve GIS staff reviewing known changed/unchanged sites independent of training labels.

## 3. Current automated test cases
| ID | Test case | Expected result | Current status |
|---|---|---|---|
| UT-01 | Valid coordinate bbox | Accepted | Automated test available |
| UT-02 | Oversized bbox | Rejected | Automated test available |
| UT-03 | Date window reversed | Rejected | Automated test available |
| UT-04 | Preverified import | Rejected | Automated test available |
| UT-05 | NDVI known value | Correct to tolerance | Automated test available |
| UT-06 | Synthetic vegetation removal | At least one unverified polygon | Automated test available |
| UT-07 | Fully cloud-masked images | Zero candidates | Automated test available |
| UT-08 | Two identical images | Zero candidates | Automated test available |
| UT-09 | Four-pixel patch below threshold | Zero candidates | Automated test available |
| IT-01 | External STAC acquisition | Scenes returned or explicit no-result failure | Pending network test |
| IT-02 | Aiven/PostGIS migration | All tables/indexes created | Pending configured DB |
| IT-03 | Protected import and review | Denied if anonymous; reviewed after evidence | Pending deployed DB |

## 4. Scientific evaluation design
A gold-standard dataset should be assembled from independently corroborated study areas across multiple seasons, land-cover types and geographic regions. Label change candidates into new temporary settlement, agricultural clearing, construction, fire/vegetation loss, bare-soil change and no significant change. Use negative examples intentionally, and document how uncertain labels are adjudicated. Do not leak the same geographical site into both training and test sets. Prefer geographically blocked holdout of at least 25% of independently labelled sites and a further external-region test.

## 5. Performance measurements
Compute TP, FP, FN and TN against the same task definition and matching rule. Precision = TP/(TP+FP), recall = TP/(TP+FN), F1 = 2PR/(P+R). For segmentation, report intersection-over-union at an agreed matching threshold. Also report false alerts per 100 km²/month, detection latency, usable-scene proportion, processing time and failures by cloud cover/season. Report 95% confidence intervals where sample sizes allow. Do not report a single aggregate score without subgroup error analysis.

## 6. Test data governance
Synthetic arrays are allowed for correctness tests and must be clearly labelled synthetic. Field-labelled sites require permission, documented sourcing and sensitive-coordinate controls. Record scene IDs and observation windows. Keep operational observations out of public CI artifacts. Do not make high-risk maps public without human review.

## 7. Release gates
Gate A: all unit tests pass. Gate B: API+database integration works in a secure test environment. Gate C: real Sentinel image job successfully produces a provenance-rich GeoJSON. Gate D: at least two independent analysts verify a sample of candidates with agreement statistics. Gate E: accuracy and failure modes satisfy an externally agreed threshold. The current prototype can at most satisfy Gate A locally until external integration is complete.

## 8. Defect handling
Maintain a defect register with severity, reproducible input scene IDs, trace/log ID, responsible developer, fix version and regression test. Prioritize security and privacy leaks ahead of cosmetic issues. Mark false detections as review outcomes rather than removing them, preserving evidence of model limitations.
