# RSCDS • Browser-based deployment

**No command line is required for deployment.** Open the six-step guided assistant:

- **Before deployment (Windows):** Download or clone the project, then double-click `START_SETUP_WINDOWS.bat`. It opens `public/setup.html` locally in your default browser.
- **Before deployment (any operating system):** Download [public/setup.html](https://github.com/Simmyt3r/RSCDS-Project/blob/main/public/setup.html) using GitHub's **Raw → Save as**, then double-click the HTML file. The page works offline except provider links, SQL copying, and remote health checks.
- **After deployment:** Open `https://YOUR-VERCEL-APP.vercel.app/setup.html`, or use **Deploy & configure** in the RSCDS dashboard.

The assistant leads you through (1) GitHub import into Vercel, (2) Aiven schema migration, (3) Vercel production environment variables, (4) Vercel deployment, (5) GitHub worker configuration, and (6) readiness testing. It has direct links to the official provider interfaces and a secure, local-only generator for **different** administrator and worker secrets.

## Configuration summary

| Provider | Name | Value | Visibility |
|---|---|---|---|
| Vercel → Production | `DATABASE_URL` | Aiven PostgreSQL TLS connection URI | Sensitive/server-side only |
| Vercel → Production | `ADMIN_API_KEY` | Unique randomly generated admin key | Sensitive/server-side only |
| Vercel → Production | `WORKER_API_KEY` | **Different** randomly generated worker key | Sensitive/server-side only |
| GitHub Actions → Variable | `RSCDS_DEPLOY_URL` | Deployed Vercel HTTPS origin | Repository variable |
| GitHub Actions → Secret | `RSCDS_WORKER_API_KEY` | Exactly the worker key from Vercel | Actions secret |

The Aiven migration is in [`scripts/schema.sql`](scripts/schema.sql) and is idempotent and isolated to schema `rscds`. **Do not drop shared databases.** After creating or changing Vercel production variables, **redeploy** in the Vercel UI so the functions receive them.

## Protect locations and credentials

- No secrets or PostgreSQL URLs should be entered into the setup assistant. Generated keys exist only temporarily in browser input fields. No key values are transmitted or persisted by the page.
- Use the admin-authenticated RSCDS application to submit study area coordinates. Never place vulnerable communities' coordinates in public GitHub inputs, logs or issues.
- A public GitHub-hosted worker is not an appropriate final environment for sensitive or humanitarian coordinates. Use a private repository with trusted runners and complete a protection assessment before operational use.
- The imagery model identifies candidate **change polygons**, not confirmed settlements or population counts.

## Troubleshooting

- **`database: migration required`**: Run the full migration in Aiven PG Studio and ensure the Vercel database connection URI points to the correct database.
- **`database: connection error`**: Recheck Aiven URL, TLS settings and database networking.
- **`adminConfigured` or `workerConfigured` false**: Set the corresponding Vercel Production environment variable and redeploy.
- **Queued job never starts**: Check the GitHub Actions variable `RSCDS_DEPLOY_URL`, worker secret, workflow status and scheduled-run history. Scheduled checks are best-effort, not guaranteed at an exact minute.
- **Setup HTML local health check unavailable**: This is expected due to cross-origin browser protections. Use **Open health diagnostic** and read the public configuration flags; never add credentials to the query string.
