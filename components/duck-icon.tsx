import type { SVGProps } from 'react';

export interface DuckIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  filled?: boolean;
}

const BODY_PATH =
  'M 16 8 C 17.5 8, 20.5 8.2, 21.2 8.7 C 21.8 9.1, 21.8 9.6, 21.2 10 C 20 10.6, 17.5 10.5, 16.2 10.3 C 17 12, 18.2 13.5, 18.2 15.5 C 18.2 18, 15.5 20, 11 20 C 6.5 20, 3.8 19, 2.5 16.8 C 1.5 14.8, 1.6 13, 2.8 12 C 4.2 13.2, 6.8 13.8, 9.2 11 C 9.5 9.8, 9.5 8.8, 9.5 7.8 C 9.5 4.8, 14.5 4.8, 16 8 Z';

const WING_PATH = 'M 7 16 C 8.5 14, 12 14, 13.5 16';

export function DuckIcon({
  size = 20,
  filled = false,
  className,
  ...props
}: DuckIconProps) {
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
      <path d={BODY_PATH} />
      <circle cx="13.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <path d={WING_PATH} fill="none" />
    </svg>
  );
}
