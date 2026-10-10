// Adapted from Cloudflare agents/examples/next/harnesses/pi (MIT, licenses/cloudflare-agents.txt).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentEvent } from '@earendil-works/pi-durable';
import { EMPTY_VIEW, reduceEvents } from './view';
import type { SessionView, ToolInfo } from './protocol';

type State = SessionView & {
  status: 'connecting' | 'open' | 'closed';
  catalog: readonly ToolInfo[];
  sessionId: string;
};
const INITIAL: State = { ...EMPTY_VIEW, status: 'connecting', catalog: [], sessionId: '' };

const MESSAGES: Record<string, string> = {
  daily_limit_reached:
    'The archive assistant has answered its quota of questions for today. Please try again tomorrow.',
  invalid_request: 'Questions can be up to 4,000 characters.'
};

async function post(path: string, body: unknown = {}) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(MESSAGES[data.error] ?? 'The request could not be completed.');
  return data;
}

/** Pi's event reducer over a polled snapshot, scoped by the visitor cookie. */
export function usePiSession(key: string) {
  const [state, setState] = useState<State>(INITIAL);
  const generation = useRef(0);
  const refresh = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    ++generation.current;
    let disposed = false;
    let loading = false;
    let last = '';
    let timer: ReturnType<typeof setTimeout>;
    setState(INITIAL);
    const read = async () => {
      if (disposed || loading) return;
      loading = true;
      try {
        const response = await fetch('/api/pi/view');
        if (!response.ok) throw new Error('Unable to load this conversation.');
        const text = await response.text();
        if (disposed) return;
        if (text !== last) {
          const data = JSON.parse(text) as { events: AgentEvent[]; tools: ToolInfo[]; session: string };
          last = text;
          setState((previous) => ({
            ...previous,
            ...reduceEvents(previous, data.events),
            status: 'open',
            catalog: data.tools,
            sessionId: data.session
          }));
        } else
          setState((previous) =>
            previous.status === 'open' ? previous : { ...previous, status: 'open', error: null }
          );
      } catch (error) {
        if (!disposed)
          setState((previous) => ({
            ...previous,
            status: 'closed',
            error: error instanceof Error ? error.message : 'Connection lost.'
          }));
      } finally {
        loading = false;
      }
    };
    refresh.current = read;
    const poll = async () => {
      await read();
      if (!disposed) timer = setTimeout(poll, document.hidden ? 10000 : 1000);
    };
    void poll();
    const onVisible = () => {
      if (!document.hidden) void read();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [key]);

  const command = useCallback(async (path: string, body: unknown = {}) => {
    const current = generation.current;
    try {
      const result = await post(path, body);
      if (generation.current === current) await refresh.current();
      return result;
    } catch (error) {
      if (generation.current === current)
        setState((previous) => ({
          ...previous,
          error: error instanceof Error ? error.message : 'The request failed.'
        }));
      return null;
    }
  }, []);
  const submit = useCallback(
    (text: string, whenBusy: 'followUp' | 'steer' = 'followUp') =>
      command('/api/agent/prompt', { prompt: text, operation_id: crypto.randomUUID(), when_busy: whenBusy }),
    [command]
  );
  const abort = useCallback(() => command('/api/pi/abort'), [command]);
  const reset = useCallback(() => command('/api/pi/new'), [command]);
  return { ...state, submit, abort, reset };
}
