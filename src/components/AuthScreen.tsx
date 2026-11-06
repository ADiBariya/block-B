import { useState, type FormEvent } from 'react';

type AuthMode = 'welcome' | 'signin' | 'register' | 'reset';

type AuthScreenProps = {
  notice?: string;
  onPlayOffline: () => void;
};

function BrandLogo() {
  return (
    <svg className="signin-brand-art" viewBox="0 0 260 188" role="img" aria-label="Block Party">
      <defs>
        <linearGradient id="signin-purple" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d1a6ff" />
          <stop offset=".54" stopColor="#a46ee5" />
          <stop offset="1" stopColor="#8052c3" />
        </linearGradient>
        <linearGradient id="signin-orange" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe07d" />
          <stop offset=".55" stopColor="#ffb633" />
          <stop offset="1" stopColor="#ef8d2b" />
        </linearGradient>
        <linearGradient id="signin-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a4eaf3" />
          <stop offset=".56" stopColor="#6bcce1" />
          <stop offset="1" stopColor="#419fbe" />
        </linearGradient>
        <filter id="signin-brand-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" />
          <feOffset dy="4" />
          <feComponentTransfer><feFuncA type="linear" slope=".3" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter="url(#signin-brand-shadow)" stroke="#432d60" strokeWidth="5.5" strokeLinejoin="round">
        <rect x="100" y="4" width="58" height="58" rx="17" fill="url(#signin-purple)" />
        <rect x="51" y="54" width="58" height="58" rx="16" fill="url(#signin-purple)" />
        <rect x="100" y="54" width="58" height="58" rx="15" fill="url(#signin-orange)" />
        <rect x="149" y="54" width="58" height="58" rx="16" fill="url(#signin-blue)" />
        <g fill="none" stroke="#fff" strokeOpacity=".68" strokeWidth="3.5" strokeLinecap="round">
          <path d="M113 12 Q129 5 145 12" />
          <path d="M63 62 Q79 55 96 62" />
          <path d="M112 62 Q129 55 146 62" />
          <path d="M161 62 Q178 55 194 62" />
        </g>
      </g>
      <g fontFamily="'Arial Rounded MT Bold','Trebuchet MS','Arial Black',system-ui,sans-serif" fontWeight="1000" textAnchor="middle">
        <text x="130" y="149" fontSize="48" letterSpacing="-2.8" textLength="216" lengthAdjust="spacingAndGlyphs" fill="#fffaff" stroke="#432d60" strokeWidth="12" strokeLinejoin="round" paintOrder="stroke fill">Block</text>
        <text x="130" y="184" fontSize="48" letterSpacing="-2.6" textLength="181" lengthAdjust="spacingAndGlyphs" fill="#fffaff" stroke="#432d60" strokeWidth="12" strokeLinejoin="round" paintOrder="stroke fill">Party</text>
        <text x="130" y="149" fontSize="48" letterSpacing="-2.8" textLength="216" lengthAdjust="spacingAndGlyphs" fill="#fffaff">Block</text>
        <text x="130" y="184" fontSize="48" letterSpacing="-2.6" textLength="181" lengthAdjust="spacingAndGlyphs" fill="#fffaff">Party</text>
      </g>
    </svg>
  );
}

function GoogleMark() {
  return <span className="signin-google-mark" aria-hidden="true">G</span>;
}

function MailMark() {
  return (
    <svg className="signin-provider-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 7 L12 13 L19.5 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg className="signin-provider-icon signin-apple-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M16.7 12.7c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.2-2.7.8-3.4.8s-1.8-.8-3-.8c-1.6 0-3.1.9-3.9 2.3-1.7 2.9-.4 7.1 1.2 9.4.8 1.1 1.7 2.4 2.9 2.3 1.2-.1 1.6-.8 3-.8s1.8.8 3 .8 2.1-1.1 2.8-2.3c.9-1.3 1.2-2.6 1.2-2.7-.1 0-2.5-1-2.5-3.9ZM14.5 6.1c.6-.8 1.1-1.9 1-3.1-1 .1-2.2.7-2.9 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.5 2.9-1.3Z" />
    </svg>
  );
}

