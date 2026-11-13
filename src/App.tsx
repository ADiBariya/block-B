import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ensureAnonymousIdentity, supabaseConfigured } from './services/supabase';
import { loadGlobalPage, renameGlobalPlayer, searchGlobalPlayers, submitRankedScore, subscribeToGlobalScores } from './services/leaderboardApi';
import { appendUniqueEntries, EventDeduper, nextCursor, validateUsername, type RankEntry, type ScoreNotice } from './game/leaderboard';
import { MAX_REPLAY_ACTIONS, replayGame, type ReplayAction } from './game/competitive';
import {
  GRID_SIZE, PALETTE, canPlace, firstFit, loadScores, loadSession, newGame, newSeededGame,
  pieceSize, placePiece, rotatePiece, saveScores, saveSession,
  type Cell, type Game, type HighScore, type Piece, type Point,
} from './game/engine';
import { gameAudio } from './game/audio';
import { ParticleField } from './game/particles';
import AuthScreen from './components/AuthScreen';
import OnboardingScreen from './components/OnboardingScreen';
import SplashScreen from './components/SplashScreen';

type IconName = 'play' | 'pause' | 'restart' | 'sound' | 'muted' | 'trophy' | 'arrow' | 'close' | 'help' | 'rotate' | 'mouse' | 'sparkle' | 'check' | 'lock' | 'keyboard' | 'calendar' | 'user';
type Status = 'ready' | 'playing' | 'paused' | 'over';
type DialogKind = 'help' | 'scores' | 'global' | 'daily' | 'online' | 'missions' | 'events' | 'profile' | 'statistics' | 'collection' | 'shop' | 'settings' | null;
type LocalStats = { gamesPlayed: number; totalScore: number; totalLines: number; bestCombo: number };
type CosmeticChoice = { theme: 'cream' | 'lavender' | 'mint'; skin: 'classic' | 'gloss' | 'outline' };
const STATS_KEY = 'blockparty.stats.v1';
const COSMETICS_KEY = 'blockparty.cosmetics.v1';
function readStored<T>(key: string, fallback: T): T {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) ?? '{}') }; } catch { return fallback; }
}
function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function dailySeed() {
  const day = localDateKey();
  let hash = 2166136261;
  for (const char of day) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
type InputMode = 'pointer' | 'keyboard' | 'drag';
type DragSession = {
  index: number;
  piece: Piece;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
  touch: boolean;
  rect: DOMRect;
  cellSize: number;
  placement: Point | null;
};
type RankedCheckpoint = {
  sessionId: string;
  seed: number;
  rulesetVersion: number;
  idempotencyKey: string;
  actions: ReplayAction[];
  result?: { score: number; lines: number; moves: number };
};
const RANKED_CHECKPOINT_KEY = 'blockparty.ranked-session.v1';

function loadRankedCheckpoint(): RankedCheckpoint | null {
  try {
    const value = JSON.parse(localStorage.getItem(RANKED_CHECKPOINT_KEY) ?? 'null') as RankedCheckpoint | null;
    if (!value || typeof value.sessionId !== 'string' || !Number.isInteger(value.seed) || !Array.isArray(value.actions) || typeof value.idempotencyKey !== 'string') return null;
    return value;
  } catch { return null; }
}

function saveRankedCheckpoint(value: RankedCheckpoint | null) {
  try {
    if (value) localStorage.setItem(RANKED_CHECKPOINT_KEY, JSON.stringify(value));
    else localStorage.removeItem(RANKED_CHECKPOINT_KEY);
  } catch { /* Ranked submission can still proceed from memory. */ }
}

function HomeAvatar() {
  return (
    <svg className="home-avatar-art" viewBox="0 0 48 48" role="img" aria-label="Player avatar">
      <defs>
        <clipPath id="home-avatar-clip"><circle cx="24" cy="24" r="23" /></clipPath>
        <linearGradient id="home-avatar-bg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b9e4eb" /><stop offset="1" stopColor="#9a8bd0" /></linearGradient>
      </defs>
      <g clipPath="url(#home-avatar-clip)">
        <rect width="48" height="48" fill="url(#home-avatar-bg)" />
        <path d="M2 48 Q5 33 24 32 Q43 33 46 48" fill="#5d4b88" />
        <path d="M10 22 Q9 5 24 5 Q40 5 38 24 L35 31 L13 31Z" fill="#34264f" />
        <ellipse cx="24" cy="22" rx="12" ry="14" fill="#f1c29f" />
        <path d="M12 20 Q13 6 25 7 Q37 7 37 19 Q31 13 24 14 Q18 15 12 20Z" fill="#302344" />
        <path d="M14 20 Q17 14 23 14" fill="none" stroke="#4a345c" strokeWidth="3" strokeLinecap="round" />
        <circle cx="20" cy="23" r="1.2" fill="#34233e" /><circle cx="29" cy="23" r="1.2" fill="#34233e" />
        <path d="M21 29 Q24 31 28 28" fill="none" stroke="#b16d6b" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M17 36 L24 42 L31 36 L34 48 L14 48Z" fill="#8d7bc1" />
        <path d="M11 18 Q9 9 19 5 Q31 1 38 12 Q30 8 24 11 Q17 12 11 18Z" fill="#302344" />
      </g>
      <circle cx="24" cy="24" r="22.5" fill="none" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

function HomeBrandLogo() {
  return (
    <svg className="home-brand-logo" viewBox="0 0 240 238" role="img" aria-label="Block Party">
      <defs>
        <linearGradient id="home-logo-purple" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d6b0ff" /><stop offset=".52" stopColor="#a56ce5" /><stop offset="1" stopColor="#7547be" /></linearGradient>
        <linearGradient id="home-logo-orange" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffe58b" /><stop offset=".55" stopColor="#ffb832" /><stop offset="1" stopColor="#e98a25" /></linearGradient>
        <linearGradient id="home-logo-blue" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b6eef5" /><stop offset=".55" stopColor="#68cce0" /><stop offset="1" stopColor="#359ebc" /></linearGradient>
        <filter id="home-logo-shadow" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur in="SourceAlpha" stdDeviation="3" /><feOffset dy="4" /><feComponentTransfer><feFuncA type="linear" slope=".32" /></feComponentTransfer><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <g filter="url(#home-logo-shadow)" stroke="#3d2859" strokeWidth="5" strokeLinejoin="round">
        <rect x="92" y="4" width="56" height="56" rx="16" fill="url(#home-logo-purple)" />
        <rect x="45" y="49" width="56" height="56" rx="15" fill="url(#home-logo-purple)" />
        <rect x="92" y="49" width="56" height="56" rx="14" fill="url(#home-logo-orange)" />
        <rect x="139" y="49" width="56" height="56" rx="15" fill="url(#home-logo-blue)" />
        <g fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="3.2" strokeLinecap="round">
          <path d="M104 12 Q120 5 136 12" /><path d="M56 57 Q72 50 88 57" /><path d="M103 57 Q119 50 135 57" /><path d="M150 57 Q166 50 182 57" />
        </g>
      </g>
      <g fontFamily="'Arial Rounded MT Bold','Trebuchet MS','Arial Black',system-ui,sans-serif" fontWeight="1000" textAnchor="middle">
        <text x="120" y="157" fontSize="62" letterSpacing="-3.6" textLength="220" lengthAdjust="spacingAndGlyphs" fill="#fffaff" stroke="#3d2859" strokeWidth="12" strokeLinejoin="round" paintOrder="stroke fill">Block</text>
        <text x="120" y="215" fontSize="62" letterSpacing="-3.4" textLength="184" lengthAdjust="spacingAndGlyphs" fill="#fffaff" stroke="#3d2859" strokeWidth="12" strokeLinejoin="round" paintOrder="stroke fill">Party</text>
        <text x="120" y="157" fontSize="62" letterSpacing="-3.6" textLength="220" lengthAdjust="spacingAndGlyphs" fill="#fffaff">Block</text>
        <text x="120" y="215" fontSize="62" letterSpacing="-3.4" textLength="184" lengthAdjust="spacingAndGlyphs" fill="#fffaff">Party</text>
      </g>
    </svg>
  );
}

function HomeActionIcon({ kind }: { kind: 'online' | 'solo' | 'daily' }) {
  if (kind === 'online') return (
    <svg data-home-icon="crossed-swords" viewBox="0 0 44 44" aria-hidden="true">
      <defs>
        <linearGradient id="sword-silver" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff" />
          <stop offset=".42" stopColor="#f7f1ff" />
          <stop offset=".72" stopColor="#d9c9f0" />
          <stop offset="1" stopColor="#a58ecb" />
        </linearGradient>
        <linearGradient id="sword-guard" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ffe5a5" />
          <stop offset=".5" stopColor="#d9b5f5" />
          <stop offset="1" stopColor="#9873cc" />
        </linearGradient>
        <linearGradient id="sword-handle" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f4ddff" />
          <stop offset="1" stopColor="#9268c4" />
        </linearGradient>
        <filter id="sword-depth" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" />
          <feOffset dy="1.1" />
          <feComponentTransfer><feFuncA type="linear" slope=".28" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter="url(#sword-depth)" stroke="#45305f" strokeWidth="1.65" strokeLinejoin="round" strokeLinecap="round">
        <g>
          <path d="M5 4.2 L12.2 6.2 L30.6 24.5 L24.5 30.6 L6.2 12.2 Z" fill="url(#sword-silver)" />
          <path d="M5 4.2 L9.3 11.5 L24.5 26.7" fill="none" stroke="#fff" strokeWidth="1.5" />
          <path d="M7.2 5.4 L12.2 6.2 L30.6 24.5 L27.7 27.4 L12.2 11.9Z" fill="#fff" opacity=".22" stroke="none" />
          <path d="M18.7 25.2 L25.2 18.7 L28.2 21.7 L21.7 28.2Z" fill="url(#sword-guard)" />
          <path d="M21.3 28.4 L32.8 39.2" fill="none" stroke="url(#sword-handle)" strokeWidth="4.2" />
          <path d="M26.2 32.9 L30.1 29.1" fill="none" stroke="#fff1ff" strokeWidth="1.2" />
          <path d="M30.5 37 L34.1 40.2" fill="none" stroke="#5c407f" strokeWidth="2.3" />
          <circle cx="35.4" cy="40.8" r="2.5" fill="url(#sword-guard)" />
        </g>
        <g>
          <path d="M39 4.2 L31.8 6.2 L13.4 24.5 L19.5 30.6 L37.8 12.2 Z" fill="url(#sword-silver)" />
          <path d="M39 4.2 L34.7 11.5 L19.5 26.7" fill="none" stroke="#fff" strokeWidth="1.5" />
          <path d="M36.8 5.4 L31.8 6.2 L13.4 24.5 L16.3 27.4 L31.8 11.9Z" fill="#fff" opacity=".22" stroke="none" />
          <path d="M25.3 25.2 L18.8 18.7 L15.8 21.7 L22.3 28.2Z" fill="url(#sword-guard)" />
          <path d="M22.7 28.4 L11.2 39.2" fill="none" stroke="url(#sword-handle)" strokeWidth="4.2" />
          <path d="M17.8 32.9 L13.9 29.1" fill="none" stroke="#fff1ff" strokeWidth="1.2" />
          <path d="M13.5 37 L9.9 40.2" fill="none" stroke="#5c407f" strokeWidth="2.3" />
          <circle cx="8.6" cy="40.8" r="2.5" fill="url(#sword-guard)" />
        </g>
      </g>
      <path d="M19.4 18.6 L24.6 23.8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M17.2 20.8 L22.4 26" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );

  if (kind === 'solo') return (
    <svg data-home-icon="gamepad" viewBox="0 0 36 36" aria-hidden="true">
      <defs>
        <linearGradient id="pad-shell" x1="0" y1="0" x2=".15" y2="1">
          <stop stopColor="#fff" /><stop offset="1" stopColor="#e4efc8" />
        </linearGradient>
      </defs>
      <path d="M11.2 9.2 H24.8 C28.8 9.2 31.1 12.1 32 17 L33.5 24.1 C34.5 29.1 30.1 32 26.4 28.9 L21.6 24.8 H14.4 L9.6 28.9 C5.9 32 1.5 29.1 2.5 24.1 L4 17 C4.9 12.1 7.2 9.2 11.2 9.2Z" fill="url(#pad-shell)" stroke="#344b36" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M10.3 14.7 V21.3 M7 18 H13.6" stroke="#344b36" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="23.1" cy="15.9" r="1.65" fill="#344b36" />
      <circle cx="27.1" cy="19.7" r="1.65" fill="#344b36" />
      <path d="M18.4 11.8 Q23 10 27 12.2" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".9" />
    </svg>
  );

  return (
    <svg data-home-icon="daily-calendar" viewBox="0 0 36 36" aria-hidden="true">
      <defs>
        <linearGradient id="calendar-paper" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fff8f4" /><stop offset="1" stopColor="#ffe6df" />
        </linearGradient>
        <linearGradient id="calendar-red" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fa8881" /><stop offset="1" stopColor="#d84f58" />
        </linearGradient>
      </defs>
      <rect x="5" y="7" width="26" height="25" rx="4.8" fill="url(#calendar-paper)" stroke="#c9575e" strokeWidth="2.1" />
      <path d="M5 12.3 Q5 7 10 7 H26 Q31 7 31 12.3 V14 H5Z" fill="url(#calendar-red)" />
      <path d="M11 4.5 V10 M25 4.5 V10" stroke="#b84853" strokeWidth="3.1" strokeLinecap="round" />
      <path d="M11 19.2 H15.2 V23.2 H11Z M20.8 19.2 H25 V23.2 H20.8Z" fill="#f4a09a" stroke="#cb5a61" strokeWidth="1" />
      <path d="M15.5 28.1 L18 24.4 L20.5 28.1" fill="none" stroke="#d45d63" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HomeTileIcon({ kind }: { kind: 'missions' | 'pass' | 'events' }) {
  if (kind === 'missions') return (
    <svg data-home-icon="missions-badge" viewBox="0 0 36 36" aria-hidden="true">
      <defs>
        <linearGradient id="mission-purple" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#c8b3fa" /><stop offset="1" stopColor="#8063cf" />
        </linearGradient>
      </defs>
      <path d="M11 5.2 H25 L29 9.2 V28.2 Q29 30.5 26.7 30.5 H9.3 Q7 30.5 7 28.2 V9.2Z" fill="url(#mission-purple)" stroke="#6950a5" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13 5 V9.5 H23 V5" fill="#8d70d0" stroke="#6950a5" strokeWidth="1.3" strokeLinejoin="round" />
      <rect x="11.2" y="12.2" width="13.6" height="13.8" rx="2.3" fill="#fff9ff" stroke="#8c72c5" strokeWidth="1.2" />
      <path d="M14.4 18.8 L17 21.3 L22.1 15.7" fill="none" stroke="#785ab7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M25.6 7.5 L26.4 9.6 L28.5 10.4 L26.4 11.2 L25.6 13.3 L24.8 11.2 L22.7 10.4 L24.8 9.6Z" fill="#fff2a6" />
    </svg>
  );

  if (kind === 'pass') return (
    <svg data-home-icon="crown-pass" viewBox="0 0 36 36" aria-hidden="true">
      <defs>
        <linearGradient id="pass-gold" x1="0" y1="0" x2=".2" y2="1">
          <stop stopColor="#ffe58a" /><stop offset=".5" stopColor="#ffc34e" /><stop offset="1" stopColor="#e79a32" />
        </linearGradient>
      </defs>
      <path d="M5 11.5 L12 16 L17.7 5.5 L23.8 16 L31 11.5 L28 26 H8Z" fill="url(#pass-gold)" stroke="#c9822f" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 26 H28 V29.5 Q28 31 26.5 31 H9.5 Q8 31 8 29.5Z" fill="#e99d36" stroke="#c9822f" strokeWidth="1.5" />
      <path d="M9 24 H27" stroke="#fff1b1" strokeWidth="1.6" strokeLinecap="round" opacity=".9" />
      <circle cx="5" cy="10.5" r="2.5" fill="#fff0a4" stroke="#c9822f" strokeWidth="1" />
      <circle cx="17.7" cy="5.2" r="2.7" fill="#fff2a6" stroke="#c9822f" strokeWidth="1" />
      <circle cx="31" cy="10.5" r="2.5" fill="#fff0a4" stroke="#c9822f" strokeWidth="1" />
      <path d="M17.8 12 L19.2 15.2 L22.6 15.4 L20 17.6 L20.8 20.9 L17.8 19.1 L14.9 20.9 L15.6 17.6 L13.1 15.4 L16.4 15.2Z" fill="#fff7cf" opacity=".94" />
    </svg>
  );

  return (
    <svg data-home-icon="event-mascot" viewBox="0 0 36 36" aria-hidden="true">
      <defs>
        <linearGradient id="event-mascot-fill" x1="0" y1="0" x2=".7" y2="1">
          <stop stopColor="#ffc7ba" /><stop offset=".65" stopColor="#f39d99" /><stop offset="1" stopColor="#dc7e83" />
        </linearGradient>
      </defs>
      <path d="M8.5 12.6 Q4.2 5.5 9.8 4.8 Q14.1 4.3 16 10.1 Q18 9.2 20 10.1 Q21.9 4.3 26.2 4.8 Q31.8 5.5 27.5 12.6 Q31 16 30.2 22.3 Q29.1 30.5 18 31.2 Q6.9 30.5 5.8 22.3 Q5 16 8.5 12.6Z" fill="url(#event-mascot-fill)" stroke="#bd6876" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10.2 8.1 Q12.3 7.1 13.9 11.1" fill="none" stroke="#ffe9e1" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="13.6" cy="18.1" r="1.55" fill="#713c5a" />
      <circle cx="22.4" cy="18.1" r="1.55" fill="#713c5a" />
      <path d="M15.1 23 Q18 25.8 20.9 23" fill="none" stroke="#a74f66" strokeWidth="1.65" strokeLinecap="round" />
      <ellipse cx="10.2" cy="21.3" rx="2.5" ry="1.5" fill="#f27f91" opacity=".55" />
      <ellipse cx="25.8" cy="21.3" rx="2.5" ry="1.5" fill="#f27f91" opacity=".55" />
      <path d="M18 13.5 L19.2 15 L18 16.3 L16.8 15Z" fill="#fff0e9" opacity=".85" />
    </svg>
  );
}

function HomeCoinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="home-coin-fill" x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor="#ffe68b" />
          <stop offset=".52" stopColor="#ffc746" />
          <stop offset="1" stopColor="#e99b2d" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10.2" fill="url(#home-coin-fill)" stroke="#d98a2d" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="7.4" fill="none" stroke="#fff0a8" strokeWidth="1.15" />
      <path d="M14.9 8.8 C13.8 7.4 9.2 7.2 9.1 9.8 C9 12.3 15.1 11.2 14.9 14 C14.7 16.7 10.1 17 8.9 14.8 M12 6.9 V17.2" fill="none" stroke="#9c6823" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5.7 7.8 Q7.2 4.5 11.4 4" fill="none" stroke="#fff8cc" strokeWidth="1.2" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}

function HomeNavigationIcon({ kind }: { kind: 'home' | 'leaderboard' | 'profile' }) {
  if (kind === 'home') return (
    <svg data-home-icon="home-house" viewBox="0 0 36 36" aria-hidden="true">
      <defs>
        <linearGradient id="nav-house-roof" x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor="#ffe5a0" /><stop offset="1" stopColor="#edaa52" />
        </linearGradient>
        <linearGradient id="nav-house-body" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#e4cfff" /><stop offset="1" stopColor="#a985db" />
        </linearGradient>
      </defs>
      <path d="M4 16.1 L18 4.8 L32 16.1" fill="none" stroke="#574075" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.8 14.7 L18 5.7 L29.2 14.7 V30 Q29.2 31.5 27.5 31.5 H8.5 Q6.8 31.5 6.8 30Z" fill="url(#nav-house-body)" stroke="#60477f" strokeWidth="2" strokeLinejoin="round" />
      <path d="M4 16.1 L18 4.8 L32 16.1 L28.4 19.3 L18 11 L7.6 19.3Z" fill="url(#nav-house-roof)" stroke="#60477f" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14.2 31 V21.2 Q14.2 19.9 15.5 19.9 H20.5 Q21.8 19.9 21.8 21.2 V31Z" fill="#fff1ca" stroke="#8d68aa" strokeWidth="1.5" />
      <rect x="9.6" y="19.4" width="3.2" height="4.1" rx=".8" fill="#fff5dc" stroke="#9973bb" strokeWidth="1" />
      <rect x="23.2" y="19.4" width="3.2" height="4.1" rx=".8" fill="#fff5dc" stroke="#9973bb" strokeWidth="1" />
      <path d="M8.5 15.7 L18 8.1 L27.5 15.7" fill="none" stroke="#fff4ca" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
  if (kind === 'leaderboard') return (
    <svg data-home-icon="leaderboard-podium" viewBox="0 0 36 36" aria-hidden="true">
      <defs>
        <linearGradient id="nav-leader-head" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#e0d4f7" /><stop offset="1" stopColor="#b39bdf" />
        </linearGradient>
        <linearGradient id="nav-leader-body" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#bda7e8" /><stop offset="1" stopColor="#8066b7" />
        </linearGradient>
      </defs>
      <circle cx="18" cy="8.4" r="4.4" fill="url(#nav-leader-head)" stroke="#584273" strokeWidth="1.6" />
      <circle cx="7.8" cy="13.2" r="3.5" fill="#d9cbf2" stroke="#584273" strokeWidth="1.4" />
      <circle cx="28.2" cy="13.2" r="3.5" fill="#d9cbf2" stroke="#584273" strokeWidth="1.4" />
      <path d="M9.2 29.8 Q9.2 18.1 18 18.1 Q26.8 18.1 26.8 29.8 Q26.8 31.2 25.2 31.2 H10.8 Q9.2 31.2 9.2 29.8Z" fill="url(#nav-leader-body)" stroke="#584273" strokeWidth="1.7" />
      <path d="M1.9 28.8 Q2.4 19.4 8.1 19.4 Q10.1 19.4 11.5 21.1 Q9 24.4 9 29.5 H3.4 Q1.8 29.5 1.9 28.8Z" fill="#c3b1e8" stroke="#584273" strokeWidth="1.4" />
      <path d="M34.1 28.8 Q33.6 19.4 27.9 19.4 Q25.9 19.4 24.5 21.1 Q27 24.4 27 29.5 H32.6 Q34.2 29.5 34.1 28.8Z" fill="#c3b1e8" stroke="#584273" strokeWidth="1.4" />
      <path d="M14.5 6.8 Q18 3.1 21.4 6.8" fill="none" stroke="#fff8ff" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M15.5 22 L18 24.4 L20.5 22" fill="none" stroke="#f3eaff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  return (
    <svg data-home-icon="profile-avatar" viewBox="0 0 36 36" aria-hidden="true">
      <defs>
        <linearGradient id="nav-profile-shirt" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#a78bd9" /><stop offset="1" stopColor="#6e579c" />
        </linearGradient>
      </defs>
      <path d="M5.5 31 Q6.2 20.4 15.8 19.7 H20.2 Q29.8 20.4 30.5 31 Q30.7 33 28.6 33 H7.4 Q5.3 33 5.5 31Z" fill="url(#nav-profile-shirt)" stroke="#49365f" strokeWidth="1.9" />
      <path d="M13 20.2 L18 26.2 L23 20.2 L26 31 H10Z" fill="#eee4ff" stroke="#6e579c" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M11.1 12.4 Q10.2 4.1 18 3.2 Q26.6 3.2 25.2 13.2 Q24.2 20.5 18 21 Q11.8 20.5 11.1 12.4Z" fill="#efbd98" stroke="#533d68" strokeWidth="1.8" />
      <path d="M10.7 13.2 Q7.1 3.7 16.7 2.2 Q26.2 .7 26.1 10.7 Q23.9 7.5 19.4 7.2 Q15 7 10.7 13.2Z" fill="#45335e" stroke="#45335e" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M14.2 13.3 Q15.5 12.3 16.6 13.3 M19.4 13.3 Q20.5 12.3 21.8 13.3" fill="none" stroke="#4e344f" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M16.1 17 Q18 18.1 20 17" fill="none" stroke="#a35e68" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M9.1 28.6 L12.1 24.3 M26.9 28.6 L23.9 24.3" stroke="#d8c7f0" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    play: <path d="m9 5 10 7-10 7V5Z" fill="currentColor" strokeWidth="1.4" />,
    pause: <path d="M8 5v14M16 5v14" strokeWidth="2.8" />,
    restart: <path d="M3 10a9 9 0 1 1 1.8 8.4M3 4v6h6" />,
    sound: <path d="m11 4-6 5H2v6h3l6 5V4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" />,
    muted: <path d="m11 4-6 5H2v6h3l6 5V4ZM17 9l5 6M22 9l-5 6" />,
    trophy: <path d="M7 3h10v5c0 4-2.2 6-5 6S7 12 7 8V3ZM7 5H3v3c0 2.4 1.7 4 5 4M17 5h4v3c0 2.4-1.7 4-5 4M12 14v6M8 21h8" />,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 8.5a2.5 2.5 0 0 1 4.9.5c0 1.8-2.5 2-2.5 4M12 16.8v.1" /></>,
    rotate: <path d="M20 9a8 8 0 1 0 .1 6M20 3v6h-6" />,
    mouse: <><rect x="6" y="2" width="12" height="20" rx="6" /><path d="M12 6v4" /></>,
    sparkle: <path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21c.5-4.1 2.8-6.2 7-6.2s6.5 2.1 7 6.2" /></>,
    keyboard: <><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 15h8" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>;
}

function BrandMark({ className = '' }: { className?: string }) {
  return <span className={`brand-mark ${className}`} aria-hidden="true"><i /><i /><i /><i /></span>;
}

function PieceView({ piece, className = '', style }: { piece: Piece; className?: string; style?: CSSProperties }) {
  const { rows, cols } = pieceSize(piece);
  const cellLimit = Math.min(25, Math.floor((64 - (rows - 1) * 3) / rows), cols >= 4 ? 19 : 25);
  return <span className={`piece-shape ${className}`} style={{ '--piece-cell': `min(var(--piece-limit, 25px), ${cellLimit}px, ${cols >= 4 ? '4.2vw' : '25px'})`, gridTemplateColumns: `repeat(${cols}, var(--piece-cell))`, gridTemplateRows: `repeat(${rows}, var(--piece-cell))`, ...style } as CSSProperties} aria-hidden="true">
    {piece.cells.map(({ row, col }) => <span className="block" key={`${row}-${col}`} style={{ gridRow: row + 1, gridColumn: col + 1, '--block-color': PALETTE[piece.color] } as CSSProperties} />)}
  </span>;
}

function AnimatedScore({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.current = value;
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 360, 1);
      current.current = Math.round(from + (value - from) * (1 - Math.pow(1 - progress, 3)));
      setDisplay(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

function Key({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}

function formatDate(date: string) {
  const value = new Date(date);
  const today = new Date();
  if (value.toDateString() === today.toDateString()) return 'Today';
  return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const HOW_TO = [
  { title: 'Find a little space', text: 'Drag a block onto the board. Any open spot is a good start.' },
  { title: 'Make a little magic', text: 'Fill a row or column to clear it. More lines, bigger smiles.' },
  { title: 'Keep the good going', text: 'Use all three blocks for a fresh set. Keep space for what comes next.' },
];

type PraiseTier = 'nice' | 'great' | 'amazing' | 'incredible' | 'legendary';
type Feedback = {
  id: number;
  word: string;
  kicker: string;
  points: number;
  combo: number;
  lines: number;
  tier: PraiseTier;
};

const PRAISES: Record<PraiseTier, { word: string; kicker: string }> = {
  nice: { word: 'NICE!', kicker: 'A satisfying little clear' },
  great: { word: 'GREAT!', kicker: "You're on a roll" },
  amazing: { word: 'AMAZING!', kicker: 'What a beautifully big move' },
  incredible: { word: 'INCREDIBLE!', kicker: 'The blocks never stood a chance' },
  legendary: { word: 'LEGENDARY!', kicker: 'Absolutely flawless' },
};

function getPraise(lines: number, combo: number): PraiseTier {
  if (lines >= 3 || combo >= 5 || (lines >= 2 && combo >= 4)) return 'legendary';
  if ((lines >= 2 && combo >= 2) || combo >= 4) return 'incredible';
  if (lines >= 2 || combo >= 3) return 'amazing';
  if (combo >= 2) return 'great';
  return 'nice';
}

export default function App() {
  const [savedGame] = useState(loadSession);
  const [game, setGame] = useState<Game>(() => savedGame ?? newGame());
  const [status, setStatus] = useState<Status>('ready');
  const [scores, setScores] = useState<HighScore[]>(loadScores);
  const [sound, setSound] = useState(() => {
    try { return localStorage.getItem('blockparty.sound') !== 'off'; } catch { return true; }
  });
  const [hapticsEnabled, setHapticsEnabled] = useState(() => { try { return localStorage.getItem('blockparty.haptics') !== 'off'; } catch { return true; } });
  const [motionEnabled, setMotionEnabled] = useState(() => { try { return localStorage.getItem('blockparty.motion') !== 'off'; } catch { return true; } });
  const [localStats, setLocalStats] = useState<LocalStats>(() => readStored(STATS_KEY, { gamesPlayed: 0, totalScore: 0, totalLines: 0, bestCombo: 0 }));
  const [cosmetics, setCosmetics] = useState<CosmeticChoice>(() => readStored(COSMETICS_KEY, { theme: 'cream', skin: 'classic' }));
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [mobileScreen, setMobileScreen] = useState<'splash' | 'auth' | 'onboarding' | 'home' | 'game'>(() => {
    const isMobileClient = Capacitor.isNativePlatform() || window.matchMedia('(max-width: 740px)').matches;
    if (!isMobileClient) return 'home';
    try {
      // A first-time mobile player sees the branded splash before the welcome page.
      if (localStorage.getItem('blockparty.onboarding.welcome.v1') !== 'complete') return 'splash';
      return localStorage.getItem('blockparty.entry.v1') === 'offline' ? 'home' : 'auth';
    } catch {
      return 'splash';
    }
  });
  const [authNotice, setAuthNotice] = useState('');
  const [selected, setSelected] = useState<number | null>(0);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>('pointer');
  const [dragged, setDragged] = useState<{ piece: Piece; index: number } | null>(null);
  const [placedCells, setPlacedCells] = useState<number[]>([]);
  const [clearFlash, setClearFlash] = useState<{ cells: number[]; board: Cell[]; id: number } | null>(null);
  const [shaking, setShaking] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isRecord, setIsRecord] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [liveMessage, setLiveMessage] = useState('Welcome to Block Party. Press Enter to play.');
  const [identityState, setIdentityState] = useState<'unconfigured' | 'loading' | 'ready' | 'offline'>('unconfigured');
  const [identityError, setIdentityError] = useState('');
  const [rankedNotice, setRankedNotice] = useState('');
  const [startPending, setStartPending] = useState(false);
  const [scoreVerification, setScoreVerification] = useState<'none' | 'verified' | 'provisional'>('none');
  const [globalEntries, setGlobalEntries] = useState<RankEntry[]>([]);
  const [globalTopThree, setGlobalTopThree] = useState<RankEntry[]>([]);
  const [globalMyEntry, setGlobalMyEntry] = useState<RankEntry | null>(null);
  const [globalCursor, setGlobalCursor] = useState<ReturnType<typeof nextCursor>>(null);
  const [globalHasMore, setGlobalHasMore] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<RankEntry[] | null>(null);
  const [globalUsername, setGlobalUsername] = useState('');
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameMessage, setUsernameMessage] = useState('');
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');
  const [globalRefreshPending, setGlobalRefreshPending] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const nativeDialogRef = useRef<HTMLDialogElement>(null);
  const particles = useRef<ParticleField | null>(null);
  const drag = useRef<DragSession | null>(null);
  const dragFrame = useRef(0);
  const suppressClickUntil = useRef(0);
  const resumeAfterDialog = useRef(false);
  const gameRef = useRef(game);
  const statusRef = useRef(status);
  const selectedRef = useRef(selected);
  const scoresRef = useRef(scores);
  const placeActionRef = useRef<(index: number, row: number, col: number) => void>(() => {});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const initialRankedCheckpoint = useRef(loadRankedCheckpoint());
  const rankedSession = useRef<{ sessionId: string; seed: number; rulesetVersion: number } | null>(initialRankedCheckpoint.current);
  const replayActions = useRef<ReplayAction[]>(initialRankedCheckpoint.current?.actions ?? []);
  const submissionIdempotencyKey = useRef<string | null>(initialRankedCheckpoint.current?.idempotencyKey ?? null);
  const seenRealtimeEvents = useRef(new EventDeduper());
  const leaderboardScroll = useRef<HTMLDivElement>(null);
  const autoRetryStarted = useRef(false);
  const touchStartY = useRef<number | null>(null);

  gameRef.current = game;
  statusRef.current = status;
  selectedRef.current = selected;
  scoresRef.current = scores;

  function after(name: string, action: () => void, delay: number) {
    clearTimeout(timers.current[name]);
    timers.current[name] = setTimeout(action, delay);
  }

  function changeStatus(next: Status) {
    statusRef.current = next;
    setStatus(next);
  }

  useEffect(() => {
    if (canvasRef.current) particles.current = new ParticleField(canvasRef.current);
    return () => {
      particles.current?.destroy();
      Object.values(timers.current).forEach(clearTimeout);
      cancelAnimationFrame(dragFrame.current);
    };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const isGame = mobileScreen === 'game';
    // Capacitor 8 SystemBars works with Android's enforced edge-to-edge layout.
    // Dark icons are used on the light onboarding/home surfaces; the game uses light icons.
    void SystemBars.setStyle({ style: isGame ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
  }, [mobileScreen]);

  useEffect(() => {
    if (mobileScreen !== 'splash') return;
    const splashTimer = window.setTimeout(() => setMobileScreen('auth'), 2150);
    return () => window.clearTimeout(splashTimer);
  }, [mobileScreen]);

  useEffect(() => {
    if (mobileScreen !== 'onboarding' && mobileScreen !== 'splash' && mobileScreen !== 'auth') return;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    window.scrollTo(0, 0);
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [mobileScreen]);

  // No automatic anonymous account is created here. Online play will require a real account after Supabase Auth is connected.

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let removeListener: (() => void) | undefined;
    void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (dialog) setDialog(null);
      else if (statusRef.current === 'playing') changeStatus('paused');
      else if (statusRef.current === 'paused') changeStatus('playing');
      else if (canGoBack) window.history.back();
      else void CapacitorApp.exitApp();
    }).then((listener) => {
      if (disposed) void listener.remove();
      else removeListener = () => { void listener.remove(); };
    });
    return () => {
      disposed = true;
      removeListener?.();
    };
  }, [dialog]);

  useEffect(() => {
    gameAudio.enabled = sound;
    try { localStorage.setItem('blockparty.sound', sound ? 'on' : 'off'); } catch { /* Optional preference. */ }
  }, [sound]);

  useEffect(() => {
    try {
      localStorage.setItem('blockparty.haptics', hapticsEnabled ? 'on' : 'off');
      localStorage.setItem('blockparty.motion', motionEnabled ? 'on' : 'off');
      localStorage.setItem(COSMETICS_KEY, JSON.stringify(cosmetics));
    } catch { /* Preferences remain usable for this session. */ }
  }, [hapticsEnabled, motionEnabled, cosmetics]);

  useEffect(() => {
    document.documentElement.dataset.motion = motionEnabled ? 'full' : 'reduced';
  }, [motionEnabled]);

  useEffect(() => {
    if ((status === 'playing' || status === 'paused') && game.moves > 0) saveSession(game);
    if (status === 'over') saveSession(null);
  }, [game, status]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && statusRef.current === 'playing') {
        statusRef.current = 'paused';
        setStatus('paused');
        drag.current = null;
        setDragged(null);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    const element = nativeDialogRef.current;
    if (dialog && element && !element.open) element.showModal();
    if (!dialog && element?.open) element.close();
  }, [dialog]);

  function recordRun(run: Game) {
    if (!run.moves || scoresRef.current.some((entry) => entry.id === run.id)) return false;
    const record = run.score > (scoresRef.current[0]?.score ?? 0);
    const next = [...scoresRef.current, { id: run.id, score: run.score, lines: run.lines, combo: run.bestCombo, date: new Date().toISOString() }]
      .sort((a, b) => b.score - a.score).slice(0, 10);
    scoresRef.current = next;
    setScores(next);
    saveScores(next);
    setLocalStats((current) => {
      const updated = { gamesPlayed: current.gamesPlayed + 1, totalScore: current.totalScore + run.score, totalLines: current.totalLines + run.lines, bestCombo: Math.max(current.bestCombo, run.bestCombo) };
      try { localStorage.setItem(STATS_KEY, JSON.stringify(updated)); } catch { /* Scores are still saved when storage is available. */ }
      return updated;
    });
    return record;
  }

  function startDailyChallenge() {
    setMobileScreen('game');
    const day = localDateKey();
    const fresh = newSeededGame(dailySeed(), `daily-${day}`);
    rankedSession.current = null;
    replayActions.current = [];
    submissionIdempotencyKey.current = null;
    clearReplayCheckpoint();
    setScoreVerification('none');
    setRankedNotice('');
    gameRef.current = fresh;
    setGame(fresh);
    changeStatus('playing');
    setSelected(0);
    setDialog(null);
    saveSession(null);
    gameAudio.play('start');
    focusBoard();
  }

  function focusBoard() {
    requestAnimationFrame(() => boardRef.current?.focus({ preventScroll: true }));
  }

  function persistReplay(result?: RankedCheckpoint['result']) {
    const session = rankedSession.current;
    if (!session) return;
    const checkpoint: RankedCheckpoint = {
      sessionId: session.sessionId,
      seed: session.seed,
      rulesetVersion: session.rulesetVersion,
      idempotencyKey: submissionIdempotencyKey.current ?? crypto.randomUUID(),
      actions: replayActions.current,
      ...(result ? { result } : {}),
    };
    initialRankedCheckpoint.current = checkpoint;
    saveRankedCheckpoint(checkpoint);
  }

  function clearReplayCheckpoint() {
    initialRankedCheckpoint.current = null;
    saveRankedCheckpoint(null);
  }

  function recordReplayAction(action: ReplayAction) {
    if (!rankedSession.current) return;
    if (replayActions.current.length >= MAX_REPLAY_ACTIONS) {
      rankedSession.current = null;
      clearReplayCheckpoint();
      setScoreVerification('provisional');
      setRankedNotice('This round exceeded the replay limit and will remain a local score.');
      return;
    }
    replayActions.current = [...replayActions.current, action];
    persistReplay();
  }

  async function submitVerifiedRun(run: Game) {
    const session = rankedSession.current;
    if (!session || !replayActions.current.length) return;
    const idempotencyKey = submissionIdempotencyKey.current ?? crypto.randomUUID();
    submissionIdempotencyKey.current = idempotencyKey;
    const result = { score: run.score, lines: run.lines, moves: run.moves };
    persistReplay(result);
    setScoreVerification('provisional');
    setRankedNotice('Checking this run against the verified game rules…');
    try {
      const accepted = await submitRankedScore({
        sessionId: session.sessionId,
        idempotencyKey,
        actions: replayActions.current,
        ...result,
        rulesetVersion: session.rulesetVersion,
      });
      if (!accepted.verified) throw new Error('The score was not verified.');
      setScoreVerification('verified');
      setRankedNotice('Verified score added to the worldwide leaderboard.');
      clearReplayCheckpoint();
      rankedSession.current = null;
      replayActions.current = [];
      submissionIdempotencyKey.current = null;
      void refreshGlobalLeaderboard();
    } catch (error) {
      setScoreVerification('provisional');
      setRankedNotice(error instanceof Error ? `${error.message} This score is not in global rankings.` : 'Score verification failed. This score is not in global rankings.');
    }
  }

  async function retryPendingSubmission() {
    const checkpoint = initialRankedCheckpoint.current;
    if (!checkpoint?.result) return;
    rankedSession.current = checkpoint;
    replayActions.current = checkpoint.actions;
    submissionIdempotencyKey.current = checkpoint.idempotencyKey;
    await submitVerifiedRun({ ...newGame(), id: checkpoint.sessionId, ...checkpoint.result });
  }

  useEffect(() => {
    const checkpoint = initialRankedCheckpoint.current;
    if (identityState !== 'ready' || autoRetryStarted.current || !checkpoint?.result) return;
    autoRetryStarted.current = true;
    void submitVerifiedRun({ ...newGame(), id: checkpoint.sessionId, ...checkpoint.result });
  }, [identityState]);

  useEffect(() => {
    const retry = () => {
      if (initialRankedCheckpoint.current?.result) void retryPendingSubmission();
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

  async function prepareNewGame(): Promise<Game> {
    clearReplayCheckpoint();
    rankedSession.current = null;
    replayActions.current = [];
    submissionIdempotencyKey.current = null;
    setScoreVerification('none');
    setRankedNotice('Solo play is local on this build. Sign in will be required for online modes.');
    return newGame();
  }

  async function startGame() {
    setMobileScreen('game');
    if (startPending) return;
    setStartPending(true);
    let startState = gameRef.current;
    if (startState.moves === 0 && statusRef.current === 'ready') {
      startState = await prepareNewGame();
      gameRef.current = startState;
      setGame(startState);
    } else if (rankedSession.current?.sessionId === startState.id) {
      try {
        const replayed = replayGame(rankedSession.current.seed, rankedSession.current.sessionId, replayActions.current);
        if (replayed.isOver) throw new Error('Saved ranked session is already complete.');
        startState = replayed.game;
        gameRef.current = startState;
        setGame(startState);
        selectedRef.current = replayed.selectedIndex;
        setSelected(replayed.selectedIndex);
      } catch {
        clearReplayCheckpoint();
        rankedSession.current = null;
        replayActions.current = [];
        submissionIdempotencyKey.current = null;
        setRankedNotice('The saved ranked replay could not be restored. This round will remain local.');
      }
    } else if (!rankedSession.current || rankedSession.current.sessionId !== startState.id) {
      setRankedNotice('This saved round predates a ranked session, so it will remain a local score. Restart for a verified round.');
    }
    changeStatus('playing');
    const index = selectedRef.current !== null && startState.tray[selectedRef.current] ? selectedRef.current : startState.tray.findIndex(Boolean);
    selectedRef.current = index < 0 ? null : index;
    setSelected(index < 0 ? null : index);
    setCursor(null);
    setLiveMessage('Let\'s play! Select a block, then fill a row or column.');
    setStartPending(false);
    gameAudio.play('start');
    focusBoard();
  }

  async function restartGame() {
    setMobileScreen('game');
    if (startPending) return;
    recordRun(gameRef.current);
    Object.values(timers.current).forEach(clearTimeout);
    setStartPending(true);
    const fresh = await prepareNewGame();
    gameRef.current = fresh;
    setGame(fresh);
    changeStatus('playing');
    setSelected(0);
    setCursor(null);
    setInputMode('pointer');
    setFeedback(null);
    setClearFlash(null);
    setPlacedCells([]);
    setShaking(false);
    setInvalid(false);
    setIsRecord(false);
    drag.current = null;
    setDragged(null);
    saveSession(null);
    setStartPending(false);
    gameAudio.play('start');
    setLiveMessage('Fresh board. Fresh possibilities.');
    focusBoard();
  }

  function togglePause() {
    if (statusRef.current === 'playing') {
      changeStatus('paused');
      drag.current = null;
      setDragged(null);
      setCursor(null);
    } else if (statusRef.current === 'paused') {
      changeStatus('playing');
      gameAudio.play('click');
      focusBoard();
    }
  }

  function openDialog(kind: Exclude<DialogKind, null>) {
    resumeAfterDialog.current = statusRef.current === 'playing';
    if (resumeAfterDialog.current) changeStatus('paused');
    drag.current = null;
    setDragged(null);
    setConfirmClear(false);
    setDialog(kind);
    gameAudio.play('click');
  }

  function closeDialog() {
    setDialog(null);
    setConfirmClear(false);
    if (resumeAfterDialog.current && statusRef.current === 'paused') changeStatus('playing');
    resumeAfterDialog.current = false;
  }

  async function refreshGlobalLeaderboard() {
    if (!supabaseConfigured) {
      setGlobalError('Worldwide rankings are not configured for this build.');
      setGlobalEntries([]);
      setGlobalTopThree([]);
      setGlobalMyEntry(null);
      return;
    }
    setGlobalLoading(true);
    setGlobalError('');
    try {
      await ensureAnonymousIdentity();
      const page = await loadGlobalPage(null);
      setIdentityState('ready');
      setGlobalEntries(page.entries ?? []);
      setGlobalTopThree(page.top_three ?? []);
      setGlobalMyEntry(page.my_entry ?? null);
      setGlobalUsername(page.username ?? '');
      setUsernameDraft(page.username ?? '');
      setGlobalCursor(page.next_cursor ?? null);
      setGlobalHasMore(Boolean(page.has_more));
      setRealtimeStatus('connecting');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load global rankings.';
      setGlobalError(message);
      setIdentityState('offline');
      setIdentityError(message);
    } finally {
      setGlobalLoading(false);
    }
  }

  async function loadMoreGlobal() {
    if (!globalHasMore || globalLoading || globalSearchResults || !globalCursor) return;
    setGlobalLoading(true);
    try {
      const page = await loadGlobalPage(globalCursor);
      setGlobalEntries((previous) => appendUniqueEntries(previous, page.entries ?? []));
      setGlobalCursor(page.next_cursor ?? null);
      setGlobalHasMore(Boolean(page.has_more));
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Could not load more rankings.');
    } finally {
      setGlobalLoading(false);
    }
  }

  async function refreshByPull() {
    setGlobalRefreshPending(true);
    setGlobalSearch('');
    setGlobalSearchResults(null);
    await refreshGlobalLeaderboard();
    setGlobalRefreshPending(false);
  }

  async function saveUsername() {
    setUsernameMessage('');
    try {
      const value = validateUsername(usernameDraft);
      const result = await renameGlobalPlayer(value);
      setGlobalUsername(result.username);
      setUsernameDraft(result.username);
      setUsernameMessage('Username updated.');
      await refreshGlobalLeaderboard();
    } catch (error) {
      setUsernameMessage(error instanceof Error ? error.message : 'Could not change username.');
    }
  }

  function enterOfflinePlay() {
    try { localStorage.setItem('blockparty.entry.v1', 'offline'); } catch { /* Offline play remains available for this session. */ }
    setAuthNotice('');
    try {
      const welcomeComplete = localStorage.getItem('blockparty.onboarding.welcome.v1') === 'complete';
      setMobileScreen(welcomeComplete ? 'home' : 'onboarding');
    } catch {
      setMobileScreen('onboarding');
    }
  }

  function finishOnboarding() {
    try {
      localStorage.setItem('blockparty.onboarding.welcome.v1', 'complete');
      localStorage.setItem('blockparty.onboarding.v1', 'complete');
      localStorage.setItem('blockparty.entry.v1', 'offline');
    } catch { /* Home remains available for this session even if storage is unavailable. */ }
    setMobileScreen('home');
  }

  function requestOnlineAccess() {
    setDialog(null);
    setAuthNotice('Sign in or create an account to use online matchmaking and worldwide rankings. Account services will be connected in the Supabase integration stage.');
    setMobileScreen('auth');
  }

  function openGlobalLeaderboard() {
    requestOnlineAccess();
  }

  useEffect(() => {
    if (dialog === 'global' && identityState === 'ready' && globalEntries.length === 0 && !globalLoading && !globalError) {
      void refreshGlobalLeaderboard();
    }
  }, [dialog, identityState]);

  useEffect(() => {
    if (dialog !== 'global' || identityState !== 'ready') return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let subscribedOnce = false;
    const scheduleFirstPageRefresh = () => {
      setGlobalRefreshPending(true);
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        void loadGlobalPage(null).then((page) => {
          if (disposed) return;
          setGlobalEntries(page.entries ?? []);
          setGlobalTopThree(page.top_three ?? []);
          setGlobalMyEntry(page.my_entry ?? null);
          setGlobalCursor(page.next_cursor ?? null);
          setGlobalHasMore(Boolean(page.has_more));
          setGlobalUsername(page.username ?? '');
          setGlobalRefreshPending(false);
        }).catch(() => setGlobalRefreshPending(false));
      }, 700);
    };
    void subscribeToGlobalScores((notice: ScoreNotice) => {
      if (!seenRealtimeEvents.current.accept(notice.id)) return;
      setGlobalEntries((entries) => entries.map((entry) => entry.player_id === notice.player_id && notice.score > entry.score
        ? { ...entry, score: notice.score, verified_at: notice.verified_at ?? entry.verified_at }
        : entry));
      scheduleFirstPageRefresh();
    }, (status) => {
      setRealtimeStatus(status === 'SUBSCRIBED' ? 'live' : status.toLowerCase().replace(/_/g, ' '));
      if (status === 'SUBSCRIBED' && subscribedOnce) scheduleFirstPageRefresh();
      if (status === 'SUBSCRIBED') subscribedOnce = true;
    }).then((remove) => {
      if (disposed) remove();
      else cleanup = remove;
    }).catch(() => setRealtimeStatus('offline'));
    return () => {
      disposed = true;
      if (debounce) clearTimeout(debounce);
      cleanup?.();
    };
  }, [dialog, identityState]);

  useEffect(() => {
    if (dialog !== 'global' || globalSearch.trim().length < 2) {
      setGlobalSearchResults(null);
      return;
    }
    let active = true;
    const timeout = setTimeout(() => {
      setGlobalLoading(true);
      void searchGlobalPlayers(globalSearch.trim()).then((entries) => {
        if (active) { setGlobalSearchResults(entries); setGlobalError(''); }
      }).catch((error: unknown) => {
        if (active) setGlobalError(error instanceof Error ? error.message : 'Search is unavailable.');
      }).finally(() => { if (active) setGlobalLoading(false); });
    }, 300);
    return () => { active = false; clearTimeout(timeout); };
  }, [dialog, globalSearch]);

  function selectPiece(index: number, keyboard = false) {
    const piece = gameRef.current.tray[index];
    if (!piece || statusRef.current !== 'playing') return;
    recordReplayAction({ type: 'select', index });
    setSelected(index);
    selectedRef.current = index;
    if (keyboard) {
      setInputMode('keyboard');
      setCursor((previous) => previous && canPlace(gameRef.current.board, piece, previous.row, previous.col) ? previous : firstFit(gameRef.current.board, piece) ?? { row: 0, col: 0 });
      focusBoard();
    }
    gameAudio.play('select');
  }

  function rotateSelected() {
    const index = selectedRef.current;
    if (index === null || statusRef.current !== 'playing') return;
    const piece = gameRef.current.tray[index];
    if (!piece) return;
    recordReplayAction({ type: 'rotate' });
    const rotated = rotatePiece(piece);
    const next = { ...gameRef.current, tray: gameRef.current.tray.map((item, i) => i === index ? rotated : item) };
    gameRef.current = next;
    setGame(next);
    const size = pieceSize(rotated);
    setCursor((previous) => previous ? { row: Math.min(previous.row, GRID_SIZE - size.rows), col: Math.min(previous.col, GRID_SIZE - size.cols) } : null);
    gameAudio.play('rotate');
  }

  function invalidMove() {
    setInvalid(true);
    after('invalid', () => setInvalid(false), 900);
    gameAudio.play('invalid');
    setLiveMessage('Not quite enough room. Try another spot or rotate the block.');
  }

  function attemptPlacement(index: number, row: number, col: number) {
    if (statusRef.current !== 'playing') return;
    const result = placePiece(gameRef.current, index, row, col);
    if (!result) { invalidMove(); return; }
    if (selectedRef.current !== index) recordReplayAction({ type: 'select', index });
    recordReplayAction({ type: 'place', index, row, col });
    const wasLastPiece = gameRef.current.tray.filter(Boolean).length === 1;

    gameRef.current = result.game;
    setGame(result.game);
    setInvalid(false);
    setPlacedCells(result.placed);
    after('placed', () => setPlacedCells([]), 320);
    setCursor(null);
    const nextIndex = result.game.tray.findIndex(Boolean);
    setSelected(nextIndex < 0 ? null : nextIndex);
    selectedRef.current = nextIndex < 0 ? null : nextIndex;

    const rect = gridRef.current?.getBoundingClientRect();
    if (result.lineCount) {
      const tier = getPraise(result.lineCount, result.game.combo);
      const praise = PRAISES[tier];
      setClearFlash({ cells: result.cleared, board: result.beforeClear, id: result.game.moves });
      setShaking(true);
      after('shake', () => setShaking(false), tier === 'legendary' ? 520 : 380);
      after('flash', () => setClearFlash(null), 440);
      setFeedback({ id: result.game.moves, ...praise, points: result.points, combo: result.game.combo, lines: result.lineCount, tier });
      after('feedback', () => setFeedback(null), 1750);
      const clearSound = { nice: 'clear', great: 'combo', amazing: 'amazing', incredible: 'incredible', legendary: 'legendary' } as const;
      gameAudio.play(clearSound[tier]);
      if (rect) {
        const step = (rect.width + 5) / GRID_SIZE;
        result.cleared.forEach((cell) => {
          const color = result.beforeClear[cell];
          if (color) particles.current?.burst(rect.left + (cell % GRID_SIZE + 0.5) * step, rect.top + (Math.floor(cell / GRID_SIZE) + 0.5) * step, PALETTE[color], 7 + Math.min(result.game.combo, 4));
        });
        const celebrationBursts = { nice: 0, great: 1, amazing: 2, incredible: 3, legendary: 4 }[tier];
        const colors = Object.values(PALETTE);
        for (let burst = 0; burst < celebrationBursts; burst++) {
          particles.current?.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, colors[burst % colors.length], 6);
        }
      }
      if (hapticsEnabled && Capacitor.isNativePlatform()) {
        const style = tier === 'legendary' || tier === 'incredible' ? ImpactStyle.Heavy : ImpactStyle.Medium;
        void Haptics.impact({ style });
      } else if (hapticsEnabled && 'vibrate' in navigator) navigator.vibrate?.(tier === 'legendary' ? [24, 30, 24, 30, 45] : tier === 'incredible' ? [20, 24, 30] : [12, 25, 18]);
      setLiveMessage(`${praise.word} ${result.lineCount} ${result.lineCount === 1 ? 'line' : 'lines'} cleared! ${result.points} points. ${result.game.combo > 1 ? `${result.game.combo} times combo!` : ''} Score ${result.game.score}.`);
    } else {
      gameAudio.play('place');
      if (rect) {
        const step = (rect.width + 5) / GRID_SIZE;
        const center = result.placed[Math.floor(result.placed.length / 2)];
        particles.current?.burst(rect.left + (center % GRID_SIZE + 0.5) * step, rect.top + (Math.floor(center / GRID_SIZE) + 0.5) * step, PALETTE[result.beforeClear[center]!], 5);
      }
      if (hapticsEnabled && Capacitor.isNativePlatform()) void Haptics.impact({ style: ImpactStyle.Light });
      else if (hapticsEnabled && 'vibrate' in navigator) navigator.vibrate?.(8);
      setLiveMessage(`Good move. ${result.points} points. Score ${result.game.score}.`);
    }

    if (wasLastPiece && !result.isOver) {
      after('refill', () => gameAudio.play('refill'), result.lineCount ? 480 : 170);
    }

    if (result.isOver) {
      const record = recordRun(result.game);
      void submitVerifiedRun(result.game);
      setIsRecord(record);
      changeStatus('over');
      after('gameover', () => gameAudio.play('over'), 650);
      if (record) after('record', () => gameAudio.play('record'), 1050);
      setLiveMessage(`Round complete! Final score ${result.game.score}. Press Enter to play again.`);
    }
  }
  placeActionRef.current = attemptPlacement;

  // Only the floating ghost moves every frame; React updates when the snapped cell changes.
  useEffect(() => {
    const updateDrag = () => {
      const current = drag.current;
      if (!current || !current.moved) return;
      const { rows, cols } = pieceSize(current.piece);
      const lift = current.touch ? Math.min(72, current.rect.width * 0.19) : 0;
      const x = current.x;
      const y = current.y - lift;
      const step = (current.rect.width + 5) / GRID_SIZE;
      const row = Math.floor((y - current.rect.top) / step - (rows - 1) / 2);
      const col = Math.floor((x - current.rect.left) / step - (cols - 1) / 2);
      const over = x >= current.rect.left - 10 && x <= current.rect.right + 10 && y >= current.rect.top - 10 && y <= current.rect.bottom + 10;
      current.placement = over ? { row, col } : null;
      setCursor((previous) => {
        if (!over) return previous === null ? previous : null;
        return previous?.row === row && previous.col === col ? previous : { row, col };
      });
      if (ghostRef.current) {
        const width = cols * current.cellSize + (cols - 1) * 5;
        const height = rows * current.cellSize + (rows - 1) * 5;
        ghostRef.current.style.transform = `translate3d(${x - width / 2}px, ${y - height / 2}px, 0) scale(1.035)`;
        ghostRef.current.style.opacity = over && canPlace(gameRef.current.board, current.piece, row, col) ? '0.28' : '0.96';
      }
      dragFrame.current = 0;
    };

    const move = (event: PointerEvent) => {
      const current = drag.current;
      if (!current || statusRef.current !== 'playing') return;
      current.x = event.clientX;
      current.y = event.clientY;
      if (!current.moved && Math.hypot(current.x - current.startX, current.y - current.startY) > 5) {
        current.moved = true;
        setDragged({ piece: current.piece, index: current.index });
        setInputMode('drag');
      }
      if (current.moved) {
        event.preventDefault();
        if (!dragFrame.current) dragFrame.current = requestAnimationFrame(updateDrag);
      }
    };

    const end = (event: PointerEvent) => {
      const current = drag.current;
      if (!current) return;
      cancelAnimationFrame(dragFrame.current);
      dragFrame.current = 0;
      if (current.moved) {
        current.x = event.clientX;
        current.y = event.clientY;
        updateDrag();
        suppressClickUntil.current = Date.now() + 350;
        if (current.placement) placeActionRef.current(current.index, current.placement.row, current.placement.col);
        else setCursor(null);
      }
      drag.current = null;
      setDragged(null);
    };
    const cancel = () => {
      drag.current = null;
      setDragged(null);
      setCursor(null);
      cancelAnimationFrame(dragFrame.current);
      dragFrame.current = 0;
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', cancel);
    };
  }, []);

  function beginDrag(event: ReactPointerEvent<HTMLButtonElement>, index: number) {
    if (event.button !== 0 || statusRef.current !== 'playing' || drag.current) return;
    const piece = gameRef.current.tray[index];
    const rect = gridRef.current?.getBoundingClientRect();
    if (!piece || !rect) return;
    event.preventDefault();
    selectPiece(index);
    setInputMode('pointer');
    setCursor(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      index, piece, startX: event.clientX, startY: event.clientY,
      x: event.clientX, y: event.clientY, moved: false,
      touch: event.pointerType !== 'mouse', rect,
      cellSize: (rect.width - 7 * 5) / GRID_SIZE, placement: null,
    };
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (dialog || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
      const key = event.key.toLowerCase();
      if ((key === 'enter' || key === ' ') && target.closest('button, a, summary')) return;
      if (event.repeat && !key.startsWith('arrow')) return;
      if (status === 'ready') {
        if (key === 'enter' || key === ' ') { event.preventDefault(); startGame(); }
        return;
      }
      if (key === 'r') { event.preventDefault(); restartGame(); return; }
      if (status === 'over') {
        if (key === 'enter' || key === ' ') { event.preventDefault(); restartGame(); }
        return;
      }
      if (key === 'p' || key === 'escape' || (status === 'paused' && key === 'enter')) {
        event.preventDefault(); togglePause(); return;
      }
      if (status !== 'playing') return;
      if (['1', '2', '3'].includes(key)) {
        event.preventDefault(); selectPiece(Number(key) - 1, true); return;
      }
      if (key === ' ') { event.preventDefault(); rotateSelected(); return; }
      if (key.startsWith('arrow')) {
        event.preventDefault();
        const index = selected ?? game.tray.findIndex(Boolean);
        const piece = game.tray[index];
        if (!piece) return;
        setSelected(index);
        setInputMode('keyboard');
        const current = cursor ?? firstFit(game.board, piece) ?? { row: 0, col: 0 };
        const size = pieceSize(piece);
        setCursor({
          row: Math.max(0, Math.min(GRID_SIZE - size.rows, current.row + (key === 'arrowdown' ? 1 : key === 'arrowup' ? -1 : 0))),
          col: Math.max(0, Math.min(GRID_SIZE - size.cols, current.col + (key === 'arrowright' ? 1 : key === 'arrowleft' ? -1 : 0))),
        });
        return;
      }
      if (key === 'enter') {
        event.preventDefault();
        const index = selected ?? game.tray.findIndex(Boolean);
        const piece = game.tray[index];
        if (!piece) return;
        const position = cursor ?? firstFit(game.board, piece);
        if (position) attemptPlacement(index, position.row, position.col);
        else invalidMove();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  const activePiece = selected === null ? null : game.tray[selected];
  const preview = useMemo(() => {
    const cells = new Set<number>();
    const lines = new Set<number>();
    if (!activePiece || !cursor || status !== 'playing') return { cells, lines, valid: false };
    activePiece.cells.forEach((cell) => {
      const row = cursor.row + cell.row;
      const col = cursor.col + cell.col;
      if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) cells.add(row * GRID_SIZE + col);
    });
    const valid = canPlace(game.board, activePiece, cursor.row, cursor.col);
    if (valid) {
      for (let row = 0; row < GRID_SIZE; row++) {
        const indices = Array.from({ length: GRID_SIZE }, (_, col) => row * GRID_SIZE + col);
        if (indices.every((index) => game.board[index] || cells.has(index))) indices.forEach((index) => lines.add(index));
      }
      for (let col = 0; col < GRID_SIZE; col++) {
        const indices = Array.from({ length: GRID_SIZE }, (_, row) => row * GRID_SIZE + col);
        if (indices.every((index) => game.board[index] || cells.has(index))) indices.forEach((index) => lines.add(index));
      }
    }
    return { cells, lines, valid };
  }, [activePiece, cursor, game.board, status]);

  function hoverBoard(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || drag.current || status !== 'playing' || !activePiece) return;
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    const step = (rect.width + 5) / GRID_SIZE;
    const point = { row: Math.floor((event.clientY - rect.top) / step), col: Math.floor((event.clientX - rect.left) / step) };
    setInputMode('pointer');
    setCursor((previous) => previous?.row === point.row && previous.col === point.col ? previous : point);
  }

  const best = Math.max(scores[0]?.score ?? 0, game.score);
  const mobileCanContinue = status === 'playing' || status === 'paused' || game.moves > 0;
  const showStarterHint = game.moves === 0 && selected === 0 && !!activePiece && pieceSize(activePiece).rows === 1;

  return (
    <div className={`site-shell theme-${cosmetics.theme} skin-${cosmetics.skin} ${mobileScreen === 'home' ? 'screen-home' : ''} ${mobileScreen === 'splash' ? 'screen-splash' : ''} ${mobileScreen === 'auth' ? 'screen-auth' : ''} ${mobileScreen === 'onboarding' ? 'screen-onboarding' : ''} ${mobileScreen === 'game' ? 'screen-game' : ''}`}>
      <SplashScreen />
      <AuthScreen notice={authNotice} onPlayOffline={enterOfflinePlay} />
      <OnboardingScreen onSkip={finishOnboarding} onComplete={finishOnboarding} />
      <header className="site-header">
        <a className="brand" href="#game" aria-label="Block Party home" onClick={(event) => { event.preventDefault(); closeDialog(); if (statusRef.current === 'playing') changeStatus('paused'); setMobileScreen('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          <BrandMark /><span>blockparty<span className="brand-period">.</span></span>
        </a>
        <nav className="header-nav" aria-label="Main navigation">
          <a className="nav-link active" href="#game">The game<span /></a>
          <button className="nav-link global-nav" onClick={openGlobalLeaderboard}>Global</button>
          <button className="nav-link help-nav" onClick={() => openDialog('help')}><span className="desktop-label">How to play</span><Icon name="help" size={20} className="mobile-icon" /></button>
          <button className="nav-link scores-nav" onClick={() => openDialog('scores')}>Best runs</button>
          <span className="nav-divider" />
          <button className={`sound-button ${sound ? 'sound-on' : ''}`} onClick={() => {
            const next = !sound;
            gameAudio.enabled = next;
            setSound(next);
            if (next) gameAudio.play('click');
          }} aria-label={`Turn sound ${sound ? 'off' : 'on'}`} aria-pressed={sound} title={`Sound ${sound ? 'on' : 'off'}`}>
            <Icon name={sound ? 'sound' : 'muted'} size={17} /><span>Sound {sound ? 'on' : 'off'}</span>
          </button>
        </nav>
      </header>

      <main id="game" className={`play-layout ${mobileScreen === 'home' ? 'mobile-hub-active' : ''}`}>
        <section className="mobile-home-screen" aria-label="Block Party home">
          <div className="home-sky-decor" aria-hidden="true">
            <span className="home-cloud home-cloud-top-left" />
            <span className="home-cloud home-cloud-top-right" />
            <span className="home-cloud home-cloud-left" />
            <span className="home-cloud home-cloud-right" />
            <span className="home-cloud home-cloud-bottom-left" />
            <span className="home-cloud home-cloud-bottom-center" />
            <span className="home-cloud home-cloud-bottom-right" />
            <span className="home-floating-block home-floating-block-left" />
            <span className="home-floating-block home-floating-block-right" />
            <span className="home-sparkle home-sparkle-left">✦</span>
            <span className="home-sparkle home-sparkle-right">✦</span>
          </div>

          <div className="home-topbar">
            <button className="home-player" onClick={() => openDialog('profile')} aria-label="Open ADI profile">
              <span className="home-avatar"><HomeAvatar /></span>
              <span className="home-player-details">
                <strong>ADI</strong>
                <small>Lv. 12</small>
                <span className="home-level-track"><i /></span>
              </span>
            </button>
            <button className="home-wallet" onClick={() => openDialog('shop')} aria-label="Open coin shop">
              <HomeCoinIcon />
              <strong>1,240</strong>
              <span className="home-wallet-add" aria-hidden="true">+</span>
            </button>
          </div>

          <div className="home-brand-stage" aria-label="Block Party">
            <HomeBrandLogo />
          </div>

          <section className="home-action-stack" aria-label="Play modes">
            <button className="home-action home-action-online" aria-label="Play online" onClick={() => openDialog('online')}>
              <span className="home-action-icon"><HomeActionIcon kind="online" /></span>
              <strong>Play Online</strong>
              <span className="sr-only">Quick Match, Ranked and Friends</span>
            </button>
            <button
              className="home-action home-action-solo"
              onClick={() => { if (status === 'over') void restartGame(); else void startGame(); }}
              disabled={startPending}
              aria-label={startPending ? 'Starting' : status === 'over' ? 'Play another round' : mobileCanContinue ? 'Keep playing' : "Let's play"}
            >
              <span className="home-action-icon"><HomeActionIcon kind="solo" /></span>
              <strong>{startPending ? 'Starting…' : status === 'over' ? 'Play Again' : mobileCanContinue ? 'Continue' : 'Play Solo'}</strong>
            </button>
            <button className="home-action home-action-daily" onClick={() => openDialog('daily')} aria-label="Daily Challenge">
              <span className="home-action-icon"><HomeActionIcon kind="daily" /></span>
              <strong>Daily Challenge</strong>
              <i className="home-notification-dot" aria-hidden="true" />
            </button>
          </section>

          <section className="home-feature-grid" aria-label="Player features">
            <button className="home-feature-card" onClick={() => openDialog('missions')}>
              <HomeTileIcon kind="missions" />
              <strong>Missions</strong>
            </button>
            <button className="home-feature-card home-feature-pass" onClick={() => openDialog('shop')}>
              <HomeTileIcon kind="pass" />
              <strong>Pass</strong>
            </button>
            <button className="home-feature-card" onClick={() => openDialog('events')}>
              <HomeTileIcon kind="events" />
              <strong>Events</strong>
              <i className="home-notification-dot" aria-hidden="true" />
            </button>
          </section>
        </section>
        <section className="intro" aria-label="Welcome to Block Party">
          <div className="eyebrow"><span />YOUR DAILY HAPPY PLACE</div>
          <h1>block<br className="desktop-break" /><span className="mobile-space"> </span>party<span className="title-period">.</span></h1>
          <p className="intro-headline">Clear your mind.<br />And a few rows.</p>
          <p className="intro-copy">A little strategy. A lot of satisfaction.<br /><span className="intro-copy-extra">Go on, make some room for fun.</span></p>
          <div className="intro-bottom">
            <div className="playful-blocks" aria-hidden="true"><span /><span /><span /><span /><svg viewBox="0 0 30 30"><path d="M15 1v28M1 15h28M5 5l20 20M25 5 5 25" /></svg></div>
            <p>No timers. No pressure.<br /><strong>Just one more round.</strong></p>
          </div>
        </section>

        <section className="game-column" aria-label="Block Party game">
          <div className="game-shell">
            <div className="scoreboard">
              <div className={`score-group current-score ${feedback ? `is-popping tier-${feedback.tier}` : ''}`}><span className="score-label">YOUR SCORE</span><span className={`score-value ${feedback ? 'score-pop' : ''}`} key={feedback ? `score-${feedback.id}` : 'score-steady'} aria-label={`Score ${game.score}`}><AnimatedScore value={game.score} /></span></div>
              <div className="score-group best-score"><span className="score-label"><Icon name="trophy" size={12} />PERSONAL BEST</span><span className="best-value">{best.toLocaleString()}</span></div>
              <div className="game-actions">
                <button className="icon-button" onClick={togglePause} disabled={status === 'ready' || status === 'over'} aria-label={status === 'paused' ? 'Resume game' : 'Pause game'} title="Pause (P)"><Icon name={status === 'paused' ? 'play' : 'pause'} size={16} /></button>
                <button className="icon-button" onClick={restartGame} aria-label="Restart game" title="Fresh start (R)"><Icon name="restart" size={16} /></button>
              </div>
            </div>

            <div className={`board-wrap ${shaking ? 'is-shaking' : ''} ${invalid ? 'is-invalid' : ''}`} ref={boardRef} tabIndex={0} aria-label="Game board. Choose a piece with 1, 2 or 3, move with arrow keys and press Enter to place. Space rotates." onPointerMove={hoverBoard} onPointerLeave={() => { if (!drag.current && inputMode === 'pointer') setCursor(null); }}>
              <div className="board-grid" ref={gridRef} role="grid" aria-label="8 by 8 puzzle board" aria-rowcount={8} aria-colcount={8}>
                {game.board.map((color, index) => {
                  const inPreview = preview.cells.has(index);
                  return <div
                    key={index}
                    role="gridcell"
                    aria-rowindex={Math.floor(index / GRID_SIZE) + 1}
                    aria-colindex={index % GRID_SIZE + 1}
                    aria-label={`Row ${Math.floor(index / GRID_SIZE) + 1}, column ${index % GRID_SIZE + 1}, ${color ? `${color} block` : 'empty'}`}
                    aria-selected={inPreview}
                    data-cell={index}
                    className={`cell ${color ? 'occupied' : ''} ${inPreview ? `is-preview ${preview.valid ? 'valid-preview' : 'invalid-preview'}` : ''} ${preview.lines.has(index) ? 'line-preview' : ''} ${inputMode === 'keyboard' && inPreview ? 'keyboard-preview' : ''} ${showStarterHint && status === 'playing' && !cursor && [50, 51, 52].includes(index) ? 'starter-suggestion' : ''}`}
                    style={{ '--block-color': color ? PALETTE[color] : activePiece ? PALETTE[activePiece.color] : PALETTE.violet } as CSSProperties}
                    onClick={() => {
                      if (Date.now() < suppressClickUntil.current || selected === null || status !== 'playing') return;
                      attemptPlacement(selected, Math.floor(index / GRID_SIZE), index % GRID_SIZE);
                    }}
                  >
                    {color && <span key={`${color}-${placedCells.includes(index) ? game.moves : 'fixed'}`} className={`block ${placedCells.includes(index) ? 'just-placed' : ''}`} />}
                    {inPreview && <span className="preview-block" />}
                  </div>;
                })}
                {clearFlash && <div className="clear-layer" aria-hidden="true" key={clearFlash.id}>{clearFlash.cells.map((index, order) => <span key={index} className="block clear-block" style={{ gridRow: Math.floor(index / GRID_SIZE) + 1, gridColumn: index % GRID_SIZE + 1, '--block-color': PALETTE[clearFlash.board[index]!], animationDelay: `${order * 7}ms` } as CSSProperties} />)}</div>}
              </div>

              {feedback && <>
                <div className={`celebration-ring tier-${feedback.tier}`} key={`ring-${feedback.id}`} aria-hidden="true" />
                <div className={`clear-feedback tier-${feedback.tier}`} key={feedback.id} aria-hidden="true">
                  <span className="praise-kicker"><Icon name="sparkle" size={12} />{feedback.kicker}<Icon name="sparkle" size={12} /></span>
                  <span className="praise-word">{Array.from(feedback.word).map((letter, index) => <span key={`${letter}-${index}`} style={{ '--letter': index } as CSSProperties}>{letter}</span>)}</span>
                  <strong className="feedback-points">+{feedback.points.toLocaleString()}</strong>
                  <span className={`feedback-combo ${feedback.combo > 1 ? '' : 'single-combo'}`}>{feedback.combo > 1 ? `${feedback.combo}x COMBO` : feedback.lines > 1 ? `${feedback.lines} LINES AT ONCE` : 'LINE CLEARED'}</span>
                </div>
              </>}

              {status === 'ready' && <div className="board-overlay start-screen">
                <div className="start-motif" aria-hidden="true"><i /><i /><i /><i /><Icon name="sparkle" size={25} /></div>
                <h2>{savedGame && game.moves > 0 ? <>Right where<br />you left off.</> : <>A little space.<br />A lot of happy.</>}</h2>
                <p>{savedGame && game.moves > 0 ? 'Your next good move is waiting.' : 'Good things come in blocks.'}</p>
                <button className="primary-button start-button" onClick={startGame} disabled={startPending}><Icon name="play" size={17} />{startPending ? 'Connecting…' : savedGame && game.moves > 0 ? 'Keep playing' : 'Let\'s play'}<Icon name="arrow" size={18} /></button>
                <span className="overlay-footnote">{savedGame && game.moves > 0 ? <button onClick={restartGame}>Or make a fresh start</button> : 'Easy to learn. Hard to leave.'}</span>
              </div>}

              {status === 'paused' && <div className="board-overlay pause-screen">
                <div className="overlay-symbol"><Icon name="pause" size={27} /></div>
                <span className="overlay-eyebrow">A LITTLE BREATHER</span>
                <h2>Take your time.</h2><p>Your blocks aren't going anywhere.</p>
                <button className="primary-button" onClick={togglePause}><Icon name="play" size={17} />Keep the good going</button>
                <button className="overlay-text-button" onClick={restartGame}><Icon name="restart" size={14} />Start fresh instead</button>
                <button className="overlay-text-button" onClick={() => setMobileScreen('home')}>Back to home <Icon name="arrow" size={14} /></button>
              </div>}

              {status === 'over' && <div className="board-overlay gameover-screen">
                <div className={`overlay-symbol ${isRecord ? 'new-record' : ''}`}><Icon name={isRecord ? 'trophy' : 'sparkle'} size={28} /></div>
                <span className="overlay-eyebrow">{isRecord ? 'A NEW PERSONAL BEST!' : 'EVERY ROUND IS A LITTLE BETTER'}</span>
                <h2>{isRecord ? 'Look at you go.' : 'That was a good one.'}</h2>
                <strong className="final-score">{game.score.toLocaleString()}<span>HAPPY LITTLE POINTS</span></strong>
                <p>{game.lines} {game.lines === 1 ? 'line' : 'lines'} cleared{game.bestCombo > 1 ? ` / ${game.bestCombo}x best combo` : ''}</p>
                <button className="primary-button" onClick={restartGame}><Icon name="restart" size={17} />One more round<Icon name="arrow" size={18} /></button>
                <button className="overlay-text-button" onClick={() => openDialog('scores')}>See your best runs<Icon name="arrow" size={14} /></button>
                <button className="overlay-text-button" onClick={() => setMobileScreen('home')}>Back to home <Icon name="arrow" size={14} /></button>
              </div>}
            </div>

            <div className={`piece-rack ${status !== 'playing' ? 'rack-inactive' : ''}`} aria-label="Your three blocks">
              {game.tray.map((piece, index) => <div className="rack-slot" key={index}>
                {piece ? <button
                  className={`piece-button ${selected === index && status === 'playing' ? 'is-selected' : ''} ${dragged?.index === index ? 'is-dragging' : ''}`}
                  onPointerDown={(event) => beginDrag(event, index)}
                  onClick={(event) => { if (event.detail === 0) selectPiece(index, true); }}
                  disabled={status !== 'playing'}
                  aria-label={`Select block ${index + 1}: ${piece.cells.length} ${piece.color} squares`}
                  aria-pressed={selected === index && status === 'playing'}
                ><PieceView piece={piece} key={piece.id} /><span className="piece-number">{index + 1}</span></button> : <div className="used-slot" aria-label={`Block ${index + 1} placed`}><Icon name="check" size={20} /></div>}
              </div>)}
            </div>
            <div className={`rack-caption ${invalid ? 'invalid-caption' : ''}`}>
              <span>{invalid ? 'Not quite. Try a little more space.' : status === 'playing' ? <><Icon name="mouse" size={13} /><span>{showStarterHint ? 'Try the coral block in the glowing gap' : 'Drag a block, or tap to place'}</span></> : <><span className="caption-dot" />A little strategy. A lot of satisfaction.</>}</span>
              {status === 'playing' && <button onClick={rotateSelected} disabled={!activePiece} title="Rotate selected block (Space)" aria-label="Rotate selected block"><Icon name="rotate" size={13} />Rotate</button>}
            </div>
          </div>
          <div className="keyboard-legend" aria-label="Keyboard shortcuts"><span><Key>1</Key><Key>2</Key><Key>3</Key>choose</span><span><Key><span className="arrow-keys">&#8592; &#8593; &#8594; &#8595;</span></Key>move</span><span><Key>&#8629;</Key>place</span><button onClick={() => openDialog('help')} aria-label="See all game controls"><Icon name="help" size={14} /></button></div>
          <div className="mobile-game-note"><span />No rush. Just rows.</div>
        </section>

        <aside className="sidebar">
          <section className="howto-section" aria-labelledby="howto-heading">
            <div className="section-heading"><Icon name="sparkle" size={19} /><h2 id="howto-heading">Little blocks. Big possibilities.</h2></div>
            <ol className="howto-list">
              {HOW_TO.map((item, index) => <li key={item.title}><span className={`step-number step-${index}`}>0{index + 1}</span><div><h3>{item.title}</h3><p>{item.text}</p></div></li>)}
            </ol>
            <button className="text-link" onClick={() => openDialog('help')}>The full how-to<Icon name="arrow" size={15} /></button>
          </section>

          <section className="bests-section" aria-labelledby="bests-heading">
            <div className="section-heading"><Icon name="trophy" size={18} /><h2 id="bests-heading">Your personal bests</h2></div>
            <p className="section-subtitle">A little better, one round at a time.</p>
            <div className="mini-leaderboard" role="table" aria-label="Your top three scores">
              {[0, 1, 2].map((index) => <div className={`mini-score-row ${scores[index] ? 'has-score' : ''}`} key={index} role="row"><span className="mini-rank" role="cell">0{index + 1}</span><span className="mini-run" role="cell">{scores[index] ? formatDate(scores[index].date) : ['Your next great run', 'Room for a little more', 'The best is yet to come'][index]}</span><strong role="cell">{scores[index]?.score.toLocaleString() ?? '--'}</strong></div>)}
            </div>
            <button className="text-link" onClick={() => openDialog('scores')}>See all your best runs<Icon name="arrow" size={15} /></button>
            <p className="save-note"><Icon name="lock" size={12} />Saved on this device. Just for you.</p>
          </section>
        </aside>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Primary navigation">
        <button className={`mobile-bottom-tab ${mobileScreen === 'home' && !dialog ? 'is-active' : ''}`} onClick={() => {
          if (dialog) closeDialog();
          if (statusRef.current === 'playing') changeStatus('paused');
          setMobileScreen('home');
        }} aria-current={mobileScreen === 'home' && !dialog ? 'page' : undefined}>
          <span className="mobile-bottom-icon"><HomeNavigationIcon kind="home" /></span><span>Home</span>
        </button>
        <button className={`mobile-bottom-tab ${dialog === 'global' ? 'is-active' : ''}`} onClick={openGlobalLeaderboard} aria-label="Leaderboard">
          <span className="mobile-bottom-icon"><HomeNavigationIcon kind="leaderboard" /></span><span>Leaderboard</span>
        </button>
        <button className={`mobile-bottom-tab ${dialog === 'profile' ? 'is-active' : ''}`} onClick={() => openDialog('profile')} aria-label="Profile">
          <span className="mobile-bottom-icon"><HomeNavigationIcon kind="profile" /></span><span>Profile</span>
        </button>
      </nav>
      <nav className="feature-menu" aria-label="More Block Party screens">
        <button onClick={() => openDialog('daily')}><span>✦</span>Daily challenge</button>
        <button onClick={openGlobalLeaderboard}><span>♧</span>Global board</button>
        <button onClick={() => openDialog('profile')}><span>☺</span>Profile</button>
        <button onClick={() => openDialog('statistics')}><span>▤</span>Statistics</button>
        <button onClick={() => openDialog('collection')}><span>◈</span>Collection</button>
        <button onClick={() => openDialog('shop')}><span>✧</span>Shop</button>
        <button onClick={() => openDialog('settings')}><span>⚙</span>Settings</button>
      </nav>

      <footer className="site-footer"><p><Icon name="sparkle" size={15} />Less scrolling. More little wins.</p><span>A small game for a well-deserved break.</span><div><Key>P</Key>pause<span className="footer-divider" /><Key>R</Key>fresh start</div></footer>

      <canvas className="particle-canvas" ref={canvasRef} aria-hidden="true" />
      {dragged && <div className="drag-ghost" ref={ghostRef}><PieceView piece={dragged.piece} style={{ '--piece-cell': `${drag.current?.cellSize ?? 40}px` } as CSSProperties} /></div>}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{liveMessage}</p>

      <dialog className={`game-dialog ${dialog === 'scores' ? 'scores-dialog' : ''} ${dialog === 'global' ? 'global-dialog' : ''}`} ref={nativeDialogRef} aria-labelledby="dialog-title" onCancel={(event) => { event.preventDefault(); closeDialog(); }} onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
        <div className="dialog-content">
          <button className="dialog-close icon-button" onClick={closeDialog} aria-label="Close dialog"><Icon name="close" size={18} /></button>
          {dialog === 'daily' && <>
            <div className="dialog-eyebrow"><Icon name="sparkle" size={16} />TODAY’S LOCAL CHALLENGE</div>
            <h2 id="dialog-title">A fresh little puzzle.</h2>
            <p className="dialog-intro">Today’s tray sequence is seeded from your local date. Play offline anytime; this score stays on this device and is not sent to global rankings.</p>
            <div className="feature-stat-grid"><div><strong>{new Date().toLocaleDateString(undefined, { weekday: 'long' })}</strong><span>Today’s date</span></div><div><strong>Same seed all day</strong><span>One shared local challenge</span></div></div>
            <button className="primary-button dialog-primary" onClick={startDailyChallenge}><Icon name="play" size={17} />Play today’s challenge<Icon name="arrow" size={18} /></button>
          </>}
          {dialog === 'missions' && <>
            <div className="dialog-eyebrow"><Icon name="check" size={16} />YOUR DAILY GOALS</div>
            <h2 id="dialog-title">Little missions.</h2>
            <p className="dialog-intro">Small goals to keep your block skills growing. Progress is saved on this device.</p>
            <div className="home-mission-list">
              <div><span className="home-mission-icon">✦</span><span><strong>Play your first round</strong><small>{Math.min(localStats.gamesPlayed, 1)} / 1 complete</small></span><b>{localStats.gamesPlayed > 0 ? '✓' : '—'}</b></div>
              <div><span className="home-mission-icon">▦</span><span><strong>Clear 10 lines</strong><small>{Math.min(localStats.totalLines, 10)} / 10 lines</small></span><b>{localStats.totalLines >= 10 ? '✓' : '—'}</b></div>
              <div><span className="home-mission-icon">✧</span><span><strong>Build a 3× combo</strong><small>Best combo: {localStats.bestCombo}×</small></span><b>{localStats.bestCombo >= 3 ? '✓' : '—'}</b></div>
            </div>
            <p className="home-feature-note">Mission rewards and claimable tasks will be enabled in a later progression update.</p>
          </>}
          {dialog === 'events' && <>
            <div className="dialog-eyebrow"><Icon name="sparkle" size={16} />HAPPENING IN BLOCK PARTY</div>
            <h2 id="dialog-title">Events are coming.</h2>
            <p className="dialog-intro">There isn't a live event running yet. Your daily puzzle is always ready while we prepare the first event.</p>
            <button className="primary-button dialog-primary" onClick={() => setDialog('daily')}><Icon name="calendar" size={17} />Open Daily Challenge<Icon name="arrow" size={18} /></button>
          </>}
          {dialog === 'online' && <>
            <div className="dialog-eyebrow"><Icon name="trophy" size={16} />PLAY WITH THE WORLD</div>
            <h2 id="dialog-title">Play online.</h2>
            <p className="dialog-intro">Choose how you want to compete. You’ll need a Block Party account before joining an online game.</p>
            <div className="online-mode-list">
              <button onClick={requestOnlineAccess}><span className="online-mode-icon">⚡</span><span><strong>Quick Match</strong><small>Find an opponent and play instantly</small></span><Icon name="arrow" size={17} /></button>
              <button onClick={requestOnlineAccess}><span className="online-mode-icon">♛</span><span><strong>Ranked Match</strong><small>Compete for rating and global rank</small></span><Icon name="arrow" size={17} /></button>
              <button onClick={requestOnlineAccess}><span className="online-mode-icon">◎</span><span><strong>Private Room</strong><small>Invite a friend with a room code</small></span><Icon name="arrow" size={17} /></button>
            </div>
            <div className="online-availability-note"><Icon name="lock" size={14} /> Account sign-in and live matchmaking will activate after the Supabase integration.</div>
          </>}
          {dialog === 'profile' && <>
            <div className="dialog-eyebrow"><Icon name="sparkle" size={16} />YOUR PLAYER CARD</div>
            <h2 id="dialog-title">A little about you.</h2>
            <p className="dialog-intro">Your solo progress is saved on this device. Sign in when online accounts are connected to sync your player identity and compete.</p>
            <div className="profile-card"><BrandMark /><div><strong>{identityState === 'ready' && globalUsername ? globalUsername : 'Block Party player'}</strong><span>{identityState === 'ready' ? 'Guest profile connected' : 'Local player profile'}</span></div><span className="profile-badge">{identityState === 'ready' ? 'GUEST' : 'LOCAL'}</span></div>
            <div className="feature-stat-grid"><div><strong>{(scores[0]?.score ?? 0).toLocaleString()}</strong><span>Personal best</span></div><div><strong>{localStats.gamesPlayed}</strong><span>Games played</span></div><div><strong>{localStats.totalLines}</strong><span>Lines cleared</span></div><div><strong>{localStats.bestCombo}×</strong><span>Best combo</span></div></div>
            <button className="secondary-feature-button" onClick={requestOnlineAccess}>Account &amp; Security <Icon name="arrow" size={16} /></button>
            <button className="secondary-feature-button" onClick={openGlobalLeaderboard}>Global leaderboard <Icon name="arrow" size={16} /></button>
          </>}
          {dialog === 'profile' && <div className="profile-shortcuts" aria-label="More profile options">
            <button onClick={() => setDialog('statistics')}><Icon name="trophy" size={16} />Statistics</button>
            <button onClick={() => setDialog('collection')}><Icon name="sparkle" size={16} />Collection</button>
            <button onClick={() => setDialog('shop')}><Icon name="lock" size={16} />Shop</button>
            <button onClick={() => setDialog('settings')}><Icon name="keyboard" size={16} />Settings</button>
          </div>}
          {dialog === 'statistics' && <>
            <div className="dialog-eyebrow"><Icon name="trophy" size={16} />YOUR LITTLE MILESTONES</div>
            <h2 id="dialog-title">The good stuff, counted.</h2>
            <p className="dialog-intro">Statistics are calculated from finished rounds on this device.</p>
            <div className="feature-stat-grid stats-grid"><div><strong>{localStats.gamesPlayed}</strong><span>Games played</span></div><div><strong>{localStats.gamesPlayed ? Math.round(localStats.totalScore / localStats.gamesPlayed).toLocaleString() : '0'}</strong><span>Average score</span></div><div><strong>{(scores[0]?.score ?? 0).toLocaleString()}</strong><span>Highest score</span></div><div><strong>{localStats.totalLines}</strong><span>Total lines</span></div><div><strong>{localStats.bestCombo}×</strong><span>Best combo</span></div><div><strong>—</strong><span>Playtime not tracked</span></div></div>
          </>}
          {dialog === 'collection' && <>
            <div className="dialog-eyebrow"><Icon name="sparkle" size={16} />YOUR BOARD, YOUR WAY</div>
            <h2 id="dialog-title">A small collection.</h2>
            <p className="dialog-intro">Choose local looks. These options are available offline and change only this device.</p>
            <h3 className="feature-section-label">BOARD THEMES</h3><div className="cosmetic-options">
              {([{ id: 'cream', label: 'Cream day', colors: ['#f8f7f4', '#ded9e5'] }, { id: 'lavender', label: 'Soft lavender', colors: ['#f3eff8', '#d8cde8'] }, { id: 'mint', label: 'Mint morning', colors: ['#eff6ed', '#d1e6d1'] }] as const).map((item) => <button className={`cosmetic-card ${cosmetics.theme === item.id ? 'selected' : ''}`} key={item.id} onClick={() => setCosmetics((value) => ({ ...value, theme: item.id }))}><span className="theme-preview" style={{ '--theme-one': item.colors[0], '--theme-two': item.colors[1] } as CSSProperties}><i /><i /><i /></span><strong>{item.label}</strong><small>{cosmetics.theme === item.id ? 'Selected' : 'Tap to use'}</small></button>)}
            </div>
            <h3 className="feature-section-label">BLOCK FINISH</h3><div className="cosmetic-options skin-options">
              {([{ id: 'classic', label: 'Classic', note: 'Original color blocks' }, { id: 'gloss', label: 'Soft gloss', note: 'Gentle highlights' }, { id: 'outline', label: 'Outline', note: 'Clearer edges' }] as const).map((item) => <button className={`cosmetic-card skin-card ${cosmetics.skin === item.id ? 'selected' : ''}`} key={item.id} onClick={() => setCosmetics((value) => ({ ...value, skin: item.id }))}><span className={`skin-preview skin-${item.id}`} /><strong>{item.label}</strong><small>{item.note}</small></button>)}
            </div>
          </>}
          {dialog === 'shop' && <>
            <div className="dialog-eyebrow"><Icon name="lock" size={16} />COSMETIC IDEAS</div>
            <h2 id="dialog-title">A shop, someday.</h2>
            <p className="dialog-intro">Here are proposed cosmetic products. Purchases are disabled because Google Play Billing is not configured.</p>
            <div className="shop-catalog">{[{ name: 'Pastel party pack', detail: 'Three gentle board themes', price: 'Proposed · $1.99' }, { name: 'Block finish set', detail: 'Gloss and outline block styles', price: 'Proposed · $0.99' }, { name: 'Celebration sounds', detail: 'A few extra clear effects', price: 'Proposed · $1.49' }].map((item) => <div className="shop-item" key={item.name}><span className="shop-swatch"><Icon name="sparkle" size={18} /></span><div><strong>{item.name}</strong><span>{item.detail}</span><small>{item.price}</small></div><button disabled aria-disabled="true">Unavailable</button></div>)}</div>
            <p className="shop-disabled-note"><Icon name="lock" size={13} />No payment flow is active. Nothing can be purchased here.</p>
          </>}
          {dialog === 'settings' && <>
            <div className="dialog-eyebrow"><Icon name="sparkle" size={16} />MAKE YOURSELF AT HOME</div>
            <h2 id="dialog-title">Settings.</h2>
            <p className="dialog-intro">Preferences are stored locally on this device.</p>
            <div className="settings-list">
              <label><span><strong>Sound</strong><small>Game effects and clear celebrations</small></span><input type="checkbox" checked={sound} onChange={(event) => setSound(event.target.checked)} /></label>
              <label><span><strong>Haptics</strong><small>Gentle feedback after moves</small></span><input type="checkbox" checked={hapticsEnabled} onChange={(event) => setHapticsEnabled(event.target.checked)} /></label>
              <label><span><strong>Motion effects</strong><small>Celebrations and animated transitions</small></span><input type="checkbox" checked={motionEnabled} onChange={(event) => setMotionEnabled(event.target.checked)} /></label>
            </div>
            <div className="settings-info"><strong>Privacy</strong><p>Solo scores and preferences stay on this device. Online accounts, cloud saves, matchmaking and ranked score uploads will be enabled after the Supabase Auth and backend integration.</p></div>
            <div className="settings-info"><strong>Support</strong><p>Support contact is not configured yet. App version 1.0.0 · Block Party.</p></div>
          </>}
          {dialog === 'help' && <>
            <div className="dialog-eyebrow"><Icon name="sparkle" size={16} />THE ART OF MAKING SPACE</div>
            <h2 id="dialog-title">Small moves. Big happy.</h2>
            <p className="dialog-intro">A simple little game with a very satisfying twist.</p>
            <div className="help-content">
              <div className="help-demo" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <span key={index} className={`demo-cell ${index >= 8 && index < 12 ? 'demo-clear' : ''} ${[0, 4, 5, 13, 14].includes(index) ? 'demo-filled' : ''}`} />)}<span className="demo-plus">+100</span></div>
              <ol className="dialog-rules">{HOW_TO.map((item, index) => <li key={item.title}><span>0{index + 1}</span><div><h3>{item.title}</h3><p>{item.text}</p></div></li>)}</ol>
            </div>
            <div className="combo-tip"><Icon name="sparkle" size={18} /><p><strong>A little extra magic:</strong> clear lines on consecutive moves to build a combo. Clear multiple lines at once for an even bigger score — and listen for the fanfare.</p></div>
            <div className="praise-scale" aria-label="Praise levels from nice to legendary">
              <span className="praise-scale-label">THE BIGGER THE MOVE, THE BIGGER THE CHEER</span>
              <div>{(['nice', 'great', 'amazing', 'incredible', 'legendary'] as PraiseTier[]).map((tier) => <span className={`tier-${tier}`} key={tier}>{PRAISES[tier].word}</span>)}</div>
            </div>
            <h3 className="controls-heading"><Icon name="keyboard" size={17} />Your shortcuts to happy</h3>
            <div className="controls-grid"><div><span>Choose a block</span><span><Key>1</Key><Key>2</Key><Key>3</Key></span></div><div><span>Move your block</span><Key>&#8592; &#8593; &#8594; &#8595;</Key></div><div><span>Place it</span><Key>Enter</Key></div><div><span>Give it a spin</span><Key>Space</Key></div><div><span>A little breather</span><span><Key>P</Key> / <Key>Esc</Key></span></div><div><span>A fresh start</span><Key>R</Key></div></div>
            <p className="touch-tip"><Icon name="mouse" size={15} />On touch? Drag a block, or tap a block and then the board. Tap Rotate to turn it.</p>
            <p className="scoring-note">5 points per square + 100 &times; lines squared &times; your combo. The round ends when none of your remaining blocks fit, even after rotating.</p>
            <button className="primary-button dialog-primary" onClick={closeDialog}>Sounds like a good time<Icon name="arrow" size={18} /></button>
          </>}
          {dialog === 'scores' && <>
            <div className="dialog-eyebrow"><Icon name="trophy" size={16} />YOUR OWN LITTLE HALL OF FAME</div>
            <h2 id="dialog-title">Good runs. Great little wins.</h2>
            <p className="dialog-intro">Your top 10 rounds, saved right here on this device.</p>
            {scores.length ? <div className="full-leaderboard" role="table" aria-label="Local high scores"><div className="leaderboard-table-header" role="row"><span role="columnheader">RANK</span><span role="columnheader">THE ROUND</span><span role="columnheader">SCORE</span></div>{scores.map((entry, index) => <div className={`leaderboard-row rank-${index + 1}`} key={entry.id} role="row"><span className="table-rank" role="cell">{index === 0 ? <Icon name="trophy" size={18} /> : String(index + 1).padStart(2, '0')}</span><span className="table-round" role="cell"><strong>{formatDate(entry.date)}{entry.id === game.id ? <span className="current-run-label">LATEST RUN</span> : ''}</strong><span>{entry.lines} {entry.lines === 1 ? 'line' : 'lines'} cleared{entry.combo > 1 ? ` / ${entry.combo}x combo` : ''}</span></span><strong className="table-score" role="cell">{entry.score.toLocaleString()}</strong></div>)}</div> : <div className="empty-leaderboard"><span className="empty-trophy"><Icon name="trophy" size={38} /><i /><i /></span><h3>Your first great run is waiting.</h3><p>Make a few good moves. We'll save the happy little result when your round ends or you start fresh.</p></div>}
            <div className="leaderboard-footer">{confirmClear ? <div className="clear-confirm"><span>Clear all saved runs?</span><button onClick={() => setConfirmClear(false)}>Keep them</button><button className="danger-text" onClick={() => { setScores([]); scoresRef.current = []; saveScores([]); setConfirmClear(false); }}>Clear scores</button></div> : <><span><Icon name="lock" size={12} />Your scores stay on your device.</span>{scores.length > 0 && <button onClick={() => setConfirmClear(true)}>Clear scores</button>}</>}</div>
            <button className="primary-button dialog-primary" onClick={() => { const currentStatus = status; closeDialog(); if (currentStatus === 'ready') startGame(); else if (currentStatus === 'over') restartGame(); }}>Make room for another round<Icon name="arrow" size={18} /></button>
          </>}
          {dialog === 'global' && <>
            <div className="dialog-eyebrow"><Icon name="trophy" size={16} />VERIFIED WORLDWIDE SCORES</div>
            <h2 id="dialog-title">The global leaderboard.</h2>
            <p className="dialog-intro">All-time best verified score per player. Local scores stay separate.</p>
            <div className="global-mode-tabs" role="tablist" aria-label="Leaderboard period"><button role="tab" aria-selected="true">All time</button><button role="tab" aria-selected="false" disabled title="Weekly rankings are not available yet">Weekly · coming later</button></div>
            <div className="global-account-row">
              <label htmlFor="global-username">Your username</label>
              <div className="global-username-form">
                <input id="global-username" value={usernameDraft} onChange={(event) => setUsernameDraft(event.target.value)} maxLength={20} placeholder="Your player name" disabled={identityState !== 'ready'} />
                <button onClick={saveUsername} disabled={identityState !== 'ready' || !usernameDraft.trim() || usernameDraft.trim() === globalUsername}>Save</button>
              </div>
              <span className="global-hint">3–20 letters, numbers, or underscores. Names are unique; changes are limited to once every 24 hours.</span>
              {usernameMessage && <span className="global-inline-message" role="status">{usernameMessage}</span>}
            </div>
            <div className="global-live-row">
              <span className={`global-live-dot ${realtimeStatus === 'live' ? 'is-live' : ''}`} />
              <span>{realtimeStatus === 'live' ? 'Live updates on' : `Live updates ${realtimeStatus}`}</span>
              {globalRefreshPending && <span className="global-refresh-note">Updating rankings…</span>}
              <button onClick={refreshByPull} disabled={globalLoading} aria-label="Refresh leaderboard">{globalLoading ? 'Loading…' : 'Refresh'}</button>
            </div>
            {identityState === 'unconfigured' && <div className="global-state global-state-offline"><strong>Global rankings aren’t configured.</strong><span>Add the Supabase project settings from .env.example and deploy the backend before enabling verified scores.</span></div>}
            {identityState === 'loading' && <div className="global-state"><span className="caption-dot" />Connecting your guest account…</div>}
            {identityState === 'offline' && <div className="global-state global-state-offline"><strong>Guest sign-in or rankings are unavailable.</strong><span>{identityError || 'Check your connection and try again.'}</span><button onClick={() => { setIdentityState('loading'); void ensureAnonymousIdentity().then(() => { setIdentityState('ready'); void refreshGlobalLeaderboard(); }).catch((error: unknown) => { setIdentityState('offline'); setIdentityError(error instanceof Error ? error.message : 'Guest sign-in failed.'); }); }}>Retry connection</button></div>}
            {rankedNotice && scoreVerification !== 'none' && <div className={`global-score-status ${scoreVerification}`} role="status">{rankedNotice}{scoreVerification === 'provisional' && initialRankedCheckpoint.current?.result && <button onClick={retryPendingSubmission}>Retry verification</button>}</div>}
            {globalError && <div className="global-state global-state-offline" role="alert"><strong>Could not load rankings.</strong><span>{globalError}</span><button onClick={refreshByPull}>Try again</button></div>}
            {globalTopThree.length > 0 && <div className="global-podium" aria-label="Top three global players">
              {[1, 0, 2].map((position) => {
                const entry = globalTopThree[position];
                return <div className={`podium-card podium-${position + 1}`} key={position}>
                  <span className="podium-rank">{entry ? `#${entry.rank}` : `#${position + 1}`}</span>
                  <strong>{entry?.username ?? '—'}</strong>
                  <span>{entry ? entry.score.toLocaleString() : 'No score yet'}</span>
                </div>;
              })}
            </div>}
            <label className="global-search-label" htmlFor="global-search">Search players</label>
            <input id="global-search" className="global-search" value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search a username" maxLength={20} />
            <div className="global-table-head"><span>RANK</span><span>PLAYER</span><span>SCORE</span></div>
            <div className="global-rank-list" ref={leaderboardScroll}
              onScroll={(event) => { const element = event.currentTarget; if (element.scrollHeight - element.scrollTop - element.clientHeight < 110) void loadMoreGlobal(); }}
              onTouchStart={(event) => { if (leaderboardScroll.current?.scrollTop === 0) touchStartY.current = event.touches[0]?.clientY ?? null; }}
              onTouchEnd={(event) => { const endY = event.changedTouches[0]?.clientY; if (touchStartY.current !== null && endY !== undefined && endY - touchStartY.current > 65 && leaderboardScroll.current?.scrollTop === 0) void refreshByPull(); touchStartY.current = null; }}>
              {(globalSearchResults ?? globalEntries).map((entry) => <div className={`global-rank-row ${globalMyEntry?.player_id === entry.player_id ? 'is-current-player' : ''}`} key={entry.player_id}>
                <strong>#{entry.rank}</strong><span>{entry.username}</span><b>{entry.score.toLocaleString()}</b>
              </div>)}
              {globalLoading && globalEntries.length === 0 && <div className="global-state">Loading verified rankings…</div>}
              {!globalLoading && !globalError && globalEntries.length === 0 && identityState === 'ready' && <div className="global-state">No verified scores yet. Your first ranked run can start the board.</div>}
              {!globalLoading && globalSearchResults?.length === 0 && <div className="global-state">No players found for that username.</div>}
              {globalLoading && globalEntries.length > 0 && <div className="global-state">Loading more players…</div>}
              {!globalHasMore && globalEntries.length > 0 && !globalSearchResults && <div className="global-state">You’re all caught up.</div>}
            </div>
            <div className="global-player-sticky"><span>{globalMyEntry ? `#${globalMyEntry.rank}` : 'YOUR RANK'}</span><strong>{globalMyEntry?.username ?? globalUsername ?? 'Your player'}</strong><b>{globalMyEntry ? globalMyEntry.score.toLocaleString() : 'Play a verified round'}</b></div>
          </>}
        </div>
      </dialog>
    </div>
  );
}
