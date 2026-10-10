// End-to-end Poppy flow against a running Worker, acting as a third-party personal agent that hosts its own
// client metadata. Run `npm run dev` (or ILMER_POPPY_OFFLINE=true npm run dev), then:
//   POPPY_E2E_ORIGIN=http://localhost:8787 npm test
// Offline, the agent's replies are the fallback apology; with Workers AI they are real answers.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

const ORIGIN = process.env.POPPY_E2E_ORIGIN;
const skip = ORIGIN ? false : 'set POPPY_E2E_ORIGIN to run against a Worker';
const JWT_GRANT = 'urn:ietf:params:oauth:grant-type:jwt-bearer';
const CLIENT_ASSERTION = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

let server;
let client;
let signing;
let dpop;
let dpopPublic;

const now = () => Math.floor(Date.now() / 1000);
const b64 = (bytes) => Buffer.from(bytes).toString('base64url');
const sha256 = async (value) =>
  b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));

async function assertion(subject, audience) {
  return new SignJWT({ jti: crypto.randomUUID() })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'k1' })
    .setIssuer(client)
    .setSubject(subject)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(now() + 60)
    .sign(signing.privateKey);
}
async function proof(method, url, token, jti = crypto.randomUUID()) {
  const u = new URL(url);
  u.search = '';
  return new SignJWT({ jti, htm: method, htu: u.href, iat: now(), ...(token ? { ath: await sha256(token) } : {}) })
    .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk: dpopPublic })
    .sign(dpop.privateKey);
}
async function getToken(extra = {}) {
  const endpoint = ORIGIN + '/oauth/token';
  const body = new URLSearchParams({
    grant_type: JWT_GRANT,
    client_id: client,
    client_assertion_type: CLIENT_ASSERTION,
    client_assertion: await assertion(client, endpoint),
    assertion: await assertion('user-123', endpoint),
    ...extra
  });
  return fetch(endpoint, { method: 'POST', headers: { DPoP: await proof('POST', endpoint) }, body });
}
async function call(token, method, path, body, jti) {
  const url = ORIGIN + path;
  return fetch(url, {
    method,
    headers: {
      Authorization: 'DPoP ' + token,
      DPoP: await proof(method, url, token, jti),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

before(async () => {
  if (skip) return;
  signing = await generateKeyPair('ES256', { extractable: true });
  dpop = await generateKeyPair('ES256', { extractable: true });
  dpopPublic = await exportJWK(dpop.publicKey);
  const jwk = { ...(await exportJWK(signing.publicKey)), kid: 'k1', alg: 'ES256', use: 'sig' };
  server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/agent.json')
      return res.end(
        JSON.stringify({
          client_id: client,
          client_name: 'E2E agent',
          jwks_uri: new URL('/jwks.json', client).href,
          token_endpoint_auth_method: 'private_key_jwt'
        })
      );
    if (req.url === '/jwks.json') return res.end(JSON.stringify({ keys: [jwk] }));
    res.statusCode = 404;
    res.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  client = `http://localhost:${server.address().port}/agent.json`;
});
after(() => server?.close());

test('discovery and authorization server metadata agree', { skip }, async () => {
  const discovery = await (await fetch(ORIGIN + '/.well-known/poppy.json')).json();
  const metadata = await (await fetch(discovery.auth.issuer + '/.well-known/oauth-authorization-server')).json();
  assert.equal(metadata.issuer, discovery.auth.issuer);
  assert.ok(metadata.poppy_domains.includes(discovery.organization.domain));
  assert.equal(discovery.agent.protocols[0].endpoint, ORIGIN + '/poppy/conversations');
});

test('signed-out session, conversation, replay and key binding', { skip, timeout: 90_000 }, async () => {
  const response = await getToken();
  const token = await response.json();
  assert.equal(response.status, 200, JSON.stringify(token));
  assert.equal(token.token_type, 'DPoP');
  assert.equal(token.signed_in, false);
  assert.equal(token.refresh_token, undefined);

  // The same session renews with a fresh token.
  const renewed = await (await getToken({ session_id: token.session_id })).json();
  assert.equal(renewed.session_id, token.session_id);

  const message = {
    id: 'msg-' + crypto.randomUUID(),
    sender: 'agent',
    text: 'When was the spire added to St Peter’s Church?'
  };
  const created = await call(token.access_token, 'POST', '/poppy/conversations?wait=1', { message });
  const conversation = await created.json();
  assert.equal(created.status, 201, JSON.stringify(conversation));
  assert.match(conversation.conversation_id, /^cnv_/);
  const replies = conversation.events.filter((e) => e.type === 'message' && e.message.role === 'company');
  assert.equal(replies.length, 1);
  assert.equal(replies[0].message.in_reply_to, message.id);
  assert.equal(conversation.status, 'idle');

  // Retrying the same message id returns the same conversation; reusing it for different content conflicts.
  const retry = await (await call(token.access_token, 'POST', '/poppy/conversations', { message })).json();
  assert.equal(retry.conversation_id, conversation.conversation_id);
  const conflict = await call(token.access_token, 'POST', '/poppy/conversations', {
    message: { ...message, text: 'Different' }
  });
  assert.equal(conflict.status, 409);

  const events = await (
    await call(token.access_token, 'GET', `/poppy/conversations/${conversation.conversation_id}/events`)
  ).json();
  assert.ok(events.events.length >= 4);

  // A DPoP proof's jti is single use.
  const jti = crypto.randomUUID();
  const path = `/poppy/conversations/${conversation.conversation_id}/events`;
  assert.equal((await call(token.access_token, 'GET', path, undefined, jti)).status, 200);
  assert.equal((await call(token.access_token, 'GET', path, undefined, jti)).status, 401);

  // The token is bound to its DPoP key.
  const stolen = await fetch(ORIGIN + path, { headers: { Authorization: 'DPoP ' + token.access_token } });
  assert.equal(stolen.status, 401);

  const closed = await (
    await call(token.access_token, 'POST', `/poppy/conversations/${conversation.conversation_id}/close`, {})
  ).json();
  assert.equal(closed.status, 'closed');
  const late = await call(token.access_token, 'POST', `/poppy/conversations/${conversation.conversation_id}/messages`, {
    message: { id: 'msg-' + crypto.randomUUID(), sender: 'human', text: 'Hello?' }
  });
  assert.equal(late.status, 409);
});

test('client assertions are single use and must be signed by the client', { skip }, async () => {
  const endpoint = ORIGIN + '/oauth/token';
  const clientAssertion = await assertion(client, endpoint);
  const body = () =>
    new URLSearchParams({
      grant_type: JWT_GRANT,
      client_id: client,
      client_assertion_type: CLIENT_ASSERTION,
      client_assertion: clientAssertion
    });
  const first = await fetch(endpoint, {
    method: 'POST',
    headers: { DPoP: await proof('POST', endpoint) },
    body: body()
  });
  assert.notEqual(first.status, 401); // Fails later for the missing grant assertion, not client auth.
  const replay = await fetch(endpoint, {
    method: 'POST',
    headers: { DPoP: await proof('POST', endpoint) },
    body: body()
  });
  assert.equal(replay.status, 401);
  assert.equal((await replay.json()).error, 'invalid_client');
});

test('revoked access tokens stop working', { skip }, async () => {
  const token = await (await getToken()).json();
  const endpoint = ORIGIN + '/oauth/revoke';
  const revoked = await fetch(endpoint, {
    method: 'POST',
    body: new URLSearchParams({
      token: token.access_token,
      client_id: client,
      client_assertion_type: CLIENT_ASSERTION,
      client_assertion: await assertion(client, endpoint)
    })
  });
  assert.equal(revoked.status, 200);
  const after = await call(token.access_token, 'POST', '/poppy/conversations', {
    message: { id: 'msg-' + crypto.randomUUID(), sender: 'human', text: 'Hi' }
  });
  assert.equal(after.status, 401);
});
