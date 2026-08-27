import { G, RADIUS } from '@/lib/theme';
import { useAppData } from '@/context/AppDataContext';

export function ServiceHealthBanner() {
  const { servicesDown } = useAppData();
  if (!servicesDown.length) return null;
  return (
    <div
      style={{
        background: G.warningBg,
        border: `1px solid ${G.warning}55`,
        borderRadius: RADIUS.lg,
        padding: '12px 14px',
        marginBottom: 16,
        fontSize: 13,
        color: G.text,
        lineHeight: 1.45,
      }}
    >
      <strong>Some backend services are offline:</strong>{' '}
      {servicesDown.join(', ')}. Run{' '}
      <code style={{ fontSize: 12 }}>npm run start:dev</code> in the{' '}
      <code style={{ fontSize: 12 }}>backend</code> folder to start all services.
      Features that depend on offline services may not load until then.
    </div>
  );
}
