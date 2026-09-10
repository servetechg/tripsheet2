import { spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const DEFAULT_CONTAINER = 'tripsheet-postgres';
const DEFAULT_USER = 'tripsheet';

export async function waitForPostgres({
  container = process.env.POSTGRES_CONTAINER || DEFAULT_CONTAINER,
  user = process.env.POSTGRES_USER || DEFAULT_USER,
  timeoutMs = 120_000,
  intervalMs = 2_000,
} = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const probe = spawnSync(
      'docker',
      ['exec', container, 'pg_isready', '-U', user],
      { encoding: 'utf8' },
    );
    if (probe.status === 0) {
      console.log(`Postgres ready (${container})`);
      return;
    }
    console.log('Waiting for Postgres…');
    await sleep(intervalMs);
  }
  throw new Error(`Postgres not ready within ${timeoutMs}ms (${container})`);
}
