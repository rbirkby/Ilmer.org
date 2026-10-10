// Helpers for the Poppy receiver: JWT client assertions (RFC 7523), DPoP proofs (RFC 9449) and HTTP plumbing.
import { calculateJwkThumbprint, decodeProtectedHeader, importJWK, jwtVerify, type JWK, type JWTPayload } from 'jose';

export const JWT_GRANT = 'urn:ietf:params:oauth:grant-type:jwt-bearer';
export const CLIENT_ASSERTION = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
export const SCOPES = ['poppy:read', 'poppy:write'];

export type Message = {
  id: string;
  sender: 'agent' | 'human';
  text?: string;
  data?: Record<string, unknown>;
  context?: Record<string, unknown>;
};
export type Event = { id: string; type: string; created_at: string; [key: string]: unknown };
export type TokenResponse = {
  access_token: string;
  token_type: 'DPoP';
  expires_in: number;
  scope: string;
  session_id: string;
  signed_in: false;
};

export const now = () => Math.floor(Date.now() / 1000);
export const id = (prefix = '') => prefix + crypto.randomUUID().replaceAll('-', '');

export function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}
export function randomSecret() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}
export async function sha256(value: string) {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}

export class ProtocolError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public extra: Record<string, unknown> = {}
  ) {
    super(code);
  }
}
export function fail(code: string, status = 400, extra: Record<string, unknown> = {}): never {
  throw new ProtocolError(code, status, extra);
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
export function errorResponse(error: unknown) {
  if (!(error instanceof ProtocolError)) console.error(error);
  const e = error instanceof ProtocolError ? error : new ProtocolError('server_error', 500);
  const headers: Record<string, string> = {};
  if (['invalid_token', 'invalid_dpop_proof'].includes(e.code)) headers['WWW-Authenticate'] = `DPoP error="${e.code}"`;
  return json({ error: e.code, ...e.extra }, e.status, headers);
}
export function securityHeaders(response: Response) {
  // Asset and RPC responses may carry immutable headers.
  response = new Response(response.body, response);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}

/** HTTPS only, except http://localhost while developing. No credentials or fragments. */
export function permittedUrl(raw: string, local: boolean) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail('invalid_client', 401);
  }
  const loopback = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.username || url.password || url.hash) fail('invalid_client', 401);
  if (url.protocol === 'https:' && !loopback && !/^\[|^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) return url;
  if (local && url.protocol === 'http:' && loopback) return url;
  fail('invalid_client', 401);
}

export async function readText(source: Response | Request, limit = 65536) {
  if (!source.body) return '';
  const reader = source.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        fail('request_too_large', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}
export async function bodyJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = JSON.parse(await readText(request));
  } catch (e) {
    if (e instanceof ProtocolError) throw e;
    fail('invalid_request');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('invalid_request');
  return body as Record<string, unknown>;
}
export async function formBody(request: Request) {
  const params = new URLSearchParams(await readText(request));
  const seen = new Set<string>();
  for (const [name] of params) {
    if (seen.has(name)) fail('invalid_request');
    seen.add(name);
  }
  return params;
}
export function scopes(raw: string | null) {
  if (raw === null) return [...SCOPES];
  const list = [...new Set(raw.split(' ').filter(Boolean))];
  if (!list.length || list.some((s) => !SCOPES.includes(s))) fail('invalid_scope');
  return list;
}
export function cookie(request: Request, name: string) {
  return request.headers
    .get('Cookie')
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(name + '='))
    ?.slice(name.length + 1);
}

/** An ES256 assertion signed by one of the client's published keys, valid for at most 60 seconds. */
export async function verifyAssertion(
  jwt: string,
  keys: JWK[],
  issuer: string,
  audience: string,
  subject?: string
): Promise<JWTPayload & { jti: string; exp: number; sub: string }> {
  try {
    const header = decodeProtectedHeader(jwt);
    if (header.alg !== 'ES256' || header.typ !== 'JWT') fail('invalid_grant');
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk || jwk.d) fail('invalid_grant');
    const { payload } = await jwtVerify(jwt, await importJWK(jwk, 'ES256'), {
      algorithms: ['ES256'],
      issuer,
      audience,
      clockTolerance: 5,
      requiredClaims: ['iat', 'exp', 'jti', 'sub']
    });
    const t = now();
    if (
      payload.aud !== audience ||
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      payload.sub.length > 256 ||
      typeof payload.jti !== 'string' ||
      payload.exp! - payload.iat! > 60 ||
      payload.iat! > t + 5 ||
      payload.iat! < t - 65 ||
      (subject && payload.sub !== subject)
    )
      fail('invalid_grant');
    return payload as JWTPayload & { jti: string; exp: number; sub: string };
  } catch {
    fail('invalid_grant');
  }
}

function target(url: string) {
  const u = new URL(url);
  u.search = '';
  u.hash = '';
  return u.href;
}

/** Verifies a DPoP proof for this request; returns the key thumbprint and the proof's jti for replay checks. */
export async function verifyProof(request: Request, url: string, token?: string) {
  const status = token ? 401 : 400;
  try {
    const jwt = request.headers.get('DPoP');
    if (!jwt) fail('invalid_dpop_proof', status);
    const header = decodeProtectedHeader(jwt);
    const jwk = header.jwk;
    if (
      header.typ !== 'dpop+jwt' ||
      header.alg !== 'ES256' ||
      !jwk ||
      'd' in jwk ||
      jwk.kty !== 'EC' ||
      jwk.crv !== 'P-256'
    )
      fail('invalid_dpop_proof', status);
    const { payload } = await jwtVerify(jwt, await importJWK(jwk, 'ES256'), {
      algorithms: ['ES256'],
      requiredClaims: ['jti', 'iat']
    });
    if (
      payload.htm !== request.method ||
      payload.htu !== target(url) ||
      typeof payload.iat !== 'number' ||
      Math.abs(now() - payload.iat) > 60 ||
      typeof payload.jti !== 'string' ||
      !payload.jti ||
      (token ? payload.ath !== (await sha256(token)) : payload.ath !== undefined)
    )
      fail('invalid_dpop_proof', status);
    return { thumbprint: await calculateJwkThumbprint(jwk), jti: payload.jti };
  } catch {
    fail('invalid_dpop_proof', status);
  }
}
