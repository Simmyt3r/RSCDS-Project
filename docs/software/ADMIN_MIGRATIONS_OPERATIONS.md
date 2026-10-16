# RSCDS: Secure in-app migrations and operations

## Purpose and scope
An administrator can apply **approved database migrations** from the RSCDS deployment itself without opening the Aiven SQL editor. This is not an unrestricted SQL console, remote shell, or tenant-wide database administrator.

## How an administrator uses it
1. Deploy an appropriate candidate release and open **Deploy & configure**.
2. Verify that `DATABASE_URL` in Vercel points to the **intended** Aiven PostgreSQL host and database, ideally a restored test database first. A database name such as `defaultdb` is not sufficient to prove its host identity.
3. Back up the database through the Aiven service before first production migration.
4. Under **Apply database migrations securely**, enter your `ADMIN_API_KEY` (not the worker key).
5. Choose **Check migrations**. Review target database and each version's status: pending, applied, or checksum mismatch.
6. Approve the displayed pending changes with the checkbox and click **Apply pending migrations**.
7. Recheck migration status and `/api/health`. Do not enable real analysis while the health endpoint reports anything but `ready`.
8. Never paste keys or connection URIs into a GitHub issue, class presentation, report, screenshot, or chat.

## Implementation and safeguards
- `GET /api/migrations`: auth required; returns only version titles, statuses and current database name.
- `POST /api/migrations`: auth required, origin checked for browser requests, exact confirmation phrase, exact pending-ID snapshot.
- The server contains an allowlist of static migration statements in `api/_migrations.js`. HTTP clients cannot supply SQL, migration filenames, schema names, table names or network URLs.
- All statements and migration-history inserts run in one PostgreSQL transaction using `pg_try_advisory_xact_lock`. Another concurrent attempt is refused. A thrown SQL error rolls back the transaction.
- `rscds.schema_migrations` records ID, checksum and application time. Changed historical scripts are rejected.
- Migration statements are additive / idempotent, except that enabling **PostGIS** may create a shared extension if not already installed. They do not drop application tables, truncate, delete records, or modify unrelated application schemas.
- Existing legacy installations without a migration history are reconciled by repeating safe `IF NOT EXISTS` statements, then recording migration IDs. That reconciliation must still be tested against a backup.

## Migration versions
- **001_core:** PostGIS extension, RSCDS schema, candidate/study/job tables, base indexes.
- **002_provenance:** analysis scene identifiers, timestamps, valid-pixel percentage and job foreign key.
- **003_uniqueness:** uniqueness per analysis job or independent manual-import set; existing global legacy index is not dropped.

## Failure and recovery
- `401`: wrong or missing admin key. Confirm the admin and worker keys are distinct.
- `403`: browser request came from another origin. Open your deployed RSCDS site.
- `409`: pending snapshot changed, checksum drift or parallel migration. Refresh status; never force through checksum changes.
- `503`: database unavailable, insufficient privilege, missing PostGIS permission or SQL execution error. Inspect private Vercel logs and database permissions; check the configured database target.
- If the intended service is wrong, **correct `DATABASE_URL` and redeploy** before applying; creating an RSCDS schema on the wrong database would hide the configuration problem rather than solve it.
- Rollback is via a verified Aiven database backup/restore, not by `DROP TABLE` or blind down-migration. Take an explicit restore point before any production DDL.

## Privacy and operational caution
- Admin key exists only in the current browser form/request; it is not stored in localStorage, the URL, or the migration table.
- Migration metadata never includes AOI coordinates or review data.
- Deployed source code may be inspected publicly. Security relies on server-side credentials and database permissions, not on concealing JS/HTML.
- Additional production safeguards to implement before sensitive-location use: rate limiting, audit identity per administrator, private imagery proxy, credential rotation and a formal protection impact assessment.
