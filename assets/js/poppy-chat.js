// A full page load drops the popover. Remember that it was open for this tab.
const KEY = 'poppy-chat-open';

/**
 * @typedef {object} PoppyChatMemory
 * @property {(key: string) => string | null} getItem
 * @property {(key: string, value: string) => void} setItem
 * @property {(key: string) => void} removeItem
 */

function write(storage, open) {
  try {
    if (open) storage.setItem(KEY, '1');
    else storage.removeItem(KEY);
  } catch {
    // sessionStorage can throw in private browsing.
  }
}

function read(storage) {
  try {
    return storage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Show or hide the chat so it matches the tab memory.
 * @param {PoppyChatMemory} storage
 */
export function applyPoppyChat(chat, storage) {
  const open = read(storage);
  const shown = chat.matches(':popover-open');
  if (open && !shown) chat.showPopover();
  else if (!open && shown) chat.hidePopover();
}

/**
 * The Poppy button toggles and the close button hides. Both run their click
 * listeners before the browser changes the popover, so the saved state is the
 * state the click is about to produce. Navigation does not click them, and a
 * manual popover does not close on its own when the document unloads.
 * @param {PoppyChatMemory} [storage]
 */
export function initPoppyChat(doc = document, storage = sessionStorage) {
  const chat = doc.getElementById('poppy-chat');
  if (!chat || typeof chat.showPopover !== 'function' || typeof chat.hidePopover !== 'function') return;

  for (const button of doc.querySelectorAll('[popovertarget="poppy-chat"]')) {
    button.addEventListener('click', () => {
      const action = button.getAttribute('popovertargetaction') || 'toggle';
      if (action === 'hide') write(storage, false);
      else if (action === 'show') write(storage, true);
      else write(storage, !chat.matches(':popover-open'));
    });
  }

  const apply = () => applyPoppyChat(chat, storage);
  doc.defaultView?.addEventListener('pageshow', apply);
  apply();
}

if (typeof document !== 'undefined') initPoppyChat();
