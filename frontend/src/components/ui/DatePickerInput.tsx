import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FocusEventHandler,
} from 'react';
import { DayPicker } from 'react-day-picker';
import { startOfDay } from 'date-fns';
import 'react-day-picker/style.css';
import { G, inputBase } from '@/lib/theme';
import {
  clampDateTime,
  formatDisplayValue,
  formatPickerValue,
  parsePickerValue,
  pickerYearRange,
  syntheticInputChange,
  TIME_MINUTES,
  type DatePickerMode,
} from '@/lib/datePickerValues';
import { Icons } from './Icons';
import { DayPickerScrollDropdown } from './DayPickerScrollDropdown';

export type { DatePickerMode };

export interface DatePickerInputProps {
  id?: string;
  mode: DatePickerMode;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  placeholder?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  style?: CSSProperties;
  error?: boolean;
}

function TimeSelects({
  value,
  onChange,
  min,
  max,
}: {
  value: Date | null;
  onChange: (next: Date) => void;
  min?: Date | null;
  max?: Date | null;
}) {
  const base = value ?? (min && min > new Date() ? min : new Date());
  const hour = base.getHours();
  const minute = base.getMinutes();

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const isMinDay = min ? isSameDay(base, min) : false;
  const isMaxDay = max ? isSameDay(base, max) : false;

  const minHour = isMinDay && min ? min.getHours() : 0;
  const maxHour = isMaxDay && max ? max.getHours() : 23;

  const apply = (h: number, m: number) => {
    const next = new Date(base);
    next.setHours(h, m, 0, 0);
    onChange(clampDateTime(next, min, max));
  };

  return (
    <div className="ts-date-picker-time">
      <label className="ts-date-picker-time-label">
        Hour
        <select
          className="ts-date-picker-time-select"
          value={hour}
          onChange={(e) => apply(Number(e.target.value), minute)}
        >
          {Array.from({ length: 24 }, (_, h) => {
            const disabledHour = Boolean(
              (isMinDay && h < minHour) || (isMaxDay && h > maxHour),
            );
            return (
              <option key={h} value={h} disabled={disabledHour}>
                {String(h).padStart(2, '0')}
              </option>
            );
          })}
        </select>
      </label>
      <label className="ts-date-picker-time-label">
        Minute
        <select
          className="ts-date-picker-time-select"
          value={minute}
          onChange={(e) => apply(hour, Number(e.target.value))}
        >
          {TIME_MINUTES.map((m) => {
            const disabledMinute = Boolean(
              (isMinDay && hour === minHour && min && m < min.getMinutes()) ||
              (isMaxDay && hour === maxHour && max && m > max.getMinutes()),
            );
            return (
              <option key={m} value={m} disabled={disabledMinute}>
                {String(m).padStart(2, '0')}
              </option>
            );
          })}
        </select>
      </label>
    </div>
  );
}

export function DatePickerInput({
  id,
  mode,
  value = '',
  onChange,
  onBlur,
  placeholder,
  disabled,
  min,
  max,
  style,
  error,
}: DatePickerInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = parsePickerValue(mode, value);
  const minDate = min ? parsePickerValue(mode === 'time' ? 'date' : mode, min) : null;
  const maxDate = max ? parsePickerValue(mode === 'time' ? 'date' : mode, max) : null;
  const { start: startMonth, end: endMonth } = pickerYearRange(min, max, selected);

  const display = formatDisplayValue(mode, value);

  const emit = (date: Date | null) => {
    onChange?.(syntheticInputChange(formatPickerValue(mode, date)));
  };

  const closePopover = () => {
    setOpen(false);
  };

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return;
    if (mode === 'date') {
      emit(day);
      closePopover();
      return;
    }
    const next = new Date(day);
    if (selected) {
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    } else if (
      minDate &&
      day.getFullYear() === minDate.getFullYear() &&
      day.getMonth() === minDate.getMonth() &&
      day.getDate() === minDate.getDate()
    ) {
      next.setHours(Math.max(9, minDate.getHours()), minDate.getMinutes(), 0, 0);
    } else {
      next.setHours(9, 0, 0, 0);
    }
    emit(clampDateTime(next, minDate, maxDate));
  };

  const handleTimeChange = (next: Date) => {
    emit(clampDateTime(next, minDate, maxDate));
    if (mode === 'time') closePopover();
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return;
      closePopover();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePopover();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const disabledMatchers: import("react-day-picker").Matcher[] = [];
  if (minDate && mode !== 'time') {
    disabledMatchers.push({ before: startOfDay(minDate) });
  }
  if (maxDate && mode !== 'time') {
    disabledMatchers.push({ after: startOfDay(maxDate) });
  }

  return (
    <div ref={wrapRef} className="ts-date-picker-wrap" style={{ position: 'relative', width: '100%' }}>
      <input
        id={inputId}
        readOnly
        disabled={disabled}
        value={display}
        placeholder={placeholder}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        onBlur={(e) => {
          if (!wrapRef.current?.contains(e.relatedTarget as Node)) {
            onBlur?.(e);
          }
        }}
        className="ts-input ts-date-picker-input"
        style={{
          ...inputBase(),
          width: '100%',
          paddingRight: 40,
          cursor: disabled ? 'not-allowed' : 'pointer',
          ...(error
            ? {
                borderColor: G.danger,
                boxShadow: `0 0 0 3px ${G.danger}22`,
              }
            : {}),
          color: display ? G.text : G.muted,
          ...style,
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      />
      <span className="ts-date-picker-icon" aria-hidden>
        {mode === 'time'
          ? Icons.clock({ size: 16, color: G.muted })
          : Icons.calendar({ size: 16, color: G.muted })}
      </span>

      {open && !disabled ? (
        <div className="ts-date-picker-popover" role="dialog" aria-label="Choose date">
          {mode !== 'time' ? (
            <DayPicker
              mode="single"
              selected={selected ?? undefined}
              onSelect={handleDaySelect}
              captionLayout="dropdown"
              startMonth={startMonth}
              endMonth={endMonth}
              defaultMonth={selected ?? (minDate && minDate > new Date() ? minDate : new Date())}
              disabled={disabledMatchers.length ? disabledMatchers : undefined}
              showOutsideDays
              className="ts-day-picker"
              components={{ Dropdown: DayPickerScrollDropdown }}
            />
          ) : null}

          {mode === 'time' || mode === 'datetime' ? (
            <TimeSelects
              value={selected}
              min={minDate}
              max={maxDate}
              onChange={handleTimeChange}
            />
          ) : null}

          <div className="ts-date-picker-footer">
            {value ? (
              <button
                type="button"
                className="ts-date-picker-footer-btn ts-date-picker-footer-btn--ghost"
                onClick={() => {
                  emit(null);
                  closePopover();
                }}
              >
                Clear
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="ts-date-picker-footer-btn ts-date-picker-footer-btn--primary"
              onClick={closePopover}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
