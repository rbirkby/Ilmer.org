import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { SignJWT, exportJWK, generateKeyPair, type GenerateKeyPairResult, type JWK } from 'jose';
import {
  ProtocolError,
  bodyJson,
  cookie,
  errorResponse,
  formBody,
  permittedUrl,
  readText,
  scopes,
  securityHeaders,
  sha256,
  verifyAssertion,
  verifyProof
} from '../src/protocol.ts';

const CLIENT = 'https://agent.example/client.json';
const AUDIENCE = 'https://poppy.ilmer.org/oauth/token';
const now = () => Math.floor(Date.now() / 1000);

let signing: GenerateKeyPairResult;
let keys: JWK[];
let dpop: GenerateKeyPairResult;
let dpopPublic: JWK;

before(async () => {
  signing = await generateKeyPair('ES256');
  keys = [{ ...(await exportJWK(signing.publicKey)), kid: 'k1' }];
  dpop = await generateKeyPair('ES256');
  dpopPublic = await exportJWK(dpop.publicKey);
});

/** Asserts that `run` throws (or rejects with) the given protocol error. */
async function rejects(run: () => unknown, code: string, status = 400) {
  await assert.rejects(
    async () => run(),
    (e: unknown) => e instanceof ProtocolError && e.code === code && e.status === status
  );
}

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request('https://poppy.ilmer.org/x', { method: 'POST', body, headers });

test('permittedUrl allows public HTTPS, and http://localhost only while developing', async () => {
  assert.equal(permittedUrl('https://agent.example/c.json', false).href, 'https://agent.example/c.json');
  assert.equal(permittedUrl('http://localhost:9000/c.json', true).port, '9000');
  for (const url of [
    'http://localhost:9000/c.json',
    'http://agent.example/c.json',
    'https://agent.example/c.json#frag',
    'https://user:pass@agent.example/c.json',
    'https://10.0.0.1/c.json',
    'https://[::1]/c.json',
    'not a url'
  ])
    await rejects(() => permittedUrl(url, false), 'invalid_client', 401);
  await rejects(() => permittedUrl('http://agent.example/c.json', true), 'invalid_client', 401);
});

test('scopes defaults to all, removes duplicates and rejects unknown scopes', async () => {
  assert.deepEqual(scopes(null), ['poppy:read', 'poppy:write']);
  assert.deepEqual(scopes('poppy:read  poppy:read'), ['poppy:read']);
  await rejects(() => scopes(''), 'invalid_scope');
  await rejects(() => scopes('poppy:read admin'), 'invalid_scope');
});

test('formBody rejects repeated parameters', async () => {
  assert.equal((await formBody(post('a=1&b=2'))).get('b'), '2');
  await rejects(() => formBody(post('a=1&a=2')), 'invalid_request');
});

test('bodyJson accepts only JSON objects within the size limit', async () => {
  assert.deepEqual(await bodyJson(post('{"a":1}')), { a: 1 });
  for (const body of ['', 'nope', '[]', 'null', '3']) await rejects(() => bodyJson(post(body)), 'invalid_request');
  await rejects(() => bodyJson(post(JSON.stringify({ a: 'x'.repeat(70000) }))), 'request_too_large', 413);
});

test('readText reads bodies up to the limit', async () => {
  assert.equal(await readText(new Response('héllo'), 6), 'héllo');
  assert.equal(await readText(new Response(null)), '');
  await rejects(() => readText(new Response('héllo'), 5), 'request_too_large', 413);
});

test('cookie finds the named cookie only', () => {
  const request = new Request('https://poppy.ilmer.org/', {
    headers: { Cookie: 'ilmer_visitor2=no; ilmer_visitor=abc=; other=1' }
  });
  assert.equal(cookie(request, 'ilmer_visitor'), 'abc=');
  assert.equal(cookie(request, 'missing'), undefined);
  assert.equal(cookie(new Request('https://poppy.ilmer.org/'), 'ilmer_visitor'), undefined);
});

test('errorResponse reports protocol errors and hides others', async (t) => {
  const token = errorResponse(new ProtocolError('invalid_token', 401, { hint: 'x' }));
  assert.equal(token.status, 401);
  assert.equal(token.headers.get('WWW-Authenticate'), 'DPoP error="invalid_token"');
  assert.equal(token.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await token.json(), { error: 'invalid_token', hint: 'x' });

  const scope = errorResponse(new ProtocolError('insufficient_scope', 403));
  assert.equal(scope.headers.get('WWW-Authenticate'), null);

  const logged = t.mock.method(console, 'error', () => {});
  const crash = errorResponse(new Error('secret detail'));
  assert.equal(crash.status, 500);
  assert.deepEqual(await crash.json(), { error: 'server_error' });
  assert.equal(logged.mock.callCount(), 1);
});

test('securityHeaders keeps the response and adds headers, even to immutable responses', async () => {
  const response = securityHeaders(Response.redirect('https://www.ilmer.org/', 302));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), 'https://www.ilmer.org/');
  assert.equal(
    response.headers.get('Content-Security-Policy'),
    "frame-ancestors 'self' https://www.ilmer.org https://ilmer.org http://localhost:8080"
  );
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

