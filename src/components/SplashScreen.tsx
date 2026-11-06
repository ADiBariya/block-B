export default function SplashScreen() {
  return (
    <main className="splash-screen" aria-label="Block Party loading screen">
      <div className="splash-cloud-field splash-cloud-field-top" aria-hidden="true" />
      <div className="splash-cloud-field splash-cloud-field-bottom" aria-hidden="true" />

      <div className="splash-floating-block splash-floating-block-left" aria-hidden="true" />
      <div className="splash-floating-block splash-floating-block-right" aria-hidden="true" />

      <div className="splash-center">
        <svg
          className="splash-logo"
          viewBox="0 0 360 350"
          role="img"
          aria-label="Block Party"
        >
          <defs>
            <linearGradient id="splash-purple" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#c58af5" />
              <stop offset=".52" stopColor="#9460db" />
              <stop offset="1" stopColor="#7041b9" />
            </linearGradient>
            <linearGradient id="splash-orange" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffda72" />
              <stop offset=".55" stopColor="#ffad32" />
              <stop offset="1" stopColor="#ed8425" />
            </linearGradient>
            <linearGradient id="splash-blue" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#a9ebf5" />
              <stop offset=".55" stopColor="#62c9df" />
              <stop offset="1" stopColor="#319ab9" />
            </linearGradient>
            <filter id="splash-block-shadow" x="-40%" y="-40%" width="180%" height="190%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="5" />
              <feOffset dy="7" />
              <feComponentTransfer><feFuncA type="linear" slope=".34" /></feComponentTransfer>
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="splash-word-shadow" x="-30%" y="-40%" width="160%" height="190%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
              <feOffset dy="4" />
              <feComponentTransfer><feFuncA type="linear" slope=".44" /></feComponentTransfer>
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <g className="splash-logo-blocks" filter="url(#splash-block-shadow)">
            <g transform="translate(148 12)">
              <rect width="65" height="65" rx="19" fill="url(#splash-purple)" stroke="#463064" strokeWidth="7" />
              <path d="M13 8 Q32 -1 51 8" fill="none" stroke="#fff" strokeOpacity=".66" strokeWidth="5" strokeLinecap="round" />
              <path d="M8 23 Q4 33 9 44" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="4" strokeLinecap="round" />
            </g>
            <g transform="translate(92 70)">
              <rect width="65" height="65" rx="18" fill="url(#splash-purple)" stroke="#463064" strokeWidth="7" />
              <path d="M12 8 Q30 1 50 8" fill="none" stroke="#fff" strokeOpacity=".58" strokeWidth="5" strokeLinecap="round" />
            </g>
            <g transform="translate(148 70)">
              <rect width="65" height="65" rx="16" fill="url(#splash-orange)" stroke="#463064" strokeWidth="7" />
              <path d="M12 8 Q30 1 50 8" fill="none" stroke="#fff" strokeOpacity=".58" strokeWidth="5" strokeLinecap="round" />
            </g>
            <g transform="translate(204 70)">
              <rect width="65" height="65" rx="17" fill="url(#splash-blue)" stroke="#463064" strokeWidth="7" />
              <path d="M12 8 Q30 1 50 8" fill="none" stroke="#fff" strokeOpacity=".66" strokeWidth="5" strokeLinecap="round" />
            </g>
          </g>

          <g className="splash-logo-wordmark" filter="url(#splash-word-shadow)" textAnchor="middle" fontFamily="'Arial Rounded MT Bold', 'Trebuchet MS', 'Arial Black', sans-serif" fontWeight="1000">
            <text x="180" y="217" fontSize="91" letterSpacing="-5" textLength="292" lengthAdjust="spacingAndGlyphs" fill="#fff9ff" stroke="#38234f" strokeWidth="17" strokeLinejoin="round" paintOrder="stroke fill">Block</text>
            <text x="180" y="303" fontSize="91" letterSpacing="-4" textLength="246" lengthAdjust="spacingAndGlyphs" fill="#fff9ff" stroke="#38234f" strokeWidth="17" strokeLinejoin="round" paintOrder="stroke fill">Party</text>
            <text x="180" y="217" fontSize="91" letterSpacing="-5" textLength="292" lengthAdjust="spacingAndGlyphs" fill="#fff9ff">Block</text>
            <text x="180" y="303" fontSize="91" letterSpacing="-4" textLength="246" lengthAdjust="spacingAndGlyphs" fill="#fff9ff">Party</text>
          </g>
        </svg>

        <p className="splash-tagline">Match <span>•</span> Clear <span>•</span> Compete</p>
      </div>

      <div className="splash-progress" role="progressbar" aria-label="Loading Block Party" aria-valuemin={0} aria-valuemax={100}>
        <span />
      </div>
    </main>
  );
}
