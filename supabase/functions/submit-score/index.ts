import { RULESET_VERSION } from '../../../src/game/engine.ts';
import { assertVerifiedResult, MAX_REPLAY_ACTIONS, replayGame, type ReplayAction } from '../../../src/game/competitive.ts';
import { authenticatedUser, json, preflight, requestJson, serviceClient, sha256 } from '../_shared/http.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  try {
    const user = await authenticatedUser(request);
    const body = await requestJson(request);
    const { sessionId, idempotencyKey, actions, score, lines, moves, rulesetVersion } = body;
    if (typeof sessionId !== 'string' || !UUID.test(sessionId) || typeof idempotencyKey !== 'string' || !UUID.test(idempotencyKey)) {
      return json({ error: 'Invalid session or idempotency key' }, 400);
    }
    if (!Array.isArray(actions) || actions.length === 0 || actions.length > MAX_REPLAY_ACTIONS) return json({ error: 'Invalid move history' }, 400);
    if (!isInt(score) || !isInt(lines) || !isInt(moves) || !isInt(rulesetVersion) || score < 0 || score > 2_000_000_000 || lines < 0 || moves < 1 || moves > 5_000 || rulesetVersion !== RULESET_VERSION) {
      return json({ error: 'Invalid reported result' }, 400);
    }
    const admin = serviceClient();
    const { data: session, error: sessionError } = await admin.from('game_sessions').select('id, player_id, seed, ruleset_version, expires_at, submitted_at')
      .eq('id', sessionId).maybeSingle();
    if (sessionError) throw sessionError;
    if (!session || session.player_id !== user.id || session.ruleset_version !== RULESET_VERSION) return json({ error: 'Session not found for this player' }, 404);
    if (new Date(session.expires_at).getTime() <= Date.now()) return json({ error: 'Session expired' }, 410);

    let replay;
    try {
      replay = replayGame(Number(session.seed), session.id, actions as ReplayAction[]);
      assertVerifiedResult(replay, { score, lines, moves });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Replay rejected' }, 422);
    }
    const payloadHash = await sha256({ sessionId, rulesetVersion, actions, score, lines, moves });
    const { data, error } = await admin.rpc('accept_verified_score', {
      p_player_id: user.id,
      p_session_id: session.id,
      p_idempotency_key: idempotencyKey,
      p_payload_hash: payloadHash,
      p_score: score,
      p_lines: lines,
      p_moves: moves,
      p_ruleset_version: RULESET_VERSION,
    });
    if (error) {
      if (error.message.includes('session_already_submitted')) return json({ error: 'Session was already submitted with a different request' }, 409);
      if (error.message.includes('invalid_session')) return json({ error: 'Invalid session' }, 404);
      throw error;
    }
    return json({ verified: true, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to verify score';
    return json({ error: message }, message === 'Authentication required' ? 401 : 503);
  }
});
