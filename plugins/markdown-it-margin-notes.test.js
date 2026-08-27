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
  assert.match(html, /Present\.<\/span><\/span><span> Councillors Harper\. <\/span><span class="margin-note">/);
});

test('handles a marker in the middle of a paragraph', () => {
  const html = render('Proposed Councillor Claydon [Margin: Re Telephone Pole] Seconded Councillor Williams');
  assert.match(html, /Claydon <\/span><span class="margin-note">/);
  assert.match(html, /Re Telephone Pole<\/span><\/span><span> Seconded/);
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

test('replaces a margin-right marker with a right-gutter span', () => {
  const html = render('[Margin-right: Apology for absence] Apology for absence received.');
  assert.match(html, /<span class="margin-note margin-note--right">/);
  assert.match(html, /<span class="margin-note__text">Apology for absence<\/span>/);
  assert.doesNotMatch(html, /\[Margin-right:/);
});

test('is case-insensitive on the Margin-right keyword', () => {
  const html = render('[margin-right: Minutes] Minutes of last meeting.');
  assert.match(html, /class="margin-note margin-note--right">/);
});

test('supports a left and a right marker in the same paragraph', () => {
  const html = render('[Margin: Present.] Councillors Harper. [Margin-right: Mins.] Minutes were read.');
  assert.match(html, /<span class="margin-note">/);
  assert.match(html, /<span class="margin-note margin-note--right">/);
  const notes = [...html.matchAll(/class="margin-note__text">([^<]+)</g)].map((match) => match[1]);
  assert.deepEqual(notes, ['Present.', 'Mins.']);
});

test('escapes HTML in a margin-right label', () => {
  const html = render('[Margin-right: P.R. & Longwick C. of E.] Body');
  assert.match(html, /P\.R\. &amp; Longwick C\. of E\./);
});

test('does not consume an unclosed margin-right marker', () => {
  const html = render('[Margin-right: Minutes Minutes of last meeting.');
  assert.doesNotMatch(html, /class="margin-note/);
  assert.match(html, /\[Margin-right: Minutes/);
});

test('keeps a bracketed aside inside a margin label intact', () => {
  const html = render('therefore they are in mercy [Margin-right: [mercy] 3d.]');
  assert.match(html, /<span class="margin-note__text">\[mercy\] 3d\.<\/span>/);
  assert.doesNotMatch(html, /3d\.\]/);
});

test('wraps the body text either side of a marker in a plain, unclassed span', () => {
  const html = render('Proposed Councillor Claydon [Margin: Re Telephone Pole] Seconded Councillor Williams');
  assert.equal(
    html,
    '<p><span>Proposed Councillor Claydon </span><span class="margin-note">' +
      '<span class="margin-note__text">Re Telephone Pole</span></span><span> Seconded Councillor Williams</span></p>\n'
  );
});

test('does not wrap a paragraph that has no margin marker', () => {
  const html = render('Just an ordinary paragraph with no markers.');
  assert.equal(html, '<p>Just an ordinary paragraph with no markers.</p>\n');
});
