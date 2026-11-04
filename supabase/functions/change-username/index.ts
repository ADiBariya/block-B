import { authenticatedUser, json, preflight, requestJson, serviceClient } from '../_shared/http.ts';

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  try {
    const user = await authenticatedUser(request);
    const body = await requestJson(request);
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return json({ error: 'Use 3–20 letters, numbers, or underscores.' }, 400);
    const { data, error } = await serviceClient().rpc('rename_player', { p_player_id: user.id, p_username: username });
    if (error) {
      if (error.code === '23505') return json({ error: 'That username is already taken.' }, 409);
      if (error.message.includes('username_cooldown')) return json({ error: 'Username can only be changed once every 24 hours.' }, 429);
      throw error;
    }
    return json({ username: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to change username';
    return json({ error: message }, message === 'Authentication required' ? 401 : 503);
  }
});
