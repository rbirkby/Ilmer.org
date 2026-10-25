import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { applyPoppyChat, initPoppyChat } from '../assets/js/poppy-chat.js';

type Listener = () => void;

function storage(initial: string | null = null) {
  const values = new Map<string, string>();
  if (initial !== null) values.set('poppy-chat-open', initial);
  return {
    values,
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    }
  };
}

function harness(initial: string | null = null) {
  let shown = false;
  const clicks = new Map<string, Listener[]>();
  const pageshow: Listener[] = [];
  const buttons = [
    { action: null as string | null, id: 'toggle' },
    { action: 'hide', id: 'close' }
  ];

  const chat = {
    matches(selector: string) {
      return selector === ':popover-open' && shown;
    },
    showPopover() {
      shown = true;
    },
    hidePopover() {
      shown = false;
    }
  };

  const buttonNodes = buttons.map((button) => ({
    getAttribute(name: string) {
      return name === 'popovertargetaction' ? button.action : null;
    },
    addEventListener(type: string, listener: Listener) {
      if (type !== 'click') return;
      const list = clicks.get(button.id) ?? [];
      list.push(listener);
      clicks.set(button.id, list);
    }
  }));

  const doc = {
    getElementById(id: string) {
      return id === 'poppy-chat' ? chat : null;
    },
    querySelectorAll(selector: string) {
      return selector === '[popovertarget="poppy-chat"]' ? buttonNodes : [];
    },
    defaultView: {
      addEventListener(type: string, listener: Listener) {
        if (type === 'pageshow') pageshow.push(listener);
      }
    }
  };

  const memory = storage(initial);
  initPoppyChat(doc, memory);

  return {
    chat,
    memory,
    get shown() {
      return shown;
    },
    click(id: string) {
      for (const listener of clicks.get(id) ?? []) listener();
    },
    pageshow() {
      for (const listener of pageshow) listener();
    }
  };
}

test('an open chat is open again on the next page', () => {
  const page = harness('1');
  assert.equal(page.shown, true);
  assert.equal(page.memory.getItem('poppy-chat-open'), '1');
});

test('a closed chat stays closed on the next page', () => {
  const page = harness(null);
  assert.equal(page.shown, false);

  page.click('toggle');
  assert.equal(page.memory.getItem('poppy-chat-open'), '1');

  page.chat.showPopover();
  page.click('toggle');
  assert.equal(page.memory.getItem('poppy-chat-open'), null);

  page.click('toggle');
  page.chat.showPopover();
  page.click('close');
  assert.equal(page.memory.getItem('poppy-chat-open'), null);
});

test('returning to a cached page follows the latest open or closed choice', () => {
  const page = harness('1');
  assert.equal(page.shown, true);

  page.memory.removeItem('poppy-chat-open');
  page.pageshow();
  assert.equal(page.shown, false);

  page.memory.setItem('poppy-chat-open', '1');
  page.pageshow();
  assert.equal(page.shown, true);
});

test('a missing chat or blocked storage does nothing', () => {
  assert.doesNotThrow(() => initPoppyChat({ getElementById: () => null, querySelectorAll: () => [] }));
  const blocked = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('denied');
    },
    removeItem() {
      throw new Error('denied');
    }
  };
  const chat = {
    matches: () => false,
    showPopover() {
      throw new Error('should stay closed');
    },
    hidePopover() {}
  };
  assert.doesNotThrow(() => applyPoppyChat(chat, blocked));
  assert.doesNotThrow(() =>
    initPoppyChat(
      {
        getElementById: () => chat,
        querySelectorAll: () => [{ getAttribute: () => null, addEventListener() {} }],
        defaultView: null
      },
      blocked
    )
  );
});

test('every page loads the chat memory script next to the popover', () => {
  const footer = readFileSync(new URL('../_includes/site-footer.liquid', import.meta.url), 'utf8');
  assert.match(footer, /id="poppy-chat"/);
  assert.match(footer, /class="poppy-link" popovertarget="poppy-chat"/);
  assert.match(footer, /popovertarget="poppy-chat" popovertargetaction="hide"/);
  assert.match(footer, /\/assets\/js\/poppy-chat\.js/);
});
