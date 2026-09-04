/**
 * Vibranium core hero — pure CSS/SVG background layer.
 *
 * Replaces the original three.js/react-three-fiber canvas so the security
 * add-on does not pull the ~30MB 3D stack into TestiFy. Same role: an
 * absolutely-positioned animated backdrop sitting behind the hero copy.
 */
export default function SecurityHero() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* Radial ambient glow */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: "min(120vh, 120vw)",
          height: "min(120vh, 120vw)",
          background:
            "radial-gradient(circle, rgba(154,107,255,0.20) 0%, rgba(106,63,201,0.10) 35%, transparent 68%)",
        }}
      />

      <svg
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sc-hero-svg"
        viewBox="0 0 400 400"
        style={{ width: "min(72vh, 72vw)", height: "min(72vh, 72vw)" }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="scCoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#b794ff" />
            <stop offset="55%" stopColor="#6a3fc9" />
            <stop offset="100%" stopColor="#c6a15b" />
          </linearGradient>
          <radialGradient id="scCoreFill" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="rgba(183,148,255,0.42)" />
            <stop offset="70%" stopColor="rgba(106,63,201,0.14)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <filter id="scGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Expanding energy rings */}
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx="200"
            cy="200"
            r="70"
            fill="none"
            stroke="rgba(154,107,255,0.55)"
            strokeWidth="1.2"
            className="sc-hero-ring"
            style={{ animationDelay: `${i * 1.6}s` }}
          />
        ))}

        {/* Counter-rotating orbital rings */}
        <ellipse
          cx="200" cy="200" rx="150" ry="56"
          fill="none" stroke="rgba(198,161,91,0.35)" strokeWidth="1"
          className="sc-hero-spin-cw"
        />
        <ellipse
          cx="200" cy="200" rx="56" ry="150"
          fill="none" stroke="rgba(154,107,255,0.30)" strokeWidth="1"
          className="sc-hero-spin-ccw"
        />

        {/* Vibranium core hexagon */}
        <g className="sc-hero-spin-cw" filter="url(#scGlow)">
          <polygon
            points="200,92 294,146 294,254 200,308 106,254 106,146"
            fill="url(#scCoreFill)"
            stroke="url(#scCoreGrad)"
            strokeWidth="2"
          />
          <polygon
            points="200,130 261,165 261,235 200,270 139,235 139,165"
            fill="none"
            stroke="rgba(198,161,91,0.55)"
            strokeWidth="1"
          />
        </g>

        {/* Pulsing centre */}
        <circle
          cx="200" cy="200" r="17"
          fill="url(#scCoreGrad)"
          filter="url(#scGlow)"
          className="sc-hero-pulse"
        />
      </svg>
    </div>
  );
}