async function assertion(
  claims: { sub?: string; aud?: string; iat?: number; exp?: number; jti?: string } = {},
  header: { kid?: string; typ?: string } = {}
) {
  const iat = claims.iat ?? now();
  return new SignJWT({ jti: claims.jti ?? crypto.randomUUID() })
    .setProtectedHeader({ alg: 'ES256', typ: header.typ ?? 'JWT', kid: header.kid ?? 'k1' })
    .setIssuer(CLIENT)
    .setSubject(claims.sub ?? 'user-123')
    .setAudience(claims.aud ?? AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(claims.exp ?? iat + 60)
    .sign(signing.privateKey);
}

test('verifyAssertion accepts a short-lived assertion signed by a published key', async () => {
  const payload = await verifyAssertion(await assertion(), keys, CLIENT, AUDIENCE);
  assert.equal(payload.sub, 'user-123');
  assert.equal(typeof payload.jti, 'string');
  assert.equal((await verifyAssertion(await assertion({ sub: CLIENT }), keys, CLIENT, AUDIENCE, CLIENT)).sub, CLIENT);
});

test('verifyAssertion rejects wrong keys, claims and lifetimes', async () => {
  const other = await generateKeyPair('ES256');
  const cases: [string, Promise<string>, JWK[]?, string?][] = [
    ['unknown kid', assertion({}, { kid: 'k2' })],
    ['wrong typ', assertion({}, { typ: 'at+jwt' })],
    ['wrong audience', assertion({ aud: 'https://elsewhere.example/token' })],
    ['too long lived', assertion({ exp: now() + 300 })],
    ['issued in the future', assertion({ iat: now() + 120 })],
    ['issued long ago', assertion({ iat: now() - 120, exp: now() - 60 })],
    ['oversized subject', assertion({ sub: 'x'.repeat(257) })],
    ['wrong subject', assertion(), keys, 'someone-else'],
    ['private key published', assertion(), [{ ...keys[0], d: 'secret' }]],
    ['other signer', assertion(), [{ ...(await exportJWK(other.publicKey)), kid: 'k1' }]]
  ];
  for (const [name, jwt, published = keys, subject] of cases)
    await assert.rejects(
      async () => verifyAssertion(await jwt, published, CLIENT, AUDIENCE, subject),
      (e: unknown) => e instanceof ProtocolError && e.code === 'invalid_grant',
      name
    );
  await rejects(() => verifyAssertion('not.a.jwt', keys, CLIENT, AUDIENCE), 'invalid_grant');
});

async function proof(
  fields: { htm?: string; htu?: string; iat?: number; ath?: string; jti?: string } = {},
  jwk: JWK = dpopPublic,
  typ = 'dpop+jwt'
) {
  return new SignJWT({
    jti: fields.jti ?? crypto.randomUUID(),
    htm: fields.htm ?? 'POST',
    htu: fields.htu ?? 'https://poppy.ilmer.org/poppy/conversations',
    iat: fields.iat ?? now(),
    ...(fields.ath ? { ath: fields.ath } : {})
  })
    .setProtectedHeader({ alg: 'ES256', typ, jwk })
    .sign(dpop.privateKey);
}
const proven = (jwt?: string, method = 'POST') =>
  new Request('https://poppy.ilmer.org/poppy/conversations', {
    method,
    headers: jwt ? { DPoP: jwt } : {}
  });
const URL_ = 'https://poppy.ilmer.org/poppy/conversations?wait';

test('verifyProof returns the key thumbprint and jti, ignoring the query string', async () => {
  const result = await verifyProof(proven(await proof({ jti: 'p1' })), URL_);
  assert.equal(result.jti, 'p1');
  assert.match(result.thumbprint, /^[A-Za-z0-9_-]{43}$/);

  const token = 'abc.def';
  const bound = await verifyProof(proven(await proof({ ath: await sha256(token) })), URL_, token);
  assert.equal(bound.thumbprint, result.thumbprint);
});

test('verifyProof rejects proofs for other requests, tokens or keys', async () => {
  const token = 'abc.def';
  const ath = await sha256(token);
  // Without an access token a bad proof is a 400; with one it is a 401.
  await rejects(async () => verifyProof(proven(), URL_), 'invalid_dpop_proof', 400);
  await rejects(async () => verifyProof(proven(), URL_, token), 'invalid_dpop_proof', 401);
  const cases: [string, Promise<string>, string?, string?][] = [
    ['wrong method', proof({ htm: 'GET' })],
    ['wrong target', proof({ htu: 'https://poppy.ilmer.org/oauth/token' })],
    ['stale', proof({ iat: now() - 120 })],
    ['wrong typ', proof({}, dpopPublic, 'JWT')],
    ['private key in header', proof({}, { ...dpopPublic, d: 'secret' })],
    ['ath without token', proof({ ath })],
    ['missing ath', proof(), token],
    ['ath for another token', proof({ ath }), 'other.token'],
    ['request method differs', proof(), undefined, 'GET']
  ];
  for (const [name, jwt, bearer, method] of cases)
    await assert.rejects(
      async () => verifyProof(proven(await jwt, method), URL_, bearer),
      (e: unknown) => e instanceof ProtocolError && e.code === 'invalid_dpop_proof',
      name
    );
});
