import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { G, inputBase, labelBase, RADIUS } from '@/lib/theme';

export type SearchSelectOption = { value: string; label: string };

export interface SearchSelectProps {
  label?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[] | string[];
  placeholder?: string;
  /** Allow typing a value not in the list (custom city, etc.). Default true. */
  allowCustom?: boolean;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  style?: CSSProperties;
}

function normalizeOptions(
  options: SearchSelectOption[] | string[],
): SearchSelectOption[] {
  return options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  );
}

export function SearchSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Search…',
  allowCustom = true,
  required,
  error,
  disabled,
  style: sx,
}: SearchSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlight, setHighlight] = useState(0);

  const opts = useMemo(() => normalizeOptions(options), [options]);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return opts.slice(0, 40);
    return opts
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          o.value.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [opts, query]);

  const commit = (next: string) => {
    onChange(next);
    setQuery(next);
    setOpen(false);
  };

  const commitTyped = () => {
    const typed = query.trim();
    if (!typed) {
      onChange('');
      setOpen(false);
      return;
    }
    const exact = opts.find(
      (o) => o.label.toLowerCase() === typed.toLowerCase(),
    );
    if (exact) {
      commit(exact.value);
      return;
    }
    if (allowCustom) {
      commit(typed);
      return;
    }
    setQuery(value);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlight]) commit(filtered[highlight].value);
      else commitTyped();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(value);
    }
  };

  return (
    <div ref={rootRef} style={{ marginBottom: 12, position: 'relative', ...sx }}>
      {label && (
        <label htmlFor={id} style={labelBase()}>
          {label}
          {required ? ' *' : ''}
        </label>
      )}
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${id}-list`}
        disabled={disabled}
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // slight delay so option click registers
          window.setTimeout(() => {
            if (!rootRef.current?.contains(document.activeElement)) {
              commitTyped();
            }
          }, 120);
        }}
        onKeyDown={onKeyDown}
        style={{
          ...inputBase(),
          borderColor: error ? G.danger : G.border2,
          boxShadow: error ? `0 0 0 1px ${G.danger}55` : undefined,
        }}
      />
      {error && (
        <div style={{ fontSize: 11, color: G.danger, marginTop: 4 }}>{error}</div>
      )}
      {open && !disabled && (
        <div
          id={`${id}-list`}
          role="listbox"
          style={{
            position: 'absolute',
            zIndex: 50,
            left: 0,
            right: 0,
            top: '100%',
            marginTop: 4,
            maxHeight: 220,
            overflowY: 'auto',
            background: G.card,
            border: `1px solid ${G.border2}`,
            borderRadius: RADIUS.md,
            boxShadow: G.shadowHover,
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '10px 14px',
                fontSize: 13,
                color: G.muted,
              }}
            >
              {allowCustom
                ? 'No matches — press Enter to use what you typed'
                : 'No matches'}
            </div>
          ) : (
            filtered.map((o, i) => (
              <div
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(o.value);
                }}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  padding: '10px 14px',
                  fontSize: 13,
                  cursor: 'pointer',
                  background:
                    i === highlight
                      ? G.goldBg
                      : o.value === value
                        ? G.card2
                        : 'transparent',
                  color: G.text,
                }}
              >
                {o.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
