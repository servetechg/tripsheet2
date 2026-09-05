import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import type { DropdownProps } from 'react-day-picker';
import { G } from '@/lib/theme';
import { Icons } from './Icons';

export function DayPickerScrollDropdown({
  options,
  value,
  onChange,
  disabled,
  className,
  'aria-label': ariaLabel,
}: DropdownProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options?.find((opt) => opt.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (next: number) => {
    onChange?.({
      target: { value: String(next) },
    } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`ts-scroll-dropdown ${className ?? ''}`.trim()}
      data-open={open ? 'true' : 'false'}
    >
      <button
        type="button"
        className="ts-scroll-dropdown-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{selected?.label ?? '—'}</span>
        {Icons.chevronDown({ size: 14, color: G.muted })}
      </button>
      {open ? (
        <ul id={listId} className="ts-scroll-dropdown-menu" role="listbox" aria-label={ariaLabel}>
          {options?.map((opt) => (
            <li key={opt.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={opt.value === value}
                disabled={opt.disabled}
                className={
                  opt.value === value ? 'ts-scroll-dropdown-option is-selected' : 'ts-scroll-dropdown-option'
                }
                onClick={() => pick(opt.value)}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
