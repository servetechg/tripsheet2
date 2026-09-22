import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  isValidVinFormat,
  normalizeVin,
  validateVinCheckDigit,
} from './vin.util';

const VPIC_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const FETCH_TIMEOUT_MS = 12_000;

export type VpicAssetType = 'truck' | 'trailer' | 'equipment';

export type VpicDecodeResult = {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim?: string;
  vehicleType?: string;
  plantCountry?: string;
  checkDigitValid: boolean;
  source: 'nhtsa_vpic';
  warnings: string[];
};

type NhtsaRow = Record<string, string | null | undefined>;

@Injectable()
export class VpicService {
  private readonly logger = new Logger(VpicService.name);
  private readonly cache = new Map<string, { at: number; data: unknown }>();
  private readonly cacheTtlMs = 60 * 60 * 1000;

  listYears(): string[] {
    const max = new Date().getFullYear() + 1;
    const years: string[] = [];
    for (let y = max; y >= 1981; y--) {
      years.push(String(y));
    }
    return years;
  }

  vehicleTypeParam(assetType: VpicAssetType): string {
    if (assetType === 'trailer') return 'Trailer';
    if (assetType === 'equipment') return 'Truck';
    return 'Truck';
  }

  async listMakes(assetType: VpicAssetType): Promise<string[]> {
    const vtype = this.vehicleTypeParam(assetType);
    const cacheKey = `makes:${vtype}`;
    const cached = this.getCache<string[]>(cacheKey);
    if (cached) return cached;

    const url = `${VPIC_BASE}/GetMakesForVehicleType/${encodeURIComponent(vtype)}?format=json`;
    const body = await this.fetchJson<{ Results?: Array<{ MakeName?: string }> }>(
      url,
    );
    const names = (body.Results || [])
      .map((r) => String(r.MakeName || '').trim())
      .filter(Boolean);
    const unique = [...new Set(names)].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
    this.setCache(cacheKey, unique);
    return unique;
  }

  async listModels(
    make: string,
    year: string,
  ): Promise<string[]> {
    const mk = String(make || '').trim();
    const yr = String(year || '').trim();
    if (!mk || !yr) {
      throw new BadRequestException('make and year are required');
    }
    const cacheKey = `models:${mk.toLowerCase()}:${yr}`;
    const cached = this.getCache<string[]>(cacheKey);
    if (cached) return cached;

    const url = `${VPIC_BASE}/GetModelsForMakeYear/make/${encodeURIComponent(mk)}/modelyear/${encodeURIComponent(yr)}?format=json`;
    const body = await this.fetchJson<{ Results?: Array<{ Model_Name?: string }> }>(
      url,
    );
    const names = (body.Results || [])
      .map((r) => String(r.Model_Name || '').trim())
      .filter(Boolean);
    const unique = [...new Set(names)].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
    this.setCache(cacheKey, unique);
    return unique;
  }

  async decodeVin(vinRaw: string): Promise<VpicDecodeResult> {
    const vin = normalizeVin(vinRaw);
    if (!isValidVinFormat(vin)) {
      throw new BadRequestException(
        'VIN must be 17 characters (letters and digits; no I, O, or Q)',
      );
    }
    const checkDigitValid = validateVinCheckDigit(vin);
    const warnings: string[] = [];
    if (!checkDigitValid) {
      warnings.push(
        'VIN check digit did not validate — verify the VIN or use year/make/model pickers.',
      );
    }

    const cacheKey = `decode:${vin}`;
    const cached = this.getCache<VpicDecodeResult>(cacheKey);
    if (cached) return { ...cached, checkDigitValid, warnings };

    const url = `${VPIC_BASE}/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
    const body = await this.fetchJson<{ Results?: NhtsaRow[] }>(url);
    const row = body.Results?.[0] || {};
    const year = this.pickField(row, ['ModelYear', 'Model Year']);
    const make = this.pickField(row, ['Make', 'Manufacturer']);
    const model = this.pickField(row, ['Model', 'Series']);
    const trim = this.pickField(row, ['Trim', 'Trim2']);
    const vehicleType = this.pickField(row, ['VehicleType', 'Body Class']);
    const plantCountry = this.pickField(row, ['PlantCountry', 'Plant Country']);

    if (!year && !make && !model) {
      throw new BadRequestException(
        'NHTSA vPIC could not decode this VIN — enter year, make, and model manually.',
      );
    }

    const result: VpicDecodeResult = {
      vin,
      year,
      make,
      model,
      trim: trim || undefined,
      vehicleType: vehicleType || undefined,
      plantCountry: plantCountry || undefined,
      checkDigitValid,
      source: 'nhtsa_vpic',
      warnings,
    };
    this.setCache(cacheKey, result);
    return result;
  }

  private pickField(row: NhtsaRow, keys: string[]): string {
    for (const k of keys) {
      const v = row[k];
      if (
        v != null &&
        String(v).trim() &&
        String(v).toLowerCase() !== 'not applicable'
      ) {
        return String(v).trim();
      }
    }
    return '';
  }

  private getCache<T>(key: string): T | null {
    const hit = this.cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > this.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }
    return hit.data as T;
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, { at: Date.now(), data });
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        this.logger.warn(`vPIC HTTP ${res.status} for ${url}`);
        throw new ServiceUnavailableException(
          'Vehicle catalog (NHTSA vPIC) is temporarily unavailable',
        );
      }
      return (await res.json()) as T;
    } catch (e: unknown) {
      if (e instanceof BadRequestException || e instanceof ServiceUnavailableException) {
        throw e;
      }
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`vPIC fetch failed: ${msg}`);
      throw new ServiceUnavailableException(
        'Vehicle catalog (NHTSA vPIC) is temporarily unavailable',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
