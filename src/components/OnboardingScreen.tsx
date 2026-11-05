import { useState } from 'react';

type OnboardingScreenProps = {
  onSkip: () => void;
  onComplete: () => void;
};

const slides = [
  {
    eyebrow: 'THE BASICS · 01',
    title: 'Place Blocks',
    copy: 'Choose a shape and place it anywhere it fits on the board.',
    filled: [6, 7, 12, 17],
    cleared: [] as number[],
    accent: 'lavender',
  },
  {
    eyebrow: 'THE SATISFYING PART · 02',
    title: 'Clear Lines',
    copy: 'Complete a full row or column to clear space and earn points.',
    filled: [15, 16, 17, 18, 19, 6, 11, 22],
    cleared: [15, 16, 17, 18, 19],
    accent: 'mint',
  },
  {
    eyebrow: 'MAKE IT COUNT · 03',
    title: 'Build Combos',
    copy: 'Clear lines on consecutive moves to grow your combo and score.',
    filled: [5, 6, 7, 8, 9, 15, 16, 17, 18, 19],
    cleared: [5, 6, 7, 8, 9, 15, 16, 17, 18, 19],
    accent: 'coral',
  },
];

export default function OnboardingScreen({ onSkip, onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const slide = slides[step];
  const isLast = step === slides.length - 1;

  return (
    <main className="onboarding-screen">
      <div className="onboarding-decor onboarding-decor-one" aria-hidden="true" />
      <div className="onboarding-decor onboarding-decor-two" aria-hidden="true" />
      <div className="onboarding-content">
        <div className="onboarding-top">
          <div className="onboarding-brand">
            <span className="onboarding-brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
            <span>Block <strong>Party</strong></span>
          </div>
          <button className="onboarding-skip" type="button" onClick={onSkip}>Skip</button>
        </div>

        <section className={`onboarding-card accent-${slide.accent}`} aria-labelledby="onboarding-title">
          <div className="onboarding-count">{step + 1} / {slides.length}</div>
          <div className="onboarding-board" aria-hidden="true">
            {Array.from({ length: 25 }, (_, index) => (
              <span
                key={index}
                className={`onboarding-cell ${slide.filled.includes(index) ? 'is-filled' : ''} ${slide.cleared.includes(index) ? 'is-cleared' : ''}`}
              />
            ))}
            {step === 2 && <span className="onboarding-combo">COMBO ×2</span>}
          </div>
          <span className="onboarding-eyebrow">{slide.eyebrow}</span>
          <h1 id="onboarding-title">{slide.title}</h1>
          <p>{slide.copy}</p>
          <div className="onboarding-dots" aria-label={`Tutorial step ${step + 1} of ${slides.length}`}>
            {slides.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={index === step ? 'is-active' : ''}
                aria-label={`Go to tutorial step ${index + 1}`}
                aria-current={index === step ? 'step' : undefined}
                onClick={() => setStep(index)}
              />
            ))}
          </div>
          <button className="onboarding-next" type="button" onClick={() => isLast ? onComplete() : setStep((value) => Math.min(value + 1, slides.length - 1))}>
            {isLast ? 'Let’s play' : 'Next'}
            <span aria-hidden="true">→</span>
          </button>
        </section>
        <p className="onboarding-footnote">No timer. No pressure. Learn at your own pace.</p>
      </div>
    </main>
  );
}
