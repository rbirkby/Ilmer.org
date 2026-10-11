import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AgentEvent, EntryRecord } from '@earendil-works/pi-durable';
import { projectEntries } from '../client/transcript.ts';
import { EMPTY_VIEW, reduceEvents, reduceView } from '../client/view.ts';

// Fixtures carry only the fields the projection reads.
const event = (value: object) => value as AgentEvent;
const entry = (value: object) => value as EntryRecord;

const user = (id: number, text: string) =>
  entry({ id, kind: 'pi.message', model: [{ role: 'user', content: text, timestamp: id }] });
const assistant = (id: number, content: object[], extra: object = {}) =>
  entry({
    id,
    kind: 'pi.message',
    model: [{ role: 'assistant', content, stopReason: 'stop', timestamp: id, ...extra }]
  });

const snapshot = (fields: object = {}) =>
  event({ type: 'snapshot', entries: [], tools: [], compactions: [], inbox: [], agent: {}, usage: {}, ...fields });

test('transcript projects user, assistant and tool entries, skipping bookkeeping', () => {
  const messages = projectEntries([
    entry({ id: 1, kind: 'pi.system', model: [{ role: 'system', content: 'prompt' }] }),
    user(2, 'When was the spire built?'),
    assistant(3, [
      { type: 'thinking', thinking: 'search' },
      { type: 'toolCall', id: 'c1', name: 'search_site', arguments: { query: 'spire' } }
    ]),
    entry({
      id: 4,
      kind: 'pi.message',
      model: [
        {
          role: 'toolResult',
          toolCallId: 'c1',
          toolName: 'search_site',
          content: [{ type: 'text', text: '{}' }],
          isError: false,
          timestamp: 4
        }
      ]
    }),
    assistant(5, [{ type: 'text', text: '1909' }], { stopReason: 'error', errorMessage: 'overloaded' }),
    entry({ id: 6, kind: 'pi.bookkeeping' }),
    entry({ id: 7, kind: 'pi.reset' })
  ]);
  assert.deepEqual(
    messages.map((m) => [m.id, m.role]),
    [
      ['2', 'user'],
      ['3', 'assistant'],
      ['4', 'tool'],
      ['5', 'assistant'],
      ['7', 'notice']
    ]
  );
  assert.deepEqual(messages[0].parts, [{ type: 'text', text: 'When was the spire built?' }]);
  assert.deepEqual(messages[1].parts, [
    { type: 'thinking', text: 'search' },
    { type: 'tool-call', id: 'c1', name: 'search_site', arguments: { query: 'spire' } }
  ]);
  assert.equal(messages[2].parts[0].type, 'tool-result');
  assert.equal(messages[3].error, 'overloaded');
  assert.equal('error' in messages[1], false);
});

test('a snapshot replaces the view', () => {
  const stale = { ...EMPTY_VIEW, error: 'old', queued: 5 };
  const view = reduceView(
    stale,
    snapshot({
      entries: [user(1, 'Hello')],
      run: { inputs: ['s1'] },
      generation: {
        attempt: 1,
        message: { role: 'assistant', content: [{ type: 'text', text: 'Hi' }], timestamp: 2 },
        retry: { at: 10, error: 'busy' }
      },
      tools: [
        { callId: 'c1', name: 'search_site', status: 'running', output: 'partial' },
        { callId: 'c0', name: 'read_page', status: 'done' }
      ],
      inbox: [{ id: 's2', mode: 'followUp' }],
      agent: { model: { provider: 'workers-ai', modelId: 'm' } }
    })
  );
  assert.equal(view.messages.length, 1);
  assert.equal(view.live?.id, 'live');
  assert.deepEqual(view.live?.parts, [{ type: 'text', text: 'Hi' }]);
  assert.equal(view.running, true);
  assert.deepEqual(view.tools, [{ callId: 'c1', name: 'search_site', output: 'partial' }]);
  assert.equal(view.queued, 1);
  assert.deepEqual(view.retry, { at: 10, error: 'busy' });
  assert.deepEqual(view.model, { provider: 'workers-ai', modelId: 'm' });
  assert.equal(view.error, null);

  const idle = reduceView(view, snapshot());
  assert.equal(idle.running, false);
  assert.equal(idle.live, null);
  assert.equal(idle.model, null);
});

test('a streamed answer builds the live message, then lands in the transcript', () => {
  const view = reduceEvents(EMPTY_VIEW, [
    event({ type: 'run_start', inputs: ['s1'] }),
    event({ type: 'message_end', entry: user(1, 'Bells?') }),
    event({ type: 'message_start', message: { role: 'assistant', content: [], timestamp: 2 } }),
    event({
      type: 'message_update',
      changes: [
        { type: 'thinking_start', contentIndex: 0, block: { type: 'thinking', thinking: '' } },
        { type: 'thinking_delta', contentIndex: 0, delta: 'Look' },
        { type: 'thinking_delta', contentIndex: 0, delta: ' up' },
        { type: 'text_start', contentIndex: 1, block: { type: 'text', text: '' } },
        { type: 'text_delta', contentIndex: 1, delta: 'Three ' },
        { type: 'text_delta', contentIndex: 1, delta: 'bells' },
        { type: 'toolcall_delta', contentIndex: 2, path: [], delta: '{"q' }
      ]
    })
  ]);
  assert.equal(view.running, true);
  assert.deepEqual(view.live?.parts, [
    { type: 'thinking', text: 'Look up' },
    { type: 'text', text: 'Three bells' }
  ]);

  const done = reduceEvents(view, [
    event({ type: 'message_end', entry: assistant(2, [{ type: 'text', text: 'Three bells.' }]) }),
    event({ type: 'run_end', inputs: ['s1'] })
  ]);
  assert.equal(done.live, null);
  assert.equal(done.running, false);
  assert.deepEqual(
    done.messages.map((m) => m.role),
    ['user', 'assistant']
  );
});

