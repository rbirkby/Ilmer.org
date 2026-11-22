// Original procedural English parish pipe-organ voluntary (Web Audio API, no third-party audio assets)
import { computeChurchAcoustics } from '/assets/js/st-peters-3d/dimensions.js';

// Convert MIDI note number to Hz
function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Stately, contemplative 16-bar Anglican parish organ voluntary in G major (pedal, inner voices, singing melody)
const VOLUNTARY_PHRASES = [
  {
    beats: 4,
    pedal: 43,
    chord: [55, 59, 62],
    melody: [
      [0, 2, 67],
      [2, 2, 71]
    ]
  }, // G
  {
    beats: 4,
    pedal: 40,
    chord: [52, 55, 59],
    melody: [
      [0, 3, 74],
      [3, 1, 72]
    ]
  }, // Em
  {
    beats: 4,
    pedal: 48,
    chord: [55, 60, 64],
    melody: [
      [0, 2, 71],
      [2, 2, 69]
    ]
  }, // C
  {
    beats: 4,
    pedal: 50,
    chord: [54, 57, 62],
    melody: [
      [0, 2, 69],
      [2, 2, 66]
    ]
  }, // D
  {
    beats: 4,
    pedal: 43,
    chord: [55, 59, 62],
    melody: [
      [0, 2, 67],
      [2, 2, 74]
    ]
  }, // G
  {
    beats: 4,
    pedal: 47,
    chord: [54, 59, 62],
    melody: [
      [0, 2, 76],
      [2, 2, 74]
    ]
  }, // Bm
  {
    beats: 4,
    pedal: 48,
    chord: [55, 60, 64],
    melody: [
      [0, 2, 72],
      [2, 2, 71]
    ]
  }, // C
  { beats: 4, pedal: 50, chord: [57, 60, 62], melody: [[0, 4, 69]] }, // D7
  {
    beats: 4,
    pedal: 40,
    chord: [55, 59, 64],
    melody: [
      [0, 2, 71],
      [2, 2, 72]
    ]
  }, // Em
  {
    beats: 4,
    pedal: 48,
    chord: [55, 59, 64],
    melody: [
      [0, 2, 74],
      [2, 2, 71]
    ]
  }, // Cmaj7
  {
    beats: 4,
    pedal: 45,
    chord: [55, 60, 64],
    melody: [
      [0, 2, 69],
      [2, 2, 67]
    ]
  }, // Am7
  {
    beats: 4,
    pedal: 50,
    chord: [54, 57, 62],
    melody: [
      [0, 2, 66],
      [2, 2, 69]
    ]
  }, // D
  {
    beats: 4,
    pedal: 43,
    chord: [55, 59, 62],
    melody: [
      [0, 2, 71],
      [2, 2, 67]
    ]
  }, // G
  {
    beats: 4,
    pedal: 48,
    chord: [55, 60, 64],
    melody: [
      [0, 2, 69],
      [2, 2, 71]
    ]
  }, // C
  {
    beats: 4,
    pedal: 50,
    chord: [55, 57, 62],
    melody: [
      [0, 2, 69],
      [2, 2, 66]
    ]
  }, // Dsus4 -> D
  { beats: 4, pedal: 43, chord: [55, 59, 62], melody: [[0, 4, 67]] } // G (cadence)
];

