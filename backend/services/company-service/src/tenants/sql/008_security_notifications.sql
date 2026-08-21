-- Chapter 4 Phase 6: default security notification rules (tenant DBs)
INSERT INTO company_local."NotificationRule"
  ("id","companyId","eventType","channel","target","enabled","config")
SELECT
  'nrule_' || sp."companyId" || '_security_login',
  sp."companyId",
  'security.login',
  'email',
  'user',
  true,
  '{}'::jsonb
FROM company_local."SecurityPolicy" sp
ON CONFLICT ("id") DO NOTHING;

INSERT INTO company_local."NotificationRule"
  ("id","companyId","eventType","channel","target","enabled","config")
SELECT
  'nrule_' || sp."companyId" || '_security_password',
  sp."companyId",
  'security.password_changed',
  'email',
  'user',
  true,
  '{}'::jsonb
FROM company_local."SecurityPolicy" sp
ON CONFLICT ("id") DO NOTHING;

INSERT INTO company_local."NotificationRule"
  ("id","companyId","eventType","channel","target","enabled","config")
SELECT
  'nrule_' || sp."companyId" || '_security_role',
  sp."companyId",
  'security.role_changed',
  'email',
  'user',
  true,
  '{}'::jsonb
FROM company_local."SecurityPolicy" sp
ON CONFLICT ("id") DO NOTHING;

INSERT INTO company_local."NotificationRule"
  ("id","companyId","eventType","channel","target","enabled","config")
SELECT
  'nrule_' || sp."companyId" || '_security_mfa',
  sp."companyId",
  'security.mfa_disabled',
  'email',
  'user',
  true,
  '{}'::jsonb
FROM company_local."SecurityPolicy" sp
ON CONFLICT ("id") DO NOTHING;

INSERT INTO company_local."NotificationRule"
  ("id","companyId","eventType","channel","target","enabled","config")
SELECT
  'nrule_' || sp."companyId" || '_security_invite',
  sp."companyId",
  'security.invite_accepted',
  'email',
  'user',
  true,
  '{}'::jsonb
FROM company_local."SecurityPolicy" sp
ON CONFLICT ("id") DO NOTHING;

INSERT INTO company_local."NotificationRule"
  ("id","companyId","eventType","channel","target","enabled","config")
SELECT
  'nrule_' || sp."companyId" || '_security_lockout',
  sp."companyId",
  'security.lockout',
  'email',
  'user',
  true,
  '{}'::jsonb
FROM company_local."SecurityPolicy" sp
ON CONFLICT ("id") DO NOTHING;
