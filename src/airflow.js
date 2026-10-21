// The air around a street throw while the camera chases it (throw.js getTrackedFlight):
//  - wingtip vortices: a ribbon off each wingtip, corkscrewing the way a real tip vortex
//    rolls (left and right turn opposite ways), widening and fading as it ages;
//  - wind streaks: thin lines hanging still in the air around the flight path, drawn as long
//    as the distance the plane covers in a blink, so they rush past the camera at speed;
//  - pressure rings shed into the air one after another as it leaves the hand (the chase
//    camera flies through them), and a dust puff where it touches down;
//  - the camera: a little buffeting and a wider field of view as the speed builds (camera.js);
//  - the sound of it: sfx.js's flight voice follows the speed and the dives and climbs.
// Everything is preallocated and rewritten in place each frame, and only drawn during a chase.
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { AIRFLOW as A, HELD_PLANE, STREET } from './config.js'
import { setChaseShake, setFovExtra } from './camera.js'
import { flightVoice } from './sfx.js'

const TAU = Math.PI * 2
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

const _a = new Vector3()
const _b = new Vector3()
const _dir = new Vector3()
const _side = new Vector3()
const _toCam = new Vector3()
const _up = new Vector3()
const _right = new Vector3()

// --- Wingtip vortices -------------------------------------------------------------------
// A trail of { position, age } samples from one wingtip, drawn as a camera-facing ribbon.
class VortexTrail {
  constructor(spin) {
    this.spin = spin // +1 / -1: which way the vortex rolls
    this.points = []
    for (let i = 0; i < A.trailPoints; i++) this.points.push({ p: new Vector3(), dir: new Vector3(), age: 0 })
    this.count = 0
    this.head = 0
    const n = A.trailPoints * 2
    this.positions = new Float32Array(n * 3)
    this.colors = new Float32Array(n * 4)
    const index = []
    for (let i = 0; i < A.trailPoints - 1; i++) {
      const a = i * 2
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(this.positions, 3))
    geo.setAttribute('color', new BufferAttribute(this.colors, 4))
    geo.setIndex(index)
    this.geo = geo
    this.mesh = new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide }))
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 3
  }

  // The newest sample first; the oldest drops off the end.
  push(p, dir) {
    this.head = (this.head + A.trailPoints - 1) % A.trailPoints
    const s = this.points[this.head]
    s.p.copy(p)
    s.dir.copy(dir)
    s.age = 0
    this.count = Math.min(this.count + 1, A.trailPoints)
  }

  update(dt, camera, strength) {
    while (this.count && this.sample(this.count - 1).age + dt > A.trailLife) this.count--
    for (let i = 0; i < this.count; i++) this.sample(i).age += dt
    const pos = this.positions
    const col = this.colors
    let dist = 0 // m along the trail from the wingtip
    for (let i = 0; i < this.count; i++) {
      const s = this.sample(i)
      if (i) dist += s.p.distanceTo(this.sample(i - 1).p)
      const u = s.age / A.trailLife
      // Shaped by distance, not age: the chase camera sits a few metres back, so the vortex
      // has to roll up and spread within that stretch to be seen at any speed.
      const grow = Math.min(1, dist / A.trailGrow)
      // Corkscrew: each sample rides a circle around the flight path, a helix of fixed pitch.
      _up.set(0, 1, 0)
      _right.crossVectors(s.dir, _up).normalize()
      _up.crossVectors(_right, s.dir).normalize()
      const r = A.vortexRadius * grow
      const a = this.spin * (dist * A.vortexTwist * TAU + 1)
      _a.copy(s.p).addScaledVector(_right, Math.cos(a) * r).addScaledVector(_up, Math.sin(a) * r)
      // Ribbon: across the trail, square to the camera.
      _toCam.subVectors(camera.position, _a).normalize()
      _side.crossVectors(s.dir, _toCam).normalize().multiplyScalar(A.trailWidth * (0.3 + 2.2 * grow + u))
      _b.copy(_a).add(_side)
      _a.sub(_side)
      pos.set([_a.x, _a.y, _a.z, _b.x, _b.y, _b.z], i * 6)
      const alpha = strength * A.trailAlpha * (1 - u) ** 1.6 * Math.min(1, dist / 0.2) // soft at the wingtip too
      col.set([1, 1, 1, alpha, 1, 1, 1, alpha], i * 8)
    }
    this.geo.setDrawRange(0, Math.max(0, this.count - 1) * 6)
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.color.needsUpdate = true
    this.mesh.visible = this.count > 1
  }

  sample(i) {
    return this.points[(this.head + i) % A.trailPoints]
  }

  clear() {
    this.count = 0
    this.mesh.visible = false
  }
}

// --- Puffs --------------------------------------------------------------------------------
function puffTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

