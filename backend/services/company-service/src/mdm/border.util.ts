/**
 * Chapter 5 MDM Phase 5 — CA–US border / Port of Entry seed + customs helpers.
 */

export type CustomsProgram = 'ACE' | 'ACI';

export type PortSeed = {
  code: string;
  name: string;
  country: 'CA' | 'US';
  borderCrossing: string;
  fastLane?: boolean;
  ace: boolean;
  aci: boolean;
  paps: boolean;
  pars: boolean;
  restrictions?: string;
};

/** Client-aligned CA–US port set (from prior FE constants + customs flags). */
export const DEFAULT_PORTS: PortSeed[] = [
  // Canada (ACI / PARS inbound to Canada)
  {
    code: '0407',
    name: 'Coutts, AB',
    country: 'CA',
    borderCrossing: 'Coutts–Sweetgrass',
    ace: false,
    aci: true,
    paps: false,
    pars: true,
    fastLane: true,
  },
  {
    code: '0409',
    name: 'Sweetgrass, MT/Coutts',
    country: 'CA',
    borderCrossing: 'Coutts–Sweetgrass',
    ace: false,
    aci: true,
    paps: false,
    pars: true,
  },
  {
    code: '0411',
    name: 'Carway, AB',
    country: 'CA',
    borderCrossing: 'Carway',
    ace: false,
    aci: true,
    paps: false,
    pars: true,
  },
  {
    code: '0431',
    name: 'North Portal, SK',
    country: 'CA',
    borderCrossing: 'North Portal–Portal',
    ace: false,
    aci: true,
    paps: false,
    pars: true,
  },
  {
    code: '0453',
    name: 'Emerson, MB',
    country: 'CA',
    borderCrossing: 'Emerson–Pembina',
    ace: false,
    aci: true,
    paps: false,
    pars: true,
  },
  {
    code: '0474',
    name: 'Windsor, ON',
    country: 'CA',
    borderCrossing: 'Windsor–Detroit',
    ace: false,
    aci: true,
    paps: false,
    pars: true,
    fastLane: true,
  },
  {
    code: '0476',
    name: 'Sarnia, ON',
    country: 'CA',
    borderCrossing: 'Sarnia–Port Huron',
    ace: false,
    aci: true,
    paps: false,
    pars: true,
  },
  {
    code: '0489',
    name: 'Fort Erie, ON',
    country: 'CA',
    borderCrossing: 'Fort Erie–Buffalo',
    ace: false,
    aci: true,
    paps: false,
    pars: true,
  },
  {
    code: '0493',
    name: 'Queenston, ON',
    country: 'CA',
    borderCrossing: 'Queenston–Lewiston',
    ace: false,
    aci: true,
    paps: false,
    pars: true,
  },
  {
    code: '0498',
    name: 'Cornwall, ON',
    country: 'CA',
    borderCrossing: 'Cornwall',
    ace: false,
    aci: true,
    paps: false,
    pars: true,
  },
  {
    code: '0610',
    name: 'Lacolle, QC',
    country: 'CA',
    borderCrossing: 'Lacolle–Champlain',
    ace: false,
    aci: true,
    paps: false,
    pars: true,
  },
  {
    code: '0615',
    name: 'St-Bernard-de-Lacolle',
    country: 'CA',
    borderCrossing: 'Lacolle–Champlain',
    ace: false,
    aci: true,
    paps: false,
    pars: true,
  },
  {
    code: '0708',
    name: 'Pacific Hwy, BC',
    country: 'CA',
    borderCrossing: 'Pacific Highway–Blaine',
    ace: false,
    aci: true,
    paps: false,
    pars: true,
    fastLane: true,
  },
  {
    code: '0711',
    name: 'Huntingdon, BC',
    country: 'CA',
    borderCrossing: 'Huntingdon–Sumas',
    ace: false,
    aci: true,
    paps: false,
    pars: true,
  },
  // United States (ACE / PAPS inbound to US)
  {
    code: '3401',
    name: 'Blaine, WA',
    country: 'US',
    borderCrossing: 'Pacific Highway–Blaine',
    ace: true,
    aci: false,
    paps: true,
    pars: false,
    fastLane: true,
  },
  {
    code: '3404',
    name: 'Sumas, WA',
    country: 'US',
    borderCrossing: 'Huntingdon–Sumas',
    ace: true,
    aci: false,
    paps: true,
    pars: false,
  },
  {
    code: '3505',
    name: 'Sweetgrass, MT',
    country: 'US',
    borderCrossing: 'Coutts–Sweetgrass',
    ace: true,
    aci: false,
    paps: true,
    pars: false,
    fastLane: true,
  },
  {
    code: '3301',
    name: 'Portal, ND',
    country: 'US',
    borderCrossing: 'North Portal–Portal',
    ace: true,
    aci: false,
    paps: true,
    pars: false,
  },
  {
    code: '3601',
    name: 'Pembina, ND',
    country: 'US',
    borderCrossing: 'Emerson–Pembina',
    ace: true,
    aci: false,
    paps: true,
    pars: false,
  },
  {
    code: '3801',
    name: 'Noyes, MN',
    country: 'US',
    borderCrossing: 'Emerson–Noyes',
    ace: true,
    aci: false,
    paps: true,
    pars: false,
  },
  {
    code: '3901',
    name: 'Port Huron, MI',
    country: 'US',
    borderCrossing: 'Sarnia–Port Huron',
    ace: true,
    aci: false,
    paps: true,
    pars: false,
  },
  {
    code: '3902',
    name: 'Detroit, MI',
    country: 'US',
    borderCrossing: 'Windsor–Detroit',
    ace: true,
    aci: false,
    paps: true,
    pars: false,
    fastLane: true,
  },
  {
    code: '0901',
    name: 'Buffalo, NY',
    country: 'US',
    borderCrossing: 'Fort Erie–Buffalo',
    ace: true,
    aci: false,
    paps: true,
    pars: false,
  },
  {
    code: '0712',
    name: 'Champlain, NY',
    country: 'US',
    borderCrossing: 'Lacolle–Champlain',
    ace: true,
    aci: false,
    paps: true,
    pars: false,
  },
  {
    code: '2304',
    name: 'Laredo, TX',
    country: 'US',
    borderCrossing: 'Laredo',
    ace: true,
    aci: false,
    paps: true,
    pars: false,
    restrictions: 'US–MX corridor; CA–US ops rarely use',
  },
  {
    code: '2506',
    name: 'Otay Mesa, CA',
    country: 'US',
    borderCrossing: 'Otay Mesa',
    ace: true,
    aci: false,
    paps: true,
    pars: false,
    restrictions: 'US–MX corridor; CA–US ops rarely use',
  },
];

