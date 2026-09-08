import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { G, RADIUS } from '@/lib/theme';
import { Btn } from '@/components/ui/Btn';
import { Inp } from '@/components/ui/Inp';

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
};

export type PromptOptions = {
  title?: string;
  message?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  maxLength?: number;
  /** Return an error string to block submit, or null/undefined when valid. */
  validate?: (value: string) => string | null | undefined;
};

type ConfirmState = ConfirmOptions & {
  open: boolean;
  resolve?: (value: boolean) => void;
};

type PromptState = PromptOptions & {
  open: boolean;
  resolve?: (value: string | null) => void;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

/** Theme tokens mutate on toggle — read them at render, never at module load. */
const overlayStyle = (): CSSProperties => ({
  position: 'fixed',
  inset: 0,
  background: G.overlay,
  zIndex: 6000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
});

const panelStyle = (): CSSProperties => ({
  width: '100%',
  maxWidth: 420,
  background: G.card,
  border: `1px solid ${G.border}`,
  borderRadius: RADIUS.lg,
  boxShadow: G.shadowHover,
  padding: 20,
});

const titleStyle = (): CSSProperties => ({
  margin: '0 0 8px',
  fontSize: 17,
  fontWeight: 600,
  color: G.text,
});

const messageStyle = (): CSSProperties => ({
  margin: '0 0 20px',
  fontSize: 14,
  lineHeight: 1.5,
  color: G.muted2,
});

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
      style={overlayStyle()}
      onClick={onCancel}
    >
      <div style={panelStyle()} onClick={(e) => e.stopPropagation()}>
        <h3 id="ts-confirm-title" style={titleStyle()}>
          {state.title || 'Confirm'}
        </h3>
        <p id="ts-confirm-message" style={messageStyle()}>
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

function PromptDialog({
  state,
  onSubmit,
  onCancel,
}: {
  state: PromptState;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(state.initialValue || '');
  const [err, setErr] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setErr(`${state.label || 'This field'} is required`);
      return;
    }
    const invalid = state.validate?.(trimmed);
    if (invalid) {
      setErr(invalid);
      return;
    }
    onSubmit(trimmed);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ts-prompt-title"
      style={overlayStyle()}
      onClick={onCancel}
    >
      <div style={panelStyle()} onClick={(e) => e.stopPropagation()}>
        <h3 id="ts-prompt-title" style={titleStyle()}>
          {state.title || 'Enter a value'}
        </h3>
        {state.message ? (
          <p style={{ ...messageStyle(), margin: '0 0 16px' }}>
            {state.message}
          </p>
        ) : null}
        <Inp
          autoFocus
          label={state.label || 'Value'}
          placeholder={state.placeholder}
          value={value}
          maxLength={state.maxLength}
          onChange={(e) => {
            setValue(e.target.value);
            if (err) setErr('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        {err ? (
          <div style={{ color: G.danger, fontSize: 12, marginBottom: 12 }}>
            {err}
          </div>
        ) : null}
        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            marginTop: 8,
          }}
        >
          <Btn variant="outline" onClick={onCancel}>
            {state.cancelLabel || 'Cancel'}
          </Btn>
          <Btn onClick={submit}>{state.confirmLabel || 'Save'}</Btn>
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
  const [promptState, setPromptState] = useState<PromptState>({ open: false });

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, open: true, resolve });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPromptState({ ...options, open: true, resolve });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    setState((prev) => {
      prev.resolve?.(result);
      return { open: false, message: '' };
    });
  }, []);

  const closePrompt = useCallback((result: string | null) => {
    setPromptState((prev) => {
      prev.resolve?.(result);
      return { open: false };
    });
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm, prompt }}>
      {children}
      {state.open ? (
        <ConfirmDialog
          state={state}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      ) : null}
      {promptState.open ? (
        <PromptDialog
          state={promptState}
          onSubmit={(value) => closePrompt(value)}
          onCancel={() => closePrompt(null)}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

function useDialogs() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return ctx;
}

export function useConfirm() {
  return useDialogs().confirm;
}

/** Modal replacement for window.prompt — resolves trimmed text or null. */
export function usePrompt() {
  return useDialogs().prompt;
}
