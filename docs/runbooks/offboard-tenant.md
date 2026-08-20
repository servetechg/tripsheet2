# Runbook: Offboard a tenant

Use when a company cancels permanently and data retention has expired (or legal hold is cleared).

## Checklist

1. **Export / handoff** (if required by contract) — dump tenant DB before drop:
   ```bash
   ./deploy/scripts/backup.sh
   # copy /opt/tripsheet/backups/<stamp>/tenants/fq_tenant_SLUG.sql.gz to secure archive
   ```
2. **Disable company** and revoke company-admin sessions (toggle inactive).
3. **Deprovision with drop** (irreversible):
   ```bash
   curl -X POST "$COMPANY_URL/tenants/$COMPANY_ID/deprovision?dropDatabase=true"
   ```
4. Confirm `fq_tenant_SLUG` is gone:
   ```bash
   docker compose -f deploy/compose.infra.yml --env-file /opt/tripsheet/secrets/infra.env \
     exec -T postgres psql -U tripsheet -d postgres \
     -tAc "SELECT 1 FROM pg_database WHERE datname='fq_tenant_SLUG'"
   ```
5. **Auth users** remain in shared `auth_db` by design — deactivate or delete company users via Super Admin / auth API.
6. **Subscription** — set company status / plan ended in platform control plane.
7. Keep lifecycle events in `TenantLifecycleEvent` for audit; do not purge unless policy requires.

## Retention note

Default backup retention is 14 days (`BACKUP_RETENTION_DAYS`). Extend before offboard if legal hold applies.
