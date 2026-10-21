// Daily rewards, the client half (DAILY in config.js; the window is dailyUi.js): which days
// can be claimed, the countdown to the next one, and handing out what a claim grants.
//  - Signed in (with a server): the calendar lives on the server (Paper-plane-backend
//    src/daily.ts). It decides every claim and sends back the reward to apply, so a reward
//    is never granted twice across tabs, reloads or devices. Until its calendar arrives
//    nothing is claimable ('waiting'), and claims wait for a connection.
//  - A guest, or a build with no server: the calendar is kept in this browser (localStorage)
//    and claims are decided here by the same rules.
// Countdowns run on the server's clock when there is one (its `now` sets an offset).
// Potions and eggs go into the Items window (Potions / Eggs) to drink or hatch later; a pet
// joins the pets straight away.
import { DAILY, EGG_SHOP, EGGS, NET } from './config.js'
import { getStableUserId, subscribeAuth } from './bloxity.js'
import { claimDaily as sendClaim, netState, onDaily } from './net.js'
import { game, grantPet, storeEgg, storePotion } from './store.js'
import { sfx } from './sfx.js'

export const DAYS = DAILY.days.length

// mode: 'local' | 'server' | 'waiting'. pending: the day a server claim is out for.
const state = { mode: 'local', start: 0, claimed: [], dayMs: DAILY.dayMs, offset: 0, pending: null }

