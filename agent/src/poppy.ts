// Poppy (Personal Agent Protocol draft 0.1) receiver for Ilmer Past. Any personal agent may connect: its client_id is
// an HTTPS URL to its client metadata, it authenticates with private_key_jwt and binds tokens to a DPoP key.
// Ilmer Past has no user accounts, so only signed-out sessions exist (no authorization endpoint or refresh tokens).
import type { JWK } from 'jose';
import {
  CLIENT_ASSERTION,
  JWT_GRANT,
  SCOPES,
  bodyJson,
  fail,
  formBody,
  json,
  now,
  permittedUrl,
  randomSecret,
  readText,
  scopes,
  sha256,
  verifyAssertion,
  verifyProof,
  type Message
} from './protocol';
import type { Input, RpcResult } from './state';

type ClientMetadata = { client_id: string; client_name?: string; jwks_uri: string; token_endpoint_auth_method: string };

const local = (env: Env) => env.LOCAL_DEV === 'true';

export function discovery(env: Env) {
  return json(
    {
      protocol_version: '0.1',
      organization: { name: 'Ilmer Past', domain: new URL(env.ORIGIN).hostname, url: env.SITE_URL },
      description:
        'Local history archive for the parish of Ilmer, Buckinghamshire. Ask about its people, church, records and past.',
      auth: { issuer: env.ORIGIN },
      agent: { protocols: [{ type: 'poppy', endpoint: env.ORIGIN + '/poppy/conversations' }] },
      apis: [],
      web: { url: env.SITE_URL }
    },
    200,
    { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' }
  );
}

export function authorizationServer(env: Env) {
  return json(
    {
      issuer: env.ORIGIN,
      poppy_domains: [new URL(env.ORIGIN).hostname],
      token_endpoint: env.ORIGIN + '/oauth/token',
      revocation_endpoint: env.ORIGIN + '/oauth/revoke',
      grant_types_supported: [JWT_GRANT],
      token_endpoint_auth_methods_supported: ['private_key_jwt'],
      token_endpoint_auth_signing_alg_values_supported: ['ES256'],
      dpop_signing_alg_values_supported: ['ES256'],
      scopes_supported: SCOPES
    },
    200,
    { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' }
  );
}

async function fetchJson(env: Env, url: string) {
  permittedUrl(url, local(env));
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    // Redirects are refused: a 3xx is not ok and fails below.
    redirect: 'manual',
    signal: AbortSignal.timeout(5000),
    cf: { cacheTtl: 300 }
  });
  if (!response.ok) fail('invalid_client', 401);
  try {
    return JSON.parse(await readText(response, 32768)) as unknown;
  } catch {
    fail('invalid_client', 401);
  }
}

/** Loads a personal agent's published client metadata and signing keys. */
async function client(env: Env, clientId: string): Promise<{ metadata: ClientMetadata; keys: JWK[] }> {
  const origin = permittedUrl(clientId, local(env)).origin;
  const metadata = (await fetchJson(env, clientId)) as ClientMetadata;
  if (
    metadata?.client_id !== clientId ||
    metadata.token_endpoint_auth_method !== 'private_key_jwt' ||
    typeof metadata.jwks_uri !== 'string' ||
    permittedUrl(metadata.jwks_uri, local(env)).origin !== origin
  )
    fail('invalid_client', 401);
  const jwks = (await fetchJson(env, metadata.jwks_uri)) as { keys?: JWK[] };
  if (!Array.isArray(jwks?.keys) || !jwks.keys.length || jwks.keys.some((k) => !!k.d)) fail('invalid_client', 401);
  return { metadata, keys: jwks.keys };
}

/** Records a single-use value (assertion or proof jti) in a guard object shared by one client or one DPoP key. */
async function single(env: Env, shard: string, value: string, expires: number) {
  return env.GUARDS.getByName(shard).accept(value, expires);
}

async function authenticateClient(env: Env, params: URLSearchParams, audience: string) {
  const clientId = params.get('client_id') ?? '';
  if (params.get('client_assertion_type') !== CLIENT_ASSERTION) fail('invalid_client', 401);
  const { keys } = await client(env, clientId);
  let payload;
  try {
    payload = await verifyAssertion(params.get('client_assertion') ?? '', keys, clientId, audience, clientId);
  } catch {
    fail('invalid_client', 401);
  }
  if (!(await single(env, 'assertion:' + clientId, payload.jti, payload.exp + 5))) fail('invalid_client', 401);
  return { clientId, keys };
}

async function checkProof(env: Env, request: Request, url: string, token?: string) {
  const proof = await verifyProof(request, url, token);
  if (!(await single(env, 'dpop:' + proof.thumbprint, proof.jti, now() + 65)))
    fail('invalid_dpop_proof', token ? 401 : 400);
  return proof.thumbprint;
}

