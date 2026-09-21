import { useEffect, useMemo, useState } from 'react';
import { G, FONT_MONO, RADIUS, labelBase } from '@/lib/theme';
import {
  Btn,
  Card,
  Chk,
  FieldInp,
  Sel,
  Pill,
  SectionTitle,
  G2,
  StatCard,
  StatsGrid,
  Icons,
  AddressAutocomplete,
  RouteFromTo,
} from '@/components/ui';
import { blank } from '@/lib/format';
import {
  datetimeLocalToIso,
  formatDisplayDateTime,
  isValidTripNo,
  parseNonNegNumber,
  sanitizeDecimal,
  sanitizeInteger,
  toDatetimeLocal,
} from '@/lib/formFields';
import { uid } from '@/lib/uid';
import { Err } from '@/components/feedback/Err';
import { notify } from '@/components/feedback/Toast';
import { useConfirm } from '@/context/ConfirmContext';
import { DRIVER_DOC_TYPES } from '@/lib/docTypes';
import { loadsApi, driversApi, notificationsApi, companiesApi } from '@/lib/api';
import { lifecycleAllowsDispatch, availabilityAllowsDispatch, DRIVER_LIFECYCLE_LABELS, AVAILABILITY_LABELS } from '@/lib/driverLifecycle';
import { matchesDriverRef, driverRecordIdOf } from '@/lib/driverIds';
import { canAssignAsset } from '@/lib/assetStatus';
import { useCan } from '@/lib/permissions';
import { useSmsEnabled } from '@/hooks/useSmsEnabled';
import type { GeoapifyAddress } from '@/lib/geoapify';
import {
  allowedCountriesForDestination,
  allowedCountriesForOrigin,
  countryLabel,
  customsProgramForRoute,
  inferCountryFromAddress,
  normalizeTripCountry,
  oppositeCountry,
  validateRouteCountries,
  type TripCountry,
} from '@/lib/dispatchLocations';
import type { DispatchTabProps, DispatchLoadFormState } from '@/features/dispatch/types';
import type { MdmRecord, PortOfEntryDto } from '@/types/dtos';
import { getApiErrorMessage } from '@/lib/format';
import type { Load, LoadStatus } from '@tripsheet/shared';

type FormErrors = Partial<
  Record<
    | 'driverId'
    | 'truckId'
    | 'origin'
    | 'destination'
    | 'pickupTime'
    | 'eta'
    | 'tripNo'
    | 'customerRate'
    | 'carrierCost'
    | 'fuelSurcharge'
    | 'accessorials'
    | 'detentionHours'
    | 'detentionRate'
    | 'miles'
    | 'notes'
    | 'portOfEntryId'
    | 'customsProgram',
    string
  >
>;

