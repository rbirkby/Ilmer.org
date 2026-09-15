/** Add scroll controls to tables that need it while preserving their HTML: every table on
 * census pages or pages with `scrollAllTables` set, plus any table explicitly marked with
 * the `scrollable-table` class elsewhere. */
export function tableScroll(html: string, tags: string[] = [], scrollAllTables = false): string {
  let index = 0;
  return html.replace(/<table\b([^>]*)>[\s\S]*?<\/table>/gi, (table, attributes) => {
    const classes = /\bclass\s*=\s*(["'])(.*?)\1/i.exec(attributes)?.[2].split(/\s+/) || [];
    if (!scrollAllTables && !tags.includes('census') && !classes.includes('scrollable-table')) return table;

    const hintId = `table-scroll-hint-${index++}`;
    return `<div class="table-scroll" tabindex="0" role="region" aria-label="Table" aria-describedby="${hintId}">
<p class="table-scroll-hint" id="${hintId}">Scroll sideways to see more columns <span aria-hidden="true">↔</span></p>
${table}
<span class="table-scroll-shadow table-scroll-shadow--left" aria-hidden="true"></span>
<span class="table-scroll-shadow table-scroll-shadow--right" aria-hidden="true"></span>
</div>`;
  });
}
