// The paper plane the player carries in the right hand: a classic folded dart
// built as paper panels (smooth inside a panel, sharp along each fold), pinched
// by its keel at the fist. The arm itself is posed by animator.js's carry layer;
// everything here is the plane's own secondary motion on top of the hand:
//  - a damped torsion spring at the pinch, driven by the hand's acceleration
//    (the wings sit above the fingers, so they lag and wobble like real paper),
//  - airflow: weathervaning into the wind, nose-up trim, wings flexing up with
//    airspeed and the trailing edge fluttering faster and harder the quicker
//    the hand moves,
//  - the deliberate part: banking into turns and swooping while the player
//    "flies" it at a run, and turning it over while they look at it idle.
// The plane lives in world space (not under the bone) so rig scale and the
// avatar proportions never stretch the paper; it copies the socket each frame.
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { HELD_PLANE as P } from '../config.js'

const TAU = Math.PI * 2
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const smoothstep = (e0, e1, v) => {
  const t = clamp((v - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}
// Cheap smooth noise in -1..1: three incommensurate sines.
const wander = (t, seed) =>
  (Math.sin(t * 1.13 + seed) + Math.sin(t * 2.31 + seed * 2.7) * 0.6 + Math.sin(t * 0.47 + seed * 5.1) * 0.8) / 2.4

// --- Paper ------------------------------------------------------------------
// Off-white with grain and a scatter of fibres; tiled by real size via UVs.
export function paperTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')
  g.fillStyle = P.paperColor
  g.fillRect(0, 0, size, size)
  const img = g.getImageData(0, 0, size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 9
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  g.putImageData(img, 0, 0)
  g.strokeStyle = '#7d7666'
  g.lineWidth = 0.7
  g.globalAlpha = 0.06
  for (let i = 0; i < 320; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const a = Math.random() * Math.PI
    const l = 2 + Math.random() * 8
    g.beginPath()
    g.moveTo(x, y)
    g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l)
    g.stroke()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.anisotropy = 4
  return texture
}

// --- Folded dart geometry -----------------------------------------------------
// Plane space, metres: nose at +Z, wings along X, up +Y, the wing root fold on
// the Y = 0 line. Every panel is a grid over (t, b): t runs nose (0) -> tail
// (1), b runs across the panel. Wing points sit on rays from the nose (that is
// how a dart's folds run), so a panel stays a developable sheet of paper.
const ROWS = 14
const COLS = 4
const HALF_SPAN = P.span / 2
const CREASE = P.crease
const UV_SCALE = 1 / P.paperTile

function makePanels() {
  const panels = []
  for (const side of [1, -1]) {
    panels.push({ kind: 'wing', side, s0: 0, s1: CREASE })
    panels.push({ kind: 'wing', side, s0: CREASE, s1: 1 })
    panels.push({ kind: 'keel', side })
  }
  return panels
}

// Also drawn by the thrown planes (thrownPlanes.js).
export class PaperDart {
  constructor(material) {
    this.panels = makePanels()
    const perPanel = (ROWS + 1) * (COLS + 1)
    const count = perPanel * this.panels.length
    this.positions = new Float32Array(count * 3)
    const uvs = new Float32Array(count * 2)
    const colors = new Float32Array(count * 3)
    const indices = []
    this.panels.forEach((panel, p) => {
      panel.offset = p * perPanel
      for (let i = 0; i <= ROWS; i++) {
        const t = i / ROWS
        for (let j = 0; j <= COLS; j++) {
          const b = j / COLS
          const v = panel.offset + i * (COLS + 1) + j
          let u, shade
          if (panel.kind === 'wing') {
            const s = panel.s0 + (panel.s1 - panel.s0) * b
            u = s * t * HALF_SPAN
            // A little darker into the root fold, where the layers bunch up.
            shade = 0.9 + 0.1 * smoothstep(0, 0.3, s)
          } else {
            u = b * P.keelDepth * t
            shade = 0.86 + 0.08 * (1 - b)
          }
          uvs[v * 2] = u * UV_SCALE * panel.side
          uvs[v * 2 + 1] = t * P.length * UV_SCALE
          colors[v * 3] = colors[v * 3 + 1] = colors[v * 3 + 2] = shade
        }
      }
      for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < COLS; j++) {
          const a = panel.offset + i * (COLS + 1) + j
          const c = a + COLS + 1
          indices.push(a, c, a + 1, a + 1, c, c + 1)
        }
      }
    })
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3))
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
    geometry.setAttribute('color', new BufferAttribute(colors, 3))
    geometry.setIndex(indices)
    this.geometry = geometry
    this.mesh = new Mesh(geometry, material)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.deform({ flexInner: 0, flexOuter: 0, flutter: 0, flutterPhase: 0, keelSway: 0 })
    geometry.computeBoundingSphere()
  }

  // Rewrites every vertex from the fold angles and flutter, then the normals.
  deform({ flexInner, flexOuter, flutter, flutterPhase, keelSway }) {
    const pos = this.positions
    const tanInner = Math.tan(P.dihedral + flexInner)
    const tanOuter = Math.tan(P.outerDihedral + flexOuter)
    for (const panel of this.panels) {
      const side = panel.side
      for (let i = 0; i <= ROWS; i++) {
        const t = i / ROWS
        const z = P.length / 2 - t * P.length
        // The trailing edge is bent up a touch (elevator trim) and flutters.
        const trailing = smoothstep(0.7, 1, t)
        for (let j = 0; j <= COLS; j++) {
          const b = j / COLS
          const v = (panel.offset + i * (COLS + 1) + j) * 3
          if (panel.kind === 'wing') {
            const s = panel.s0 + (panel.s1 - panel.s0) * b
            const local = t * HALF_SPAN
            const lift = s < CREASE ? s * tanInner : CREASE * tanInner + (s - CREASE) * tanOuter
            const wave = Math.sin(flutterPhase + side * 0.9 + s * 2.6 - t * 3.1)
            const edge = trailing * trailing * (0.3 + 0.7 * s)
            // Tips flick a little even ahead of the trailing edge.
            const tip = s * s * t * flutter * 0.35 * Math.sin(flutterPhase * 0.83 + side * 1.7 + t * 2)
            pos[v] = side * s * local
            pos[v + 1] = local * lift + edge * (P.trailingCurl + flutter * wave) + tip
            pos[v + 2] = z
          } else {
            const depth = P.keelDepth * t
            pos[v] = side * (P.keelGap + b * t * P.keelSpread) + keelSway * b * t
            pos[v + 1] = -b * depth
            pos[v + 2] = z
          }
        }
      }
    }
    this.geometry.attributes.position.needsUpdate = true
    this.geometry.computeVertexNormals()
  }
}

