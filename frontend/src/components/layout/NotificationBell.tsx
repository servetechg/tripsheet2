import { Icons } from '@/components/ui';
import { G, RADIUS } from '@/lib/theme';

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
        width: 38,
        height: 38,
        borderRadius: RADIUS.md,
        border: `1px solid ${G.border}`,
        background: G.card2,
        color: G.muted2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        fontFamily: 'inherit',
        transition: 'border-color .15s ease, color .15s ease',
      }}
    >
      {Icons.bell({ size: 18 })}
      {hasUnread && (
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 9,
            width: 7,
            height: 7,
            borderRadius: 99,
            background: G.danger,
            border: `2px solid ${G.card2}`,
          }}
        />
      )}
    </button>
  );
}
