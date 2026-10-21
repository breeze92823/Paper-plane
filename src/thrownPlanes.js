// Draws the planes in flight (throw.js's `flights`): a fixed pool of paper darts,
// the same folded geometry as the one in the hand, synced each frame. Slot i shows
// flights[i]; unused slots hide. Each is tinted the colour it was thrown in. Wings flex and
// flutter with airspeed, and still once the plane lies on the ground.
import { DoubleSide, Group, MeshStandardMaterial } from 'three'
import { flights } from './throw.js'
import { PaperDart, paperTexture } from './avatar/heldPlane.js'
import { HELD_PLANE as P, THROW } from './config.js'

const TAU = Math.PI * 2

export class ThrownPlanes {
  constructor() {
    const paper = paperTexture()
    this.object = new Group()
    this.object.name = 'thrownPlanes'
    this.slots = []
    for (let i = 0; i < THROW.poolSize; i++) {
      // One material per slot, so each can carry its own plane's colour.
      const dart = new PaperDart(new MeshStandardMaterial({ map: paper, vertexColors: true, roughness: 0.88, metalness: 0, side: DoubleSide }))
      dart.mesh.visible = false
      dart.mesh.frustumCulled = false // the bounding sphere is the dart's rest shape; cheap to skip
      this.object.add(dart.mesh)
      this.slots.push({ dart, phase: Math.random() * TAU })
    }
  }

  update(dt) {
    for (let i = 0; i < this.slots.length; i++) {
      const { dart } = this.slots[i]
      const f = flights[i]
      dart.mesh.visible = !!f
      if (!f) continue
      dart.mesh.position.copy(f.position)
      dart.mesh.quaternion.copy(f.quaternion)
      dart.mesh.material.color.set(f.color ?? '#ffffff')
      const s = 1 - f.fade * f.fade * (3 - 2 * f.fade)
      dart.mesh.scale.setScalar(s)
      const air = f.landed ? 0 : Math.min(f.velocity.length() / P.airspeedReference, 1.6)
      const slot = this.slots[i]
      slot.phase += (P.flutterFrequency[0] + air * P.flutterFrequency[1]) * TAU * dt
      const flex = air * air * P.flexPerAir
      dart.deform({
        flexInner: flex * 0.45,
        flexOuter: flex,
        flutter: air * air * P.flutterAmplitude,
        flutterPhase: slot.phase,
        keelSway: 0,
      })
    }
  }
}
