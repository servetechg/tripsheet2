# Phase 0 — Design lock-in (completed)

**Date:** 2026-08-05  
**Parent:** [MULTI-TENANT-DB-PER-COMPANY.md](./MULTI-TENANT-DB-PER-COMPANY.md)

## Decisions locked

| Item | Decision |
|------|----------|
| Isolation model | **1 PostgreSQL database per company** |
| Microservice layout | **Schemas inside each tenant DB** (not 8×N physical DBs) |
| Naming | `fq_tenant_{slug}` where `slug` = lowercase company short name (e.g. `fq_tenant_mkx`) |
| Control plane | **company-service** + `company_db` (logical name: **platform / fq_platform**) |
| Data plane (later) | Dedicated `fq_tenant_*` DBs provisioned in Phase 2 |
| Secret storage | AES-256-GCM ciphertext in `TenantDatabase.connectionCiphertext`; key = `PLATFORM_SECRETS_KEY` |

## Capacity checklist (ops)

| Concern | Guidance |
|---------|----------|
| Disk | Plan ~1–5 GB baseline per tenant + growth; monitor `pg_database_size` |
| Connections | **PgBouncer required** before many tenants (Phase 3); keep app pools small |
| Backups | Nightly `pg_dump` per `fq_tenant_*` + platform DB (Phase 6) |
| Retention | Suspend → retain per contract → drop DB (document in client MSA) |

## Backup / retention SLA (draft for client)

- RPO: 24 hours (nightly backup)  
- RTO (single tenant restore): target &lt; 4 hours  
- Offboard: export dump within 7 days of request; drop after retention window  

## Exit criteria

- [x] ADR published  
- [x] Naming + platform vs tenant split documented  
- [x] Capacity / backup notes written  
- [x] Implementation proceeds to Phase 1  

**Client sign-off:** treat this repo ADR as engineering lock-in; obtain formal client signature separately if required by contract.
