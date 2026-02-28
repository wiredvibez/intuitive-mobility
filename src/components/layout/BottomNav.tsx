'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/lib/stores/uiStore';

const tabs = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: (active: boolean) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {active ? (
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
        ) : (
          <>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </>
        )}
      </svg>
    ),
  },
  {
    href: '/exercises',
    label: 'Exercises',
    icon: (active: boolean) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.25 : 1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6.5 6.5h11M6.5 17.5h11" />
        <rect x="2" y="8.5" width="4" height="7" rx="1" />
        <rect x="18" y="8.5" width="4" height="7" rx="1" />
        <line x1="12" y1="6.5" x2="12" y2="17.5" />
      </svg>
    ),
  },
  {
    href: '/archive',
    label: 'History',
    icon: (active: boolean) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.25 : 1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (active: boolean) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {active ? (
          <>
            <circle cx="12" cy="8" r="4" />
            <path d="M20 21a8 8 0 0 0-16 0" />
          </>
        ) : (
          <>
            <circle cx="12" cy="8" r="4" />
            <path d="M20 21a8 8 0 0 0-16 0" />
          </>
        )}
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const hidden = useUIStore((s) => s.hideBottomNav);

  if (hidden) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-bg-card border-t border-border">
      <div className="max-w-app mx-auto grid grid-cols-4 pt-1 pb-safe-b" style={{ height: '56px' }}>
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`
                relative flex items-center justify-center h-full
                transition-colors
                ${active ? 'text-accent' : 'text-fg-subtle hover:text-fg-muted'}
              `}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-accent" />
              )}
              {tab.icon(active)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
