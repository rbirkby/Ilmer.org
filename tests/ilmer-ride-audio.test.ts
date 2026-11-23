import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVillageAudio, distanceGain, SOUND_REFERENCE } from '../assets/js/ilmer-ride-audio.js';

class Param {
  value = 0;
  targets: number[] = [];
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
  linearRampToValueAtTime() {}
  cancelScheduledValues() {}
  setTargetAtTime(value: number) {
    this.value = value;
    this.targets.push(value);
  }
}

class Node {
  stopped = false;
  type = '';
  frequency = new Param();
  Q = new Param();
  gain = new Param();
  pan = new Param();
  connect(node: Node) {
    return node;
  }
  start() {}
  stop() {
    this.stopped = true;
  }
}

function fakeAudio() {
  const sources: Node[] = [];
  const panners: Node[] = [];
  let contexts = 0;
  let resume = () => {};
  class Context {
    currentTime = 0;
    sampleRate = 100;
    state = 'running';
    destination = new Node();
    constructor() {
      contexts++;
    }
    createGain = () => new Node();
    createBiquadFilter = () => new Node();
    createStereoPanner = () => {
      const node = new Node();
      panners.push(node);
      return node;
    };
    createBufferSource = () => {
      const node = new Node();
      sources.push(node);
      return node;
    };
    createOscillator = this.createBufferSource;
    createBuffer = () => ({ getChannelData: () => new Float32Array(200) });
    resume = () => new Promise<void>((resolve) => (resume = resolve));
    suspend = () => Promise.resolve();
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { AudioContext: Context } });
  return { sources, panners, contexts: () => contexts, resume: () => resume() };
}

const listener = { position: [0, 0, 0], right: [1, 0, 0] };

test('sounds fall off with the inverse square of distance from the camera', () => {
  assert.equal(distanceGain(0, 5), 1);
  assert.equal(distanceGain(5, 5), 1);
  assert.equal(distanceGain(10, 5), 0.25);
  assert.ok(Math.abs(distanceGain(50, 5) - 0.01) < 1e-12);
  assert.throws(() => distanceGain(NaN, 5), /Invalid sound distance/);
  for (const kind of ['cart', 'duck', 'chicken', 'sheep'] as const) assert.ok(SOUND_REFERENCE[kind] > 0);
});

test('each animal group and the cart is heard from where it is, louder as the camera nears it', async () => {
  const fake = fakeAudio();
  const audio = createVillageAudio();
  try {
    const started = audio.start();
    fake.resume();
    assert.equal(await started, true);
    const emitters = [
      { id: 'ducks', kind: 'duck' as const, position: [10, 0, 0] },
      { id: 'hens', kind: 'chicken' as const, position: [-40, 0, 0] },
      { id: 'flock', kind: 'sheep' as const, position: [0, 0, 400] },
      { id: 'cart', kind: 'cart' as const, position: [0, 0, 4] }
    ];
    audio.update(listener, emitters);
    const { levels } = audio.diagnostics();
    assert.equal(levels.ducks, 0.25);
    assert.ok(Math.abs(levels.hens - (5 / 40) ** 2) < 1e-12);
    assert.ok(levels.flock < 0.001);
    assert.equal(levels.cart, 1);
    // The ducks to the right pan right, the hens to the left pan left
    assert.ok(fake.panners[0].pan.value > 0.5);
    assert.ok(fake.panners[1].pan.value < -0.5);
    // Moving closer makes the ducks louder; once the cart stops it falls silent
    audio.update({ ...listener, position: [8, 0, 0] }, emitters.slice(0, 3));
    assert.equal(audio.diagnostics().levels.ducks, 1);
    assert.equal(audio.diagnostics().levels.cart, 0);
    assert.equal(fake.contexts(), 1);
  } finally {
    audio.stop();
    Reflect.deleteProperty(globalThis, 'window');
  }
});

test('the mute button silences every sound and unmuting brings them back', async () => {
  const fake = fakeAudio();
  const audio = createVillageAudio();
  try {
    const started = audio.start();
    fake.resume();
    await started;
    audio.update(listener, [{ id: 'cart', kind: 'cart', position: [0, 0, 2] }]);
    const playing = audio.start();
    fake.resume();
    await playing;
    assert.ok(audio.isRunning());
    audio.setMuted(true);
    assert.equal(audio.isMuted(), true);
    assert.equal(audio.isRunning(), false);
    assert.equal(audio.diagnostics().sounding, false);
    assert.ok(fake.sources.every((node) => node.stopped));
    audio.setMuted(false);
    fake.resume();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(audio.isMuted(), false);
    assert.ok(audio.diagnostics().sounding);
  } finally {
    audio.stop();
    Reflect.deleteProperty(globalThis, 'window');
  }
});
