/**
 * markdown-it plugin that turns `[Margin: …]` markers into HTML sidenotes.
 *
 * The marker is replaced with a phrasing-content span at the same point in the
 * body text. CSS positions the label in the left gutter so it stays on the
 * same line as the insertion point.
 */
export default function markdownItMarginNotes(md) {
  md.inline.ruler.before('link', 'margin_note', (state, silent) => {
    const { src, pos, posMax } = state;
    if (pos + 8 > posMax) return false;
    if (src.charCodeAt(pos) !== 0x5b /* [ */) return false;

    const head = src.slice(pos + 1, pos + 8);
    if (head.toLowerCase() !== 'margin:') return false;

    let contentStart = pos + 8;
    while (contentStart < posMax) {
      const code = src.charCodeAt(contentStart);
      if (code !== 0x20 && code !== 0x09) break;
      contentStart += 1;
    }

    const close = src.indexOf(']', contentStart);
    if (close === -1 || close === contentStart) return false;

    for (let i = contentStart; i < close; i += 1) {
      const code = src.charCodeAt(i);
      if (code === 0x0a || code === 0x0d) return false;
    }

    const label = src.slice(contentStart, close).trim();
    if (!label) return false;

    if (!silent) {
      const token = state.push('margin_note', 'span', 0);
      token.content = label;
      token.markup = '[Margin:]';
      token.attrSet('class', 'margin-note');
    }

    state.pos = close + 1;
    return true;
  });

  md.renderer.rules.margin_note = (tokens, idx) => {
    const label = md.utils.escapeHtml(tokens[idx].content);
    return `<span class="margin-note">` + `<span class="margin-note__text">${label}</span>` + `</span>`;
  };
}
