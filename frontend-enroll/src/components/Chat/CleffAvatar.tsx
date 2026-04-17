interface CleffAvatarProps {
  size?: number;
}

export function CleffAvatar({ size = 36 }: CleffAvatarProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="20" fill="#1b1307" />
      {/* Robot ears */}
      <rect x="2" y="14" width="4" height="8" rx="2" fill="#f3c13a" />
      <rect x="34" y="14" width="4" height="8" rx="2" fill="#f3c13a" />
      {/* Face plate */}
      <rect x="8" y="10" width="24" height="22" rx="6" fill="#2d2110" />
      {/* Eyes */}
      <circle cx="15" cy="19" r="3" fill="#f3c13a" />
      <circle cx="25" cy="19" r="3" fill="#f3c13a" />
      <circle cx="16" cy="18" r="1" fill="#1b1307" />
      <circle cx="26" cy="18" r="1" fill="#1b1307" />
      {/* Smile / music note mouth */}
      <path d="M15 25 Q20 28 25 25" stroke="#f3c13a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Top antenna with note */}
      <line x1="20" y1="10" x2="20" y2="5" stroke="#f3c13a" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="20" cy="4" r="2" fill="#ff904e" />
    </svg>
  );
}
