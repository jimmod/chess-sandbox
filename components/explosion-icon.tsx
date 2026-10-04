import type { SVGProps } from 'react';

export interface ExplosionIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  filled?: boolean;
}

// 10-point dynamic comic blast shape designed for 24x24 viewBox with 2px stroke
const BLAST_PATH =
  'M 12 2.5 L 13.8 7.2 L 18 4.2 L 16.8 9 L 21.5 9.2 L 17.5 12.5 L 21 16.2 L 16.2 16.2 L 16.5 21 L 12.8 17.5 L 11 21.8 L 9.8 17 L 5.8 19.5 L 7 15 L 2.5 14.2 L 6.8 11.5 L 3.2 7.8 L 8 8.2 L 7.5 3.8 L 11 7 Z';

export function ExplosionIcon({
  size = 20,
  filled = false,
  className,
  ...props
}: ExplosionIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d={BLAST_PATH} />
    </svg>
  );
}
