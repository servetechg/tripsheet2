import type { ManifestStatus } from '@tripsheet/shared';

export const EM_STATUS: Record<ManifestStatus, { label: string; color: string }> = {
  draft: { label: 'DRAFT', color: '#666' },
  submitted: { label: 'SUBMITTED', color: '#3b82f6' },
  accepted: { label: 'ACCEPTED', color: '#2f9e58' },
  rejected: { label: 'REJECTED', color: '#e53e3e' },
  cancelled: { label: 'CANCELLED', color: '#888' },
};

export const CA_PORTS = [
  { code: '0407', name: 'Coutts, AB' },
  { code: '0409', name: 'Sweetgrass, MT/Coutts' },
  { code: '0411', name: 'Carway, AB' },
  { code: '0431', name: 'North Portal, SK' },
  { code: '0453', name: 'Emerson, MB' },
  { code: '0474', name: 'Windsor, ON' },
  { code: '0476', name: 'Sarnia, ON' },
  { code: '0489', name: 'Fort Erie, ON' },
  { code: '0493', name: 'Queenston, ON' },
  { code: '0498', name: 'Cornwall, ON' },
  { code: '0610', name: 'Lacolle, QC' },
  { code: '0615', name: 'St-Bernard-de-Lacolle' },
  { code: '0708', name: 'Pacific Hwy, BC' },
  { code: '0711', name: 'Huntingdon, BC' },
];

export const US_PORTS = [
  { code: '3401', name: 'Blaine, WA' },
  { code: '3404', name: 'Sumas, WA' },
  { code: '3505', name: 'Sweetgrass, MT' },
  { code: '3301', name: 'Portal, ND' },
  { code: '3601', name: 'Pembina, ND' },
  { code: '3801', name: 'Noyes, MN' },
  { code: '3901', name: 'Port Huron, MI' },
  { code: '3902', name: 'Detroit, MI' },
  { code: '0901', name: 'Buffalo, NY' },
  { code: '0712', name: 'Champlain, NY' },
  { code: '2304', name: 'Laredo, TX' },
  { code: '2506', name: 'Otay Mesa, CA' },
];