function owner(env: Env, token: string) {
  const [object, secret, extra] = token.split('.');
  if (!/^[a-f0-9]{64}$/.test(object ?? '') || !/^[A-Za-z0-9_-]{43}$/.test(secret ?? '') || extra !== undefined)
    fail('invalid_token', 401);
  return env.CLIENTS.get(env.CLIENTS.idFromString(object));
}

function output(result: RpcResult) {
  if (result.body.error) {
    const { error, ...extra } = result.body;
    fail(String(error), result.status, extra);
  }
  return json(result.body, result.status);
}

export async function token(request: Request, env: Env) {
  const endpoint = env.ORIGIN + '/oauth/token';
  const params = await formBody(request);
  const { clientId, keys } = await authenticateClient(env, params, endpoint);
  const jkt = await checkProof(env, request, endpoint);
  if (params.get('grant_type') !== JWT_GRANT) fail('unsupported_grant_type');
  const assertion = await verifyAssertion(params.get('assertion') ?? '', keys, clientId, endpoint);
  if (!(await single(env, 'assertion:' + clientId, assertion.jti, assertion.exp + 5))) fail('invalid_grant');
  const resource = params.get('resource');
  if (resource !== null && resource !== env.ORIGIN + '/poppy/conversations') fail('invalid_target');

  const stub = env.CLIENTS.get(env.CLIENTS.idFromName(clientId + '\n' + assertion.sub));
  const value = stub.id.toString() + '.' + randomSecret();
  const input: Input = {
    client: clientId,
    user: assertion.sub,
    session: params.get('session_id') ?? undefined,
    jkt,
    token: value,
    secret: await sha256(value),
    scope: scopes(params.get('scope'))
  };
  return output(await stub.dispatch('start', input));
}

export async function revoke(request: Request, env: Env) {
  const params = await formBody(request);
  const { clientId } = await authenticateClient(env, params, env.ORIGIN + '/oauth/revoke');
  const value = params.get('token') ?? '';
  try {
    await owner(env, value).dispatch('revoke', { client: clientId, jkt: '', secret: await sha256(value) });
  } catch {
    // RFC 7009: unknown or invalid tokens still succeed.
  }
  return json({});
}

function message(value: unknown): Message {
  if (!value || typeof value !== 'object') fail('invalid_request');
  const m = value as Message;
  if (
    typeof m.id !== 'string' ||
    !/^[A-Za-z0-9_-]{1,256}$/.test(m.id) ||
    !['agent', 'human'].includes(m.sender) ||
    (m.text !== undefined && typeof m.text !== 'string') ||
    [m.data, m.context].some((v) => v !== undefined && (!v || typeof v !== 'object' || Array.isArray(v)))
  )
    fail('invalid_request');
  return {
    id: m.id,
    sender: m.sender,
    ...(m.text !== undefined ? { text: m.text } : {}),
    ...(m.data ? { data: m.data } : {}),
    ...(m.context ? { context: m.context } : {})
  };
}

export async function conversations(request: Request, env: Env, url: URL) {
  if (url.searchParams.has('access_token')) fail('invalid_token', 401);
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('DPoP ')) fail('invalid_token', 401);
  const value = header.slice(5);
  const stub = owner(env, value);
  const jkt = await checkProof(env, request, env.ORIGIN + url.pathname, value);
  const match = url.pathname.match(
    /^\/poppy\/conversations(?:\/([A-Za-z0-9_-]{1,256})\/(messages|events|handoff|close))?$/
  );
  if (!match) fail('not_found', 404);
  // The token names its owning object, which holds the client binding and the token's hash.
  const input: Input = {
    client: '',
    jkt,
    secret: await sha256(value),
    conversation: match[1],
    cursor: url.searchParams.get('cursor') ?? request.headers.get('Last-Event-ID') ?? undefined,
    wait: url.searchParams.has('wait')
  };
  const [conversation, action] = [match[1], match[2]];
  if (!conversation) {
    if (request.method !== 'POST') fail('method_not_allowed', 405);
    const body = await bodyJson(request);
    if (body.parent_conversation_id !== undefined) fail('direct_conversations_not_supported');
    input.message = message(body.message);
    return output(await stub.dispatch('create', input));
  }
  if (action === 'events') {
    if (request.method !== 'GET') fail('method_not_allowed', 405);
    return output(await stub.dispatch('events', input));
  }
  if (request.method !== 'POST') fail('method_not_allowed', 405);
  const body = await bodyJson(request);
  if (action === 'messages') {
    input.message = message(body.message);
    return output(await stub.dispatch('message', input));
  }
  if (Object.keys(body).length) fail('invalid_request');
  return output(await stub.dispatch(action!, input));
}
