// Original procedural English parish pipe-organ voluntary (Web Audio API, no third-party audio assets)
import { computeChurchAcoustics } from './dimensions.ts';

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

// Hymn tunes by their number on the hymn board. Adeste Fideles (Wade, 18th century), harmonised in G major.
// melody: [beat, beats, midi]; chords: [beat, beats, pedal, [inner voices]]
const G = [43, [55, 59, 62]];
const D = [50, [54, 57, 62]];
const C = [48, [52, 55, 60]];
const EM = [40, [52, 55, 59]];
const AM = [45, [52, 57, 60]];
const A7 = [45, [55, 57, 61]];
const D7 = [50, [54, 57, 60]];
const chordRun = (list) => list.map(([beat, beats, [pedal, inner]]) => [beat, beats, pedal, inner]);
const HYMNS = {
  59: {
    title: 'O Come, All Ye Faithful',
    beatSec: 0.6,
    // O come, all ye faithful, joyful and triumphant, O come ye, O come ye to Bethlehem; come and behold him,
    // born the King of angels: O come, let us adore him (x3), Christ the Lord
    melody: [
      [0, 1, 67],
      [1, 2, 67],
      [3, 1, 62],
      [4, 1, 67],
      [5, 2, 69],
      [7, 2, 62],
      [9, 1, 71],
      [10, 1, 69],
      [11, 1, 71],
      [12, 1, 72],
      [13, 2, 71],
      [15, 1, 69],
      [16, 1, 67],
      [17, 2, 67],
      [19, 1, 66],
      [20, 1, 64],
      [21, 1, 66],
      [22, 1, 67],
      [23, 1, 69],
      [24, 1, 71],
      [25, 2, 66],
      [27, 1.5, 64],
      [28.5, 0.5, 62],
      [29, 3, 62],
      [33, 2, 74],
      [35, 1, 72],
      [36, 1, 71],
      [37, 2, 72],
      [39, 2, 71],
      [41, 1, 69],
      [42, 1, 71],
      [43, 1, 67],
      [44, 1, 69],
      [45, 1.5, 66],
      [46.5, 0.5, 64],
      [47, 1, 62],
      [48, 1, 67],
      [49, 1, 67],
      [50, 1, 66],
      [51, 1, 67],
      [52, 1, 69],
      [53, 2, 67],
      [55, 1, 62],
      [56, 1, 71],
      [57, 1, 71],
      [58, 1, 69],
      [59, 1, 71],
      [60, 1, 72],
      [61, 2, 71],
      [63, 1, 69],
      [64, 1, 71],
      [65, 1, 72],
      [66, 1, 71],
      [67, 1, 69],
      [68, 1, 67],
      [69, 2, 66],
      [71, 1, 67],
      [72, 1, 72],
      [73, 2, 71],
      [75, 1.5, 69],
      [76.5, 0.5, 67],
      [77, 3, 67]
    ],
    chords: chordRun([
      [0, 1, G],
      [1, 4, G],
      [5, 4, D],
      [9, 1, G],
      [10, 1, D],
      [11, 1, G],
      [12, 1, AM],
      [13, 2, G],
      [15, 1, D],
      [16, 1, G],
      [17, 2, C],
      [19, 1, D],
      [20, 1, EM],
      [21, 1, D],
      [22, 1, EM],
      [23, 1, D],
      [24, 1, G],
      [25, 2, D],
      [27, 2, A7],
      [29, 3, D],
      [33, 2, G],
      [35, 1, D7],
      [36, 1, G],
      [37, 2, C],
      [39, 2, G],
      [41, 1, D],
      [42, 1, G],
      [43, 1, EM],
      [44, 1, D],
      [45, 1.5, D],
      [46.5, 0.5, A7],
      [47, 1, D],
      [48, 1, G],
      [49, 1, G],
      [50, 1, D],
      [51, 1, G],
      [52, 1, D],
      [53, 4, G],
      [57, 1, G],
      [58, 1, D],
      [59, 1, G],
      [60, 1, AM],
      [61, 2, G],
      [63, 1, D],
      [64, 1, G],
      [65, 1, C],
      [66, 1, G],
      [67, 1, D],
      [68, 1, EM],
      [69, 2, D],
      [71, 1, G],
      [72, 1, C],
      [73, 2, G],
      [75, 2, D7],
      [77, 3, G]
    ])
  }
};

