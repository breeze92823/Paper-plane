// The Ice World's own lobby decor (map.js adds it in World 2 only): igloos, snowmen, penguins,
// ice-crystal clumps and snow piles on the flat ground round the plaza and up the field, at
// config.js ICE_DECOR. Built from streetProps.js's kinds and merged like a street chunk into
// one lit mesh (and one unlit, for anything that glows), with a collider round each piece.
import { Mesh, MeshBasicMaterial, MeshStandardMaterial, Group } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { addCollider } from './colliders.js'
import { ICE_DECOR, MATERIAL_PBR } from './config.js'
import { part } from './props.js'
import { KINDS, Kit } from './streetProps.js'
import { mulberry32 } from './textures.js'

// Each list's kind, whether its third value is a yaw or a scale, and its collider: footprint
// (m, square, before scale), height, and how far it sits in front (+Z) of its spot, where the
// kind builds it. No footprint: ankle-high, walked straight over.
const PIECES = [
  { kind: 'igloo', list: ICE_DECOR.igloos, third: 'yaw', size: 5.6, h: 3, front: 0 },
  { kind: 'snowman', list: ICE_DECOR.snowmen, third: 'yaw', size: 1.8, h: 3.6, front: 1 },
  { kind: 'penguin', list: ICE_DECOR.penguins, third: 'yaw', size: 1.1, h: 2, front: 0.1 },
  { kind: 'iceCrystal', list: ICE_DECOR.crystals, third: 'scale', size: 2.6, h: 4, front: 1 },
  { kind: 'snowPile', list: ICE_DECOR.snowPiles, third: 'scale', size: 0, h: 0, front: 1 },
]

export function createIceDecor() {
  const kit = new Kit()
  const r = mulberry32(4242)
  for (const { kind, list, third, size, h, front } of PIECES) {
    for (const [x, z, v] of list) {
      const yaw = third === 'yaw' ? v : r() * Math.PI * 2
      const s = third === 'scale' ? v : 1
      KINDS[kind].build(kit.at(x, 0, z, yaw, s), r, KINDS[kind].size(r), {})
      if (!size) continue
      // The igloo's tunnel reaches out the front: its collider covers dome and tunnel.
      const cx = x + Math.sin(yaw) * front * s
      const cz = z + Math.cos(yaw) * front * s
      addCollider(cx, cz, size * s, (kind === 'igloo' ? size + 1.8 : size) * s, h * s, yaw)
    }
  }
  const g = new Group()
  g.name = 'iceDecor'
  g.add(part(mergeGeometries(kit.solid), new MeshStandardMaterial({ vertexColors: true, ...MATERIAL_PBR.PROP })))
  if (kit.glow.length) g.add(new Mesh(mergeGeometries(kit.glow), new MeshBasicMaterial({ vertexColors: true })))
  return g
}
