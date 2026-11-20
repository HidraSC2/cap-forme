import type { ReactNode } from 'react';

const PATHS: Record<string, ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-6h4v6" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 21V5" /><path d="M9 7h6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  cart: <><path d="M3 4h2.5l2.2 11h10.6L20 7H6.5" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M21 20H3" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.500 8 6.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.500" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  left: <path d="m14.5 5-7 7 7 7" />,
  right: <path d="m9.500 5 7 7-7 7" />,
  down: <path d="m5 9.500 7 7 7-7" />,
  trash: <><path d="M4 7h16M9 7V4h6v3M6.500 7l1 13h9l1-13" /><path d="M10 11v5M14 11v5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.500 2" /></>,
  flame: <path d="M12 3c1 3.500 5 5.500 5 10a5 5 0 0 1-10 0c0-1.800.8-3 1.800-4 .3 1.700 1.200 2.500 2 2.500C11.500 9.500 10.500 6 12 3z" />,
  box: <><path d="M3.500 7.500 12 3l8.500 4.500v9L12 21l-8.500-4.500z" /><path d="M3.500 7.500 12 12l8.500-4.500M12 12v9" /></>,
  leaf: <><path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15" /><path d="M5 19 14 10" /></>,
  euro: <><path d="M18 6.500A7 7 0 1 0 18 17.500" /><path d="M4 10.500h9M4 14h8" /></>,
  heart: <path d="M12 20s-7.500-4.500-7.500-10A4.300 4.300 0 0 1 12 7.300 4.300 4.300 0 0 1 19.500 10c0 5.500-7.500 10-7.500 10z" />,
  steps: <><path d="M7 14c-1.500-3-1.500-9 1.500-9S11 9 10 14z" /><path d="M7.200 17h3v1.500a1.500 1.500 0 0 1-3 0z" /><path d="M14 16c-1-4-.5-8 2-8s3 5 1 8.500z" /><path d="M14.200 19h3l-.2 1.300a1.400 1.400 0 0 1-2.800-.1z" /></>,
  scale: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M8 9a5.500 5.500 0 0 1 8 0M12 9.500l1.500-2" /></>,
  dumbbell: <><path d="M6.500 7v10M3.500 9.500v5M17.500 7v10M20.500 9.500v5M6.500 12h11" /></>,
  search: <><circle cx="11" cy="11" r="6.500" /><path d="m16 16 4.500 4.500" /></>,
  pencil: <><path d="M4 20l1-4L16.500 4.500l3 3L8 19z" /><path d="m14.500 6.500 3 3" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1" /><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1" /></>,
  alert: <><path d="M12 4 2.500 20h19z" /><path d="M12 10v4.500M12 17.300v.2" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  sync: <><path d="M4 12a8 8 0 0 1 13.700-5.700L20 8.500M20 4v4.500h-4.500" /><path d="M20 12a8 8 0 0 1-13.700 5.700L4 15.500M4 20v-4.500h4.500" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.500M12 7.700v.2" /></>,
  swap: <><path d="M4 8h14l-3.500-3.500M20 16H6l3.500 3.500" /></>,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
