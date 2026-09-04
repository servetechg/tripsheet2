import type { CSSProperties, ImgHTMLAttributes } from 'react';
import { G } from '@/lib/theme';

export const BRAND = {
  name: 'Fleetquix',
  logo: '/images/logo.png',
  favicon: '/images/favicon.png',
} as const;

type BrandLogoProps = {
  variant?: 'full' | 'mark';
  height?: number;
  style?: CSSProperties;
  alt?: string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>;

/** Product brand image — full wordmark or favicon mark */
export function BrandLogo({
  variant = 'full',
  height = 28,
  style,
  alt = BRAND.name,
  ...rest
}: BrandLogoProps) {
  const src = variant === 'mark' ? BRAND.favicon : BRAND.logo;
  return (
    <img
      src={src}
      alt={alt}
      height={height}
      style={{
        height,
        width: 'auto',
        display: 'block',
        objectFit: 'contain',
        filter: G.mode === 'dark' ? 'brightness(0) invert(1)' : 'none',
        ...style,
      }}
      {...rest}
    />
  );
}
