import { useState, useEffect } from 'react';

/** Window width hook (was useW). */
export function useMediaQuery(): number {
  const [w, setW] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200,
  );
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return w;
}

/** @deprecated alias */
export const useW = useMediaQuery;