test('a whole-message change replaces the live message, and stray updates are ignored', () => {
  const ignored = reduceView(
    EMPTY_VIEW,
    event({ type: 'message_update', changes: [{ type: 'text_delta', contentIndex: 0, delta: 'x' }] })
  );
  assert.equal(ignored.live, null);
  const replaced = reduceView(
    EMPTY_VIEW,
    event({
      type: 'message_update',
      changes: [
        { type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'Whole' }], timestamp: 1 } }
      ]
    })
  );
  assert.deepEqual(replaced.live?.parts, [{ type: 'text', text: 'Whole' }]);
  // A user message_start does not become the live message.
  const userStart = reduceView(
    replaced,
    event({ type: 'message_start', message: { role: 'user', content: 'hi', timestamp: 2 } })
  );
  assert.equal(userStart.live, replaced.live);
});

test('entries are appended once, and a reset clears the transcript', () => {
  const view = reduceEvents(EMPTY_VIEW, [
    event({ type: 'entry_appended', entry: user(1, 'One') }),
    event({ type: 'entry_appended', entry: user(1, 'One') }),
    event({ type: 'entry_appended', entry: entry({ id: 2, kind: 'pi.system' }) }),
    event({ type: 'entry_appended', entry: user(3, 'Two') })
  ]);
  assert.deepEqual(
    view.messages.map((m) => m.id),
    ['1', '3']
  );
  const reset = reduceView(view, event({ type: 'entry_appended', entry: entry({ id: 4, kind: 'pi.reset' }) }));
  assert.deepEqual(
    reset.messages.map((m) => [m.id, m.role]),
    [['4', 'notice']]
  );
});

test('running tools track streamed output until they end', () => {
  const update = (output: object | undefined) =>
    event({ type: 'tool_execution_update', toolCallId: 'c1', toolName: 'read_page', output });
  let view = reduceEvents(EMPTY_VIEW, [
    event({ type: 'tool_execution_start', toolCallId: 'c1', toolName: 'read_page', args: {} }),
    event({ type: 'tool_execution_start', toolCallId: 'c2', toolName: 'search_site', args: {} }),
    update({ append: 'abcdef' }),
    update({ trimStart: 2, append: 'g' }),
    update(undefined)
  ]);
  assert.deepEqual(view.tools, [
    { callId: 'c1', name: 'read_page', output: 'cdefg' },
    { callId: 'c2', name: 'search_site', output: '' }
  ]);
  view = reduceView(view, update({ set: 'fresh' }));
  assert.equal(view.tools[0].output, 'fresh');
  // A restarted call replaces its slot rather than duplicating it.
  view = reduceView(view, event({ type: 'tool_execution_start', toolCallId: 'c1', toolName: 'read_page', args: {} }));
  assert.deepEqual(
    view.tools.map((t) => [t.callId, t.output]),
    [
      ['c2', ''],
      ['c1', '']
    ]
  );
  view = reduceView(view, event({ type: 'tool_execution_end', toolCallId: 'c2', toolName: 'search_site' }));
  assert.deepEqual(
    view.tools.map((t) => t.callId),
    ['c1']
  );
  assert.deepEqual(reduceView(view, event({ type: 'run_end', inputs: [] })).tools, []);
});

test('inbox, retries, model changes and failures update the status fields', () => {
  let view = reduceEvents(EMPTY_VIEW, [
    event({ type: 'inbox_update', items: [{ id: 'a' }, { id: 'b' }] }),
    event({ type: 'auto_retry_start', attempt: 1, at: 99, errorMessage: 'rate limited' }),
    event({ type: 'agent_changed', agent: { model: { provider: 'p', modelId: 'm2' } } }),
    event({ type: 'turn_start' })
  ]);
  assert.equal(view.queued, 2);
  assert.deepEqual(view.retry, { at: 99, error: 'rate limited' });
  assert.deepEqual(view.model, { provider: 'p', modelId: 'm2' });
  view = reduceView(view, event({ type: 'auto_retry_end', attempt: 1 }));
  assert.equal(view.retry, null);

  view = reduceView(view, event({ type: 'task_failed', message: 'boom' }));
  assert.equal(view.error, 'boom');
  // A new run clears the previous error.
  assert.equal(reduceView(view, event({ type: 'run_start', inputs: [] })).error, null);
});

test('unanswered submissions show an error unless the visitor stopped them', () => {
  const submission = (status: string, reason?: string) =>
    reduceView(EMPTY_VIEW, event({ type: 'submission', record: { status, reason } })).error;
  assert.equal(submission('unanswered', 'daily_limit'), 'Not answered: daily_limit');
  assert.equal(submission('unanswered', 'aborted'), null);
  assert.equal(submission('unanswered', 'withdrawn'), null);
  assert.equal(submission('done'), null);
});
