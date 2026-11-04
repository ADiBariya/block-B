import { authenticatedUser, json, preflight, requestJson, serviceClient } from '../_shared/http.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  try {
    const user = await authenticatedUser(request);
    const body = await requestJson(request);
    const admin = serviceClient();
    if (typeof body.search === 'string') {
      const query = body.search.trim();
      if (query.length < 2 || query.length > 20 || !/^[A-Za-z0-9_]+$/.test(query)) return json({ entries: [] });
      const { data, error } = await admin.rpc('search_global_leaderboard', { p_query: query, p_limit: 20 });
      if (error) throw error;
      return json({ entries: data ?? [] });
    }
    let cursor: { score: number; verified_at: string; player_id: string } | null = null;
    if (body.cursor !== undefined && body.cursor !== null) {
      if (typeof body.cursor !== 'object' || Array.isArray(body.cursor)) return json({ error: 'Invalid pagination cursor' }, 400);
      const candidate = body.cursor as Record<string, unknown>;
      if (typeof candidate.score !== 'number' || !Number.isSafeInteger(candidate.score) || typeof candidate.verified_at !== 'string' ||
        !Number.isFinite(Date.parse(candidate.verified_at)) || typeof candidate.player_id !== 'string' || !UUID.test(candidate.player_id)) {
        return json({ error: 'Invalid pagination cursor' }, 400);
      }
      cursor = { score: candidate.score, verified_at: candidate.verified_at, player_id: candidate.player_id };
    }
    const { data, error } = await admin.rpc('global_leaderboard_page', {
      p_player_id: user.id,
      p_cursor_score: cursor?.score ?? null,
      p_cursor_verified_at: cursor?.verified_at ?? null,
      p_cursor_player_id: cursor?.player_id ?? null,
      p_page_size: 50,
    });
    if (error) throw error;
    const { data: profile, error: profileError } = await admin.from('players').select('username').eq('id', user.id).maybeSingle();
    if (profileError) throw profileError;
    return json({ ...data, username: profile?.username ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load leaderboard';
    return json({ error: message }, message === 'Authentication required' ? 401 : 503);
  }
});
