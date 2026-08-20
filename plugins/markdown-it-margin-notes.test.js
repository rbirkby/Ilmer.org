import assert from 'node:assert/strict';
import { test } from 'node:test';
import MarkdownIt from 'markdown-it';
import markdownItMarginNotes from './markdown-it-margin-notes.js';

function render(src) {
  return new MarkdownIt({ html: true }).use(markdownItMarginNotes).render(src);
}

test('replaces a margin marker with a left-gutter span', () => {
  const html = render('[Margin: Apology for absence] Apology for absence received.');
  assert.match(html, /<span class="margin-note">/);
  assert.match(html, /<span class="margin-note__text">Apology for absence<\/span>/);
  assert.doesNotMatch(html, /\[Margin:/);
  assert.match(html, /Apology for absence received\./);
});

test('keeps several markers in one paragraph at their original positions', () => {
  const html = render('[Margin: Present.] Councillors Harper. [Margin: Mins.] Minutes were read.');
  const notes = [...html.matchAll(/class="margin-note__text">([^<]+)</g)].map((match) => match[1]);
  assert.deepEqual(notes, ['Present.', 'Mins.']);
  assert.match(html, /Present\.<\/span><\/span> Councillors Harper\. <span class="margin-note">/);
});

test('handles a marker in the middle of a paragraph', () => {
  const html = render('Proposed Councillor Claydon [Margin: Re Telephone Pole] Seconded Councillor Williams');
  assert.match(html, /Claydon <span class="margin-note">/);
  assert.match(html, /Re Telephone Pole<\/span><\/span> Seconded/);
});

test('leaves other bracket annotations alone', () => {
  const html = render('[inserted: H. W Lewis] and [Stamp: DISTRICT AUDIT] and [Cover]');
  assert.doesNotMatch(html, /class="margin-note"/);
  assert.match(html, /\[inserted: H\. W Lewis\]/);
  assert.match(html, /\[Stamp: DISTRICT AUDIT\]/);
});

test('escapes HTML in the margin label', () => {
  const html = render('[Margin: P.R. & Longwick C. of E.] Body');
  assert.match(html, /P\.R\. &amp; Longwick C\. of E\./);
  assert.doesNotMatch(html, /P\.R\. & Longwick/);
});

test('is case-insensitive on the Margin keyword', () => {
  const html = render('[margin: Minutes] Minutes of last meeting.');
  assert.match(html, /class="margin-note__text">Minutes<\/span>/);
});

test('does not consume an unclosed marker', () => {
  const html = render('[Margin: Minutes Minutes of last meeting.');
  assert.doesNotMatch(html, /class="margin-note"/);
  assert.match(html, /\[Margin: Minutes/);
});
