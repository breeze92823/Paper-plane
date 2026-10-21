// Sound effects, synthesized live with the Web Audio API: no sample files, and nothing
// that beeps. Each sound is modelled on the real thing that makes it:
//  - paper and air (throws, landings, crinkles, page flips, whooshes) are filtered noise
//    with swept filters and shaped envelopes;
//  - struck objects (coins, latches, wood, egg shell, marimba and glockenspiel bars, the
//    register bell) are modal: a few sine partials at the object's own inharmonic ratios,
//    each ringing down at its own rate, over a short noise strike;
//  - everything shares a small room reverb and a gentle compressor, so it sits together.
// Tuned notes all come from C major pentatonic, so overlapping chimes never clash.
//
// The browser only allows audio after a user gesture: initSfx() listens for the first
// one. Every sound before then is silently skipped. Each sfx.* call returns a handle
// whose stop() fades that sound out (the egg shake uses it when a hatch is skipped).

const VOLUME = 0.8

// { ctx, dry, wet, noise } of the graph sounds are built into: the live one, or an
// offline one while renderOffline() runs.
let A = null
let live = null
let G = null // { dry, wet }: the group the sound being built plays into
let lastGesture = -1e9

const rand = (a = 0, b = 1) => a + Math.random() * (b - a)
const vary = (amt) => 1 + rand(-amt, amt) // a random detune factor, so repeats never sound identical
const pick = (list) => list[Math.floor(Math.random() * list.length)]
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)

// C major pentatonic, as MIDI notes.
const N = { C5: 72, D5: 74, E5: 76, G5: 79, A5: 81, C6: 84, D6: 86, E6: 88, G6: 91, A6: 93, C7: 96, D7: 98, E7: 100, G7: 103, A7: 105 }
const SPARKLE = [N.C7, N.D7, N.E7, N.G7, N.A7]

// --- Graph -----------------------------------------------------------------------------
// A stereo room: pre-delay, then noise decaying exponentially, darkening as it fades
// (highs die first, like a real room).
function impulse(ctx, seconds, decay) {
  const rate = ctx.sampleRate
  const len = Math.floor(rate * seconds)
  const pre = Math.floor(rate * 0.012)
  const buf = ctx.createBuffer(2, len, rate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let y = 0
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / (len - pre)
      const k = 0.9 - 0.75 * t // one-pole lowpass coefficient, closing over the tail
      y += k * (Math.random() * 2 - 1 - y)
      d[i] = y * Math.pow(1 - t, decay)
    }
  }
  return buf
}

function noiseBuffer(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function build(ctx, destination) {
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.knee.value = 12
  comp.ratio.value = 3.5
  comp.attack.value = 0.003
  comp.release.value = 0.2
  const master = ctx.createGain()
  master.gain.value = VOLUME
  comp.connect(master)
  master.connect(destination)

  const dry = ctx.createGain()
  dry.connect(comp)
  const verb = ctx.createConvolver()
  verb.buffer = impulse(ctx, 1.8, 3.2)
  const wet = ctx.createGain()
  const wetOut = ctx.createGain()
  wetOut.gain.value = 0.5
  wet.connect(verb)
  verb.connect(wetOut)
  wetOut.connect(comp)
  return { ctx, dry, wet, master, noise: noiseBuffer(ctx) }
}

// Starts listening for the first gesture, which creates (or wakes) the audio context.
export function initSfx() {
  const wake = () => {
    lastGesture = performance.now()
    if (!live) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      try {
        const ctx = new AC({ latencyHint: 'interactive' })
        live = build(ctx, ctx.destination)
      } catch {
        return
      }
    }
    if (live.ctx.state !== 'running') live.ctx.resume().catch(() => {})
  }
  for (const type of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(type, wake, { capture: true, passive: true })
}

// Running, or woken by a gesture a moment ago (resume() is async: the first click still sounds).
const ready = () => !!live && (live.ctx.state === 'running' || performance.now() - lastGesture < 300)

// --- Voices ----------------------------------------------------------------------------
// Rises over `attack`, then rings down to ~2% over `decay`.
function env(param, t, peak, attack, decay) {
  param.setValueAtTime(0, t)
  param.linearRampToValueAtTime(peak, t + attack)
  param.setTargetAtTime(0, t + attack, decay / 4)
}

// Into the current group: panned, with a reverb send of `verb`.
function route(node, pan = 0, verb = 0.1) {
  const ctx = A.ctx
  const p = ctx.createStereoPanner()
  p.pan.value = clamp(pan, -1, 1)
  node.connect(p)
  p.connect(G.dry)
  if (verb > 0) {
    const s = ctx.createGain()
    s.gain.value = verb
    p.connect(s)
    s.connect(G.wet)
  }
}

// Filtered noise: `freq` (swept to `to`), `q`; `attack` s up, then down over the rest of `dur`.
function noise(t, { dur, gain, attack = 0.002, type = 'bandpass', freq = 1000, to = null, q = 1, pan = 0, verb = 0.1 }) {
  const ctx = A.ctx
  const src = ctx.createBufferSource()
  src.buffer = A.noise
  const f = ctx.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(freq, t)
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = ctx.createGain()
  env(g.gain, t, gain, attack, Math.max(0.005, dur - attack))
  src.connect(f)
  f.connect(g)
  route(g, pan, verb)
  src.start(t, rand(0, 1.5))
  src.stop(t + dur + 0.05)
}

// A whoosh: band-passed air swelling over `rise` of its length, the band swept from -> to.
function whoosh(t, dur, from, to, gain, { q = 1.2, rise = 0.35, pan = 0, verb = 0.12 } = {}) {
  const ctx = A.ctx
  const src = ctx.createBufferSource()
  src.buffer = A.noise
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = q
  f.frequency.setValueAtTime(from, t)
  f.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + dur * rise)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f)
  f.connect(g)
  route(g, pan, verb)
  src.start(t, rand(0, 1.5))
  src.stop(t + dur + 0.05)
}

