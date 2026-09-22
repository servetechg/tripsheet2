import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { G, inputBase, labelBase, RADIUS } from '@/lib/theme';
import type { SearchSelectOption } from '@/components/ui';
import { assetsApi } from '@/lib/api';
import type { VpicDecodeResult } from '@/types/dtos';
import {
  isCompleteVin,
  isValidVinFormat,
  normalizeVinInput,
} from '@/features/assets/vinHelpers';

export type VinApplyPayload = {
  vin: string;
  year?: string;
  make?: string;
  model?: string;
  note: string;
};

export interface VinSearchSelectProps {
  label?: string;
  value: string;
  fleetOptions: SearchSelectOption[];
  apiEnabled: boolean;
  onApply: (payload: VinApplyPayload) => void;
  placeholder?: string;
  disabled?: boolean;
}

const DECODE_CACHE = new Map<string, VpicDecodeResult>();

export function VinSearchSelect({
  label,
  value,
  fleetOptions,
  apiEnabled,
  onApply,
  placeholder = 'Type or search VIN…',
  disabled,
}: VinSearchSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlight, setHighlight] = useState(0);
  const [decoding, setDecoding] = useState(false);
  const [nhtsaPreview, setNhtsaPreview] = useState<SearchSelectOption | null>(
    null,
  );
  const decodeGen = useRef(0);

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

  const normalizedQuery = normalizeVinInput(query);

  useEffect(() => {
    setNhtsaPreview(null);
    if (!apiEnabled || !isValidVinFormat(normalizedQuery)) return;

    const fleetHit = fleetOptions.some((o) => o.value === normalizedQuery);
    if (fleetHit) return;

    const cached = DECODE_CACHE.get(normalizedQuery);
    if (cached) {
      const desc = [cached.year, cached.make, cached.model]
        .filter(Boolean)
        .join(' ');
      setNhtsaPreview({
        value: cached.vin,
        label: desc
          ? `${cached.vin} · ${desc} · NHTSA vPIC`
          : `${cached.vin} · NHTSA vPIC`,
      });
      return;
    }

    const gen = ++decodeGen.current;
    setDecoding(true);
    const timer = window.setTimeout(() => {
      void assetsApi
        .vpicDecode(normalizedQuery)
        .then((d) => {
          if (decodeGen.current !== gen) return;
          DECODE_CACHE.set(d.vin, d);
          const desc = [d.year, d.make, d.model].filter(Boolean).join(' ');
          setNhtsaPreview({
            value: d.vin,
            label: desc
              ? `${d.vin} · ${desc} · NHTSA vPIC`
              : `${d.vin} · NHTSA vPIC`,
          });
        })
        .catch(() => {
          if (decodeGen.current !== gen) return;
          setNhtsaPreview({
            value: normalizedQuery,
            label: `${normalizedQuery} · Could not decode — check VIN`,
          });
        })
        .finally(() => {
          if (decodeGen.current === gen) setDecoding(false);
        });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [normalizedQuery, apiEnabled, fleetOptions]);

  const allOptions = useMemo(() => {
    const rows = [...fleetOptions];
    if (decoding && isValidVinFormat(normalizedQuery)) {
      rows.unshift({
        value: '__decoding__',
        label: `${normalizedQuery} · Looking up NHTSA vPIC…`,
      });
    } else if (nhtsaPreview) {
      rows.unshift(nhtsaPreview);
    }
    return rows;
  }, [fleetOptions, nhtsaPreview, decoding, normalizedQuery]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions.slice(0, 40);
    return allOptions
      .filter(
        (o) =>
          o.value === '__decoding__' ||
          o.label.toLowerCase().includes(q) ||
          o.value.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [allOptions, query]);

  const applyVin = (vin: string) => {
    if (vin === '__decoding__') return;
    const normalized = normalizeVinInput(vin);
    const fleet = fleetOptions.find((o) => o.value === normalized);
    if (fleet) {
      onApply({
        vin: normalized,
        note: 'Matched an existing fleet VIN — year, make, and model copied. Use a unique unit number if this is a new asset.',
      });
      setQuery(normalized);
      setOpen(false);
      return;
    }

    const decoded = DECODE_CACHE.get(normalized);
    if (decoded) {
      onApply({
        vin: decoded.vin,
        year: decoded.year,
        make: decoded.make,
        model: decoded.model,
        note: decoded.warnings?.length
          ? decoded.warnings.join(' ')
          : `Decoded via NHTSA vPIC${decoded.plantCountry ? ` (${decoded.plantCountry})` : ''}. Confirm year, make, and model.`,
      });
      setQuery(decoded.vin);
      setOpen(false);
      return;
    }

    onApply({ vin: normalized, note: '' });
    setQuery(normalized);
    setOpen(false);
  };

  const commitTyped = () => {
    const typed = normalizeVinInput(query);
    if (!typed) {
      onApply({ vin: '', note: '' });
      setOpen(false);
      return;
    }
    const exact = allOptions.find(
      (o) =>
        o.value !== '__decoding__' &&
        (o.value === typed || o.label.toLowerCase().startsWith(typed.toLowerCase())),
    );
    if (exact && exact.value !== '__decoding__') {
      applyVin(exact.value);
      return;
    }
    if (isCompleteVin(typed)) {
      applyVin(typed);
      return;
    }
    onApply({ vin: typed, note: '' });
    setQuery(typed);
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
      const pick = filtered[highlight];
      if (open && pick && pick.value !== '__decoding__') {
        applyVin(pick.value);
      } else {
        commitTyped();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(value);
    }
  };

  return (
    <div ref={rootRef} style={{ marginBottom: 12, position: 'relative' }}>
      {label && (
        <label htmlFor={id} style={labelBase()}>
          {label}
        </label>
      )}
      <input
        id={id}
        className="ts-input"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${id}-list`}
        disabled={disabled}
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value.toUpperCase());
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            if (!rootRef.current?.contains(document.activeElement)) {
              commitTyped();
            }
          }, 120);
        }}
        onKeyDown={onKeyDown}
        style={inputBase()}
      />
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
            <div style={{ padding: '10px 14px', fontSize: 13, color: G.muted }}>
              {isValidVinFormat(normalizedQuery)
                ? 'No fleet match — keep typing or press Enter'
                : 'No matches — enter full 17-character VIN'}
            </div>
          ) : (
            filtered.map((o, i) => (
              <div
                key={`${o.value}-${o.label}`}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (o.value !== '__decoding__') applyVin(o.value);
                }}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  padding: '10px 14px',
                  fontSize: 13,
                  cursor: o.value === '__decoding__' ? 'default' : 'pointer',
                  opacity: o.value === '__decoding__' ? 0.7 : 1,
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
