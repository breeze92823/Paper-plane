// Travel between the worlds (config.js WORLDS, PORTAL). The lobby portal (eggs.js) calls
// travel(), which reloads the page into the other world. A signed-in player's save reaches
// the server first (net.js flushProgress), so the new page loads the same numbers; a guest's
// progress, which lives only in this page, rides across in sessionStorage (carryKey) and
// restoreCarry() puts it back on boot. Either way the player arrives exactly as they left.
import { PORTAL, WORLD, WORLDS } from './config.js'
import { adoptCarried, flushProgress, progressPayload } from './net.js'
import { getStableUserId } from './bloxity.js'
import { game, hydrate, setAutoThrow, unlockWorld2 } from './store.js'

// Whether the portal lets this player through: free going home, else enough Power, or the
// Ice World already unlocked once (it stays open after a rebirth resets Power).
export const canEnter = () => PORTAL.power <= 0 || game.world2Unlocked || game.power >= PORTAL.power

let travelling = false
export const isTravelling = () => travelling

// Sets off for PORTAL.to. False (staying put) if already on the way or storage is blocked,
// since without sessionStorage the reload would only come back here.
export async function travel() {
  if (travelling) return false
  const to = PORTAL.to
  if (to === 2) unlockWorld2()
  try {
    sessionStorage.setItem(WORLDS.storageKey, String(to))
    if (to === 2) sessionStorage.setItem(WORLDS.unlockKey, '1')
  } catch {
    return false
  }
  travelling = true
  const saved = await flushProgress(WORLDS.saveWaitMs)
  try {
    const carry = { ...progressPayload(), autoThrow: game.autoThrow, from: WORLD, userId: getStableUserId(), saved }
    sessionStorage.setItem(WORLDS.carryKey, JSON.stringify(carry))
  } catch {
    // Nothing carried: a signed-in player still loads the save, a guest starts over.
  }
  location.reload()
  return true
}

// On boot: the progress travel() handed across, applied once and then dropped (so a plain
// reload later doesn't bring back stale numbers). Returns the world we came from, or null.
export function restoreCarry() {
  let raw = null
  try {
    raw = sessionStorage.getItem(WORLDS.carryKey)
    sessionStorage.removeItem(WORLDS.carryKey)
  } catch {
    return null
  }
  if (!raw) return null
  let carry
  try {
    carry = JSON.parse(raw)
  } catch {
    return null
  }
  if (!carry || typeof carry !== 'object') return null
  hydrate(carry)
  if (carry.autoThrow === true) setAutoThrow(true)
  // The server's copy is the same (or older, if the final save didn't land): keep these.
  if (carry.userId) adoptCarried(carry.userId)
  return carry.from === 1 || carry.from === 2 ? carry.from : null
}
