import markdownItFootnote from 'markdown-it-footnote';
import { RenderPlugin } from '@11ty/eleventy';
import markdownIt from 'markdown-it';

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy('images');
  eleventyConfig.addPassthroughCopy('assets');
  eleventyConfig.addPassthroughCopy('favicon.ico');

  eleventyConfig.amendLibrary('md', (mdLib) => mdLib.use(markdownItFootnote));
  eleventyConfig.addPlugin(RenderPlugin);

  const mdIt = markdownIt({ html: true, linkify: true }).disable('code');
  const inline = (content) => mdIt.renderInline(content);
  eleventyConfig.addFilter('renderMarkdownInline', inline);
}
