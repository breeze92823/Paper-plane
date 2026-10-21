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
import { EGG_SHOP, EGGS, MAP, STREET_ZONES, TUTORIAL } from './config.js'
import { isKnownPet, petKey, petMultiplier, petSlots, sortedPets } from './pets.js'

// The game's progress: Power, Wins, Rebirths, the planes owned and equipped, the pets
// hatched and equipped, and the Auto Throw toggle. A plain mutated singleton like `player`, changed only through
// the actions below, each of which tells every subscriber (the HUD) once. Per-frame
// state (planes in flight) does not belong here. Level is always derived from Power.
export const game = {
  power: Math.min(POWER_INITIAL, powerCap(REBIRTH_INITIAL)),
  level: 1,
  rebirths: REBIRTH_INITIAL,
  wins: WINS_INITIAL,
  multiplier: 1, // boost multiplier (x2 Power); rebirths multiply on top, see powerMultiplier
  autoThrow: false,
  autoThrowOwned: false, // bought once with Wins (HUD.prices.autoThrow); saved. autoThrow itself is per-session
  // The HUD's x2 Power / x2 Wins, each bought once with Wins (HUD.prices) and then switched
  // on or off; x2 while owned and on, on top of any potion. Both saved.
  x2Owned: { power: false, wins: false },
  x2On: { power: false, wins: false },
  // Timed x2 boosts (daily-reward potions): epoch ms each runs until; 0 / past = off. Saved.
  boosts: { power: 0, wins: 0 },
  // The Items window's Eggs and Potions (daily rewards): how many of each are stored. Eggs by
  // EGG_SHOP id; potions by `${stat}:${minutes}`, e.g. 'wins:5' = an x2 Wins potion for 5
  // minutes. Saved.
  storedEggs: {},
  potions: {},
  bestDistance: 0, // m: the longest street throw
  furthestZone: 0, // index into STREET_ZONES: the furthest zone a plane has reached
  // Plane Hall planes by index into MAP.pads; pad 0 (+1) is owned from the start.
  ownedPlanes: [0],
  equippedPlane: 0,
  // Hatched pets { id, egg, name } (egg + name key into EGG_SHOP), the equipped ones' ids
  // (at most petSlots()), every `${egg}:${name}` ever hatched (for NEW!), and the next id.
  pets: [],
  equipped: [],
  discovered: [],
  nextPetId: 1,
  // The onboarding quest (tutorial.js): 0 Power, 1 Wins, 2 new plane, 3 level 20, 4 rebirth,
  // 5 done. Only ever moves forward, and is saved, so a returning player resumes it.
  tutorialStep: 0,
  // Whether we know yet if this player has a save (net.js): true once the server's
  // `progress`/`noProgress` reply arrives, or there is nothing to wait for (guest, no server,
  // timeout). The tutorial stays hidden until then, so a returning player never sees step 0 flash.
  progressKnown: false,
  // The loaded save had already finished the tutorial, so its COMPLETE banner isn't replayed.
  tutorialResumedDone: false,
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

// Ms left on a timed x2 boost ('power' | 'wins'), 0 when it isn't running.
export const boostLeft = (stat) => Math.max(0, (game.boosts[stat] ?? 0) - Date.now())

// x2 from the bought x2 Power / x2 Wins ('power' | 'wins') while it's switched on, else 1.
export const x2Mult = (stat) => (game.x2Owned[stat] && game.x2On[stat] ? 2 : 1)

// Everything earned Power is multiplied by: the boost multiplier, (rebirths + 1), the
// equipped pets' bonus (pets.js), x2 while a Power boost runs, and x2 while x2 Power is on.
export const powerMultiplier = () =>
  game.multiplier * (game.rebirths + 1) * petMultiplier(game) * (boostLeft('power') > 0 ? 2 : 1) * x2Mult('power')

// Earned by throwing: scaled by powerMultiplier and capped at this rebirth's level cap.
export function addPower(amount) {
  set({ power: clamp(game.power + Math.floor(amount * powerMultiplier()), POWER_MIN, powerCap(game.rebirths)) })
}

// Flat grant: no multipliers, still capped.
export function grantPower(amount) {
  set({ power: clamp(game.power + amount, POWER_MIN, powerCap(game.rebirths)) })
}

// Earned Wins (a street throw's payout): doubled while a Wins boost runs, and again while x2 Wins is on.
export function addWins(amount) {
  set({ wins: game.wins + amount * (boostLeft('wins') > 0 ? 2 : 1) * x2Mult('wins') })
}

// Starts a timed x2 boost, or adds `ms` to one already running. Subscribers hear again the
// moment it runs out, so the multiplier and its timer drop back on their own.
const boostEnds = {}
export function addBoost(stat, ms) {
  if (!(stat in game.boosts) || !(ms > 0)) return
  set({ boosts: { ...game.boosts, [stat]: Math.max(Date.now(), game.boosts[stat]) + ms } })
  scheduleBoostEnd(stat)
}
function scheduleBoostEnd(stat) {
  clearTimeout(boostEnds[stat])
  const left = boostLeft(stat)
  if (left > 0) boostEnds[stat] = setTimeout(() => set({}), left + 50)
}

// --- Stored items (Items window) ---------------------------------------------------------
const STORED_MAX = 999 // of any one egg or potion
export const potionKey = (stat, ms) => `${stat}:${Math.max(1, Math.round(ms / 60_000))}`
// 'wins:5' -> { stat: 'wins', minutes: 5 }, or null for anything else.
export function parsePotion(key) {
  const m = /^(power|wins):(\d+)$/.exec(key)
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 60 ? { stat: m[1], minutes: Number(m[2]) } : null
}

const bump = (bag, key, by) => {
  const n = Math.min(STORED_MAX, Math.max(0, (bag[key] ?? 0) + by))
  const next = { ...bag, [key]: n }
  if (!n) delete next[key]
  return next
}

export function storeEgg(egg) {
  if (EGG_SHOP[egg]) set({ storedEggs: bump(game.storedEggs, egg, 1) })
}

// Removes one stored egg (hatch.js hatchStored hatches it); false if there is none.
export function takeStoredEgg(egg) {
  if (!(game.storedEggs[egg] > 0)) return false
  set({ storedEggs: bump(game.storedEggs, egg, -1) })
  return true
}

export function storePotion(stat, ms) {
  const key = potionKey(stat, ms)
  if (parsePotion(key)) set({ potions: bump(game.potions, key, 1) })
}

// Drinks one stored potion: its x2 boost starts (or runs longer). False if there is none.
export function usePotion(key) {
  const p = parsePotion(key)
  if (!p || !(game.potions[key] > 0)) return false
  set({ potions: bump(game.potions, key, -1) })
  addBoost(p.stat, p.minutes * 60_000)
  return true
}

// A pet handed out whole (a daily reward): added like a hatch, free. Null if the inventory is full.
export function grantPet(egg, name) {
  return hatchPets(egg, [name], 0)?.[0] ?? null
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

// Only works once bought (buyAutoThrow).
export function setAutoThrow(on) {
  if (on && !game.autoThrowOwned) return
  set({ autoThrow: on })
}

// Spends `cost` Wins to unlock Auto Throw, and turns it on; false if already owned or too poor.
export function buyAutoThrow(cost) {
  if (game.autoThrowOwned || game.wins < cost) return false
  set({ wins: game.wins - cost, autoThrowOwned: true, autoThrow: true })
  return true
}

// Spends `cost` Wins to own x2 Power or x2 Wins ('power' | 'wins'), and switches it on; false
// if already owned or too poor.
export function buyX2(stat, cost) {
  if (!(stat in game.x2Owned) || game.x2Owned[stat] || game.wins < cost) return false
  set({ wins: game.wins - cost, x2Owned: { ...game.x2Owned, [stat]: true }, x2On: { ...game.x2On, [stat]: true } })
  return true
}

// Only works once bought (buyX2).
export function setX2(stat, on) {
  if (!game.x2Owned[stat]) return
  set({ x2On: { ...game.x2On, [stat]: on } })
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

// --- Pets ---------------------------------------------------------------------------
// Pays `cost` Wins for `names` hatched from `egg`, adds them (equipping any into free
// slots) and returns them as { id, egg, name, isNew }, or null if it can't be paid or the
// inventory can't take them. hatch.js rolls the names.
export function hatchPets(egg, names, cost) {
  if (game.wins < cost || game.pets.length + names.length > EGGS.inventoryMax) return null
  let nextPetId = game.nextPetId
  const discovered = new Set(game.discovered)
  const hatched = names.map((name) => {
    const pet = { id: nextPetId++, egg, name }
    const isNew = !discovered.has(petKey(pet))
    discovered.add(petKey(pet))
    return { ...pet, isNew }
  })
  const free = Math.max(0, petSlots(game) - game.equipped.length)
  set({
    wins: game.wins - cost,
    pets: [...game.pets, ...hatched.map(({ id, name }) => ({ id, egg, name }))],
    equipped: [...game.equipped, ...hatched.slice(0, free).map((p) => p.id)],
    discovered: [...discovered],
    nextPetId,
  })
  return hatched
}

// Equips or unequips a pet; false if every slot is already taken.
export function toggleEquip(id) {
  if (game.equipped.includes(id)) {
    set({ equipped: game.equipped.filter((e) => e !== id) })
    return true
  }
  if (game.equipped.length >= petSlots(game) || !game.pets.some((p) => p.id === id)) return false
  set({ equipped: [...game.equipped, id] })
  return true
}

export function equipBest() {
  set({ equipped: sortedPets(game.pets).slice(0, petSlots(game)).map((p) => p.id) })
}

export function deletePet(id) {
  set({ pets: game.pets.filter((p) => p.id !== id), equipped: game.equipped.filter((e) => e !== id) })
}

// Moves the tutorial on to `step`; never back.
export function advanceTutorial(step) {
  if (step > game.tutorialStep) set({ tutorialStep: Math.min(TUTORIAL.doneStep, step) })
}

export function markProgressKnown() {
  if (!game.progressKnown) set({ progressKnown: true })
}

// Applies a saved doc from the server (net.js's `progress` message). Every field is
// re-validated, so a malformed doc can't corrupt the store.
export function hydrate(d) {
  const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  const isPlane = (i) => Number.isInteger(i) && i >= 0 && i < MAP.pads.length
  const rebirths = clamp(Math.floor(num(d.rebirths, game.rebirths)), REBIRTH_MIN, REBIRTH_MAX)
  const owned = Array.isArray(d.ownedPlanes) ? d.ownedPlanes.filter(isPlane) : game.ownedPlanes
  const ownedPlanes = owned.includes(0) ? owned : [0, ...owned]
  // Only ever forward, so a stale save can't drag the player back through the tutorial.
  const savedStep = clamp(Math.floor(num(d.tutorialStep, 0)), 0, TUTORIAL.doneStep)
  const tutorialStep = Math.max(game.tutorialStep, savedStep)
  set({
    tutorialStep,
    tutorialResumedDone: game.tutorialResumedDone || (tutorialStep === TUTORIAL.doneStep && game.tutorialStep < TUTORIAL.doneStep),
    progressKnown: true,
    rebirths,
    power: clamp(Math.floor(num(d.power, game.power)), POWER_MIN, powerCap(rebirths)),
    wins: Math.max(0, Math.floor(num(d.wins, game.wins))),
    bestDistance: Math.max(0, num(d.bestDistance, game.bestDistance)),
    furthestZone: clamp(Math.floor(num(d.furthestZone, game.furthestZone)), 0, STREET_ZONES.length - 1),
    ownedPlanes,
    autoThrowOwned: game.autoThrowOwned || d.autoThrowOwned === true,
    equippedPlane: ownedPlanes.includes(d.equippedPlane) ? d.equippedPlane : 0,
    ...hydratePets(d),
    ...hydrateX2(d),
    ...hydrateBoosts(d),
    ...hydrateStored(d),
  })
  for (const stat of Object.keys(game.boosts)) scheduleBoostEnd(stat)
}

// Stored eggs (known EGG_SHOP ids) and potions (parsePotion keys), whole counts up to STORED_MAX.
function hydrateStored(d) {
  const counts = (src, ok) => {
    const out = {}
    if (!src || typeof src !== 'object') return out
    for (const [key, n] of Object.entries(src)) if (ok(key) && Number.isInteger(n) && n > 0) out[key] = Math.min(STORED_MAX, n)
    return out
  }
  const patch = {}
  if (d.storedEggs) patch.storedEggs = counts(d.storedEggs, (k) => !!EGG_SHOP[k])
  if (d.potions) patch.potions = counts(d.potions, (k) => !!parsePotion(k))
  return patch
}

// x2 Power / x2 Wins: owned if either the save or this session bought it (like Auto Throw).
// One already owned here keeps its local switch; one only the save owns takes the saved
// switch (on if the save doesn't say).
function hydrateX2(d) {
  const owned = d.x2Owned && typeof d.x2Owned === 'object' ? d.x2Owned : {}
  const on = d.x2On && typeof d.x2On === 'object' ? d.x2On : {}
  const x2Owned = { ...game.x2Owned }
  const x2On = { ...game.x2On }
  for (const stat of Object.keys(x2Owned)) {
    if (x2Owned[stat] || owned[stat] !== true) continue
    x2Owned[stat] = true
    x2On[stat] = on[stat] !== false
  }
  return { x2Owned, x2On }
}

// Saved boosts that are still running (the later of saved and local, so a boost started this
// session before the save arrived isn't cut short).
function hydrateBoosts(d) {
  if (!d.boosts || typeof d.boosts !== 'object') return {}
  const now = Date.now()
  const until = (v, mine) => Math.max(mine, typeof v === 'number' && Number.isFinite(v) && v > now ? v : 0)
  return { boosts: { power: until(d.boosts.power, game.boosts.power), wins: until(d.boosts.wins, game.boosts.wins) } }
}

// The pet half of hydrate: only known pets with unique positive ids, equipped ones that are
// owned (up to the slots), known discovered keys, and a next id past every owned one.
function hydratePets(d) {
  if (!Array.isArray(d.pets)) return {}
  const pets = []
  const ids = new Set()
  for (const p of d.pets) {
    if (!p || !Number.isInteger(p.id) || p.id < 1 || ids.has(p.id) || !isKnownPet(p.egg, p.name)) continue
    ids.add(p.id)
    pets.push({ id: p.id, egg: p.egg, name: p.name })
    if (pets.length >= EGGS.inventoryMax) break
  }
  const equipped = (Array.isArray(d.equipped) ? d.equipped : []).filter((id, i, all) => ids.has(id) && all.indexOf(id) === i).slice(0, petSlots())
  const known = new Set(Object.entries(EGG_SHOP).flatMap(([egg, e]) => e.pets.map((p) => `${egg}:${p.name}`)))
  const discovered = new Set((Array.isArray(d.discovered) ? d.discovered : []).filter((k) => known.has(k)))
  for (const p of pets) discovered.add(petKey(p)) // anything owned has been seen
  const maxId = pets.reduce((m, p) => Math.max(m, p.id), 0)
  const nextPetId = Math.max(maxId + 1, Number.isInteger(d.nextPetId) ? d.nextPetId : 1)
  return { pets, equipped, discovered: [...discovered], nextPetId }
}
