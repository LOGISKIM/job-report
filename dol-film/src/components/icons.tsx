const base = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Check = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} strokeWidth={3.2} aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const Lock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...base} strokeWidth={2} aria-hidden>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 018 0v3" />
  </svg>
);
export const Shield = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" {...base} strokeWidth={2} aria-hidden>
    <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z" />
    <path d="M8.5 12l2.5 2.5 4.5-5" />
  </svg>
);
export const Pen = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" {...base} strokeWidth={2} aria-hidden>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);
export const Info = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...base} strokeWidth={2} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.5v.5" />
  </svg>
);
export const Plus = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" {...base} strokeWidth={2} aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const Down = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...base} strokeWidth={2.2} aria-hidden>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const Back = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" {...base} strokeWidth={2.2} aria-hidden>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
export const Save = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" {...base} strokeWidth={2} aria-hidden>
    <path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5" />
    <path d="M5 19h14" />
  </svg>
);
export const Share = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" {...base} strokeWidth={2} aria-hidden>
    <circle cx="18" cy="5.5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="18.5" r="2.5" />
    <path d="M8.2 10.8l7.6-4M8.2 13.2l7.6 4" />
  </svg>
);
export const Edit = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" {...base} strokeWidth={2} aria-hidden>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </svg>
);
