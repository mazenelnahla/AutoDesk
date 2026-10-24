import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';

process.env.APS_CLIENT_ID = 'test-client';
process.env.APS_CLIENT_SECRET = 'test-secret';
const { getApplicationToken, getViewerToken } = await import('./aps.js');

test('two-legged tokens share requests, separate scopes, renew early and recover from failures', async () => {
  const original = AuthenticationClient.prototype.getTwoLeggedToken;
  const originalNow = Date.now;
  let now = originalNow();
  let calls = [];
  let fail = false;
  Date.now = () => now;
  AuthenticationClient.prototype.getTwoLeggedToken = async (id, secret, scopes) => {
    assert.equal(id, 'test-client');
    assert.equal(secret, 'test-secret');
    calls.push(scopes);
    if (fail) throw new Error('temporary failure');
    return { access_token: `token-${calls.length}`, expires_in: 3600 };
  };
  try {
    const tokens = await Promise.all([getViewerToken(), getViewerToken()]);
    assert.equal(calls.length, 1);
    assert.equal(tokens[0].access_token, tokens[1].access_token);
    assert.deepEqual(calls[0], [Scopes.ViewablesRead]);
    now += 1000;
    assert.equal((await getViewerToken()).expires_in, 3599);
    await getApplicationToken([Scopes.DataRead, Scopes.ViewablesRead]);
    assert.equal(calls.length, 2);
    now += 3540000;
    fail = true;
    await assert.rejects(getViewerToken(), /temporary failure/);
    fail = false;
    assert.equal((await getViewerToken()).access_token, 'token-4');
  } finally {
    Date.now = originalNow;
    AuthenticationClient.prototype.getTwoLeggedToken = original;
  }
});
