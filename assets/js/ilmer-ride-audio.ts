// Original procedural effects: no recordings or third-party audio assets.
// Village sounds come from where they happen: the horse and cart, the ducks, the hens and the sheep. Each one
// fades with the inverse square of its distance from the camera and pans towards its side of the view.

/** Distance in metres at which each kind of sound plays at full volume. */
export const SOUND_REFERENCE = { cart: 8, duck: 5, chicken: 5, sheep: 9 };

/**
 * Inverse-square loudness: full volume inside the reference distance, a quarter at twice that, and so on.
 * @param {number} distance metres from the camera
 * @param {number} reference metres at which the sound plays at full volume
 */
export function distanceGain(distance: any, reference: any) {
  if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(reference) || reference <= 0)
    throw new Error('Invalid sound distance');
  return (reference / Math.max(distance, reference)) ** 2;
}

/** Below this a sound is too faint to hear, so nothing is scheduled for it. */
const AUDIBLE = 0.0005;
const VOLUME = 0.7;
/** Balances the quieter animal calls against the noisy cart. */
const LOUDNESS = { cart: 1, duck: 2.2, chicken: 2.2, sheep: 1.8 };

/**
 * @typedef {{ id: string, kind: 'cart' | 'duck' | 'chicken' | 'sheep', position: number[] }} Emitter
 * @typedef {{ position: number[], right: number[] }} Listener
 */

