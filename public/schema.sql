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
CREATE UNIQUE INDEX IF NOT EXISTS rscds_feature_hash_idx ON rscds.detections(feature_hash);
CREATE INDEX IF NOT EXISTS rscds_geom_idx ON rscds.detections USING GIST(geom);
CREATE INDEX IF NOT EXISTS rscds_review_idx ON rscds.detections(review_status,created_at DESC);
CREATE TABLE IF NOT EXISTS rscds.study_areas (
 id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,geom geometry(Polygon,4326) NOT NULL,
 is_sensitive BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rscds_study_geom_idx ON rscds.study_areas USING GIST(geom);
