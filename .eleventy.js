const markdownItFootnote = require('markdown-it-footnote');

module.exports = async function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy('images');
  eleventyConfig.addPassthroughCopy('assets');
  eleventyConfig.addPassthroughCopy('favicon.ico');

  eleventyConfig.amendLibrary('md', (mdLib) => mdLib.use(markdownItFootnote));

  const { RenderPlugin } = await import('@11ty/eleventy');
  eleventyConfig.addPlugin(RenderPlugin);
};
