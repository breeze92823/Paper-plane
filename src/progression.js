// Progression constants and pure helpers, ported from Stone-Skipping's
// data/progression.js with Skill renamed to Power. Power is the raw earned total;
// Level is derived from it (levelCost is the per-level cost), Rebirth is gated on
// Level, and a Throw Area plane's range down the street comes from Power alone.
import { STREET, STREET_ZONES } from './config.js'

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Starting values can be overridden from .env (VITE_INITIAL_*); bad or missing
// values fall back to the default.
function envInt(value, fallback, min, max) {
  const n = Math.floor(Number(value))
  return value === undefined || value === '' || !Number.isFinite(n) ? fallback : clamp(n, min, max)
}

export const POWER_MIN = 0
export const POWER_MAX = 1_000_000_000_000
export const POWER_INITIAL = envInt(import.meta.env.VITE_INITIAL_POWER, 0, POWER_MIN, POWER_MAX)

export const LEVEL_MIN = 1

// Power needed to go from `level` to `level + 1` (a single step, not cumulative).
// Stone-Skipping's table: levels 1-24 are exact values from the real game it copies,
// and from 25 up the tail is an ESTIMATE (the +9 line plus an exponential term, so
// reaching level 149 takes ~100M). Replace it as Paper-plane's own numbers settle.
const LEVEL_COSTS_EXACT = [
  ...Array(13).fill(10), // 1->2 .. 13->14
  12, 14, 15, 17, 19, 22, // 14->15 .. 19->20
  44, 53, 62, 71, 80, // 20->21 .. 24->25
]
const TAIL_START = 20 // tail formula is anchored at level 20 (cost 44)
const TAIL_EXP = 3.85085
const TAIL_RATE = 0.1161

export function levelCost(level) {
  if (level <= LEVEL_COSTS_EXACT.length) return LEVEL_COSTS_EXACT[Math.max(1, level) - 1]
  const d = level - TAIL_START
  return Math.round(44 + 9 * d + TAIL_EXP * (Math.exp(TAIL_RATE * d) - 1))
}

// CUM[i] = total Power needed to reach level i + 1. Built once, up to POWER_MAX.
const CUM = [0]
while (CUM[CUM.length - 1] < POWER_MAX) {
  CUM.push(Math.min(POWER_MAX, CUM[CUM.length - 1] + levelCost(CUM.length)))
}

// Total Power needed to reach `level`.
export function powerForLevel(level) {
  const i = Math.max(LEVEL_MIN, level) - LEVEL_MIN
  return i < CUM.length ? CUM[i] : POWER_MAX
}

export const REBIRTH_MIN = 0 // players start at X0
export const REBIRTH_MAX = 5000
export const REBIRTH_INITIAL = envInt(import.meta.env.VITE_INITIAL_REBIRTHS, 0, REBIRTH_MIN, REBIRTH_MAX)

// When true, rebirth happens automatically the moment the level cap is reached.
export const AUTO_REBIRTH = import.meta.env.VITE_AUTO_REBIRTH === 'true'

export const WINS_INITIAL = envInt(import.meta.env.VITE_INITIAL_WINS, 0, 0, Number.MAX_SAFE_INTEGER)

function levelIndex(power) {
  let lo = 0
  let hi = CUM.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (CUM[mid] <= power) lo = mid
    else hi = mid - 1
  }
  return lo
}

export function levelForPower(power) {
  return LEVEL_MIN + levelIndex(Math.max(0, power))
}

// Where the given Power sits inside its current level, for the HUD level bar.
export function levelProgress(power) {
  const total = Math.floor(Math.max(0, power))
  const i = levelIndex(total)
  const span = i + 1 < CUM.length ? CUM[i + 1] - CUM[i] : 1
  return { level: LEVEL_MIN + i, into: Math.min(total - CUM[i], span), span }
}

// Levels needed to rebirth, indexed by current rebirth count (X0->X1 first).
// Past the table it keeps adding REBIRTH_LEVELS_STEP per rebirth (175, 200, 225...).
const REBIRTH_LEVELS = [20, 40, 60, 80, 100, 125, 150]
const REBIRTH_LEVELS_STEP = 25

export function rebirthLevelsRequired(rebirth) {
  if (rebirth < REBIRTH_LEVELS.length) return REBIRTH_LEVELS[rebirth]
  return REBIRTH_LEVELS[REBIRTH_LEVELS.length - 1] + REBIRTH_LEVELS_STEP * (rebirth - REBIRTH_LEVELS.length + 1)
}

// Level is capped at the current rebirth's required level until you rebirth, so
// Power can't go past the point that reaches it.
export function powerCap(rebirth) {
  return powerForLevel(rebirthLevelsRequired(rebirth))
}

// Single source of truth for rebirth eligibility: the store's guard and the HUD's
// Rebirth tile both call this so they can never disagree.
export function canAcceptRebirth(power, rebirth) {
  return rebirth < REBIRTH_MAX && levelForPower(power) >= rebirthLevelsRequired(rebirth)
}

// 0..1 toward the next rebirth, by level (the Rebirth tile's percentage).
export function rebirthProgress(power, rebirth) {
  return clamp(levelForPower(power) / rebirthLevelsRequired(rebirth), 0, 1)
}

// --- The street -----------------------------------------------------------------
// Power at which a Throw Area plane flies the whole street to the Sky Port.
export const STREET_END_POWER = 1_000_000
const REACH_FLOOR = 0.02 // a fresh player still flies a short way (~70 m, inside the first field)
const STREET_WINS_LENGTH = STREET.length // metres of street that earn the full payout
const STREET_WINS_MAX = 25_000
const STREET_WINS_CURVE = 9 // higher = flatter start, steeper finish

// '+1.1K' / '2.1K' / '35' (the way config.js writes Power and prices) -> 1100 / 2100 / 35.
const SUFFIX = { K: 1e3, M: 1e6, B: 1e9 }
export function parseAmount(text) {
  const m = /^\+?([\d.]+)([KMB]?)$/.exec(String(text).trim())
  return m ? Math.round(parseFloat(m[1]) * (SUFFIX[m[2]] ?? 1)) : 0
}

// Index into STREET_ZONES of the zone `metres` up the street lies in.
export function zoneIndexAt(metres) {
  let i = 0
  while (i + 1 < STREET_ZONES.length && STREET_ZONES[i + 1].startD <= metres) i++
  return i
}

// 0..1 share of the street a Throw Area plane can cross, from Power alone: linear up
// to STREET_END_POWER, where it reaches the end.
export function streetReach(power) {
  return Math.max(REACH_FLOOR, clamp(power / STREET_END_POWER, 0, 1))
}

// Wins for a street throw grow exponentially with the distance flown: short throws
// pay little, and the full STREET_WINS_LENGTH pays STREET_WINS_MAX.
export function streetWinsForDistance(metres) {
  const f = clamp(metres / STREET_WINS_LENGTH, 0, 1)
  return Math.round((STREET_WINS_MAX * (Math.exp(STREET_WINS_CURVE * f) - 1)) / (Math.exp(STREET_WINS_CURVE) - 1))
}
