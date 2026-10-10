import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractPage, htmlToText } from '../scripts/build-corpus.mjs';
import { Corpus, tokenize } from '../src/corpus.ts';

const pages = [
  {
    url: 'https://www.ilmer.org/history/church/',
    title: "St Peter's Church History",
    description: '12th century church',
    text: 'The spire was added in 1909. Three bells hang in the belfry.'
  },
  {
    url: 'https://www.ilmer.org/history/domesday/',
    title: 'Domesday',
    description: 'Ilmer in 1086',
    text: 'Ilmer was held by Walter Giffard. Land for six ploughs.'
  },
  {
    url: 'https://www.ilmer.org/wills/',
    title: 'Wills',
    description: 'Probate records',
    text: 'x'.repeat(5000) + ' The will of John Lacey mentions the bells.'
  }
];

test('tokenize drops stop words and accents', () => {
  assert.deepEqual(tokenize('The Église of Ilmer, 1086'), ['eglise', 'ilmer', '1086']);
});

test('search ranks the page about the query first, with a snippet', () => {
  const corpus = new Corpus(pages);
  const [first] = corpus.search('Domesday ploughs');
  assert.equal(first.url, 'https://www.ilmer.org/history/domesday/');
  assert.match(first.snippet, /ploughs/);
  assert.equal(corpus.search('the of and').length, 0);
});

test('search finds text deep in a long page', () => {
  const hits = new Corpus(pages).search('Lacey');
  assert.equal(hits[0].url, 'https://www.ilmer.org/wills/');
  assert.match(hits[0].snippet, /John Lacey/);
});

test('read accepts paths or URLs and pages through long text', () => {
  const corpus = new Corpus(pages);
  assert.equal(corpus.read('/history/church/')?.title, "St Peter's Church History");
  assert.equal(corpus.read('https://www.ilmer.org/history/church')?.title, "St Peter's Church History");
  assert.equal(corpus.read('/missing/'), undefined);
  const first = corpus.read('/wills/', 0, 1000);
  assert.equal(first?.next_offset, 1000);
  assert.equal(corpus.read('/wills/', 0)?.next_offset, undefined);
  assert.match(corpus.read('/wills/', 4800)?.text ?? '', /John Lacey/);
});

test('extractPage takes the title, description and main text only', () => {
  const html = `<html><head><title>Coldharbour &#8211; Ilmer Past</title><meta name="description" content="A farm &amp; hamlet"></head>
    <body><nav>Menu</nav><main><h1>Coldharbour</h1><p>Farm&nbsp;house</p><script>x()</script><img src="a.jpg" alt="Old barn"></main><footer>Footer</footer></body></html>`;
  const page = extractPage(html);
  assert.equal(page.title, 'Coldharbour');
  assert.equal(page.description, 'A farm & hamlet');
  assert.equal(page.text, 'Coldharbour\nFarm house\n[Image: Old barn]');
  assert.doesNotMatch(htmlToText(html), /x\(\)/);
});
