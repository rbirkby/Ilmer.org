const markdownItFootnote = require('markdown-it-footnote');

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy('images');
  eleventyConfig.addPassthroughCopy('assets');
  eleventyConfig.addPassthroughCopy('favicon.ico');

  eleventyConfig.amendLibrary('md', (mdLib) => mdLib.use(markdownItFootnote));
};
