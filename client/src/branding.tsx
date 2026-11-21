// Original branding art for Dream Football 11: per-player illustrated
// avatars, per-team logos, and national flags — all drawn in code, all
// fictional. No real club crest, real player likeness, or photo is used.
// Every variation is seeded deterministically from the player/team id, so
// a player always wears the same face and a team always shows its logo.

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const SKIN_TONES = ["#ffdbac", "#f2c79b", "#e8b088", "#c68642", "#9c6642", "#6f4e2e"];
const HAIR_COLORS = ["#17110b", "#241a12", "#3d2712", "#6e4a1f", "#a67c3d", "#d9c58f", "#8a8a8a", "#5b1f16"];

/** Illustrated player bust: distinct face, hair style/colour, skin tone
 * and beard per player, jersey in the kit colour. */
export function PlayerAvatar({
  seed,
  kit,
  size = 84,
}: {
  seed: string;
  kit: string;
  size?: number;
}) {
  const h = hashSeed(seed);
  const skin = SKIN_TONES[h % SKIN_TONES.length] ?? "#f2c79b";
  const hair = HAIR_COLORS[Math.floor(h / 7) % HAIR_COLORS.length] ?? "#241a12";
  const hairStyle = Math.floor(h / 13) % 6;
  const beard = Math.floor(h / 29) % 3; // 0 none, 1 short, 2 full
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {/* jersey */}
      <path
        d="M36 34l14-5 14 5 6 13-9 3-2-7v26H41V43l-2 7-9-3z"
        fill={kit}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="1.5"
      />
      <path d="M41 69h18l2 10H52l-2-7-2 7h-9z" fill="#101828" />
      <rect x="41" y="79" width="6.5" height="9" rx="2.5" fill={skin} />
      <rect x="52.5" y="79" width="6.5" height="9" rx="2.5" fill={skin} />
      <rect x="39" y="88" width="10" height="4.5" rx="2" fill="#0a0a0a" />
      <rect x="51" y="88" width="10" height="4.5" rx="2" fill="#0a0a0a" />
      {/* neck + head */}
      <rect x="45.5" y="24" width="9" height="7" rx="2" fill={skin} />
      <circle cx="50" cy="17" r="10" fill={skin} />
      {/* beard */}
      {beard === 1 && (
        <path d="M42 21a8 8 0 0 0 16 0l-2.5 4.5a7 7 0 0 1-11 0z" fill={hair} opacity="0.85" />
      )}
      {beard === 2 && (
        <path d="M40.5 15a9.5 10.5 0 0 0 19 0v6a9.5 8 0 0 1-19 0z" fill={hair} opacity="0.9" />
      )}
      {/* face */}
      <circle cx="46" cy="17" r="1.15" fill="#1c1410" />
      <circle cx="54" cy="17" r="1.15" fill="#1c1410" />
      <path d="M43.8 13.8h4M52.2 13.8h4" stroke="#1c1410" strokeWidth="0.9" strokeLinecap="round" opacity="0.65" />
      <path d="M50 17.5l-0.8 2.4h1.4" stroke="#1c1410" strokeWidth="0.7" fill="none" opacity="0.5" />
      <path d="M47.4 22.6a3.4 1.6 0 0 0 5.2 0" stroke="#8a4b2a" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      {/* hair styles */}
      {hairStyle === 0 && <path d="M40 16a10 10 0 0 1 20 0l-1.5-4.5a10 7 0 0 0-17 0z" fill={hair} />}
      {hairStyle === 1 && <path d="M40.5 15.5a9.5 9.5 0 0 1 19 0l-0.8-2.8a9.5 7.5 0 0 0-17.4 0z" fill={hair} />}
      {hairStyle === 2 && (
        <g fill={hair}>
          <circle cx="43" cy="9" r="3.6" />
          <circle cx="50" cy="7.4" r="4" />
          <circle cx="57" cy="9" r="3.6" />
          <circle cx="40.8" cy="13" r="3" />
          <circle cx="59.2" cy="13" r="3" />
        </g>
      )}
      {hairStyle === 3 && <path d="M46.5 3.5h7l1.2 9h-9.4z" fill={hair} />}
      {hairStyle === 4 && (
        <path d="M39.5 12a10.5 10.5 0 0 1 21 0v12h-4.5v-9a6 6 0 0 0-12 0v9h-4.5z" fill={hair} />
      )}
      {hairStyle === 5 && <path d="M43 9.5a8 6 0 0 1 10-1.6" stroke="#ffffff" strokeWidth="1.1" fill="none" opacity="0.35" strokeLinecap="round" />}
      {/* ball */}
      <circle cx="78" cy="87" r="6.5" fill="#f8fafc" stroke="#111" strokeWidth="1.1" />
      <path d="M78 83.8l2.6 1.9-1 3h-3.2l-1-3z" fill="#111" />
    </svg>
  );
}

