import markdownItFootnote from 'markdown-it-footnote';
import { RenderPlugin } from '@11ty/eleventy';

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy('images');
  eleventyConfig.addPassthroughCopy('assets');
  eleventyConfig.addPassthroughCopy('favicon.ico');

  eleventyConfig.amendLibrary('md', (mdLib) => mdLib.use(markdownItFootnote));
  eleventyConfig.addPlugin(RenderPlugin);
}
