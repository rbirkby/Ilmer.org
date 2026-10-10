// The Ilmer Past site as searchable text. scripts/build-corpus.mjs writes public/corpus.json at build time;
// it is read through the ASSETS binding (never routed publicly) and indexed once per isolate.

export type Page = { url: string; title: string; description: string; text: string };
type Chunk = { page: number; start: number; text: string; terms: Map<string, number>; length: number };
export type Hit = { url: string; title: string; snippet: string; score: number };

const CHUNK = 1200;
const STOP = new Set(
  'a an and are as at be but by for from had has have he her his in into is it its of on or she that the their there they this to was were which who will with'.split(
    ' '
  )
);

export function tokenize(text: string) {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .match(/[a-z0-9]+/g) ?? []
  ).filter((t) => !STOP.has(t));
}

function chunksOf(text: string) {
  const parts: { start: number; text: string }[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + CHUNK);
    if (end < text.length) {
      const para = text.lastIndexOf('\n', end);
      if (para > start + CHUNK / 2) end = para;
    }
    parts.push({ start, text: text.slice(start, end) });
    start = end;
  }
  return parts;
}

export class Corpus {
  readonly pages: Page[];
  private chunks: Chunk[] = [];
  private df = new Map<string, number>();
  private avgLength = 1;
  private byUrl = new Map<string, number>();

  constructor(pages: Page[]) {
    this.pages = pages;
    let total = 0;
    pages.forEach((page, index) => {
      this.byUrl.set(new URL(page.url).pathname, index);
      const head = `${page.title}\n${page.description}\n`;
      for (const part of chunksOf(page.text)) {
        // Titles weigh in every chunk, so a page's subject still matches deep in long pages.
        const tokens = [...tokenize(head), ...tokenize(head), ...tokenize(part.text)];
        const terms = new Map<string, number>();
        for (const t of tokens) terms.set(t, (terms.get(t) ?? 0) + 1);
        for (const t of terms.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
        this.chunks.push({ page: index, start: part.start, text: part.text, terms, length: tokens.length });
        total += tokens.length;
      }
    });
    this.avgLength = total / Math.max(1, this.chunks.length);
  }

  search(query: string, limit = 8): Hit[] {
    const terms = [...new Set(tokenize(query))];
    if (!terms.length) return [];
    const n = this.chunks.length;
    const best = new Map<number, { score: number; chunk: Chunk }>();
    for (const chunk of this.chunks) {
      let score = 0;
      for (const t of terms) {
        const tf = chunk.terms.get(t);
        if (!tf) continue;
        const df = this.df.get(t)!;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        score += (idf * tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (chunk.length / this.avgLength)));
      }
      if (score > 0 && score > (best.get(chunk.page)?.score ?? 0)) best.set(chunk.page, { score, chunk });
    }
    return [...best.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(Math.max(limit, 1), 15))
      .map(({ score, chunk }) => {
        const page = this.pages[chunk.page];
        return {
          url: page.url,
          title: page.title,
          snippet: snippet(chunk.text, terms),
          score: Math.round(score * 100) / 100
        };
      });
  }

  /** A window of one page's text. Accepts a full ilmer.org URL or a path. */
  read(urlOrPath: string, offset = 0, length = 8000) {
    let path: string;
    try {
      path = new URL(urlOrPath, 'https://www.ilmer.org').pathname;
    } catch {
      return undefined;
    }
    const index = this.byUrl.get(path) ?? this.byUrl.get(path.endsWith('/') ? path : path + '/');
    if (index === undefined) return undefined;
    const page = this.pages[index];
    const start = Math.max(0, Math.floor(offset));
    const end = Math.min(page.text.length, start + Math.min(Math.max(length, 500), 12000));
    return {
      url: page.url,
      title: page.title,
      description: page.description,
      text: page.text.slice(start, end),
      offset: start,
      total_length: page.text.length,
      ...(end < page.text.length ? { next_offset: end } : {})
    };
  }
}

function snippet(text: string, terms: string[], width = 320) {
  const lower = text.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lower.search(new RegExp(`\\b${t}`));
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  const start = Math.max(0, at - width / 3);
  const clip = text
    .slice(start, start + width)
    .replace(/\s+/g, ' ')
    .trim();
  return (start > 0 ? '…' : '') + clip + (start + width < text.length ? '…' : '');
}

let loaded: Promise<Corpus> | undefined;
export function corpus(env: Env) {
  loaded ??= env.ASSETS.fetch('https://assets.local/corpus.json')
    .then(async (response) => {
      if (!response.ok) throw new Error(`corpus.json unavailable (${response.status})`);
      const { pages } = (await response.json()) as { pages: Page[] };
      return new Corpus(pages);
    })
    .catch((error) => {
      loaded = undefined;
      throw error;
    });
  return loaded;
}
