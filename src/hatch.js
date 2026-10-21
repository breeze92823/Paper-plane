// Egg hatching, after Chop-trees-for-treasure's systems/hatch.js: pay, roll the egg's
// odds, add the pets (store.js hatchPets, which also fills free equip slots and marks
// first-ever pets NEW), and hand the result to the hatch animation (eggUi.js) through
// eggState.hatch. The animation calls finishHatch() when it's done, which hatches again
// straight away while Auto is on.
import { EGG_SHOP, EGGS } from './config.js'
import { formatNumber } from './hud.js'
import { eggMessage, eggState, emitEggs } from './eggs.js'
import { game, hatchPets, takeStoredEgg } from './store.js'

function roll(pets) {
  let r = Math.random() * pets.reduce((sum, p) => sum + p.chance, 0)
  return pets.find((p) => (r -= p.chance) < 0) ?? pets[pets.length - 1]
}

let last = { egg: null, count: 1 }
let hatchCount = 0

// Hatches `count` of egg `id`; true if it went ahead, otherwise says why.
export function tryHatch(id, count = 1) {
  const egg = EGG_SHOP[id]
  if (!egg || eggState.hatch) return false
  if (egg.currency === 'gems') {
    eggMessage(`⬢ ${egg.cost} Gems`, 'Gems are coming soon')
    return false
  }
  const price = egg.cost * count
  if (game.pets.length + count > EGGS.inventoryMax) {
    eggMessage('Pets full!', `Delete some pets (max ${EGGS.inventoryMax})`)
    return false
  }
  if (game.wins < price) {
    eggMessage(`🏆 ${formatNumber(price)} Wins`, `needed: you have ${formatNumber(game.wins)}`)
    return false
  }
  const hatched = hatchPets(id, Array.from({ length: count }, () => roll(egg.pets).name), price)
  if (!hatched) return false
  last = { egg: id, count }
  eggState.hatch = { egg: id, pets: hatched, n: ++hatchCount }
  emitEggs()
  return true
}

// One free hatch of egg `id` (a daily reward): its normal odds, no price. Plays the hatch
// animation unless one is already running (the pet is added either way). Returns the
// hatched pet, or null if the inventory is full.
export function hatchFree(id) {
  const egg = EGG_SHOP[id]
  if (!egg) return null
  const hatched = hatchPets(id, [roll(egg.pets).name], 0)
  if (!hatched) return null
  if (!eggState.hatch) {
    eggState.hatch = { egg: id, pets: hatched, n: ++hatchCount }
    emitEggs()
  }
  return hatched[0]
}

// Hatches one of the player's stored eggs (Items window): free, with its normal odds and
// animation. False, saying why, while a hatch is playing or the inventory is full.
export function hatchStored(id) {
  if (!(game.storedEggs[id] > 0) || !EGG_SHOP[id]) return false
  if (eggState.hatch) return false
  if (game.pets.length >= EGGS.inventoryMax) {
    eggMessage('Pets full!', `Delete some pets (max ${EGGS.inventoryMax})`)
    return false
  }
  return takeStoredEgg(id) && !!hatchFree(id)
}

export function finishHatch() {
  const done = eggState.hatch
  eggState.hatch = null
  emitEggs()
  if (!done || !eggState.auto) return
  setTimeout(() => {
    if (!eggState.auto || eggState.open !== done.egg) return
    if (!tryHatch(last.egg, last.count)) {
      eggState.auto = false
      emitEggs()
    }
  }, EGGS.autoDelayMs)
}

export function toggleAuto(id) {
  eggState.auto = !eggState.auto
  emitEggs()
  if (eggState.auto && !eggState.hatch && !tryHatch(id, last.egg === id ? last.count : 1)) {
    eggState.auto = false
    emitEggs()
  }
}