export function createVillageAudio() {
  /** @type {AudioContext | undefined} */
  let context: any;
  let master: any;
  let noise: any;
  let timer: ReturnType<typeof setInterval> | undefined;
  let muted = false;
  let wanted = false;
  let steps = 0;
  let horseCalls = 0;
  const calls = { duck: 0, chicken: 0, sheep: 0 };
  /** @type {Map<string, any>} */
  const voices = new Map();
  const sources = new Set<any>();
  /** The voice's input node that the sound being built connects to. */
  let out: any;

  // Deterministic jitter so no two footfalls, quacks or bleats are identical.
  let seed = 1839;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const vary = (value: any, amount: any) => value * (1 + (random() * 2 - 1) * amount);

  function play(node: any, time: any, duration?: any) {
    sources.add(node);
    node.onended = () => sources.delete(node);
    node.start(time);
    if (duration !== undefined) node.stop(time + duration);
  }

  function envelope(time: any, duration: any, volume: any, attack = 0.012) {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    gain.connect(out);
    return gain;
  }

  function filter(type: any, frequency: any, q: any) {
    const node = context.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    return node;
  }

  function noiseBurst(time: any, duration: any, frequency: any, volume: any, type = 'bandpass', q = 0.8) {
    const node = context.createBufferSource();
    node.buffer = noise;
    node.loop = true;
    node.connect(filter(type, frequency, q)).connect(envelope(time, duration, volume, 0.015));
    play(node, time, duration);
  }

  function tone(time: any, duration: any, frequency: any, endFrequency: any, volume: any, type = 'sine') {
    const node = context.createOscillator();
    node.type = type;
    node.frequency.setValueAtTime(frequency, time);
    node.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    node.connect(envelope(time, duration, volume));
    play(node, time, duration);
  }

  /** A voiced call shaped by vocal-tract resonances (formants). */
  function voiced(time: any, duration: any, type: any, pitches: any, formants: any, gain: any) {
    const node = context.createOscillator();
    node.type = type;
    node.frequency.setValueAtTime(pitches[0], time);
    pitches.slice(1).forEach((pitch: any, i: any) => {
      node.frequency.linearRampToValueAtTime(pitch, time + (duration * (i + 1)) / (pitches.length - 1));
    });
    for (const [frequency, q, level] of formants) {
      const level_ = context.createGain();
      level_.gain.value = level;
      node
        .connect(filter('bandpass', frequency, q))
        .connect(level_)
        .connect(gain);
    }
    play(node, time, duration);
  }

  // ---- Horse and cart -------------------------------------------------------------------------------------------

  function hoof(time: any, fore: any) {
    // A shod hoof on a stony road: a sharp iron click, a hollow knock that drops in pitch, a dull thud through
    // the ground and a short scatter of grit.
    const loud = vary(fore ? 1 : 0.8, 0.15);
    noiseBurst(time, 0.025, vary(3200, 0.12), 0.16 * loud, 'bandpass', 2.5);
    tone(time, 0.075, vary(fore ? 560 : 470, 0.06), vary(fore ? 300 : 250, 0.06), 0.2 * loud, 'triangle');
    tone(time + 0.004, 0.06, vary(1150, 0.08), 700, 0.045 * loud);
    tone(time, 0.16, vary(110, 0.1), 55, 0.22 * loud);
    noiseBurst(time + 0.01, vary(0.11, 0.2), vary(2400, 0.2), 0.05 * loud, 'highpass');
  }

  function tack(time: any) {
    // Harness buckles and the hames chain: a few inharmonic metallic tinkles.
    for (const partial of [2730, 3940, 5310])
      tone(time + random() * 0.03, vary(0.22, 0.2), vary(partial, 0.03), partial * 0.985, vary(0.014, 0.3));
  }

  function creak(time: any) {
    // Dry wood rubbing on the axle and in the cart frame: a rough, wavering buzz through a narrow resonance.
    const node = context.createOscillator();
    node.type = 'sawtooth';
    const base = vary(150, 0.15);
    const duration = vary(0.45, 0.25);
    node.frequency.setValueAtTime(base, time);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, time);
    for (let i = 1; i <= 8; i++) {
      node.frequency.linearRampToValueAtTime(base * vary(1 + i * 0.05, 0.12), time + (duration * i) / 8);
      gain.gain.linearRampToValueAtTime(vary(0.03, 0.6), time + (duration * i) / 9);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    node
      .connect(filter('bandpass', vary(950, 0.15), 6))
      .connect(gain)
      .connect(out);
    play(node, time, duration);
  }

  function snort(time: any) {
    // Now and then the horse blows out through its lips: a fluttering, breathy snort.
    const duration = vary(0.7, 0.2);
    const node = context.createBufferSource();
    node.buffer = noise;
    node.loop = true;
    const shape = filter('bandpass', vary(900, 0.1), 1.2);
    shape.frequency.setValueAtTime(vary(900, 0.1), time);
    shape.frequency.exponentialRampToValueAtTime(380, time + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, time);
    const flutter = 26;
    for (let i = 0; i < duration * flutter; i++) {
      const fade = 1 - i / (duration * flutter);
      gain.gain.linearRampToValueAtTime(0.2 * fade + 0.01, time + i / flutter + 0.012);
      gain.gain.linearRampToValueAtTime(0.04 * fade + 0.005, time + i / flutter + 0.032);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration + 0.05);
    node.connect(shape).connect(gain).connect(out);
    play(node, time, duration + 0.05);
    horseCalls++;
  }

  function startWheels(voice: any, time: any) {
    // Iron-tyred wheels grinding over the stony road: a low rumble and a fine, continuous gravel hiss.
    voice.wheels = [
      ['lowpass', 160, 0.16],
      ['bandpass', 2600, 0.025]
    ].map(([type, frequency, volume]) => {
      const node = context.createBufferSource();
      node.buffer = noise;
      node.loop = true;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.exponentialRampToValueAtTime(volume, time + 0.8);
      node
        .connect(filter(type, frequency, 0.7))
        .connect(gain)
        .connect(voice.input);
      play(node, time);
      return { node, gain, volume };
    });
  }

  // A walk is four even beats: left hind, left fore, right hind, right fore.
  const WALK_BEATS = [false, true, false, true];
  const WALK_GAPS = [0.28, 0.3, 0.28, 0.3];

  function cart(voice: any, now: any) {
    if (!voice.wheels) startWheels(voice, now);
    voice.nextHoof = Math.max(voice.nextHoof ?? 0, now + 0.015);
    while (voice.nextHoof < now + 0.25) {
      const beat = steps % WALK_BEATS.length;
      hoof(voice.nextHoof, WALK_BEATS[beat]);
      if (beat % 2 === 1 && random() < 0.55) tack(voice.nextHoof + 0.02);
      steps++;
      voice.nextHoof += vary(WALK_GAPS[beat], 0.06);
    }
    voice.nextCreak ??= now + 0.6;
    if (voice.nextCreak < now + 0.25) {
      creak(Math.max(voice.nextCreak, now + 0.02));
      voice.nextCreak = Math.max(voice.nextCreak, now) + vary(2.2, 0.45);
    }
    // The wheels rise and fall as they drop into ruts and ride over stones.
    for (const { gain, volume } of voice.wheels) gain.gain.linearRampToValueAtTime(vary(volume, 0.35), now + 0.25);
    voice.nextCall ??= now + 3;
    if (voice.nextCall < now + 0.25) {
      snort(Math.max(voice.nextCall, now + 0.02));
      voice.nextCall = now + vary(14, 0.3);
    }
  }

  // ---- Farm animals ------------------------------------------------------------------------------------------------

  function quacks(time: any) {
    // A run of two to five nasal quacks, each a little lower and softer than the last.
    const count = 2 + Math.floor(random() * 4);
    let at = time;
    for (let i = 0; i < count; i++) {
      const pitch = vary(430, 0.08) * (1 - i * 0.04);
      const duration = vary(0.15, 0.2);
      const gain = envelope(at, duration, 0.3 * (1 - i * 0.12), 0.01);
      voiced(
        at,
        duration,
        'sawtooth',
        [pitch, pitch * 0.82, pitch * 0.7],
        [
          [1050, 4, 1],
          [2350, 6, 0.7]
        ],
        gain
      );
      at += vary(0.2, 0.2);
    }
    calls.duck++;
  }

  function clucks(time: any) {
    // A hen's contented muttering: short throaty "bok"s, and sometimes a rising "ba-gawk".
    const count = 3 + Math.floor(random() * 5);
    let at = time;
    for (let i = 0; i < count; i++) {
      const pitch = vary(520, 0.1);
      const gain = envelope(at, 0.08, vary(0.22, 0.2), 0.006);
      voiced(at, 0.08, 'triangle', [pitch, pitch * 0.72], [[900, 3, 1.2]], gain);
      noiseBurst(at, 0.02, 1800, 0.03);
      at += vary(0.24, 0.35);
    }
    if (random() < 0.25) {
      const duration = vary(0.42, 0.15);
      const gain = envelope(at + 0.1, duration, 0.18, 0.03);
      voiced(
        at + 0.1,
        duration,
        'sawtooth',
        [vary(620, 0.08), 980, 860, 700],
        [
          [1300, 2, 1],
          [2600, 4, 0.5]
        ],
        gain
      );
    }
    calls.chicken++;
  }

  function bleat(time: any) {
    // A sheep's wavering "baa": a buzzy voice with a fast tremble through two mouth resonances. Lambs are higher.
    const lamb = random() < 0.3;
    const base = vary(lamb ? 380 : 210, 0.12);
    const duration = vary(lamb ? 0.6 : 0.9, 0.2);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.16, time + 0.06);
    const tremble = vary(7, 0.15);
    for (let i = 1; i < duration * tremble; i++) {
      gain.gain.linearRampToValueAtTime(0.2, time + (i - 0.5) / tremble);
      gain.gain.linearRampToValueAtTime(0.08, time + i / tremble);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    gain.connect(out);
    voiced(
      time,
      duration,
      'sawtooth',
      [base, base * 1.08, base, base * 0.9],
      [
        [lamb ? 900 : 650, 3, 1],
        [lamb ? 1700 : 1250, 4, 0.6]
      ],
      gain
    );
    calls.sheep++;
  }

  const CALLS = {
    duck: { call: quacks, every: 3.5 },
    chicken: { call: clucks, every: 2.5 },
    sheep: { call: bleat, every: 5 }
  };

  // ---- Mixing ----------------------------------------------------------------------------------------------------------

  function createVoice(id: any, kind: any) {
    const input = context.createGain();
    input.gain.value = 0;
    const panner = context.createStereoPanner?.();
    if (panner) input.connect(panner).connect(master);
    else input.connect(master);
    const voice = { id, kind, input, panner, level: 0, pan: 0 };
    voices.set(id, voice);
    return voice;
  }

  function stopWheels(voice: any) {
    for (const { node } of voice.wheels ?? []) node.stop(context.currentTime + 0.05);
    voice.wheels = undefined;
    voice.nextHoof = voice.nextCreak = undefined;
  }

  function schedule() {
    if (!context || muted || context.state !== 'running') return;
    const now = context.currentTime;
    for (const voice of voices.values()) {
      if (voice.level < AUDIBLE) {
        if (voice.wheels) stopWheels(voice);
        continue;
      }
      out = voice.input;
      if (voice.kind === 'cart') cart(voice, now);
      else {
        const { call, every } = (CALLS as Record<string, any>)[voice.kind];
        // Herds start at different moments so they do not all call together.
        voice.nextCall ??= now + random() * every;
        if (voice.nextCall < now + 0.25) {
          call(Math.max(voice.nextCall, now + 0.02));
          voice.nextCall = now + vary(every, 0.6);
        }
      }
    }
  }

  /**
   * Set each sound's loudness and direction from where the camera is.
   * @param {Listener} listener camera position and its rightward direction
   * @param {Emitter[]} emitters
   */
  function update(listener: any, emitters: any) {
    const present = new Set();
    for (const { id, kind, position } of emitters) {
      present.add(id);
      const dx = position[0] - listener.position[0];
      const dy = position[1] - listener.position[1];
      const dz = position[2] - listener.position[2];
      const distance = Math.hypot(dx, dy, dz);
      const level = distanceGain(distance, (SOUND_REFERENCE as Record<string, number>)[kind]);
      const side =
        distance > 1e-6 ? (dx * listener.right[0] + dy * listener.right[1] + dz * listener.right[2]) / distance : 0;
      if (!context) continue;
      const voice = voices.get(id) ?? createVoice(id, kind);
      voice.level = level;
      voice.pan = Math.max(-1, Math.min(1, side)) * 0.8;
    }
    if (!context) return;
    const now = context.currentTime;
    for (const voice of voices.values()) {
      if (!present.has(voice.id)) voice.level = 0;
      voice.input.gain.setTargetAtTime(voice.level * (LOUDNESS as Record<string, number>)[voice.kind], now, 0.08);
      voice.panner?.pan.setTargetAtTime(voice.pan, now, 0.08);
    }
  }

  function setMasterLevel() {
    if (!context) return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(muted ? 0.0001 : VOLUME, context.currentTime, muted ? 0.05 : 0.2);
  }

  /** Start sound if the browser allows it yet; resolves true once it is playing. */
  async function start() {
    wanted = true;
    if (muted) return false;
    if (!context) {
      context = new window.AudioContext();
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = random() * 2 - 1;
    }
    try {
      await context.resume();
    } catch {
      return false;
    }
    if (!wanted || muted || context.state !== 'running') return false;
    setMasterLevel();
    if (!timer) {
      schedule();
      timer = setInterval(schedule, 100);
    }
    return true;
  }

  function silence() {
    clearInterval(timer);
    timer = undefined;
    if (!context) return;
    for (const voice of voices.values()) voice.wheels = voice.nextHoof = voice.nextCreak = voice.nextCall = undefined;
    for (const node of sources) node.stop(context.currentTime + 0.07);
    sources.clear();
  }

  return {
    start,
    update,
    /** @param {boolean} value */
    setMuted(value: any) {
      muted = Boolean(value);
      setMasterLevel();
      if (muted) silence();
      else if (wanted) void start();
    },
    isMuted: () => muted,
    isRunning: () => context?.state === 'running' && !muted,
    /** Hide or show the page: sound pauses while nobody can see the village. */
    setHidden(hidden: any) {
      if (!context) return;
      if (hidden) {
        silence();
        void context.suspend?.();
      } else if (wanted && !muted) void start();
    },
    stop() {
      wanted = false;
      silence();
      if (context) master.gain.setTargetAtTime(0, context.currentTime, 0.015);
    },
    diagnostics: () => ({
      state: context?.state ?? 'uninitialized',
      muted,
      sounding: !!timer,
      steps,
      horseCalls,
      calls: { ...calls },
      levels: Object.fromEntries([...voices.values()].map((voice) => [voice.id, voice.level]))
    })
  };
}
