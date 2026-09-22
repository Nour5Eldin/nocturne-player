import type { ReactNode } from "react";

interface IconProps {
  size?: number;
  color?: string;
}

function Svg({ size = 20, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="block shrink-0">
      {children}
    </svg>
  );
}

export const IconPlay = ({ size, color = "currentColor" }: IconProps) => (
  <Svg size={size}>
    <path
      d="M8 5.6v12.8a.8.8 0 0 0 1.2.7l10.2-6.4a.8.8 0 0 0 0-1.4L9.2 4.9A.8.8 0 0 0 8 5.6Z"
      fill={color}
    />
  </Svg>
);

export const IconPause = ({ size, color = "currentColor" }: IconProps) => (
  <Svg size={size}>
    <rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill={color} />
    <rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill={color} />
  </Svg>
);

export const IconReplay = ({ size, color = "currentColor" }: IconProps) => (
  <Svg size={size}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M4 3.8v4.4h4.4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const IconBack = ({ size, color = "currentColor", n }: IconProps & { n: number }) => (
  <Svg size={size}>
    <path d="M12 4.5a7.5 7.5 0 1 1-7.1 5.1" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M12 1.8 8.8 4.5 12 7.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <text x="12" y="15.4" textAnchor="middle" fontSize="7" fontWeight="700" fill={color} fontFamily="system-ui, sans-serif">
      {n}
    </text>
  </Svg>
);

export const IconAhead = ({ size, color = "currentColor", n }: IconProps & { n: number }) => (
  <Svg size={size}>
    <path d="M12 4.5a7.5 7.5 0 1 0 7.1 5.1" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M12 1.8l3.2 2.7L12 7.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <text x="12" y="15.4" textAnchor="middle" fontSize="7" fontWeight="700" fill={color} fontFamily="system-ui, sans-serif">
      {n}
    </text>
  </Svg>
);

/** level: 0 = muted, 1 = low, 2 = high */
export const IconSpeaker = ({ size, color = "currentColor", level }: IconProps & { level: 0 | 1 | 2 }) => (
  <Svg size={size}>
    <path d="M4 9.5h3.2L11.5 6v12l-4.3-3.5H4z" fill={color} />
    {level === 0 ? (
      <path d="m15.5 9.5 5 5m0-5-5 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    ) : (
      <>
        <path d="M14.8 9.4a3.6 3.6 0 0 1 0 5.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        {level > 1 && (
          <path d="M17.6 6.8a7.3 7.3 0 0 1 0 10.4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        )}
      </>
    )}
  </Svg>
);

export const IconCaptions = ({ size, color = "currentColor", on }: IconProps & { on: boolean }) => (
  <Svg size={size}>
    <rect x="3" y="5.5" width="18" height="13" rx="3" stroke={color} strokeWidth="1.8" fill={on ? color : "none"} />
    <path
      d="M10.4 10.3a2.2 2.2 0 1 0 0 3.4M16.6 10.3a2.2 2.2 0 1 0 0 3.4"
      stroke={on ? "rgba(0,0,0,.85)" : color}
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </Svg>
);

export const IconTune = ({ size, color = "currentColor" }: IconProps) => (
  <Svg size={size}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="15" cy="7" r="2.2" stroke={color} strokeWidth="1.8" />
    <circle cx="9" cy="17" r="2.2" stroke={color} strokeWidth="1.8" />
  </Svg>
);

export const IconPip = ({ size, color = "currentColor" }: IconProps) => (
  <Svg size={size}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" stroke={color} strokeWidth="1.8" />
    <rect x="12" y="11.5" width="6.5" height="5" rx="1.2" fill={color} />
  </Svg>
);

export const IconExpand = ({ size, color = "currentColor", open }: IconProps & { open: boolean }) => (
  <Svg size={size}>
    {open ? (
      <path
        d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4M15 4v3.5A1.5 1.5 0 0 0 16.5 9H20M9 20v-3.5A1.5 1.5 0 0 0 7.5 15H4M15 20v-3.5a1.5 1.5 0 0 1 1.5-1.5H20"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    ) : (
      <path
        d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M20 9V5.5A1.5 1.5 0 0 0 18.5 4H15M4 15v3.5A1.5 1.5 0 0 0 5.5 20H9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    )}
  </Svg>
);

export const IconAlert = ({ size, color = "currentColor" }: IconProps) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
    <path d="M12 7.5v5.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="16.3" r="1.2" fill={color} />
  </Svg>
);

export const IconFilm = ({ size, color = "currentColor" }: IconProps) => (
  <Svg size={size}>
    <rect x="3" y="4" width="18" height="16" rx="3" stroke={color} strokeWidth="1.6" />
    <path d="m10 9 5 3-5 3z" fill={color} />
  </Svg>
);
