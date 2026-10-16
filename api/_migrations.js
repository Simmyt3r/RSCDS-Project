import crypto from 'node:crypto';
/** Immutable server-side allowlist. No submitted SQL, table identifiers, or filenames. */
export const MIGRATIONS=Object.freeze([{"id":"001_core","title":"PostGIS, RSCDS tables and base indexes","sql":["CREATE EXTENSION IF NOT EXISTS postgis","CREATE SCHEMA IF NOT EXISTS rscds","CREATE TABLE IF NOT EXISTS rscds.detections (\n id BIGSERIAL PRIMARY KEY,\n site_label VARCHAR(120) NOT NULL DEFAULT 'Candidate',\n geom geometry(Geometry,4326) NOT NULL,\n area_m2 DOUBLE PRECISION NOT NULL CHECK(area_m2>0),\n score DOUBLE PRECISION NOT NULL CHECK(score BETWEEN 0 AND 1),\n source TEXT NOT NULL,\n feature_hash CHAR(64),\n scene_before TEXT,\n scene_after TEXT,\n review_status TEXT NOT NULL DEFAULT 'unverified' CHECK(review_status IN ('unverified','verified','rejected')),\n reviewer VARCHAR(120),review_notes TEXT,reviewed_at TIMESTAMPTZ,\n created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n)","CREATE INDEX IF NOT EXISTS rscds_geom_idx ON rscds.detections USING GIST(geom)","CREATE INDEX IF NOT EXISTS rscds_review_idx ON rscds.detections(review_status,created_at DESC)","CREATE TABLE IF NOT EXISTS rscds.study_areas (\n id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,geom geometry(Polygon,4326) NOT NULL,\n is_sensitive BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n)","CREATE INDEX IF NOT EXISTS rscds_study_geom_idx ON rscds.study_areas USING GIST(geom)","CREATE TABLE IF NOT EXISTS rscds.analysis_jobs (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  bbox JSONB NOT NULL,\n  before_window TEXT NOT NULL,\n  after_window TEXT NOT NULL,\n  cloud_max DOUBLE PRECISION NOT NULL DEFAULT 35,\n  min_pixels INTEGER NOT NULL DEFAULT 9,\n  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),\n  attempts INTEGER NOT NULL DEFAULT 0,\n  lease_token UUID,\n  lease_expires TIMESTAMPTZ,\n  result_count INTEGER NOT NULL DEFAULT 0,\n  scene_before TEXT,\n  scene_after TEXT,\n  acquired_before TIMESTAMPTZ,\n  acquired_after TIMESTAMPTZ,\n  valid_fraction DOUBLE PRECISION CHECK(valid_fraction BETWEEN 0 AND 1),\n  processor_method TEXT,\n  error_message TEXT,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n  started_at TIMESTAMPTZ,\n  finished_at TIMESTAMPTZ\n)","CREATE INDEX IF NOT EXISTS rscds_job_queue_idx ON rscds.analysis_jobs(status,created_at)"]},{"id":"002_provenance","title":"Processing provenance and job links","sql":["ALTER TABLE rscds.detections ADD COLUMN IF NOT EXISTS feature_hash CHAR(64)","ALTER TABLE rscds.analysis_jobs ADD COLUMN IF NOT EXISTS scene_before TEXT","ALTER TABLE rscds.analysis_jobs ADD COLUMN IF NOT EXISTS scene_after TEXT","ALTER TABLE rscds.analysis_jobs ADD COLUMN IF NOT EXISTS acquired_before TIMESTAMPTZ","ALTER TABLE rscds.analysis_jobs ADD COLUMN IF NOT EXISTS acquired_after TIMESTAMPTZ","ALTER TABLE rscds.analysis_jobs ADD COLUMN IF NOT EXISTS valid_fraction DOUBLE PRECISION","ALTER TABLE rscds.analysis_jobs ADD COLUMN IF NOT EXISTS processor_method TEXT","ALTER TABLE rscds.detections ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES rscds.analysis_jobs(id)","CREATE INDEX IF NOT EXISTS rscds_detection_job_idx ON rscds.detections(job_id)"]},{"id":"003_uniqueness","title":"Run-scoped candidate fingerprint protection","sql":["CREATE UNIQUE INDEX IF NOT EXISTS rscds_job_feature_hash_idx\n ON rscds.detections(job_id,feature_hash) WHERE job_id IS NOT NULL","CREATE UNIQUE INDEX IF NOT EXISTS rscds_manual_feature_hash_idx\n ON rscds.detections(feature_hash) WHERE job_id IS NULL"]}]);
export const checksum=m=>crypto.createHash('sha256').update(m.sql.join(';\n')).digest('hex');
export function stateFor(rows=[]){
 const applied=new Map(rows.map(x=>[x.id,String(x.checksum).trim()]));
 return MIGRATIONS.map(m=>({id:m.id,title:m.title,
  status:!applied.has(m.id)?'pending':applied.get(m.id)===checksum(m)?'applied':'checksum_mismatch'}));
}
export function validateApply(body,expected){
 if(!body||Array.isArray(body)||body.action!=='apply'||body.confirmation!=='APPLY_RSCDS_MIGRATIONS'||
  !Array.isArray(body.expectedPending)||JSON.stringify(body.expectedPending)!==JSON.stringify(expected))
  throw Object.assign(Error('Pending versions changed or confirmation invalid. Refresh and review.'),{status:409});
}
export async function previous(db){
 const [r]=await db`SELECT to_regclass('rscds.schema_migrations') IS NOT NULL AS exists`;
 return r?.exists?db`SELECT id,checksum FROM rscds.schema_migrations ORDER BY id`:[];
}
export async function perform(sql,body){
 return sql.begin(async tx=>{
  const [lock]=await tx`SELECT pg_try_advisory_xact_lock(874301,505) AS locked`;
  if(!lock?.locked)throw Object.assign(Error('Another migration is running. Refresh in a moment.'),{status:409});
  const current=stateFor(await previous(tx));
  if(current.some(m=>m.status==='checksum_mismatch'))
   throw Object.assign(Error('Recorded migration checksum mismatch. Stop and investigate.'),{status:409});
  const pending=current.filter(m=>m.status==='pending').map(m=>m.id);
  validateApply(body,pending);
  // Fixed statements only. DDL, bookkeeping and lock all share one transaction.
  await tx.unsafe("SET LOCAL statement_timeout = '18000ms'");
  await tx.unsafe("SET LOCAL lock_timeout = '2500ms'");
  await tx.unsafe('CREATE SCHEMA IF NOT EXISTS rscds');
  await tx.unsafe('CREATE TABLE IF NOT EXISTS rscds.schema_migrations (id TEXT PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  for(const migration of MIGRATIONS){
   if(!pending.includes(migration.id))continue;
   for(const statement of migration.sql)await tx.unsafe(statement);
   await tx`INSERT INTO rscds.schema_migrations (id,checksum) VALUES (${migration.id},${checksum(migration)})`;
  }
  return pending;
 });
}
