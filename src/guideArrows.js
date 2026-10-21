// The tutorial trail, after Stone-Skipping's GuideArrows.jsx: a line of white 3D arrowheads
// on the ground from the player to wherever the current tutorial step happens
// (tutorial.js), crawling toward it. One instanced mesh; nothing drawn without a target.
import { ExtrudeGeometry, InstancedMesh, MeshStandardMaterial, Object3D, Shape } from 'three'
import { floorUnder } from './colliders.js'
import { player } from './player.js'

const SPACING = 0.95 // m between arrows
const SPEED = 1.6 // m/s the trail crawls toward the target
const MAX_ARROWS = 90
const HIDE_WITHIN = 2.5 // m from the target where the trail disappears
const LIFT = 0.22 // m above the floor

const _dummy = new Object3D()

export class GuideArrows {
  constructor() {
    const s = new Shape()
    s.moveTo(0, 0.42)
    s.lineTo(0.34, -0.2)
    s.lineTo(0, -0.05)
    s.lineTo(-0.34, -0.2)
    s.closePath()
    const geo = new ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 })
    geo.center()
    this.mesh = new InstancedMesh(geo, new MeshStandardMaterial({ color: '#eef1f6', roughness: 0.5 }), MAX_ARROWS)
    this.mesh.name = 'guideArrows'
    this.mesh.castShadow = true
    this.mesh.frustumCulled = false
    this.mesh.count = 0
    this.time = 0
  }

  // `target` is { x, z } or null.
  update(dt, target) {
    this.time += dt
    const mesh = this.mesh
    if (!target) {
      mesh.count = 0
      return
    }
    const p = player.position
    const dx = target.x - p.x
    const dz = target.z - p.z
    const dist = Math.hypot(dx, dz)
    const ux = dx / (dist || 1)
    const uz = dz / (dist || 1)
    const heading = Math.atan2(ux, uz)
    const phase = (this.time * SPEED) % SPACING

    let n = 0
    if (dist > HIDE_WITHIN) {
      for (let d = 1.2 + phase; d < dist - 0.6 && n < MAX_ARROWS; d += SPACING) {
        const x = p.x + ux * d
        const z = p.z + uz * d
        // The floor a step or so above the feet, so the trail climbs the hall's steps.
        _dummy.position.set(x, floorUnder(x, z, p.y + 0.7) + LIFT, z)
        // Laid down, tip toward the target, tilted up a little like Roblox beam arrows.
        _dummy.rotation.set(Math.PI / 2 - 0.35, heading, 0, 'YXZ')
        _dummy.updateMatrix()
        mesh.setMatrixAt(n++, _dummy.matrix)
      }
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
  }
}
