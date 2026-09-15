import { G, RADIUS } from '@/lib/theme';
import { Btn, Icons } from '@/components/ui';
import {
  fileLabel,
  formatFileSize,
  isImageUrl,
  isPdfUrl,
} from '@/lib/filePreview';

type VaultFileRowProps = {
  name: string;
  type?: string;
  fileName?: string | null;
  fileUrl?: string | null;
  fileSize?: number | null;
  meta?: string | null;
  onDelete?: () => void;
};

export function VaultFileRow({
  name,
  type,
  fileName,
  fileUrl,
  fileSize,
  meta,
  onDelete,
}: VaultFileRowProps) {
  const label = fileLabel(fileName, fileUrl);
  const image = isImageUrl(fileUrl);
  const pdf = isPdfUrl(fileUrl, fileName || label);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 14px',
        border: `1px solid ${G.border}`,
        borderRadius: RADIUS.lg,
        background: G.card,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: RADIUS.md,
          border: `1px solid ${G.border}`,
          background: G.inset,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {image && fileUrl ? (
          <img
            src={fileUrl}
            alt={label}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : pdf ? (
          Icons.docs({ size: 28, color: G.danger })
        ) : (
          Icons.docs({ size: 28, color: G.muted })
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 14,
            color: G.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>
          {[type, label, formatFileSize(fileSize)].filter(Boolean).join(' · ')}
        </div>
        {meta ? (
          <div style={{ fontSize: 11, color: G.muted, marginTop: 2 }}>{meta}</div>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {fileUrl ? (
          <Btn
            size="sm"
            variant="outline"
            onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')}
          >
            View
          </Btn>
        ) : null}
        {onDelete ? (
          <Btn size="sm" variant="danger" onClick={onDelete}>
            Delete
          </Btn>
        ) : null}
      </div>
    </div>
  );
}
