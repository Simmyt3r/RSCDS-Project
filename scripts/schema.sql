-- Idempotent, namespaced RSCDS objects; do not alter unrelated applications.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS rscds;
CREATE TABLE IF NOT EXISTS rscds.detections (
 id BIGSERIAL PRIMARY KEY,
 site_label VARCHAR(120) NOT NULL DEFAULT 'Candidate',
 geom geometry(Geometry,4326) NOT NULL,
 area_m2 DOUBLE PRECISION NOT NULL CHECK(area_m2>0),
 score DOUBLE PRECISION NOT NULL CHECK(score BETWEEN 0 AND 1),
 source TEXT NOT NULL,
 feature_hash CHAR(64),
 scene_before TEXT,
 scene_after TEXT,
 review_status TEXT NOT NULL DEFAULT 'unverified' CHECK(review_status IN ('unverified','verified','rejected')),
 reviewer VARCHAR(120),review_notes TEXT,reviewed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE rscds.detections ADD COLUMN IF NOT EXISTS feature_hash CHAR(64);
CREATE INDEX IF NOT EXISTS rscds_geom_idx ON rscds.detections USING GIST(geom);
CREATE INDEX IF NOT EXISTS rscds_review_idx ON rscds.detections(review_status,created_at DESC);
CREATE TABLE IF NOT EXISTS rscds.study_areas (
 id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,geom geometry(Polygon,4326) NOT NULL,
 is_sensitive BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rscds_study_geom_idx ON rscds.study_areas USING GIST(geom);

-- Private analysis queue; coordinates are never passed as GitHub Actions inputs.
CREATE TABLE IF NOT EXISTS rscds.analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bbox JSONB NOT NULL,
  before_window TEXT NOT NULL,
  after_window TEXT NOT NULL,
  cloud_max DOUBLE PRECISION NOT NULL DEFAULT 35,
  min_pixels INTEGER NOT NULL DEFAULT 9,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_token UUID,
  lease_expires TIMESTAMPTZ,
  result_count INTEGER NOT NULL DEFAULT 0,
  scene_before TEXT,
  scene_after TEXT,
  acquired_before TIMESTAMPTZ,
  acquired_after TIMESTAMPTZ,
  valid_fraction DOUBLE PRECISION CHECK(valid_fraction BETWEEN 0 AND 1),
  processor_method TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);
ALTER TABLE rscds.analysis_jobs ADD COLUMN IF NOT EXISTS scene_before TEXT;
ALTER TABLE rscds.analysis_jobs ADD COLUMN IF NOT EXISTS scene_after TEXT;
ALTER TABLE rscds.analysis_jobs ADD COLUMN IF NOT EXISTS acquired_before TIMESTAMPTZ;
ALTER TABLE rscds.analysis_jobs ADD COLUMN IF NOT EXISTS acquired_after TIMESTAMPTZ;
ALTER TABLE rscds.analysis_jobs ADD COLUMN IF NOT EXISTS valid_fraction DOUBLE PRECISION;
ALTER TABLE rscds.analysis_jobs ADD COLUMN IF NOT EXISTS processor_method TEXT;
CREATE INDEX IF NOT EXISTS rscds_job_queue_idx ON rscds.analysis_jobs(status,created_at);
ALTER TABLE rscds.detections ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES rscds.analysis_jobs(id);
CREATE INDEX IF NOT EXISTS rscds_detection_job_idx ON rscds.detections(job_id);
-- A candidate may recur in different independent analyses; preserve those records.
CREATE UNIQUE INDEX IF NOT EXISTS rscds_job_feature_hash_idx
 ON rscds.detections(job_id,feature_hash) WHERE job_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS rscds_manual_feature_hash_idx
 ON rscds.detections(feature_hash) WHERE job_id IS NULL;
-- Replace the old global uniqueness rule without deleting any candidate rows.
DROP INDEX IF EXISTS rscds.rscds_feature_hash_idx;