export function createChurchAudio() {
  let context = null;
  let muffleFilter = null;
  let reverbWet = null;
  let reverbDry = null;
  let masterGain = null;
  let organBus = null;
  let timer = null;
  let muted = false;
  let started = false;
  let phraseIdx = 0;
  let nextBarTime = 0;
  let targetGain = 0.075;
  let targetCutoff = 680;
  const activeNodes = new Set();
  // Notes scheduled on the audio clock, so the organ console can show what is sounding: { midi, start, end, pedal }
  let scheduledNotes = [];

  const BEAT_SEC = 0.92; // Slow, peaceful ~65 BPM voluntary

  function buildStoneReverbIR(ctx) {
    const duration = 2.6;
    const length = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    let seed = 1860;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed / 4294967296) * 2 - 1;
    };
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const decay = Math.pow(1 - t, 2.75);
        // Gentle one-pole lowpass so the nave reverb sounds like warm limestone, not hiss
        lp = lp * 0.78 + rand() * 0.22;
        data[i] = lp * decay;
      }
    }
    return impulse;
  }

  function startScheduler() {
    if (!started || muted || !context || context.state !== 'running') return;
    applyGainAndFilter();
    if (!timer) {
      nextBarTime = context.currentTime + 0.05;
      schedule();
      timer = window.setInterval(schedule, 300);
    }
  }

  function ensureContext() {
    if (context) return true;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    context = new AudioCtx();

    organBus = context.createGain();
    organBus.gain.value = 0.78;

    // Warm nave stone reverb parallel send
    const convolver = context.createConvolver();
    convolver.buffer = buildStoneReverbIR(context);
    reverbWet = context.createGain();
    reverbWet.gain.value = 0.52;
    reverbDry = context.createGain();
    reverbDry.gain.value = 0.68;

    // Exterior stone-wall muffling filter + master volume
    muffleFilter = context.createBiquadFilter();
    muffleFilter.type = 'lowpass';
    muffleFilter.frequency.value = targetCutoff;
    muffleFilter.Q.value = 0.55;

    masterGain = context.createGain();
    masterGain.gain.value = muted ? 0.0001 : targetGain;

    organBus.connect(reverbDry);
    organBus.connect(convolver);
    convolver.connect(reverbWet);
    reverbDry.connect(muffleFilter);
    reverbWet.connect(muffleFilter);
    muffleFilter.connect(masterGain);
    masterGain.connect(context.destination);

    // As soon as the AudioContext transitions to 'running', start scheduling bars immediately
    context.addEventListener('statechange', () => {
      if (context && context.state === 'running' && started && !muted) {
        startScheduler();
      }
    });
    return true;
  }

  // Synthesize a warm stopped-diapason pipe organ note with gentle harmonics
  function playPipeNote(freq, startTime, duration, level, { isPedal = false, isMelody = false } = {}) {
    if (!context || !organBus) return;
    const partials = isPedal
      ? [
          { mult: 1, gain: 0.72, type: 'sine' },
          { mult: 2, gain: 0.26, type: 'triangle' },
          { mult: 3, gain: 0.06, type: 'sine' }
        ]
      : isMelody
        ? [
            { mult: 1, gain: 0.56, type: 'triangle' },
            { mult: 2, gain: 0.28, type: 'sine' },
            { mult: 3, gain: 0.11, type: 'sine' },
            { mult: 4, gain: 0.05, type: 'sine' }
          ]
        : [
            { mult: 1, gain: 0.62, type: 'sine' },
            { mult: 2, gain: 0.25, type: 'triangle' },
            { mult: 3, gain: 0.08, type: 'sine' }
          ];

    const noteGain = context.createGain();
    const attack = isMelody ? 0.14 : 0.28;
    const release = 0.55;
    const stopTime = startTime + duration + release;

    noteGain.gain.setValueAtTime(0.0001, startTime);
    noteGain.gain.linearRampToValueAtTime(level, startTime + attack);
    noteGain.gain.setValueAtTime(level * 0.92, startTime + Math.max(attack + 0.05, duration - 0.08));
    noteGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
    noteGain.connect(organBus);

    for (const p of partials) {
      const osc = context.createOscillator();
      const pGain = context.createGain();
      osc.type = p.type;
      // Subtle chorusing detune (characteristic of twin rank organ pipes)
      osc.frequency.setValueAtTime(freq * p.mult, startTime);
      osc.detune.setValueAtTime((p.mult - 1) * 1.4, startTime);
      pGain.gain.value = p.gain;
      osc.connect(pGain);
      pGain.connect(noteGain);

      activeNodes.add(osc);
      osc.onended = () => activeNodes.delete(osc);
      osc.start(startTime);
      osc.stop(stopTime + 0.04);
    }
  }

  function schedule() {
    if (!started || muted || !context || context.state !== 'running') return;
    const now = context.currentTime;
    if (nextBarTime < now + 0.05) {
      nextBarTime = now + 0.08;
    }
    while (nextBarTime < now + 1.2) {
      const bar = VOLUNTARY_PHRASES[phraseIdx % VOLUNTARY_PHRASES.length];
      const barDur = bar.beats * BEAT_SEC;

      // Deep 16' pedal bass
      playPipeNote(midiToHz(bar.pedal), nextBarTime, barDur * 0.96, 0.22, { isPedal: true });
      scheduledNotes.push({ midi: bar.pedal, start: nextBarTime, end: nextBarTime + barDur * 0.96, pedal: true });

      // Warm 8' inner manual harmony
      for (const midi of bar.chord) {
        playPipeNote(midiToHz(midi), nextBarTime, barDur * 0.95, 0.11);
        scheduledNotes.push({ midi, start: nextBarTime, end: nextBarTime + barDur * 0.95, pedal: false });
      }

      // Gentle singing diapason/flute melody
      for (const [beatOff, lenBeats, midi] of bar.melody) {
        const t0 = nextBarTime + beatOff * BEAT_SEC;
        const len = lenBeats * BEAT_SEC * 0.94;
        playPipeNote(midiToHz(midi), t0, len, 0.145, {
          isMelody: true
        });
        scheduledNotes.push({ midi, start: t0, end: t0 + len, pedal: false });
      }

      nextBarTime += barDur;
      phraseIdx = (phraseIdx + 1) % VOLUNTARY_PHRASES.length;
    }
  }

  function applyGainAndFilter() {
    if (!context || !masterGain || !muffleFilter) return;
    const now = context.currentTime;
    const effectiveGain = muted ? 0.0001 : targetGain;
    masterGain.gain.setTargetAtTime(effectiveGain, now, muted ? 0.08 : 0.24);
    muffleFilter.frequency.setTargetAtTime(targetCutoff, now, 0.24);
  }

  function start() {
    if (muted) return Promise.resolve(false);
    if (!ensureContext()) return Promise.resolve(false);
    started = true;
    if (context.state === 'running') {
      startScheduler();
      return Promise.resolve(true);
    }
    // Call context.resume() synchronously inside the current call stack (required for browser gesture unlock)
    // and do not hang indefinitely if autoplay is suspended before the first user gesture.
    let resumePromise;
    try {
      resumePromise = context.resume();
    } catch {
      return Promise.resolve(false);
    }
    return Promise.race([
      Promise.resolve(resumePromise).then(
        () => {
          if (context && context.state === 'running' && started && !muted) {
            startScheduler();
            return true;
          }
          return false;
        },
        () => false
      ),
      new Promise((resolve) => {
        window.setTimeout(() => {
          if (context && context.state === 'running' && started && !muted) {
            startScheduler();
            resolve(true);
          } else {
            resolve(false);
          }
        }, 60);
      })
    ]);
  }

  // MIDI notes sounding right now, split into manual and pedal, for animating the console
  function getSoundingNotes() {
    const manual = new Set();
    const pedal = new Set();
    if (!context || muted || context.state !== 'running') return { manual, pedal };
    const now = context.currentTime;
    scheduledNotes = scheduledNotes.filter((n) => n.end > now);
    for (const n of scheduledNotes) {
      if (n.start <= now) (n.pedal ? pedal : manual).add(n.midi);
    }
    return { manual, pedal };
  }

  function setMuted(isMuted) {
    muted = Boolean(isMuted);
    if (muted) {
      scheduledNotes = [];
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (context && masterGain) {
        const now = context.currentTime;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setTargetAtTime(0.0001, now, 0.06);
      }
    } else {
      start();
    }
  }

  // Bells: their own bus straight to the speakers (they ring out of the open louvres, so the nave's stone
  // muffling doesn't apply), with a touch of the stone reverb
  let bellBus = null;
  function ensureBellBus() {
    if (bellBus || !context) return;
    bellBus = context.createGain();
    bellBus.gain.value = 1;
    const wet = context.createGain();
    wet.gain.value = 0.35;
    const conv = context.createConvolver();
    conv.buffer = buildStoneReverbIR(context);
    bellBus.connect(context.destination);
    bellBus.connect(conv);
    conv.connect(wet);
    wet.connect(context.destination);
  }

  // One blow of the clapper: a bell's partials relative to its nominal (hum, prime, tierce, quint, nominal,
  // superquint, octave nominal), each with its own decay, plus a short metallic strike transient
  const BELL_PARTIALS = [
    { ratio: 0.25, gain: 0.32, decay: 7.0 },
    { ratio: 0.5, gain: 0.42, decay: 4.5 },
    { ratio: 0.6, gain: 0.5, decay: 3.4 },
    { ratio: 0.75, gain: 0.16, decay: 2.2 },
    { ratio: 1.0, gain: 0.6, decay: 2.6 },
    { ratio: 1.5, gain: 0.22, decay: 1.2 },
    { ratio: 2.0, gain: 0.14, decay: 0.9 },
    { ratio: 2.66, gain: 0.07, decay: 0.5 }
  ];
  function playBell(nominalHz, delaySec = 0, level = 0.2) {
    if (muted || !context || context.state !== 'running') return false;
    ensureBellBus();
    const t0 = context.currentTime + Math.max(0, delaySec);
    const voice = context.createGain();
    voice.gain.value = level;
    voice.connect(bellBus);
    let stopAt = t0;
    BELL_PARTIALS.forEach((p, i) => {
      // A pair of slightly detuned oscillators per partial gives the slow beating of a real casting
      [-1, 1].forEach((side) => {
        const osc = context.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = nominalHz * p.ratio * (1 + side * 0.0012 * (i + 1));
        const g = context.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(p.gain * 0.5, t0 + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + p.decay);
        osc.connect(g);
        g.connect(voice);
        osc.start(t0);
        osc.stop(t0 + p.decay + 0.05);
        stopAt = Math.max(stopAt, t0 + p.decay + 0.05);
      });
    });
    // Clang of iron on bronze
    const len = Math.floor(context.sampleRate * 0.05);
    const buf = context.createBuffer(1, len, context.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const noise = context.createBufferSource();
    noise.buffer = buf;
    const bp = context.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = nominalHz * 3;
    bp.Q.value = 2;
    const ng = context.createGain();
    ng.gain.value = 0.25;
    noise.connect(bp);
    bp.connect(ng);
    ng.connect(voice);
    noise.start(t0);
    window.setTimeout(() => voice.disconnect(), (stopAt - context.currentTime + 0.2) * 1000);
    return true;
  }

  function updateSpatial(cameraPos, doorsOpen) {
    const acoustics = computeChurchAcoustics(cameraPos, doorsOpen);
    targetGain = acoustics.gain;
    targetCutoff = acoustics.cutoffHz;
    if (context && context.state === 'running') {
      applyGainAndFilter();
    }
  }

  return {
    start,
    setMuted,
    isMuted: () => muted,
    isRunning: () => context?.state === 'running' && !muted,
    updateSpatial,
    getSoundingNotes,
    playBell
  };
}