// One sine partial ringing down; `to` glides the pitch over `glide` s.
function partial(t, freq, { gain, attack = 0.002, decay, to = null, glide = decay, pan = 0, verb = 0.1 }) {
  const ctx = A.ctx
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(freq, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + glide)
  const g = ctx.createGain()
  env(g.gain, t, gain, attack, decay)
  o.connect(g)
  route(g, pan, verb)
  o.start(t)
  o.stop(t + attack + decay * 1.3 + 0.02)
}

// A struck object: partials [ratio, amp, decay s] over a noise strike `hit` (0 = none).
function modal(t, f0, partials, { gain, hit = 0.4, hitFreq = f0 * 3, pan = 0, verb = 0.1 }) {
  for (const [ratio, amp, decay] of partials) {
    const f = f0 * ratio
    if (f < 20000) partial(t, f, { gain: gain * amp, decay, pan, verb })
  }
  if (hit) noise(t, { dur: 0.006, gain: gain * hit, type: 'bandpass', freq: Math.min(12000, hitFreq), q: 0.8, pan, verb: verb * 0.5 })
}

// The instruments and objects, from their partials.
const WOOD = [[1, 1, 0.05], [2.57, 0.4, 0.025], [4.9, 0.15, 0.012]]
const MARIMBA = [[1, 1, 0.55], [3.93, 0.22, 0.14], [9.2, 0.05, 0.04]]
const GLOCK = [[1, 1, 1.1], [2.76, 0.32, 0.45], [5.4, 0.13, 0.22], [8.93, 0.05, 0.11]]
const SHELL = [[1, 1, 0.06], [2.3, 0.5, 0.03], [3.9, 0.25, 0.015]]
const LATCH = [[1, 1, 0.03], [2.3, 0.5, 0.02], [3.7, 0.3, 0.012]]
const BELL = [[0.5, 0.25, 1.4], [1, 1, 1.2], [1.19, 0.4, 0.9], [1.56, 0.25, 0.7], [2, 0.35, 0.6], [2.51, 0.15, 0.4], [3.01, 0.08, 0.3]]
const GLASS = [[1, 1, 0.35], [2.32, 0.4, 0.16], [4.25, 0.2, 0.08]]

const wood = (t, f, gain, o = {}) => modal(t, f, WOOD, { gain, hit: 0.5, verb: 0.05, ...o })
const marimba = (t, m, gain, o = {}) => modal(t, mtof(m), MARIMBA, { gain, hit: 0.15, hitFreq: 2500, verb: 0.2, ...o })
const glock = (t, m, gain, o = {}) => modal(t, mtof(m), GLOCK, { gain, hit: 0.25, hitFreq: 7000, verb: 0.3, ...o })
const shell = (t, f, gain, o = {}) => modal(t, f, SHELL, { gain, hit: 0.6, verb: 0.08, ...o })
const latch = (t, f, gain, o = {}) => modal(t, f, LATCH, { gain, hit: 1.2, hitFreq: 4800, verb: 0.05, ...o })

