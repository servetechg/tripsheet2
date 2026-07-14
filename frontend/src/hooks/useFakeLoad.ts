import { useState, useEffect } from 'react';

export function useFakeLoad(key: unknown, delay = 400): boolean {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), delay);
    return () => clearTimeout(t);
  }, [key, delay]);
  return loading;
}
