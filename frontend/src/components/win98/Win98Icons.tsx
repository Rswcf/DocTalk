export function DocumentIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 1h7l4 4v10H3V1z" fill="#FFFFFF" stroke="#000000" strokeWidth="1" />
      <path d="M10 1v4h4" stroke="#000000" strokeWidth="1" fill="#c0c0c0" />
      <line x1="5" y1="7" x2="12" y2="7" stroke="#000" strokeWidth="0.5" />
      <line x1="5" y1="9" x2="12" y2="9" stroke="#000" strokeWidth="0.5" />
      <line x1="5" y1="11" x2="10" y2="11" stroke="#000" strokeWidth="0.5" />
    </svg>
  );
}

export function ChatIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M1 2h14v9H5l-4 3V2z" fill="#FFFFE1" stroke="#000000" strokeWidth="1" />
      <line x1="4" y1="5" x2="12" y2="5" stroke="#000080" strokeWidth="1" />
      <line x1="4" y1="7" x2="10" y2="7" stroke="#000080" strokeWidth="1" />
      <line x1="4" y1="9" x2="8" y2="9" stroke="#000080" strokeWidth="1" />
    </svg>
  );
}

export function FolderIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M1 3h5l2 2h7v9H1V3z" fill="#FFD700" stroke="#000" strokeWidth="1" />
    </svg>
  );
}

export function SendIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M1 1l10 5-10 5V7.5l6-1.5-6-1.5V1z" fill="#000080" />
    </svg>
  );
}

export function ZoomInIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4" stroke="#000" strokeWidth="1.5" fill="none" />
      <line x1="6" y1="4" x2="6" y2="8" stroke="#000" strokeWidth="1" />
      <line x1="4" y1="6" x2="8" y2="6" stroke="#000" strokeWidth="1" />
      <line x1="9" y1="9" x2="13" y2="13" stroke="#000" strokeWidth="1.5" />
    </svg>
  );
}

export function ZoomOutIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4" stroke="#000" strokeWidth="1.5" fill="none" />
      <line x1="4" y1="6" x2="8" y2="6" stroke="#000" strokeWidth="1" />
      <line x1="9" y1="9" x2="13" y2="13" stroke="#000" strokeWidth="1.5" />
    </svg>
  );
}

export function ThumbUpIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M4 6h-3v7h3V6zM5 6l2-5c.5-.3 1.5 0 1.5 1.5L8 5h4.5c.5 0 1 .5.8 1l-2 6c-.1.3-.4.5-.8.5H5V6z" fill="#000" />
    </svg>
  );
}

export function ThumbDownIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M10 8h3V1h-3v7zM9 8l-2 5c-.5.3-1.5 0-1.5-1.5L6 9H1.5C1 9 .5 8.5.7 8l2-6c.1-.3.4-.5.8-.5H9v7z" fill="#000" />
    </svg>
  );
}

export function CopyIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <rect x="3" y="3" width="8" height="9" fill="#fff" stroke="#000" strokeWidth="1" />
      <rect x="1" y="1" width="8" height="9" fill="#fff" stroke="#000" strokeWidth="1" />
    </svg>
  );
}

export function RefreshIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M12 7a5 5 0 01-9 3" stroke="#000" strokeWidth="1.5" fill="none" />
      <path d="M2 7a5 5 0 019-3" stroke="#000" strokeWidth="1.5" fill="none" />
      <path d="M12 3v4h-4" stroke="#000" strokeWidth="1" fill="none" />
      <path d="M2 11V7h4" stroke="#000" strokeWidth="1" fill="none" />
    </svg>
  );
}

export function GlobeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="#000" strokeWidth="1" fill="#87CEEB" />
      <ellipse cx="8" cy="8" rx="3" ry="6" stroke="#000" strokeWidth="0.5" fill="none" />
      <line x1="2" y1="6" x2="14" y2="6" stroke="#000" strokeWidth="0.5" />
      <line x1="2" y1="10" x2="14" y2="10" stroke="#000" strokeWidth="0.5" />
    </svg>
  );
}

export function CreditIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="#DAA520" strokeWidth="1.5" fill="#FFD700" />
      <text x="8" y="11" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#8B6914">$</text>
    </svg>
  );
}

export function ChevronLeftIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none">
      <path d="M7 1L3 5l4 4" stroke="#000" strokeWidth="1.5" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none">
      <path d="M3 1l4 4-4 4" stroke="#000" strokeWidth="1.5" />
    </svg>
  );
}

export function SearchIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4" stroke="#000" strokeWidth="1.5" fill="none" />
      <line x1="9" y1="9" x2="13" y2="13" stroke="#000" strokeWidth="1.5" />
    </svg>
  );
}

export function HandIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M7 1v8M5 3v5M9 2v6M3 5v4c0 3 2 4 4 4s4-1 4-4V4M11 4v4" stroke="#000" strokeWidth="1" fill="#FFE0B2" />
    </svg>
  );
}

export function StopIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <rect x="2" y="2" width="8" height="8" fill="#000" />
    </svg>
  );
}
