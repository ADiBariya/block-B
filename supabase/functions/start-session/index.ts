import { RULESET_VERSION } from '../../../src/game/engine.ts';
import { authenticatedUser, json, preflight, serviceClient } from '../_shared/http.ts';

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  try {
    const user = await authenticatedUser(request);
    const admin = serviceClient();
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const { data, error } = await admin.rpc('create_ranked_session', {
      p_player_id: user.id,
      p_seed: random[0],
      p_ruleset_version: RULESET_VERSION,
      p_expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    });
    if (error) {
      if (error.message.includes('session_rate_limit')) return json({ error: 'Too many sessions. Try again in a few minutes.' }, 429);
      throw error;
    }
    const session = data?.[0];
    if (!session) throw new Error('Could not create a ranked session.');
    return json({ sessionId: session.session_id, seed: Number(session.seed), rulesetVersion: session.ruleset_version, expiresAt: session.expires_at });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start a ranked session';
    return json({ error: message }, message === 'Authentication required' ? 401 : 503);
  }
});