// --- Held plane ---------------------------------------------------------------
const _pos = new Vector3()
const _quat = new Quaternion()
const _scale = new Vector3()
const _inv = new Quaternion()
const _vel = new Vector3()
const _acc = new Vector3()
const _local = new Vector3()
const _euler = new Euler(0, 0, 0, 'YXZ')
const _offset = new Quaternion()

export class HeldPlane {
  constructor() {
    const material = new MeshStandardMaterial({
      map: paperTexture(),
      vertexColors: true,
      roughness: 0.88,
      metalness: 0,
      side: DoubleSide,
    })
    this.dart = new PaperDart(material)
    // The pinch point is the carrier's origin, so spring rotations pivot there.
    this.dart.mesh.position.z = -(P.length / 2 - P.gripFraction * P.length)
    this.object = new Group()
    this.object.name = 'heldPlane'
    this.object.add(this.dart.mesh)
    this.object.visible = false
    this.socket = null
    this.inHand = true // false from release until the next plane is in hand (throw.js)
    this.pop = 1 // 0..1 grow-in of a fresh plane
    this.popRate = Infinity

    this.time = 0
    this.flutterPhase = 0
    this.prevPos = new Vector3()
    this.velocity = new Vector3()
    this.accel = new Vector3()
    this.angle = new Vector3() // spring-driven wobble at the pinch, radians (x pitch, y yaw, z roll)
    this.angVel = new Vector3()
    this.flex = 0
    this.flexVel = 0
    this.yawRate = 0
    this.prevFacing = null
    this.fresh = true
  }