const listeners = new Set()
// Calls fn() whenever the calendar changes (not every second: countdowns are the UI's).
export function subscribeDaily(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const emit = () => listeners.forEach((fn) => fn())

const messages = []
// [{ title, sub, tone }] for the HUD popup since it last asked.
export function takeDailyMessages() {
  return messages.splice(0)
}
// A reward chimes, a refusal knocks (sfx.js).
const say = (title, sub, tone = null) => {
  if (tone === 'bad') sfx.denied()
  else if (tone === 'good') sfx.reward()
  messages.push({ title, sub, tone })
}

const now = () => Date.now() + state.offset
const unlockAt = (day) => state.start + (day - 1) * state.dayMs

// --- The calendar -------------------------------------------------------------------
// Every day's status for the window: 'claimed', 'ready' (claimable now), 'next' (the first
// still locked; `left` ms until it opens), 'locked'. `pending` marks a claim in flight.
export function calendar() {
  const t = now()
  let nextShown = false
  return DAILY.days.map((info, i) => {
    const day = i + 1
    let status = 'locked'
    let left = 0
    if (state.mode === 'waiting') status = 'locked'
    else if (state.claimed.includes(day)) status = 'claimed'
    else if (t >= unlockAt(day)) status = 'ready'
    else if (!nextShown) {
      nextShown = true
      status = 'next'
      left = unlockAt(day) - t
    }
    return { day, info, status, left, pending: state.pending === day }
  })
}

export const anyReady = () => calendar().some((d) => d.status === 'ready')
export const dailyMode = () => state.mode

// The same rules as the server's claimDaily (backend src/daily.ts), for a guest's calendar.
function claimLocal(day) {
  const claimed = [...state.claimed, day].sort((a, b) => a - b)
  if (claimed.length >= DAYS) {
    state.start = Math.max(state.start + DAYS * state.dayMs, now())
    state.claimed = []
  } else state.claimed = claimed
  saveLocal()
}

// --- Claiming -----------------------------------------------------------------------
// Claims `day` if it's ready. A pet needs room in the inventory first.
export function claim(day) {
  const entry = calendar()[day - 1]
  if (!entry || entry.status !== 'ready' || state.pending) return false
  const { reward } = entry.info
  if (reward.kind === 'pet' && game.pets.length >= EGGS.inventoryMax) {
    say('Pets full!', `Delete some pets (max ${EGGS.inventoryMax})`, 'bad')
    return false
  }
  if (state.mode === 'server') {
    if (netState.status !== 'online' || !sendClaim(day)) {
      say('Reconnecting…', 'Try again in a moment', 'bad')
      return false
    }
    state.pending = day
    emit()
    return true
  }
  claimLocal(day)
  grant(reward, day)
  emit()
  return true
}

// Hands out a reward (the server's, for a signed-in claim) and says what it was.
function grant(reward, day) {
  if (!reward || typeof reward !== 'object') return
  if (reward.kind === 'boost' && (reward.stat === 'power' || reward.stat === 'wins') && reward.ms > 0) {
    storePotion(reward.stat, reward.ms)
    say(`🧪 x2 ${reward.stat === 'power' ? 'Power' : 'Wins'} potion!`, 'Drink it from Items → Potions', 'good')
  } else if (reward.kind === 'pet' && typeof reward.egg === 'string' && typeof reward.name === 'string') {
    const pet = EGG_SHOP[reward.egg]?.pets.find((p) => p.name === reward.name)
    if (pet && grantPet(reward.egg, reward.name)) say(`${pet.emoji} ${pet.name}!`, `Day ${day}: added to your pets`, 'good')
  } else if (reward.kind === 'egg' && EGG_SHOP[reward.egg]) {
    storeEgg(reward.egg)
    say(`🥚 ${EGG_SHOP[reward.egg].name}!`, 'Hatch it from Items → Eggs', 'good')
  }
}

// --- Where the calendar lives ---------------------------------------------------------
function loadLocal() {
  let saved = null
  try {
    saved = JSON.parse(localStorage.getItem(DAILY.storageKey) || 'null')
  } catch {
    // Blocked or junk storage: start a fresh calendar.
  }
  const t = Date.now()
  const ok = saved && typeof saved.start === 'number' && Number.isFinite(saved.start)
  state.mode = 'local'
  state.offset = 0
  state.dayMs = DAILY.dayMs
  state.pending = null
  state.start = ok ? Math.min(saved.start, t) : t
  state.claimed = ok && Array.isArray(saved.claimed) ? [...new Set(saved.claimed.filter((d) => Number.isInteger(d) && d >= 1 && d <= DAYS))] : []
  if (!ok) saveLocal()
  emit()
}

function saveLocal() {
  try {
    localStorage.setItem(DAILY.storageKey, JSON.stringify({ start: state.start, claimed: state.claimed }))
  } catch {
    // Storage blocked: the calendar lasts this visit.
  }
}

// The server's calendar for this account: { start, claimed, now, dayMs }.
function applyView(view) {
  if (!view || typeof view.start !== 'number' || typeof view.now !== 'number') return
  state.mode = 'server'
  state.start = view.start
  state.claimed = Array.isArray(view.claimed) ? view.claimed.filter((d) => Number.isInteger(d)) : []
  state.dayMs = view.dayMs > 0 ? view.dayMs : DAILY.dayMs
  state.offset = view.now - Date.now()
}

// A signed-in player waits for the server's calendar; anyone else uses this browser's.
function syncIdentity() {
  if (getStableUserId() && NET.serverUrl) {
    if (state.mode === 'local') {
      state.mode = 'waiting'
      state.pending = null
      emit()
    }
  } else if (state.mode !== 'local') loadLocal()
}

export function initDaily() {
  loadLocal()
  onDaily({
    onCalendar(view) {
      if (view) applyView(view)
      else loadLocal() // signed out: back to this browser's calendar
      state.pending = null
      emit()
    },
    onClaimed(msg) {
      state.pending = null
      applyView(msg?.daily)
      grant(msg?.reward, msg?.day)
      emit()
    },
    onDenied(msg) {
      state.pending = null
      if (msg?.daily) applyView(msg.daily)
      const why = { locked: 'Not open yet', claimed: 'Already claimed', signin: 'Sign in to claim' }[msg?.reason] ?? 'Try again later'
      say(`Day ${msg?.day ?? ''}`, why, 'bad')
      emit()
    },
  })
  subscribeAuth(syncIdentity)
  syncIdentity()
}
