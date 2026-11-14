// Original procedural effects: no recordings or third-party audio assets.
export function createRideAudio() {
  let context;
  let output;
  let noise;
  let timer;
  let active = false;
  let nextHoof = 0;
  let nextHorse = 0;
  let steps = 0;
  let horseCalls = 0;
  const sources = new Set();

  function source(node, gain, time, duration) {
    node.connect(gain).connect(output);
    sources.add(node);
    node.onended = () => sources.delete(node);
    node.start(time);
    node.stop(time + duration);
  }

  function noiseBurst(time, duration, frequency, volume, type = 'bandpass') {
    const node = context.createBufferSource();
    node.buffer = noise;
    node.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;
    node.connect(filter);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.001, time);
    envelope.gain.exponentialRampToValueAtTime(volume, time + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    filter.connect(envelope).connect(output);
    sources.add(node);
    node.onended = () => sources.delete(node);
    node.start(time);
    node.stop(time + duration);
  }

  function tone(time, duration, frequency, endFrequency, volume, type = 'sine') {
    const node = context.createOscillator();
    node.type = type;
    node.frequency.setValueAtTime(frequency, time);
    node.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.001, time);
    envelope.gain.exponentialRampToValueAtTime(volume, time + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source(node, envelope, time, duration);
  }

  function horse(time) {
    // Breathy snorts alternate with a harmonically voiced, wavering whinny.
    noiseBurst(time, 0.65, 750, 0.14);
    noiseBurst(time + 0.16, 0.3, 1100, 0.08);
    if (horseCalls % 2 === 1) {
      for (let harmonic = 1; harmonic <= 4; harmonic++) {
        const voice = context.createOscillator();
        voice.type = 'sine';
        for (let i = 0; i <= 36; i++) {
          const t = i / 36;
          const pitch = (420 - 200 * t + 38 * Math.sin(t * Math.PI * 18)) * harmonic;
          voice.frequency.linearRampToValueAtTime(pitch, time + 0.25 + t * 1.4);
        }
        const envelope = context.createGain();
        envelope.gain.setValueAtTime(0.001, time + 0.25);
        envelope.gain.linearRampToValueAtTime(0.055 / harmonic, time + 0.4);
        envelope.gain.exponentialRampToValueAtTime(0.001, time + 1.65);
        source(voice, envelope, time + 0.25, 1.4);
      }
    }
    horseCalls++;
  }

  function schedule() {
    if (!active || context.state !== 'running') return;
    const now = context.currentTime;
    nextHoof = Math.max(nextHoof, now + 0.015);
    while (nextHoof < now + 0.25) {
      const time = nextHoof;
      tone(time, 0.1, steps % 2 ? 185 : 145, 75, 0.22, 'triangle');
      noiseBurst(time, 0.065, 1800, 0.12);
      noiseBurst(time, 0.38, 180, 0.1, 'lowpass');
      if (steps % 4 === 0) tone(time, 0.35, 510, 340, 0.018, 'triangle');
      steps++;
      nextHoof += steps % 2 ? 0.27 : 0.34;
    }
    if (nextHorse < now + 0.25) {
      horse(Math.max(nextHorse, now + 0.02));
      nextHorse = now + 10 + (horseCalls % 3) * 2;
    }
  }

  function silence() {
    clearInterval(timer);
    timer = undefined;
    if (!context) return;
    output.gain.cancelScheduledValues(context.currentTime);
    output.gain.setTargetAtTime(0, context.currentTime, 0.015);
    for (const node of sources) node.stop(context.currentTime + 0.07);
    sources.clear();
  }

  async function start() {
    active = true;
    if (!context) {
      context = new window.AudioContext();
      output = context.createGain();
      output.gain.value = 0;
      output.connect(context.destination);
      noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const samples = noise.getChannelData(0);
      let seed = 1839;
      for (let i = 0; i < samples.length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        samples[i] = (seed / 0xffffffff) * 2 - 1;
      }
    }
    await context.resume();
    if (!active || timer) return;
    output.gain.cancelScheduledValues(context.currentTime);
    output.gain.setTargetAtTime(0.65, context.currentTime, 0.04);
    nextHoof = context.currentTime + 0.03;
    nextHorse = context.currentTime + 2;
    schedule();
    timer = setInterval(schedule, 100);
  }

  return {
    start,
    stop() {
      active = false;
      silence();
    },
    diagnostics: () => ({
      active,
      state: context?.state ?? 'uninitialized',
      sounding: !!timer,
      steps,
      horseCalls
    })
  };
}
