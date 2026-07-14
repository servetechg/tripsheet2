import { G, pageCentered } from '@/lib/theme';
import { Btn } from '@/components/ui';

/** Prefer Cloudinary URL; fall back to legacy inline fileData. */
function docSrc(doc: { fileUrl?: string; fileData?: string }) {
  return doc.fileUrl || doc.fileData || '';
}

export function DocViewer({ doc, onClose }: any) {
  const src = docSrc(doc);
  const isImage = doc.fileType?.startsWith('image/');
  const isPDF = doc.fileType === 'application/pdf';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: G.overlay,
        zIndex: 600,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          background: G.card,
          borderBottom: `1px solid ${G.border}`,
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>
            {doc.fileName}
          </div>
          <div style={{ fontSize: 11, color: G.muted }}>
            Uploaded: {doc.uploadedAt}
            {doc.expiryDate ? ` · Expires: ${doc.expiryDate}` : ''}
            {doc.fileUrl ? ' · Cloudinary' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {src && (
            <a
              href={src}
              download={doc.fileName}
              target="_blank"
              rel="noreferrer"
              style={{
                background: G.gold,
                color: G.onGold,
                borderRadius: 7,
                padding: '8px 16px',
                fontSize: 11,
                fontWeight: 800,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ⬇️ DOWNLOAD
            </a>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: `1px solid ${G.border}`,
              color: G.muted,
              borderRadius: 7,
              padding: '8px 14px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          background: G.card2,
        }}
      >
        {!src && (
          <div style={{ ...pageCentered(), color: G.muted, minHeight: 200 }}>
            No file available
          </div>
        )}
        {src && isImage && (
          <img
            src={src}
            alt={doc.fileName}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              borderRadius: 8,
              objectFit: 'contain',
            }}
          />
        )}
        {src && isPDF && (
          <iframe
            src={src}
            title={doc.fileName}
            style={{ width: '100%', height: '100%', border: 'none', minHeight: 500 }}
          />
        )}
        {src && !isImage && !isPDF && (
          <div style={{ textAlign: 'center', color: G.muted }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📄</div>
            <div style={{ fontSize: 14, marginBottom: 12 }}>{doc.fileName}</div>
            <a
              href={src}
              download={doc.fileName}
              target="_blank"
              rel="noreferrer"
              style={{
                background: G.gold,
                color: G.onGold,
                borderRadius: 8,
                padding: '10px 24px',
                fontSize: 13,
                fontWeight: 800,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              ⬇️ Download to View
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
