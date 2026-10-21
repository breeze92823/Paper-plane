import {
  AUTO_REBIRTH,
  canAcceptRebirth,
  clamp,
  levelForPower,
  POWER_INITIAL,
  POWER_MIN,
  powerCap,
  REBIRTH_INITIAL,
  REBIRTH_MAX,
  REBIRTH_MIN,
  WINS_INITIAL,
} from './progression.js'
import { MAP, STREET_ZONES } from './config.js'

// The game's progress: Power, Wins, Rebirths, the planes owned and equipped, and the
// Auto Throw toggle. A plain mutated singleton like `player`, changed only through
// the actions below, each of which tells every subscriber (the HUD) once. Per-frame
// state (planes in flight) does not belong here. Level is always derived from Power.
export const game = {
  power: Math.min(POWER_INITIAL, powerCap(REBIRTH_INITIAL)),
  level: 1,
  rebirths: REBIRTH_INITIAL,
  wins: WINS_INITIAL,
  multiplier: 1, // boost multiplier (x2 Power); rebirths multiply on top, see powerMultiplier
  autoThrow: false,
  bestDistance: 0, // m: the longest street throw
  furthestZone: 0, // index into STREET_ZONES: the furthest zone a plane has reached
  // Plane Hall planes by index into MAP.pads; pad 0 (+1) is owned from the start.
  ownedPlanes: [0],
  equippedPlane: 0,
}
game.level = levelForPower(game.power)

const listeners = new Set()

// Calls fn(game) on every change; returns an unsubscribe function.
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function set(patch) {
  Object.assign(game, patch)
  game.level = levelForPower(game.power)
  // VITE_AUTO_REBIRTH: at the level cap, rebirth at once.
  if (AUTO_REBIRTH && canAcceptRebirth(game.power, game.rebirths)) {
    game.rebirths = clamp(game.rebirths + 1, REBIRTH_MIN, REBIRTH_MAX)
    game.power = POWER_MIN
    game.level = levelForPower(game.power)
  }
  for (const fn of listeners) fn(game)
}

// Everything earned Power is multiplied by: the boost multiplier times (rebirths + 1).
export const powerMultiplier = () => game.multiplier * (game.rebirths + 1)

// Earned by throwing: scaled by powerMultiplier and capped at this rebirth's level cap.
export function addPower(amount) {
  set({ power: clamp(game.power + Math.floor(amount * powerMultiplier()), POWER_MIN, powerCap(game.rebirths)) })
}

// Flat grant (power packs): no multipliers, still capped.
export function grantPower(amount) {
  set({ power: clamp(game.power + amount, POWER_MIN, powerCap(game.rebirths)) })
}

export function addWins(amount) {
  set({ wins: game.wins + amount })
}

// Re-checks eligibility itself so a duplicate or stale call can never double-apply.
export function acceptRebirth() {
  if (!canAcceptRebirth(game.power, game.rebirths)) return false
  set({ rebirths: clamp(game.rebirths + 1, REBIRTH_MIN, REBIRTH_MAX), power: POWER_MIN })
  return true
}

// A street throw landed `metres` up the street; true if that beats the best.
export function recordDistance(metres) {
  if (metres <= game.bestDistance) return false
  set({ bestDistance: metres })
  return true
}

// A plane flew into zone `index`; true the first time any plane gets that far.
export function reachZone(index) {
  if (index <= game.furthestZone) return false
  set({ furthestZone: index })
  return true
}

export function setAutoThrow(on) {
  set({ autoThrow: on })
}

// Spends Wins to own a plane and equips it; false if already owned or too poor.
export function buyPlane(index, cost) {
  if (game.ownedPlanes.includes(index) || game.wins < cost) return false
  set({ wins: game.wins - cost, ownedPlanes: [...game.ownedPlanes, index], equippedPlane: index })
  return true
}

export function equipPlane(index) {
  if (game.ownedPlanes.includes(index)) set({ equippedPlane: index })
}

// Applies a saved doc from the server (net.js's `progress` message). Every field is
// re-validated, so a malformed doc can't corrupt the store.
export function hydrate(d) {
  const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  const isPlane = (i) => Number.isInteger(i) && i >= 0 && i < MAP.pads.length
  const rebirths = clamp(Math.floor(num(d.rebirths, game.rebirths)), REBIRTH_MIN, REBIRTH_MAX)
  const owned = Array.isArray(d.ownedPlanes) ? d.ownedPlanes.filter(isPlane) : game.ownedPlanes
  const ownedPlanes = owned.includes(0) ? owned : [0, ...owned]
  set({
    rebirths,
    power: clamp(Math.floor(num(d.power, game.power)), POWER_MIN, powerCap(rebirths)),
    wins: Math.max(0, Math.floor(num(d.wins, game.wins))),
    bestDistance: Math.max(0, num(d.bestDistance, game.bestDistance)),
    furthestZone: clamp(Math.floor(num(d.furthestZone, game.furthestZone)), 0, STREET_ZONES.length - 1),
    ownedPlanes,
    equippedPlane: ownedPlanes.includes(d.equippedPlane) ? d.equippedPlane : 0,
  })
}
