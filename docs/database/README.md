# Database Schema Reference

This directory keeps a checked‑in snapshot of the Postgres schema that the
FastAPI service expects. We no longer rely on incremental migration files; the
`schema.sql` file in this folder is the canonical definition of the database.

## Applying the schema to a fresh database

Set `DATABASE_DSN` to the Postgres instance you want to provision and run:

```bash
export DATABASE_DSN="postgresql://postgres:yourpassword@localhost:5432/vectordb"
psql "$DATABASE_DSN" -f docs/database/schema.sql
```

This creates all required extensions, tables, indexes, and triggers (deals,
documents, ingestion jobs, runs, listings, etc.).

## Updating the schema snapshot

1. Make your DDL changes against the live dev database (e.g. via `psql` or
   SQLAlchemy migrations).
2. Re-generate the snapshot from that database:

   ```bash
   pg_dump \
     --schema-only \
     --no-owner \
     --no-privileges \
     --file docs/database/schema.sql \
     "$DATABASE_DSN"
   ```

   (We use `pg_dump` to guarantee the file matches what Postgres actually
   created.)
3. Commit the updated `schema.sql` along with any code that depends on it.

Keeping this file current makes it trivial to spin up a clean database or to
verify CI pipelines without digging through old migration history.


