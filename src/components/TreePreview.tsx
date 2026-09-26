/**
 * Decorative miniature of the tree canvas for the landing page. Hand-drawn in
 * SVG rather than rendered from the real layout engine: it needs to look right
 * at 320px wide with no data loaded, and it must never depend on the store.
 */
export function TreePreview() {
  return (
    <svg viewBox="0 0 320 208" width="100%" style={{ maxWidth: 380, display: 'block' }} role="img" aria-label="Illustration of a family tree with two generations">
      <defs>
        <linearGradient id="tp-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C2410C" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#C2410C" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Connectors sit behind the cards */}
      <g fill="none" stroke="url(#tp-fade)" strokeWidth="1.8" strokeLinecap="round">
        <path d="M112 46h26" />
        <path d="M125 46v30" />
        <path d="M46 118V96a10 10 0 0 1 10-10h138a10 10 0 0 1 10 10v22" />
        <path d="M125 76v10" />
        <path d="M125 86v32" />
      </g>

      <Card x={48} y={30} gender="m" />
      <Card x={138} y={30} gender="f" />

      <Card x={8} y={118} gender="f" />
      <Card x={86} y={118} gender="m" />
      <Card x={164} y={118} gender="m" />

      {/* A hint of the canvas continuing past the frame */}
      <g opacity="0.45">
        <path d="M204 152h30" stroke="url(#tp-fade)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <circle cx="244" cy="152" r="2.4" fill="#C2410C" opacity="0.4" />
        <circle cx="254" cy="152" r="2.4" fill="#C2410C" opacity="0.28" />
        <circle cx="264" cy="152" r="2.4" fill="#C2410C" opacity="0.16" />
      </g>
    </svg>
  );
}

function Card({ x, y, gender }: { x: number; y: number; gender: 'm' | 'f' }) {
  const fill = gender === 'm' ? '#F0F9FF' : '#FDF2F8';
  const stroke = gender === 'm' ? '#38BDF8' : '#F472B6';
  const accent = gender === 'm' ? '#0369A1' : '#BE185D';
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="72" height="44" rx="9" fill={fill} stroke={stroke} strokeWidth="1.3" />
      <circle cx="16" cy="22" r="9" fill="#fff" stroke={stroke} strokeWidth="1.1" />
      <circle cx="16" cy="19" r="3.1" fill={accent} opacity="0.5" />
      <path d="M10.5 28a6 6 0 0 1 11 0" fill={accent} opacity="0.5" />
      <rect x="31" y="14" width="32" height="4.2" rx="2.1" fill={accent} opacity="0.55" />
      <rect x="31" y="23" width="22" height="3.4" rx="1.7" fill={accent} opacity="0.3" />
    </g>
  );
}
