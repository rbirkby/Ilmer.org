// Adapted from Cloudflare agents/examples/next/harnesses/pi (MIT, licenses/cloudflare-agents.txt).
import { Badge, Button, InputArea, Surface } from '@cloudflare/kumo';
import {
  ArrowSquareOutIcon,
  BooksIcon,
  CheckCircleIcon,
  FileTextIcon,
  GearIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  PaperPlaneRightIcon,
  PlusIcon,
  StopIcon,
  SunIcon,
  XCircleIcon
} from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Streamdown } from 'streamdown';
import type { TranscriptMessage, TranscriptPart } from './protocol';
import { usePiSession } from './use-pi-session';
import './styles.css';

const SITE = 'https://www.ilmer.org';

const SUGGESTIONS = [
  { label: "St Peter's Church", value: "What do we know about the history of St Peter's Church, Ilmer?" },
  { label: 'Domesday', value: 'What does the Domesday Book record about Ilmer?' },
  { label: 'Family history', value: 'Which families appear most often in the Ilmer parish registers?' },
  { label: 'War memorial', value: 'Who from Ilmer died in the World Wars?' }
];

function ModeToggle() {
  const [mode, setMode] = useState(() => document.documentElement.dataset.mode ?? 'light');
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    document.documentElement.style.colorScheme = mode;
    try {
      localStorage.setItem('theme', mode);
    } catch {
      // Storage may be unavailable; the toggle still works for this page view.
    }
  }, [mode]);
  return (
    <Button
      variant="ghost"
      shape="square"
      aria-label={mode === 'light' ? 'Use dark theme' : 'Use light theme'}
      onClick={() => setMode((value) => (value === 'light' ? 'dark' : 'light'))}
      icon={mode === 'light' ? <MoonIcon size={16} /> : <SunIcon size={16} />}
    />
  );
}

function argument(value: unknown, key: string) {
  return value && typeof value === 'object' && key in value ? String((value as Record<string, unknown>)[key]) : '';
}

/** Archive lookups read as what they did, e.g. "Searched the archive for “Lacey”". */
function describeCall(name: string, args: unknown) {
  if (name === 'search_site')
    return { icon: <MagnifyingGlassIcon size={14} />, text: `Searched the archive for “${argument(args, 'query')}”` };
  if (name === 'read_page')
    return { icon: <FileTextIcon size={14} />, text: `Read ${argument(args, 'url').replace(SITE, '')}` };
  return { icon: <GearIcon size={14} />, text: name };
}

function ToolCall({ part, running }: { part: Extract<TranscriptPart, { type: 'tool-call' }>; running: boolean }) {
  const { icon, text } = describeCall(part.name, part.arguments);
  return (
    <div className="flex items-center gap-2 text-xs text-kumo-subtle">
      {running ? <GearIcon size={14} className="animate-spin" /> : icon}
      <span className="min-w-0 truncate">{text}</span>
    </div>
  );
}

function ToolResult({ part }: { part: Extract<TranscriptPart, { type: 'tool-result' }> }) {
  if (!part.error) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-kumo-danger">
      <XCircleIcon size={14} /> {part.name} failed
    </div>
  );
}

function AssistantPart({ part, running }: { part: TranscriptPart; running: boolean }) {
  switch (part.type) {
    case 'text':
      return (
        <Streamdown className="sd-theme text-[15px] leading-7" controls={false}>
          {part.text}
        </Streamdown>
      );
    case 'thinking':
      return null;
    case 'tool-call':
      return <ToolCall part={part} running={running} />;
    case 'tool-result':
      return <ToolResult part={part} />;
    case 'image':
      return <img src={`data:${part.mimeType};base64,${part.data}`} alt="" className="max-w-full rounded-lg" />;
  }
}

function Avatar() {
  return (
    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-kumo-brand text-white">
      <BooksIcon size={17} weight="bold" />
    </div>
  );
}

