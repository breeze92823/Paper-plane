// Everyone else in the shared lobby (net.js's roster), after Stone-Skipping's
// RemotePlayers.jsx. Each one is the same character main.js builds for the local
// player (the game's own rig dressed with the sender's Bloxity cosmetics, skin and
// proportions), animated by the same animator and holding a paper plane in their
// equipped plane's colour, with a nametag above. Their tosses (the relayed `throw`) play
// the same toss animation and send a plane flying through throw.js, earning us nothing.
// Position, yaw and gait are read off
// the synced PlayerState every frame and eased, since net.js only relays a sample
// every NET.moveSendIntervalMs.
import { Group, Quaternion, Sprite, SpriteMaterial, Vector3 } from 'three'
import { ANIM, MAP, PHYSICS, REMOTE_PLAYER as R, THROW } from './config.js'
import { subscribeRoster } from './net.js'
import { launchRemote } from './throw.js'
import { TRAINING } from './pads.js'
import { loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { HeldPlane } from './avatar/heldPlane.js'
import { paintSign, toTexture } from './textures.js'

function parseAvatar(raw) {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' ? v : null
  } catch {
    return null
  }
}

const planeColor = (i) => (MAP.pads[i] ?? MAP.pads[0]).plane
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from))
const RELEASE_DELAY = ANIM.toss.releaseAt * ANIM.toss.duration // s from toss start to release, as in throw.js
const HAND_Y = 1.2 // m: where a plane leaves from when the rig isn't loaded yet
const _pos = new Vector3()
const _quat = new Quaternion()

// The yaw a relayed toss faces (throw.js turns the thrower the same way), or null.
function tossFacing(toss, x, z) {
  if (toss.kind === 'street') return Math.PI // straight up the street (-Z)
  if (toss.kind === 'pad') {
    const pad = TRAINING[toss.pad]
    return pad ? Math.atan2(pad.prize.x - x, pad.z - z) : null
  }
  return Math.atan2(toss.dx, toss.dz)
}

