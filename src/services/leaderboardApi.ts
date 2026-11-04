import type { RealtimeChannel } from '@supabase/supabase-js';
import type { RankCursor, RankEntry, ScoreNotice } from '../game/leaderboard';
import { getSupabase } from './supabase';

export type GlobalPage = {
  entries: RankEntry[];
  top_three: RankEntry[];
  my_entry: RankEntry | null;
  my_rank: number | null;
  next_cursor: RankCursor | null;
  has_more: boolean;
  username: string | null;
};

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const client = getSupabase();
  if (!client) throw new Error('Global leaderboard is not configured.');
  const { data, error } = await client.functions.invoke<T>(name, { body });
  if (error) {
    const context = (error as unknown as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: unknown };
        if (typeof payload.error === 'string') throw new Error(payload.error);
      } catch (responseError) {
        if (responseError instanceof Error && responseError.message !== 'Unexpected end of JSON input') throw responseError;
      }
    }
    throw error;
  }
  if (data === null) throw new Error('Supabase returned an empty response.');
  return data;
}

export type RankedSession = { sessionId: string; seed: number; rulesetVersion: number; expiresAt: string };
export type VerifiedSubmission = { verified: true; duplicate: boolean; entry_id: string; score: number };

export function startRankedSession() {
  return invoke<RankedSession>('start-session', {});
}

export function submitRankedScore(body: {
  sessionId: string;
  idempotencyKey: string;
  actions: unknown[];
  score: number;
  lines: number;
  moves: number;
  rulesetVersion: number;
}) {
  return invoke<VerifiedSubmission>('submit-score', body);
}

export function loadGlobalPage(cursor: RankCursor | null = null) {
  return invoke<GlobalPage>('leaderboard-page', { cursor });
}

export async function searchGlobalPlayers(search: string) {
  const result = await invoke<{ entries: RankEntry[] }>('leaderboard-page', { search });
  return result.entries;
}

export function renameGlobalPlayer(username: string) {
  return invoke<{ username: string }>('change-username', { username });
}

export async function subscribeToGlobalScores(onScore: (score: ScoreNotice) => void, onStatus: (status: string) => void): Promise<() => void> {
  const client = getSupabase();
  if (!client) throw new Error('Global leaderboard is not configured.');
  await client.realtime.setAuth();
  let alive = true;
  const channel: RealtimeChannel = client.channel('global-leaderboard', { config: { private: true } })
    .on('broadcast', { event: 'INSERT' }, (message) => {
      const envelope = message as unknown as { payload?: Record<string, unknown> };
      const candidate = envelope.payload?.record ?? envelope.payload?.new ?? envelope.payload;
      if (!candidate || typeof candidate !== 'object') return;
      const row = candidate as Record<string, unknown>;
      if (typeof row.id !== 'string' || typeof row.player_id !== 'string' || !Number.isInteger(row.score)) return;
      onScore({ id: row.id, player_id: row.player_id, score: row.score as number, verified_at: typeof row.verified_at === 'string' ? row.verified_at : undefined });
    })
    .subscribe((status) => { if (alive) onStatus(status); });
  return () => {
    alive = false;
    void client.removeChannel(channel);
  };
}