// A coin: a thin metal disc's inharmonic ring, a little different every time.
function coin(t, gain, pan = 0) {
  const f0 = rand(2600, 3800)
  const j = () => vary(0.03)
  modal(t, f0, [[1, 1, 0.35], [1.47 * j(), 0.6, 0.26], [2.09 * j(), 0.45, 0.18], [2.56 * j(), 0.3, 0.12], [3.39 * j(), 0.2, 0.08]], { gain, hit: 0.8, hitFreq: 7500, pan, verb: 0.18 })
}

// A low body hit: a sine dropping in pitch (a soft kick), for thuds and impacts.
const thump = (t, from, to, dur, gain, o = {}) => partial(t, from, { gain, decay: dur, to, glide: dur * 0.6, verb: 0.05, ...o })

// Crumpling paper: tiny clicks of noise at random pitches and moments.
function crinkle(t, dur, count, gain, pan = 0) {
  for (let i = 0; i < count; i++) {
    noise(t + rand(0, dur), { dur: rand(0.006, 0.018), gain: gain * rand(0.5, 1), freq: rand(2000, 7000), q: rand(1.5, 3.5), pan: pan + rand(-0.15, 0.15), verb: 0.04 })
  }
}

// High glockenspiel notes scattered over `dur`: a magic shimmer.
function shimmer(t, dur, count, gain) {
  for (let i = 0; i < count; i++) glock(t + (dur * i) / count + rand(0, 0.03), pick(SPARKLE), gain * rand(0.6, 1), { pan: rand(-0.6, 0.6), verb: 0.45 })
}

// A bubble: a sine whose pitch rises as it rings out (how a real bubble pops at the surface).
const bubble = (t, f, gain, pan = 0) => partial(t, f, { gain, decay: rand(0.04, 0.08), to: f * rand(1.8, 2.6), glide: 0.06, pan, verb: 0.15 })

// --- Playing ---------------------------------------------------------------------------
const NOOP = { stop() {} }
const lastPlayed = {}

// Builds sound `name` into its own group, unless it played under `gap` s ago.
function play(name, gap, fn) {
  if (!ready()) return NOOP
  // Wall-clock, not ctx.currentTime: that stands still while the context is still resuming.
  const wall = performance.now() / 1000
  if (wall - (lastPlayed[name] ?? -1e9) < gap) return NOOP
  lastPlayed[name] = wall
  A = live
  const handle = group(LEVEL[name] ?? 1)
  fn(live.ctx.currentTime + 0.005)
  G = null
  return handle
}

function group(level = 1) {
  const ctx = A.ctx
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  dry.gain.value = wet.gain.value = level
  dry.connect(A.dry)
  wet.connect(A.wet)
  G = { dry, wet }
  return {
    stop() {
      const t = ctx.currentTime
      for (const g of [dry, wet]) {
        g.gain.cancelScheduledValues(t)
        g.gain.setValueAtTime(g.gain.value, t)
        g.gain.linearRampToValueAtTime(0, t + 0.06)
      }
    },
  }
}

