import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type Commit,
  escapeMarkdown,
  monthHeading,
  parseCommit,
  renderChangelog,
  repoUrlFromRemote
} from '../scripts/changelog.ts';

function commit(subject: string, overrides: Partial<Commit> = {}): Commit {
  return { hash: 'abcdef1234567890', date: '2026-11-24', subject, body: '', ...overrides };
}

test('parses type, scope and description', () => {
  assert.deepEqual(parseCommit(commit('feat(map): Add roadsigns')), {
    hash: 'abcdef1234567890',
    date: '2026-11-24',
    type: 'feat',
    scope: 'map',
    description: 'Add roadsigns',
    breaking: false
  });
  assert.equal(parseCommit(commit('fix: tidy'))?.scope, undefined);
  assert.equal(parseCommit(commit('Feat: shouty'))?.type, 'feat');
});

test('skips non-conventional commits and the changelog bot', () => {
  assert.equal(parseCommit(commit('Merge pull request #178 from rbirkby/branch')), null);
  assert.equal(parseCommit(commit('Thatch Lower Farm outbuildings')), null);
  assert.equal(parseCommit(commit('feat:')), null);
  assert.equal(parseCommit(commit('chore(changelog): update CHANGELOG.md')), null);
});

test('marks breaking changes from ! or a footer', () => {
  assert.equal(parseCommit(commit('feat!: drop Node 24'))?.breaking, true);
  assert.equal(parseCommit(commit('feat(api)!: drop Node 24'))?.breaking, true);
  assert.equal(parseCommit(commit('feat: x', { body: 'Details\n\nBREAKING CHANGE: gone' }))?.breaking, true);
  assert.equal(parseCommit(commit('feat: x', { body: 'not a BREAKING CHANGE: mid-line' }))?.breaking, false);
});

test('escapes Markdown outside code spans', () => {
  assert.equal(
    escapeMarkdown('Do not use typescript `any_thing` or <b>'),
    'Do not use typescript `any_thing` or \\<b\\>'
  );
  assert.equal(escapeMarkdown('snake_case *stars* [link]'), 'snake\\_case \\*stars\\* \\[link\\]');
});

test('derives the GitHub URL from the origin remote', () => {
  assert.equal(repoUrlFromRemote('https://github.com/rbirkby/Ilmer.org.git\n'), 'https://github.com/rbirkby/Ilmer.org');
  assert.equal(repoUrlFromRemote('git@github.com:rbirkby/Ilmer.org.git'), 'https://github.com/rbirkby/Ilmer.org');
  assert.equal(repoUrlFromRemote('https://github.com/rbirkby/Ilmer.org'), 'https://github.com/rbirkby/Ilmer.org');
  assert.equal(repoUrlFromRemote('https://example.com/repo.git'), undefined);
});

test('names months', () => {
  assert.equal(monthHeading('2026-11'), 'November 2026');
  assert.equal(monthHeading('2024-01'), 'January 2024');
});

test('groups by month, newest first, then by section in a fixed order', () => {
  const entries = [
    commit('chore(deps): Update dependencies', { hash: '3'.repeat(40), date: '2026-11-20' }),
    commit('fix: porch tiles', { hash: '2'.repeat(40), date: '2026-11-10' }),
    commit('feat: Local deps', { hash: '1'.repeat(40), date: '2026-11-01' }),
    commit('feat!: New site', { hash: '0'.repeat(40), date: '2024-03-31' })
  ]
    .map(parseCommit)
    .filter((entry) => entry !== null);

  assert.equal(
    renderChangelog(entries, 'https://github.com/o/r'),
    [
      '# Changelog',
      '',
      'Generated automatically from [Conventional Commits](https://www.conventionalcommits.org/) by `scripts/changelog.ts`. Do not edit by hand.',
      '',
      '## November 2026',
      '',
      '### Features',
      '',
      `- Local deps ([1111111](https://github.com/o/r/commit/${'1'.repeat(40)}))`,
      '',
      '### Bug fixes',
      '',
      `- porch tiles ([2222222](https://github.com/o/r/commit/${'2'.repeat(40)}))`,
      '',
      '### Maintenance',
      '',
      `- **deps:** Update dependencies ([3333333](https://github.com/o/r/commit/${'3'.repeat(40)}))`,
      '',
      '## March 2024',
      '',
      '### Features',
      '',
      `- **Breaking:** New site ([0000000](https://github.com/o/r/commit/${'0'.repeat(40)}))`,
      ''
    ].join('\n')
  );
});

test('omits commit links when the remote is unknown', () => {
  const entry = parseCommit(commit('docs: readme'));
  assert.ok(entry);
  assert.match(renderChangelog([entry]), /^- readme \(abcdef1\)$/m);
});
