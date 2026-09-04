export type TenantErrorSeverity = 'error' | 'warning' | 'info';

export type TenantIssue = {
  code: string;
  message: string;
  severity: TenantErrorSeverity;
  actionable: boolean;
  /** Shown only when super admin expands technical details */
  technicalDetail?: string;
};

type TenantErrorClassification = {
  code: string;
  userMessage: string;
  severity: TenantErrorSeverity;
  actionable: boolean;
  showInUI: boolean;
  internalDetail: string;
};

const CLEAR_ERROR = {
  lastError: '',
  lastErrorCode: '',
  lastErrorMessage: '',
  lastErrorSeverity: '',
} as const;

export function clearTenantErrorFields() {
  return { ...CLEAR_ERROR };
}

export function classifyTenantError(raw: string): TenantErrorClassification {
  const internalDetail = raw.trim();
  if (!internalDetail) {
    return {
      code: '',
      userMessage: '',
      severity: 'info',
      actionable: false,
      showInUI: false,
      internalDetail: '',
    };
  }

  if (/no sibling prisma projects found/i.test(internalDetail)) {
    return {
      code: 'TENANT_SCHEMA_SYNC_SKIPPED',
      userMessage:
        'Optional schema sync is not available in this deployment environment.',
      severity: 'warning',
      actionable: false,
      showInUI: false,
      internalDetail,
    };
  }

  if (/prisma cli not found/i.test(internalDetail)) {
    return {
      code: 'TENANT_SCHEMA_SYNC_SKIPPED',
      userMessage:
        'Optional schema sync is not available in this deployment environment.',
      severity: 'warning',
      actionable: false,
      showInUI: false,
      internalDetail,
    };
  }

  if (/provision failed|schema bootstrap failed/i.test(internalDetail)) {
    return {
      code: 'TENANT_PROVISION_FAILED',
      userMessage:
        'Company database setup failed. Try creating the company again or contact support.',
      severity: 'error',
      actionable: true,
      showInUI: true,
      internalDetail,
    };
  }

  if (/not active/i.test(internalDetail)) {
    return {
      code: 'TENANT_NOT_ACTIVE',
      userMessage: 'This company database is not active yet.',
      severity: 'warning',
      actionable: true,
      showInUI: true,
      internalDetail,
    };
  }

  return {
    code: 'TENANT_OPERATION_FAILED',
    userMessage:
      'A background operation failed. Retry from Tenant ops or contact support if it persists.',
    severity: 'error',
    actionable: true,
    showInUI: true,
    internalDetail,
  };
}

export function tenantErrorWriteFields(raw: string | Error) {
  const internalDetail = raw instanceof Error ? raw.message : raw;
  const c = classifyTenantError(internalDetail);
  if (!c.internalDetail) {
    return clearTenantErrorFields();
  }
  return {
    lastError: c.internalDetail.slice(0, 2000),
    lastErrorCode: c.code,
    lastErrorMessage: c.userMessage.slice(0, 500),
    lastErrorSeverity: c.severity,
  };
}

type TenantErrorRow = {
  status?: string;
  lastError?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  lastErrorSeverity?: string | null;
};

function classificationFromRow(row: TenantErrorRow): TenantErrorClassification | null {
  const code = (row.lastErrorCode || '').trim();
  const message = (row.lastErrorMessage || '').trim();
  const severity = (row.lastErrorSeverity || '').trim() as TenantErrorSeverity;
  const legacy = (row.lastError || '').trim();

  if (code && message && severity) {
    const fromCode = classifyTenantError(legacy || message);
    return {
      code,
      userMessage: message,
      severity: severity === 'warning' || severity === 'info' ? severity : 'error',
      actionable: severity === 'error',
      showInUI:
        severity === 'error' ||
        (severity === 'warning' && code !== 'TENANT_SCHEMA_SYNC_SKIPPED'),
      internalDetail: legacy || message,
    };
  }

  if (legacy) {
    return classifyTenantError(legacy);
  }

  return null;
}

/** User-facing issue for admin UI — never exposes raw internal strings by default. */
export function buildTenantIssue(
  row: TenantErrorRow,
  opts?: { includeTechnicalDetail?: boolean },
): TenantIssue | null {
  const c = classificationFromRow(row);
  if (!c || !c.showInUI) {
    return null;
  }

  if (row.status === 'active' && !c.actionable && c.severity !== 'error') {
    return null;
  }

  const issue: TenantIssue = {
    code: c.code,
    message: c.userMessage,
    severity: c.severity,
    actionable: c.actionable,
  };

  if (opts?.includeTechnicalDetail && c.internalDetail) {
    issue.technicalDetail = c.internalDetail.slice(0, 2000);
  }

  return issue;
}

export function tenantHasActionableIssue(row: TenantErrorRow): boolean {
  if (row.status === 'failed') return true;
  const issue = buildTenantIssue(row);
  return Boolean(issue?.actionable && issue.severity === 'error');
}

export function stripInternalTenantFields<
  T extends TenantErrorRow & Record<string, unknown>,
>(row: T, opts?: { includeTechnicalDetail?: boolean }) {
  const issue = buildTenantIssue(row, opts);
  const {
    lastError: _lastError,
    lastErrorCode: _code,
    lastErrorMessage: _msg,
    lastErrorSeverity: _sev,
    ...safe
  } = row;
  return {
    ...safe,
    issue,
  };
}