function Message({
  message,
  streaming = false,
  runningTools
}: {
  message: TranscriptMessage;
  streaming?: boolean;
  runningTools: readonly string[];
}) {
  if (message.role === 'user') {
    const text = message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('');
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-kumo-contrast px-4 py-2.5 text-sm leading-relaxed text-kumo-inverse">
          {text}
        </div>
      </div>
    );
  }
  if (message.role === 'tool') {
    return (
      <div className="ml-11 space-y-1">
        {message.parts.map((part, index) =>
          part.type === 'tool-result' ? <ToolResult key={`${message.id}-${index}`} part={part} /> : null
        )}
      </div>
    );
  }
  if (message.role === 'notice') {
    return message.parts.length === 0 ? null : (
      <p className="text-center text-xs text-kumo-inactive">
        {message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('')}
      </p>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <Avatar />
      <div className="min-w-0 flex-1 space-y-2">
        {message.parts.map((part, index) => (
          <AssistantPart
            key={`${message.id}-${index}`}
            part={part}
            running={streaming && part.type === 'tool-call' && runningTools.includes(part.name)}
          />
        ))}
        {streaming ? <span className="streaming-cursor" /> : null}
        {message.error ? (
          <div role="alert" className="rounded-xl bg-kumo-danger/10 px-4 py-3 text-sm text-kumo-danger">
            {message.error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Welcome({ disabled, onPick }: { disabled: boolean; onPick: (value: string) => void }) {
  return (
    <div className="py-8 sm:py-14">
      <p className="text-xs uppercase tracking-[0.18em] text-kumo-subtle">Ilmer Past · Archive assistant</p>
      <h2 className="ilmer-title mt-2 text-4xl leading-tight text-kumo-default sm:text-5xl">
        Ask about the history of Ilmer
      </h2>
      <p className="mt-4 max-w-xl text-sm leading-7 text-kumo-subtle">
        Questions are answered from the pages of{' '}
        <a className="underline underline-offset-2" href={SITE}>
          ilmer.org
        </a>
        : parish registers, censuses, wills, court rolls, the church and the parish council. Answers link to their
        sources. The assistant can make mistakes, so check the pages it cites.
      </p>
      <div className="mt-7 flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion): ReactNode => (
          <Button
            key={suggestion.label}
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => onPick(suggestion.value)}
          >
            {suggestion.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [prompt, setPrompt] = useState(
    () => new URLSearchParams(window.location.search).get('q')?.slice(0, 4000) ?? ''
  );
  const endRef = useRef<HTMLDivElement>(null);
  const {
    status,
    messages,
    live,
    running,
    tools: activeTools,
    queued,
    retry,
    error,
    submit: submitPrompt,
    abort,
    reset
  } = usePiSession(key);
  const runningTools = activeTools.map((tool) => tool.name);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, live, running]);

  const connected = status === 'open';
  const submit = (whenBusy: 'followUp' | 'steer' = 'followUp') => {
    const text = prompt.trim();
    if (!text || !connected) return;
    setPrompt('');
    submitPrompt(text, whenBusy);
  };
  const newConversation = async () => {
    if (await reset()) setKey(crypto.randomUUID());
  };
  const empty = messages.length === 0 && !live && !running;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-kumo-elevated text-kumo-default">
      <header className="shrink-0 border-b border-kumo-line bg-kumo-base">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-5">
          <a href={SITE} className="flex min-w-0 items-center gap-3 no-underline">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-kumo-brand text-white">
              <BooksIcon size={20} weight="bold" />
            </div>
            <div className="min-w-0">
              <h1 className="ilmer-title truncate text-xl">Ilmer Past</h1>
              <p className="truncate text-[11px] text-kumo-subtle">Ask the archive</p>
            </div>
          </a>
          <div className="flex shrink-0 items-center gap-1.5">
            {!connected ? (
              <Badge variant="secondary">{status === 'connecting' ? 'Connecting' : 'Reconnecting'}</Badge>
            ) : null}
            <Button
              variant="ghost"
              shape="square"
              aria-label="New conversation"
              onClick={newConversation}
              icon={<PlusIcon size={16} />}
            />
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-5 px-5 py-6">
          {empty ? <Welcome disabled={!connected} onPick={setPrompt} /> : null}

          {messages.map((message) => (
            <Message key={message.id} message={message} runningTools={runningTools} />
          ))}
          {live ? <Message message={live} streaming runningTools={runningTools} /> : null}

          {running && !live ? (
            <div className="flex items-start gap-3">
              <Avatar />
              <Surface className="rounded-xl px-4 py-3 ring ring-kumo-line">
                <div className="flex items-center gap-2 text-sm text-kumo-subtle">
                  <GearIcon size={15} className="animate-spin" />
                  {retry ? 'Retrying…' : runningTools.length > 0 ? 'Looking through the archive…' : 'Thinking…'}
                </div>
              </Surface>
            </div>
          ) : null}

          {queued > 0 ? <p className="ml-11 text-xs text-kumo-subtle">{queued} more question(s) queued</p> : null}

          {error ? (
            <div role="alert" className="rounded-xl bg-kumo-danger/10 px-4 py-3 text-sm text-kumo-danger">
              {error}
            </div>
          ) : null}
          <div ref={endRef} />
        </div>
      </main>

      <div className="shrink-0 border-t border-kumo-line bg-kumo-base">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="mx-auto max-w-3xl px-5 pt-4"
        >
          <div className="flex items-end gap-3 rounded-xl border border-kumo-line bg-kumo-base p-3 shadow-sm transition-shadow focus-within:border-transparent focus-within:ring-2 focus-within:ring-kumo-ring">
            <InputArea
              value={prompt}
              onValueChange={setPrompt}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder={running ? 'Ask a follow-up…' : 'Ask about Ilmer’s history'}
              aria-label="Your question"
              disabled={!connected}
              maxLength={4000}
              rows={2}
              className="flex-1 !bg-transparent !shadow-none !ring-0 !outline-none focus:!ring-0"
            />
            {running ? (
              <Button
                type="button"
                variant="secondary"
                shape="square"
                aria-label="Stop"
                onClick={abort}
                icon={<StopIcon size={18} weight="fill" />}
                className="mb-0.5"
              />
            ) : (
              <Button
                type="submit"
                variant="primary"
                shape="square"
                aria-label="Send"
                disabled={!connected || prompt.trim() === ''}
                icon={<PaperPlaneRightIcon size={18} />}
                className="mb-0.5"
              />
            )}
          </div>
        </form>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-3 text-[11px] text-kumo-inactive">
          <span className="hidden sm:inline">Enter to send · Shift+Enter for a new line</span>
          <a className="inline-flex items-center gap-1 hover:underline" href="/.well-known/poppy.json">
            <CheckCircleIcon size={12} /> Personal agents can connect via Poppy
          </a>
          <a className="inline-flex items-center gap-1 hover:underline" href={SITE}>
            www.ilmer.org <ArrowSquareOutIcon size={11} />
          </a>
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(<App />);
