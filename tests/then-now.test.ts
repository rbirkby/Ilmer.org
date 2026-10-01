import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Liquid } from 'liquidjs';
import { initThenNow, pointerToPosition, valueText } from '../assets/js/then-now.js';

const root = new URL('../', import.meta.url);

test('pointer position maps onto the divider, clamped to the photograph', () => {
  assert.equal(pointerToPosition(0, 0, 200), 0);
  assert.equal(pointerToPosition(100, 0, 200), 50);
  assert.equal(pointerToPosition(200, 0, 200), 100);
  assert.equal(pointerToPosition(10, 10, 200), 0);
  assert.equal(pointerToPosition(9, 10, 200), 0);
  assert.equal(pointerToPosition(1000, 0, 100), 100);
  assert.equal(pointerToPosition(11, 10, 200), 1);
  assert.equal(pointerToPosition(50, 0, 0), 0);
  assert.equal(pointerToPosition(50, 0, -10), 0);
});

test('the spoken position names whichever photograph fills the frame', () => {
  assert.equal(valueText(0), 'January 2026');
  assert.equal(valueText(-4), 'January 2026');
  assert.equal(valueText(100), 'film still');
  assert.equal(valueText(140), 'film still');
  assert.equal(valueText(50), '50% film still, 50% January 2026');
  assert.equal(valueText(1), '1% film still, 99% January 2026');
  assert.equal(valueText(99.4), '99% film still, 1% January 2026');
  assert.equal(valueText(Number.NaN), 'January 2026');
});

test('drags and taps move the divider, and a vertical swipe does not', () => {
  class RangeInput {
    value = '40';
    readonly texts: string[] = [];
    private readonly listeners = new Map<string, Array<() => void>>();

    addEventListener(type: string, listener: () => void) {
      const list = this.listeners.get(type) ?? [];
      list.push(listener);
      this.listeners.set(type, list);
    }

    dispatch(type: string) {
      for (const listener of this.listeners.get(type) ?? []) listener();
    }

    setAttribute(name: string, value: string) {
      if (name === 'aria-valuetext') this.texts.push(value);
    }
  }

  const savedInput = Object.getOwnPropertyDescriptor(globalThis, 'HTMLInputElement');
  Object.defineProperty(globalThis, 'HTMLInputElement', { value: RangeInput, configurable: true });

  try {
    const prevented: number[] = [];
    const range = new RangeInput();
    const stage = fakeStage(range, prevented);
    const ignored = fakeStage(null, prevented);

    initThenNow({ querySelectorAll: () => [ignored, stage] });

    assert.equal(ignored.ready, false);
    assert.equal(stage.ready, true);
    assert.equal(stage.css['--then-now'], '40%');
    assert.equal(range.texts.at(-1), '40% film still, 60% January 2026');

    stage.emit(pointer({ button: 2, pointerId: 1, pointerType: 'mouse', clientX: 0 }));
    assert.equal(range.value, '40');
    assert.deepEqual(prevented, []);

    stage.emit(pointer({ pointerId: 1, pointerType: 'mouse', clientX: 100 }));
    stage.emit(pointer({ pointerId: 1, pointerType: 'mouse', clientX: 150 }), 'pointermove');
    stage.emit(pointer({ pointerId: 9 }), 'pointermove');
    stage.emit(pointer({ pointerId: 9 }), 'pointerup');
    stage.emit(pointer({ pointerId: 1, pointerType: 'mouse', clientX: 150 }), 'pointerup');
    assert.equal(range.value, '75');
    assert.deepEqual(prevented, [1]);
    assert.equal(stage.captures, 1);

    stage.emit(pointer({ pointerId: 2, clientX: 40, clientY: 10 }));
    stage.emit(pointer({ pointerId: 99, clientX: 0 }), 'pointermove');
    stage.emit(pointer({ pointerId: 2, clientX: 44, clientY: 12 }), 'pointermove');
    stage.emit(pointer({ pointerId: 2, clientX: 44, clientY: 40 }), 'pointermove');
    assert.equal(range.value, '75');
    assert.equal(stage.captures, 1);

    stage.emit(pointer({ pointerId: 3, clientX: 10, clientY: 10 }));
    stage.emit(pointer({ pointerId: 3, clientX: 40, clientY: 14 }), 'pointermove');
    stage.emit(pointer({ pointerId: 3, clientX: 40, clientY: 14 }), 'pointerup');
    assert.equal(range.value, '20');
    assert.equal(stage.captures, 2);

    stage.emit(pointer({ pointerId: 4, clientX: 80, clientY: 10 }));
    stage.emit(pointer({ pointerId: 4, clientX: 82, clientY: 12 }), 'pointerup');
    assert.equal(range.value, '41');

    stage.emit(pointer({ pointerId: 5, clientX: 10, clientY: 10 }));
    stage.emit(pointer({ pointerId: 5, clientX: 30, clientY: 10 }), 'pointerup');
    assert.equal(range.value, '41');

    stage.emit(pointer({ pointerId: 5 }), 'pointercancel');
    stage.emit(pointer({ pointerId: 6, clientX: 10, clientY: 10 }));
    stage.emit(pointer({ pointerId: 6 }), 'pointercancel');
    stage.emit(pointer({ pointerId: 6, clientX: 80, clientY: 10 }), 'pointermove');
    assert.equal(range.value, '41');

    range.value = '10';
    range.dispatch('input');
    assert.equal(stage.css['--then-now'], '10%');
    assert.equal(range.texts.at(-1), '10% film still, 90% January 2026');

    const writes = range.texts.length;
    initThenNow({ querySelectorAll: () => [stage] });
    range.dispatch('input');
    assert.equal(range.texts.length, writes + 1);
  } finally {
    if (savedInput) Object.defineProperty(globalThis, 'HTMLInputElement', savedInput);
    else Reflect.deleteProperty(globalThis, 'HTMLInputElement');
  }
});

