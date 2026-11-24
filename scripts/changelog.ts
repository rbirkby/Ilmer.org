#!/usr/bin/env node
/**
 * Generate CHANGELOG.md from the Conventional Commits in the Git history.
 *
 * Merge commits and commits that do not follow `type(scope)!: description` are skipped.
 * Entries are grouped by month (newest first), then by section. A `!` after the type or a
 * `BREAKING CHANGE:` footer marks the entry as breaking. The workflow's own
 * `chore(changelog): ...` commits are left out so the file does not list its own updates.
 *
 * Usage: node scripts/changelog.ts [output-file]   (default: CHANGELOG.md)
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

export interface Commit {
  hash: string;
  date: string;
  subject: string;
  body: string;
}

export interface ChangelogEntry {
  hash: string;
  date: string;
  type: string;
  scope: string | undefined;
  description: string;
  breaking: boolean;
}

const CONVENTIONAL = /^(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?(?<bang>!)?:\s+(?<description>\S.*)$/i;
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE:/m;

/** Commit types that share a heading, in the order the headings appear. */
const SECTIONS: ReadonlyArray<{ title: string; types: readonly string[] }> = [
  { title: 'Features', types: ['feat'] },
  { title: 'Bug fixes', types: ['fix'] },
  { title: 'Performance', types: ['perf'] },
  { title: 'Refactoring', types: ['refactor'] },
  { title: 'Documentation', types: ['docs', 'doc'] },
  { title: 'Tests', types: ['test', 'tests'] },
  { title: 'Maintenance', types: ['chore', 'build', 'ci', 'style', 'revert'] }
];
const OTHER_SECTION = 'Other changes';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

export function parseCommit(commit: Commit): ChangelogEntry | null {
  const match = CONVENTIONAL.exec(commit.subject.trim());
  if (!match?.groups) return null;
  const { type = '', scope, bang, description = '' } = match.groups;
  const entry: ChangelogEntry = {
    hash: commit.hash,
    date: commit.date,
    type: type.toLowerCase(),
    scope: scope?.trim() || undefined,
    description: description.trim(),
    breaking: bang === '!' || BREAKING_FOOTER.test(commit.body)
  };
  if (entry.type === 'chore' && entry.scope === 'changelog') return null;
  return entry;
}

export function sectionTitle(type: string): string {
  return SECTIONS.find((section) => section.types.includes(type))?.title ?? OTHER_SECTION;
}

/** `2026-11` -> `November 2026` */
export function monthHeading(month: string): string {
  const [year, monthNumber] = month.split('-');
  return `${MONTHS[Number(monthNumber) - 1] ?? month} ${year}`;
}

/** Escape Markdown in commit text, leaving `code spans` alone. */
export function escapeMarkdown(text: string): string {
  return text
    .split(/(`[^`]*`)/)
    .map((part) =>
      part.startsWith('`') && part.endsWith('`') && part.length > 1 ? part : part.replace(/[\\*_<>[\]]/g, '\\$&')
    )
    .join('');
}

/** `git@github.com:owner/repo.git` or `https://github.com/owner/repo.git` -> `https://github.com/owner/repo` */
export function repoUrlFromRemote(remote: string): string | undefined {
  const match = /github\.com[:/](?<path>[^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(remote.trim());
  return match?.groups ? `https://github.com/${match.groups.path}` : undefined;
}

function formatEntry(entry: ChangelogEntry, repoUrl: string | undefined): string {
  const shortHash = entry.hash.slice(0, 7);
  const link = repoUrl ? `[${shortHash}](${repoUrl}/commit/${entry.hash})` : shortHash;
  const breaking = entry.breaking ? '**Breaking:** ' : '';
  const scope = entry.scope ? `**${escapeMarkdown(entry.scope)}:** ` : '';
  return `- ${breaking}${scope}${escapeMarkdown(entry.description)} (${link})`;
}

/** Render entries (newest first, as `git log` lists them) as Markdown. */
export function renderChangelog(entries: readonly ChangelogEntry[], repoUrl?: string): string {
  const months = new Map<string, ChangelogEntry[]>();
  for (const entry of entries) {
    const month = entry.date.slice(0, 7);
    months.set(month, [...(months.get(month) ?? []), entry]);
  }

  const sectionOrder = [...SECTIONS.map((section) => section.title), OTHER_SECTION];
  const lines = [
    '# Changelog',
    '',
    'Generated automatically from [Conventional Commits](https://www.conventionalcommits.org/) by `scripts/changelog.ts`. Do not edit by hand.'
  ];

  for (const month of [...months.keys()].sort().reverse()) {
    lines.push('', `## ${monthHeading(month)}`);
    const bySection = Map.groupBy(months.get(month) ?? [], (entry) => sectionTitle(entry.type));
    for (const title of sectionOrder) {
      const sectionEntries = bySection.get(title);
      if (!sectionEntries) continue;
      lines.push('', `### ${title}`, '', ...sectionEntries.map((entry) => formatEntry(entry, repoUrl)));
    }
  }

  return `${lines.join('\n')}\n`;
}

function git(args: readonly string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

export function readCommits(cwd: string): Commit[] {
  const output = git(['log', '--no-merges', '--date=short', '--format=%H%x1f%ad%x1f%s%x1f%b%x1e'], cwd);
  return output
    .split('\x1e')
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record.length > 0)
    .map((record) => {
      const [hash = '', date = '', subject = '', body = ''] = record.split('\x1f');
      return { hash, date, subject, body };
    });
}

function main(): void {
  const projectRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
  const output = path.resolve(projectRoot, process.argv[2] ?? 'CHANGELOG.md');

  if (git(['rev-parse', '--is-shallow-repository'], projectRoot).trim() === 'true') {
    console.error('ERROR: shallow clone; fetch the full history (actions/checkout fetch-depth: 0).');
    process.exit(1);
  }

  let repoUrl: string | undefined;
  try {
    repoUrl = repoUrlFromRemote(git(['remote', 'get-url', 'origin'], projectRoot));
  } catch {
    repoUrl = undefined;
  }

  const entries = readCommits(projectRoot)
    .map(parseCommit)
    .filter((entry) => entry !== null);
  writeFileSync(output, renderChangelog(entries, repoUrl));
  console.log(`Wrote ${entries.length} entries to ${path.relative(projectRoot, output)}`);
}

if (import.meta.url === url.pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
