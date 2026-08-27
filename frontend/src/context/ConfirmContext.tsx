import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { G, RADIUS } from '@/lib/theme';
import { Btn } from '@/components/ui/Btn';

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
};

type ConfirmState = ConfirmOptions & {
  open: boolean;
  resolve?: (value: boolean) => void;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

function ConfirmDialog({
  state,
  onConfirm,
  onCancel,
}: {
  state: ConfirmState;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isDanger = state.variant === 'danger';

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ts-confirm-title"
      aria-describedby="ts-confirm-message"
      style={{
        position: 'fixed',
        inset: 0,
        background: G.overlay,
        zIndex: 6000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: G.card,
          border: `1px solid ${G.border}`,
          borderRadius: RADIUS.xl,
          boxShadow: G.shadowHover,
          padding: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="ts-confirm-title"
          style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 600, color: G.text }}
        >
          {state.title || 'Confirm'}
        </h3>
        <p
          id="ts-confirm-message"
          style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.5, color: G.muted2 }}
        >
          {state.message}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn variant="outline" onClick={onCancel}>
            {state.cancelLabel || 'Cancel'}
          </Btn>
          <Btn variant={isDanger ? 'danger' : 'primary'} onClick={onConfirm}>
            {state.confirmLabel || 'Confirm'}
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    message: '',
  });

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, open: true, resolve });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    setState((prev) => {
      prev.resolve?.(result);
      return { open: false, message: '' };
    });
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.open ? (
        <ConfirmDialog
          state={state}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return ctx.confirm;
}