type PointerLike = {
  button: number;
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  preventDefault: () => void;
};

function pointer(partial: Partial<PointerLike> & { pointerId: number }): PointerLike {
  return {
    button: 0,
    pointerType: 'touch',
    clientX: 0,
    clientY: 0,
    preventDefault: () => undefined,
    ...partial
  };
}

function fakeStage(range: { value: string } | null, prevented: number[]) {
  const listeners = new Map<string, Array<(event: PointerLike) => void>>();
  const css: Record<string, string> = {};
  let captures = 0;
  let ready = false;
  return {
    css,
    get captures() {
      return captures;
    },
    get ready() {
      return ready;
    },
    style: { setProperty: (name: string, value: string) => (css[name] = value) },
    hasAttribute: (name: string) => name === 'data-then-now' && ready,
    setAttribute: (name: string) => {
      if (name === 'data-then-now') ready = true;
    },
    querySelector: () => range,
    getBoundingClientRect: () => ({ left: 0, width: 200 }),
    addEventListener: (type: string, listener: (event: PointerLike) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    setPointerCapture: () => (captures += 1),
    emit(event: PointerLike, type = 'pointerdown') {
      if (type === 'pointerdown' && event.pointerType === 'mouse' && event.button === 0) {
        const prevent = event.preventDefault;
        event.preventDefault = () => {
          prevented.push(event.pointerId);
          prevent();
        };
      }
      for (const listener of listeners.get(type) ?? []) listener(event);
    }
  };
}

test('the comparer clips the later photograph from the left of the divider', () => {
  const styles = readFileSync(new URL('assets/css/style.css', root), 'utf8');
  assert.match(styles, /clip-path:\s*inset\(0 0 0 var\(--then-now\)\);/);
  assert.match(styles, /touch-action:\s*pan-y;/);
});

test('the filming page stacks three then-and-now photographs', () => {
  const page = readFileSync(new URL('history/filming.md', root), 'utf8');
  assert.equal(page.match(/<figure class="then-now">/g)?.length, 3);
  for (const src of [
    '/images/chitty-frame1.avif',
    '/images/chitty-2026-frame1-shortDoF.avif',
    '/images/chitty-frame2.avif',
    '/images/chitty-2026-frame2-shortDoF.avif',
    '/images/chitty-frame3.avif',
    '/images/chitty-2026-frame3-shortDoF.avif'
  ]) {
    assert.match(page, new RegExp(`src="${src.replace(/\./g, '\\.')}"`));
  }
  for (const id of page.match(/aria-describedby="([^"]+)"/g) ?? []) {
    const target = id.slice('aria-describedby="'.length, -1);
    assert.match(page, new RegExp(`id="${target}"`), target);
  }
});

test('the then-and-now script loads only on pages that use the comparer', async () => {
  const liquid = new Liquid();
  liquid.registerFilter('cacheBust', (path: string) => path);
  const head = readFileSync(new URL('_includes/head.liquid', root), 'utf8');
  const base = {
    layout: 'post',
    site: { url: 'https://example.com', title: 'Test' },
    url: '/history/filming/',
    title: 'Filming',
    description: '',
    tags: [] as string[]
  };
  const withComparer = await liquid.parseAndRender(head, { ...base, content: '<figure class="then-now">' });
  assert.match(withComparer, /<script type="module" src="\/assets\/js\/then-now\.js"><\/script>/);
  const without = await liquid.parseAndRender(head, { ...base, content: '<p>No comparer here.</p>' });
  assert.doesNotMatch(without, /then-now\.js/);
});
