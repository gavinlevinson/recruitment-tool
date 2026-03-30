// Shared Orion archer logo components
// OrionMark (default) — archer figure only, used for avatars / icon spots
// OrionLogo (named)   — archer + "ORION" text, used in sidebar header

function ArcherSVG({ fill, dotFill, showText, className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={showText ? '0 0 220 240' : '0 0 220 190'}
      className={className}
      fill="none"
    >
      {/* Head — right-facing profile */}
      <ellipse cx="163" cy="34" rx="21" ry="26" fill={fill} />
      {/* Neck */}
      <rect x="148" y="53" width="22" height="14" rx="4" fill={fill} />

      {/* Body / torso — broad muscular back viewed from behind */}
      <path
        d="M 45 72
           C 52 60 68 52 88 48
           C 108 44 130 46 150 54
           C 162 58 170 68 170 82
           C 170 92 166 100 160 108
           C 152 116 142 120 135 126
           C 129 134 126 146 124 158
           C 120 168 112 172 102 170
           C 92 172 80 166 70 158
           C 60 148 54 134 50 118
           C 47 104 46 88 45 72 Z"
        fill={fill}
      />

      {/* Left arm — reaches back to pull the bow string */}
      <path
        d="M 45 78 C 36 75 24 73 15 78 C 9 81 9 89 16 92 C 25 95 37 91 47 86 Z"
        fill={fill}
      />

      {/* Bow — D-curve on the right */}
      <path
        d="M 170 18 C 200 38 212 70 210 100 C 207 128 194 148 174 162"
        stroke={fill}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Bow string */}
      <line x1="170" y1="18" x2="174" y2="162" stroke={fill} strokeWidth="2.5" />

      {/* Arrow shaft */}
      <line x1="15" y1="86" x2="162" y2="80" stroke={fill} strokeWidth="2.5" strokeLinecap="round" />
      {/* Arrowhead */}
      <polygon points="162,76 178,80 162,84" fill={fill} />

      {/* Orion constellation overlay on the torso */}
      {/* Shoulder stars */}
      <circle cx="76" cy="78" r="3.5" fill={dotFill} />
      <circle cx="96" cy="76" r="3.5" fill={dotFill} />
      {/* Belt stars (3 in a slight diagonal row) */}
      <circle cx="80" cy="97" r="3.5" fill={dotFill} />
      <circle cx="87" cy="94" r="3.5" fill={dotFill} />
      <circle cx="94" cy="97" r="3.5" fill={dotFill} />
      {/* Lower body stars */}
      <circle cx="78" cy="114" r="3.5" fill={dotFill} />
      <circle cx="96" cy="112" r="3.5" fill={dotFill} />
      {/* Connecting lines */}
      <line x1="76" y1="78"  x2="80" y2="97"  stroke={dotFill} strokeWidth="1.8" />
      <line x1="96" y1="76"  x2="94" y2="97"  stroke={dotFill} strokeWidth="1.8" />
      <line x1="80" y1="97"  x2="87" y2="94"  stroke={dotFill} strokeWidth="1.8" />
      <line x1="87" y1="94"  x2="94" y2="97"  stroke={dotFill} strokeWidth="1.8" />
      <line x1="80" y1="97"  x2="78" y2="114" stroke={dotFill} strokeWidth="1.8" />
      <line x1="94" y1="97"  x2="96" y2="112" stroke={dotFill} strokeWidth="1.8" />

      {/* ORION wordmark — full logo variant only */}
      {showText && (
        <text
          x="110"
          y="228"
          textAnchor="middle"
          fontFamily="'Arial Black', 'Arial Bold', Arial, sans-serif"
          fontSize="38"
          fontWeight="900"
          fill={fill}
          letterSpacing="5"
        >
          ORION
        </text>
      )}
    </svg>
  )
}

// ── Archer mark only ────────────────────────────────────────────────────────
// Use wherever a small square icon is needed (chat avatars, login header, etc.)
// `light` — set true when the background is dark (sidebar, chat header gradient)
export default function OrionMark({ className = 'w-8 h-8', light = false }) {
  const fill    = light ? 'white'   : '#0c1a2e'
  const dotFill = light ? '#a78bfa' : 'white'
  return <ArcherSVG fill={fill} dotFill={dotFill} showText={false} className={className} />
}

// ── Full brand logo (archer + ORION text) ────────────────────────────────────
// Used in the sidebar top-left header area.
// `light` — set true for dark backgrounds.
export function OrionLogo({ className = 'h-16 w-auto', light = false }) {
  const fill    = light ? 'white'   : '#0c1a2e'
  const dotFill = light ? '#a78bfa' : 'white'
  return <ArcherSVG fill={fill} dotFill={dotFill} showText={true} className={className} />
}