  // Binds a socket to the forearm (or the whole arm on the procedural rig) at
  // the fist. Call while the new avatar is still in its bind pose.
  attach(root) {
    this.socket?.removeFromParent()
    this.socket = null
    const bone = root?.nodes?.ArmR2 || root?.nodes?.ArmR1
    this.object.visible = !!bone && this.inHand
    if (!bone) return
    root.updateMatrixWorld(true)
    // Grip in character space (rig units): nose down the hanging forearm, wings
    // facing forward, so bending the elbow brings it level, nose first.
    const grip = new Matrix4().compose(
      new Vector3(P.grip.x, P.grip.y, P.grip.z),
      new Quaternion().setFromEuler(new Euler(Math.PI / 2 + P.gripPitch, P.gripYaw, P.gripRoll, 'YXZ')),
      new Vector3(1, 1, 1),
    )
    const local = bone.matrixWorld.clone().invert().multiply(root.matrixWorld).multiply(grip)
    const socket = new Object3D()
    socket.name = 'PlaneSocket'
    local.decompose(socket.position, socket.quaternion, socket.scale)
    bone.add(socket)
    this.socket = socket
    this.fresh = true
  }

  // Tints the paper (the equipped plane's colour); white leaves it plain.
  setColor(hex) {
    this.dart.mesh.material.color.set(hex)
  }

  // Shows or hides the plane in the hand; a new one grows in over `popTime` s.
  setInHand(on, popTime = 0) {
    if (on && !this.inHand) this.pop = popTime > 0 ? 0 : 1
    this.inHand = on
    this.popRate = popTime > 0 ? 1 / popTime : Infinity
    this.object.visible = !!this.socket && on
  }

  // The dart's world position and orientation as last drawn: where a thrown plane starts.
  worldPose(position, quaternion) {
    this.dart.mesh.getWorldPosition(position)
    quaternion.copy(this.object.quaternion)
  }

