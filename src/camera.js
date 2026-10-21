import { Matrix4, Quaternion, Vector3 } from 'three'
import { inputState } from './input.js'
import { player, floorAt } from './player.js'
import { segmentClear } from './colliders.js'
import { CAMERA, STEP_UP } from './config.js'

// Third-person chase camera, ported from +1 Cut Grass Adventure. It owns its own
// yaw/pitch (mouse look) and orbits the player, so the movement keys never steer
// the view. ONE smoothing stage, on the point it follows: position and look-at
// both derive from it, so they cannot disagree (separate rates read as jitter).
// The wheel sets a zoom target that glides; speed pulls the boom back and widens
// the FOV; solid props pull the boom in until clear. While a street throw is tracked
// (throw.js), the view blends into a chase behind the plane and back again after.
const state = { yaw: 0, pitch: CAMERA.startPitch }
const FLOOR_MARGIN = 0.3 // m the camera stays above the surface under it
const TELEPORT_DISTANCE = 15 // a same-frame jump bigger than this is a respawn: snap

// Driven by the Bloxity `camera_sensitivity` setting.
let sensitivity = 1
export function setCameraSensitivity(value) {
  sensitivity = value
}

// Extra FOV (degrees) from other systems, e.g. a power-up punch.
let fovExtra = 0
export function setFovExtra(degrees) {
  fovExtra = degrees
}

const followed = { x: 0, y: 0, z: 0 } // smoothed feet position
const lastPlayerPos = { x: 0, y: 0, z: 0 }
const look = { x: 0, y: 0, z: 0 }
let initialised = false
let zoomTarget = CAMERA.distance // what the wheel asked for
let zoomEased = CAMERA.distance
let rush = 0 // eased 0..1 speed factor
let clearance = 1 // 0..1 of the boom the walls allow, eased back out

export function getYaw() {
  return state.yaw
}

