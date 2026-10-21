// The player's core action, after Stone-Skipping's stoneActions.js: the primary
// action (left click, F, the touch THROW button) plays the overhand toss, the plane
// leaves the hand ANIM.toss.releaseAt into it, and a new one grows into the hand
// THROW.reloadTime later. Holding the action keeps throwing. Thrown planes are a plain
// array singleton rewritten every frame; thrownPlanes.js draws it.
//
// From the Throw Area a plane flies up the street: its range comes from Power, it
// touches down exactly there and pays Wins for the distance, and the camera and the
// sun's shadow box follow it (getTrackedFlight). Standing still on an unlocked training pad
// (pads.js) keeps throwing at its prize, and each hit pays the equipped plane's Power x the
// pad's multiplier. Anywhere else a plane just glides where the camera looks. Auto Throw
// keeps throwing while the player stands in the Throw Area. Planes fly in the equipped colour.
// Other players' tosses (remotePlayers.js, via launchRemote) fly through the same code but
// earn nothing and are never tracked.
import { Object3D, Quaternion, Vector3 } from 'three'
import { inputState } from './input.js'
import { player } from './player.js'
import { getYaw } from './camera.js'
import { floorUnder, segmentClear } from './colliders.js'
import { ANIM, GROUND_Y, HELD_PLANE, MAP, PHYSICS, STREET, THROW } from './config.js'
import { addPower, addWins, game, reachZone, recordDistance } from './store.js'
import { isTrainingUnlocked, padState, PLANES, TRAINING } from './pads.js'
import { clamp, streetReach, streetWinsForDistance, zoneIndexAt } from './progression.js'

// { position, velocity, quaternion, color, sinkVy, age, stalled, landed, lie, fade, done, run, shot, wins, newBest }
// `run` is set for a street throw and `shot` for a training-pad throw (see release); `wins`
// and `newBest` once a street throw has landed.
export const flights = []

const TAU = Math.PI * 2
const RELEASE_DELAY = ANIM.toss.releaseAt * ANIM.toss.duration // s from press to release
const CONTROL_TIME = ANIM.toss.controlAt * ANIM.toss.duration // s until the player can move again
const PRESS_BUFFER = 0.35 // s a tap is remembered while the hand is still empty
const REST_HEIGHT = HELD_PLANE.keelDepth + 0.005 // dart centre above the floor when it lies flat

