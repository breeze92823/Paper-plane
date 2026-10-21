// Procedural locomotion animator, ported from +1 Cut Grass Adventure's
// PlayerAnimator + LocomotionCycle. States idle / run / airborne / landing are
// blended through pose buffers; the walk and run are ONE cycle at two depths,
// its phase advancing with distance travelled so the feet stay planted at any
// speed. A carry layer on top poses the right arm holding the paper plane
// (avatar/heldPlane.js), and a one-shot toss layer (toss()) throws it over
// everything else. Writes only to bones and the avatar root's rotation /
// position.y (the player group owns world placement).
import { ANIM } from '../config.js'
import { BONE_INDEX, PlayerRig, PoseBuffer } from './rig.js'

const TAU = Math.PI * 2
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const lerp = (a, b, t) => a + (b - a) * t
const ease = (t) => t * t * (3 - 2 * t)
const smoothstep = (e0, e1, v) => ease(clamp((v - e0) / (e1 - e0 || 1), 0, 1))
const kneeCurve = (phase) => {
  const raw = Math.sin(phase - Math.PI / 2.6)
  return raw > 0 ? raw * raw : 0
}

const L = ANIM.locomotion
const C = ANIM.carry
const T = ANIM.toss
const CARRY_ARM = ['ArmR1', 'ArmR2']
const TOSS_BONES = [...new Set(T.keys.flatMap((k) => Object.keys(k.pose)))]
const AXES = ['x', 'y', 'z']
const randomBetween = ([lo, hi]) => lo + Math.random() * (hi - lo)

// options: { carrying } — the right hand holds the paper plane.
export function makeAnimator(root, options = {}) {
  if (!root) return null
  return new PlayerAnimator(root, options)
}

export function disposeAnimator(animator) {
  animator?.dispose()
}

class PlayerAnimator {
  constructor(root, { carrying = false } = {}) {
    this.root = root
    this.rig = new PlayerRig(root)
    this.target = new PoseBuffer()
    this.from = new PoseBuffer()
    this.output = new PoseBuffer()
    this.scratch = new PoseBuffer()
    this.state = 'idle'
    this.stateTime = 0
    this.blendTime = 0
    this.blendDuration = 0
    this.phase = 0
    this.idleTime = 0
    this.airTime = 0
    this.bank = 0
    this.carrying = carrying
    this.carry = carrying ? 1 : 0 // eased weight of the carry layer
    this.fly = 0 // 0 = plane held at the waist, 1 = flown at arm's length
    this.lift = 0 // raised clear for a jump
    this.inspect = 0 // 0..1 envelope of the idle look at the plane
    this.inspectTime = -1 // s into the current look; < 0 when not looking
    this.untilInspect = randomBetween(C.inspectEvery)
    this.wristYaw = 0 // rad the hand turns the plane back toward straight ahead
    this.tossTime = -1 // s into the current toss; < 0 when not tossing
    this.tossPose = new PoseBuffer()
    this.hasElbow = this.rig.has('ArmR2')
  }

  dispose() {
    this.rig.resetToBindPose()
    this.root.rotation.set(0, 0, 0)
    this.root.position.y = 0
  }

  // input: { grounded, speed, verticalVelocity, turn (-1..1) }
  update(dt, input) {
    if (!(dt > 0)) return
    this.stateTime += dt
    this.resolveState(dt, input)
    this.writePose(dt, input)
    this.writeCarry(dt, input)
    this.blend(dt)
    this.writeToss(dt)
    this.rig.applyPose(this.output)
    this.applyVisual(dt, input)
  }

  // Plays the overhand toss once from the top. throw.js times the release from
  // ANIM.toss.releaseAt, so the caller doesn't need to watch the pose.
  toss() {
    this.tossTime = 0
    this.inspectTime = -1
  }

  get tossing() {
    return this.tossTime >= 0
  }

  resolveState(dt, input) {
    if (!input.grounded) {
      // Ignore the few frames of a step down a ledge; only a real drop is airborne.
      this.airTime += dt
      if (this.airTime > ANIM.airborneDelay) this.setState('airborne', ANIM.transitions.toAirborne)
      return
    }
    this.airTime = 0
    if (this.state === 'airborne') {
      this.setState('landing', ANIM.transitions.toLanding)
      return
    }
    if (this.state === 'landing' && this.stateTime < ANIM.landing.duration) return
    this.setState(input.speed < L.idleSpeed ? 'idle' : 'run', ANIM.transitions.toLocomotion)
  }

  setState(next, duration) {
    if (next === this.state) return
    this.from.copyFrom(this.output)
    this.state = next
    this.stateTime = 0
    this.blendTime = 0
    this.blendDuration = duration
  }

