import markdownItFootnote from 'markdown-it-footnote';
import { RenderPlugin } from '@11ty/eleventy';
import markdownIt from 'markdown-it';
import MarkdownItGitHubAlerts from 'markdown-it-github-alerts';

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy('images');
  eleventyConfig.addPassthroughCopy('assets');
  eleventyConfig.addPassthroughCopy('favicon.ico');
  eleventyConfig.addPassthroughCopy({
    'node_modules/markdown-it-github-alerts/styles/*.css': 'assets/css'
  });
  eleventyConfig.addPassthroughCopy('robots.txt');

  eleventyConfig.amendLibrary('md', (mdLib) => mdLib.use(markdownItFootnote));
  eleventyConfig.addPlugin(RenderPlugin);

  const mdIt = markdownIt({ html: true, linkify: true }).disable('code');
  const inline = (content) => mdIt.renderInline(content);
  eleventyConfig.addFilter('renderMarkdownInline', inline);

  eleventyConfig.addFilter('jsonStringify', JSON.stringify);
  eleventyConfig.addFilter('uniqueLabels', (events) =>
    [...new Set(events.flatMap(({ labels }) => labels))]
      .map((label) => ({
        label,
        count: events.filter((event) => event.labels.includes(label)).length
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  );

  eleventyConfig.amendLibrary('md', (mdLib) => mdLib.use(MarkdownItGitHubAlerts));
}
