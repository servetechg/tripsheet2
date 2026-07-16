import { Icons } from '@/components/ui';
import { G } from '@/lib/theme';

type NotificationBellProps = {
  hasUnread?: boolean;
  onClick?: () => void;
};

export function NotificationBell({
  hasUnread = true,
  onClick,
}: NotificationBellProps) {
  return (
    <button
      type="button"
      className="ts-icon-btn"
      aria-label="Notifications"
      onClick={onClick}
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        border: `1px solid ${G.border}`,
        background: G.card,
        color: G.muted2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        boxShadow: G.shadow,
        fontFamily: 'inherit',
      }}
    >
      {Icons.bell({ size: 18 })}
      {hasUnread && (
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 9,
            width: 8,
            height: 8,
            borderRadius: 99,
            background: G.danger,
            border: `2px solid ${G.card}`,
          }}
        />
      )}
    </button>
  );
}
