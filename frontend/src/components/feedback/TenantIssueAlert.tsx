import { useState, type CSSProperties } from 'react';
import { G } from '@/lib/theme';

export type TenantIssue = {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  actionable?: boolean;
  technicalDetail?: string;
};

function colorsFor(severity: TenantIssue['severity']) {
  if (severity === 'error') {
    return { bg: G.dangerBg, border: `${G.danger}33`, text: G.danger };
  }
  if (severity === 'warning') {
    return { bg: G.goldBg || '#2a2410', border: `${G.gold}44`, text: G.gold };
  }
  return { bg: G.card2, border: G.border, text: G.muted };
}

export function TenantIssueAlert({
  issue,
  style,
}: {
  issue: TenantIssue;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const c = colorsFor(issue.severity);

  return (
    <div
      style={{
        marginTop: 12,
        padding: '10px 12px',
        borderRadius: 8,
        background: c.bg,
        border: `1px solid ${c.border}`,
        fontSize: 12,
        color: c.text,
        lineHeight: 1.45,
        ...style,
      }}
    >
      <div>{issue.message}</div>
      {issue.technicalDetail ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            marginTop: 8,
            padding: 0,
            border: 'none',
            background: 'none',
            color: G.muted,
            fontSize: 11,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {open ? 'Hide technical details' : 'View technical details'}
        </button>
      ) : null}
      {open && issue.technicalDetail ? (
        <pre
          style={{
            marginTop: 8,
            marginBottom: 0,
            padding: 8,
            borderRadius: 6,
            background: G.bg,
            border: `1px solid ${G.border}`,
            color: G.muted,
            fontSize: 10,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {issue.code}
          {'\n'}
          {issue.technicalDetail}
        </pre>
      ) : null}
    </div>
  );
}

export function tenantNeedsAttention(tenantDatabase?: {
  status?: string;
  issue?: TenantIssue | null;
} | null) {
  if (!tenantDatabase) return false;
  if (tenantDatabase.status === 'failed') return true;
  const issue = tenantDatabase.issue;
  return Boolean(issue?.actionable && issue.severity === 'error');
}