// --- The sounds ------------------------------------------------------------------------
const SOUNDS = {
  // A HUD button pressed: a short woody "tock" with a little body under it.
  click(t) {
    const k = vary(0.04)
    wood(t, 520 * k, 0.2)
    thump(t, 190 * k, 120, 0.035, 0.07)
  },
  // A card or pet picked in a grid: a lighter, higher tock.
  select(t) {
    wood(t, 860 * vary(0.04), 0.13)
  },
  // A tab: a page of paper turned over, landing.
  tab(t) {
    noise(t, { dur: 0.18, attack: 0.05, freq: 2600, to: 1100, q: 0.7, gain: 0.2, verb: 0.06 })
    noise(t + 0.13, { dur: 0.035, freq: 1700, q: 1, gain: 0.1, verb: 0.04 })
  },
  // A window opening: a rising swoosh and two soft marimba notes up.
  open(t) {
    whoosh(t, 0.3, 380, 2400, 0.22, { q: 1.1, rise: 0.55 })
    marimba(t + 0.1, N.G5, 0.1)
    marimba(t + 0.17, N.C6, 0.12)
  },
  // A window closing: the swoosh falling away and one soft note down.
  close(t) {
    whoosh(t, 0.24, 2200, 420, 0.18, { q: 1.1, rise: 0.3 })
    marimba(t + 0.05, N.E5, 0.08)
    thump(t + 0.05, 160, 100, 0.06, 0.06)
  },
  // Auto Throw switched: a two-stage toggle switch, and a note up (on) or down (off).
  toggleOn(t) {
    latch(t, 1500, 0.1)
    wood(t + 0.045, 980, 0.12)
    marimba(t + 0.06, N.C6, 0.08)
    marimba(t + 0.12, N.G6, 0.08)
  },
  toggleOff(t) {
    latch(t, 1300, 0.1)
    wood(t + 0.045, 640, 0.12)
    marimba(t + 0.06, N.G5, 0.07)
    marimba(t + 0.12, N.C5, 0.07)
  },
  // Equipped: a metal latch clicking home, then a bright rising pair of notes.
  equip(t) {
    latch(t, 2100, 0.12)
    latch(t + 0.055, 1600, 0.1)
    thump(t + 0.055, 230, 120, 0.06, 0.1)
    marimba(t + 0.08, N.C6, 0.11)
    marimba(t + 0.15, N.G6, 0.12)
    glock(t + 0.15, N.C7, 0.04)
  },
  // Unequipped: the latch opening, two notes down.
  unequip(t) {
    latch(t, 1700, 0.1)
    marimba(t + 0.05, N.G5, 0.09)
    marimba(t + 0.13, N.E5, 0.08)
  },
  // Bought: coins tumbling into the till as the drawer clacks shut, then the register bell.
  buy(t) {
    noise(t, { dur: 0.05, freq: 1800, q: 0.7, gain: 0.14, verb: 0.05 })
    thump(t, 160, 85, 0.09, 0.13)
    ;[0, 0.06, 0.11, 0.155, 0.195, 0.23].forEach((d, i) => coin(t + 0.02 + d + rand(0, 0.012), 0.15 * (1 - i * 0.11), rand(-0.35, 0.35)))
    modal(t + 0.27, 1975, BELL, { gain: 0.12, hit: 0.3, hitFreq: 6000, verb: 0.3 })
    glock(t + 0.3, N.E7, 0.035)
  },
  // Not enough / locked: two low wooden knocks, the second lower. A "nope", not a buzzer.
  denied(t) {
    wood(t, 310, 0.2)
    thump(t, 120, 80, 0.07, 0.08)
    wood(t + 0.11, 245, 0.18)
  },
  // Wins paid on landing: a short trickle of coins.
  coins(t, n = 3) {
    for (let i = 0; i < n; i++) coin(t + i * 0.065 + rand(0, 0.015), 0.11 * (1 - i * 0.12), rand(-0.3, 0.3))
  },
  // The arm winding up for the toss: a low cloth swish.
  throwSwing(t) {
    whoosh(t, 0.22, 260, 720, 0.1, { q: 0.7, rise: 0.6, verb: 0.02 })
  },
  // The dart leaving the hand: a crisp paper flick, then the plane cutting the air, its
  // pitch dropping as it flies off.
  throwRelease(t) {
    const k = vary(0.08)
    const pan = rand(-0.15, 0.15)
    noise(t, { dur: 0.02, type: 'highpass', freq: 3000, gain: 0.16, pan, verb: 0 })
    noise(t + 0.003, { dur: 0.03, freq: 1400 * k, q: 1.2, gain: 0.1, pan })
    whoosh(t, 0.55, 1700 * k, 520 * k, 0.3, { q: 1.4, rise: 0.12, pan, verb: 0.08 })
    whoosh(t, 0.4, 5200 * k, 2200 * k, 0.09, { q: 0.9, rise: 0.1, pan: pan * 2, verb: 0.05 })
  },
  // A new plane folding into the hand: a soft paper crinkle and a fold.
  reload(t) {
    crinkle(t, 0.15, 6, 0.06, 0.2)
    noise(t + 0.12, { dur: 0.03, freq: 900, q: 0.8, gain: 0.05, pan: 0.2, verb: 0.03 })
  },
  // A plane touching down: a paper tap, then a short scuff as it slides.
  land(t, vol = 1, pan = 0) {
    if (vol < 0.02) return
    noise(t, { dur: 0.025, freq: 1100, q: 0.8, gain: 0.2 * vol, pan })
    noise(t + 0.01, { dur: 0.28, attack: 0.02, freq: 2600, to: 1400, q: 0.9, gain: 0.07 * vol, pan })
    crinkle(t, 0.08, 3, 0.04 * vol, pan)
  },
  // A plane into a wall or a roof: a papery bump.
  bump(t, vol = 1, pan = 0) {
    if (vol < 0.02) return
    noise(t, { dur: 0.035, freq: 900, q: 0.9, gain: 0.2 * vol, pan })
    thump(t, 210, 120, 0.04, 0.05 * vol, { pan })
    crinkle(t, 0.05, 3, 0.05 * vol, pan)
  },
  // A training-pad hit: the paper smacking the prize, its thud, and a tiny sparkle for the Power.
  padHit(t) {
    noise(t, { dur: 0.03, freq: 1600, q: 0.7, gain: 0.26 })
    thump(t, 170, 75, 0.12, 0.2)
    crinkle(t + 0.01, 0.12, 5, 0.07)
    glock(t + 0.04, pick(SPARKLE), 0.03)
  },
  // A chased plane flying into a new zone; `first` is the first time ever.
  zone(t, first = false) {
    whoosh(t, 0.35, 600, 1800, 0.08, { q: 0.9, rise: 0.5 })
    const notes = first ? [N.C6, N.E6, N.G6, N.C7] : [N.G6, N.C7]
    notes.forEach((m, i) => glock(t + 0.05 + i * 0.07, m, first ? 0.08 : 0.06))
  },
  // The longest throw yet: a rising glockenspiel run over a marimba root, and a shimmer.
  newBest(t) {
    marimba(t, N.C5, 0.12)
    ;[N.C6, N.E6, N.G6, N.C7, N.E7].forEach((m, i) => glock(t + i * 0.065, m, 0.08))
    shimmer(t + 0.35, 0.6, 7, 0.025)
  },
  levelUp(t) {
    ;[N.G5, N.C6, N.E6].forEach((m, i) => marimba(t + i * 0.06, m, 0.1))
    glock(t + 0.13, N.G6, 0.05)
  },
  // A tutorial step done, and the whole tutorial done.
  questStep(t) {
    marimba(t, N.D6, 0.11)
    marimba(t + 0.1, N.G6, 0.12)
    glock(t + 0.1, N.D7, 0.04)
  },
  questDone(t) {
    ;[N.C6, N.E6, N.G6, N.C7].forEach((m, i) => {
      marimba(t + i * 0.08, m, 0.11)
      glock(t + i * 0.08, m + 12, 0.04)
    })
    modal(t + 0.32, mtof(N.C6), BELL, { gain: 0.08, hit: 0.2, verb: 0.4 })
    shimmer(t + 0.35, 0.8, 8, 0.025)
  },
  // Rebirth: air rushing in, a deep impact, and a ringing major chord.
  rebirth(t) {
    whoosh(t, 1.1, 180, 4200, 0.28, { q: 1.6, rise: 0.88, verb: 0.3 })
    const hit = t + 1.0
    thump(hit, 110, 36, 0.9, 0.45, { verb: 0.2 })
    noise(hit, { dur: 0.6, attack: 0.005, type: 'lowpass', freq: 900, to: 180, q: 0.7, gain: 0.25, verb: 0.3 })
    ;[N.C5, N.G5, N.C6, N.E6, N.G6].forEach((m, i) => modal(hit + i * 0.035, mtof(m), BELL, { gain: 0.06, hit: 0.2, verb: 0.45 }))
    shimmer(hit + 0.1, 1.4, 14, 0.03)
  },
  // The egg rocking on the stand, faster and harder as the hatch nears, with a swell of
  // anticipation under the last stretch. Lines up with eggUi.js's hz-shake keyframes.
  eggShake(t, ms = 1700) {
    const s = ms / 1000
    const at = [0.1, 0.2, 0.3, 0.4, 0.5, 0.58, 0.66, 0.73, 0.8, 0.86, 0.91, 0.95, 0.98]
    at.forEach((f, i) => {
      const k = i / (at.length - 1)
      const side = i % 2 ? 1 : -1
      shell(t + f * s, rand(1050, 1350), 0.06 + 0.1 * k, { pan: side * 0.15 })
      thump(t + f * s, 140, 90, 0.04, 0.04 + 0.06 * k, { pan: side * 0.15 })
    })
    whoosh(t + s * 0.55, s * 0.45, 300, 1600, 0.07, { q: 1.4, rise: 0.95, verb: 0.2 })
  },
  // The shell splitting: a crackle, a pop and a puff of air.
  eggCrack(t) {
    for (let i = 0; i < 14; i++) noise(t + rand(0, 0.09), { dur: rand(0.003, 0.009), type: 'highpass', freq: rand(2500, 6000), gain: rand(0.1, 0.2), pan: rand(-0.3, 0.3), verb: 0.05 })
    shell(t, 1300, 0.12)
    thump(t + 0.05, 320, 90, 0.1, 0.2)
    noise(t + 0.05, { dur: 0.35, attack: 0.01, freq: 700, to: 300, q: 0.7, gain: 0.15, verb: 0.2 })
  },
  // The pets coming out: a short run of chimes, longer and richer the rarer the best of
  // them (RARITY_ORDER index), with a sparkle on top for a first-ever pet.
  reveal(t, rank = 0, isNew = false) {
    const runs = [
      [N.C6, N.G6],
      [N.C6, N.E6, N.G6],
      [N.C6, N.E6, N.G6, N.C7],
      [N.G5, N.C6, N.E6, N.G6, N.C7],
      [N.G5, N.C6, N.E6, N.G6, N.C7, N.E7],
      [N.C5, N.G5, N.C6, N.E6, N.G6, N.C7, N.E7, N.G7],
    ]
    const run = runs[clamp(rank, 0, runs.length - 1)]
    run.forEach((m, i) => glock(t + 0.08 + i * 0.06, m, 0.08))
    marimba(t + 0.08, run[0] - 12, 0.1)
    if (rank >= 2) shimmer(t + 0.25, 0.6 + rank * 0.15, 6 + rank * 2, 0.025)
    if (rank >= 4) {
      modal(t + 0.08, mtof(N.C5), BELL, { gain: 0.08, hit: 0.2, verb: 0.45 })
      whoosh(t, 0.9, 200, 3000, 0.1, { q: 1.2, rise: 0.2, verb: 0.3 })
    }
    if (isNew) [N.E7, N.G7].forEach((m, i) => glock(t + 0.15 + run.length * 0.06 + i * 0.07, m, 0.05))
  },
  // A potion (a daily x2 boost): glass clinks, bubbles rise, and the magic kicks in.
  potion(t) {
    modal(t, 2400, GLASS, { gain: 0.09, hit: 0.5, hitFreq: 6000, verb: 0.2 })
    modal(t + 0.07, 2950, GLASS, { gain: 0.06, hit: 0.4, hitFreq: 6000, verb: 0.2 })
    for (let i = 0; i < 9; i++) bubble(t + 0.1 + rand(0, 0.45), rand(450, 1300), rand(0.06, 0.11), rand(-0.3, 0.3))
    ;[N.E6, N.G6, N.C7].forEach((m, i) => marimba(t + 0.35 + i * 0.07, m, 0.09))
    shimmer(t + 0.45, 0.7, 8, 0.025)
  },
  // A reward handed straight over (a daily pet): a pop and a bright pair of chimes.
  reward(t) {
    thump(t, 300, 110, 0.08, 0.14)
    noise(t, { dur: 0.06, freq: 1400, q: 0.8, gain: 0.08 })
    ;[N.G6, N.C7, N.E7].forEach((m, i) => glock(t + 0.05 + i * 0.07, m, 0.07))
    shimmer(t + 0.25, 0.5, 5, 0.022)
  },
  // A pet deleted: a soft puff.
  poof(t) {
    noise(t, { dur: 0.3, attack: 0.01, freq: 900, to: 250, q: 0.6, gain: 0.2, verb: 0.15 })
    thump(t, 260, 90, 0.1, 0.1)
    crinkle(t, 0.06, 3, 0.04)
  },
}

