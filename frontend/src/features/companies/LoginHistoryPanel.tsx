import { useState, useEffect, useMemo, useCallback } from 'react';
import { G, RADIUS } from '@/lib/theme';
import { Btn, Inp, Pill, Modal } from '@/components/ui';
import { authApi } from '@/lib/api';
import { notify } from '@/components/feedback/Toast';

export interface LoginEventItem {
  id: string;
  email: string;
  success: boolean;
  reason: string;
  ip: string;
  userAgent?: string;
  createdAt: string;
  userId?: string;
}

interface ParsedClient {
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'bot' | 'unknown';
}

function parseUserAgent(ua?: string): ParsedClient {
  if (!ua) return { browser: 'Unknown client', os: 'Unknown OS', deviceType: 'unknown' };

  let os = 'Unknown OS';
  if (/windows nt 10/i.test(ua)) os = 'Windows 10/11';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown browser';
  let deviceType: 'desktop' | 'mobile' | 'bot' | 'unknown' =
    /mobile|iphone|ipad|android/i.test(ua) ? 'mobile' : 'desktop';

  if (/edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
  else if (/postman/i.test(ua)) {
    browser = 'Postman';
    deviceType = 'bot';
  } else if (/curl/i.test(ua)) {
    browser = 'cURL';
    deviceType = 'bot';
  }

  return { browser, os, deviceType };
}

function formatIpDisplay(ip?: string): { display: string; isLocal: boolean } {
  if (!ip) return { display: '—', isLocal: false };
  const cleaned = ip.replace(/^::ffff:/, '');
  if (cleaned === '::1' || cleaned === '127.0.0.1') {
    return { display: 'localhost (::1)', isLocal: true };
  }
  return { display: cleaned, isLocal: false };
}

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 30) return 'Just now';
    if (diffSec < 90) return '1 min ago';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatExactDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getAvatarColor(email: string): string {
  const colors = [
    '#3D8CFF',
    '#34D399',
    '#A78BFA',
    '#FBBF24',
    '#38BDF8',
    '#F472B6',
    '#2DD4BF',
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function LoginHistoryPanel({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<LoginEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [selectedEvent, setSelectedEvent] = useState<LoginEventItem | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await authApi.loginHistory({
        scope: 'company',
        limit,
        companyId,
      });
      setRows(data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, limit]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = rows.length;
    const successful = rows.filter((r) => r.success).length;
    const failed = total - successful;
    const uniqueUsers = new Set(rows.map((r) => r.email.toLowerCase())).size;
    return { total, successful, failed, uniqueUsers };
  }, [rows]);

  // Filtered rows
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === 'success' && !r.success) return false;
      if (statusFilter === 'failed' && r.success) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchEmail = r.email?.toLowerCase().includes(q);
        const matchIp = r.ip?.toLowerCase().includes(q);
        const matchReason = r.reason?.toLowerCase().includes(q);
        const matchUA = r.userAgent?.toLowerCase().includes(q);
        if (!matchEmail && !matchIp && !matchReason && !matchUA) return false;
      }
      return true;
    });
  }, [rows, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const copyToClipboard = (text: string, label: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      notify(`Copied ${label} to clipboard`);
    }
  };

  const exportCsv = () => {
    if (!rows.length) return;
    const headers = ['Timestamp', 'Email', 'Status', 'Reason', 'IP Address', 'User Agent'];
    const csvContent = [
      headers.join(','),
      ...rows.map((r) =>
        [
          `"${new Date(r.createdAt).toISOString()}"`,
          `"${(r.email || '').replace(/"/g, '""')}"`,
          `"${r.success ? 'SUCCESS' : 'FAILED'}"`,
          `"${(r.reason || '').replace(/"/g, '""')}"`,
          `"${(r.ip || '').replace(/"/g, '""')}"`,
          `"${(r.userAgent || '').replace(/"/g, '""')}"`,
        ].join(','),
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `login_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('Login history exported as CSV');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI Stats Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <div
          style={{
            background: G.card2,
            border: `1px solid ${G.border}`,
            borderRadius: RADIUS.md,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ color: G.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Total Logins
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: G.text, marginTop: 4 }}>
              {stats.total}
            </div>
          </div>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: RADIUS.md,
              background: 'rgba(61, 140, 255, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: G.gold,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </div>
        </div>

        <div
          style={{
            background: G.card2,
            border: `1px solid ${G.border}`,
            borderRadius: RADIUS.md,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ color: G.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Successful
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: G.success, marginTop: 4 }}>
              {stats.successful}
              <span style={{ fontSize: 12, fontWeight: 500, color: G.muted, marginLeft: 6 }}>
                ({stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0}%)
              </span>
            </div>
          </div>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: RADIUS.md,
              background: 'rgba(52, 211, 153, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: G.success,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
        </div>

        <div
          style={{
            background: G.card2,
            border: `1px solid ${G.border}`,
            borderRadius: RADIUS.md,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ color: G.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Failed / Blocked
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: stats.failed > 0 ? G.danger : G.text, marginTop: 4 }}>
              {stats.failed}
            </div>
          </div>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: RADIUS.md,
              background: stats.failed > 0 ? 'rgba(248, 113, 113, 0.14)' : 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: stats.failed > 0 ? G.danger : G.muted,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
        </div>

        <div
          style={{
            background: G.card2,
            border: `1px solid ${G.border}`,
            borderRadius: RADIUS.md,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ color: G.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Active Accounts
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: G.purple, marginTop: 4 }}>
              {stats.uniqueUsers}
            </div>
          </div>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: RADIUS.md,
              background: 'rgba(167, 139, 250, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: G.purple,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search, Status Filter, Limit, Actions */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 14px',
          background: G.card2,
          borderRadius: RADIUS.md,
          border: `1px solid ${G.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
            <Inp
              placeholder="Search email, IP, or reason..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ width: '100%' }}
            />
          </div>

          {/* Status Filter Buttons */}
          <div
            style={{
              display: 'inline-flex',
              background: G.bg,
              padding: 3,
              borderRadius: RADIUS.md,
              border: `1px solid ${G.border}`,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setPage(1);
              }}
              style={{
                background: statusFilter === 'all' ? G.card2 : 'transparent',
                color: statusFilter === 'all' ? G.text : G.muted,
                border: 'none',
                borderRadius: RADIUS.sm,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              All ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('success');
                setPage(1);
              }}
              style={{
                background: statusFilter === 'success' ? 'rgba(52, 211, 153, 0.15)' : 'transparent',
                color: statusFilter === 'success' ? G.success : G.muted,
                border: 'none',
                borderRadius: RADIUS.sm,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              Success ({stats.successful})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('failed');
                setPage(1);
              }}
              style={{
                background: statusFilter === 'failed' ? 'rgba(248, 113, 113, 0.15)' : 'transparent',
                color: statusFilter === 'failed' ? G.danger : G.muted,
                border: 'none',
                borderRadius: RADIUS.sm,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              Failed ({stats.failed})
            </button>
          </div>
        </div>

        {/* Right side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{
              background: G.bg,
              color: G.text,
              border: `1px solid ${G.border}`,
              borderRadius: RADIUS.md,
              padding: '6px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <option value={25}>Limit: 25</option>
            <option value={50}>Limit: 50</option>
            <option value={100}>Limit: 100</option>
          </select>

          <Btn
            size="sm"
            variant="outline"
            onClick={exportCsv}
            disabled={!rows.length}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </Btn>

          <Btn
            size="sm"
            variant="outline"
            onClick={() => void loadData()}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                animation: loading ? 'spin 1s linear infinite' : 'none',
              }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </Btn>
        </div>
      </div>

      {/* Data Table */}
      <div
        style={{
          border: `1px solid ${G.border}`,
          borderRadius: RADIUS.lg,
          overflow: 'hidden',
          background: G.card,
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: G.card2, borderBottom: `1px solid ${G.border}` }}>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: G.muted, textTransform: 'uppercase', letterSpacing: 0.5, width: 130 }}>
                  Status
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: G.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Account
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: G.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  IP Address
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: G.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Client / Device
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: G.muted, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>
                  Timestamp
                </th>
                <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: G.muted, textTransform: 'uppercase', letterSpacing: 0.5, width: 70 }}>
                  {''}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && !rows.length ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center', color: G.muted }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          border: `2px solid ${G.border}`,
                          borderTopColor: G.gold,
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                      <span style={{ fontSize: 13 }}>Loading login history...</span>
                    </div>
                  </td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center', color: G.muted }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={G.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                      <div style={{ fontSize: 14, fontWeight: 500, color: G.text }}>
                        No login events found
                      </div>
                      <div style={{ fontSize: 12 }}>
                        {search || statusFilter !== 'all'
                          ? 'Try changing your search terms or status filter.'
                          : 'No sign-ins recorded for this company yet.'}
                      </div>
                      {(search || statusFilter !== 'all') && (
                        <Btn
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSearch('');
                            setStatusFilter('all');
                          }}
                          style={{ marginTop: 6 }}
                        >
                          Clear filters
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pagedRows.map((item) => {
                  const ipInfo = formatIpDisplay(item.ip);
                  const client = parseUserAgent(item.userAgent);
                  const initial = (item.email?.[0] || 'U').toUpperCase();
                  const avatarColor = getAvatarColor(item.email || '');

                  return (
                    <tr
                      key={item.id}
                      className="ts-table-row"
                      style={{
                        borderBottom: `1px solid ${G.border}`,
                        transition: 'background .15s',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedEvent(item)}
                    >
                      {/* Status */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        {item.success ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '3px 8px',
                              borderRadius: RADIUS.sm,
                              background: 'rgba(52, 211, 153, 0.12)',
                              color: G.success,
                              fontSize: 11,
                              fontWeight: 600,
                              border: '1px solid rgba(52, 211, 153, 0.25)',
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: G.success,
                                display: 'inline-block',
                              }}
                            />
                            Success
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '3px 8px',
                              borderRadius: RADIUS.sm,
                              background: 'rgba(248, 113, 113, 0.12)',
                              color: G.danger,
                              fontSize: 11,
                              fontWeight: 600,
                              border: '1px solid rgba(248, 113, 113, 0.25)',
                            }}
                            title={item.reason || 'Login failed'}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: G.danger,
                                display: 'inline-block',
                              }}
                            />
                            {item.reason ? item.reason.replace(/_/g, ' ') : 'Failed'}
                          </span>
                        )}
                      </td>

                      {/* User Account */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: `${avatarColor}22`,
                              border: `1px solid ${avatarColor}55`,
                              color: avatarColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {initial}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: 13,
                                color: G.text,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={item.email}
                            >
                              {item.email}
                            </div>
                            {item.userId && (
                              <div style={{ fontSize: 10, color: G.muted, fontFamily: 'monospace' }}>
                                ID: {item.userId.slice(0, 8)}...
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* IP Address */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                              fontSize: 12,
                              color: ipInfo.isLocal ? G.gold : G.muted2,
                              background: G.card2,
                              padding: '2px 6px',
                              borderRadius: 4,
                              border: `1px solid ${G.border}`,
                            }}
                          >
                            {ipInfo.display}
                          </span>
                          {item.ip && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(item.ip, 'IP address');
                              }}
                              title="Copy IP address"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: G.muted,
                                padding: 2,
                                display: 'inline-flex',
                                alignItems: 'center',
                                borderRadius: 3,
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Client / Device */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              color: G.muted,
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            {client.deviceType === 'mobile' ? (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                                <line x1="12" y1="18" x2="12.01" y2="18" />
                              </svg>
                            ) : (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                <line x1="8" y1="21" x2="16" y2="21" />
                                <line x1="12" y1="17" x2="12" y2="21" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: G.text, fontWeight: 500 }}>
                              {client.browser}
                            </div>
                            <div style={{ fontSize: 11, color: G.muted }}>
                              {client.os || 'Unknown OS'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: G.text }}>
                          {formatRelativeTime(item.createdAt)}
                        </div>
                        <div style={{ fontSize: 11, color: G.muted, marginTop: 1 }}>
                          {formatExactDate(item.createdAt)}
                        </div>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <Btn
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(item);
                          }}
                          style={{ padding: '4px 8px', fontSize: 11 }}
                        >
                          Details
                        </Btn>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with Pagination */}
        {filtered.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              borderTop: `1px solid ${G.border}`,
              background: G.card2,
              fontSize: 12,
              color: G.muted,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div>
              Showing{' '}
              <span style={{ fontWeight: 600, color: G.text }}>
                {Math.min((currentPage - 1) * pageSize + 1, filtered.length)}
              </span>{' '}
              to{' '}
              <span style={{ fontWeight: 600, color: G.text }}>
                {Math.min(currentPage * pageSize, filtered.length)}
              </span>{' '}
              of{' '}
              <span style={{ fontWeight: 600, color: G.text }}>
                {filtered.length}
              </span>{' '}
              entries
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  background: 'transparent',
                  border: `1px solid ${G.border}`,
                  borderRadius: RADIUS.sm,
                  padding: '4px 8px',
                  color: currentPage <= 1 ? G.muted : G.text,
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                }}
              >
                Previous
              </button>

              <span style={{ padding: '0 6px', fontWeight: 600, color: G.text }}>
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  background: 'transparent',
                  border: `1px solid ${G.border}`,
                  borderRadius: RADIUS.sm,
                  padding: '4px 8px',
                  color: currentPage >= totalPages ? G.muted : G.text,
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Inspector Modal */}
      {selectedEvent && (
        <Modal
          open
          title="Login Event Details"
          onClose={() => setSelectedEvent(null)}
          maxWidth={580}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Status Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: RADIUS.md,
                background: selectedEvent.success ? 'rgba(52, 211, 153, 0.08)' : 'rgba(248, 113, 113, 0.08)',
                border: `1px solid ${selectedEvent.success ? 'rgba(52, 211, 153, 0.25)' : 'rgba(248, 113, 113, 0.25)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: selectedEvent.success ? G.success : G.danger,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selectedEvent.success ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: selectedEvent.success ? G.success : G.danger }}>
                    {selectedEvent.success ? 'Successful Authentication' : 'Failed Authentication Attempt'}
                  </div>
                  {selectedEvent.reason && (
                    <div style={{ fontSize: 12, color: G.muted }}>
                      Reason: {selectedEvent.reason}
                    </div>
                  )}
                </div>
              </div>

              <Pill color={selectedEvent.success ? G.success : G.danger}>
                {selectedEvent.success ? 'SUCCESS' : 'FAILED'}
              </Pill>
            </div>

            {/* Metadata Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                background: G.card2,
                padding: 14,
                borderRadius: RADIUS.md,
                border: `1px solid ${G.border}`,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: G.muted, fontWeight: 600, textTransform: 'uppercase' }}>
                  Email Address
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: G.text, marginTop: 4 }}>
                  {selectedEvent.email}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: G.muted, fontWeight: 600, textTransform: 'uppercase' }}>
                  IP Address
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: G.text, marginTop: 4, fontFamily: 'monospace' }}>
                  {formatIpDisplay(selectedEvent.ip).display}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: G.muted, fontWeight: 600, textTransform: 'uppercase' }}>
                  Timestamp (Local)
                </div>
                <div style={{ fontSize: 13, color: G.text, marginTop: 4 }}>
                  {formatExactDate(selectedEvent.createdAt)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: G.muted, fontWeight: 600, textTransform: 'uppercase' }}>
                  Client Platform
                </div>
                <div style={{ fontSize: 13, color: G.text, marginTop: 4 }}>
                  {parseUserAgent(selectedEvent.userAgent).browser} ({parseUserAgent(selectedEvent.userAgent).os})
                </div>
              </div>

              {selectedEvent.userId && (
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: 11, color: G.muted, fontWeight: 600, textTransform: 'uppercase' }}>
                    User ID
                  </div>
                  <div style={{ fontSize: 12, color: G.muted2, marginTop: 2, fontFamily: 'monospace' }}>
                    {selectedEvent.userId}
                  </div>
                </div>
              )}

              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ fontSize: 11, color: G.muted, fontWeight: 600, textTransform: 'uppercase' }}>
                  Event ID
                </div>
                <div style={{ fontSize: 12, color: G.muted2, marginTop: 2, fontFamily: 'monospace' }}>
                  {selectedEvent.id}
                </div>
              </div>
            </div>

            {/* Raw User Agent Box */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: G.muted, fontWeight: 600, textTransform: 'uppercase' }}>
                  Raw User Agent String
                </div>
                {selectedEvent.userAgent && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedEvent.userAgent || '', 'User agent')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: G.gold,
                      fontSize: 11,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Copy String
                  </button>
                )}
              </div>
              <div
                style={{
                  background: G.bg,
                  border: `1px solid ${G.border}`,
                  borderRadius: RADIUS.sm,
                  padding: 10,
                  fontSize: 12,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  color: G.muted2,
                  wordBreak: 'break-all',
                  maxHeight: 90,
                  overflowY: 'auto',
                }}
              >
                {selectedEvent.userAgent || 'No user-agent provided by client.'}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
