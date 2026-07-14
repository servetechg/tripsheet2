/**
 * Extract large feature components from App.jsx with : any props.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', 'src');
const lines = fs.readFileSync(path.join(src, 'App.jsx'), 'utf8').split(/\r?\n/);

function slice(a, b) {
  return lines.slice(a - 1, b).join('\n');
}
function write(rel, content) {
  const full = path.join(src, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/\r\n/g, '\n').replace(/\n+$/, '') + '\n');
  console.log('✓', rel);
}

/** Convert `function Name(props) {` → `export function Name(props: any) {` */
function exportFn(code) {
  return code
    .replace(/^function (\w+)\((.*)\) \{/m, (_, name, params) => {
      // already typed?
      if (params.includes(':')) return `export function ${name}(${params}) {`;
      return `export function ${name}(${params}: any) {`;
    })
    .replace(/^const (\w+) = \((.*)\) =>/m, (_, name, params) => {
      if (params.includes(':')) return `export const ${name} = (${params}) =>`;
      return `export const ${name} = (${params}: any) =>`;
    });
}

function feature(rel, imports, start, end, extra = '') {
  let code = exportFn(slice(start, end));
  // Common replacements for hooks/imports that were module-local
  code = code
    .replace(/\buseW\b/g, 'useMediaQuery')
    .replace(/\bReact\.Fragment\b/g, 'Fragment');
  write(rel, `${imports}\n${extra}\n${code}\n`);
}

const ui = `import { Btn, Card, Inp, Sel, Pill, Divider, SectionTitle, Skeleton, G2 } from '@/components/ui';`;
const theme = `import { G, SPACE, RADIUS, FONT_UI, FONT_MONO, page, pagePlain, pageCentered } from '@/lib/theme';`;
const hooks = `import { useState, useRef, useEffect, Fragment } from 'react';`;
const fmt = `import { blank } from '@/lib/format';\nimport { uid } from '@/lib/uid';`;
const notify = `import { notify } from '@/components/feedback/Toast';`;
const err = `import { Err } from '@/components/feedback/Err';\nimport { ErrBox } from '@/components/feedback/ErrBox';\nimport { OkBox } from '@/components/feedback/OkBox';`;
const media = `import { useMediaQuery } from '@/hooks/useMediaQuery';`;
const fake = `import { useFakeLoad } from '@/hooks/useFakeLoad';`;
const docs = `import { DRIVER_DOC_TYPES, PAY_TYPES, DISPATCH_REQUIRED_DOCS, DOC_STATUS_COLOR } from '@/lib/docTypes';`;
const em = `import { EM_STATUS, CA_PORTS, US_PORTS } from '@/features/manifests/constants';`;

// Layout
feature(
  'components/layout/BottomNav.tsx',
  `${hooks}\n${theme}`,
  295,
  307,
);
feature(
  'components/layout/SideNav.tsx',
  `${hooks}\n${theme}`,
  310,
  327,
);
feature(
  'components/layout/ThemeToggle.tsx',
  `${hooks}\n${theme}`,
  359,
  371,
);
feature(
  'components/layout/AppShell.tsx',
  `${hooks}\n${theme}\n${media}\nimport { BottomNav } from './BottomNav';\nimport { SideNav } from './SideNav';\nimport { ThemeToggle } from './ThemeToggle';`,
  330,
  355,
);

// Auth
feature(
  'features/auth/LoginScreen.tsx',
  `${hooks}\n${theme}\n${ui}\n${err}\nimport { ThemeToggle } from '@/components/layout/ThemeToggle';`,
  375,
  431,
);

// Companies
feature(
  'features/companies/SuperAdminPanel.tsx',
  `${hooks}\n${theme}\n${ui}\n${err}\n${fmt}\nimport { AppShell } from '@/components/layout/AppShell';`,
  433,
  568,
);

write(
  'types/app.ts',
  `/** Loose app-domain types for complex nested entities not fully modeled in shared. */
export type AnyRecord = Record<string, any>;
export type Setter<T> = React.Dispatch<React.SetStateAction<T>>;
`
);

// Admin panel
feature(
  'features/admin/CompanyAdminPanel.tsx',
  `${hooks}\n${theme}\n${ui}\n${fake}\nimport { AppShell } from '@/components/layout/AppShell';
import { DispatchTab } from '@/features/dispatch/DispatchTab';
import { TrackTab } from '@/features/tracking/TrackTab';
import { EManifestTab } from '@/features/manifests/EManifestTab';
import { DriversTab } from '@/features/drivers/DriversTab';
import { AssetsTab } from '@/features/assets/AssetsTab';
import { AdminSheetsTab } from '@/features/trip-sheets/AdminSheetsTab';
import { PrintPreview } from '@/features/trip-sheets/PrintPreview';`,
  570,
  629,
);

// Manifests
feature(
  'features/manifests/EManifestTab.tsx',
  `${hooks}\n${theme}\n${ui}\n${fmt}\n${notify}\nimport { CarrierProfileForm } from './CarrierProfileForm';
import { EManifestForm } from './EManifestForm';
import { EManifestCard } from './EManifestCard';
import { LeadSheet } from './LeadSheet';`,
  633,
  781,
);

feature(
  'features/manifests/CarrierProfileForm.tsx',
  `${hooks}\n${theme}\n${ui}`,
  784,
  811,
);

feature(
  'features/manifests/EManifestForm.tsx',
  `${hooks}\n${theme}\n${ui}\n${fmt}\n${em}`,
  814,
  1072,
);

feature(
  'features/manifests/EManifestCard.tsx',
  `${hooks}\n${theme}\n${ui}\n${em}`,
  1075,
  1176,
);

feature(
  'features/manifests/LeadSheet.tsx',
  `${hooks}\n${theme}\n${ui}\n${em}`,
  1179,
  1320,
);

// Dispatch
feature(
  'features/dispatch/DispatchTab.tsx',
  `${hooks}\n${theme}\n${ui}\n${fmt}\n${err}\n${notify}\n${docs}`,
  1323,
  1504,
);

// Tracking
feature(
  'features/tracking/TrackTab.tsx',
  `${hooks}\n${theme}\n${ui}\n${media}\nimport { MapView } from './MapView';`,
  1507,
  1561,
);

feature(
  'features/tracking/MapView.tsx',
  `${hooks}\n${theme}`,
  2613,
  2674,
);

// Drivers — skip local DRIVER_DOC_TYPES const (1565-1580), start at DriversTab
feature(
  'features/drivers/DriversTab.tsx',
  `${hooks}\n${theme}\n${ui}\n${fmt}\n${err}\n${notify}\n${docs}\nimport { DriverProfile } from './DriverProfile';`,
  1582,
  1782,
);

feature(
  'features/drivers/DriverProfile.tsx',
  `${hooks}\n${theme}\n${ui}\n${fmt}\n${docs}\nimport { DocUploadModal } from '@/features/documents/DocUploadModal';
import { DocViewer } from '@/features/documents/DocViewer';
import { AdminWageModal } from '@/features/contracts/AdminWageModal';`,
  1785,
  2038,
);

feature(
  'features/drivers/DriverDashboard.tsx',
  `${hooks}\n${theme}\n${ui}\n${fake}\n${fmt}\n${notify}\n${docs}\nimport { AppShell } from '@/components/layout/AppShell';
import { TripSheetForm } from '@/features/trip-sheets/TripSheetForm';
import { PrintPreview } from '@/features/trip-sheets/PrintPreview';
import { DocUploadModal } from '@/features/documents/DocUploadModal';
import { DocViewer } from '@/features/documents/DocViewer';`,
  2677,
  2877,
);

// Documents
feature(
  'features/documents/DocUploadModal.tsx',
  `${hooks}\n${theme}\n${ui}`,
  2041,
  2124,
);

feature(
  'features/documents/DocViewer.tsx',
  `${hooks}\n${theme}`,
  2127,
  2155,
);

// Contracts — skip PAY_TYPES local const
feature(
  'features/contracts/AdminWageModal.tsx',
  `${hooks}\n${theme}\n${ui}\n${fmt}\n${docs}`,
  2160,
  2284,
);

feature(
  'features/contracts/EmploymentContractModal.tsx',
  `${hooks}\n${theme}\n${ui}\n${fmt}\n${docs}`,
  2295,
  2474,
);

// Assets
feature(
  'features/assets/AssetsTab.tsx',
  `${hooks}\n${theme}\n${ui}\n${fmt}\n${err}`,
  2477,
  2558,
);

// Trip sheets
feature(
  'features/trip-sheets/AdminSheetsTab.tsx',
  `${hooks}\n${theme}\n${ui}`,
  2561,
  2610,
);

// TripSheetForm includes emptyTrip/emptyExp helpers (2880-2881)
write(
  'features/trip-sheets/TripSheetForm.tsx',
  `${hooks}
${theme}
${ui}
${fmt}
import { PrintPreview } from './PrintPreview';

const emptyTrip = () => ({ id: uid(), tripNo: '', trailerNo: '', pickupDate: '', dropDate: '', from: '', to: '', notes: '' });
const emptyExp = () => ({ id: uid(), category: 'Fuel', description: '', receiptNo: '', amount: '', currency: 'CAD' });

${exportFn(slice(2883, 2984))}
`,
);

feature(
  'features/trip-sheets/PrintPreview.tsx',
  `${hooks}\n${theme}\n${ui}`,
  2987,
  3246,
);

// Invites
feature(
  'features/invites/DriverOnboarding.tsx',
  `${hooks}\n${theme}\n${ui}\n${fmt}\n${docs}\nimport { DocUploadModal } from '@/features/documents/DocUploadModal';`,
  3369,
  3672,
);

console.log('All feature files extracted');
