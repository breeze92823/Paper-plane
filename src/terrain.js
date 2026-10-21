// The blocky hills ringing the lobby: a grid of grass-capped dirt columns that
// step up the further they sit from the open ground (MAP.open), extra tall past
// MAP.cliff (the walls behind the eggs and the training pads), with pines on top. All columns merge
// into two meshes (dirt, grass) and all trees into two more (trunks,
// vertex-coloured leaves).
import { Group, Mesh, MeshStandardMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { addCollider } from './colliders.js'
import { MAP, MATERIAL_PBR, PALETTE as P } from './config.js'
import { mulberry32, noiseTile } from './textures.js'
import { oakParts, tiledBox, treeParts } from './props.js'

const CELL = 8 // m, column footprint
const STEP = 2.5 // m between terrace levels
const MAX_H = 20
const GRASS_CAP = 0.8 // m of grass on top of each column
const EXTENT = { minX: -152, maxX: 152, minZ: -176, maxZ: 104 }
const COLLIDE_WITHIN = 30 // m from the open ground; columns further out are unreachable
const TREES_WITHIN = 60

// Metres from (x, z) to the nearest open rectangle (0 inside one).
function distanceToOpen(x, z) {
  let best = Infinity
  for (const r of MAP.open) {
    const dx = Math.max(r.minX - x, 0, x - r.maxX)
    const dz = Math.max(r.minZ - z, 0, z - r.maxZ)
    best = Math.min(best, Math.hypot(dx, dz))
  }
  return best
}

export function createTerrain() {
  const rand = mulberry32(2024)
  const dirt = []
  const grass = []
  const trunks = []
  const leaves = []

  const column = (x, z, w, d, h, collide) => {
    dirt.push(tiledBox(w, h - GRASS_CAP, d, 4).translate(x, (h - GRASS_CAP) / 2, z))
    grass.push(tiledBox(w, GRASS_CAP, d, 4).translate(x, h - GRASS_CAP / 2, z))
    if (collide) addCollider(x, z, w, d, h)
  }
  const tree = (x, y, z, s, kind) => {
    const t = (kind === 'oak' ? oakParts : treeParts)(x, y, z, s)
    trunks.push(t.trunk)
    leaves.push(...t.leaves)
  }

  for (let x = EXTENT.minX; x <= EXTENT.maxX; x += CELL) {
    for (let z = EXTENT.minZ; z <= EXTENT.maxZ; z += CELL) {
      const dist = distanceToOpen(x, z) - CELL / 2
      const r = rand()
      if (dist <= 0) continue
      const c = MAP.cliff
      const cliff = c.past.some(([axis, min]) => (axis === 'x' ? x : z) > min)
      // Random half/whole-level bumps; the cliff's three lowest faces stay even for the waterfall.
      const bump = cliff ? (dist >= 24 && r < 0.4 ? 1 : 0) : r < 0.3 ? 0.5 : 0
      const level = 1 + Math.floor(dist / 7) + bump
      const h = cliff ? Math.min(c.maxH, level * STEP * c.slope + c.add) : Math.min(MAX_H, level * STEP)
      column(x, z, CELL, CELL, h, dist < COLLIDE_WITHIN)
      if (dist < TREES_WITHIN && rand() < 0.2) {
        tree(x + (rand() - 0.5) * 4, h, z + (rand() - 0.5) * 4, 1 + rand() * 0.6)
      }
    }
  }

  for (const b of MAP.banks) column(b.x, b.z, b.w, b.d, b.h, true)
  for (const [x, z, s, kind] of MAP.trees) {
    tree(x, 0, z, s, kind)
    addCollider(x, z, 0.9 * s, 0.9 * s, 2.4 * s) // free-standing: walk around the trunk
  }

  const group = new Group()
  const mesh = (geos, material, cast = true) => {
    const m = new Mesh(mergeGeometries(geos), material)
    m.castShadow = cast
    m.receiveShadow = true
    group.add(m)
  }
  mesh(dirt, new MeshStandardMaterial({ map: noiseTile(P.dirt, 0.22, 7), ...MATERIAL_PBR.GROUND }))
  mesh(grass, new MeshStandardMaterial({ map: noiseTile(P.grassTop, 0.12, 9), ...MATERIAL_PBR.GROUND }))
  mesh(trunks, new MeshStandardMaterial({ vertexColors: true, ...MATERIAL_PBR.PROP }))
  mesh(leaves, new MeshStandardMaterial({ vertexColors: true, ...MATERIAL_PBR.PROP }))
  return group
}