export function DispatchTab({
  company,
  loads,
  setLoads,
  drivers,
  trucks,
  trailers,
  users,
  statusColor,
  onTrack,
  onEManifest,
  driverDocs = [],
  apiEnabled,
  refreshAll,
}: DispatchTabProps) {
  const { can } = useCan();
  const confirm = useConfirm();
  const { smsEnabled } = useSmsEnabled(Boolean(apiEnabled));
  const [show, setShow] = useState(false);
  const [editLoad, setEditLoad] = useState<Load | null>(null);
  const [initialF, setInitialF] = useState<DispatchLoadFormState | null>(null);
  const [docErr, setDocErr] = useState('');
  const [fieldErr, setFieldErr] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = (k: string) => {
    setTouched((prev) => ({ ...prev, [k]: true }));
  };

  const [busy, setBusy] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [brokers, setBrokers] = useState<MdmRecord[]>([]);
  const [carriers, setCarriers] = useState<MdmRecord[]>([]);
  const [commodities, setCommodities] = useState<MdmRecord[]>([]);
  const [ports, setPorts] = useState<PortOfEntryDto[]>([]);
  const [portCustomsLoading, setPortCustomsLoading] = useState(false);
  const [mdmLocations, setMdmLocations] = useState<MdmRecord[]>([]);
  const emptyForm = {
    driverId: '',
    truckId: '',
    trailerId: '',
    brokerId: '',
    carrierId: '',
    commodityId: '',
    crossBorder: false,
    portOfEntryId: '',
    customsProgram: '',
    customsAce: false,
    customsAci: false,
    customsPaps: false,
    customsPars: false,
    portOfEntryCode: '',
    portOfEntryName: '',
    originLocationId: '',
    destinationLocationId: '',
    originCountry: '' as TripCountry | '',
    destinationCountry: '' as TripCountry | '',
    origin: '',
    destination: '',
    pickupTime: '',
    eta: '',
    tripNo: '',
    notes: '',
    customerRate: '',
    carrierCost: '',
    fuelSurcharge: '',
    accessorials: '',
    detentionHours: '',
    detentionRate: '',
    miles: '',
    intermediateStops: [] as string[],
  };
  const MAX_INTERMEDIATE_STOPS = 20;
  const [f, setF] = useState(emptyForm);
  const [showAllDrivers, setShowAllDrivers] = useState(false);

  useEffect(() => {
    if (!apiEnabled || !company?.id) return;
    void companiesApi
      .brokers(company.id, true)
      .then(setBrokers)
      .catch(() => setBrokers([]));
    void companiesApi
      .carriers(company.id, true)
      .then(setCarriers)
      .catch(() => setCarriers([]));
    void companiesApi
      .commodities(company.id, true)
      .then(setCommodities)
      .catch(() => setCommodities([]));
    void companiesApi
      .portsOfEntry(company.id, { selectableOnly: true })
      .then(setPorts)
      .catch(() => setPorts([]));
    void companiesApi
      .locations(company.id, true)
      .then(setMdmLocations)
      .catch(() => setMdmLocations([]));
  }, [apiEnabled, company?.id, show]);

  const applyPort = async (portId: string) => {
    if (!portId) {
      setF((x) => ({
        ...x,
        portOfEntryId: '',
        portOfEntryCode: '',
        portOfEntryName: '',
        customsProgram: '',
        customsAce: false,
        customsAci: false,
        customsPaps: false,
        customsPars: false,
      }));
      setPortCustomsLoading(false);
      return;
    }

    // 1. Immediately apply from in-memory ports list (instant 0ms feedback)
    const p = ports.find((x) => x.id === portId);
    const immediateAce = Boolean(p?.ace);
    const immediateAci = Boolean(p?.aci);
    const immediateProgram = immediateAce ? 'ACE' : immediateAci ? 'ACI' : '';
    const pCountry = p
      ? (normalizeTripCountry(p.country) || (p.ace ? 'US' : p.aci ? 'CA' : ''))
      : '';
    const reqOrigin = pCountry ? oppositeCountry(pCountry as TripCountry) : '';
    const reqDest = pCountry;

    setF((x) => {
      const clearOrigin =
        Boolean(pCountry && x.originCountry && x.originCountry !== reqOrigin);
      const clearDest =
        Boolean(pCountry && x.destinationCountry && x.destinationCountry !== reqDest);
      return {
        ...x,
        portOfEntryId: portId,
        portOfEntryCode: p?.code || '',
        portOfEntryName: p?.name || '',
        customsAce: immediateAce,
        customsAci: immediateAci,
        customsPaps: Boolean(p?.paps),
        customsPars: Boolean(p?.pars),
        customsProgram: immediateProgram,
        ...(clearOrigin
          ? { origin: '', originLocationId: '', originCountry: '' as TripCountry | '' }
          : {}),
        ...(clearDest
          ? { destination: '', destinationLocationId: '', destinationCountry: '' as TripCountry | '' }
          : {}),
      };
    });
    setFieldErr((e) => {
      const next = { ...e };
      delete next.portOfEntryId;
      delete next.customsProgram;
      return next;
    });

    // 2. Query backend to verify / resolve authoritative customs with loader
    if (apiEnabled && company?.id) {
      setPortCustomsLoading(true);
      try {
        const customs = await companiesApi.portCustoms(company.id, portId);
        setF((x) => {
          if (x.portOfEntryId !== portId) return x;
          return {
            ...x,
            portOfEntryCode: customs.portOfEntryCode || x.portOfEntryCode,
            portOfEntryName: customs.portOfEntryName || x.portOfEntryName,
            customsAce: Boolean(customs.customsAce),
            customsAci: Boolean(customs.customsAci),
            customsPaps: Boolean(customs.customsPaps),
            customsPars: Boolean(customs.customsPars),
            customsProgram: x.customsProgram || customs.defaultProgram || '',
          };
        });
      } catch {
        /* Keep in-memory port values on network error */
      } finally {
        setPortCustomsLoading(false);
      }
    }
  };
  const upd = (k: string, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setFieldErr((e) => {
      if (!(k in e)) return e;
      const next = { ...e };
      delete next[k as keyof FormErrors];
      return next;
    });
  };

  const countryFromMaster = (locationId: string): TripCountry | '' => {
    if (!locationId) return '';
    const loc = mdmLocations.find((x) => x.id === locationId);
    return normalizeTripCountry(loc?.country) || '';
  };

  const destinationConflictsOrigin = (
    crossBorder: boolean,
    originCountry: TripCountry | '',
    destinationCountry: TripCountry | '',
  ) => {
    if (!originCountry || !destinationCountry) return false;
    return crossBorder
      ? originCountry === destinationCountry
      : originCountry !== destinationCountry;
  };

  const clearDestinationIfNeeded = (
    prev: typeof f,
    originCountry: TripCountry | '',
  ) => {
    if (
      !originCountry ||
      !prev.destinationCountry ||
      !destinationConflictsOrigin(
        prev.crossBorder,
        originCountry,
        prev.destinationCountry,
      )
    ) {
      return {};
    }
    return {
      destination: '',
      destinationLocationId: '',
      destinationCountry: '' as TripCountry | '',
    };
  };

  const clearOriginIfNeeded = (
    prev: typeof f,
    destinationCountry: TripCountry | '',
  ) => {
    if (
      !destinationCountry ||
      !prev.originCountry ||
      !destinationConflictsOrigin(
        prev.crossBorder,
        prev.originCountry,
        destinationCountry,
      )
    ) {
      return {};
    }
    return {
      origin: '',
      originLocationId: '',
      originCountry: '' as TripCountry | '',
    };
  };

  const clearPortIfNeeded = (
    prev: typeof f,
    originCountry: TripCountry | '',
    destinationCountry: TripCountry | '',
  ) => {
    if (!prev.crossBorder || !prev.portOfEntryId) return {};
    const p = ports.find((x) => x.id === prev.portOfEntryId);
    const pCountry = p
      ? (normalizeTripCountry(p.country) || (p.ace ? 'US' : p.aci ? 'CA' : ''))
      : '';
    if (!pCountry) return {};
    const targetCountry =
      destinationCountry ||
      (originCountry ? oppositeCountry(originCountry as TripCountry) : '');
    if (targetCountry && pCountry !== targetCountry) {
      return {
        portOfEntryId: '',
        portOfEntryCode: '',
        portOfEntryName: '',
        customsProgram: '',
        customsAce: false,
        customsAci: false,
        customsPaps: false,
        customsPars: false,
      };
    }
    return {};
  };

  const formatAddressLabel = (addr: GeoapifyAddress) =>
    addr.formatted ||
    addr.address_line1 ||
    [addr.city, addr.state_code, addr.postcode, addr.country]
      .filter(Boolean)
      .join(', ');

  const selectedPort = useMemo(
    () => ports.find((p) => p.id === f.portOfEntryId),
    [ports, f.portOfEntryId],
  );
  const portCountry: TripCountry | '' = useMemo(() => {
    if (!selectedPort) return '';
    return (
      normalizeTripCountry(selectedPort.country) ||
      (selectedPort.ace ? 'US' : selectedPort.aci ? 'CA' : '')
    );
  }, [selectedPort]);

  const originAllowed = useMemo(() => {
    if (f.crossBorder && portCountry) {
      return [oppositeCountry(portCountry)];
    }
    return allowedCountriesForOrigin(f.crossBorder, f.destinationCountry);
  }, [f.crossBorder, portCountry, f.destinationCountry]);

  const destinationAllowed = useMemo(() => {
    if (f.crossBorder && portCountry) {
      return [portCountry];
    }
    return allowedCountriesForDestination(f.crossBorder, f.originCountry);
  }, [f.crossBorder, portCountry, f.originCountry]);

  const todayLocalStart = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00`;
  }, []);

  const minPickupTime = useMemo(() => {
    if (editLoad && initialF?.pickupTime && initialF.pickupTime < todayLocalStart) {
      return initialF.pickupTime;
    }
    return todayLocalStart;
  }, [editLoad, initialF?.pickupTime, todayLocalStart]);

  const minEta = useMemo(() => {
    return f.pickupTime || minPickupTime;
  }, [f.pickupTime, minPickupTime]);

  const availablePorts = useMemo(() => {
    if (!f.crossBorder) return ports;
    const targetCountry =
      f.destinationCountry ||
      (f.originCountry ? oppositeCountry(f.originCountry) : '');
    if (targetCountry) {
      return ports.filter((p) => {
        const pc =
          normalizeTripCountry(p.country) ||
          (p.ace ? 'US' : p.aci ? 'CA' : '');
        return pc === targetCountry;
      });
    }
    return ports;
  }, [ports, f.crossBorder, f.destinationCountry, f.originCountry]);

  const masterLocationsFor = (allowed: TripCountry[]) =>
    mdmLocations.filter((loc) => {
      const c = normalizeTripCountry(loc.country) || 'CA';
      return allowed.includes(c);
    });

  const formatMasterOption = (loc) => {
    const c = normalizeTripCountry(loc.country) || 'CA';
    const place = [loc.name || loc.city, loc.city, loc.region]
      .filter(Boolean)
      .join(' · ');
    return `${place} · ${countryLabel(c)}`;
  };

  useEffect(() => {
    if (!f.crossBorder) return;
    const program = customsProgramForRoute(f.originCountry, f.destinationCountry);
    if (!program || f.customsProgram === program) return;
    setF((x) => ({ ...x, customsProgram: program }));
  }, [f.crossBorder, f.originCountry, f.destinationCountry, f.customsProgram]);

  useEffect(() => {
    if (!show || mdmLocations.length === 0) return;
    setF((prev) => {
      let changed = false;
      const next = { ...prev };
      if (!prev.originCountry && prev.originLocationId) {
        const c = countryFromMaster(prev.originLocationId);
        if (c) {
          next.originCountry = c;
          changed = true;
        }
      }
      if (!prev.destinationCountry && prev.destinationLocationId) {
        const c = countryFromMaster(prev.destinationLocationId);
        if (c) {
          next.destinationCountry = c;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [show, mdmLocations]);

  useEffect(() => {
    if (!apiEnabled || !f.driverId) return;
    const driver = drivers.find((d) => d.id === f.driverId);
    const recordId = driver ? driverRecordIdOf(driver) : f.driverId;
    let cancelled = false;
    (async () => {
      try {
        const rows = await driversApi.equipmentAssignments(recordId);
        if (cancelled) return;
        const truck = (rows).find(
          (r) => r.assetType === 'truck' && r.role === 'primary' && !r.unassignedAt,
        );
        const trailer = (rows).find(
          (r) => r.assetType === 'trailer' && r.role === 'primary' && !r.unassignedAt,
        );
        setF((prev) => ({
          ...prev,
          ...(truck?.assetId && !prev.truckId ? { truckId: truck.assetId } : {}),
          ...(trailer?.assetId && !prev.trailerId
            ? { trailerId: trailer.assetId }
            : {}),
        }));
      } catch {
        /* optional pre-fill */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiEnabled, f.driverId, drivers]);

  const resetForm = () => {
    setF(emptyForm);
    setEditLoad(null);
    setInitialF(null);
    setShow(false);
    setDocErr('');
    setFieldErr({});
    setTouched({});
  };
  const openEdit = (l) => {
    const stops = Array.isArray(l.stops) ? l.stops : [];
    const init = {
      driverId: l.driverId || '',
      truckId: l.truckId || '',
      trailerId: l.trailerId || '',
      brokerId: l.brokerId || '',
      carrierId: l.carrierId || '',
      commodityId: l.commodityId || '',
      crossBorder: Boolean(l.crossBorder),
      portOfEntryId: l.portOfEntryId || '',
      customsProgram: l.customsProgram || '',
      customsAce: Boolean(l.customsAce),
      customsAci: Boolean(l.customsAci),
      customsPaps: Boolean(l.customsPaps),
      customsPars: Boolean(l.customsPars),
      portOfEntryCode: l.portOfEntryCode || '',
      portOfEntryName: l.portOfEntryName || '',
      originLocationId: l.originLocationId || '',
      destinationLocationId: l.destinationLocationId || '',
      originCountry:
        countryFromMaster(l.originLocationId || '') ||
        inferCountryFromAddress(l.origin) ||
        ('' as TripCountry | ''),
      destinationCountry:
        countryFromMaster(l.destinationLocationId || '') ||
        inferCountryFromAddress(l.destination) ||
        ('' as TripCountry | ''),
      origin: l.origin || '',
      destination: l.destination || '',
      pickupTime: toDatetimeLocal(l.pickupTime || ''),
      eta: toDatetimeLocal(l.eta || ''),
      tripNo: l.tripNo || '',
      notes: l.notes || '',
      customerRate: l.customerRate != null ? String(l.customerRate) : '',
      carrierCost: l.carrierCost != null ? String(l.carrierCost) : '',
      fuelSurcharge: l.fuelSurcharge != null ? String(l.fuelSurcharge) : '',
      accessorials: l.accessorials != null ? String(l.accessorials) : '',
      detentionHours: l.detentionHours != null ? String(l.detentionHours) : '',
      detentionRate: l.detentionRate != null ? String(l.detentionRate) : '',
      miles: l.miles != null ? String(l.miles) : '',
      intermediateStops: stops.map(
        (s) =>
          (typeof s === 'string' ? s : s?.location || '') as string,
      ),
    };
    setF(init);
    setInitialF(init);
    setFieldErr({});
    setEditLoad(l);
    setShow(true);
  };

  const DISPATCH_REQUIRED = ['license', 'abstract', 'medical'];
  const assertDispatchReady = async (driverId: string) => {
    if (apiEnabled) {
      try {
        const driver = drivers.find((d) => d.id === driverId);
        const recordId = driver?.driverRecordId || driverId;
        const res = await driversApi.dispatchReady(recordId);
        if (!res.ready) return res.missing;
      } catch {
        // fall through to local docs check
      }
    }
    return checkDriverDocs(driverId);
  };

  const checkDriverDocs = (driverId: string) => {
    const driver =
      drivers.find((d) => d.id === driverId) ||
      users.find((u) => u.id === driverId);
    const dd = (driverDocs || []).filter(
      (d) =>
        (driver
          ? matchesDriverRef(d.driverId, driver)
          : d.driverId === driverId) && d.status !== 'expired',
    );
    return DISPATCH_REQUIRED.filter(
      (id) => !dd.find((d) => d.type === id),
    );
  };

  const isDriverAvailableForDispatch = (d) => {
    const missing = checkDriverDocs(d.id);
    const lifecycle = d.lifecycleStatus || (d.active === false ? 'suspended' : 'active');
    const avail = d.availabilityStatus || 'available';
    const driverActive = lifecycleAllowsDispatch(lifecycle);
    const availOk = availabilityAllowsDispatch(avail);
    const onLoad = loads.some(
      (l) =>
        l.driverId === d.id &&
        ['assigned', 'in_transit'].includes(l.status) &&
        (!editLoad || l.id !== editLoad.id),
    );
    return missing.length === 0 && driverActive && availOk && !onLoad;
  };

  const uniqueDrivers = useMemo(() => {
    const seen = new Set<string>();
    return (drivers || []).filter((d) => {
      const key = String(d.id || d.driverRecordId || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [drivers]);

  const visibleDrivers = useMemo(() => {
    if (showAllDrivers) return uniqueDrivers;
    return uniqueDrivers.filter((d) => {
      if (editLoad && f.driverId === d.id) return true;
      return isDriverAvailableForDispatch(d);
    });
  }, [showAllDrivers, uniqueDrivers, editLoad, f.driverId, loads, driverDocs]);

  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const validateForm = (): FormErrors => {
    const errs: FormErrors = {};
    if (blank(f.driverId)) errs.driverId = 'Select a driver';
    if (blank(f.truckId)) errs.truckId = 'Select a truck';
    if (blank(f.origin)) errs.origin = 'Origin is required';
    if (blank(f.destination)) errs.destination = 'Destination is required';
    if (
      !blank(f.origin) &&
      !blank(f.destination) &&
      f.origin.trim().toLowerCase() === f.destination.trim().toLowerCase()
    ) {
      errs.destination = 'Destination must differ from origin';
    }
    if (blank(f.pickupTime)) errs.pickupTime = 'Pickup date & time is required';

    Object.assign(errs, validateRouteCountries(
      f.crossBorder,
      f.originCountry,
      f.destinationCountry,
    ));

    if (f.crossBorder) {
      if (blank(f.portOfEntryId)) {
        errs.portOfEntryId = 'Port of entry is required for cross-border';
      }
      if (blank(f.customsProgram)) {
        errs.customsProgram = 'Select ACE or ACI';
      } else if (
        f.customsProgram === 'ACE' &&
        !f.customsAce
      ) {
        errs.customsProgram = 'Selected port does not support ACE';
      } else if (
        f.customsProgram === 'ACI' &&
        !f.customsAci
      ) {
        errs.customsProgram = 'Selected port does not support ACI';
      }
      const expected = customsProgramForRoute(
        f.originCountry,
        f.destinationCountry,
      );
      if (
        expected &&
        f.customsProgram &&
        f.customsProgram !== expected
      ) {
        errs.customsProgram = `Use ${expected} for ${countryLabel(f.originCountry)} → ${countryLabel(f.destinationCountry)}`;
      }
    }

    const pickupMs = f.pickupTime ? new Date(f.pickupTime).getTime() : NaN;
    const etaMs = f.eta ? new Date(f.eta).getTime() : NaN;
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const minAllowedMs =
      editLoad && initialF?.pickupTime
        ? Math.min(todayMidnight.getTime(), new Date(initialF.pickupTime).getTime())
        : todayMidnight.getTime();

    if (f.pickupTime && Number.isNaN(pickupMs)) {
      errs.pickupTime = 'Invalid pickup date/time';
    } else if (Number.isFinite(pickupMs) && pickupMs < minAllowedMs) {
      errs.pickupTime = 'Pickup date cannot be in the past';
    }

    if (f.eta && Number.isNaN(etaMs)) {
      errs.eta = 'Invalid ETA';
    } else if (Number.isFinite(etaMs) && etaMs < minAllowedMs) {
      errs.eta = 'ETA cannot be in the past';
    }

    if (
      Number.isFinite(pickupMs) &&
      Number.isFinite(etaMs) &&
      etaMs < pickupMs
    ) {
      errs.eta = 'ETA must be on or after pickup';
    }

    if (!isValidTripNo(f.tripNo)) {
      errs.tripNo = 'Use letters, numbers, - _ / (max 32)';
    }

    const moneyFields: (keyof FormErrors)[] = [
      'customerRate',
      'carrierCost',
      'fuelSurcharge',
      'accessorials',
      'detentionRate',
    ];
    for (const key of moneyFields) {
      const raw = String(f[key as keyof typeof f] ?? '');
      if (parseNonNegNumber(raw) === null) {
        errs[key] = 'Enter a valid amount ≥ 0';
      }
    }
    if (parseNonNegNumber(f.detentionHours) === null) {
      errs.detentionHours = 'Enter hours ≥ 0';
    }
    if (parseNonNegNumber(f.miles) === null) {
      errs.miles = 'Enter miles ≥ 0';
    }
    if (f.notes.length > 500) {
      errs.notes = 'Notes max 500 characters';
    }
    return errs;
  };

  const stopFieldErrors = useMemo(() => {
    const out: Record<number, string> = {};
    const origin = f.origin.trim().toLowerCase();
    const dest = f.destination.trim().toLowerCase();
    const seen = new Map<string, number>();
    f.intermediateStops.forEach((stop, i) => {
      if (blank(stop)) return;
      const s = stop.trim().toLowerCase();
      if (origin && s === origin) {
        out[i] = 'Stop should differ from origin';
        return;
      }
      if (dest && s === dest) {
        out[i] = 'Stop should differ from destination';
        return;
      }
      if (seen.has(s)) {
        out[i] = 'Duplicate stop';
        return;
      }
      seen.set(s, i);
    });
    return out;
  }, [f.intermediateStops, f.origin, f.destination]);

  const formValidationErrors = validateForm();
  const isDispatchFormValid =
    Object.keys(formValidationErrors).length === 0 &&
    Object.keys(stopFieldErrors).length === 0;

  const showErr = (k: keyof FormErrors): string | undefined => {
    return touched[k] || fieldErr[k] ? formValidationErrors[k] || fieldErr[k] : undefined;
  };

  const showStopErr = (index: number): string | undefined => {
    const err = stopFieldErrors[index];
    if (!err) return undefined;
    return touched[`stop_${index}`] ? err : undefined;
  };

  const addIntermediateStop = () => {
    setF((prev) => {
      if (prev.intermediateStops.length >= MAX_INTERMEDIATE_STOPS) return prev;
      return {
        ...prev,
        intermediateStops: [...prev.intermediateStops, ''],
      };
    });
  };

  const removeIntermediateStop = (index: number) => {
    setF((prev) => ({
      ...prev,
      intermediateStops: prev.intermediateStops.filter((_, i) => i !== index),
    }));
    setTouched((prev) => {
      const next: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith('stop_')) next[k] = v;
      }
      return next;
    });
  };

  const updIntermediateStop = (index: number, value: string) => {
    setF((prev) => {
      const next = [...prev.intermediateStops];
      next[index] = value;
      return { ...prev, intermediateStops: next };
    });
  };

  const selectIntermediateStopAddress = (
    index: number,
    addr: GeoapifyAddress,
  ) => {
    const label =
      addr.formatted ||
      addr.address_line1 ||
      [addr.city, addr.state_code].filter(Boolean).join(', ');
    updIntermediateStop(index, label);
  };

  const payloadFromForm = () => {
    const truck = trucks.find((t) => t.id === f.truckId);
    const trailer = trailers.find((t) => t.id === f.trailerId);
    const broker = brokers.find((b) => b.id === f.brokerId);
    const carrier = carriers.find((c) => c.id === f.carrierId);
    const commodity = commodities.find((c) => c.id === f.commodityId);
    const stops = f.intermediateStops
      .filter((s) => !blank(s))
      .map((location, i) => ({
        seq: i + 1,
        location,
        stopType: 'stop' as const,
      }));
    const selectedDriver =
      drivers.find((d) => d.id === f.driverId) ||
      users.find((u) => u.id === f.driverId);
    return {
      driverId: selectedDriver
        ? driverRecordIdOf(selectedDriver)
        : f.driverId,
      truckId: f.truckId,
      trailerId: f.trailerId,
      brokerId: f.brokerId || undefined,
      brokerName: broker?.name || undefined,
      carrierId: f.carrierId || undefined,
      carrierName: carrier?.name || undefined,
      commodityId: f.commodityId || undefined,
      commodityName: commodity?.name || undefined,
      crossBorder: Boolean(f.crossBorder),
      portOfEntryId: f.crossBorder ? f.portOfEntryId || undefined : undefined,
      portOfEntryCode: f.crossBorder ? f.portOfEntryCode || undefined : undefined,
      portOfEntryName: f.crossBorder ? f.portOfEntryName || undefined : undefined,
      customsProgram: f.crossBorder
        ? f.customsProgram || undefined
        : undefined,
      customsAce: Boolean(f.crossBorder && f.customsAce),
      customsAci: Boolean(f.crossBorder && f.customsAci),
      customsPaps: Boolean(f.crossBorder && f.customsPaps),
      customsPars: Boolean(f.crossBorder && f.customsPars),
      originLocationId: f.originLocationId || undefined,
      destinationLocationId: f.destinationLocationId || undefined,
      origin: f.origin.trim(),
      destination: f.destination.trim(),
      pickupTime: datetimeLocalToIso(f.pickupTime),
      eta: datetimeLocalToIso(f.eta),
      tripNo: f.tripNo.trim(),
      notes: f.notes.trim(),
      truckNo: truck?.unitNo || '',
      trailerNo: trailer?.unitNo || '',
      customerRate: num(f.customerRate),
      carrierCost: num(f.carrierCost),
      fuelSurcharge: num(f.fuelSurcharge),
      accessorials: num(f.accessorials),
      detentionHours: num(f.detentionHours),
      detentionRate: num(f.detentionRate),
      miles: num(f.miles),
      stops,
    };
  };

  const loadMargin = (l) => {
    const rev =
      Number(l.customerRate || 0) +
      Number(l.fuelSurcharge || 0) +
      Number(l.accessorials || 0) +
      Number(l.detentionHours || 0) * Number(l.detentionRate || 0);
    const cost = Number(l.carrierCost || 0);
    return { rev, cost, margin: rev - cost };
  };

  const save = async () => {
    const errs = validateForm();
    setFieldErr(errs);
    const stopErrs = stopFieldErrors;
    if (Object.keys(errs).length > 0 || Object.keys(stopErrs).length > 0) {
      const allTouched: Record<string, boolean> = {};
      Object.keys(errs).forEach((k) => {
        allTouched[k] = true;
      });
      f.intermediateStops.forEach((_, i) => {
        if (stopErrs[i]) allTouched[`stop_${i}`] = true;
      });
      setTouched((prev) => ({ ...prev, ...allTouched }));
      setDocErr('Fix the highlighted fields before saving.');
      return;
    }
    if (!editLoad) {
      const missing = await assertDispatchReady(f.driverId);
      if (missing.length > 0) {
        const labels = missing
          .map(
            (id: string) =>
              DRIVER_DOC_TYPES.find((d) => d.id === id)?.label || id,
          )
          .join(', ');
        setDocErr(`Cannot dispatch — driver is missing: ${labels}`);
        return;
      }
    }
    setDocErr('');
    const body = payloadFromForm();

    try {
      setBusy(true);
      if (apiEnabled) {
        if (editLoad) {
          await loadsApi.update(editLoad.id, body);
        } else {
          await loadsApi.create({
            companyId: company.id,
            ...body,
            status: 'assigned',
            lat: 51.05 + Math.random() * 5,
            lng: -114 + Math.random() * 10,
            speed: 0,
            heading: 'E',
            lastUpdate: 'just now',
          });
          const driver =
            drivers.find((d) => d.id === body.driverId) ||
            users.find((u) => u.id === body.driverId);
          if (smsEnabled && driver?.phone) {
            try {
              await notificationsApi.sendSms({
                to: String(driver.phone),
                body: `${company.shortName || 'FleetQuix'}: new load ${body.origin} → ${body.destination}`,
                companyId: company.id,
                meta: { type: 'load_assigned', driverId: body.driverId },
              });
            } catch {
              /* SMS optional — do not block dispatch */
            }
          }
        }
        await refreshAll?.();
      } else if (editLoad) {
        setLoads((p) =>
          p.map((l) =>
            l.id === editLoad.id ? ({ ...l, ...body } as Load) : l,
          ),
        );
      } else {
        setLoads((p) => [
          ...p,
          {
            id: 'L' + uid().slice(0, 4).toUpperCase(),
            companyId: company.id,
            ...body,
            status: 'assigned' as const,
            lat: 51.05 + Math.random() * 5,
            lng: -114 + Math.random() * 10,
            speed: 0,
            heading: 'E',
            lastUpdate: 'just now',
          } as Load,
        ]);
      }
      resetForm();
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Failed to save load'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, s: LoadStatus) => {
    setStatusUpdatingId(id);
    try {
      if (apiEnabled) {
        await loadsApi.setStatus(id, s);
        if (s === 'delivered') {
          try {
            await loadsApi.update(id, {
              actualDelivery: new Date().toISOString(),
            });
          } catch {
            /* optional */
          }
        }
        await refreshAll?.();
      } else {
        setLoads((p) =>
          p.map((l) =>
            l.id === id
              ? ({
                  ...l,
                  status: s,
                  ...(s === 'delivered'
                    ? { actualDelivery: new Date().toISOString() }
                    : {}),
                } as Load)
              : l,
          ),
        );
      }
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Status update failed'), 'error');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const deleteLoad = async (id: string) => {
    const ok = await confirm({
      title: 'Delete load',
      message: 'Delete this load? This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    setDeletingId(id);
    try {
      if (apiEnabled) {
        await loadsApi.remove(id);
        await refreshAll?.();
      } else {
        setLoads((p) => p.filter((l) => l.id !== id));
      }
      notify('Load deleted.');
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Delete failed'), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const stats = [
    {
      label: 'In Transit',
      value: loads.filter((l) => l.status === 'in_transit').length,
      color: G.warning,
      subtitle: 'Currently moving',
      icon: Icons.running({ size: 20, color: G.warning }),
    },
    {
      label: 'Assigned',
      value: loads.filter((l) => l.status === 'assigned').length,
      color: G.info,
      subtitle: 'Ready to start',
      icon: Icons.assigned({ size: 20, color: G.info }),
    },
    {
      label: 'Delivered',
      value: loads.filter((l) => l.status === 'delivered').length,
      color: G.success,
      subtitle: 'Completed loads',
      icon: Icons.completed({ size: 20, color: G.success }),
    },
    {
      label: 'Cancelled',
      value: loads.filter((l) => l.status === 'cancelled').length,
      color: G.danger,
      subtitle: 'Stopped loads',
      icon: Icons.cancelled({ size: 20, color: G.danger }),
    },
  ];

  return (
    <div>
      <StatsGrid>
        {stats.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            subtitle={s.subtitle}
            accent={s.color}
            icon={s.icon}
          />
        ))}
      </StatsGrid>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: G.text }}>
            Load Board
          </div>
          <div style={{ fontSize: 11, color: G.muted, marginTop: 1 }}>
            {loads.length} total loads
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {onEManifest && (
            <Btn
              variant="ghost"
              size="sm"
              onClick={onEManifest}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {Icons.emanifest({ size: 16, color: G.muted })}
              eManifest
            </Btn>
          )}
          {can('dispatch.create') && (
          <Btn
            size="sm"
            onClick={() => {
              resetForm();
              setShow(true);
            }}
          >
            + Assign Load
          </Btn>
          )}
        </div>
      </div>

      {show && (can('dispatch.create') || can('dispatch.edit')) && (
        <Card style={{ border: `1px solid ${G.gold}33` }}>
          <SectionTitle>{editLoad ? 'Edit Load' : 'Assign New Load'}</SectionTitle>
          <Err msg={docErr} />

          <G2 cols={2}>
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <label style={labelBase()}>Driver *</label>
                <Chk
                  checked={showAllDrivers}
                  onChange={(e) => setShowAllDrivers(e.target.checked)}
                  label="Show all"
                  muted
                  style={{ marginBottom: 0 }}
                />
              </div>
              <Sel
                value={f.driverId}
                onChange={(e) => upd('driverId', e.target.value)}
                onBlur={() => markTouched('driverId')}
                error={showErr('driverId')}
                style={{ marginBottom: 0 }}
              >
                <option value="">— Select driver —</option>
                {visibleDrivers.length === 0 && !showAllDrivers && (
                  <option value="" disabled>
                    — No available drivers (check "Show all" to view all) —
                  </option>
                )}
                {visibleDrivers.map((d) => {
                  const missing = checkDriverDocs(d.id);
                  const lifecycle = d.lifecycleStatus || (d.active === false ? 'suspended' : 'active');
                  const avail = d.availabilityStatus || 'available';
                  const driverActive = lifecycleAllowsDispatch(lifecycle);
                  const availOk = availabilityAllowsDispatch(avail);
                  const onLoad = loads.find(
                    (l) =>
                      l.driverId === d.id &&
                      ['assigned', 'in_transit'].includes(l.status) &&
                      (!editLoad || l.id !== editLoad.id),
                  );
                  const isReady = missing.length === 0 && driverActive && availOk && !onLoad;
                  const statusSuffix = isReady
                    ? ' (✓ Ready)'
                    : !driverActive
                      ? ` (⚠ ${DRIVER_LIFECYCLE_LABELS[lifecycle as keyof typeof DRIVER_LIFECYCLE_LABELS] || lifecycle})`
                      : !availOk
                        ? ` (⚠ ${AVAILABILITY_LABELS[avail as keyof typeof AVAILABILITY_LABELS] || avail})`
                        : onLoad
                          ? ' (⏳ On active load)'
                          : ' (⚠ Missing docs)';
                  return (
                    <option key={d.id} value={d.id}>
                      {d.name}{statusSuffix}
                    </option>
                  );
                })}
              </Sel>
            </div>
            <div>
              <FieldInp
                label="Trip No."
                value={f.tripNo}
                onChange={(e) =>
                  upd(
                    'tripNo',
                    e.target.value.replace(/[^A-Za-z0-9\-_\/]/g, '').slice(0, 32),
                  )
                }
                onBlur={() => markTouched('tripNo')}
                placeholder="e.g. 34320"
                maxLength={32}
                error={showErr('tripNo')}
                hint="Letters, numbers, - _ /"
                style={{ marginBottom: 0 }}
              />
            </div>
          </G2>

          {(() => {
            const selectedDriver = drivers.find((d) => d.id === f.driverId);
            if (!selectedDriver) return null;
            const missing = checkDriverDocs(selectedDriver.id);
            const lifecycle = selectedDriver.lifecycleStatus || (selectedDriver.active === false ? 'suspended' : 'active');
            const avail = selectedDriver.availabilityStatus || 'available';
            const driverActive = lifecycleAllowsDispatch(lifecycle);
            const availOk = availabilityAllowsDispatch(avail);
            const canDispatch = missing.length === 0 && driverActive && availOk;
            const onLoad = loads.find(
              (l) =>
                l.driverId === selectedDriver.id &&
                ['assigned', 'in_transit'].includes(l.status) &&
                (!editLoad || l.id !== editLoad.id),
            );
            const isReady = canDispatch && !onLoad;
            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  marginBottom: 14,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: isReady ? `${G.success}15` : `${G.danger}15`,
                  border: `1px solid ${isReady ? G.success + '40' : G.danger + '40'}`,
                  fontSize: 12,
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1, marginTop: 1 }}>
                  {isReady ? '✓' : '⚠'}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      color: isReady ? G.success : G.danger,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {isReady
                      ? 'Ready for dispatch'
                      : !driverActive
                        ? `Driver is ${DRIVER_LIFECYCLE_LABELS[lifecycle as keyof typeof DRIVER_LIFECYCLE_LABELS] || lifecycle} — Cannot assign`
                        : !availOk
                          ? `Driver is ${AVAILABILITY_LABELS[avail as keyof typeof AVAILABILITY_LABELS] || avail} — Cannot assign`
                          : onLoad
                            ? `Already assigned to Trip #${onLoad.tripNo || 'Unavailable'} · ${onLoad.origin || 'Origin unavailable'} → ${onLoad.destination || 'Destination unavailable'}`
                            : `Missing required documents`}
                  </div>
                  {!isReady && missing.length > 0 && (
                    <div style={{ fontSize: 11, color: G.danger, marginTop: 2 }}>
                      Missing:{' '}
                      {missing
                        .map(
                          (id: string) =>
                            DRIVER_DOC_TYPES.find((x) => x.id === id)?.label || id,
                        )
                        .join(', ')}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>
                    {selectedDriver.name}
                    {selectedDriver.phone ? ` · ${selectedDriver.phone}` : ''}
                    {selectedDriver.licenseNo ? ` · License: ${selectedDriver.licenseNo}` : ''}
                  </div>
                </div>
              </div>
            );
          })()}
          <G2 cols={2}>
            <Sel
              label="Broker"
              value={f.brokerId}
              onChange={(e) => upd('brokerId', e.target.value)}
            >
              <option value="">— Optional —</option>
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.mc ? ` · MC ${b.mc}` : ''}
                </option>
              ))}
            </Sel>
            <Sel
              label="Subcontract carrier"
              value={f.carrierId}
              onChange={(e) => upd('carrierId', e.target.value)}
            >
              <option value="">— Own fleet / none —</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.mc ? ` · MC ${c.mc}` : ''}
                </option>
              ))}
            </Sel>
          </G2>
          <div style={{ fontSize: 11, color: G.muted, marginBottom: 8 }}>
            Brokers and subcontract carriers come from Company → Master data
            (active/watch only). Not the same as e-manifest Carrier Profile.
          </div>
          <Sel
            label="Commodity"
            value={f.commodityId}
            onChange={(e) => upd('commodityId', e.target.value)}
          >
            <option value="">— Optional —</option>
            {commodities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.hazmat ? ' · HAZMAT' : ''}
              </option>
            ))}
          </Sel>
          <G2 cols={2}>
            <Sel
              label="Cross-border"
              value={f.crossBorder ? 'yes' : 'no'}
              onChange={(e) => {
                const on = e.target.value === 'yes';
                setF((x) => {
                  const next = {
                    ...x,
                    crossBorder: on,
                    ...(on
                      ? {}
                      : {
                          portOfEntryId: '',
                          portOfEntryCode: '',
                          portOfEntryName: '',
                          customsProgram: '',
                          customsAce: false,
                          customsAci: false,
                          customsPaps: false,
                          customsPars: false,
                        }),
                  };
                  if (
                    next.originCountry &&
                    next.destinationCountry &&
                    destinationConflictsOrigin(
                      on,
                      next.originCountry,
                      next.destinationCountry,
                    )
                  ) {
                    return {
                      ...next,
                      destination: '',
                      destinationLocationId: '',
                      destinationCountry: '' as TripCountry | '',
                    };
                  }
                  return next;
                });
              }}
            >
              <option value="no">No — domestic</option>
              <option value="yes">Yes — CA↔US</option>
            </Sel>
            {f.crossBorder && (
              <div>
                <Sel
                  label="Port of entry *"
                  value={f.portOfEntryId}
                  onChange={(e) => void applyPort(e.target.value)}
                  onBlur={() => markTouched('portOfEntryId')}
                  error={showErr('portOfEntryId')}
                >
                  <option value="">— Select POE —</option>
                  {availablePorts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name} ({p.country})
                    </option>
                  ))}
                </Sel>
              </div>
            )}
          </G2>
          {f.crossBorder && (
            <>
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  marginBottom: 8,
                  fontSize: 12,
                }}
              >
                {f.customsAce && <Pill>ACE</Pill>}
                {f.customsAci && <Pill>ACI</Pill>}
                {f.customsPaps && <Pill>PAPS</Pill>}
                {f.customsPars && <Pill>PARS</Pill>}
                {portCustomsLoading && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      color: G.muted,
                    }}
                  >
                    <span
                      className="ts-btn-spinner"
                      style={{ width: 11, height: 11 }}
                    />
                    Verifying customs…
                  </span>
                )}
                {!f.portOfEntryId && !portCustomsLoading && (
                  <span style={{ color: G.muted }}>
                    Select a port to populate customs options
                  </span>
                )}
              </div>
              <div>
                <Sel
                  label="Customs program *"
                  value={f.customsProgram}
                  onChange={(e) => upd('customsProgram', e.target.value)}
                  onBlur={() => markTouched('customsProgram')}
                  error={showErr('customsProgram')}
                >
                  <option value="">— Select —</option>
                  {f.customsAce && <option value="ACE">ACE (US)</option>}
                  {f.customsAci && <option value="ACI">ACI (Canada)</option>}
                </Sel>
              </div>
            </>
          )}
          <G2 cols={2}>
            <Sel
              label="Origin from master"
              value={f.originLocationId}
              onChange={(e) => {
                const id = e.target.value;
                const loc = mdmLocations.find((x) => x.id === id);
                const originCountry = loc
                  ? normalizeTripCountry(loc.country) || 'CA'
                  : ('' as TripCountry | '');
                setF((x) => {
                  const label = loc
                    ? [loc.name, loc.city, loc.region, loc.country === 'US' ? 'United States' : loc.country === 'CA' ? 'Canada' : '']
                        .filter(Boolean)
                        .join(', ')
                    : x.origin;
                  return {
                    ...x,
                    originLocationId: id,
                    origin: label || x.origin,
                    originCountry,
                    ...clearDestinationIfNeeded(
                      { ...x, originCountry },
                      originCountry,
                    ),
                    ...clearPortIfNeeded(
                      { ...x, originCountry },
                      originCountry,
                      x.destinationCountry,
                    ),
                  };
                });
                setFieldErr((e) => {
                  const next = { ...e };
                  delete next.origin;
                  delete next.destination;
                  return next;
                });
              }}
            >
              <option value="">— Or type below —</option>
              {masterLocationsFor(originAllowed).map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {formatMasterOption(loc)}
                </option>
              ))}
            </Sel>
            <Sel
              label="Destination from master"
              value={f.destinationLocationId}
              onChange={(e) => {
                const id = e.target.value;
                const loc = mdmLocations.find((x) => x.id === id);
                const destinationCountry = loc
                  ? normalizeTripCountry(loc.country) || 'CA'
                  : ('' as TripCountry | '');
                setF((x) => {
                  const label = loc
                    ? [loc.name, loc.city, loc.region, loc.country === 'US' ? 'United States' : loc.country === 'CA' ? 'Canada' : '']
                        .filter(Boolean)
                        .join(', ')
                    : x.destination;
                  return {
                    ...x,
                    destinationLocationId: id,
                    destination: label || x.destination,
                    destinationCountry,
                    ...clearOriginIfNeeded(
                      { ...x, destinationCountry },
                      destinationCountry,
                    ),
                    ...clearPortIfNeeded(
                      { ...x, destinationCountry },
                      x.originCountry,
                      destinationCountry,
                    ),
                  };
                });
                setFieldErr((e) => {
                  const next = { ...e };
                  delete next.origin;
                  delete next.destination;
                  return next;
                });
              }}
            >
              <option value="">— Or type below —</option>
              {masterLocationsFor(destinationAllowed).map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {formatMasterOption(loc)}
                </option>
              ))}
            </Sel>
          </G2>
          {f.crossBorder && (portCountry || f.originCountry) && (
            <div style={{ fontSize: 11, color: G.muted, marginBottom: 10 }}>
              Cross-border route:{' '}
              <strong style={{ color: G.text }}>
                {portCountry
                  ? `${countryLabel(oppositeCountry(portCountry))} → ${countryLabel(portCountry)} (via ${selectedPort?.name || selectedPort?.code || 'Port of entry'})`
                  : f.originCountry
                    ? `${countryLabel(f.originCountry)} → ${countryLabel(oppositeCountry(f.originCountry as TripCountry))}`
                    : ''}
              </strong>
            </div>
          )}
          <G2 cols={2}>
            <div>
              <Sel
                label="Truck *"
                value={f.truckId}
                onChange={(e) => upd('truckId', e.target.value)}
                onBlur={() => markTouched('truckId')}
                error={showErr('truckId')}
              >
                <option value="">— Select truck —</option>
                {trucks
                  .filter((t) => canAssignAsset(t.status))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.unitNo ? `#${t.unitNo}` : 'Unnumbered truck'} · {t.year} {t.make} {t.model}
                    </option>
                  ))}
              </Sel>
            </div>
            <Sel
              label="Trailer"
              value={f.trailerId}
              onChange={(e) => upd('trailerId', e.target.value)}
            >
              <option value="">— Select trailer —</option>
              {trailers
                .filter((t) => canAssignAsset(t.status))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.unitNo ? `#${t.unitNo}` : 'Unnumbered trailer'} · {t.make} {t.model}
                  </option>
                ))}
            </Sel>
          </G2>
          <G2 cols={2}>
            <AddressAutocomplete
              label="Origin"
              required
              value={f.origin}
              allowedCountries={originAllowed}
              onChange={(v) =>
                setF((x) => ({
                  ...x,
                  origin: v,
                  originLocationId: '',
                  originCountry: '' as TripCountry | '',
                }))
              }
              onBlur={() => markTouched('origin')}
              onSelectAddress={(addr) => {
                const label = formatAddressLabel(addr);
                const originCountry =
                  normalizeTripCountry(addr.country_code) || '';
                setF((x) => ({
                  ...x,
                  origin: label,
                  originLocationId: '',
                  originCountry,
                  ...clearDestinationIfNeeded(
                    { ...x, originCountry },
                    originCountry,
                  ),
                  ...clearPortIfNeeded(
                    { ...x, originCountry },
                    originCountry,
                    x.destinationCountry,
                  ),
                }));
                setFieldErr((e) => {
                  const next = { ...e };
                  delete next.origin;
                  delete next.destination;
                  return next;
                });
              }}
              placeholder="Search city, facility, or address…"
              hint={
                f.crossBorder && portCountry
                  ? `Showing ${countryLabel(oppositeCountry(portCountry))} origins only (${portCountry === 'US' ? 'US' : 'CA'} port selected)`
                  : f.crossBorder && f.destinationCountry
                    ? `Showing ${countryLabel(oppositeCountry(f.destinationCountry as TripCountry))} origins only`
                    : f.destinationCountry && !f.crossBorder
                      ? `Showing ${countryLabel(f.destinationCountry)} only`
                      : 'Pick a suggestion so country is detected'
              }
              error={showErr('origin')}
            />
            <AddressAutocomplete
              label="Destination"
              required
              value={f.destination}
              allowedCountries={destinationAllowed}
              onChange={(v) =>
                setF((x) => ({
                  ...x,
                  destination: v,
                  destinationLocationId: '',
                  destinationCountry: '' as TripCountry | '',
                }))
              }
              onBlur={() => markTouched('destination')}
              onSelectAddress={(addr) => {
                const label = formatAddressLabel(addr);
                const destinationCountry =
                  normalizeTripCountry(addr.country_code) || '';
                setF((x) => ({
                  ...x,
                  destination: label,
                  destinationLocationId: '',
                  destinationCountry,
                  ...clearOriginIfNeeded(
                    { ...x, destinationCountry },
                    destinationCountry,
                  ),
                  ...clearPortIfNeeded(
                    { ...x, destinationCountry },
                    x.originCountry,
                    destinationCountry,
                  ),
                }));
                setFieldErr((e) => {
                  const next = { ...e };
                  delete next.origin;
                  delete next.destination;
                  return next;
                });
              }}
              placeholder="Search city, facility, or address…"
              hint={
                f.crossBorder && portCountry
                  ? `Showing ${countryLabel(portCountry)} destinations only (${portCountry === 'US' ? 'US' : 'CA'} port selected)`
                  : f.crossBorder && f.originCountry
                    ? `Showing ${countryLabel(oppositeCountry(f.originCountry as TripCountry))} only`
                    : f.originCountry && !f.crossBorder
                      ? `Showing ${countryLabel(f.originCountry)} only`
                      : f.crossBorder
                        ? 'Select origin first, or pick destination to set direction'
                        : 'Pick a suggestion so country is detected'
              }
              error={showErr('destination')}
            />
          </G2>
          <G2 cols={2}>
            <FieldInp
              label="Pickup date & time *"
              type="datetime-local"
              value={f.pickupTime}
              min={minPickupTime}
              onChange={(e) => upd('pickupTime', e.target.value)}
              onBlur={() => markTouched('pickupTime')}
              error={showErr('pickupTime')}
            />
            <FieldInp
              label="ETA"
              type="datetime-local"
              value={f.eta}
              min={minEta}
              onChange={(e) => upd('eta', e.target.value)}
              onBlur={() => markTouched('eta')}
              error={showErr('eta')}
              hint="Must be on or after pickup"
            />
          </G2>
          <SectionTitle>Economics & stops</SectionTitle>
          <G2 cols={2}>
            <FieldInp
              label="Customer rate ($)"
              inputMode="decimal"
              value={f.customerRate}
              onChange={(e) =>
                upd('customerRate', sanitizeDecimal(e.target.value, 2))
              }
              onBlur={() => markTouched('customerRate')}
              placeholder="0.00"
              error={showErr('customerRate')}
            />
            <FieldInp
              label="Carrier cost ($)"
              inputMode="decimal"
              value={f.carrierCost}
              onChange={(e) =>
                upd('carrierCost', sanitizeDecimal(e.target.value, 2))
              }
              onBlur={() => markTouched('carrierCost')}
              placeholder="0.00"
              error={showErr('carrierCost')}
            />
          </G2>
          <G2 cols={2}>
            <FieldInp
              label="Fuel surcharge ($)"
              inputMode="decimal"
              value={f.fuelSurcharge}
              onChange={(e) =>
                upd('fuelSurcharge', sanitizeDecimal(e.target.value, 2))
              }
              onBlur={() => markTouched('fuelSurcharge')}
              placeholder="0.00"
              error={showErr('fuelSurcharge')}
            />
            <FieldInp
              label="Accessorials ($)"
              inputMode="decimal"
              value={f.accessorials}
              onChange={(e) =>
                upd('accessorials', sanitizeDecimal(e.target.value, 2))
              }
              onBlur={() => markTouched('accessorials')}
              placeholder="0.00"
              error={showErr('accessorials')}
            />
          </G2>
          <G2 cols={2}>
            <FieldInp
              label="Detention hours"
              inputMode="decimal"
              value={f.detentionHours}
              onChange={(e) =>
                upd('detentionHours', sanitizeDecimal(e.target.value, 1))
              }
              onBlur={() => markTouched('detentionHours')}
              placeholder="0"
              error={showErr('detentionHours')}
            />
            <FieldInp
              label="Detention rate ($/hr)"
              inputMode="decimal"
              value={f.detentionRate}
              onChange={(e) =>
                upd('detentionRate', sanitizeDecimal(e.target.value, 2))
              }
              onBlur={() => markTouched('detentionRate')}
              placeholder="0.00"
              error={showErr('detentionRate')}
            />
          </G2>
          <FieldInp
            label="Miles"
            inputMode="numeric"
            value={f.miles}
            onChange={(e) =>
              upd('miles', sanitizeInteger(e.target.value).slice(0, 6))
            }
            onBlur={() => markTouched('miles')}
            placeholder="e.g. 1200"
            error={showErr('miles')}
          />
          <div style={{ marginTop: 4 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
                marginBottom: f.intermediateStops.length ? 10 : 0,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: G.muted,
                  letterSpacing: 0.3,
                }}
              >
                Intermediate stops (optional)
              </span>
              <Btn
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  f.intermediateStops.length >= MAX_INTERMEDIATE_STOPS
                }
                onClick={addIntermediateStop}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                + Add stop
              </Btn>
            </div>
            {f.intermediateStops.length === 0 ? (
              <div style={{ fontSize: 11, color: G.muted2, lineHeight: 1.4 }}>
                Add one or more stops between pickup and delivery.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {f.intermediateStops.map((stop, index) => (
                  <div
                    key={`stop-${index}`}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <AddressAutocomplete
                        label={`Stop ${index + 1}`}
                        value={stop}
                        onChange={(v) => updIntermediateStop(index, v)}
                        onBlur={() => markTouched(`stop_${index}`)}
                        onSelectAddress={(addr) =>
                          selectIntermediateStopAddress(index, addr)
                        }
                        placeholder="Search intermediate stop…"
                        error={showStopErr(index)}
                      />
                    </div>
                    <Btn
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Remove stop ${index + 1}`}
                      title="Remove stop"
                      onClick={() => removeIntermediateStop(index)}
                      style={{
                        marginTop: 22,
                        flexShrink: 0,
                        padding: '8px 10px',
                        lineHeight: 1,
                      }}
                    >
                      ✕
                    </Btn>
                  </div>
                ))}
              </div>
            )}
          </div>
          <FieldInp
            label="Notes"
            value={f.notes}
            onChange={(e) => upd('notes', e.target.value.slice(0, 500))}
            onBlur={() => markTouched('notes')}
            placeholder="Any special instructions…"
            maxLength={500}
            error={showErr('notes')}
            hint={`${f.notes.length}/500`}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn
              onClick={save}
              loading={busy}
              loadingLabel="Saving…"
              disabled={
                busy ||
                !isDispatchFormValid ||
                (Boolean(editLoad) &&
                  !(
                    initialF &&
                    Object.keys(initialF).some(
                      (k) => (f)[k] !== (initialF)[k],
                    )
                  ))
              }
            >
              {editLoad ? 'Save Changes' : 'Assign Load'}
            </Btn>
            <Btn variant="outline" onClick={resetForm} disabled={busy}>
              Cancel
            </Btn>
          </div>
        </Card>
      )}

      {loads.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ marginBottom: 12 }}>
            {Icons.dispatch({ size: 36, color: G.muted })}
          </div>
          <div style={{ color: G.muted }}>
            No loads yet. Click{' '}
            <strong style={{ color: G.gold }}>+ Assign Load</strong> to get
            started.
          </div>
        </Card>
      ) : (
        loads.map((l) => {
          const driver = users.find((u) => u.id === l.driverId);
          const sc = statusColor[l.status] || G.muted;
          const { rev, cost, margin } = loadMargin(l);
          const stops = Array.isArray(l.stops) ? l.stops : [];
          const money = (value: number) =>
            `$${Math.round(value).toLocaleString()}`;
          return (
            <Card key={l.id} style={{ padding: '12px 14px', marginBottom: 10 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: G.gold,
                      letterSpacing: -0.2,
                    }}
                  >
                    Trip #{l.tripNo || '—'}
                  </div>
                  <Pill color={sc}>
                    {l.status.replace('_', ' ').toUpperCase()}
                  </Pill>
                  {l.status === 'in_transit' && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '2px 8px',
                        borderRadius: RADIUS.pill,
                        background: G.successBg,
                        color: G.success,
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: G.success,
                          boxShadow: `0 0 6px ${G.success}`,
                        }}
                      />
                      LIVE
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  {l.status === 'assigned' && can('dispatch.edit') && (
                    <Btn
                      size="sm"
                      loading={statusUpdatingId === l.id}
                      loadingLabel="Starting…"
                      disabled={Boolean(statusUpdatingId) || Boolean(deletingId)}
                      onClick={() => setStatus(l.id, 'in_transit')}
                    >
                      ▶ Start
                    </Btn>
                  )}
                  {l.status === 'in_transit' && can('dispatch.close') && (
                    <Btn
                      variant="success"
                      size="sm"
                      loading={statusUpdatingId === l.id}
                      loadingLabel="Delivering…"
                      disabled={Boolean(statusUpdatingId) || Boolean(deletingId)}
                      onClick={() => setStatus(l.id, 'delivered')}
                    >
                      ✓ Deliver
                    </Btn>
                  )}
                  {!['delivered', 'cancelled'].includes(l.status) &&
                    can('dispatch.cancel') && (
                      <Btn
                        variant="danger"
                        size="sm"
                        loading={statusUpdatingId === l.id}
                        loadingLabel="Cancelling…"
                        disabled={Boolean(statusUpdatingId) || Boolean(deletingId)}
                        onClick={() => setStatus(l.id, 'cancelled')}
                      >
                        ✕ Cancel
                      </Btn>
                    )}
                  <Btn
                    variant="outline"
                    size="sm"
                    onClick={() => onTrack()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    {Icons.track({ size: 16, color: G.muted })}
                    Track
                  </Btn>
                  {!['delivered'].includes(l.status) && can('dispatch.edit') && (
                    <Btn
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(l)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      {Icons.edit({ size: 16, color: G.muted })}
                      Edit
                    </Btn>
                  )}
                  {can('dispatch.delete') && (
                    <Btn
                      variant="danger"
                      size="sm"
                      loading={deletingId === l.id}
                      disabled={Boolean(deletingId) || Boolean(statusUpdatingId)}
                      onClick={() => deleteLoad(l.id)}
                      aria-label={`Delete Trip ${l.tripNo || ''}`}
                      title="Delete load"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {Icons.trash({ size: 16, color: G.danger })}
                    </Btn>
                  )}
                </div>
              </div>

              <details style={{ marginTop: 4, fontSize: 10, color: G.muted }}>
                <summary style={{ cursor: 'pointer', color: G.muted2, listStylePosition: 'inside' }}>
                  Technical details
                </summary>
                <div
                  title={l.id}
                  style={{
                    marginTop: 4,
                    fontFamily: FONT_MONO,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Load ID · {l.id}
                </div>
              </details>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginTop: 8,
                  fontSize: 11,
                  color: G.muted2,
                  lineHeight: 1.4,
                }}
              >
                {l.pickupTime && (
                  <span>
                    <strong style={{ color: G.muted, fontWeight: 700 }}>Pickup</strong>{' '}
                    <span style={{ color: G.text }}>
                      {formatDisplayDateTime(l.pickupTime)}
                    </span>
                  </span>
                )}
                {l.eta && (
                  <span>
                    <strong style={{ color: G.gold, fontWeight: 700 }}>ETA</strong>{' '}
                    <span style={{ color: G.text }}>
                      {formatDisplayDateTime(l.eta)}
                    </span>
                  </span>
                )}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontWeight: 600,
                    color: G.text,
                  }}
                >
                  {Icons.driver({ size: 13, color: G.gold })}
                  {driver?.name || 'Unknown driver'}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {Icons.truck({ size: 13, color: G.muted })}
                  {l.truckNo ? `#${l.truckNo}` : 'No truck'}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {Icons.trailer({ size: 13, color: G.muted })}
                  {l.trailerNo ? `#${l.trailerNo}` : 'No trailer'}
                </span>
              </div>

              <RouteFromTo
                compact
                origin={l.origin}
                destination={l.destination}
                style={{ marginTop: 8 }}
              />

              {l.notes && (
                <div
                  style={{
                    fontSize: 11,
                    color: G.muted,
                    marginTop: 8,
                    fontStyle: 'italic',
                    lineHeight: 1.4,
                  }}
                >
                  {l.notes}
                </div>
              )}

              {(rev !== 0 || cost !== 0) && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(105px, 1fr))',
                    gap: 7,
                    marginTop: 10,
                  }}
                >
                  {[
                    { label: 'Revenue', value: money(rev), color: G.text },
                    { label: 'Cost', value: money(cost), color: G.text },
                    {
                      label: 'Margin',
                      value: money(margin),
                      color: margin >= 0 ? G.success : G.danger,
                    },
                    {
                      label: 'Miles',
                      value: l.miles ? `${l.miles}` : '—',
                      color: G.text,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        minWidth: 0,
                        padding: '7px 10px',
                        border: `1px solid ${G.border}`,
                        borderRadius: RADIUS.md,
                        background: G.card2,
                      }}
                    >
                      <div
                        style={{
                          color: G.muted,
                          fontSize: 9,
                          fontWeight: 600,
                          letterSpacing: 0.4,
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.label}
                      </div>
                      <div
                        style={{
                          marginTop: 2,
                          color: item.color,
                          fontSize: 13,
                          fontWeight: 600,
                          lineHeight: 1.25,
                        }}
                      >
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {stops.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    color: G.muted,
                    fontSize: 10,
                    lineHeight: 1.4,
                  }}
                >
                  Stops: {stops.map((s) => s.location || s).join(' → ')}
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
