import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import type { InAppNotification } from '@tripsheet/shared';
import { G, RADIUS } from '@/lib/theme';
import { Icons } from '@/components/ui/Icons';
import { useInAppNotifications } from '@/components/notifications/InAppNotificationProvider';
import './NotificationInboxBell.css';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

function formatUnreadBadge(count: number): string {
  if (count > 9) return '9+';
  return String(count);
}

function IconCheckDouble() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 12.5l2.5 2.5L17 7"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 12.5l2.5 2.5L13 7"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.55}
      />
    </svg>
  );
}

function IconMessage({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
    </svg>
  );
}

function IconDocument({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
    </svg>
  );
}

function notificationIcon(type: string): ReactNode {
  if (type.includes('message')) {
    return <IconMessage />;
  }
  if (
    type.includes('email') ||
    type.includes('invoice') ||
    type.includes('payment')
  ) {
    return <IconDocument />;
  }
  return Icons.bell({ size: 22 });
}

function displaySubtitle(n: InAppNotification): string | null {
  const body = n.body?.trim();
  if (!body) return null;
  if (body === n.title.trim()) return null;
  return body;
}

export function NotificationInboxBell() {
  const navigate = useNavigate();
  const { items, unreadCount, loading, markRead, markAllRead } =
    useInAppNotifications();
  const hasUnread =
    unreadCount > 0 || items.some((n) => !n.readAt);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="ts-icon-btn ts-notif-bell-btn"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 38,
          height: 38,
          borderRadius: RADIUS.md,
          border: `1px solid ${G.border}`,
          background: G.card2,
          color: G.muted2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span className="ts-notif-bell-btn__icon" aria-hidden>
          {Icons.bell({ size: 18 })}
        </span>
        {unreadCount > 0 && (
          <span
            className={`ts-notif-bell-badge${
              unreadCount > 9 ? ' ts-notif-bell-badge--compact' : ''
            }`}
            style={{
              borderColor: G.card2,
              background: G.danger,
            }}
          >
            {formatUnreadBadge(unreadCount)}
          </span>
        )}
      </button>

      {open && (
        <div className="ts-notif-panel" role="dialog" aria-label="Notifications">
          <div className="ts-notif-panel__head">
            <h2 className="ts-notif-panel__title">Notifications</h2>
            <button
              type="button"
              className="ts-notif-panel__mark-all"
              disabled={!hasUnread || loading}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void markAllRead();
              }}
            >
              <IconCheckDouble />
              Mark all as read
            </button>
          </div>

          <div className="ts-notif-panel__body">
            {loading && items.length === 0 ? (
              <div className="ts-notif-panel__empty">Loading…</div>
            ) : null}

            {!loading && items.length === 0 ? (
              <div className="ts-notif-panel__empty">No notifications yet.</div>
            ) : null}

            {items.length > 0 ? (
              <ul className="ts-notif-panel__list">
                {items.map((n) => {
                  const isRead = Boolean(n.readAt);
                  const subtitle = displaySubtitle(n);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={`ts-notif-item${isRead ? ' ts-notif-item--read' : ''}`}
                        onClick={() => {
                          setOpen(false);
                          if (!isRead) void markRead(n.id);
                          if (n.link) navigate(n.link);
                        }}
                      >
                        <div className="ts-notif-item__icon-wrap">
                          {!isRead && (
                            <span
                              className="ts-notif-item__unread-dot"
                              aria-hidden
                            />
                          )}
                          <div className="ts-notif-item__icon">
                            {notificationIcon(n.type)}
                          </div>
                        </div>
                        <div className="ts-notif-item__content">
                          <div className="ts-notif-item__title">{n.title}</div>
                          {subtitle ? (
                            <div className="ts-notif-item__subtitle">
                              {subtitle}
                            </div>
                          ) : null}
                          <div className="ts-notif-item__time">
                            {formatWhen(n.createdAt)}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
