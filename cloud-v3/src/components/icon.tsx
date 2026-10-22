import type { SVGProps } from 'react';

const paths = {
  gate: <path d="M3 21V3m18 18V3M3 7h18M3 18h18M7 7v11m5-11v11m5-11v11" />,
  'arrow-up-right': <path d="M7 17 17 7M7 7h10v10" />,
  'arrow-down-right': <path d="m7 7 10 10M7 17h10V7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18m-13 5h2m4 0h2" />
    </>
  ),
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-2a6 6 0 0 1 12 0v2m1-16a3 3 0 0 1 0 6m3 10v-2a6 6 0 0 0-3-5" />
    </>
  ),
  settings: (
    <>
      <path d="m9 3-.6 2.2-2 .8-2-.6-2 3.4L4 10.5v3l-1.6 1.7 2 3.4 2-.6 2 .8L9 21h6l.6-2.2 2-.8 2 .6 2-3.4-1.6-1.7v-3l1.6-1.7-2-3.4-2 .6-2-.8L15 3Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'log-out': (
    <>
      <path d="M9 4H4v16h5m5-12 4 4-4 4m-6-4h13" />
    </>
  ),
  sparkle: (
    <>
      <path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z" />
      <path d="M21 2v4m-2-2h4" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  edit: <path d="m16 3 5 5-12 12-6 1 1-6Zm-2 2 5 5" />,
  trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />,
  alert: (
    <>
      <path d="m12 3 10 18H2Z" />
      <path d="M12 9v4m0 3v1" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6" />
    </>
  ),
  'chevron-right': <path d="m9 5 7 7-7 7" />,
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
