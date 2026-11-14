import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRideAudio } from '../assets/js/ilmer-ride-audio.js';

test('ride audio requires activation, always starts with the ride and cancels pending starts on exit', async () => {
  const nodes: { stopped: boolean }[] = [];
  let contexts = 0;
  let resume = () => {};
  class Node {
    stopped = false;
    frequency = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} };
    Q = { value: 0 };
    gain = {
      value: 0,
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
      linearRampToValueAtTime() {},
      cancelScheduledValues() {},
      setTargetAtTime() {}
    };
    connect(node: Node) {
      return node;
    }
    start() {}
    stop() {
      this.stopped = true;
    }
  }
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
    createBufferSource = () => {
      const node = new Node();
      nodes.push(node);
      return node;
    };
    createOscillator = this.createBufferSource;
    createBuffer = () => ({ getChannelData: () => new Float32Array(200) });
    resume = () => new Promise<void>((resolve) => (resume = resolve));
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { AudioContext: Context } });
  const audio = createRideAudio();
  try {
    assert.equal(contexts, 0);
    const firstStart = audio.start();
    resume();
    await firstStart;
    assert.ok(audio.diagnostics().sounding);
    assert.ok(audio.diagnostics().steps > 0);
    audio.stop();
    assert.equal(audio.diagnostics().sounding, false);
    assert.ok(nodes.every((node) => node.stopped));
    const pending = audio.start();
    audio.stop();
    resume();
    await pending;
    assert.equal(audio.diagnostics().sounding, false);
    assert.equal(audio.diagnostics().active, false);
    const restart = audio.start();
    resume();
    await restart;
    assert.ok(audio.diagnostics().sounding);
    assert.equal(contexts, 1);
  } finally {
    audio.stop();
    Reflect.deleteProperty(globalThis, 'window');
  }
});