// Loudness trims, measured with renderOffline: filtered noise (paper, air) loses most of its
// energy in the filter, so it is lifted to sit level with the struck and tuned sounds.
const LEVEL = { throwRelease: 2.2, throwSwing: 1.6, reload: 1.5, land: 2.5, bump: 2, padHit: 1.5, click: 1.3, select: 1.4, tab: 1.6, poof: 2, levelUp: 0.7 }

// Seconds a sound must wait before it can play again (anything stacking up per frame).
const GAP = { click: 0.03, select: 0.03, coins: 0.08, land: 0.05, bump: 0.05, padHit: 0.04, reload: 0.1, denied: 0.25, levelUp: 0.6, throwSwing: 0.1, throwRelease: 0.05 }

// sfx.click(), sfx.coins(4), sfx.reveal(rank, isNew) ...: each returns a handle with stop().
export const sfx = Object.fromEntries(Object.entries(SOUNDS).map(([name, fn]) => [name, (...args) => play(name, GAP[name] ?? 0.02, (t) => fn(t, ...args))]))

// --- The plane in flight (a continuous voice) --------------------------------------------
// While the camera chases a street throw (airflow.js drives it), the air it cuts through:
//  - rush: broad noise, left and right on their own loops and filters for width, the
//    lowpass opening with speed (the wind getting brighter and louder as the plane goes faster),
//    each side breathing with a slow, uneven gust;
//  - roar: the low body of air moving past, only really there at speed;
//  - whistle: a narrow band riding up with speed, the air cutting over the paper's edges;
//  - flutter: the trailing edge buzzing, highpassed noise chopped by an LFO whose rate
//    climbs with airspeed (paper rattles faster the harder it is pushed).
// Diving opens the filters and lifts the level; climbing does the opposite.
// Trim, measured with renderFlightOffline: a bed under the one-shots, about 1.5x throwRelease's
// RMS at full speed (0.035) and half of it on a short, slow throw.
const FLIGHT_LEVEL = 0.23

