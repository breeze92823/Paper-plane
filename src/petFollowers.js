// The equipped pets flying after the player, after Chop-trees-for-treasure's
// PetFollowers.jsx: an arc behind them, easing after them as they move, bobbing and
// flapping. Every pet is the same little round flyer in its own colour (EGG_SHOP `color`),
// with a halo for Legendary and Mythic ones. World space, not parented to the player, so
// they lag and swing round naturally. Rebuilt only when the equipped set changes.
import { ConeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, TorusGeometry, BoxGeometry } from 'three'
import { PET_FOLLOW as F } from './config.js'
import { equippedPets, petInfo } from './pets.js'

const TAU = Math.PI * 2
const HALO = { legendary: '#ffd23f', mythic: '#ff6ad5' }

function petModel(info) {
  const g = new Group()
  const body = new MeshStandardMaterial({ color: info.color, roughness: 0.55 })
  const dark = new MeshStandardMaterial({ color: '#1a1a22', roughness: 0.3 })
  const white = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 })
  const beakMat = new MeshStandardMaterial({ color: '#ffa63d', roughness: 0.5 })
  const add = (geo, mat, x, y, z) => {
    const m = new Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    g.add(m)
    return m
  }
  add(new SphereGeometry(0.5, 16, 12), body, 0, 0, 0).scale.set(1, 0.92, 1.08)
  add(new SphereGeometry(0.3, 12, 10), white, 0, -0.12, 0.28).scale.set(1, 0.9, 0.6) // belly
  for (const sx of [-1, 1]) {
    add(new SphereGeometry(0.09, 10, 8), dark, sx * 0.18, 0.14, 0.44)
    add(new SphereGeometry(0.03, 6, 6), white, sx * 0.16, 0.18, 0.52)
  }
  add(new ConeGeometry(0.08, 0.2, 8).rotateX(Math.PI / 2), beakMat, 0, 0.02, 0.56)
  add(new ConeGeometry(0.14, 0.32, 8).rotateX(-Math.PI / 2), body, 0, 0.05, -0.56) // tail
  // Wings pivot at the shoulders so they flap from the body.
  const wings = [-1, 1].map((sx) => {
    const pivot = new Group()
    pivot.position.set(sx * 0.42, 0.08, -0.02)
    const wing = new Mesh(new BoxGeometry(0.62, 0.07, 0.38), body)
    wing.position.x = sx * 0.3
    wing.castShadow = true
    pivot.add(wing)
    g.add(pivot)
    return { pivot, sx }
  })
  if (HALO[info.rarity]) {
    const halo = new Mesh(new TorusGeometry(0.28, 0.045, 8, 24).rotateX(Math.PI / 2), new MeshBasicMaterial({ color: HALO[info.rarity] }))
    halo.position.y = 0.72
    g.add(halo)
  }
  g.scale.setScalar(F.scale)
  return { group: g, wings }
}

export class PetFollowers {
  constructor() {
    this.object = new Group()
    this.object.name = 'petFollowers'
    this.pets = [] // { group, wings, phase, placed }
    this.key = ''
  }

  // Rebuilds the followers when the equipped pets change (call with store.js's game).
  sync(state) {
    const list = equippedPets(state)
    const key = list.map((p) => p.id).join(',')
    if (key === this.key) return
    this.key = key
    for (const p of this.pets) {
      this.object.remove(p.group)
      p.group.traverse((o) => {
        o.geometry?.dispose()
        o.material?.dispose()
      })
    }
    this.pets = list.map((pet, i) => ({ ...petModel(petInfo(pet)), phase: i * 1.7, placed: false }))
    for (const p of this.pets) this.object.add(p.group)
  }

  // anchor: the player's { x, y, z } feet and `facing` yaw.
  update(dt, time, anchor) {
    const n = this.pets.length
    const k = 1 - Math.exp(-F.followHz * Math.min(dt, 0.1))
    this.pets.forEach((p, slot) => {
      const g = p.group
      const angle = anchor.facing + Math.PI + (slot - (n - 1) / 2) * F.spread
      const tx = anchor.x + Math.sin(angle) * F.radius
      const tz = anchor.z + Math.cos(angle) * F.radius
      const ty = anchor.y + F.height + Math.sin(time * 3 + p.phase) * F.bob
      if (!p.placed) {
        g.position.set(tx, ty, tz)
        g.rotation.y = anchor.facing
        p.placed = true
      }
      const dx = tx - g.position.x
      const dz = tz - g.position.z
      g.position.x += dx * k
      g.position.y += (ty - g.position.y) * k
      g.position.z += dz * k
      // Face the way it is flying; otherwise settle to the player's heading.
      const want = dx * dx + dz * dz > 0.04 ? Math.atan2(dx, dz) : anchor.facing
      const turn = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y))
      g.rotation.y = (g.rotation.y + turn * k) % TAU
      const flap = Math.sin(time * 14 + p.phase) * 0.7
      for (const w of p.wings) w.pivot.rotation.z = w.sx * flap
    })
  }
}