export default function AuthScreen({ notice, onPlayOffline }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('welcome');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  function changeMode(next: AuthMode) {
    setMode(next);
    setMessage('');
    setShowPassword(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setMessage('Your passwords do not match. Please try again.');
        return;
      }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
        setMessage('Use 3–20 letters, numbers or underscores for your username.');
        return;
      }
      setMessage('Account creation is not connected yet. Your details have not been sent or saved. Supabase Auth will be connected later.');
      return;
    }

    if (mode === 'reset') {
      setMessage('Password recovery is not connected yet. No reset email was sent.');
      return;
    }

    setMessage('Email sign-in is not connected yet. No session was created. Supabase Auth will be connected later.');
  }

  function handleProvider(provider: 'Google' | 'Apple') {
    setMessage(`${provider} sign-in is not connected yet. No external login was started.`);
  }

  const isWelcome = mode === 'welcome';
  const title = mode === 'register' ? 'Create an Account' : mode === 'reset' ? 'Reset Password' : 'Sign In to Play';
  const intro = mode === 'register'
    ? 'Create your player profile and get ready to compete.'
    : mode === 'reset'
      ? 'Enter the email address linked to your account.'
      : 'Compete online, save progress, and play with friends.';

  return (
    <main className="auth-screen" aria-label="Sign in or register for Block Party">
      <div className="signin-cloud signin-cloud-top" aria-hidden="true" />
      <div className="signin-cloud signin-cloud-bottom" aria-hidden="true" />
      <div className="signin-floating-block signin-floating-block-left" aria-hidden="true" />
      <div className="signin-floating-block signin-floating-block-right" aria-hidden="true" />

      <div className="auth-content signin-content">
        <div className="auth-brand signin-brand" aria-label="Block Party">
          <BrandLogo />
        </div>

        <section className={`auth-panel signin-panel ${isWelcome ? 'is-welcome' : 'is-form'}`} aria-labelledby="auth-title">
          {notice && <div className="auth-notice signin-notice" role="status">{notice}</div>}
          {message && <div className="auth-message signin-message" role="status">{message}</div>}

          <h1 id="auth-title">{title}</h1>
          <p className="auth-intro signin-intro">{intro}</p>

          {isWelcome ? (
            <>
              <div className="auth-provider-stack signin-provider-stack">
                <button className="auth-provider-button signin-provider-button" type="button" onClick={() => handleProvider('Google')}>
                  <GoogleMark />
                  <span>Continue with Google</span>
                </button>
                <button className="auth-provider-button signin-provider-button" type="button" onClick={() => changeMode('signin')}>
                  <MailMark />
                  <span>Continue with Email</span>
                </button>
                <button className="auth-provider-button signin-provider-button" type="button" onClick={() => handleProvider('Apple')}>
                  <AppleMark />
                  <span>Continue with Apple</span>
                </button>
              </div>

              <div className="auth-divider signin-divider"><span />or<span /></div>
              <button className="auth-create-link" type="button" onClick={() => changeMode('register')}>Create an Account</button>
              <p className="auth-legal signin-legal">By continuing you agree to our<br /><a href="#terms" onClick={(event) => event.preventDefault()}>Terms &amp; Privacy Policy</a></p>
              <button className="signin-offline-link" type="button" onClick={onPlayOffline}>Continue offline</button>
            </>
          ) : (
            <>
              <form className="auth-form signin-form" onSubmit={handleSubmit}>
                {mode === 'register' && (
                  <>
                    <label>
                      <span>Display name</span>
                      <input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your display name" maxLength={32} required />
                    </label>
                    <label>
                      <span>Username</span>
                      <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="3–20 letters, numbers or _" minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" required />
                    </label>
                  </>
                )}
                <label>
                  <span>Email address</span>
                  <input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
                </label>
                {mode !== 'reset' && (
                  <div className="auth-field">
                    <label htmlFor="auth-password">Password</label>
                    <span className="auth-password-wrap">
                      <input id="auth-password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} required />
                      <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button>
                    </span>
                  </div>
                )}
                {mode === 'register' && (
                  <label>
                    <span>Confirm password</span>
                    <input autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter password again" minLength={8} required />
                  </label>
                )}
                {mode === 'signin' && <button type="button" className="auth-forgot" onClick={() => changeMode('reset')}>Forgot password?</button>}
                <button className="auth-submit signin-submit" type="submit">{mode === 'register' ? 'Create Account' : mode === 'reset' ? 'Send Reset Link' : 'Sign In'}<span aria-hidden="true">→</span></button>
              </form>

              <button className="auth-back-link signin-back-link" type="button" onClick={() => changeMode('welcome')}>← Back</button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