function loopNoise(ctx, buf) {
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  src.start(0, rand(0, 1.9))
  return src
}

function filter(ctx, type, freq, q) {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  return f
}

// An LFO at `hz` swinging `param` by +-`depth` around whatever it is set to.
function lfo(ctx, param, hz, depth, type = 'sine') {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.value = hz
  const g = ctx.createGain()
  g.gain.value = depth
  o.connect(g)
  g.connect(param)
  o.start()
  return { o, g }
}

function buildFlight(ctx, dry, wet, noiseBuf) {
  const out = ctx.createGain()
  out.gain.value = 0
  out.connect(dry)
  const send = ctx.createGain()
  send.gain.value = 0.12
  out.connect(send)
  send.connect(wet)

  const sources = []
  const v = { ctx, out, sources, rush: [], lfos: [] }
  for (const pan of [-0.45, 0.45]) {
    const src = loopNoise(ctx, noiseBuf)
    const lp = filter(ctx, 'lowpass', 700, 0.7)
    const bp = filter(ctx, 'peaking', 900, 0.8)
    bp.gain.value = 4
    const g = ctx.createGain()
    g.gain.value = 0
    const gust = ctx.createGain()
    gust.gain.value = 1
    v.lfos.push(lfo(ctx, gust.gain, pan < 0 ? 0.31 : 0.47, 0.22), lfo(ctx, gust.gain, pan < 0 ? 0.83 : 1.13, 0.08))
    const p = ctx.createStereoPanner()
    p.pan.value = pan
    src.connect(lp).connect(bp).connect(g).connect(gust).connect(p).connect(out)
    sources.push(src)
    v.rush.push({ lp, bp, g })
  }

  const roarSrc = loopNoise(ctx, noiseBuf)
  v.roarLp = filter(ctx, 'lowpass', 160, 0.9)
  v.roar = ctx.createGain()
  v.roar.gain.value = 0
  roarSrc.connect(v.roarLp).connect(v.roar).connect(out)
  sources.push(roarSrc)

  const whistleSrc = loopNoise(ctx, noiseBuf)
  v.whistleBp = filter(ctx, 'bandpass', 1200, 9)
  v.whistle = ctx.createGain()
  v.whistle.gain.value = 0
  v.lfos.push(lfo(ctx, v.whistleBp.frequency, 0.9, 60))
  whistleSrc.connect(v.whistleBp).connect(v.whistle).connect(out)
  sources.push(whistleSrc)

  const flutterSrc = loopNoise(ctx, noiseBuf)
  const flutterHp = filter(ctx, 'bandpass', 2600, 0.7)
  const chop = ctx.createGain()
  chop.gain.value = 0.5
  v.flutterLfo = lfo(ctx, chop.gain, 20, 0.5, 'triangle')
  v.lfos.push(v.flutterLfo)
  v.flutter = ctx.createGain()
  v.flutter.gain.value = 0
  flutterSrc.connect(flutterHp).connect(chop).connect(v.flutter).connect(out)
  sources.push(flutterSrc)
  return v
}