// Snaps the orbit to sit directly behind the player.
export function syncYawToPlayer() {
  state.yaw = player.facing + Math.PI
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

// --- Chasing a street throw -------------------------------------------------------
// Buffeting while chasing, metres (airflow.js sets it from the plane's speed).
let chaseShake = 0
export function setChaseShake(metres) {
  chaseShake = metres
}

const T = CAMERA.track
const UP = new Vector3(0, 1, 0)
const _chasePos = new Vector3()
const _chaseLook = new Vector3()
const _chaseQuat = new Quaternion()
const _m = new Matrix4()
let chasing = null // the flight being chased, kept while the view blends back out
let chaseBlend = 0 // 0 = player camera, 1 = chase
let chaseY = 0

// Blends the player camera already placed on `camera` toward the chase of `tracked`.
function chase(camera, dt, tracked) {
  if (tracked && tracked !== chasing) {
    chasing = tracked
    chaseY = tracked.position.y + T.up
  }
  if (!tracked && chasing && chaseBlend > 0) {
    // It landed: glide home if the player is in sight of it, otherwise cut straight back.
    const far = Math.hypot(chasing.position.x - player.position.x, chasing.position.z - player.position.z) > T.snapBeyond
    if (far) chaseBlend = 0
  }
  chaseBlend = clamp(chaseBlend + (tracked ? dt / T.blendIn : -dt / T.blendOut), 0, 1)
  if (chaseBlend <= 0) {
    chasing = null
    return
  }
  const f = chasing.position
  chaseY += (f.y + T.up - chaseY) * (1 - Math.exp(-T.heightEase * dt))
  // The street runs north (-Z): sit south of the plane, a little east, looking up the street.
  _chasePos.set(f.x + T.side, chaseY, f.z + T.back)
  if (chaseShake > 0) {
    // Two uneven sines a side: turbulence, not a regular wobble.
    const t = performance.now() / 1000
    _chasePos.x += chaseShake * (Math.sin(t * 13.1) + 0.6 * Math.sin(t * 23.7 + 1.3))
    _chasePos.y += chaseShake * (Math.sin(t * 11.3 + 0.7) + 0.5 * Math.sin(t * 19.1))
  }
  _chaseLook.set(f.x, chaseY - T.up - T.lookBelow, f.z - T.ahead)
  _chaseQuat.setFromRotationMatrix(_m.lookAt(_chasePos, _chaseLook, UP))
  const k = chaseBlend * chaseBlend * (3 - 2 * chaseBlend)
  camera.position.lerp(_chasePos, k)
  camera.quaternion.slerp(_chaseQuat, k)
}

// `tracked` is the street throw to chase (throw.js getTrackedFlight), or null.
export function update(camera, dt, tracked = null) {
  state.yaw -= inputState.look.dx * CAMERA.lookSensitivity * sensitivity
  state.pitch += inputState.look.dy * CAMERA.lookSensitivity * sensitivity
  inputState.look.dx = 0
  inputState.look.dy = 0
  state.pitch = clamp(state.pitch, CAMERA.minPitch, CAMERA.maxPitch)

  zoomTarget = clamp(zoomTarget + inputState.zoom * CAMERA.zoomStep, CAMERA.minDistance, CAMERA.maxDistance)
  inputState.zoom = 0

  const p = player.position
  const jump = Math.hypot(p.x - lastPlayerPos.x, p.y - lastPlayerPos.y, p.z - lastPlayerPos.z)
  const teleported = initialised && jump > TELEPORT_DISTANCE
  lastPlayerPos.x = p.x
  lastPlayerPos.y = p.y
  lastPlayerPos.z = p.z
  if (teleported) {
    state.yaw = player.facing + Math.PI
    state.pitch = CAMERA.startPitch
  }

  if (!initialised || teleported) {
    followed.x = p.x
    followed.y = p.y
    followed.z = p.z
    clearance = 1
    initialised = true
  } else {
    const t = dt > 0 ? 1 - Math.exp(-CAMERA.followLerp * dt) : 1
    followed.x += (p.x - followed.x) * t
    followed.y += (p.y - followed.y) * t
    followed.z += (p.z - followed.z) * t
  }

  // Speed framing: pulling back has to lag the speed change or every stop punches the camera in.
  const speed = Math.hypot(player.velocity.x, player.velocity.z)
  const targetRush = clamp(speed / player.moveSpeed, 0, 1)
  rush += (targetRush - rush) * (1 - Math.exp(-CAMERA.speedEase * dt))
  zoomEased += (zoomTarget - zoomEased) * (1 - Math.exp(-CAMERA.zoomEase * dt))

  const distance = Math.max(1, zoomEased + CAMERA.speedDistance * rush)
  const fov = CAMERA.fov + CAMERA.speedFov * rush + fovExtra
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }

  look.x = followed.x
  look.y = followed.y + player.dims.height * CAMERA.targetHeight
  look.z = followed.z

  const cp = Math.cos(state.pitch)
  const px = look.x + Math.sin(state.yaw) * cp * distance
  const py = Math.max(look.y + Math.sin(state.pitch) * distance, floorAt() + FLOOR_MARGIN)
  const pz = look.z + Math.cos(state.yaw) * cp * distance

  // Never inside a solid: pull in to the first one between the player and the
  // camera at once, and ease back out once it is clear.
  const hit = segmentClear(look.x, look.y, look.z, px, py, pz, followed.y + STEP_UP)
  const want = hit < 1 ? Math.max(0.08, hit - 0.06) : 1
  clearance = want < clearance ? want : clearance + (want - clearance) * (1 - Math.exp(-CAMERA.clearEase * dt))

  camera.position.set(
    look.x + (px - look.x) * clearance,
    look.y + (py - look.y) * clearance,
    look.z + (pz - look.z) * clearance,
  )
  camera.lookAt(look.x, look.y, look.z)
  chase(camera, dt, tracked)
}
