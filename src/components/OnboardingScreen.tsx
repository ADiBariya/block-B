type OnboardingScreenProps = {
  onSkip: () => void;
  onComplete: () => void;
};

type BlockTone = 'coral' | 'peach' | 'lavender' | 'purple' | 'blue' | 'mint';

const blocks: Array<{ id: string; x: number; y: number; rotate: number; tone: BlockTone; size?: number }> = [
  { id: 'top-coral', x: 218, y: 17, rotate: -13, tone: 'peach', size: 112 },
  { id: 'top-blue', x: 350, y: 81, rotate: 10, tone: 'blue', size: 105 },
  { id: 'left-coral', x: 66, y: 166, rotate: -13, tone: 'coral' },
  { id: 'middle-peach', x: 184, y: 146, rotate: -7, tone: 'peach' },
  { id: 'middle-purple', x: 321, y: 114, rotate: -7, tone: 'lavender' },
  { id: 'right-coral', x: 451, y: 187, rotate: -8, tone: 'coral' },
  { id: 'front-purple-left', x: 245, y: 285, rotate: -9, tone: 'purple' },
  { id: 'front-purple-right', x: 377, y: 274, rotate: -8, tone: 'purple' },
  { id: 'bottom-mint', x: 403, y: 397, rotate: -10, tone: 'mint', size: 112 },
];

function BlockIllustration() {
  return (
    <svg className="onboarding-block-art" viewBox="0 0 620 535" role="img" aria-label="A playful stack of glossy pastel puzzle blocks with a golden crown">
      <defs>
        <linearGradient id="block-coral" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd5cb" />
          <stop offset=".54" stopColor="#f1a79a" />
          <stop offset="1" stopColor="#df827d" />
        </linearGradient>
        <linearGradient id="block-peach" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe4dc" />
          <stop offset=".56" stopColor="#f6b6ad" />
          <stop offset="1" stopColor="#e89b9d" />
        </linearGradient>
        <linearGradient id="block-lavender" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9c5ff" />
          <stop offset=".55" stopColor="#a98bea" />
          <stop offset="1" stopColor="#805bc9" />
        </linearGradient>
        <linearGradient id="block-purple" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e0baff" />
          <stop offset=".48" stopColor="#bd83f2" />
          <stop offset="1" stopColor="#8953d2" />
        </linearGradient>
        <linearGradient id="block-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c9e3ff" />
          <stop offset=".55" stopColor="#8daef4" />
          <stop offset="1" stopColor="#5c79ce" />
        </linearGradient>
        <linearGradient id="block-mint" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2f7bf" />
          <stop offset=".55" stopColor="#b9dc8d" />
          <stop offset="1" stopColor="#85b76b" />
        </linearGradient>
        <linearGradient id="crown-gold" x1="0" y1="0" x2=".8" y2="1">
          <stop offset="0" stopColor="#fff4a7" />
          <stop offset=".45" stopColor="#ffc943" />
          <stop offset="1" stopColor="#e99a19" />
        </linearGradient>
        <filter id="block-shadow" x="-35%" y="-35%" width="170%" height="185%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="9" />
          <feOffset dy="10" />
          <feComponentTransfer><feFuncA type="linear" slope=".22" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="art-glow">
          <stop offset="0" stopColor="#fff" stopOpacity=".94" />
          <stop offset=".72" stopColor="#fff" stopOpacity=".35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="310" cy="255" rx="278" ry="246" fill="url(#art-glow)" />
      <g fill="none" stroke="#fff" strokeLinecap="round" opacity=".46">
        <path d="M306 4 L330 76" strokeWidth="5" />
        <path d="M61 119 L112 151" strokeWidth="4" />
        <path d="M535 115 L505 156" strokeWidth="4" />
        <path d="M26 286 L76 285" strokeWidth="3" />
        <path d="M565 322 L520 305" strokeWidth="3" />
      </g>

      <g filter="url(#block-shadow)">
        {blocks.map((block) => {
          const size = block.size ?? 118;
          return (
            <g key={block.id} transform={`translate(${block.x} ${block.y}) rotate(${block.rotate} ${size / 2} ${size / 2})`}>
              <rect x="0" y="0" width={size} height={size} rx="23" fill={`url(#block-${block.tone})`} stroke="#fff" strokeOpacity=".72" strokeWidth="4" />
              <path d={`M17 8 Q${size / 2} 1 ${size - 13} 8`} fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="5" strokeLinecap="round" />
              <path d={`M8 24 Q5 ${size / 2} 9 ${size - 21}`} fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="4" strokeLinecap="round" />
              <path d={`M14 ${size - 10} Q${size / 2} ${size + 1} ${size - 13} ${size - 11}`} fill="none" stroke="#53366f" strokeOpacity=".15" strokeWidth="7" strokeLinecap="round" />
            </g>
          );
        })}
      </g>

      <g transform="translate(28 334) rotate(-8 104 80)" filter="url(#block-shadow)">
        <path d="M20 40 L4 4 L47 31 L91 1 L135 33 L178 3 L162 113 Q90 135 18 112 Z" fill="url(#crown-gold)" stroke="#fff2a6" strokeWidth="5" strokeLinejoin="round" />
        <path d="M17 110 Q91 129 165 109 L162 139 Q91 157 19 139 Z" fill="#ed9d1e" stroke="#ffe58b" strokeWidth="4" />
        <path d="M20 47 Q88 68 161 47" fill="none" stroke="#fff6be" strokeOpacity=".55" strokeWidth="5" />
        <circle cx="8" cy="5" r="11" fill="#ffdf72" stroke="#fff3b0" strokeWidth="3" />
        <circle cx="90" cy="1" r="11" fill="#ffdf72" stroke="#fff3b0" strokeWidth="3" />
        <circle cx="179" cy="4" r="11" fill="#ffdf72" stroke="#fff3b0" strokeWidth="3" />
        <circle cx="90" cy="83" r="14" fill="#f08d1d" stroke="#fff0a2" strokeWidth="5" />
      </g>

      <g fill="#fff" opacity=".78">
        <path d="M150 65 l7 16 16 7-16 7-7 16-7-16-16-7 16-7z" />
        <path d="M548 385 l5 12 12 5-12 5-5 12-5-12-12-5 12-5z" />
      </g>
    </svg>
  );
}

export default function OnboardingScreen({ onSkip, onComplete }: OnboardingScreenProps) {
  return (
    <main className="onboarding-screen" aria-label="Welcome to Block Party onboarding">
      <div className="onboarding-clouds onboarding-clouds-top" aria-hidden="true" />
      <div className="onboarding-clouds onboarding-clouds-bottom" aria-hidden="true" />
      <div className="onboarding-content">
        <div className="onboarding-top">
          <button className="onboarding-skip" type="button" onClick={onSkip}>Skip</button>
        </div>

        <div className="onboarding-illustration">
          <BlockIllustration />
        </div>

        <section className="onboarding-copy" aria-labelledby="onboarding-title">
          <h1 id="onboarding-title"><span>Welcome to</span><span>Block Party!</span></h1>
          <p>A block puzzle game with online matches, leaderboards and more!</p>
        </section>

        <div className="onboarding-dots" aria-label="Onboarding progress: 1 of 3">
          <span className="is-active" />
          <span />
          <span />
        </div>

        <button className="onboarding-next" type="button" onClick={onComplete}>Get Started</button>
      </div>
    </main>
  );
}
