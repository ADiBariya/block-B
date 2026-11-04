export type RankEntry = {
  player_id: string;
  username: string;
  score: number;
  verified_at: string;
  rank: number;
};

export type RankCursor = Pick<RankEntry, 'player_id' | 'score' | 'verified_at'>;
export type ScoreNotice = { id: string; player_id: string; score: number; verified_at?: string };

export function nextCursor(entries: RankEntry[]): RankCursor | null {
  const last = entries.at(-1);
  return last ? { player_id: last.player_id, score: last.score, verified_at: last.verified_at } : null;
}

export function appendUniqueEntries(existing: RankEntry[], incoming: RankEntry[]): RankEntry[] {
  const byPlayer = new Map(existing.map((entry) => [entry.player_id, entry]));
  for (const entry of incoming) {
    const current = byPlayer.get(entry.player_id);
    if (!current || entry.score > current.score || (entry.score === current.score && entry.rank < current.rank)) byPlayer.set(entry.player_id, entry);
  }
  return [...byPlayer.values()].sort((a, b) => a.rank - b.rank);
}

export function validateUsername(value: string): string {
  const username = value.trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new Error('Use 3–20 letters, numbers, or underscores.');
  return username;
}

/** Bounded event-id cache protects a live view from duplicate Realtime delivery. */
export class EventDeduper {
  private readonly seen = new Set<string>();
  private readonly order: string[] = [];

  accept(id: string): boolean {
    if (!id || this.seen.has(id)) return false;
    this.seen.add(id);
    this.order.push(id);
    if (this.order.length > 256) this.seen.delete(this.order.shift()!);
    return true;
  }
}
