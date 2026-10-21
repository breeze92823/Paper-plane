// The pads the player steps on, after Stone-Skipping's pool pads and Skill Stones yard:
//  - the Rebirth Training Pads (east of the plaza): standing still on one throws at its prize
//    (throw.js) for the equipped plane's Power x the pad's multiplier, once the player has
//    the rebirths it needs (the two gamepass pads stay locked until gems are sold);
//  - the Plane Hall's purchase pads: stepping on one buys its plane for Wins, or equips it
//    once owned. The equipped plane sets the Power per throw and the paper's colour.
// Anything worth telling the player goes out through takePadMessages() for the HUD.
import { MAP } from './config.js'
import { formatNumber } from './hud.js'
import { player } from './player.js'
import { buyPlane, equipPlane, game } from './store.js'
import { parseAmount } from './progression.js'
import { sfx } from './sfx.js'

const tr = MAP.trainingRow
const TRAIN_TOP = 0.6 // a training pad's rim top (map.js: PAD_BASE + PAD_H)
const PRIZE_INSET = 2.2 // the prize stands this far in from the pad's east end (map.js prizeX)
const PRIZE_Y = 2.9 // prize centre above the pad top (map.js)
const HALL_PAD_R = 2.1 // m from a purchase pad's centre that counts as standing on it

export const TRAINING = MAP.trainingPads.map((pad, i) => ({
  index: i,
  z: tr.z0 + i * tr.spacing,
  mult: pad.mult,
  rebirths: pad.rebirths ?? 0,
  gems: pad.gems ?? 0,
  prize: { x: tr.x1 - PRIZE_INSET, y: TRAIN_TOP + PRIZE_Y },
}))

// MAP.pads with their Power per throw and price as numbers.
export const PLANES = MAP.pads.map((pad) => ({ ...pad, perThrow: parseAmount(pad.power), cost: pad.wins === null ? 0 : parseAmount(pad.wins) }))

export const isTrainingUnlocked = (pad) => !pad.gems && game.rebirths >= pad.rebirths

// The training pad the player stands on (anywhere west of its prize), or null.
export const padState = { training: null }

let hallPad = -1
const messages = []
// [{ title, sub, tone: 'good' | 'bad' }] since the HUD last asked.
export function takePadMessages() {
  return messages.splice(0)
}

// Call once per frame after the player moves.
export function stepPads() {
  const p = player.position
  const was = padState.training
  padState.training =
    TRAINING.find((t) => p.x >= tr.x0 && p.x <= t.prize.x - 1.6 && Math.abs(p.z - t.z) <= tr.w / 2 && p.y >= TRAIN_TOP - 0.05 && p.y < TRAIN_TOP + 0.3) ?? null
  const t = padState.training
  if (t && t !== was && !isTrainingUnlocked(t)) {
    sfx.denied()
    messages.push(
      t.gems
        ? { title: `🔒 ⬢ ${t.gems} Gamepass`, sub: `x${t.mult} Power: coming soon`, tone: 'bad' }
        : { title: `🔒 ${t.rebirths} Rebirth${t.rebirths === 1 ? '' : 's'}`, sub: `needed for x${t.mult} Power`, tone: 'bad' },
    )
  }

  // Only on stepping on, so standing there doesn't repeat it.
  const i = player.grounded ? PLANES.findIndex((pl) => Math.hypot(p.x - pl.x, p.z - pl.z) <= HALL_PAD_R) : hallPad
  if (i !== hallPad) {
    hallPad = i
    if (i >= 0) onHallPad(i)
  }
}

function onHallPad(i) {
  const pl = PLANES[i]
  const perThrow = `${pl.power} 💪 per throw`
  if (game.equippedPlane === i) return
  if (game.ownedPlanes.includes(i)) {
    equipPlane(i)
    sfx.equip()
    messages.push({ title: '✈️ Equipped!', sub: perThrow, tone: 'good' })
  } else if (buyPlane(i, pl.cost)) {
    sfx.buy()
    messages.push({ title: '✈️ Bought!', sub: perThrow, tone: 'good' })
  } else {
    sfx.denied()
    messages.push({ title: `🏆 ${pl.wins} Wins`, sub: `needed: you have ${formatNumber(game.wins)}`, tone: 'bad' })
  }
}
