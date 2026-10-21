// Multiplayer presence: the ONLY module that talks to the Colyseus server
// (../Paper-plane-backend's LobbyRoom), after Stone-Skipping's systems/net.js. Like
// bloxity.js, every path through here leaves the game fully playable solo when the
// server is slow, asleep or absent: nothing blocks gameplay and the scene never waits
// on a socket.
//
// Covers: position/avatar relay and the remote-player roster (remotePlayers.js), live
// stats, the durable save/load for a signed-in player, and the merged leaderboards.
import {
  authState,
  getDisplayName,
  getEquippedAvatar,
  getProportions,
  getSkinTextureUrl,
  getStableUserId,
  onAvatarChanged,
  onProportionsChanged,
  subscribeAuth,
} from './bloxity.js'
import { NET } from './config.js'
import { player } from './player.js'
import { game, hydrate, subscribe as subscribeStore } from './store.js'

// --- Public state -----------------------------------------------------------
//   'idle'       not started / torn down / no server configured
//   'connecting' a join attempt is in flight
//   'solo'       between retry attempts: playing single-player right now
//   'online'     attached to a room
export const netState = { status: 'idle', playerCount: 0, error: null }

const listeners = new Set()

// Calls fn(netState) on every change; returns an unsubscribe function.
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit() {
  for (const fn of listeners) {
    try {
      fn(netState)
    } catch {
      // A broken subscriber must not wedge the netcode.
    }
  }
}

function setStatus(status) {
  netState.status = status
  emit()
}

// --- Remote players ---------------------------------------------------------
// sessionId -> the OTHER player's live PlayerState schema instance. Colyseus patches
// its fields in place, so remotePlayers.js reads e.g. `p.x` every frame with no
// callback; only joining and leaving need one.
const remotePlayers = new Map()
const rosterListeners = new Set()

function notifyRoster(kind, sessionId, arg) {
  for (const l of rosterListeners) {
    try {
      l[kind]?.(sessionId, arg)
    } catch (err) {
      console.warn('[net] roster listener threw', err)
    }
  }
}

// Replays the current roster at once, so a late subscriber doesn't miss anyone.
// onThrow(sessionId, toss) gets another player's relayed `throw` (see reportToss).
export function subscribeRoster(onAdd, onRemove, onThrow) {
  const entry = { onAdd, onRemove, onThrow }
  rosterListeners.add(entry)
  for (const [sessionId, p] of remotePlayers) onAdd(sessionId, p)
  return () => rosterListeners.delete(entry)
}

// --- Connection state -------------------------------------------------------
let sdkModule = null
let client = null
let room = null
let selfId = ''
let started = false
let stopped = true
let connecting = false
let attempt = 0
let retryTimer = 0

const EMPTY_BOARDS = { level: [], playTime: [], power: [], wins: [] }
let leaderboards = EMPTY_BOARDS

// The merged all-time + online rows for one board ('level' | 'playTime' | 'power' |
// 'wins'), as { id, name, value }. Empty until the server's first broadcast, or offline.
export function getLeaderboard(stat) {
  return leaderboards[stat] || []
}

// Our own session id (the `id` of our row on the leaderboards), '' while offline.
export function getSelfId() {
  return selfId
}

async function loadSdk() {
  sdkModule ||= await import('@colyseus/sdk')
  return sdkModule
}

function send(type, payload) {
  if (!room) return
  try {
    room.send(type, payload)
  } catch {
    // Socket mid-close: the next attach re-sends everything anyway.
  }
}

// --- Stats + durable progress -------------------------------------------------
function statsPayload() {
  return { power: game.power, wins: game.wins, rebirths: game.rebirths, bestDistance: game.bestDistance, equippedPlane: game.equippedPlane }
}

function progressPayload() {
  return { ...statsPayload(), furthestZone: game.furthestZone, ownedPlanes: [...game.ownedPlanes] }
}

// The ROOM decides whether this session may persist (its userIds map), so a save sent
// just after a logout lands there as a harmless no-op.
const sendStatsNow = () => send('stats', statsPayload())
const sendProgressNow = () => send('saveProgress', progressPayload())

let statsTimer = 0
let progressTimer = 0
let lastSnap = ''

// The store tells every change (Auto Throw too), so filter to the fields we send.
function onStoreChange(g) {
  const snap = JSON.stringify([g.power, g.wins, g.rebirths, g.bestDistance, g.furthestZone, g.equippedPlane, g.ownedPlanes.length])
  if (snap === lastSnap) return
  lastSnap = snap
  if (!statsTimer) {
    statsTimer = setTimeout(() => {
      statsTimer = 0
      sendStatsNow()
    }, NET.statsDebounceMs)
  }
  if (getStableUserId() && !progressTimer) {
    progressTimer = setTimeout(() => {
      progressTimer = 0
      sendProgressNow()
    }, NET.progressDebounceMs)
  }
}