  writePose(dt, input) {
    const t = this.target
    switch (this.state) {
      case 'idle': {
        // Ease the stride back to a neutral standing phase.
        const goal = this.phase > Math.PI ? TAU : 0
        this.phase += (goal - this.phase) * (1 - Math.exp(-8 * dt))
        if (this.phase >= TAU - 1e-4) this.phase = 0
        this.idleTime += dt
        const breath = Math.sin(this.idleTime * ANIM.idle.breathFrequency * TAU)
        t.applyDefinition(ANIM.idle.basePose)
        t.add('Spine1', breath * ANIM.idle.breathAmount)
        t.add('Neck1', -breath * ANIM.idle.breathAmount * 0.6)
        t.bobY = breath * ANIM.idle.breathBob
        break
      }
      case 'run': {
        const frequency = clamp(input.speed / L.strideDistance, L.minFrequency, L.maxFrequency)
        this.phase = (this.phase + frequency * TAU * dt) % TAU
        this.writeLocomotion(t, input.speed)
        break
      }
      case 'airborne': {
        const rising = clamp(input.verticalVelocity / ANIM.airborne.velocityReference, -1, 1)
        t.applyDefinition(ANIM.airborne.fall)
        this.scratch.applyDefinition(ANIM.airborne.rise)
        t.lerpBetween(t, this.scratch, clamp(0.5 + rising * 0.5, 0, 1))
        t.bobY = 0
        break
      }
      case 'landing': {
        const depth = 1 - ease(clamp(this.stateTime / ANIM.landing.duration, 0, 1))
        t.applyDefinition(ANIM.landing.pose, depth)
        t.bobY = ANIM.landing.bobY * depth
        break
      }
    }
  }

  // One cycle at two depths (walk -> run), derived from actual speed.
  writeLocomotion(out, speed) {
    const run = smoothstep(L.walkSpeed, L.runSpeed, speed)
    const sprint = smoothstep(L.runSpeed, L.sprintSpeed, speed) * 0.4
    const depth = (d) => lerp(lerp(d.walk, d.run, run), d.sprint, sprint)
    const phase = this.phase
    const swing = Math.sin(phase)
    const opposite = -swing
    const hip = depth(L.hipSwing)
    const knee = depth(L.kneeBend)
    const arm = depth(L.armSwing)
    const elbow = depth(L.elbowBend)
    const twist = depth(L.torsoTwist)
    const lean = depth(L.torsoLean)
    const headTwist = depth(L.headCounterTwist)
    const roll = depth(L.torsoRoll)
    const bob = depth(L.bob)

    out.reset()
    // Thighs half a cycle apart; the stride is pushed back more than forward at speed.
    const back = 1 + sprint * 0.35
    out.set('LegL1', hip * (swing > 0 ? swing : swing * back))
    out.set('LegR1', hip * (opposite > 0 ? opposite : opposite * back))
    out.set('LegL2', knee * kneeCurve(phase))
    out.set('LegR2', knee * kneeCurve(phase + Math.PI))
    // Arms counter-swing against the leg on the same side.
    out.set('ArmL1', arm * opposite - sprint * 0.25, 0, sprint * 0.12)
    out.set('ArmR1', arm * swing - sprint * 0.25, 0, -sprint * 0.12)
    // Elbows flex forward (-X), deepest as the arm swings through to the front.
    out.set('ArmL2', -(elbow + elbow * 0.35 * Math.max(0, -opposite)))
    out.set('ArmR2', -(elbow + elbow * 0.35 * Math.max(0, -swing)))
    // Torso leans in, twists with the stride and rolls on the footfall.
    out.set('Spine1', lean, twist * opposite, roll * Math.sin(phase * 2))
    out.set('Spine2', lean * 0.4, twist * 0.5 * opposite, 0)
    out.set('Neck1', -lean * 0.7, headTwist * swing, 0)
    out.bobY = -bob * Math.cos(phase * 2)
  }

