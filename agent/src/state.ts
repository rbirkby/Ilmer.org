// Durable state for the Poppy receiver. Guard objects record single-use values and the daily prompt budget;
// one PoppyClient object holds each (personal agent, user) pair's sessions, tokens and conversations.
import { DurableObject } from 'cloudflare:workers';
import { fail, id, now, ProtocolError, sha256, type Event, type Message, type TokenResponse } from './protocol';

export class Guard extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS seen (id TEXT PRIMARY KEY, expires INTEGER NOT NULL)');
  }
  /** True the first time `key` is presented before it expires. */
  accept(key: string, expires: number): boolean {
    return this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec('DELETE FROM seen WHERE expires < ?', now());
      return (
        this.ctx.storage.sql
          .exec('INSERT OR IGNORE INTO seen (id, expires) VALUES (?, ?) RETURNING id', key, expires)
          .toArray().length === 1
      );
    });
  }
  /** Takes one unit from this object's budget (one object per day); false once `limit` is used. */
  spend(limit: number): boolean {
    const used = this.ctx.storage.kv.get<number>('used') ?? 0;
    if (used >= limit) return false;
    this.ctx.storage.kv.put('used', used + 1);
    return true;
  }
}

type Session = { id: string; expires: number };
type Access = { session: string; expires: number; jkt: string; scope: string[] };
type Pending = { operation: string; message: string };
type Conversation = {
  id: string;
  status: 'working' | 'idle' | 'closed';
  responder: 'agent';
  events: Event[];
  pending: Pending[];
  context: Record<string, unknown>;
};
type State = {
  client: string;
  user: string;
  sessions: Record<string, Session>;
  access: Record<string, Access>;
  conversations: Record<string, Conversation>;
  messages: Record<string, { content: string; conversation: string; created: boolean }>;
};
export type Input = {
  client: string;
  user?: string;
  session?: string;
  jkt: string;
  token?: string;
  secret: string;
  scope?: string[];
  conversation?: string;
  message?: Message;
  cursor?: string;
  wait?: boolean;
};
export type RpcResult = { status: number; body: Record<string, unknown> };

const MAX_CONVERSATIONS = 50;
const MAX_EVENTS = 400;
const WAIT_MS = 25_000;

export class PoppyClient extends DurableObject<Env> {
  async dispatch(action: string, input: Input): Promise<RpcResult> {
    try {
      return await this.perform(action, input);
    } catch (error) {
      if (error instanceof ProtocolError) return { status: error.status, body: { error: error.code, ...error.extra } };
      throw error;
    }
  }

  // Each load/mutate/save runs without an intervening await, so the object's input gate keeps it atomic.
  private load(input: Input, create = false): State {
    let state = this.ctx.storage.kv.get<State>('state');
    if (!state) {
      if (!create || !input.user) fail('invalid_token', 401);
      state = { client: input.client, user: input.user, sessions: {}, access: {}, conversations: {}, messages: {} };
    }
    if ((input.client && state.client !== input.client) || (input.user && state.user !== input.user))
      fail('invalid_session');
    for (const [key, value] of Object.entries(state.access)) if (value.expires < now()) delete state.access[key];
    for (const [key, value] of Object.entries(state.sessions)) if (value.expires < now()) delete state.sessions[key];
    return state;
  }
  private save(state: State) {
    this.ctx.storage.kv.put('state', state);
  }

  private authenticate(state: State, input: Input) {
    const access = state.access[input.secret];
    if (!access || access.expires < now() || !state.sessions[access.session]) fail('invalid_token', 401);
    if (access.jkt !== input.jkt) fail('invalid_dpop_proof', 401);
    return access;
  }

  private event(c: Conversation, fields: Record<string, unknown>) {
    c.events.push({ id: id('evt_'), created_at: new Date().toISOString(), ...fields } as Event);
    if (c.events.length > MAX_EVENTS) c.events.splice(0, c.events.length - MAX_EVENTS);
  }
  private setStatus(c: Conversation, status: Conversation['status']) {
    if (c.status === status) return;
    c.status = status;
    this.event(c, { type: 'state', status, responder: c.responder });
  }
  private read(c: Conversation, cursor?: string) {
    const index = cursor ? c.events.findIndex((e) => e.id === cursor) : -1;
    if (cursor && index < 0) fail('invalid_cursor');
    const events = c.events.slice(index + 1, index + 101);
    return {
      conversation_id: c.id,
      events,
      cursor: events.at(-1)?.id ?? cursor ?? '',
      has_more: index + 1 + events.length < c.events.length,
      status: c.status,
      responder: c.responder
    };
  }
  private conversation(state: State, value?: string) {
    const c = state.conversations[value ?? ''];
    if (!c) fail('conversation_not_found', 404);
    return c;
  }
  private agent(conversation: string) {
    return this.env.AGENTS.getByName('poppy:' + conversation);
  }

