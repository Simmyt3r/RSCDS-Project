# RSCDS: Secure in-app migrations and operations

## Purpose and scope
An operator can apply **approved initial database migrations without authentication** from the RSCDS deployment itself without opening the Aiven SQL editor. This is not an unrestricted SQL console, remote shell, or tenant-wide database administrator.

## How an administrator uses it
1. Deploy an appropriate candidate release and open **Deploy & configure**.
2. Verify that `DATABASE_URL` in Vercel points to the **intended** Aiven PostgreSQL host and database, ideally a restored test database first. A database name such as `defaultdb` is not sufficient to prove its host identity.
3. Back up the database through the Aiven service before first production migration.
4. Under **Initialize database without login**, use **Check migrations**. No API key is needed.
5. Review the pending versions. Confirm in Vercel that `DATABASE_URL` points to the correct Aiven service.
6. Approve the displayed pending changes with the checkbox and click **Apply pending migrations**.
7. Recheck migration status and `/api/health`. Do not enable real analysis while the health endpoint reports anything but `ready`.
8. Never paste keys or connection URIs into a GitHub issue, class presentation, report, screenshot, or chat.

## Implementation and safeguards
- `GET /api/migrations`: no authentication; returns approved version statuses, without database credentials or hostname.
- `POST /api/migrations`: no authentication; only original allowlisted versions while setup is incomplete. Requires JSON, a same-origin browser request, explicit confirmation and exact pending-ID snapshot. A same-origin header can be spoofed by non-browser clients: this is not authentication.
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
- `403`: initial setup is already complete, origin is incorrect, or the migration is outside the public bootstrap allowlist.
- `403`: browser request came from another origin. Open your deployed RSCDS site.
- `409`: pending snapshot changed, checksum drift or parallel migration. Refresh status; never force through checksum changes.
- `503`: database unavailable, insufficient privilege, missing PostGIS permission or SQL execution error. Inspect private Vercel logs and database permissions; check the configured database target.
- If the intended service is wrong, **correct `DATABASE_URL` and redeploy** before applying; creating an RSCDS schema on the wrong database would hide the configuration problem rather than solve it.
- Rollback is via a verified Aiven database backup/restore, not by `DROP TABLE` or blind down-migration. Take an explicit restore point before any production DDL.

## Privacy and operational caution
- The migration panel has no administrator-key field, and its requests send no credentials. Other application APIs retain their required authentication.
- Migration metadata never includes AOI coordinates or review data.
- During initial setup, **anyone who can reach the deployment can initiate the fixed migrations**. This is an unavoidable trade-off without authentication or network restrictions. All public migration writes close after the three initial versions are recorded.
- Additional production safeguards to implement before sensitive-location use: rate limiting, audit identity per administrator, private imagery proxy, credential rotation and a formal protection impact assessment.

## One-time anonymous bootstrap (v0.6.1)

The only unauthenticated write operations are the hard-coded initial migrations `001_core`, `002_provenance` and `003_uniqueness`. They are additive and idempotent, run in a single locked transaction, and create a checksummed audit table. A later migration will not automatically be allowed without code changes. When all initial versions have been recorded, subsequent anonymous write requests return `403`. No arbitrary SQL is accepted. Before exposing a fresh deployment publicly, verify the database destination using Vercel and Aiven; without authentication, a remote visitor could initiate the fixed initial migrations first.
