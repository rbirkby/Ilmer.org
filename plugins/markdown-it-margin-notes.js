/**
 * markdown-it plugin that turns `[Margin: …]` and `[Margin-right: …]` markers
 * into HTML sidenotes.
 *
 * The marker is replaced with a phrasing-content span at the same point in the
 * body text. CSS positions the label in the left (default) or right gutter so
 * it stays on the same line as the insertion point.
 */
const MARKERS = [
  { prefix: 'margin-right:', side: 'right' },
  { prefix: 'margin:', side: 'left' }
];

export default function markdownItMarginNotes(md) {
  md.inline.ruler.before('link', 'margin_note', (state, silent) => {
    const { src, pos, posMax } = state;
    if (src.charCodeAt(pos) !== 0x5b /* [ */) return false;

    const marker = MARKERS.find(({ prefix }) => {
      if (pos + 1 + prefix.length > posMax) return false;
      return src.slice(pos + 1, pos + 1 + prefix.length).toLowerCase() === prefix;
    });
    if (!marker) return false;

    let contentStart = pos + 1 + marker.prefix.length;
    while (contentStart < posMax) {
      const code = src.charCodeAt(contentStart);
      if (code !== 0x20 && code !== 0x09) break;
      contentStart += 1;
    }

    // Scan for the matching close bracket, tracking nesting depth so a label
    // that itself contains a bracketed aside (e.g. "[mercy] 3d.") doesn't get
    // truncated at that inner `]`.
    let depth = 0;
    let close = -1;
    for (let i = contentStart; i < posMax; i += 1) {
      const code = src.charCodeAt(i);
      if (code === 0x0a || code === 0x0d) return false;
      if (code === 0x5b /* [ */) {
        depth += 1;
      } else if (code === 0x5d /* ] */) {
        if (depth === 0) {
          close = i;
          break;
        }
        depth -= 1;
      }
    }
    if (close === -1 || close === contentStart) return false;

    const label = src.slice(contentStart, close).trim();
    if (!label) return false;

    if (!silent) {
      const token = state.push('margin_note', 'span', 0);
      token.content = label;
      token.markup = '[Margin:]';
      token.attrSet('class', marker.side === 'right' ? 'margin-note margin-note--right' : 'margin-note');
    }

    state.pos = close + 1;
    return true;
  });

  md.renderer.rules.margin_note = (tokens, idx) => {
    const label = md.utils.escapeHtml(tokens[idx].content);
    const cls = tokens[idx].attrGet('class');
    return `<span class="${cls}">` + `<span class="margin-note__text">${label}</span>` + `</span>`;
  };
}
