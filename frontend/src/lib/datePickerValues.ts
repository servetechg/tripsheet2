import type { ChangeEvent } from 'react';
import { format } from 'date-fns';

export type DatePickerMode = 'date' | 'time' | 'datetime';

const pad = (n: number) => String(n).padStart(2, '0');

export function parseDateOnly(value: string | undefined | null): Date | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const dt = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateOnly(date: Date | null): string {
  if (!date) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseTimeOnly(value: string | undefined | null): Date | null {
  if (!value?.trim()) return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

export function formatTimeOnly(date: Date | null): string {
  if (!date) return '';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseDatetimeLocal(value: string | undefined | null): Date | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return parseDateOnly(raw);
}

export function formatDatetimeLocal(date: Date | null): string {
  if (!date) return '';
  return `${formatDateOnly(date)}T${formatTimeOnly(date)}`;
}

export function formatPickerValue(
  mode: DatePickerMode,
  date: Date | null,
): string {
  if (mode === 'time') return formatTimeOnly(date);
  if (mode === 'datetime') return formatDatetimeLocal(date);
  return formatDateOnly(date);
}

export function parsePickerValue(
  mode: DatePickerMode,
  value: string | undefined | null,
): Date | null {
  if (mode === 'time') return parseTimeOnly(value);
  if (mode === 'datetime') return parseDatetimeLocal(value);
  return parseDateOnly(value);
}

export function formatDisplayValue(
  mode: DatePickerMode,
  value: string | undefined | null,
): string {
  const date = parsePickerValue(mode, value);
  if (!date) return '';
  if (mode === 'time') return format(date, 'h:mm a');
  if (mode === 'datetime') return format(date, 'MMM d, yyyy h:mm a');
  return format(date, 'MMM d, yyyy');
}

export function syntheticInputChange(value: string): ChangeEvent<HTMLInputElement> {
  return {
    target: { value } as HTMLInputElement,
    currentTarget: { value } as HTMLInputElement,
  } as ChangeEvent<HTMLInputElement>;
}

export const DEFAULT_START_YEAR = 1950;
export const DEFAULT_END_YEAR = new Date().getFullYear() + 10;

export function pickerYearRange(min?: string, max?: string): { start: Date; end: Date } {
  const minDate = min ? parsePickerValue('date', min) : null;
  const maxDate = max ? parsePickerValue('date', max) : null;
  return {
    start: new Date(minDate?.getFullYear() ?? DEFAULT_START_YEAR, 0, 1),
    end: new Date(maxDate?.getFullYear() ?? DEFAULT_END_YEAR, 11, 31),
  };
}

export function clampDateTime(date: Date, min?: Date | null, max?: Date | null): Date {
  const next = new Date(date);
  if (min && next.getTime() < min.getTime()) return new Date(min);
  if (max && next.getTime() > max.getTime()) return new Date(max);
  return next;
}

export const TIME_MINUTES = [0, 15, 30, 45] as const;
