import { useCallback, useEffect, useState } from 'react';
import { assetsApi } from '@/lib/api';
import type { VpicAssetType } from '@/features/assets/types';

export function useVpicCatalog(
  enabled: boolean,
  vehicleType: VpicAssetType,
  year: string,
  make: string,
) {
  const [years, setYears] = useState<string[]>([]);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    void assetsApi
      .vpicYears()
      .then((r) => setYears(r.years || []))
      .catch(() => setYears([]));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setMakes([]);
      return;
    }
    setLoadingMakes(true);
    void assetsApi
      .vpicMakes(vehicleType)
      .then((r) => setMakes(r.makes || []))
      .catch(() => setMakes([]))
      .finally(() => setLoadingMakes(false));
  }, [enabled, vehicleType]);

  useEffect(() => {
    if (!enabled || !make.trim() || !year.trim()) {
      setModels([]);
      return;
    }
    setLoadingModels(true);
    void assetsApi
      .vpicModels(make, year)
      .then((r) => setModels(r.models || []))
      .catch(() => setModels([]))
      .finally(() => setLoadingModels(false));
  }, [enabled, make, year]);

  const refreshModels = useCallback(() => {
    if (!make.trim() || !year.trim()) return;
    setLoadingModels(true);
    void assetsApi
      .vpicModels(make, year)
      .then((r) => setModels(r.models || []))
      .catch(() => setModels([]))
      .finally(() => setLoadingModels(false));
  }, [make, year]);

  return {
    years,
    makes,
    models,
    loadingMakes,
    loadingModels,
    refreshModels,
  };
}
