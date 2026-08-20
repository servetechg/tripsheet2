# Runbook: Restore a tenant database

Restore only the target company’s `fq_tenant_*` database. Shared `auth_db` / other tenants are untouched.

## Prerequisites

- Nightly backups under `/opt/tripsheet/backups/<stamp>/tenants/fq_tenant_*.sql.gz`
- Cron: `15 2 * * * /opt/tripsheet/repo/deploy/scripts/backup.sh`
- Confirm stamp in `MANIFEST.txt`

## Production restore

1. **Identify dump**
   ```bash
   ls -lt /opt/tripsheet/backups/*/tenants/fq_tenant_SLUG.sql.gz | head
   ```
2. **Suspend traffic** for that company (see [suspend-tenant.md](./suspend-tenant.md)).
3. **Restore** (destructive to that DB only):
   ```bash
   cd /opt/tripsheet/repo
   ./deploy/scripts/restore-tenant.sh fq_tenant_SLUG \
     /opt/tripsheet/backups/STAMP/tenants/fq_tenant_SLUG.sql.gz --force
   ```
4. **Verify**
   ```bash
   docker compose -f deploy/compose.infra.yml --env-file /opt/tripsheet/secrets/infra.env \
     exec -T postgres psql -U tripsheet -d fq_tenant_SLUG \
     -c 'SELECT nspname FROM pg_namespace WHERE nspname IN ('"'"'driver'"'"','"'"'fleet'"'"','"'"'company_local'"'"');'
   ```
5. Confirm registry row in `company_db` still points at `fq_tenant_SLUG`.
6. Re-enable company; smoke-test login + drivers list.
7. Log lifecycle in ops calendar / ticket.

## Quarterly restore drill

```bash
./deploy/scripts/restore-drill.sh
# or pick a tenant:
./deploy/scripts/restore-drill.sh fq_tenant_mkx
```

Restores into `fq_tenant_*_drill_YYYYMMDD`, checks schemas, then drops the drill DB. Schedule every ~90 days.

## Isolation acceptance

Restoring A must leave B unchanged — re-check Tenant ops disk sizes / row counts for a second tenant after restore.