const smoothstep = (e0, e1, v) => {
  const t = clamp((v - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

let inHand = true
let reloadTimer = 0
let pending = null // { t, dir, street, pad }: toss playing, plane not yet released
let controlTimer = 0
let queued = 0
// The street throw the camera and shadows follow, set on release and cleared
// STREET.trackHold after it lands. Only one at a time, and no new plane comes into the
// hand until it clears, so the camera is home before the next throw.
let tracked = null

export function getTrackedFlight() {
  return tracked
}

// Zones the tracked plane has flown into since the HUD last asked: [{ index, first }], where
// `first` means no plane had reached that zone before.
const zonesEntered = []
export function takeZonesEntered() {
  return zonesEntered.splice(0)
}

// Power earned by training-pad hits since the HUD last asked, one entry per hit.
const gains = []
export function takePowerGains() {
  return gains.splice(0)
}

export function isInThrowArea(x, z) {
  const a = MAP.throwArea
  return x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ
}

const _pos = new Vector3()
const _quat = new Quaternion()
const _prev = new Vector3()
const _nose = new Vector3()
const _aim = new Object3D()

// Call once per frame before the player moves.
export function stepThrow(dt, animator, heldPlane) {
  if (inputState.actionPressed) queued = PRESS_BUFFER
  inputState.actionPressed = false

  if (!inHand && !pending && !tracked) {
    reloadTimer -= dt
    if (reloadTimer <= 0) {
      inHand = true
      heldPlane.setInHand(true, THROW.popTime)
    }
  }

  const p = player.position
  const street = isInThrowArea(p.x, p.z)
  const pad = padState.training && isTrainingUnlocked(padState.training) ? padState.training : null
  const still = inputState.move.x === 0 && inputState.move.z === 0
  const want = queued > 0 || inputState.action || (game.autoThrow && street) || (pad && still)
  queued -= dt
  if (want && inHand && !pending && controlTimer <= 0 && player.grounded && animator) {
    const yaw = getYaw()
    // Street throws go straight up it (north), pad throws at the prize, others where the camera looks.
    const dir = pad
      ? new Vector3(pad.prize.x - p.x, 0, pad.z - p.z).normalize()
      : street
        ? new Vector3(0, 0, -1)
        : new Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
    player.facing = Math.atan2(dir.x, dir.z)
    pending = { t: RELEASE_DELAY, dir, street: street && !pad, pad }
    controlTimer = CONTROL_TIME
    queued = 0
    animator.toss()
    // For net.js to relay, so others see this toss (remotePlayers.js replays it).
    tosses.push(pad ? { kind: 'pad', pad: pad.index } : street ? { kind: 'street', range: streetRange(game.power) } : { kind: 'free', dx: dir.x, dz: dir.z })
  }

  if (controlTimer > 0) controlTimer -= dt
  player.throwing = controlTimer > 0

  if (pending) {
    pending.t -= dt
    if (pending.t <= 0) {
      release(pending, heldPlane)
      pending = null
    }
  }
}

// Tosses started since net.js last asked: { kind: 'street', range } | { kind: 'pad', pad }
// | { kind: 'free', dx, dz } (Paper-plane-backend's `throw` message).
const tosses = []
export function takeTosses() {
  return tosses.splice(0)
}

// Metres up the street a Throw Area plane flies, from Power alone.
const streetRange = (power) => streetReach(power) * STREET.length

function release({ dir, street, pad }, heldPlane) {
  heldPlane.worldPose(_pos, _quat)
  heldPlane.setInHand(false)
  inHand = false
  reloadTimer = THROW.reloadTime
  const flight = launch(_pos, _quat, dir, {
    color: PLANES[game.equippedPlane].plane,
    range: street ? streetRange(game.power) : null,
    pad,
    power: pad ? PLANES[game.equippedPlane].perThrow * pad.mult : 0,
  })
  if (flight.run && !tracked) tracked = flight
}

// Another player's toss (remotePlayers.js), released from their hand at `position`,
// `quaternion`: flies exactly like ours but earns nothing, and the camera ignores it.
// `toss` is the relayed `throw` message; a malformed one throws nothing.
export function launchRemote(position, quaternion, toss, color) {
  if (toss.kind === 'street') {
    // Never shorter than a fresh player's throw: a zero range would collapse the run's curve.
    launch(position, quaternion, new Vector3(0, 0, -1), { color, range: clamp(toss.range, streetRange(0), STREET.length), remote: true })
  } else if (toss.kind === 'pad') {
    const pad = TRAINING[toss.pad]
    if (!pad) return
    launch(position, quaternion, new Vector3(pad.prize.x - position.x, 0, pad.z - position.z).normalize(), { color, pad, remote: true })
  } else if (toss.kind === 'free') {
    const len = Math.hypot(toss.dx, toss.dz)
    if (!(len > 1e-6)) return
    launch(position, quaternion, new Vector3(toss.dx / len, 0, toss.dz / len), { color, remote: true })
  }
}

// Adds one plane to `flights`: a street run when `range` is given (metres), a shot at a
// training pad's prize when `pad` is (worth `power` on the hit), else a free glide along
// `dir`. A `remote` plane is someone else's: it pays no Power or Wins and records nothing.
function launch(position, quaternion, dir, { color, range = null, pad = null, power = 0, remote = false }) {
  const vh = THROW.launchSpeed * Math.cos(THROW.launchPitch)
  const vy = THROW.launchSpeed * Math.sin(THROW.launchPitch)
  const flight = {
    position: position.clone(),
    velocity: new Vector3(dir.x * vh, vy, dir.z * vh),
    quaternion: quaternion.clone(),
    color,
    remote,
    sinkVy: vy, // the smooth climb-into-sink, before the swoop is added
    age: 0,
    stalled: false, // hit something: falls instead of gliding
    landed: false,
    lie: 0,
    fade: 0,
    done: false,
    run: null,
    shot: null,
    wins: null,
    newBest: false,
  }
  if (range !== null) {
    // Short runs fly slower (and lower) so the plane doesn't rocket across a short distance.
    const reach = range / STREET.length
    flight.run = {
      range,
      d: 0, // metres flown up the street
      startZ: position.z,
      x0: position.x,
      laneX: clamp(position.x, -STREET.laneHalf, STREET.laneHalf),
      y0: position.y - GROUND_Y,
      speed: STREET.speed * Math.max(STREET.minSpeedScale, Math.sqrt(reach)),
      cruise: clamp(range * STREET.cruisePerMetre, STREET.cruise[0], STREET.cruise[1]),
      climb: Math.min(STREET.climb[0], range * STREET.climb[1]),
      descent: Math.min(STREET.descent[0], range * STREET.descent[1]),
      zone: 0, // index into STREET_ZONES it is flying over
    }
  } else if (pad) {
    // Straight at the prize's face, in a low arc; the hit is worth what the plane is now.
    const to = new Vector3(pad.prize.x - THROW.prizeFace, pad.prize.y, pad.z)
    flight.shot = { pad, from: position.clone(), to, d: 0, range: Math.max(0.5, position.distanceTo(to)), power }
  }
  flights.push(flight)
  // The oldest goes first, but never the one the camera is on.
  if (flights.length > THROW.poolSize) flights.splice(flights[0] === tracked ? 1 : 0, 1)
  return flight
}

// What the HUD shows for the tracked street throw: metres flown, and Wins once landed.
export function trackedReadout() {
  if (!tracked) return null
  return { metres: tracked.run.d, wins: tracked.wins, newBest: tracked.newBest }
}

// A training-pad throw: an arc from the hand into the prize's face. The hit pays Power, and the
// plane bounces off and drops onto the pad like any stalled plane.
function stepShot(f, dt) {
  const s = f.shot
  const p = f.position
  _prev.copy(p)
  s.d = Math.min(s.range, s.d + THROW.prizeSpeed * dt)
  const t = s.d / s.range
  p.lerpVectors(s.from, s.to, t)
  p.y += Math.sin(Math.PI * t) * THROW.prizeArc
  f.velocity.subVectors(p, _prev).divideScalar(dt)
  if (t < 1) return
  f.shot = null
  if (!f.remote) {
    const before = game.power
    addPower(s.power)
    if (game.power > before) gains.push(game.power - before)
  }
  f.velocity.set(-f.velocity.x * 0.12, 1, -f.velocity.z * 0.12)
  f.stalled = true
}

// A street throw's run: placed by distance flown, not integrated, so it always comes
// down exactly at its range. Speed and cruise height fade together over the range.
function stepRun(f, dt) {
  const r = f.run
  const p = f.position
  _prev.copy(p)
  const fade = 1 - (1 - STREET.fadeEnd) * clamp(r.d / r.range, 0, 1)
  r.d = Math.min(r.range, r.d + r.speed * fade * dt)
  const climb = smoothstep(0, r.climb, r.d)
  const down = smoothstep(r.range - r.descent, r.range, r.d)
  const cruise = r.cruise * (0.6 + 0.4 * fade)
  const swoop = STREET.swoop * Math.sin((TAU * f.age) / THROW.wobblePeriod) * climb
  const above = (r.y0 + (cruise - r.y0) * climb + swoop) * (1 - down)
  p.set(r.x0 + (r.laneX - r.x0) * smoothstep(0, STREET.laneIn, r.d), GROUND_Y + Math.max(REST_HEIGHT, above), r.startZ - r.d)
  f.velocity.subVectors(p, _prev).divideScalar(dt)

  const zone = zoneIndexAt(r.d)
  if (zone > r.zone) {
    r.zone = zone
    if (!f.remote) {
      const first = reachZone(zone)
      if (f === tracked) zonesEntered.push({ index: zone, first })
    }
  }

  if (r.d >= r.range) {
    const vh = Math.hypot(f.velocity.x, f.velocity.z)
    if (vh > STREET.maxSlideSpeed) f.velocity.multiplyScalar(STREET.maxSlideSpeed / vh)
    p.y = floorUnder(p.x, p.z, p.y) + REST_HEIGHT
    land(f)
    if (f.remote) return
    f.wins = streetWinsForDistance(r.d)
    if (f.wins > 0) addWins(f.wins)
    f.newBest = recordDistance(r.d)
  }
}

function land(f) {
  f.velocity.y = 0
  f.landed = true
  _nose.set(0, 0, 1).applyQuaternion(f.quaternion) // lie down the way it was pointing
  f.yaw = Math.atan2(_nose.x, _nose.z)
}

// Glides every plane in flight, lands it, lets it lie, then shrinks it away.
export function stepFlights(dt) {
  for (const f of flights) {
    f.age += dt
    const p = f.position
    const v = f.velocity
    if (f.landed) {
      const drag = Math.exp(-THROW.slideDrag * dt)
      v.x *= drag
      v.z *= drag
      p.x += v.x * dt
      p.z += v.z * dt
      f.lie += dt
      if (f === tracked && f.lie > STREET.trackHold) tracked = null
      if (f.lie > THROW.lieTime) f.fade = Math.min(1, f.fade + dt / THROW.fadeTime)
      if (f.fade >= 1) f.done = true
      _aim.rotation.set(0, f.yaw, 0)
      f.quaternion.slerp(_aim.quaternion, 1 - Math.exp(-THROW.turnRate * dt))
      continue
    }

    if (f.run) {
      stepRun(f, dt)
      if (f.landed) continue
    } else if (f.shot) {
      stepShot(f, dt)
    } else {
      if (f.stalled) {
        v.y += THROW.stallGravity * dt
      } else {
        // Ease toward the glide speed, and from the launch climb into a steady sink with a
        // fading swoop on top.
        const vh = Math.hypot(v.x, v.z)
        if (vh > 1e-6) {
          const k = (vh + (THROW.glideSpeed - vh) * (1 - Math.exp(-THROW.speedRate * dt))) / vh
          v.x *= k
          v.z *= k
        }
        f.sinkVy += (-THROW.sinkRate - f.sinkVy) * (1 - Math.exp(-THROW.liftRate * dt))
        v.y = f.sinkVy + THROW.wobble * Math.exp(-THROW.wobbleDecay * f.age) * Math.sin((TAU * f.age) / THROW.wobblePeriod)
      }

      _prev.copy(p)
      p.addScaledVector(v, dt)
      const hit = segmentClear(_prev.x, _prev.y, _prev.z, p.x, p.y, p.z)
      if (hit < 1) {
        // Into a wall or onto a roof: stop just short, bounce back a touch and drop.
        p.lerpVectors(_prev, p, Math.max(0, hit - 0.02))
        v.x *= -0.15
        v.z *= -0.15
        if (v.y > 0) v.y = 0
        f.stalled = true
      }

      const floor = floorUnder(p.x, p.z, p.y)
      if (p.y - REST_HEIGHT <= floor || f.age > THROW.maxFlightTime) {
        p.y = Math.max(p.y, floor + REST_HEIGHT)
        land(f)
        continue
      }
      if (p.y < PHYSICS.killY) {
        f.done = true
        continue
      }
    }

    // Nose along the flight path, banking with the swoop.
    _aim.position.set(0, 0, 0)
    _aim.lookAt(v)
    if (!f.stalled) _aim.rotateZ(THROW.bank * Math.sin((TAU * f.age) / THROW.wobblePeriod + 1))
    f.quaternion.slerp(_aim.quaternion, 1 - Math.exp(-THROW.turnRate * dt))
  }

  for (let i = flights.length - 1; i >= 0; i--) {
    if (flights[i].done) flights.splice(i, 1)
  }
}
