// A full page load drops the popover. Remember that it was open for this tab.
const KEY = 'poppy-chat-open';

/** Where the open state is remembered: sessionStorage, or a stand-in in tests. */
export type PoppyChatMemory = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The popover, or a stand-in in tests. */
export interface PoppyChat {
  matches(selector: string): boolean;
  showPopover(): void;
  hidePopover(): void;
}

/** The parts of the document the chat uses, so tests can pass a stand-in. */
export interface PoppyChatDocument {
  getElementById(id: string): PoppyChat | null;
  querySelectorAll(selectors: string): Iterable<{
    getAttribute(name: string): string | null;
    addEventListener(type: string, listener: () => void): void;
  }>;
  defaultView?: { addEventListener(type: string, listener: () => void): void } | null;
}

function write(storage: PoppyChatMemory, open: boolean) {
  try {
    if (open) storage.setItem(KEY, '1');
    else storage.removeItem(KEY);
  } catch {
    // sessionStorage can throw in private browsing.
  }
}

function read(storage: PoppyChatMemory) {
  try {
    return storage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Show or hide the chat so it matches the tab memory. */
export function applyPoppyChat(chat: PoppyChat, storage: PoppyChatMemory) {
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
 */
export function initPoppyChat(doc: PoppyChatDocument = document, storage: PoppyChatMemory = sessionStorage) {
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