class RemotePlayer {
  // `root` is an unmoved group: the held plane is world-space (its update() places it
  // at the fist), so it can't ride inside the moving character group.
  constructor(p, root) {
    this.p = p
    this.object = new Group()
    this.object.name = 'remotePlayer'
    root.add(this.object)
    this.heldPlane = new HeldPlane()
    root.add(this.heldPlane.object)
    this.avatar = null
    this.animator = null
    this.avatarRaw = null
    this.plane = -1
    this.generation = 0
    this.abort = null
    this.placed = false
    this.vy = 0
    this.pendingToss = null // { t, toss }: toss playing, plane not yet released
    this.reloadTimer = 0 // s until a fresh plane grows into the empty hand

    this.tagCanvas = document.createElement('canvas')
    this.tag = new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false }))
    this.tag.renderOrder = 2
    this.tagText = null
    this.object.add(this.tag)
  }

  // Rebuilt whenever the sender's avatar payload changes; only the newest load may land.
  async build(raw) {
    const mine = ++this.generation
    this.abort?.abort()
    const abort = (this.abort = new AbortController())
    const parsed = parseAvatar(raw) || {}
    const group = await loadBaseCharacter()
    if (mine !== this.generation) return
    await attachEquippedAccessories(group, parsed.equipped || null, { signal: abort.signal, skinTextureUrl: parsed.skin || null })
    if (mine !== this.generation) return
    applyProportions(group, parsed.proportions || null)
    if (this.avatar) this.object.remove(this.avatar)
    disposeAnimator(this.animator)
    this.avatar = group
    this.object.add(group)
    this.heldPlane.attach(group) // both bind against the rig's rest pose, before the first update
    this.animator = makeAnimator(group, { carrying: true })
  }

  paintTag() {
    const p = this.p
    const text = `${p.username || 'Player'}|${p.level}`
    if (text === this.tagText) return
    this.tagText = text
    const aspect = paintSign(this.tagCanvas, [
      { text: p.username || 'Player', color: '#ffffff', size: 44 },
      { text: `Lv ${p.level}`, color: '#ffd84a', size: 34 },
    ])
    const m = this.tag.material
    m.map?.dispose()
    m.map = toTexture(this.tagCanvas, { repeat: false })
    m.needsUpdate = true
    this.tag.scale.set(R.nametagHeight * 1.9 * aspect, R.nametagHeight * 1.9, 1)
  }

  // A relayed `throw` (net.js): face it, play the toss, and release the plane at the same
  // point in the toss as throw.js does. Ignored until we've seen where this player is.
  toss(toss) {
    if (!this.placed) return
    const facing = tossFacing(toss, this.object.position.x, this.object.position.z)
    if (facing === null) return
    if (this.pendingToss) this.release() // a toss cut short by the next: don't drop the first plane
    this.object.rotation.y = facing
    this.animator?.toss()
    this.pendingToss = { t: RELEASE_DELAY, toss }
  }

  release() {
    const { toss } = this.pendingToss
    this.pendingToss = null
    if (this.heldPlane.socket) {
      this.heldPlane.worldPose(_pos, _quat)
    } else {
      _pos.copy(this.object.position).setY(this.object.position.y + HAND_Y)
      _quat.setFromEuler(this.object.rotation)
    }
    launchRemote(_pos, _quat, toss, planeColor(this.p.equippedPlane))
    this.heldPlane.setInHand(false)
    this.reloadTimer = THROW.reloadTime
  }

  update(dt) {
    const p = this.p
    if (p.avatar !== this.avatarRaw) {
      this.avatarRaw = p.avatar
      this.build(p.avatar)
    }
    if (p.equippedPlane !== this.plane) {
      this.plane = p.equippedPlane
      this.heldPlane.setColor(planeColor(this.plane))
    }
    this.paintTag()

    const o = this.object
    const prevY = o.position.y
    if (!this.placed) {
      // Until its first `move`, a session sits at the schema's default (0, 0, 0), a spot
      // no real player stands on (SPAWN is 0.3 up): keep it hidden rather than pop it
      // into the plaza and slide it over.
      const reported = p.x !== 0 || p.y !== 0 || p.z !== 0
      o.visible = this.heldPlane.object.visible = reported
      if (!reported) return
      this.heldPlane.setInHand(true)
      o.position.set(p.x, p.y, p.z)
      o.rotation.y = p.yaw
      this.placed = true
    } else {
      const k = 1 - Math.pow(R.lerpRate, dt)
      o.position.x += (p.x - o.position.x) * k
      o.position.y += (p.y - o.position.y) * k
      o.position.z += (p.z - o.position.z) * k
      o.rotation.y += angleTo(o.rotation.y, p.yaw) * k
    }
    // `move` carries no grounded flag: a smoothed vertical speed tells a jump from a walk.
    if (dt > 0) this.vy += ((o.position.y - prevY) / dt - this.vy) * (1 - Math.exp(-10 * dt))
    const grounded = Math.abs(this.vy) < R.airborneSpeed
    this.tag.position.set(0, R.nametagY * (this.avatar?.scale.y / this.avatar?.scale.x || 1), 0)

    this.animator?.update(dt, { grounded, speed: p.moveBlend * PHYSICS.moveSpeed, verticalVelocity: this.vy, turn: 0 })
    this.heldPlane.update(dt, {
      facing: o.rotation.y,
      grounded,
      fly: this.animator?.fly ?? 0,
      inspect: this.animator?.inspect ?? 0,
      wristYaw: this.animator?.wristYaw ?? 0,
    })

    if (this.pendingToss && (this.pendingToss.t -= dt) <= 0) this.release()
    if (this.reloadTimer > 0 && (this.reloadTimer -= dt) <= 0) this.heldPlane.setInHand(true, THROW.popTime)
  }

  dispose() {
    this.generation++
    this.abort?.abort()
    disposeAnimator(this.animator)
    this.heldPlane.dispose()
    this.tag.material.map?.dispose()
    this.tag.material.dispose()
    this.object.removeFromParent()
  }
}

// Add `object` to the scene once and call update(dt) every frame.
export class RemotePlayers {
  constructor() {
    this.object = new Group()
    this.object.name = 'remotePlayers'
    this.players = new Map()
    subscribeRoster(
      (sessionId, p) => {
        this.players.get(sessionId)?.dispose()
        this.players.set(sessionId, new RemotePlayer(p, this.object))
      },
      (sessionId) => {
        this.players.get(sessionId)?.dispose()
        this.players.delete(sessionId)
      },
      (sessionId, toss) => this.players.get(sessionId)?.toss(toss),
    )
  }

  update(dt) {
    for (const rp of this.players.values()) rp.update(dt)
  }
}