export function createChurchAudio() {
  let context: any = null;
  let muffleFilter: any = null;
  let reverbWet: any = null;
  let reverbDry: any = null;
  let masterGain: any = null;
  let organBus: any = null;
  let timer: any = null;
  let muted = false;
  let started = false;
  let phraseIdx = 0;
  let nextBarTime = 0;
  let targetGain = 0.075;
  let targetCutoff = 680;
  const activeNodes = new Set();
  // Notes scheduled on the audio clock, so the organ console can show what is sounding: { midi, start, end, pedal }
  let scheduledNotes = [];
  // Note envelopes still sounding or yet to sound, so a hymn can cut the voluntary short
  const noteGains = new Set<GainNode>();
  // A hymn being played: its notes on the audio clock, in start order, and when it finishes
  let hymnEvents: any = null;
  let hymnIdx = 0;
  let hymnEnd = 0;

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

  // The nave and the bells share one impulse response
  let stoneIR: any = null;
  function stoneReverbIR() {
    stoneIR ??= buildStoneReverbIR(context);
    return stoneIR;
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
    convolver.buffer = stoneReverbIR();
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
    noteGains.add(noteGain);

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
      osc.onended = () => {
        activeNodes.delete(osc);
        noteGains.delete(noteGain);
      };
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
    if (hymnEvents) {
      while (hymnIdx < hymnEvents.length && hymnEvents[hymnIdx].start < now + 1.2) {
        const n = hymnEvents[hymnIdx++];
        playPipeNote(midiToHz(n.midi), n.start, n.end - n.start, n.level, n.opts);
        scheduledNotes.push({ midi: n.midi, start: n.start, end: n.end, pedal: Boolean(n.opts.isPedal) });
      }
      if (hymnIdx < hymnEvents.length || now < hymnEnd) return;
      // Hymn over: a short pause, then the voluntary begins again from the top
      hymnEvents = null;
      phraseIdx = 0;
      nextBarTime = now + 2.5;
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

  // Play a hymn from HYMNS, fading out whatever the organ is playing first. Returns false if there is no such hymn.
  function playHymn(number) {
    const hymn = HYMNS[number];
    if (!hymn || !context || context.state !== 'running') return false;
    const now = context.currentTime;
    for (const g of noteGains) {
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(0.0001, now, 0.12);
    }
    noteGains.clear();
    scheduledNotes = [];
    const t0 = now + 1.2;
    const beat = hymn.beatSec;
    const events = [];
    for (const [b, len, midi] of hymn.melody) {
      events.push({
        midi,
        start: t0 + b * beat,
        end: t0 + (b + len) * beat - 0.07,
        level: 0.15,
        opts: { isMelody: true }
      });
    }
    for (const [b, len, pedal, inner] of hymn.chords) {
      const start = t0 + b * beat;
      const end = t0 + (b + len) * beat - 0.05;
      events.push({ midi: pedal, start, end, level: 0.2, opts: { isPedal: true } });
      for (const midi of inner) events.push({ midi, start, end, level: 0.1, opts: {} });
    }
    events.sort((a, b) => a.start - b.start);
    hymnEvents = events;
    hymnIdx = 0;
    hymnEnd = Math.max(...events.map((e) => e.end)) + 0.6;
    schedule();
    return true;
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
      hymnEvents = null; // muting ends a hymn; unmuting returns to the voluntary
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

  // A short burst of white noise dying away quickly: the hard 'click' at the start of a struck bell or iron bar
  function noiseBurst(seconds) {
    const len = Math.floor(context.sampleRate * seconds);
    const buf = context.createBuffer(1, len, context.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const noise = context.createBufferSource();
    noise.buffer = buf;
    return noise;
  }

  // Bells: their own bus straight to the speakers (they ring out of the open louvres, so the nave's stone
  // muffling doesn't apply), with a touch of the stone reverb
  let bellBus: any = null;
  function ensureBellBus() {
    if (bellBus || !context) return;
    bellBus = context.createGain();
    bellBus.gain.value = 1;
    const wet = context.createGain();
    wet.gain.value = 0.35;
    const conv = context.createConvolver();
    conv.buffer = stoneReverbIR();
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
    const noise = noiseBurst(0.05);
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

  // A kissing gate's iron leaf striking its end-stop post: struck bar iron rings with the inharmonic modes of a
  // free bar (1 : 2.76 : 5.40 : 8.93), each a detuned pair so it shimmers, over a hard click; the leaf rattles
  // back once against the post a moment later. Out in the open air, so no stone reverb; further off it is
  // quieter and duller. distance in metres.
  const CLANG_MODES = [
    { ratio: 1, gain: 0.42, decay: 1.6 },
    { ratio: 2, gain: 0.2, decay: 1.3 }, // two extra partials (an octave and a ring between) to fill the tone out
    { ratio: 2.76, gain: 0.34, decay: 1.1 },
    { ratio: 4.1, gain: 0.16, decay: 0.85 },
    { ratio: 5.4, gain: 0.22, decay: 0.7 },
    { ratio: 8.93, gain: 0.12, decay: 0.4 }
  ];
  function strikeIron(dest, t0, baseHz, level) {
    for (const m of CLANG_MODES) {
      for (const side of [-1, 1]) {
        const osc = context.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = baseHz * m.ratio * (1 + side * 0.0025);
        const g = context.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(m.gain * level * 0.5, t0 + 0.0015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + m.decay);
        osc.connect(g);
        g.connect(dest);
        osc.start(t0);
        osc.stop(t0 + m.decay + 0.02);
      }
    }
    // The hit itself: a very short, bright burst of noise
    const noise = noiseBurst(0.012);
    const hp = context.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    const ng = context.createGain();
    ng.gain.value = 0.7 * level;
    noise.connect(hp);
    hp.connect(ng);
    ng.connect(dest);
    noise.start(t0);
  }
  // A one-second reverberant tail for the clang: decaying noise, a little darker as it dies away
  let clangReverb: any = null;
  function ensureClangReverb() {
    if (clangReverb) return clangReverb;
    const rate = context.sampleRate;
    const len = Math.floor(rate * 1.0);
    const ir = context.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        lp += (Math.random() * 2 - 1 - lp) * (0.9 - 0.6 * t); // duller towards the end
        d[i] = lp * Math.pow(1 - t, 2.2);
      }
    }
    const conv = context.createConvolver();
    conv.buffer = ir;
    const wet = context.createGain();
    wet.gain.value = 0.55;
    conv.connect(wet);
    wet.connect(context.destination);
    clangReverb = conv;
    return conv;
  }
  function playGateClang(distance = 0, level = 0.3) {
    if (muted || !context || context.state !== 'running') return false;
    const t0 = context.currentTime;
    const voice = context.createGain();
    voice.gain.value = level / (1 + (distance * distance) / 25);
    const air = context.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.value = 12000 / (1 + distance / 12);
    voice.connect(air);
    air.connect(context.destination);
    air.connect(ensureClangReverb());
    const baseHz = 260 * (1 + (Math.random() - 0.5) * 0.05); // no two knocks quite alike
    strikeIron(voice, t0, baseHz, 1);
    strikeIron(voice, t0 + 0.085 + Math.random() * 0.03, baseHz, 0.35); // the leaf rattles back against the post
    window.setTimeout(() => voice.disconnect(), 3000);
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
    playHymn,
    playBell,
    playGateClang
  };
}
