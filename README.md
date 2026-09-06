# Ilmer.org

ilmer.org

## Development

`npm run start`

## Stylesheets

All stylesheet links live in [_includes/head.liquid](_includes/head.liquid) and local CSS uses the `cacheBust` filter.

- [assets/css/style.css](assets/css/style.css) is the shared base: palette and font tokens, site chrome, article content, media, tables, margin notes, accessibility utilities and the lightbox. It also imports the dependency-owned GitHub alert styles.
- [assets/css/archive.css](assets/css/archive.css) provides the archive theme and its components: heroes, archive browsing, parish cards, census lists and minute navigation. The post, archive and parish-hub layouts load it automatically; posts (including drafts) always use archive presentation without a page-level flag. Keep it separate so home, wills, timeline and 404 pages do not download unused archive rules.
- [assets/css/home.css](assets/css/home.css), [assets/css/will.css](assets/css/will.css) and [assets/css/timeline.css](assets/css/timeline.css) load only for their respective layouts. Home and will rules were previously embedded in templates. The will's `data-script` attribute selects its handwriting font; only round-hand wills request Pinyon Script.

Keep CSS rules out of Markdown and Liquid style blocks. Use a component class for static presentation; posts can set `articleClass` in front matter for a scoped article treatment, such as `article--fitted-transcript` on Court Rolls. The Domesday folio mask is scoped to its image, not every article image.

Inline styles remain appropriate for content-specific values: archive hero image URLs and SmartFrame image aspect ratios and maximum widths. The shared SmartFrame width and display rules belong to the base stylesheet. Runtime styles controlled by interactive widgets are separate from authored page CSS.

`npm test` includes stylesheet ownership checks, the site build and internal link checks. For visual CSS changes, also compare representative home, article, archive, census, will and timeline pages at desktop and phone widths, including expanded archive years and both will font-toggle states.
