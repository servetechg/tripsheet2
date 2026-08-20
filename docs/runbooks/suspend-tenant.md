# Runbook: Suspend a tenant

Suspend when a company is delinquent, compromised, or temporarily offline. Prefer soft-suspend (keep DB) over drop.

## Soft suspend (recommended)

1. Super Admin → **Companies** → **Disable** the company (sets `active=false`).
2. Or API:
   ```bash
   curl -X POST "$GATEWAY/api/companies/$COMPANY_ID/toggle-active" \
     -H "Authorization: Bearer $SUPER_TOKEN"
   ```
3. Gateway returns **403** for that tenant’s users while suspended/disabled.
4. Optional: freeze writes during investigation:
   ```bash
   curl -X POST "$COMPANY_URL/tenants/$COMPANY_ID/freeze" \
     -H 'Content-Type: application/json' -d '{"freeze":true}'
   ```

## Hard suspend (registry)

```bash
curl -X POST "$COMPANY_URL/tenants/$COMPANY_ID/deprovision"
# Keeps fq_tenant_* database; marks TenantDatabase status=suspended
```

## Resume

1. Re-enable company (toggle active).
2. Unfreeze if frozen: `POST /tenants/$COMPANY_ID/unfreeze`
3. Confirm Super Admin → **Tenant ops** shows status `active` and connections healthy.

## Do not

- Drop the database unless offboarding (see [offboard-tenant.md](./offboard-tenant.md)).
- Change `routingMode` as a substitute for suspend.
