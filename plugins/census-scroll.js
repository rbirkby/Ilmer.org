/** Add scroll controls to the site's census tables while preserving their HTML. */
export function censusScroll(html, tags = []) {
  let index = 0;
  return html.replace(/<table\b([^>]*)>[\s\S]*?<\/table>/gi, (table, attributes) => {
    const classes = /\bclass\s*=\s*(["'])(.*?)\1/i.exec(attributes)?.[2].split(/\s+/) || [];
    if (!tags.includes('census') && !classes.includes('census-table')) return table;

    const hintId = `census-scroll-hint-${index++}`;
    return `<div class="census-scroll" tabindex="0" role="region" aria-label="Census table" aria-describedby="${hintId}">
<p class="census-scroll-hint" id="${hintId}">Scroll sideways to see more columns <span aria-hidden="true">↔</span></p>
${table}
<span class="census-scroll-shadow census-scroll-shadow--left" aria-hidden="true"></span>
<span class="census-scroll-shadow census-scroll-shadow--right" aria-hidden="true"></span>
</div>`;
  });
}