  // motion: { facing, fly (0..1), inspect (0..1), wristYaw (rad), grounded }
  update(dt, motion) {
    if (!this.socket || !(dt > 0)) return
    this.time += dt
    this.socket.updateWorldMatrix(true, false)
    this.socket.matrixWorld.decompose(_pos, _quat, _scale)

    // Hand velocity and (low-passed) acceleration, from the socket's own path.
    if (this.fresh) {
      this.prevPos.copy(_pos)
      this.velocity.set(0, 0, 0)
      this.accel.set(0, 0, 0)
      this.angle.set(0, 0, 0)
      this.angVel.set(0, 0, 0)
      this.prevFacing = motion.facing
      this.fresh = false
    }
    _vel.subVectors(_pos, this.prevPos).divideScalar(dt)
    this.prevPos.copy(_pos)
    _acc.subVectors(_vel, this.velocity).divideScalar(dt)
    this.velocity.copy(_vel)
    this.accel.lerp(_acc, 1 - Math.exp(-P.accelSmoothing * dt))
    if (this.accel.length() > P.maxAccel) this.accel.setLength(P.maxAccel)

    const turn = Math.atan2(Math.sin(motion.facing - this.prevFacing), Math.cos(motion.facing - this.prevFacing))
    this.prevFacing = motion.facing
    this.yawRate += (turn / dt - this.yawRate) * (1 - Math.exp(-6 * dt))

    // Into plane space (+Z nose, +Y up, +X the plane's left wing).
    _inv.copy(_quat).invert()
    _local.copy(this.accel).applyQuaternion(_inv)
    const ax = _local.x
    const ay = _local.y
    const az = _local.z
    _local.copy(this.velocity).applyQuaternion(_inv)
    const airspeed = this.velocity.length()
    const forward = Math.max(0, _local.z)
    const air = clamp(airspeed / P.airspeedReference, 0, 1.6)

    // Spring targets. The wings ride above the pinch, so they lag the hand:
    // surging forward tips the nose up, a sideways shove rolls the plane away.
    const target = {
      x: -az * P.inertia - forward * P.trimPerSpeed,
      y: forward > 0.5 ? clamp(Math.atan2(_local.x, forward) * P.weathervane, -0.2, 0.2) : 0,
      z: ax * P.inertia,
    }
    const k = P.stiffness
    const c = 2 * P.damping * Math.sqrt(k)
    const steps = Math.ceil(dt / (1 / 120))
    const h = dt / steps
    for (let i = 0; i < steps; i++) {
      for (const axis of ['x', 'y', 'z']) {
        this.angVel[axis] += (k * (target[axis] - this.angle[axis]) - c * this.angVel[axis]) * h
        this.angle[axis] += this.angVel[axis] * h
      }
      // Wing flex: lifted by airflow, sagging when the hand surges up.
      const flexGoal = clamp(air * air * P.flexPerAir - ay * P.flexPerAccel, -P.maxFlex, P.maxFlex)
      this.flexVel += (P.flexStiffness * (flexGoal - this.flex) - 2 * 0.25 * Math.sqrt(P.flexStiffness) * this.flexVel) * h
      this.flex += this.flexVel * h
    }

    // Deliberate handling, layered on the spring without going through it.
    const fly = motion.fly
    const inspect = motion.inspect
    const swoop = this.time * TAU
    const idleFidget = 1 - fly
    let pitch = this.angle.x
    let yaw = this.angle.y + motion.wristYaw
    let roll = this.angle.z
    // Flying it: bank into the turn, swoop gently, nose rides the jump.
    roll += fly * (clamp(-this.yawRate * P.bankPerTurn, -P.maxBank, P.maxBank) + Math.sin(swoop * 0.37) * P.swoopRoll)
    pitch += fly * (Math.sin(swoop * 0.52 + 1.3) * P.swoopPitch - (motion.grounded ? 0 : P.airPitch))
    // Held still: tiny finger adjustments.
    pitch += idleFidget * wander(this.time * 0.9, 1.7) * P.fidget
    roll += idleFidget * wander(this.time * 0.7, 4.2) * P.fidget * 1.4
    yaw += idleFidget * wander(this.time * 0.5, 8.9) * P.fidget * 0.8
    // Looking at it: turn the top toward the face and rock it to check the folds.
    roll -= inspect * (P.inspectRoll + Math.sin(this.time * 1.9) * P.inspectRock)
    pitch -= inspect * P.inspectPitch
    yaw += inspect * Math.sin(this.time * 1.3 + 0.5) * P.inspectRock

    _euler.set(pitch, yaw, roll)
    _offset.setFromEuler(_euler)
    this.object.position.copy(_pos)
    this.object.quaternion.copy(_quat).multiply(_offset)
    this.pop = Math.min(1, this.pop + dt * this.popRate)
    this.object.scale.setScalar(this.pop * this.pop * (3 - 2 * this.pop))

    // Flutter: frequency climbs with airspeed, amplitude with dynamic pressure.
    this.flutterPhase += (P.flutterFrequency[0] + air * P.flutterFrequency[1]) * TAU * dt
    const breeze = P.idleBreeze * (0.6 + 0.4 * wander(this.time * 0.6, 3.3))
    this.dart.deform({
      flexInner: this.flex * 0.45,
      flexOuter: this.flex,
      flutter: breeze + air * air * P.flutterAmplitude * (0.8 + 0.2 * wander(this.time * 3, 6.1)),
      flutterPhase: this.flutterPhase,
      keelSway: -ax * P.keelSwayPerAccel,
    })
  }

  dispose() {
    this.socket?.removeFromParent()
    this.object.removeFromParent()
    this.dart.geometry.dispose()
    this.dart.mesh.material.map?.dispose()
    this.dart.mesh.material.dispose()
  }
}