export function uniqueBorderCrossingNames(
  ports: PortSeed[] = DEFAULT_PORTS,
): string[] {
  return [...new Set(ports.map((p) => p.borderCrossing))].sort();
}

export function defaultProgramForPort(port: {
  ace?: boolean;
  aci?: boolean;
  country?: string;
}): CustomsProgram | null {
  if (port.ace) return 'ACE';
  if (port.aci) return 'ACI';
  if (String(port.country || '').toUpperCase() === 'US') return 'ACE';
  if (String(port.country || '').toUpperCase() === 'CA') return 'ACI';
  return null;
}

export function customsFlagsFromPort(port: {
  ace?: boolean;
  aci?: boolean;
  paps?: boolean;
  pars?: boolean;
}): {
  customsAce: boolean;
  customsAci: boolean;
  customsPaps: boolean;
  customsPars: boolean;
} {
  return {
    customsAce: Boolean(port.ace),
    customsAci: Boolean(port.aci),
    customsPaps: Boolean(port.paps),
    customsPars: Boolean(port.pars),
  };
}

export function programSupportedByPort(
  program: string | null | undefined,
  port: { ace?: boolean; aci?: boolean },
): boolean {
  const p = String(program || '').toUpperCase();
  if (p === 'ACE') return Boolean(port.ace);
  if (p === 'ACI') return Boolean(port.aci);
  return false;
}

/** Required shipment / filing types implied by POE capabilities. */
export function shipmentTypesForPort(port: {
  paps?: boolean;
  pars?: boolean;
  ace?: boolean;
  aci?: boolean;
}): string[] {
  const types: string[] = [];
  if (port.pars || port.aci) types.push('PARS');
  if (port.paps || port.ace) types.push('PAPS');
  types.push('In-Bond');
  return types;
}

/**
 * Cross-border dispatch gate (acceptance #3).
 * Returns error messages; empty = ok.
 */
export function validateCrossBorderDispatch(input: {
  crossBorder: boolean;
  portOfEntryId?: string | null;
  customsProgram?: string | null;
  port?: {
    ace?: boolean;
    aci?: boolean;
    paps?: boolean;
    pars?: boolean;
    status?: string;
  } | null;
}): string[] {
  const errors: string[] = [];
  if (!input.crossBorder) return errors;
  if (!input.portOfEntryId) {
    errors.push('Port of entry is required for cross-border dispatch');
  }
  if (!input.port) {
    if (input.portOfEntryId) {
      errors.push('Selected port of entry was not found or is inactive');
    }
    return errors;
  }
  const status = String(input.port.status || 'active').toLowerCase();
  if (status !== 'active') {
    errors.push('Port of entry must be active for new cross-border work');
  }
  const program = String(input.customsProgram || '').toUpperCase();
  if (!program) {
    errors.push('Customs program (ACE or ACI) is required for cross-border dispatch');
  } else if (!programSupportedByPort(program, input.port)) {
    errors.push(
      `Customs program ${program} is not supported at the selected port of entry`,
    );
  } else if (program === 'ACE' && !input.port.paps && !input.port.ace) {
    errors.push('Selected port does not support ACE/PAPS filing options');
  } else if (program === 'ACI' && !input.port.pars && !input.port.aci) {
    errors.push('Selected port does not support ACI/PARS filing options');
  }
  return errors;
}
