# ggads database

The application uses PostgreSQL. SQL migration files in `database/migrations` are
the source of truth and are applied in filename order.

## Local setup

1. Start Docker Desktop.
2. From the repository root, run `docker compose up -d postgres`.
3. Add this value to `backend/.env`:

   `DATABASE_URL=postgresql://ggads:ggads_local_password@localhost:5433/ggads`

4. From `backend`, run `npm run db:migrate`.

The runner records applied files in `schema_migrations` and safely skips them on
later runs. Never edit an applied migration; add a new numbered SQL file instead.

API keys and Google service account JSON must stay outside PostgreSQL. Store only
a secret-manager reference in `google_ads_accounts.credential_ref` in production.
