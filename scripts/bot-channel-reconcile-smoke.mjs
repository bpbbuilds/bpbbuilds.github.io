import assert from 'node:assert/strict';
import { ensureGuildChannel } from '../bot/channel-reconcile.js';

function fakeFetch(routes, calls) {
  return async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null });
    const route = routes.find((candidate) => (
      candidate.method === (init.method || 'GET') && url.endsWith(candidate.path)
    ));
    if (!route) return new Response('not found', { status: 404 });
    const payload = typeof route.body === 'string' ? route.body : JSON.stringify(route.body ?? {});
    return new Response(payload, { status: route.status ?? 200 });
  };
}

const base = {
  token: 'test-token',
  guildId: 'guild-1',
  type: 4,
  name: 'Information',
  body: { position: 2 },
};

{
  const calls = [];
  const id = await ensureGuildChannel({
    ...base,
    existingId: 'saved-category',
    fetchImpl: fakeFetch([
      { method: 'GET', path: '/channels/saved-category', body: { id: 'saved-category', guild_id: 'guild-1', type: 4, name: 'Information' } },
      { method: 'PATCH', path: '/channels/saved-category', body: {} },
    ], calls),
  });
  assert.equal(id, 'saved-category');
  assert.deepEqual(calls.map((call) => call.method), ['GET', 'PATCH']);
}

{
  const calls = [];
  const id = await ensureGuildChannel({
    ...base,
    existingId: 'stale-id',
    fetchImpl: fakeFetch([
      { method: 'GET', path: '/channels/stale-id', body: { id: 'stale-id', guild_id: 'guild-1', type: 4, name: 'Unrelated' } },
      { method: 'GET', path: '/guilds/guild-1/channels', body: [{ id: 'real-category', type: 4, name: 'Information' }] },
      { method: 'PATCH', path: '/channels/real-category', body: {} },
    ], calls),
  });
  assert.equal(id, 'real-category');
  assert.equal(calls.some((call) => call.url.endsWith('/channels/stale-id') && call.method === 'PATCH'), false);
}

{
  const calls = [];
  const id = await ensureGuildChannel({
    ...base,
    fetchImpl: fakeFetch([
      { method: 'GET', path: '/guilds/guild-1/channels', body: [
        { id: 'other', type: 4, name: 'Other' },
        { id: 'existing-category', type: 4, name: 'Information' },
      ] },
      { method: 'PATCH', path: '/channels/existing-category', body: {} },
    ], calls),
  });
  assert.equal(id, 'existing-category');
  assert.equal(calls.filter((call) => call.method === 'POST').length, 0);
}

{
  const calls = [];
  const id = await ensureGuildChannel({
    ...base,
    fetchImpl: fakeFetch([
      { method: 'GET', path: '/guilds/guild-1/channels', body: [{ id: 'other', type: 4, name: 'Other' }] },
      { method: 'POST', path: '/guilds/guild-1/channels', body: { id: 'new-category' } },
    ], calls),
  });
  assert.equal(id, 'new-category');
  assert.deepEqual(calls.at(-1).body, { position: 2, name: 'Information', type: 4 });
}

{
  const calls = [];
  const id = await ensureGuildChannel({
    ...base,
    fetchImpl: fakeFetch([
      { method: 'GET', path: '/guilds/guild-1/channels', status: 503, body: { message: 'temporary failure' } },
      { method: 'POST', path: '/guilds/guild-1/channels', body: { id: 'must-not-be-created' } },
    ], calls),
  });
  assert.equal(id, '');
  assert.equal(calls.filter((call) => call.method === 'POST').length, 0);
}

console.log('bot channel reconciliation smoke passed');
