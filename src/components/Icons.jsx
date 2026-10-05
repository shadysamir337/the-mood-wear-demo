const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export const Icon = {
  Bag: (p) => (<svg {...base} {...p}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>),
  Search: (p) => (<svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>),
  Close: (p) => (<svg {...base} {...p}><path d="M5 5l14 14M19 5 5 19" /></svg>),
  Menu: (p) => (<svg {...base} {...p}><path d="M4 8h16M4 16h16" /></svg>),
  Arrow: (p) => (<svg {...base} {...p}><path d="M4 12h16m-6-6 6 6-6 6" /></svg>),
  Plus: (p) => (<svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>),
  Minus: (p) => (<svg {...base} {...p}><path d="M5 12h14" /></svg>),
  Instagram: (p) => (<svg {...base} {...p}><rect x="4" y="4" width="16" height="16" rx="4.5" /><circle cx="12" cy="12" r="3.6" /><circle cx="17" cy="7" r=".6" fill="currentColor" /></svg>),
  Facebook: (p) => (<svg {...base} {...p}><path d="M14 8h2.5V4.5H14a3.5 3.5 0 0 0-3.5 3.5v2H8V13.5h2.5V20h3.5v-6.5h2.5l.5-3.5h-3V8.5c0-.3.2-.5.5-.5Z" /></svg>),
  Heart: ({ filled, ...p }) => (<svg {...base} {...p}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" fill={filled ? 'currentColor' : 'none'} /></svg>),
  User: (p) => (<svg {...base} {...p}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" /></svg>),
  Star: ({ filled, ...p }) => (<svg {...base} {...p}><path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6L12 4Z" fill={filled ? 'currentColor' : 'none'} /></svg>),
  Check: (p) => (<svg {...base} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>),
}
