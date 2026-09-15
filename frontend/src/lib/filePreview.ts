export function isImageUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url);
}

export function isPdfUrl(url?: string | null, fileName?: string | null): boolean {
  if (url?.startsWith('data:application/pdf')) return true;
  const name = fileName || url || '';
  return /\.pdf(\?|$)/i.test(name);
}

export function formatFileSize(bytes?: number | null): string {
  if (bytes == null || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileLabel(name?: string | null, url?: string | null): string {
  if (name?.trim()) return name.trim();
  if (!url) return 'File';
  if (url.startsWith('data:')) {
    const mime = url.slice(5, url.indexOf(';'));
    if (mime.includes('pdf')) return 'PDF document';
    if (mime.includes('image')) return 'Image file';
    return 'Uploaded file';
  }
  try {
    const path = new URL(url, window.location.origin).pathname;
    const base = path.split('/').pop();
    return base || 'File';
  } catch {
    return 'File';
  }
}
