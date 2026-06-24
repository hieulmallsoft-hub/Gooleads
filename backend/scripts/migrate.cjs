const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { Client } = require('pg');

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

async function migrate() {
  loadLocalEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL. Add it to backend/.env before running migrations.');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();

  try {
    await client.query("SELECT pg_advisory_lock(hashtext('ggads_schema_migrations'))");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT');

    const migrationDir = resolve(__dirname, '..', 'database', 'migrations');
    const files = readdirSync(migrationDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();
    const appliedResult = await client.query('SELECT name, checksum FROM schema_migrations');
    const applied = new Map(appliedResult.rows.map((row) => [row.name, row.checksum]));

    for (const file of files) {
      const sql = readFileSync(resolve(migrationDir, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const appliedChecksum = applied.get(file);

      if (applied.has(file)) {
        if (appliedChecksum && appliedChecksum !== checksum) {
          throw new Error(`Applied migration ${file} has been modified`);
        }

        if (!appliedChecksum) {
          await client.query('UPDATE schema_migrations SET checksum = $2 WHERE name = $1', [
            file,
            checksum,
          ]);
        }
        continue;
      }

      console.log(`Applying ${file}...`);
      await client.query('BEGIN');

      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
          [file, checksum],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log('Database migrations are up to date.');
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('ggads_schema_migrations'))").catch(() => {});
    await client.end();
  }
}

migrate().catch((error) => {
  console.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
