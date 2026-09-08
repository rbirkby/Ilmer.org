import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';

const includes = new URL('../_includes/', import.meta.url);
const liquid = new Liquid({ root: fileURLToPath(includes), extname: '.liquid' });
liquid.registerFilter('cacheBust', (path) => path);
liquid.registerFilter('sitePath', (path) => path);

for (const layout of ['404', 'home', 'post', 'timeline', 'will', 'archive', 'parish-hub']) {
  test(`${layout} passes page metadata and asset flags to the isolated head`, async () => {
    const source = readFileSync(new URL(`${layout}.liquid`, includes), 'utf8');
    const headCall = source.match(/\{% render "head"[\s\S]*?%\}/)?.[0];
    assert.ok(headCall);
    for (const overrides of [
      { content: 'An article', lightbox: true, description: 'Page description' },
      { content: 'A photograph #bwphoto', lightbox: false, description: '' }
    ]) {
      const data = {
        layout,
        script: 'round-hand',
        site: { url: 'https://example.com', title: 'Test site' },
        url: '/test/',
        title: 'Test page',
        tags: ['history', 'parish'],
        image: '/images/test.avif',
        ...overrides
      };
      assert.equal(await liquid.parseAndRender(headCall, data), await liquid.renderFile('head', data));
    }
  });

  if (layout === 'home') continue;

  test(`${layout} passes ancestors and page details to isolated breadcrumbs`, async () => {
    const source = readFileSync(new URL(`${layout}.liquid`, includes), 'utf8');
    const breadcrumbCall = source.match(/\{% render "breadcrumb.liquid"[\s\S]*?%\}/)?.[0];
    assert.ok(breadcrumbCall);
    for (const breadcrumbUseDate of [false, true]) {
      const data = {
        ancestorCrumb1: { url: '/parish/', label: 'Parish' },
        ancestorCrumb2: { url: '/parish/minutes/', label: 'Minutes' },
        breadcrumbUseDate,
        page: { date: new Date('1900-06-01') },
        title: 'Test page'
      };
      assert.equal(
        await liquid.parseAndRender(breadcrumbCall, data),
        await liquid.renderFile('breadcrumb.liquid', data)
      );
    }
  });
}
