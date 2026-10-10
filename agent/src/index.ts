// poppy.ilmer.org: the Ilmer Past history agent. Serves a chat UI for people and a Poppy endpoint for personal agents.
import { HistoryAgent } from './agent';
import { authorizationServer, conversations, discovery, revoke, token } from './poppy';
import { bodyJson, cookie, errorResponse, fail, json, randomSecret, securityHeaders } from './protocol';
import { Guard, PoppyClient } from './state';

export { Guard, HistoryAgent, PoppyClient };

const VISITOR = 'ilmer_visitor';

async function chat(request: Request, env: Env, url: URL) {
  let visitor = cookie(request, VISITOR);
  const fresh = !visitor || !/^[A-Za-z0-9_-]{43}$/.test(visitor);
  if (fresh) visitor = randomSecret();
  const agent = env.AGENTS.getByName('web:' + visitor);

  let response: Response;
  if (url.pathname === '/' && request.method === 'GET') {
    const page = await env.ASSETS.fetch(new URL('/index.html', url));
    response = new Response(page.body, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  } else if (url.pathname === '/api/pi/view' && request.method === 'GET') {
    response = await agent.view();
  } else if (request.method === 'POST' && url.pathname.startsWith('/api/')) {
    // Cookie-authenticated writes must come from this page.
    if (request.headers.get('Origin') !== env.ORIGIN) fail('invalid_origin', 403);
    const body = await bodyJson(request);
    if (url.pathname === '/api/agent/prompt') {
      const whenBusy = body.when_busy === 'steer' ? 'steer' : 'followUp';
      response = json(await agent.submit(String(body.prompt ?? ''), String(body.operation_id ?? ''), whenBusy), 202);
    } else if (url.pathname === '/api/pi/abort') response = json({ aborted: await agent.abort() });
    else if (url.pathname === '/api/pi/new') response = json({ session: await agent.startNewSession() });
    else fail('not_found', 404);
  } else fail('not_found', 404);

  if (fresh) {
    const secure = env.LOCAL_DEV === 'true' ? '' : '; Secure';
    response = new Response(response.body, response);
    response.headers.append(
      'Set-Cookie',
      `${VISITOR}=${visitor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`
    );
  }
  return response;
}

async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/.well-known/poppy.json' && request.method === 'GET') return discovery(env);
  if (path === '/.well-known/oauth-authorization-server' && request.method === 'GET') return authorizationServer(env);
  if (path === '/oauth/token' && request.method === 'POST') return token(request, env);
  if (path === '/oauth/revoke' && request.method === 'POST') return revoke(request, env);
  if (path === '/poppy/conversations' || path.startsWith('/poppy/conversations/'))
    return conversations(request, env, url);
  if (path === '/robots.txt')
    return new Response('User-agent: *\nDisallow: /api/\n', { headers: { 'Content-Type': 'text/plain' } });
  if (path === '/corpus.json') fail('not_found', 404);
  return chat(request, env, url);
}

export default {
  async fetch(request, env) {
    try {
      return securityHeaders(await handle(request, env));
    } catch (error) {
      return securityHeaders(errorResponse(error));
    }
  }
} satisfies ExportedHandler<Env>;
