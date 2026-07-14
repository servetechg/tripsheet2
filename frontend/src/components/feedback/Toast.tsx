import { useState, useEffect } from 'react';
import { G, SPACE, RADIUS, FONT_UI } from '@/lib/theme';
import { uid } from '@/lib/uid';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  msg: string;
  type: ToastType;
}

type ToastHandler = (toast: ToastItem) => void;

let _toastSubscribers: ToastHandler[] = [];

export function notify(msg: string, type: ToastType = 'success'): void {
  const toast: ToastItem = { id: uid(), msg, type };
  _toastSubscribers.forEach((fn) => fn(toast));
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  useEffect(() => {
    const handler: ToastHandler = (toast) => {
      setToasts((p) => [...p, toast]);
      setTimeout(
        () => setToasts((p) => p.filter((t) => t.id !== toast.id)),
        3200,
      );
    };
    _toastSubscribers.push(handler);
    return () => {
      _toastSubscribers = _toastSubscribers.filter((h) => h !== handler);
    };
  }, []);
  if (!toasts.length) return null;
  const ICONS: Record<string, string> = {
    success: '✓',
    error: '⚠️',
    info: 'ℹ️',
  };
  return (
    <div
      style={{
        position: 'fixed',
        bottom: SPACE.xl,
        right: SPACE.xl,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.sm,
        maxWidth: 340,
      }}
    >
      {toasts.map((t) => {
        const c =
          t.type === 'error' ? G.danger : t.type === 'info' ? G.info : G.success;
        return (
          <div
            key={t.id}
            style={{
              background: G.card,
              border: `1px solid ${c}55`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              borderRadius: RADIUS.md,
              padding: '12px 14px',
              fontSize: 12,
              fontFamily: FONT_UI,
              color: G.text,
              display: 'flex',
              alignItems: 'flex-start',
              gap: SPACE.sm,
            }}
          >
            <span style={{ color: c, fontWeight: 800, flexShrink: 0 }}>
              {ICONS[t.type] || ICONS.success}
            </span>
            <span style={{ flex: 1 }}>{t.msg}</span>
          </div>
        );
      })}
    </div>
  );
}