  private async perform(action: string, input: Input): Promise<RpcResult> {
    if (action === 'start') {
      const state = this.load(input, true);
      let session: Session;
      if (input.session) {
        session = state.sessions[input.session] ?? fail('invalid_session');
        session.expires = Math.max(session.expires, now() + 86400);
      } else {
        session = { id: id('ses_'), expires: now() + 86400 };
        state.sessions[session.id] = session;
      }
      const scope = input.scope ?? [];
      state.access[input.secret] = { session: session.id, expires: now() + 3600, jkt: input.jkt, scope };
      this.save(state);
      const body: TokenResponse = {
        access_token: input.token!,
        token_type: 'DPoP',
        expires_in: 3600,
        session_id: session.id,
        signed_in: false,
        scope: scope.join(' ')
      };
      return { status: 200, body };
    }

    if (action === 'revoke') {
      const state = this.load(input);
      delete state.access[input.secret];
      this.save(state);
      return { status: 200, body: {} };
    }

    const access = this.authenticate(this.load(input), input);
    const needs = (scope: string) => {
      if (!access.scope.includes(scope)) fail('insufficient_scope', 403, { scope });
    };

    if (action === 'create' || action === 'message') {
      needs('poppy:write');
      const m = input.message!;
      const content = JSON.stringify({ message: m, conversation: input.conversation ?? null });
      const earlier = this.load(input).messages[m.id];
      if (earlier) {
        // Message ids make retries safe: the same message returns the same conversation.
        if (earlier.content !== content) fail('message_id_conflict', 409);
        return this.respond(input, earlier.conversation, earlier.created ? 201 : 202);
      }
      if (m.sender !== 'agent' && m.sender !== 'human') fail('invalid_request');
      const text = [m.text, m.data ? JSON.stringify(m.data) : ''].filter(Boolean).join('\n\n').trim();
      if (!text || text.length > 4000) fail('invalid_request');

      let conversationId = input.conversation;
      if (action === 'message') {
        const c = this.conversation(this.load(input), conversationId);
        if (c.status === 'closed') fail('conversation_closed', 409);
        if (input.cursor && !c.events.some((e) => e.id === input.cursor)) fail('invalid_cursor');
      } else {
        const state = this.load(input);
        if (Object.keys(state.conversations).length >= MAX_CONVERSATIONS) {
          // Forget the oldest settled conversation (object keys keep insertion order).
          const oldest = Object.values(state.conversations).find((c) => !c.pending.length);
          if (!oldest) fail('too_many_conversations', 429);
          delete state.conversations[oldest.id];
          for (const [key, value] of Object.entries(state.messages))
            if (value.conversation === oldest.id) delete state.messages[key];
          this.save(state);
        }
        conversationId = id('cnv_');
      }
      const operation = 'm_' + (await sha256(conversationId + ':' + m.id)).slice(0, 43);
      const prompt = m.sender === 'agent' ? `[Message from the visitor's personal agent]\n${text}` : text;
      await this.agent(conversationId!).submit(prompt, operation);

      const state = this.load(input);
      const replay = state.messages[m.id];
      if (replay) return this.respond(input, replay.conversation, replay.created ? 201 : 202);
      let c = state.conversations[conversationId!];
      if (!c) {
        c = { id: conversationId!, status: 'idle', responder: 'agent', events: [], pending: [], context: {} };
        state.conversations[c.id] = c;
      }
      c.context = { ...c.context, ...m.context };
      this.event(c, { type: 'message', message: { ...m, role: 'user' } });
      this.setStatus(c, 'working');
      c.pending.push({ operation, message: m.id });
      state.messages[m.id] = { content, conversation: c.id, created: action === 'create' };
      this.save(state);
      return this.respond(input, c.id, action === 'create' ? 201 : 202);
    }

    const c = this.conversation(this.load(input), input.conversation);
    if (action === 'events') {
      needs('poppy:read');
      await this.settle(input, c.id, 0);
      return { status: 200, body: this.read(this.conversation(this.load(input), c.id), input.cursor) };
    }
    needs('poppy:write');
    if (action === 'handoff') {
      const state = this.load(input);
      const current = this.conversation(state, c.id);
      if (current.status === 'closed') fail('conversation_closed', 409);
      // There is no staffed desk behind Ilmer Past; say so instead of inventing a human.
      this.event(current, {
        type: 'message',
        message: {
          id: id('msg_'),
          role: 'company',
          sender: 'agent',
          text: 'Ilmer Past is a volunteer-run archive with no live staff. You can email the site through https://www.ilmer.org/about/, and I can keep helping here.'
        }
      });
      this.save(state);
      return {
        status: 202,
        body: { conversation_id: current.id, status: current.status, responder: current.responder }
      };
    }
    if (action === 'close') {
      const state = this.load(input);
      const current = this.conversation(state, c.id);
      if (current.pending.length) await this.agent(current.id).abort();
      current.pending = [];
      this.setStatus(current, 'closed');
      this.save(state);
      return {
        status: 200,
        body: { conversation_id: current.id, status: current.status, responder: current.responder }
      };
    }
    fail('not_found', 404);
  }

  private async respond(input: Input, conversation: string, status: number): Promise<RpcResult> {
    if (!input.wait) {
      const c = this.conversation(this.load(input), conversation);
      return { status, body: { conversation_id: c.id, status: c.status, responder: c.responder } };
    }
    await this.settle(input, conversation, WAIT_MS);
    return { status, body: this.read(this.conversation(this.load(input), conversation), input.cursor) };
  }

  /** Moves finished agent answers into the conversation's events, waiting up to `timeoutMs` for the oldest. */
  private async settle(input: Input, conversation: string, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const next = this.conversation(this.load(input), conversation).pending[0];
      if (!next) return;
      const result = await this.agent(conversation).result(next.operation, Math.max(0, deadline - Date.now()));
      if (result.status === 'pending') return;
      const state = this.load(input);
      const c = this.conversation(state, conversation);
      if (c.pending[0]?.operation !== next.operation) continue;
      c.pending.shift();
      this.event(c, {
        type: 'message',
        message: {
          id: id('msg_'),
          role: 'company',
          sender: 'agent',
          in_reply_to: next.message,
          text:
            result.status === 'done' && result.text
              ? result.text
              : 'Sorry, I could not answer that just now. Please try again in a moment.'
        }
      });
      if (!c.pending.length && c.status === 'working') this.setStatus(c, 'idle');
      this.save(state);
    }
  }
}
