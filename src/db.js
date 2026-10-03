import pg from 'pg';
import { readFile } from 'node:fs/promises';

export function createPool(connectionString) {
  if (!connectionString) throw new Error('Configure DATABASE_URL com a conexão PostgreSQL do Neon.');
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL deve ser uma conexão PostgreSQL.');
  // Neon usa TLS. A validação do certificado permanece ativa, inclusive com sslmode=require.
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if (!local) {
    for (const key of ['sslmode','ssl','sslcert','sslkey','sslrootcert']) url.searchParams.delete(key);
  }
  return new pg.Pool({ connectionString: url.toString(), ...(local ? {} : {ssl: {rejectUnauthorized: true}}), max: 5, connectionTimeoutMillis: 15000, idleTimeoutMillis: 30000, statement_timeout: 15000 });
}
export async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock transacional funciona também com o pooler do Neon.
    await client.query('SELECT pg_advisory_xact_lock(74281013)');
    await client.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
