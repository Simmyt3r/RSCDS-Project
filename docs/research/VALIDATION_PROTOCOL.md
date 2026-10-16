# Independent Validation Protocol: RSCDS Land-Cover Change Candidates

## Objective
Assess whether RSCDS identifies land-cover changes consistently and whether any candidate could plausibly correspond to temporary settlement establishment. These are distinct questions requiring distinct reference labels.

## Study design
1. Define a nonsensitive geographic AOI and a baseline/comparison interval. Keep comparable seasons where possible.
2. Acquire a representative sample of changed and unchanged units (stratified random design recommended). Include areas resembling new built surfaces, farm clearing, bare-soil transition, wetland loss and cloudy scenes.
3. Prepare independent reference labels from higher-resolution imagery with appropriate permission or field-verified observations. Record reference acquisition dates, interpretation rules and label uncertainty.
4. Prevent circular validation. Reviewers must not use RSCDS's prediction as the sole evidence for the reference label.
5. Pre-register the heuristic thresholds or keep a separate independent test set to avoid post-hoc accuracy inflation.
6. Measure **candidate change** performance first, then separately test hypothetical **new temporary settlement** interpretation if reliable external labels exist.

## Confusion matrix and metrics
For a binary changed/not-changed reference:
- TP: predicted change with independently confirmed change.
- FP: predicted change without reference change.
- FN: reference change omitted by the model.
- TN: reference stability correctly excluded.
- Precision = TP/(TP+FP), recall = TP/(TP+FN), specificity = TN/(TN+FP), F1 = 2PR/(P+R), when denominators are nonzero.
- Include confusion-matrix totals, accuracy by class, and uncertainty. A credible area estimate should be adjusted for reference-map error and the sample design; raw sum of candidate-polygon square metres is not an unbiased estimate of true area.

## Quality assurance for sources
- Confirm each STAC scene ID, L2A collection, and acquisition date; record processing baseline.
- Record per-scene cloud cover and valid common pixels inside the AOI.
- Verify band alignments, CRS, resampling method, SCL mask and spatial resolution; note SWIR originates at coarser native resolution.
- Inspect image registration and seasonality. Record rainfall, crop cycles, shadows, flood/water, haze and soil reflectance as plausible alternate causes.
- Compare area calculations with an appropriate UTM or equal-area projection before reporting area estimates.
- Avoid interpreting single-pixel changes as occupancy or tents.

## Acceptance criteria (to be set before measuring)
An academic panel may assess whether the prototype successfully loads actual scenes, generates correct candidate geometry, preserves chain-of-evidence identifiers and supports human review. Scientific performance thresholds must be chosen with supervisors/independent validators **before looking at the test results**. Do not retrofit an acceptance threshold after observing a favorable output.

## Reporting template
- Study region, period and reason for selection:
- Reference-data source, spatial resolution, permissions, number of units:
- Sampling/response design:
- STAC scene IDs, cloud masks, valid fraction:
- Predeclared parameters:
- TP / FP / FN / TN:
- Precision / recall / F1 with confidence bounds if estimable:
- False-positive categories and omission cases:
- Observed errors, reproducibility constraints:
- Area estimate and uncertainty (if suitable sampling):
- Human-review/inter-rater agreement:
- Ethical/privacy risk review:
- Limitations and next iteration:

**Status:** All empirical metrics are **pending independent evaluation**. Never fill this template with arbitrary values merely to complete a slide.

Reference: Olofsson et al. (2014), https://doi.org/10.1016/j.rse.2014.02.015