// speed: 0..1 of the street's top speed; dive: -1 (climbing hard) .. 1 (diving hard);
// level: 0..1 overall (eases it in and out).
function setFlight(v, { speed, dive = 0, level = 1 }, t) {
  const s = clamp(speed, 0, 1.2)
  const d = clamp(dive, -1, 1)
  const k = 0.08 // s: every change glides, so nothing steps
  const air = 1 + 0.35 * d
  v.out.gain.setTargetAtTime(FLIGHT_LEVEL * level, t, 0.12)
  for (const [i, r] of v.rush.entries()) {
    r.lp.frequency.setTargetAtTime((500 + 3200 * s * s) * air * (i ? 1.08 : 1), t, k)
    r.bp.frequency.setTargetAtTime((700 + 1300 * s) * air, t, k)
    r.g.gain.setTargetAtTime((0.07 + 0.2 * s) * air, t, k)
  }
  v.roarLp.frequency.setTargetAtTime(120 + 160 * s, t, k)
  v.roar.gain.setTargetAtTime(0.45 * s * s * air, t, k)
  v.whistleBp.frequency.setTargetAtTime((900 + 2100 * s) * (1 + 0.12 * d), t, k)
  v.whistle.gain.setTargetAtTime(0.09 * s * s * air, t, k)
  v.flutterLfo.o.frequency.setTargetAtTime(12 + 34 * s, t, k)
  v.flutter.gain.setTargetAtTime(0.05 + 0.16 * s, t, k)
}