// Applied at most once per IDENTITY: the first `progress` under the current sign-in is
// the real load. A later reattach under the SAME identity would otherwise clobber what
// the player did locally during a blip.
let hydratedFromServer = false

// --- Avatar + position relay ------------------------------------------------
// The same recipe main.js dresses the local player with: the game's own character plus
// the signed-in player's equipped Bloxity cosmetics, skin and proportions. Sent as an
// opaque JSON string (the server never parses it) so remotePlayers.js can rebuild an
// identical-looking character for every other session.
function avatarPayload() {
  const signedIn = !!authState.user
  return {
    equipped: signedIn ? getEquippedAvatar() : null,
    skin: signedIn ? getSkinTextureUrl() : null,
    proportions: getProportions(),
  }
}

let lastSentAvatar = ''

function sendAvatarNow() {
  if (!room) return
  const payload = JSON.stringify(avatarPayload())
  if (payload === lastSentAvatar) return
  lastSentAvatar = payload
  send('setAvatar', { avatar: payload })
}

// Local position/facing/gait, throttled out over `move`. Call every frame; a no-op
// while offline.
let moveAccumMs = 0
let lastSentMove = null
const MOVE_EPS = 0.01

export function reportLocal(dt) {
  if (!room) return
  moveAccumMs += dt * 1000
  if (moveAccumMs < NET.moveSendIntervalMs) return
  moveAccumMs = 0

  const moveBlend = Math.min(1, Math.hypot(player.velocity.x, player.velocity.z) / player.moveSpeed)
  const next = { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.facing, moveBlend }
  const last = lastSentMove
  if (last && Object.keys(next).every((k) => Math.abs(next[k] - last[k]) < MOVE_EPS)) return
  lastSentMove = next
  send('move', next)
}

// A toss we just started (throw.js's takeTosses()), so everyone else plays it too.
// The server drops any faster than a real toss cadence. A no-op while offline.
export function reportToss(toss) {
  send('throw', toss)
}

// --- Identity sync (login/logout mid-session) -------------------------------
// Join options only carry what was true the instant the socket opened; Bloxity auth
// routinely settles later or changes without a reload.
let lastIdentity = { userId: '', username: '' }

function sendIdentityNow() {
  if (!room) return
  const userId = getStableUserId()
  const username = getDisplayName()
  if (userId === lastIdentity.userId && username === lastIdentity.username) return

  // Flush this session's progress under the OLD id before the room forgets it.
  if (lastIdentity.userId && lastIdentity.userId !== userId) sendProgressNow()
  // A freshly signed-in id gets its saved doc hydrated, like a brand-new join.
  if (userId && userId !== lastIdentity.userId) hydratedFromServer = false

  lastIdentity = { userId, username }
  send('identify', { userId, username })
  sendAvatarNow() // signing in/out flips avatarPayload()'s cosmetics
}

function waitForAuth(ms) {
  if (authState.ready) return Promise.resolve()
  return new Promise((resolve) => {
    let done = false
    let off = null
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(t)
      off?.()
      resolve()
    }
    const t = setTimeout(finish, ms)
    off = subscribeAuth((s) => {
      if (s.ready) finish()
    })
    if (done) off()
  })
}

function withTimeout(promise, ms, label) {
  let t
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(label)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t))
}

// --- Connect / attach / retry ---------------------------------------------
async function connect() {
  if (stopped || connecting || room) return
  connecting = true
  clearTimeout(retryTimer)
  retryTimer = 0
  setStatus('connecting')

  try {
    const mod = await loadSdk()
    if (stopped) return
    client ||= new mod.Client(NET.serverUrl)

    // The SDK's Room rides out brief socket drops itself; this is only the first join
    // and the fallback once that recovery gives up (room.onLeave).
    const joined = await withTimeout(
      client.joinOrCreate(NET.room, {
        username: getDisplayName(),
        userId: getStableUserId(), // '' for a guest: nothing to load or save
        // Seeds PlayerState.avatar so others render us right from the first frame.
        avatar: JSON.stringify(avatarPayload()),
      }),
      NET.joinTimeoutMs,
      'join timed out',
    )

    if (stopped) {
      try {
        joined.leave()
      } catch {
        // Nothing to clean up.
      }
      return
    }
    attachRoom(joined)
  } catch (err) {
    connecting = false
    attempt += 1
    netState.error = String(err?.message || err)
    if (!stopped) scheduleRetry()
  }
}

