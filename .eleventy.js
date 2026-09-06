/**
 * Zero-config entry point: Eleventy's built-in config auto-discovery only
 * looks for `.eleventy.js`/`eleventy.config.{js,mjs,cjs}`, not `.ts`. This
 * stub exists for invocations that don't pass `--config=.eleventy.ts`
 * (e.g. Cloudflare Pages' build command), relying on Node's native
 * TypeScript support to load the real config.
 */
export { default } from './.eleventy.ts';
