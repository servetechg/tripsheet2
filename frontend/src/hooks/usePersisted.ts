import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * Persistence hook — localStorage not available in some sandboxes,
 * so this falls back to in-memory React state (resets on full reload).
 */
export function usePersisted<T>(
  _key: string,
  seed: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [val, setVal] = useState<T>(seed);
  const set: Dispatch<SetStateAction<T>> = (updater) => {
    setVal((prev) =>
      typeof updater === 'function'
        ? (updater as (p: T) => T)(prev)
        : updater,
    );
  };
  return [val, set];
}