function scheduleRetry() {
  if (stopped || room || retryTimer) return
  setStatus('solo')
  const backoff = NET.retryBackoffMs
  retryTimer = setTimeout(() => {
    retryTimer = 0
    connect()
  }, backoff[Math.min(Math.max(attempt - 1, 0), backoff.length - 1)])
}

function recount() {
  const n = room?.state?.players ? room.state.players.size : 0
  if (n === netState.playerCount) return
  netState.playerCount = n
  emit()
}

function attachRoom(joined) {
  room = joined
  connecting = false
  attempt = 0
  selfId = joined.sessionId
  netState.error = null

  room.onLeave(() => handleLeave())
  room.onError((code, message) => {
    netState.error = message || `error ${code}`
  })

  // The saved doc for our Bloxity user id, sent once right after join or identify.
  room.onMessage('progress', (msg) => {
    if (hydratedFromServer) return
    hydratedFromServer = true
    hydrate(msg || {})
  })
  // A brand-new account has no save yet: keep playing on local progress.
  room.onMessage('noProgress', () => {})
  // Another player's toss; the server never echoes our own back.
  room.onMessage('throw', (msg) => {
    if (msg && remotePlayers.has(msg.id)) notifyRoster('onThrow', msg.id, msg)
  })
  room.onMessage('leaderboard', (msg) => {
    leaderboards = msg || EMPTY_BOARDS
    emit()
  })

  // Registered unconditionally: room.state can still be an empty shell right after
  // joinOrCreate() resolves, and getStateCallbacks() defers registration until the
  // `players` map arrives.
  const $ = sdkModule.getStateCallbacks(room)
  $(room.state).players.onAdd((p, sessionId) => {
    recount()
    if (sessionId === selfId) return
    remotePlayers.set(sessionId, p)
    notifyRoster('onAdd', sessionId, p)
  })
  $(room.state).players.onRemove((_p, sessionId) => {
    recount()
    if (sessionId === selfId) return
    remotePlayers.delete(sessionId)
    notifyRoster('onRemove', sessionId)
  })

  // A fresh session starts every server field at its default, so re-state ours now.
  sendStatsNow()
  lastSentAvatar = ''
  sendAvatarNow()
  lastSentMove = null
  moveAccumMs = NET.moveSendIntervalMs // send on the very next reportLocal()
  // Join options already carried this identity; only resend on a REAL change.
  lastIdentity = { userId: getStableUserId(), username: getDisplayName() }

  recount()
  setStatus('online')
}

function clearRemotePlayers() {
  for (const sessionId of remotePlayers.keys()) notifyRoster('onRemove', sessionId)
  remotePlayers.clear()
}

function handleLeave() {
  room = null
  selfId = ''
  connecting = false
  netState.playerCount = 0
  leaderboards = EMPTY_BOARDS
  clearRemotePlayers() // those characters belonged to the room we just lost

  if (stopped) return
  attempt = 0
  scheduleRetry()
}

// --- Lifecycle --------------------------------------------------------------
const offs = []

export function init() {
  if (started) return
  started = true
  stopped = false
  // No server configured for this build: stay 'idle'; every export no-ops without a room.
  if (!NET.serverUrl) return

  offs.push(
    subscribeStore(onStoreChange),
    // subscribeAuth fires on every auth event; sendIdentityNow()'s own diff filters them.
    subscribeAuth(() => sendIdentityNow()),
    // Anything that changes avatarPayload(), so others see an equip or proportion edit.
    onAvatarChanged(() => sendAvatarNow()),
    onProportionsChanged(() => sendAvatarNow()),
  )
  waitForAuth(NET.authWaitMs).then(() => {
    if (!stopped) connect()
  })
}

export function teardown() {
  stopped = true
  started = false
  clearTimeout(retryTimer)
  clearTimeout(statsTimer)
  clearTimeout(progressTimer)
  retryTimer = statsTimer = progressTimer = 0
  for (const off of offs.splice(0)) off()
  clearRemotePlayers()
  // Final best-effort save; room.send() is fire-and-forget so it never delays leave().
  sendProgressNow()
  if (room) {
    try {
      // Don't let the SDK reconnect a socket we are deliberately closing.
      if (room.reconnection) room.reconnection.enabled = false
      room.leave()
    } catch {
      // The page is going away.
    }
  }
  room = null
  connecting = false
  leaderboards = EMPTY_BOARDS
  netState.playerCount = 0
  setStatus('idle')
}
