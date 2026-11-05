import { useState, type FormEvent } from 'react';

type AuthMode = 'signin' | 'create' | 'reset';

type AuthScreenProps = {
  notice?: string;
  onPlayOffline: () => void;
};

export default function AuthScreen({ notice, onPlayOffline }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
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
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (mode === 'create') {
      if (password !== confirmPassword) {
        setMessage('Your passwords do not match. Please check them and try again.');
        return;
      }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
        setMessage('Choose a username with 3–20 letters, numbers, or underscores.');
        return;
      }
      setMessage('Account creation is not connected on this build. Your details were not sent or saved. Supabase Auth will be connected in the next integration stage.');
      return;
    }

    if (mode === 'reset') {
      setMessage('Password recovery is not connected yet. No reset email was sent.');
      return;
    }

    setMessage('Sign-in is not connected on this build. No session was created. Supabase Auth will be connected in the next integration stage.');
  }

  function handleProvider(provider: 'Google' | 'Apple') {
    setMessage(`${provider} sign-in is shown in the design but is not connected yet. No external login was started.`);
  }

  const title = mode === 'create' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Welcome back';
  const intro = mode === 'create'
    ? 'Make your player identity and get ready to compete.'
    : mode === 'reset'
      ? 'Enter the email linked to your account.'
      : 'Sign in to play online, save your progress, and compete with friends.';

  return (
    <main className="auth-screen">
      <div className="auth-glow auth-glow-one" aria-hidden="true" />
      <div className="auth-glow auth-glow-two" aria-hidden="true" />
      <div className="auth-content">
        <div className="auth-brand" aria-label="Block Party">
          <span className="auth-brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>Block <strong>Party</strong></span>
        </div>

        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-kicker"><span /> MATCH · CLEAR · COMPETE</div>
          <h1 id="auth-title">{title}</h1>
          <p className="auth-intro">{intro}</p>

          {notice && <div className="auth-notice" role="status">{notice}</div>}
          {message && <div className="auth-message" role="status">{message}</div>}

          {mode !== 'reset' && (
            <>
              <div className="auth-provider-stack">
                <button className="auth-provider-button" type="button" onClick={() => handleProvider('Google')}>
                  <span className="auth-provider-letter" aria-hidden="true">G</span>
                  Continue with Google
                </button>
                <button className="auth-provider-button" type="button" onClick={() => handleProvider('Apple')}>
                  <span className="auth-provider-symbol" aria-hidden="true">A</span>
                  Continue with Apple
                </button>
              </div>
              <div className="auth-divider"><span />or use your email<span /></div>
            </>
          )}

          <div className="auth-mode-tabs" role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'is-selected' : ''} onClick={() => changeMode('signin')}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'is-selected' : ''} onClick={() => changeMode('create')}>Create account</button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'create' && (
              <>
                <label>
                  <span>Display name</span>
                  <input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="How should we call you?" maxLength={32} required />
                </label>
                <label>
                  <span>Username</span>
                  <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Your unique player name" minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" required />
                </label>
              </>
            )}
            <label>
              <span>Email address</span>
              <input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
            </label>
            {mode !== 'reset' && (
              <label>
                <span>Password</span>
                <span className="auth-password-wrap">
                  <input autoComplete={mode === 'create' ? 'new-password' : 'current-password'} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} required />
                  <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button>
                </span>
              </label>
            )}
            {mode === 'create' && (
              <label>
                <span>Confirm password</span>
                <input autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" minLength={8} required />
              </label>
            )}
            {mode === 'signin' && <button type="button" className="auth-forgot" onClick={() => changeMode('reset')}>Forgot password?</button>}
            <button className="auth-submit" type="submit">{mode === 'create' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}<span aria-hidden="true">→</span></button>
          </form>

          {mode === 'reset' && <button className="auth-back-link" type="button" onClick={() => changeMode('signin')}>← Back to sign in</button>}
          {mode === 'signin' && <p className="auth-switch-copy">New to Block Party? <button type="button" onClick={() => changeMode('create')}>Create an account</button></p>}
          {mode === 'create' && <p className="auth-switch-copy">Already have an account? <button type="button" onClick={() => changeMode('signin')}>Sign in</button></p>}
        </section>

        <div className="auth-offline">
          <button type="button" onClick={onPlayOffline}>Play solo offline</button>
          <span>No account needed. Online modes stay locked until you sign in.</span>
        </div>
        <p className="auth-legal">Your email and password stay on this screen in this preview. No account data is sent or stored.</p>
      </div>
    </main>
  );
}