export class Airflow {
  constructor() {
    this.object = new Group()
    this.object.name = 'airflow'

    this.trails = [new VortexTrail(1), new VortexTrail(-1)]
    for (const t of this.trails) this.object.add(t.mesh)

    // Wind streaks: a thin camera-facing strip each, still in the air; respawned ahead as the
    // plane passes. (GL lines are a pixel wide whatever the screen, so strips instead.)
    this.streaks = []
    for (let i = 0; i < A.streaks; i++) this.streaks.push({ p: new Vector3(), live: false })
    this.streakPos = new Float32Array(A.streaks * 12)
    this.streakCol = new Float32Array(A.streaks * 16)
    const index = []
    for (let i = 0; i < A.streaks; i++) {
      const v = i * 4
      index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
    }
    const sg = new BufferGeometry()
    sg.setAttribute('position', new BufferAttribute(this.streakPos, 3))
    sg.setAttribute('color', new BufferAttribute(this.streakCol, 4))
    sg.setIndex(index)
    this.streakGeo = sg
    this.streakLines = new Mesh(sg, new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide }))
    this.streakLines.frustumCulled = false
    this.streakLines.renderOrder = 3
    this.object.add(this.streakLines)

    // Launch rings: thin rings facing along the flight path, each left hanging where the plane
    // was when it shed it, spreading and fading.
    const ringGeo = new RingGeometry(0.42, 0.5, 48)
    this.rings = []
    for (let i = 0; i < A.rings; i++) {
      const mesh = new Mesh(ringGeo, new MeshBasicMaterial({ color: A.ringColor, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }))
      mesh.visible = false
      mesh.renderOrder = 3
      this.object.add(mesh)
      this.rings.push({ mesh, age: 1, wait: -1 })
    }

    // Touchdown dust: soft sprites drifting out and up from where it lands.
    const tex = puffTexture()
    this.dust = []
    for (let i = 0; i < A.dustPuffs; i++) {
      const s = new Sprite(new SpriteMaterial({ map: tex, color: A.dustColor, transparent: true, depthWrite: false, opacity: 0 }))
      s.visible = false
      this.object.add(s)
      this.dust.push({ s, v: new Vector3(), age: 1, life: 1 })
    }

    this.flight = null // the chased flight we last saw
    this.landedSeen = false
    this.strength = 0 // 0..1 eased: the effects fade in with the chase and out on touchdown
    this.time = 0
  }

  // Call once a frame, after the camera has moved. `tracked` is getTrackedFlight().
  update(dt, tracked, camera) {
    if (!(dt > 0)) return
    this.time += dt
    const f = tracked?.run ? tracked : null
    if (f !== this.flight) {
      this.flight = f
      this.landedSeen = false
      if (f) this.launch(f)
    }
    const flying = !!f && !f.landed
    if (f && f.landed && !this.landedSeen) {
      this.landedSeen = true
      this.touchdown(f)
    }

    const speed = f ? f.velocity.length() : 0
    const speed01 = clamp(speed / STREET.speed, 0, 1.2)
    this.strength += ((flying ? 1 : 0) - this.strength) * (1 - Math.exp(-(flying ? 4 : 6) * dt))

    // Wingtips, in plane space: out at the tips, at the trailing edge.
    if (flying) {
      _dir.copy(f.velocity).normalize()
      const half = HELD_PLANE.span / 2 + 0.01
      for (const [i, sx] of [[0, -1], [1, 1]]) {
        _a.set(sx * half, 0.04, -HELD_PLANE.length / 2).applyQuaternion(f.quaternion).add(f.position)
        this.trails[i].push(_a, _dir)
      }
    }
    for (const t of this.trails) t.update(dt, camera, Math.max(this.strength, 0.001) * (0.35 + 0.65 * clamp(speed01 * 1.6, 0, 1)))
    if (!f && this.strength < 0.01) for (const t of this.trails) t.clear()

    this.updateStreaks(f, camera, speed, speed01)
    this.updateRings(dt, f)
    this.updateDust(dt)

    // The camera and the sound follow the speed; a dive (falling fast) opens it all up.
    const dive = f && speed > 0.1 ? clamp(-f.velocity.y / 6, -1, 1) : 0
    setFovExtra(A.fovAtSpeed * this.strength * clamp(speed01 * 1.3, 0, 1))
    setChaseShake(A.shake * this.strength * clamp(speed01 * 1.4, 0, 1))
    if (flying) {
      flightVoice.start()
      flightVoice.update({ speed: Math.max(speed01, 0.18), dive, level: this.strength })
    } else if (flightVoice.playing) {
      flightVoice.stop()
    }
  }

  launch(f) {
    for (const t of this.trails) t.clear()
    for (const s of this.streaks) s.live = false
    this.rings.forEach((r, i) => {
      r.wait = i * A.ringEvery // shed one after another as the plane pulls away
      r.mesh.visible = false
    })
  }

  touchdown(f) {
    for (let i = 0; i < this.dust.length; i++) {
      const d = this.dust[i]
      const a = (i / this.dust.length) * TAU + Math.random() * 0.6
      const out = 0.6 + Math.random() * 1.4
      d.s.position.set(f.position.x + Math.cos(a) * 0.2, f.position.y + 0.1, f.position.z + Math.sin(a) * 0.2)
      // Thrown forward with the plane's slide, as well as out and up.
      d.v.set(Math.cos(a) * out + f.velocity.x * 0.25, 0.4 + Math.random() * 0.7, Math.sin(a) * out + f.velocity.z * 0.25)
      d.age = 0
      d.life = A.dustLife * (0.7 + Math.random() * 0.6)
      d.s.visible = true
    }
  }

  updateStreaks(f, camera, speed, speed01) {
    const pos = this.streakPos
    const col = this.streakCol
    const flying = f && !f.landed && speed > 1
    if (flying) _dir.copy(f.velocity).setY(0).normalize()
    const want = flying ? Math.round(A.streaks * clamp(speed01 * 1.5, 0.15, 1)) : 0
    const len = clamp(speed * A.streakBlur, 0.3, A.streakMaxLen)
    for (let i = 0; i < this.streaks.length; i++) {
      const s = this.streaks[i]
      if (flying) {
        // Behind the camera, or never placed: put it back out ahead, around the flight path.
        const ahead = (s.p.x - f.position.x) * _dir.x + (s.p.z - f.position.z) * _dir.z
        const behind = (s.p.x - camera.position.x) * _dir.x + (s.p.z - camera.position.z) * _dir.z < -1
        if (i < want && (!s.live || behind || ahead > A.streakAhead[1] + 5)) this.spawnStreak(s, f, i)
        else if (i >= want) s.live = false
      } else {
        s.live = false
      }
      if (!s.live) {
        col.fill(0, i * 16, i * 16 + 16)
        continue
      }
      _a.copy(s.p)
      _b.copy(s.p).addScaledVector(_dir, len)
      _toCam.subVectors(camera.position, _a).normalize()
      _side.crossVectors(_dir, _toCam).normalize().multiplyScalar(A.streakWidth)
      pos.set([_a.x - _side.x, _a.y - _side.y, _a.z - _side.z, _a.x + _side.x, _a.y + _side.y, _a.z + _side.z], i * 12)
      pos.set([_b.x - _side.x, _b.y - _side.y, _b.z - _side.z, _b.x + _side.x, _b.y + _side.y, _b.z + _side.z], i * 12 + 6)
      // Brightest at mid-distance: they appear out of the haze and vanish past the lens. The
      // near end is the head; the blur tails off ahead, where it just was relative to the camera.
      const dCam = _a.distanceTo(camera.position)
      const alpha = this.strength * A.streakAlpha * clamp((dCam - 1.2) / 4, 0, 1) * clamp((A.streakAhead[1] - dCam) / 12, 0, 1)
      col.set([1, 1, 1, alpha, 1, 1, 1, alpha, 1, 1, 1, alpha * 0.05, 1, 1, 1, alpha * 0.05], i * 16)
    }
    this.streakGeo.attributes.position.needsUpdate = true
    this.streakGeo.attributes.color.needsUpdate = true
    this.streakLines.visible = this.strength > 0.01
  }

  spawnStreak(s, f, i) {
    const [near, far] = A.streakAhead
    const along = near + Math.random() * (far - near)
    const a = Math.random() * TAU
    const r = A.streakRadius[0] + Math.random() * (A.streakRadius[1] - A.streakRadius[0])
    // Across the flight path: x is sideways (the street runs along z), y up.
    s.p.set(f.position.x + Math.cos(a) * r, Math.max(0.3, f.position.y + Math.sin(a) * r * 0.7), f.position.z)
    s.p.addScaledVector(_dir, along)
    s.live = true
  }

  updateRings(dt, f) {
    for (const r of this.rings) {
      if (r.wait >= 0) {
        r.wait -= dt
        if (r.wait < 0 && f && !f.landed) {
          // Shed here, square to the flight path.
          r.age = 0
          r.mesh.position.copy(f.position)
          if (f.velocity.lengthSq() > 1e-6) _dir.copy(f.velocity).normalize()
          else _dir.set(0, 0, -1)
          r.mesh.lookAt(_b.copy(f.position).add(_dir))
          r.mesh.visible = true
        }
        continue
      }
      if (!r.mesh.visible) continue
      r.age += dt / A.ringLife
      if (r.age >= 1) {
        r.mesh.visible = false
        continue
      }
      r.mesh.scale.setScalar(1 + r.age * A.ringGrow)
      r.mesh.material.opacity = A.ringAlpha * (1 - r.age) ** 1.5
    }
  }

  updateDust(dt) {
    for (const d of this.dust) {
      if (!d.s.visible) continue
      d.age += dt
      const u = d.age / d.life
      if (u >= 1) {
        d.s.visible = false
        continue
      }
      d.v.multiplyScalar(Math.exp(-2.5 * dt))
      d.s.position.addScaledVector(d.v, dt)
      const size = A.dustSize * (0.4 + 1.4 * Math.sqrt(u))
      d.s.scale.set(size, size, size)
      d.s.material.opacity = A.dustAlpha * (1 - u) * Math.min(1, u * 8)
    }
  }
}
