// The eggs the player walks up to, after Chop-trees-for-treasure's systems/eggs.js: the
// five on the Egg Row stage and the Demon Egg on the north plaza. Within EGGS.range.open of
// one, "E Open <egg>" shows; E (or clicking the prompt) opens its window (eggUi.js), where
// E hatches one. Walking past EGGS.range.close shuts the window. Hatching itself is
// hatch.js. eggState is the one shared state the UI renders from: subscribeEggs tells it
// on every change.
import { EGG_SHOP, EGGS, MAP } from './config.js'
import { inputState } from './input.js'
import { player } from './player.js'
import { tryHatch } from './hatch.js'
import { sfx } from './sfx.js'

// Egg id (EGG_SHOP key) and ground position of every egg that can be opened.
export const EGG_SPOTS = [
  ...MAP.eggs.map((e) => ({ id: e.name.toLowerCase(), x: e.x, z: MAP.eggStage.z })),
  { id: 'demon', x: MAP.demonEgg.x, z: MAP.demonEgg.z },
  // Not an egg: the Free Reward shares the "E Open" prompt, and E opens the Daily Rewards window.
  { id: 'daily', x: MAP.freeReward.x, z: MAP.freeReward.z },
].filter((e) => EGG_SHOP[e.id])

// Set by main.js to open the Daily Rewards window (dailyUi.js), which this module can't import.
export const rewardWindow = { open: () => {} }

export const eggState = {
  near: null, // egg id whose E prompt shows, or null
  open: null, // egg id whose window is open, or null
  hatch: null, // { egg, pets: [{ id, egg, name, isNew }], n } while the hatch animation plays
  auto: false, // Auto: hatch again as each animation ends
}

const listeners = new Set()
export function subscribeEggs(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export function emitEggs() {
  for (const fn of listeners) fn(eggState)
}

// Things to tell the player ([{ title, sub, tone }]), for the HUD popup, since main.js asked.
const messages = []
export function eggMessage(title, sub, tone = 'bad') {
  if (tone === 'bad') sfx.denied()
  messages.push({ title, sub, tone })
}
export function takeEggMessages() {
  return messages.splice(0)
}

const distanceTo = (egg) => Math.hypot(player.position.x - egg.x, player.position.z - egg.z)

export function openEgg(id) {
  if (!EGG_SHOP[id]) return
  if (id === 'daily') {
    document.exitPointerLock?.()
    rewardWindow.open()
    return
  }
  eggState.open = id
  eggState.near = null
  document.exitPointerLock?.() // the window needs the cursor
  emitEggs()
}

export function closeEgg() {
  if (!eggState.open && !eggState.auto) return
  eggState.open = null
  eggState.auto = false
  emitEggs()
}

// Call once per frame after the player moves.
export function stepEggs() {
  const pressed = inputState.interact
  inputState.interact = false
  if (eggState.open) {
    const egg = EGG_SPOTS.find((e) => e.id === eggState.open)
    if (!egg || distanceTo(egg) > EGGS.range.close) closeEgg()
    else if (pressed && !eggState.hatch) tryHatch(eggState.open, 1)
    return
  }
  let near = null
  let best = EGGS.range.open
  for (const egg of EGG_SPOTS) {
    const d = distanceTo(egg)
    if (d < best) {
      best = d
      near = egg.id
    }
  }
  if (near !== eggState.near) {
    eggState.near = near
    emitEggs()
  }
  if (pressed && near) openEgg(near)
}