function stopFlight(v, t) {
  v.out.gain.cancelScheduledValues(t)
  v.out.gain.setValueAtTime(v.out.gain.value, t)
  v.out.gain.setTargetAtTime(0, t, 0.12)
  for (const src of v.sources) src.stop(t + 0.8)
  for (const { o } of v.lfos) o.stop(t + 0.8)
}

// start() when the chase begins, update({ speed, dive, level }) every frame, stop() on
// touchdown. Silent (and free) until the first gesture has woken audio.
export const flightVoice = (() => {
  let v = null
  return {
    start() {
      if (v || !ready()) return
      v = buildFlight(live.ctx, live.dry, live.wet, live.noise)
    },
    update(params) {
      if (v) setFlight(v, params, live.ctx.currentTime)
    },
    stop() {
      if (!v) return
      stopFlight(v, live.ctx.currentTime)
      v = null
    },
    get playing() {
      return !!v
    },
  }
})()

// Dev: renders the flight voice held at `speed` offline and measures it, like renderOffline.
export async function renderFlightOffline(speed = 1, seconds = 2, dive = 0) {
  const ctx = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100)
  const g = build(ctx, ctx.destination)
  const v = buildFlight(ctx, g.dry, g.wet, g.noise)
  setFlight(v, { speed, dive }, 0)
  const buf = await ctx.startRendering()
  let peak = 0
  let sum = 0
  const d = buf.getChannelData(0)
  const from = Math.floor(44100 * 0.6) // past the glide in
  for (let i = from; i < d.length; i++) {
    peak = Math.max(peak, Math.abs(d[i]))
    sum += d[i] * d[i]
  }
  return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / (d.length - from)).toFixed(4) }
}

// Dev: renders one sound offline and measures it, for balancing levels without ears.
// await renderOffline('buy') -> { peak, rms, seconds }
export async function renderOffline(name, args = [], seconds = 3) {
  const ctx = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100)
  const prev = A
  A = build(ctx, ctx.destination)
  group(LEVEL[name] ?? 1)
  SOUNDS[name](0.01, ...args)
  G = null
  A = prev
  const buf = await ctx.startRendering()
  let peak = 0
  let sum = 0
  let last = 0
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) {
    const v = Math.abs(d[i])
    peak = Math.max(peak, v)
    sum += v * v
    if (v > 0.002) last = i
  }
  return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / Math.max(1, last)).toFixed(4), seconds: +(last / 44100).toFixed(2), buffer: buf }
}
