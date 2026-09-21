import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { G, inputBase, labelBase, RADIUS } from '@/lib/theme';
import {
  searchGeoapifyAutocomplete,
  getCountryFlag,
  type GeoapifyAddress,
} from '@/lib/geoapify';
import { Icons } from './Icons';

export interface AddressAutocompleteProps {
  label?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onSelectAddress?: (address: GeoapifyAddress) => void;
  /** Restrict suggestions to these countries (ISO2 uppercase). Default: US + CA. */
  allowedCountries?: Array<'US' | 'CA'>;
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
  inputStyle?: CSSProperties;
  id?: string;
  name?: string;
  autoComplete?: string;
}

export function AddressAutocomplete({
  label,
  value,
  onChange,
  onBlur,
  onSelectAddress,
  allowedCountries = ['US', 'CA'],
  placeholder = 'Start typing address (US & Canada)...',
  hint,
  error,
  required,
  disabled,
  style: sx,
  inputStyle,
  id,
  name,
  autoComplete = 'off',
}: AddressAutocompleteProps) {
  const geoCountries = allowedCountries.map((c) =>
    c.toLowerCase() as 'us' | 'ca',
  );
  const countryHint =
    allowedCountries.length === 1
      ? allowedCountries[0] === 'CA'
        ? 'Canada only'
        : 'United States only'
      : 'US & Canada';
  const autoId = useId();
  const inputId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoapifyAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);

  // Debounced search effect
  useEffect(() => {
    if (!open || disabled) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const trimmed = (value || '').trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const abortCtrl = new AbortController();
    setLoading(true);

    const timer = window.setTimeout(() => {
      searchGeoapifyAutocomplete(trimmed, abortCtrl.signal, geoCountries)
        .then((results) => {
          const allowed = new Set(
            allowedCountries.map((c) => c.toLowerCase()),
          );
          const filtered = results.filter((addr) =>
            allowed.has(String(addr.country_code || '').toLowerCase()),
          );
          setSuggestions(filtered);
          setHighlight(0);
        })
        .catch(() => {
          setSuggestions([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      abortCtrl.abort();
    };
  }, [value, open, disabled, allowedCountries.join(','), geoCountries.join(',')]);

  // Click outside listener
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleSelect = (addr: GeoapifyAddress) => {
    const selectedText = addr.formatted || addr.address_line1 || value;
    onChange(selectedText);
    onSelectAddress?.(addr);
    setOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'ArrowDown') {
        setOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[highlight]) {
        handleSelect(suggestions[highlight]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} style={{ marginBottom: 12, position: 'relative', ...sx }}>
      {label ? (
        <label htmlFor={inputId} style={labelBase()}>
          {label}
          {required ? <span style={{ color: G.danger, marginLeft: 4 }}>*</span> : null}
        </label>
      ) : null}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            position: 'absolute',
            left: 11,
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
            color: G.muted,
            zIndex: 1,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>

        <input
          id={inputId}
          name={name}
          className="ts-input"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-autocomplete="list"
          aria-controls={`${inputId}-list`}
          disabled={disabled}
          autoComplete={autoComplete}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if ((value || '').trim().length >= 2) {
              setOpen(true);
            }
          }}
          onBlur={() => {
            onBlur?.();
          }}
          onKeyDown={handleKeyDown}
          style={{
            ...inputBase(),
            paddingLeft: 34,
            paddingRight: loading ? 38 : 12,
            ...(error
              ? {
                  borderColor: G.danger,
                  boxShadow: `0 0 0 3px ${G.danger}22`,
                }
              : {}),
            ...inputStyle,
          }}
        />

        {loading && (
          <div
            style={{
              position: 'absolute',
              right: 12,
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
              color: G.muted,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 14,
                height: 14,
                border: `2px solid ${G.border}`,
                borderTopColor: G.gold,
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
        )}
      </div>

      {error ? (
        <div style={{ fontSize: 11, color: G.danger, marginTop: 4 }}>{error}</div>
      ) : hint ? (
        <div style={{ fontSize: 11, color: G.muted, marginTop: 4 }}>{hint}</div>
      ) : null}

      {/* Suggestions Dropdown */}
      {open &&
        !loading &&
        (value || '').trim().length >= 2 &&
        suggestions.length === 0 &&
        !disabled && (
          <div
            style={{
              position: 'absolute',
              zIndex: 60,
              left: 0,
              right: 0,
              top: '100%',
              marginTop: 4,
              padding: '10px 12px',
              background: G.card,
              border: `1px solid ${G.border2}`,
              borderRadius: RADIUS.md,
              fontSize: 12,
              color: G.muted,
            }}
          >
            No {countryHint.toLowerCase()} locations found. Try city name or
            postal/ZIP code.
          </div>
        )}

      {open && suggestions.length > 0 && !disabled && (
        <div
          id={`${inputId}-list`}
          role="listbox"
          style={{
            position: 'absolute',
            zIndex: 60,
            left: 0,
            right: 0,
            top: '100%',
            marginTop: 4,
            maxHeight: 250,
            overflowY: 'auto',
            background: G.card,
            border: `1px solid ${G.border2}`,
            borderRadius: RADIUS.md,
            boxShadow: G.shadowHover,
          }}
        >
          {suggestions.map((addr, i) => {
            const isHigh = i === highlight;
            const flag = getCountryFlag(addr.country_code);
            const line1 = addr.address_line1 || addr.formatted;
            const line2 =
              addr.address_line2 ||
              [addr.city, addr.state_code, addr.postcode, addr.country]
                .filter(Boolean)
                .join(', ');

            return (
              <div
                key={`${addr.formatted}-${i}`}
                role="option"
                aria-selected={isHigh}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(addr);
                }}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '9px 12px',
                  cursor: 'pointer',
                  borderBottom:
                    i < suggestions.length - 1
                      ? `1px solid ${G.border}55`
                      : 'none',
                  background: isHigh ? G.goldBg : 'transparent',
                  transition: 'background 0.1s ease',
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    lineHeight: '20px',
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                  title={addr.country}
                >
                  {flag}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    title={line1}
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: G.text,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {line1}
                  </div>
                  {line2 && line2 !== line1 && (
                    <div
                      title={line2}
                      style={{
                        fontSize: 11,
                        color: G.muted,
                        marginTop: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {line2}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div
            style={{
              padding: '6px 12px',
              fontSize: 10,
              color: G.muted,
              background: `${G.border}22`,
              borderTop: `1px solid ${G.border}44`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{countryHint}</span>
            <span>⚡ Powered by Geoapify</span>
          </div>
        </div>
      )}
    </div>
  );
}