/** Simplified national flags, drawn as SVG. Clubs return null. */
export function FlagBadge({ teamId, width = 30 }: { teamId: string; width?: number }) {
  const hgt = Math.round((width * 2) / 3);
  const common = {
    width,
    height: hgt,
    viewBox: "0 0 30 20",
    className: "shrink-0 rounded-[3px] ring-1 ring-white/40",
    "aria-hidden": true as const,
  };
  switch (teamId) {
    case "bangladesh":
      return (
        <svg {...common}>
          <rect width="30" height="20" fill="#006a4e" />
          <circle cx="13.5" cy="10" r="5.4" fill="#f42a41" />
        </svg>
      );
    case "brazil":
      return (
        <svg {...common}>
          <rect width="30" height="20" fill="#009c3b" />
          <path d="M15 2.5 27 10 15 17.5 3 10z" fill="#ffdf00" />
          <circle cx="15" cy="10" r="3.6" fill="#002776" />
        </svg>
      );
    case "argentina":
      return (
        <svg {...common}>
          <rect width="30" height="20" fill="#75aadb" />
          <rect y="6.7" width="30" height="6.6" fill="#ffffff" />
          <circle cx="15" cy="10" r="2" fill="#f6b40e" stroke="#d48f00" strokeWidth="0.6" />
        </svg>
      );
    case "france":
      return (
        <svg {...common}>
          <rect width="10" height="20" fill="#1e3a8a" />
          <rect x="10" width="10" height="20" fill="#ffffff" />
          <rect x="20" width="10" height="20" fill="#e63946" />
        </svg>
      );
    case "england":
      return (
        <svg {...common}>
          <rect width="30" height="20" fill="#f8fafc" />
          <rect x="13" width="4" height="20" fill="#ce1124" />
          <rect y="8" width="30" height="4" fill="#ce1124" />
        </svg>
      );
    case "spain":
      return (
        <svg {...common}>
          <rect width="30" height="20" fill="#c60b1e" />
          <rect y="5" width="30" height="10" fill="#ffc400" />
        </svg>
      );
    case "germany":
      return (
        <svg {...common}>
          <rect width="30" height="6.7" fill="#111111" />
          <rect y="6.7" width="30" height="6.6" fill="#dd0000" />
          <rect y="13.3" width="30" height="6.7" fill="#ffce00" />
        </svg>
      );
    case "portugal":
      return (
        <svg {...common}>
          <rect width="12" height="20" fill="#046a38" />
          <rect x="12" width="18" height="20" fill="#da291c" />
          <circle cx="12" cy="10" r="3" fill="#ffe900" stroke="#111" strokeWidth="0.5" />
        </svg>
      );
    case "italy":
      return (
        <svg {...common}>
          <rect width="10" height="20" fill="#009246" />
          <rect x="10" width="10" height="20" fill="#ffffff" />
          <rect x="20" width="10" height="20" fill="#ce2b37" />
        </svg>
      );
    case "netherlands":
      return (
        <svg {...common}>
          <rect width="30" height="6.7" fill="#ae1c28" />
          <rect y="6.7" width="30" height="6.6" fill="#ffffff" />
          <rect y="13.3" width="30" height="6.7" fill="#21468b" />
        </svg>
      );
    default:
      return null;
  }
}

export interface LogoTeam {
  id: string;
  short: string;
  color: string;
  color2: string;
}

/** Each team's own logo: shape, pattern and star seeded from the team id,
 * drawn in the team's colours with its initials and a ball. Original art —
 * no real crest is copied. */
export function TeamLogo({ team, size = 56 }: { team: LogoTeam; size?: number }) {
  const h = hashSeed(team.id);
  const shape = h % 3; // 0 shield, 1 rounded shield, 2 round badge
  const pattern = Math.floor(h / 5) % 6;
  const hasStar = Math.floor(h / 11) % 2 === 0;
  const clipId = `lg-${team.id.replace(/[^a-z0-9]/gi, "")}`;
  const shapePath =
    shape === 2
      ? null
      : shape === 0
        ? "M32 3 58 11v24c0 15.5-11 27-26 33C17 62 6 50.5 6 35V11z"
        : "M32 4 56 12v22c0 14.5-10 25.5-24 31C18 59.5 8 48.5 8 34V12z";
  return (
    <svg width={size} height={size} viewBox="0 0 64 72" aria-hidden="true" className="shrink-0 drop-shadow">
      <defs>
        <clipPath id={clipId}>
          {shape === 2 ? <circle cx="32" cy="34" r="29" /> : <path d={shapePath ?? ""} />}
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="64" height="72" fill={team.color} />
        {pattern === 1 && (
          <>
            <rect x="14" width="9" height="72" fill={team.color2} opacity="0.9" />
            <rect x="41" width="9" height="72" fill={team.color2} opacity="0.9" />
          </>
        )}
        {pattern === 2 && (
          <>
            <rect y="16" width="64" height="10" fill={team.color2} opacity="0.9" />
            <rect y="44" width="64" height="10" fill={team.color2} opacity="0.9" />
          </>
        )}
        {pattern === 3 && <path d="M0 58 64 6v16L16 72H0z" fill={team.color2} opacity="0.9" />}
        {pattern === 4 && <rect x="32" width="32" height="72" fill={team.color2} opacity="0.85" />}
        {pattern === 5 && (
          <path d="M0 0h64L32 26z" fill={team.color2} opacity="0.9" />
        )}
        <rect width="64" height="72" fill="none" />
      </g>
      {shape === 2 ? (
        <circle cx="32" cy="34" r="29" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2.4" />
      ) : (
        <path d={shapePath ?? ""} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2.4" />
      )}
      {hasStar && (
        <path
          d="M32 8.5l1.7 3.6 3.9.5-2.9 2.7.8 3.9-3.5-2-3.5 2 .8-3.9-2.9-2.7 3.9-.5z"
          fill="#f5c518"
          stroke="rgba(0,0,0,0.4)"
          strokeWidth="0.5"
        />
      )}
      <circle cx="32" cy="33" r="8.6" fill="#f8fafc" stroke="#111" strokeWidth="1.3" />
      <path d="M32 28.8l4 2.9-1.5 4.7h-5L28 31.7z" fill="#111" />
      <text
        x="32"
        y={shape === 2 ? 60 : 62}
        textAnchor="middle"
        fontSize="11.5"
        fontWeight="900"
        fill={team.color2}
        stroke="rgba(0,0,0,0.45)"
        strokeWidth="0.4"
      >
        {team.short}
      </text>
    </svg>
  );
}
