import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { G, RADIUS } from '@/lib/theme';
import { Btn } from './Btn';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  maxWidth?: number;
  footer?: ReactNode;
  closeOnBackdrop?: boolean;
  showClose?: boolean;
};

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 480,
  footer,
  closeOnBackdrop = true,
  showClose = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'ts-modal-title' : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        background: G.overlay,
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        style={{
          width: '100%',
          maxWidth,
          maxHeight: 'min(90vh, calc(100dvh - 32px))',
          display: 'flex',
          flexDirection: 'column',
          background: G.card,
          border: `1px solid ${G.border}`,
          borderRadius: RADIUS.xl,
          boxShadow: G.shadowHover,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showClose) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '16px 20px',
              borderBottom: `1px solid ${G.border}`,
              flexShrink: 0,
            }}
          >
            {title ? (
              <h2
                id="ts-modal-title"
                style={{ margin: 0, fontSize: 18, fontWeight: 600, color: G.text }}
              >
                {title}
              </h2>
            ) : (
              <span />
            )}
            {showClose ? (
              <Btn size="sm" variant="outline" onClick={onClose}>
                Close
              </Btn>
            ) : null}
          </div>
        )}
        <div className="ts-modal-body" style={{ overflow: 'auto', padding: 20, flex: 1, minHeight: 0 }}>
          {children}
        </div>
        {footer ? (
          <div
            style={{
              padding: '12px 20px 16px',
              borderTop: `1px solid ${G.border}`,
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
