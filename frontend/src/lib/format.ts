export const blank = (v: unknown): boolean => !v || !String(v).trim();

export const fmt = (n: unknown, c = 'CAD'): string =>
  `${c} ${parseFloat(String(n ?? 0)).toFixed(2)}`;
