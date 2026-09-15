import { useRef, useState } from 'react';
import { G, RADIUS } from '@/lib/theme';
import { Icons } from './Icons';

export type UploadedFile = {
  name: string;
  size: number;
  fileType: string;
  data: string;
};

type FileUploadFieldProps = {
  label: string;
  accept?: string;
  hint?: string;
  maxBytes?: number;
  value?: UploadedFile | null;
  previewUrl?: string | null;
  onChange: (file: UploadedFile | null) => void;
};

const DEFAULT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.svg';
const DEFAULT_MAX = 2 * 1024 * 1024;

export function FileUploadField({
  label,
  accept = DEFAULT_ACCEPT,
  hint = 'PDF, JPG, PNG, WEBP, SVG · Max 2MB',
  maxBytes = DEFAULT_MAX,
  value,
  previewUrl,
  onChange,
}: FileUploadFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [err, setErr] = useState('');

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > maxBytes) {
      setErr(`File too large. Max ${Math.round(maxBytes / (1024 * 1024))}MB.`);
      return;
    }
    setErr('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (typeof data !== 'string') return;
      onChange({
        name: file.name,
        size: file.size,
        fileType: file.type,
        data,
      });
    };
    reader.readAsDataURL(file);
  };

  const preview = value?.data || previewUrl || '';
  const isImage =
    preview.startsWith('data:image/') ||
    /\.(png|jpe?g|webp|svg)(\?|$)/i.test(preview);

  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: G.muted,
          marginBottom: 6,
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        style={{
          border: `2px dashed ${dragging ? G.gold : value ? G.success : G.border}`,
          borderRadius: RADIUS.lg,
          padding: '16px 12px',
          textAlign: 'center',
          background: dragging ? G.goldBg : value ? G.successBg : G.inset,
          minHeight: 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {preview && isImage ? (
          <img
            src={preview}
            alt="Preview"
            style={{ maxWidth: '100%', maxHeight: 100, borderRadius: 8, objectFit: 'contain' }}
          />
        ) : value ? (
          Icons.docs({ size: 36, color: G.muted })
        ) : (
          Icons.upload({ size: 32, color: G.muted })
        )}
        {value ? (
          <>
            <div style={{ fontSize: 12, color: G.success, fontWeight: 700 }}>
              {value.name}
            </div>
            <div style={{ fontSize: 11, color: G.muted }}>
              {(value.size / 1024).toFixed(1)} KB
            </div>
          </>
        ) : preview && !isImage ? (
          <div style={{ fontSize: 12, color: G.muted }}>Current file attached</div>
        ) : (
          <div style={{ fontSize: 12, color: G.muted }}>Drag & drop or browse</div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              background: G.gold,
              color: G.onGold,
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {Icons.upload({ size: 14, color: G.onGold })}
            Browse
          </button>
          {(value || preview) && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setErr('');
              }}
              style={{
                background: 'transparent',
                border: `1px solid ${G.border}`,
                color: G.muted,
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>
        <div style={{ fontSize: 10, color: G.muted }}>{hint}</div>
      </div>
      {err ? (
        <div style={{ color: G.danger, fontSize: 12, marginTop: 6 }}>{err}</div>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
