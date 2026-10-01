// Simple stroke icons, copied from the design source.

type P = { size?: number; color?: string; className?: string };

const base = (size: number, color: string, sw: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color,
  strokeWidth: sw,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const BackIcon = ({ size = 20, color = "#26211E" }: P) => (
  <svg {...base(size, color, 2.2)}><path d="M15 18l-6-6 6-6" /></svg>
);
export const ChevronLeft = ({ size = 20, color = "#26211E" }: P) => (
  <svg {...base(size, color, 2.4)}><path d="M15 18l-6-6 6-6" /></svg>
);
export const ChevronRight = ({ size = 20, color = "#FFFFFF" }: P) => (
  <svg {...base(size, color, 2.4)}><path d="M9 18l6-6-6-6" /></svg>
);
export const RowChevron = ({ size = 18, color = "#6B625B" }: P) => (
  <svg {...base(size, color, 2.2)}><path d="M9 18l6-6-6-6" /></svg>
);
export const GearIcon = ({ size = 20, color = "#26211E" }: P) => (
  <svg {...base(size, color, 2)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
export const PencilIcon = ({ size = 19, color = "#26211E" }: P) => (
  <svg {...base(size, color, 2)}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>
);
export const CheckIcon = ({ size = 16, color = "#FFFFFF", sw = 2.6 }: P & { sw?: number }) => (
  <svg {...base(size, color, sw)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const TrashIcon = ({ size = 16, color = "#FFFFFF" }: P) => (
  <svg {...base(size, color, 2.2)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
);
export const PlusIcon = ({ size = 20, color = "#FFFFFF" }: P) => (
  <svg {...base(size, color, 2.4)}><path d="M12 5v14M5 12h14" /></svg>
);
export const MinusIcon = ({ size = 18, color = "#26211E" }: P) => (
  <svg {...base(size, color, 2.6)}><path d="M5 12h14" /></svg>
);
export const SearchIcon = ({ size = 20, color = "#26211E" }: P) => (
  <svg {...base(size, color, 2)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
);
export const CloseIcon = ({ size = 18, color = "#26211E" }: P) => (
  <svg {...base(size, color, 2.4)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const CalendarIcon = ({ size = 14, color = "#26211E" }: P) => (
  <svg {...base(size, color, 2.2)}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
);
export const ClockIcon = ({ size = 14, color = "#26211E" }: P) => (
  <svg {...base(size, color, 2.2)}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2" /></svg>
);
export const TimerIcon = ({ size = 12, color = "#26211E" }: P) => (
  <svg {...base(size, color, 2.4)}><circle cx="12" cy="13" r="8" /><path d="M12 9v4" /></svg>
);
export const PhotoIcon = ({ size = 14, color = "#26211E" }: P) => (
  <svg {...base(size, color, 2.2)}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 16l5-5 4 4 3-3 6 6" /></svg>
);
export const DownloadIcon = ({ size = 18, color = "#FFFFFF" }: P) => (
  <svg {...base(size, color, 2.2)}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
);
export const ArrowRightIcon = ({ size = 18, color = "#FFFFFF" }: P) => (
  <svg {...base(size, color, 2.4)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const CameraIcon = ({ size = 16, color = "#26211E" }: P) => (
  <svg {...base(size, color, 2)}><rect x="3" y="5" width="18" height="15" rx="3" /><circle cx="12" cy="12.5" r="3.5" /><path d="M8 5l1.5-2h5L16 5" /></svg>
);
export const GripIcon = ({ size = 18, color = "#B9AFA4", r = 1.7 }: P & { r?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
    <circle cx="9" cy="6" r={r} /><circle cx="15" cy="6" r={r} /><circle cx="9" cy="12" r={r} />
    <circle cx="15" cy="12" r={r} /><circle cx="9" cy="18" r={r} /><circle cx="15" cy="18" r={r} />
  </svg>
);

/** 5-point star decoration used on camera roll, pose details and export. */
export const StarDeco = ({ size = 38, fill = "#F8E7A6", sw = 1.2, style }: { size?: number; fill?: string; sw?: number; style?: React.CSSProperties }) => (
  <svg style={{ pointerEvents: "none", ...style }} width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="#26211E" strokeWidth={sw} strokeLinejoin="round" aria-hidden>
    <path d="M12 2.5l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.8 6.2 20l1.4-6.4L2.7 9.2l6.5-.7z" />
  </svg>
);

export const BurstDeco = ({ style }: { style?: React.CSSProperties }) => (
  <svg style={{ pointerEvents: "none", ...style }} width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#C8375E" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
    <path d="M20 4v8M20 28v8M4 20h8M28 20h8M9 9l5 5M26 26l5 5M31 9l-5 5M14 26l-5 5" />
  </svg>
);