  // Right arm holding the plane, mixed over whatever the state wrote. Its
  // inputs are all eased, so the arm glides between hold, fly and jump.
  writeCarry(dt, input) {
    const ease = (rate) => 1 - Math.exp(-rate * dt)
    this.carry += ((this.carrying ? 1 : 0) - this.carry) * ease(C.raiseRate)
    const airborne = this.state === 'airborne' ? 1 : 0
    const running = this.state === 'run' ? smoothstep(L.walkSpeed, L.runSpeed, input.speed) : 0
    this.fly += (Math.max(running, airborne) - this.fly) * ease(C.raiseRate)
    this.lift += (airborne - this.lift) * ease(C.raiseRate * 0.8)
    this.updateInspect(dt)
    if (this.carry < 1e-3) {
      this.wristYaw = 0
      return
    }

    const t = this.target
    const w = this.carry
    const stride = this.state === 'run' ? 1 : 0
    const value = (bone, axis) => {
      const hold = C.hold[bone]?.[axis] ?? 0
      const fly = C.fly[bone]?.[axis] ?? 0
      const air = C.air[bone]?.[axis] ?? 0
      const flown = hold + (fly - hold) * this.fly
      return flown + (air - flown) * this.lift + (C.inspect[bone]?.[axis] ?? 0) * this.inspect
    }
    const pose = {}
    for (const bone of CARRY_ARM) pose[bone] = AXES.map((axis) => value(bone, axis))
    this.wristYaw = -pose.ArmR1[1] * C.wristFollow * w
    // A gentle swing at a walk; flown, it only rides the footfalls.
    pose.ArmR1[0] += stride * ((1 - this.fly) * Math.sin(this.phase) * C.walkSwing + this.fly * Math.sin(this.phase * 2) * C.flyBob)
    // The procedural rig has no elbow: aim the whole arm where the forearm would point.
    if (!this.hasElbow) pose.ArmR1[0] += pose.ArmR2[0]
    const at = (bone) => BONE_INDEX[bone] * 3
    for (const bone of CARRY_ARM) {
      const i = at(bone)
      for (let a = 0; a < 3; a++) t.rotations[i + a] += (pose[bone][a] - t.rotations[i + a]) * w
    }
    for (const bone of ['Neck1', 'Spine1']) {
      const def = C.inspect[bone]
      t.add(bone, (def.x ?? 0) * this.inspect * w, (def.y ?? 0) * this.inspect * w, (def.z ?? 0) * this.inspect * w)
    }
  }

  // Every so often, standing still, the player lifts the plane and looks it over.
  updateInspect(dt) {
    const idle = this.carrying && this.state === 'idle' && this.stateTime > 1 && this.tossTime < 0
    if (this.inspectTime >= 0) {
      this.inspectTime += dt
      const u = this.inspectTime / C.inspectDuration
      if (!idle || u >= 1) {
        this.inspectTime = -1
        this.untilInspect = randomBetween(C.inspectEvery)
      } else {
        this.inspect = smoothstep(0, 0.22, u) * (1 - smoothstep(0.72, 1, u))
        return
      }
    }
    // Interrupted mid-look: let it go quickly rather than snapping.
    this.inspect *= Math.exp(-10 * dt)
    if (!idle) return
    this.untilInspect -= dt
    if (this.untilInspect <= 0) this.inspectTime = 0
  }

  // The toss, mixed over the blended pose so a state change mid-throw can't smear it.
  writeToss(dt) {
    if (this.tossTime < 0) return
    this.tossTime += dt
    const u = this.tossTime / T.duration
    if (u >= 1) {
      this.tossTime = -1
      return
    }
    let i = 0
    while (i < T.keys.length - 2 && u > T.keys[i + 1].u) i++
    const a = T.keys[i]
    const b = T.keys[i + 1]
    const k = smoothstep(a.u, b.u, u)
    const pose = this.tossPose
    pose.reset()
    for (const bone of TOSS_BONES) {
      const ra = a.pose[bone] ?? {}
      const rb = b.pose[bone] ?? {}
      pose.set(bone, ...AXES.map((axis) => lerp(ra[axis] ?? 0, rb[axis] ?? 0, k)))
    }
    // The procedural rig has no elbow: aim the whole arm where the forearm would point.
    if (!this.hasElbow) pose.add('ArmR1', pose.rotations[BONE_INDEX.ArmR2 * 3])
    const w = smoothstep(0, T.fadeIn, u) * (1 - smoothstep(T.fadeOut, 1, u))
    const out = this.output.rotations
    for (const bone of TOSS_BONES) {
      const at = BONE_INDEX[bone] * 3
      for (let a = 0; a < 3; a++) out[at + a] += (pose.rotations[at + a] - out[at + a]) * w
    }
  }

  blend(dt) {
    if (this.blendDuration > 0) {
      this.blendTime += dt
      const t = clamp(this.blendTime / this.blendDuration, 0, 1)
      this.output.lerpBetween(this.from, this.target, ease(t))
      if (t >= 1) this.blendDuration = 0
    } else {
      this.output.copyFrom(this.target)
    }
  }

  applyVisual(dt, input) {
    const wantBank = this.state === 'run' ? -input.turn * L.bankAngle * 0.6 : 0
    this.bank += (wantBank - this.bank) * (1 - Math.exp(-L.bankRate * dt))
    this.root.rotation.set(0, 0, this.bank)
    this.root.position.y = this.output.bobY
  }
}
