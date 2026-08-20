import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { G, RADIUS } from '@/lib/theme';
import type { ThemeMode } from '@/lib/theme';
import { Icons } from '@/components/ui/Icons';
import { authApi, setToken, ApiError } from '@/lib/api';
import { useSession } from '@/context/SessionContext';

type UserMenuProps = {
  name?: string;
  email?: string;
  companyLabel?: string;
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
  onLogout?: () => void;
};

function initialsFrom(name?: string, fallback = 'A') {
  const src = (name || fallback).trim();
  return src
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function UserMenu({
  name,
  email,
  companyLabel,
  themeMode,
  onToggleTheme,
  onLogout,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const { logout } = useSession();
  const rootRef = useRef<HTMLDivElement>(null);
  const displayName = name || companyLabel || 'Admin';
  const initials = initialsFrom(name, companyLabel || 'A');
  const isLight = themeMode === 'light';

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

  const itemStyle: CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '11px 12px',
    border: 'none',
    background: 'transparent',
    color: G.text,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: RADIUS.md,
    textAlign: 'left',
    fontFamily: 'inherit',
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: G.card,
          border: `1px solid ${G.border}`,
          borderRadius: 14,
          padding: '5px 10px 5px 5px',
          cursor: 'pointer',
          boxShadow: G.shadow,
          fontFamily: 'inherit',
          transition: 'border-color .15s ease, box-shadow .15s ease',
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            background: `linear-gradient(145deg, ${G.gold}, ${G.goldDim})`,
            color: G.onGold,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div
          style={{
            minWidth: 0,
            textAlign: 'left',
            display: 'none',
          }}
          className="ts-user-menu-meta"
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: G.text,
              whiteSpace: 'nowrap',
              maxWidth: 140,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {displayName}
          </div>
          {(email || companyLabel) && (
            <div
              style={{
                fontSize: 11,
                color: G.muted,
                whiteSpace: 'nowrap',
                maxWidth: 140,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {email || companyLabel}
            </div>
          )}
        </div>
        <span
          style={{
            color: G.muted,
            fontSize: 10,
            marginLeft: 2,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s ease',
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 220,
            background: G.card,
            border: `1px solid ${G.border}`,
            borderRadius: RADIUS.xl,
            boxShadow: G.shadowHover,
            padding: 8,
            zIndex: 400,
            animation: 'ts-fade-in .18s ease',
          }}
        >
          <div
            style={{
              padding: '8px 10px 10px',
              borderBottom: `1px solid ${G.border}`,
              marginBottom: 6,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: G.text }}>
              {displayName}
            </div>
            {email && (
              <div
                style={{
                  fontSize: 11,
                  color: G.muted,
                  marginTop: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {email}
              </div>
            )}
          </div>

          <button
            type="button"
            role="menuitem"
            style={itemStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = G.card2;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            onClick={() => {
              setOpen(false);
              setPwErr('');
              setCurrentPassword('');
              setNewPassword('');
              setPwOpen(true);
            }}
          >
            <span>Change password</span>
          </button>
          <button
            type="button"
            role="menuitem"
            style={itemStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = G.card2;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            onClick={() => {
              setOpen(false);
              if (
                window.confirm(
                  'Sign out this account on all devices? You will need to log in again.',
                )
              ) {
                void authApi
                  .logoutAll()
                  .catch(() => undefined)
                  .finally(() => {
                    logout();
                    onLogout?.();
                  });
              }
            }}
          >
            <span>Sign out all sessions</span>
          </button>

          {onToggleTheme && (
            <button
              type="button"
              role="menuitem"
              style={itemStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = G.card2;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              onClick={(e) => {
                e.currentTarget.style.background = 'transparent';
                onToggleTheme();
              }}
            >
              <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center' }}>
                {isLight
                  ? Icons.moon({ size: 16, color: G.text })
                  : Icons.sun({ size: 16, color: G.text })}
              </span>
              <span>{isLight ? 'Dark mode' : 'Light mode'}</span>
            </button>
          )}

          {onLogout && (
            <button
              type="button"
              role="menuitem"
              style={{ ...itemStyle, color: G.danger }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = G.dangerBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center' }}>
                {Icons.logout({ size: 16, color: G.danger })}
              </span>
              <span>Logout</span>
            </button>
          )}
        </div>
      )}

      {pwOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: G.overlay,
            zIndex: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => !pwBusy && setPwOpen(false)}
        >
          <div
            style={{
              background: G.card,
              border: `1px solid ${G.border}`,
              borderRadius: RADIUS.xl,
              padding: 20,
              width: 360,
              maxWidth: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Change password</div>
            <div style={{ color: G.muted, fontSize: 12, marginBottom: 12 }}>
              This signs out other sessions. Existing weak passwords can still
              log in until you change them here.
            </div>
            {pwErr && (
              <div style={{ color: G.danger, fontSize: 12, marginBottom: 8 }}>
                {pwErr}
              </div>
            )}
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={{
                width: '100%',
                marginBottom: 8,
                padding: 10,
                borderRadius: 8,
                border: `1px solid ${G.border}`,
                background: G.card2,
                color: G.text,
              }}
            />
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                width: '100%',
                marginBottom: 12,
                padding: 10,
                borderRadius: 8,
                border: `1px solid ${G.border}`,
                background: G.card2,
                color: G.text,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={pwBusy}
                onClick={() => setPwOpen(false)}
                style={{ ...itemStyle, width: 'auto' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pwBusy}
                onClick={() => {
                  setPwErr('');
                  setPwBusy(true);
                  void authApi
                    .changePassword({ currentPassword, newPassword })
                    .then((res) => {
                      setToken(res.accessToken);
                      setPwOpen(false);
                    })
                    .catch((e) => {
                      setPwErr(
                        e instanceof ApiError
                          ? e.message
                          : 'Could not change password',
                      );
                    })
                    .finally(() => setPwBusy(false));
                }}
                style={{
                  ...itemStyle,
                  width: 'auto',
                  background: G.gold,
                  color: G.onGold,
                }}
              >
                {pwBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 640px) {
          .ts-user-menu-meta { display: block !important; }
        }
      `}</style>
    </div>
  );
}
