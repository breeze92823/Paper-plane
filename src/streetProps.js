// What lines the street, zone by zone (street.js places it): the buildings and props on the
// lots either side, and a lamp along each sidewalk. After Stone-Skipping's bank scatter
// (LakeBanks.jsx buildBankDecor + ZONE_THEMES), but every piece is a few plain boxes,
// cylinders and cones with vertex colours, so street.js can merge a whole stretch into one
// lit mesh plus one unlit "glow" mesh (lamp heads, neon, lit windows).
//
// Builders work in a local frame: base on y = 0, centred on x = z = 0, the front (door,
// shop window) facing +Z, which street.js turns toward the road.
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Matrix4, Shape, SphereGeometry, TorusGeometry, Vector2 } from 'three'

const TAU = Math.PI * 2
const _c = new Color()

// Collects world-space, non-indexed, vertex-coloured geometry: `solid` for lit parts,
// `glow` for parts drawn unlit at full brightness. `at` sets the frame later parts go in.
export class Kit {
  constructor() {
    this.solid = []
    this.glow = []
    this.frame = new Matrix4()
  }

  at(x, y, z, yaw = 0) {
    this.frame.makeRotationY(yaw).setPosition(x, y, z)
    return this
  }

  // Any geometry already placed in the local frame.
  geo(geo, color, glow = false) {
    const g = geo.index ? geo.toNonIndexed() : geo
    if (g !== geo) geo.dispose()
    g.deleteAttribute('uv')
    g.applyMatrix4(this.frame)
    _c.set(color)
    const n = g.attributes.position.count
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) arr.set([_c.r, _c.g, _c.b], i * 3)
    g.setAttribute('color', new Float32BufferAttribute(arr, 3))
    ;(glow ? this.glow : this.solid).push(g)
  }

  // Box standing on y (its base), centred on x, z.
  box(w, h, d, x, y, z, color, glow) {
    this.geo(new BoxGeometry(w, h, d).translate(x, y + h / 2, z), color, glow)
  }

  cyl(rTop, rBottom, h, x, y, z, color, seg = 8, glow) {
    this.geo(new CylinderGeometry(rTop, rBottom, h, seg).translate(x, y + h / 2, z), color, glow)
  }

  cone(r, h, x, y, z, color, seg = 8, glow) {
    this.geo(new ConeGeometry(r, h, seg).translate(x, y + h / 2, z), color, glow)
  }

  // Ball centred at (x, y, z).
  ball(r, x, y, z, color, glow, sy = 1) {
    this.geo(new SphereGeometry(r, 10, 7).scale(1, sy, 1).translate(x, y, z), color, glow)
  }

  // Gable roof: ridge along local Z, `w` across, `d` deep, `rh` high, eaves on y.
  gable(w, d, rh, x, y, z, color) {
    const shape = new Shape([new Vector2(-w / 2, 0), new Vector2(0, rh), new Vector2(w / 2, 0)])
    this.geo(new ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }).translate(x, y, z - d / 2), color)
  }
}

const pick = (r, list) => list[Math.floor(r() * list.length)]
const between = (r, lo, hi) => lo + r() * (hi - lo)

// --- Shared pieces --------------------------------------------------------------------
// A grid of windows on the front (+Z) face of a w x h x d block, `floors` x `cols`, plus a
// column on each side (the faces the chase camera sees, looking up the street).
function windows(k, { w, d, floors, floorH, cols, glass, glow = false, y0 = 0.9, sideCols = 1 }) {
  const ww = Math.min(1.4, (w / cols) * 0.5)
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * floorH
    for (let c = 0; c < cols; c++) k.box(ww, 1.3, 0.12, -w / 2 + (w / cols) * (c + 0.5), y, d / 2, glass, glow)
    for (let c = 0; c < sideCols; c++) {
      const z = -d / 2 + (d / sideCols) * (c + 0.5)
      for (const sx of [-1, 1]) k.box(0.12, 1.3, ww, (sx * w) / 2, y, z, glass, glow)
    }
  }
}

function door(k, x, d, color, w = 1.3) {
  k.box(w, 2.3, 0.14, x, 0, d / 2, color)
}

function pine(k, x, z, s, leaf = ['#3cb83a', '#58d046'], trunk = '#7a4b2a', y = 0) {
  k.box(0.7 * s, 2 * s, 0.7 * s, x, y, z, trunk)
  const tiers = [[4.2, 1.4], [3.2, 1.3], [2.2, 1.2], [1.1, 1]]
  let ty = y + 1.7 * s
  tiers.forEach(([w, h], i) => {
    k.box(w * s, h * s, w * s, x, ty, z, leaf[i % leaf.length])
    ty += h * s * 0.82
  })
}

function oak(k, x, z, s, leaf = ['#3cb83a', '#58d046'], trunk = '#7a4b2a') {
  k.box(0.9 * s, 3.6 * s, 0.9 * s, x, 0, z, trunk)
  k.box(4.6 * s, 1.6 * s, 4.2 * s, x, 3.4 * s, z, leaf[0])
  k.box(3.4 * s, 1.3 * s, 3 * s, x + 0.3 * s, 4.8 * s, z - 0.2 * s, leaf[1])
  k.box(2 * s, 1.1 * s, 2 * s, x - 2.2 * s, 3.2 * s, z + 0.8 * s, leaf[1])
}

// --- Lamps (one per sidewalk every LAMP_EVERY m; street.js) --------------------------
// { pole, head, light } colours; `light` glows. Built facing +Z like everything else.
export function lamp(k, { pole, head, light }) {
  k.cyl(0.25, 0.32, 0.4, 0, 0, 0, pole)
  k.cyl(0.11, 0.13, 4.4, 0, 0.4, 0, pole)
  k.box(0.6, 0.12, 0.6, 0, 4.55, 0, head)
  k.box(0.42, 0.55, 0.42, 0, 4.67, 0, light, true)
  k.cone(0.42, 0.35, 0, 5.22, 0, head, 4)
}

// --- Kinds ------------------------------------------------------------------------------
// Each: size(r, theme) -> { w (frontage along the street), d (depth) }, then
// build(k, r, size, theme). Themes pick kinds by name and supply colours.
export const KINDS = {
  // Two-storey house with a gable roof, porch light and a hedge, in the theme's colours.
  house: {
    size: (r) => ({ w: between(r, 8, 11), d: between(r, 8, 10) }),
    build(k, r, { w, d }, t) {
      const floors = r() < 0.7 ? 2 : 1
      const h = floors * 3
      k.box(w, h, d, 0, 0, 0, pick(r, t.walls))
      windows(k, { w, d, floors, floorH: 3, cols: 3, glass: t.glass, glow: t.litWindows })
      door(k, w * 0.3, d, t.door ?? '#7a4b2a')
      k.gable(w + 1, d + 1, Math.min(w, d) * 0.45, 0, h, 0, pick(r, t.roofs))
      if (r() < 0.5) k.box(0.9, 1.8, 0.9, -w * 0.25, h + 0.6, -d * 0.15, t.chimney ?? '#8a4a3a')
      k.box(w * 0.9, 0.9, 0.8, 0, 0, d / 2 + 2.2, t.hedge ?? '#3a9e36')
    },
  },
  // Shop: flat roof, a striped awning over a wide shop window, flats above.
  shop: {
    size: (r) => ({ w: between(r, 9, 12), d: between(r, 9, 12) }),
    build(k, r, { w, d }, t) {
      const floors = 2 + Math.floor(r() * 2)
      const h = floors * 3.2
      k.box(w, h, d, 0, 0, 0, pick(r, t.walls))
      k.box(w + 0.4, 0.6, d + 0.4, 0, h, 0, t.parapet ?? '#7d3a2c')
      k.box(w * 0.7, 2, 0.14, -w * 0.08, 0.4, d / 2, t.glass)
      door(k, w * 0.38, d, t.door ?? '#3a3f47', 1.2)
      const awning = pick(r, t.awnings)
      const stripes = 5
      for (let i = 0; i < stripes; i++) {
        k.box(w / stripes, 0.3, 1.6, -w / 2 + (w / stripes) * (i + 0.5), 2.8, d / 2 + 0.8, i % 2 ? '#ffffff' : awning)
      }
      windows(k, { w, d, floors: floors - 1, floorH: 3.2, cols: 3, glass: t.glass, y0: 4.1 })
    },
  },
  kiosk: {
    size: () => ({ w: 4.5, d: 4 }),
    build(k, r, { w, d }, t) {
      k.box(w, 2.6, d, 0, 0, 0, pick(r, t.awnings))
      k.box(w * 0.8, 1, 0.14, 0, 1, d / 2, t.glass)
      k.box(w + 0.6, 0.3, d + 0.6, 0, 2.6, 0, '#ffffff')
    },
  },
  pine: {
    size: () => ({ w: 5, d: 5 }),
    build: (k, r, s, t) => pine(k, between(r, -0.8, 0.8), between(r, -2, 2), between(r, 0.9, 1.3), t.leaves),
  },
  oak: {
    size: () => ({ w: 6, d: 6 }),
    build: (k, r, s, t) => oak(k, 0, between(r, -2, 2), between(r, 0.9, 1.25), t.leaves),
  },
  hedge: {
    size: (r) => ({ w: between(r, 4, 7), d: 1.4 }),
    build: (k, r, { w }, t) => k.box(w, 1, 1.2, 0, 0, 2, t.hedge ?? '#3a9e36'),
  },
  // Park: round stone fountain with a two-tier centre.
  fountain: {
    size: () => ({ w: 8, d: 8 }),
    build(k) {
      k.cyl(3.2, 3.4, 0.7, 0, 0, 0, '#d9dde3', 16)
      k.cyl(2.8, 2.8, 0.05, 0, 0.62, 0, '#4fc3f0', 16)
      k.cyl(0.4, 0.5, 1.8, 0, 0.6, 0, '#d9dde3')
      k.cyl(1.2, 0.6, 0.35, 0, 2.3, 0, '#d9dde3', 12)
      k.cyl(0.18, 0.18, 0.9, 0, 2.6, 0, '#bfe9ff', 6)
    },
  },
  bench: {
    size: () => ({ w: 3, d: 2 }),
    build(k) {
      k.box(2.2, 0.12, 0.6, 0, 0.5, 2.2, '#a0652f')
      k.box(2.2, 0.5, 0.1, 0, 0.62, 1.95, '#a0652f')
      for (const sx of [-1, 1]) k.box(0.12, 0.5, 0.5, sx * 0.95, 0, 2.2, '#3a3f47')
    },
  },
  pond: {
    size: (r) => ({ w: between(r, 10, 14), d: between(r, 8, 11) }),
    build(k, r, { w, d }) {
      k.box(w, 0.25, d, 0, 0, 0, '#c9b48a')
      k.box(w - 1, 0.06, d - 1, 0, 0.22, 0, '#3fb5e8')
      for (let i = 0; i < 3; i++) k.cyl(0.35, 0.35, 0.05, between(r, -w / 3, w / 3), 0.3, between(r, -d / 3, d / 3), '#3cb83a', 8)
    },
  },
  flowerbed: {
    size: () => ({ w: 5, d: 3 }),
    build(k, r) {
      k.box(4.4, 0.4, 2.2, 0, 0, 1.5, '#8a5a33')
      for (let i = 0; i < 9; i++) k.box(0.35, 0.35, 0.35, -1.8 + (i % 5) * 0.9, 0.4, 1 + Math.floor(i / 5) * 0.9, pick(r, ['#ff5c7a', '#ffd23a', '#ff9ad5', '#ffffff', '#b06cff']))
    },
  },
  // Downtown / Neon Night: a tall block ringed by window bands (one box per band wraps all
  // four faces), a roof plant and an antenna. `t.neon` makes the bands glow in neon colours.
  tower: {
    size: (r) => ({ w: between(r, 11, 16), d: between(r, 11, 15) }),
    build(k, r, { w, d }, t) {
      const floors = 6 + Math.floor(r() * 9)
      const h = floors * 3.5 + 1
      k.box(w, h, d, 0, 0, 0, pick(r, t.walls))
      const neon = t.neon ? pick(r, t.neon) : null
      const band = neon ? 0.4 : 1.5 // neon reads as thin glowing strips, glass as window rows
      for (let f = 0; f < floors; f++) {
        k.box(w + 0.14, band, d + 0.14, 0, 1.6 + f * 3.5, 0, neon ? (f % 2 ? neon : pick(r, t.neon)) : t.glass, !!neon)
      }
      k.box(w * 0.5, 2.6, 0.2, 0, 0, d / 2 + 0.05, neon ?? t.glass, !!neon)
      k.box(w * 0.55, 2, d * 0.55, 0, h, 0, t.roofPlant ?? '#8a939e')
      k.cyl(0.12, 0.16, 5, w * 0.12, h + 2, 0, '#c3c9d1', 6)
      if (neon) k.box(0.4, 0.4, 0.4, w * 0.12, h + 7, 0, neon, true)
    },
  },
  billboard: {
    size: () => ({ w: 8, d: 2 }),
    build(k, r, s, t) {
      for (const sx of [-1, 1]) k.cyl(0.18, 0.22, 6, sx * 2.6, 0, 0, '#5b6270', 6)
      k.box(7.2, 3.8, 0.35, 0, 6, 0, '#3a3f47')
      k.box(6.8, 3.4, 0.1, 0, 6.2, 0.22, pick(r, t.billboards), true)
      k.box(2.2, 0.8, 0.12, -1.6, 7.6, 0.3, '#ffffff', true)
    },
  },
  // Seaside Boardwalk.
  palm: {
    size: () => ({ w: 5, d: 5 }),
    build(k, r) {
      const lean = between(r, -0.5, 0.5)
      let x = 0
      for (let i = 0; i < 7; i++) {
        k.box(0.55 - i * 0.03, 0.95, 0.55 - i * 0.03, x, i * 0.9, 0, i % 2 ? '#a8763f' : '#8f6332')
        x += lean * 0.18
      }
      const top = 6.4
      for (let i = 0; i < 6; i++) {
        const leaf = new BoxGeometry(3, 0.16, 0.8).translate(1.5, 0, 0).rotateZ(-0.38).rotateY((i * TAU) / 6 + r()).translate(x, top, 0)
        k.geo(leaf, i % 2 ? '#3cb83a' : '#58d046')
      }
      for (let i = 0; i < 3; i++) k.ball(0.22, x + Math.cos(i * 2.1) * 0.35, top - 0.3, Math.sin(i * 2.1) * 0.35, '#6b4a2a')
    },
  },
  hut: {
    size: (r) => ({ w: between(r, 4.2, 5), d: 4 }),
    build(k, r, { w, d }, t) {
      const a = pick(r, t.huts)
      for (let i = 0; i < 5; i++) k.box(w / 5, 2.6, d, -w / 2 + (w / 5) * (i + 0.5), 0.3, 0, i % 2 ? '#ffffff' : a)
      k.box(w + 0.3, 0.3, d + 0.3, 0, 0, 0, '#b98a52')
      k.gable(w + 0.6, d + 0.6, 1.3, 0, 2.9, 0, a)
      door(k, 0, d, '#ffffff', 1.1)
    },
  },
  umbrella: {
    size: () => ({ w: 4, d: 3 }),
    build(k, r, s, t) {
      k.cyl(0.06, 0.06, 2.3, 0, 0, 1, '#f4f4f4', 6)
      k.cone(1.7, 0.7, 0, 2.2, 1, pick(r, t.huts), 10)
      k.box(1, 0.05, 2, 1.2, 0, 1.6, pick(r, t.huts))
    },
  },
  lighthouse: {
    size: () => ({ w: 9, d: 9 }),
    build(k) {
      k.cyl(3.2, 3.6, 1.2, 0, 0, 0, '#b8c0ca', 12)
      for (let i = 0; i < 6; i++) k.cyl(2.3 - (i + 1) * 0.15, 2.3 - i * 0.15, 2.4, 0, 1.2 + i * 2.4, 0, i % 2 ? '#ffffff' : '#e8323a', 12)
      k.cyl(1.9, 1.9, 0.3, 0, 15.6, 0, '#3a3f47', 12)
      k.cyl(1, 1, 1.6, 0, 15.9, 0, '#fff2b0', 8, true)
      k.cone(1.4, 1.4, 0, 17.5, 0, '#e8323a', 8)
    },
  },
  // Snowy Lane (its houses are `house` with white roofs).
  snowman: {
    size: () => ({ w: 3, d: 3 }),
    build(k, r) {
      k.ball(0.9, 0, 0.85, 1, '#fbfdff')
      k.ball(0.62, 0, 2.15, 1, '#fbfdff')
      k.ball(0.42, 0, 3.1, 1, '#fbfdff')
      k.cyl(0.32, 0.32, 0.55, 0, 3.4, 1, '#22252b', 10)
      k.cyl(0.5, 0.5, 0.06, 0, 3.4, 1, '#22252b', 10)
      k.geo(new ConeGeometry(0.08, 0.45, 6).rotateX(Math.PI / 2).translate(0, 3.1, 1.6), '#ff8a1f')
      k.box(1.2, 0.18, 0.18, 0, 2.5, 1.35, pick(r, ['#e8323a', '#2c8cec', '#2f9e44']))
    },
  },
  // Spooky Street.
  haunted: {
    size: (r) => ({ w: between(r, 8, 10), d: between(r, 8, 10) }),
    build(k, r, { w, d }, t) {
      const h = 9
      const wall = pick(r, t.walls)
      k.box(w, h, d, 0, 0, 0, wall)
      windows(k, { w, d, floors: 3, floorH: 3, cols: 2, glass: t.glass, glow: true })
      door(k, 0, d, '#1f1a2b')
      const roof = pick(r, t.roofs)
      k.gable(w + 1, d + 1, w * 0.8, 0, h, 0, roof)
      const sx = r() < 0.5 ? -1 : 1
      k.box(3, h + 4, 3, (sx * w) / 2, 0, -d / 4, wall)
      k.box(0.8, 1.2, 0.12, (sx * w) / 2, h + 1.5, -d / 4 + 1.5, t.glass, true)
      k.cone(2.4, 4, (sx * w) / 2, h + 4, -d / 4, roof, 4)
    },
  },
  deadtree: {
    size: () => ({ w: 5, d: 5 }),
    build(k, r) {
      const bark = '#3d3328'
      k.box(0.7, 4.5, 0.7, 0, 0, 0, bark)
      for (let i = 0; i < 4; i++) {
        const branch = new BoxGeometry(0.25, 2.2, 0.25).translate(0, 1.1, 0).rotateZ((i % 2 ? 1 : -1) * between(r, 0.6, 1)).rotateY(r() * TAU).translate(0, 2.4 + i * 0.6, 0)
        k.geo(branch, bark)
      }
    },
  },
  pumpkin: {
    size: () => ({ w: 3, d: 3 }),
    build(k, r) {
      const s = between(r, 0.8, 1.2)
      k.ball(0.9 * s, 0, 0.65 * s, 1, '#ff8a1f', false, 0.72)
      k.cyl(0.08 * s, 0.12 * s, 0.4 * s, 0, 1.2 * s, 1, '#3a6b2a', 6)
      for (const ex of [-0.32, 0.32]) k.box(0.22 * s, 0.2 * s, 0.1, ex * s, 0.75 * s, 1 + 0.86 * s, '#ffe14d', true)
      k.box(0.6 * s, 0.12 * s, 0.1, 0, 0.42 * s, 1 + 0.82 * s, '#ffe14d', true)
    },
  },
  graves: {
    size: () => ({ w: 6, d: 4 }),
    build(k, r) {
      for (let i = 0; i < 3; i++) {
        const x = -2 + i * 2 + between(r, -0.3, 0.3)
        const z = between(r, 0, 1.5)
        k.box(0.9, 1.1, 0.25, x, 0, z, '#8a8f99')
        k.geo(new CylinderGeometry(0.45, 0.45, 0.25, 10).rotateX(Math.PI / 2).translate(x, 1.1, z), '#8a8f99')
      }
    },
  },
  // Candy Town.
  gingerbread: {
    size: (r) => ({ w: between(r, 8, 10), d: between(r, 7, 9) }),
    build(k, r, { w, d }, t) {
      const h = 5.6
      k.box(w, h, d, 0, 0, 0, pick(r, t.walls))
      for (const y of [0.1, 2.8, 5.4]) k.box(w + 0.16, 0.22, d + 0.16, 0, y, 0, '#ffffff')
      windows(k, { w, d, floors: 2, floorH: 2.7, cols: 2, glass: t.glass })
      door(k, 0, d, '#ff4f9a')
      k.gable(w + 1.2, d + 1.2, w * 0.5, 0, h, 0, pick(r, t.roofs))
      for (let i = 0; i < 4; i++) k.ball(0.35, 0, h + w * 0.5 + 0.1, -d / 2 + (d / 3) * i, pick(r, t.sweets))
    },
  },
  lollipop: {
    size: () => ({ w: 4, d: 3 }),
    build(k, r, s, t) {
      k.cyl(0.12, 0.12, 4, 0, 0, 0, '#ffffff', 6)
      k.geo(new CylinderGeometry(1.3, 1.3, 0.3, 18).rotateX(Math.PI / 2).translate(0, 4.6, 0), pick(r, t.sweets))
      k.geo(new CylinderGeometry(0.75, 0.75, 0.34, 14).rotateX(Math.PI / 2).translate(0, 4.6, 0), '#ffffff')
      k.geo(new CylinderGeometry(0.35, 0.35, 0.38, 10).rotateX(Math.PI / 2).translate(0, 4.6, 0), pick(r, t.sweets))
    },
  },
  candycane: {
    size: () => ({ w: 3, d: 3 }),
    build(k) {
      for (let i = 0; i < 8; i++) k.cyl(0.22, 0.22, 0.5, 0, i * 0.5, 0, i % 2 ? '#ffffff' : '#e8323a', 8)
      k.geo(new TorusGeometry(0.6, 0.22, 6, 10, Math.PI).translate(0.6, 4, 0), '#e8323a')
    },
  },
  gumdrop: {
    size: () => ({ w: 3, d: 3 }),
    build(k, r, s, t) {
      const c = pick(r, t.sweets)
      k.cyl(0.55, 1, 1.1, 0, 0, 1, c, 10)
      k.ball(0.56, 0, 1.1, 1, c, false, 0.6)
    },
  },
  // Neon Night (its towers are `tower` with `neon` colours).
  neonSign: {
    size: () => ({ w: 5, d: 2 }),
    build(k, r, s, t) {
      k.cyl(0.15, 0.2, 4.5, 0, 0, 0, '#1a1d33', 6)
      k.box(4, 2.2, 0.3, 0, 4.5, 0, '#1a1d33')
      const c = pick(r, t.neon)
      k.box(3.6, 0.25, 0.1, 0, 5.9, 0.2, c, true)
      k.box(3.6, 0.25, 0.1, 0, 4.7, 0.2, c, true)
      k.box(2.4, 0.7, 0.1, 0, 5.1, 0.2, pick(r, t.neon), true)
    },
  },
  // Sky Port.
  hangar: {
    size: (r) => ({ w: between(r, 16, 20), d: between(r, 12, 16) }),
    build(k, r, { w, d }, t) {
      const wall = 2.2
      k.box(w, wall, d, 0, 0, 0, '#c3c9d1')
      // Half a cylinder lying along the depth, flattened: the curved roof.
      k.geo(new CylinderGeometry(w / 2, w / 2, d, 16, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).scale(1, 0.55, 1).translate(0, wall, 0), pick(r, t.roofs))
      k.box(w * 0.7, wall + w * 0.2, 0.2, 0, 0, d / 2, '#e8ebef')
      for (let i = 1; i < 4; i++) k.box(0.12, wall + w * 0.2, 0.24, -w * 0.35 + (w * 0.7 * i) / 4, 0, d / 2, '#8a939e')
    },
  },
  controlTower: {
    size: () => ({ w: 8, d: 8 }),
    build(k) {
      k.cyl(1.6, 2, 16, 0, 0, 0, '#e8ebef', 10)
      k.cyl(3.2, 2.6, 0.6, 0, 16, 0, '#c3c9d1', 10)
      k.cyl(3, 3, 3, 0, 16.6, 0, '#5fb8f2', 10)
      k.cyl(3.4, 3.4, 0.5, 0, 19.6, 0, '#3a3f47', 10)
      k.cyl(0.1, 0.1, 3, 0, 20.1, 0, '#c3c9d1', 6)
      k.ball(0.35, 0, 23.2, 0, '#ff3b3b', true)
    },
  },
  // Parked airliner, nose toward the road.
  airliner: {
    size: () => ({ w: 22, d: 20 }),
    build(k, r, s, t) {
      const livery = pick(r, t.liveries)
      k.geo(new CylinderGeometry(1.5, 1.5, 15, 12).rotateX(Math.PI / 2).translate(0, 2.8, 0), '#f4f6f8')
      k.geo(new SphereGeometry(1.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(0, 2.8, 7.5), '#f4f6f8')
      k.geo(new ConeGeometry(1.5, 3.5, 12).rotateX(-Math.PI / 2).translate(0, 2.8, -9.2), '#f4f6f8')
      k.box(15.2, 0.35, 0.3, 0, 2.6, 0, livery) // a stripe down the side
      k.box(20, 0.35, 4, 0, 2.2, 0, '#e3e7ec')
      k.box(7, 0.25, 2.2, 0, 3.2, -8.6, '#e3e7ec')
      k.box(0.35, 4.2, 3, 0, 3.4, -8.8, livery)
      for (const sx of [-1, 1]) k.cyl(0.7, 0.7, 2.6, sx * 4.5, 1.4, 0.4, '#8a939e', 10)
      for (const z of [5.5, -1]) k.cyl(0.12, 0.12, 1.3, 0, 0, z, '#3a3f47', 6)
      k.box(2.6, 0.3, 0.3, 0, 3.4, 7.7, '#22252b') // cockpit windows
    },
  },
  windsock: {
    size: () => ({ w: 3, d: 2 }),
    build(k) {
      k.cyl(0.08, 0.1, 5, 0, 0, 0, '#e8ebef', 6)
      for (let i = 0; i < 4; i++) k.geo(new CylinderGeometry(0.42 - i * 0.07, 0.49 - i * 0.07, 0.5, 8, 1, true).rotateZ(Math.PI / 2).translate(0.35 + i * 0.5, 4.8, 0), i % 2 ? '#ffffff' : '#ff6a1a')
    },
  },
}

// --- Themes, by STREET_ZONES id --------------------------------------------------------
// pick(roll) -> a KINDS name for the next front lot, gap [lo, hi] m between neighbours;
// back: a row along the rear of the lots (pick, every [lo, hi] m) that fills the skyline in
// front of the walls; lamp colours. The rest are colour lists the kinds choose from.
export const ZONE_THEMES = {
  neighbourhood: {
    pick: (roll) => (roll < 0.62 ? 'house' : roll < 0.8 ? 'oak' : roll < 0.92 ? 'pine' : 'hedge'),
    gap: [2, 5],
    back: { pick: (roll) => (roll < 0.6 ? 'pine' : 'oak'), every: [3, 8] },
    walls: ['#86c9ec', '#f4efe6', '#f6c9d2', '#fff1c9', '#e9f3f6', '#c9e8b5'],
    roofs: ['#2d6fb8', '#d0473b', '#8a4fd1', '#2fa3a0', '#3fa65a', '#9a6b3c'],
    glass: '#5fb8f2',
    lamp: { pole: '#3a3f47', head: '#3a3f47', light: '#ffe58a' },
  },
  main: {
    pick: (roll) => (roll < 0.72 ? 'shop' : roll < 0.84 ? 'kiosk' : roll < 0.94 ? 'oak' : 'bench'),
    gap: [0.5, 2],
    back: { pick: (roll) => (roll < 0.7 ? 'shop' : 'oak'), every: [0, 2] },
    walls: ['#d07a55', '#e8d2b0', '#c95b4a', '#f0e6d6', '#9fc3d6', '#e7b8a0'],
    awnings: ['#e0573a', '#2f9e44', '#2c8cec', '#f2b33d', '#8a4fd1'],
    parapet: '#6e4a3a',
    glass: '#8fd3ff',
    lamp: { pole: '#2f6b3a', head: '#2f6b3a', light: '#fff2b0' },
  },
  park: {
    pick: (roll) => (roll < 0.34 ? 'oak' : roll < 0.58 ? 'pine' : roll < 0.68 ? 'fountain' : roll < 0.8 ? 'bench' : roll < 0.9 ? 'flowerbed' : 'pond'),
    gap: [1, 4],
    back: { pick: (roll) => (roll < 0.5 ? 'oak' : 'pine'), every: [1, 4] },
    leaves: ['#3cb83a', '#58d046'],
    lamp: { pole: '#f4f4f4', head: '#d9dde3', light: '#ffffff' },
  },
  downtown: {
    pick: (roll) => (roll < 0.78 ? 'tower' : roll < 0.9 ? 'billboard' : 'oak'),
    gap: [1, 3],
    back: { pick: () => 'tower', every: [0, 2] },
    walls: ['#6b7b90', '#8a939e', '#4a5568', '#b8c0ca', '#5b6b80', '#c9b8a8'],
    glass: '#9fd8ff',
    billboards: ['#ff5c7a', '#ffd23a', '#33e0ff', '#7bdc6b'],
    lamp: { pole: '#5b6270', head: '#5b6270', light: '#ffffff' },
  },
  seaside: {
    pick: (roll) => (roll < 0.34 ? 'palm' : roll < 0.64 ? 'hut' : roll < 0.95 ? 'umbrella' : 'lighthouse'),
    gap: [1, 4],
    back: { pick: () => 'palm', every: [3, 8] },
    huts: ['#ff6f61', '#4fc3f0', '#ffd23a', '#7bdc6b', '#ff9ad5'],
    lamp: { pole: '#8a5a33', head: '#5a3a22', light: '#ffe58a' },
  },
  snowy: {
    pick: (roll) => (roll < 0.55 ? 'house' : roll < 0.85 ? 'pine' : 'snowman'),
    gap: [2, 5],
    back: { pick: () => 'pine', every: [2, 6] },
    walls: ['#c9563c', '#e8c27a', '#7fa7c9', '#f4efe6', '#8fbf8f'],
    roofs: ['#ffffff', '#f4fbff'],
    chimney: '#6e4a3a',
    hedge: '#eef6fb',
    leaves: ['#2f7d4a', '#f4fbff'],
    glass: '#ffe58a',
    lamp: { pole: '#22252b', head: '#22252b', light: '#ffd27a' },
  },
  spooky: {
    pick: (roll) => (roll < 0.45 ? 'haunted' : roll < 0.68 ? 'deadtree' : roll < 0.84 ? 'pumpkin' : 'graves'),
    gap: [2, 5],
    back: { pick: () => 'deadtree', every: [3, 7] },
    walls: ['#4a3d5c', '#3b3348', '#5a4a3a', '#2f3a3a'],
    roofs: ['#2a2238', '#3d2f50', '#1f1a2b'],
    glass: '#ffb23d',
    lamp: { pole: '#2a2238', head: '#2a2238', light: '#b06cff' },
  },
  candy: {
    pick: (roll) => (roll < 0.45 ? 'gingerbread' : roll < 0.65 ? 'lollipop' : roll < 0.82 ? 'candycane' : 'gumdrop'),
    gap: [1, 4],
    back: { pick: (roll) => (roll < 0.6 ? 'lollipop' : 'gumdrop'), every: [2, 6] },
    walls: ['#a8642f', '#c07a3f'],
    roofs: ['#ff8fc0', '#9be8d0', '#fff0a8', '#c9a8ff'],
    sweets: ['#ff4f9a', '#4fc3f0', '#ffd23a', '#7bdc6b', '#b06cff', '#ff8a1f'],
    glass: '#ffd1e6',
    lamp: { pole: '#ffffff', head: '#ff4f9a', light: '#fff0a8' },
  },
  neon: {
    pick: (roll) => (roll < 0.72 ? 'tower' : 'neonSign'),
    gap: [1, 3],
    back: { pick: () => 'tower', every: [0, 2] },
    walls: ['#1a1d33', '#22264a', '#151729'],
    neon: ['#33e0ff', '#ff4fd8', '#b06cff', '#4bff8a'],
    roofPlant: '#22264a',
    lamp: { pole: '#1a1d33', head: '#1a1d33', light: '#33e0ff' },
  },
  skyport: {
    pick: (roll) => (roll < 0.4 ? 'hangar' : roll < 0.62 ? 'airliner' : roll < 0.78 ? 'controlTower' : 'windsock'),
    gap: [2, 5],
    back: { pick: () => 'hangar', every: [1, 4] },
    roofs: ['#8a939e', '#6b7b90', '#b8c0ca'],
    liveries: ['#2c8cec', '#e8323a', '#ff8a1f', '#2f9e44'],
    lamp: { pole: '#5b6270', head: '#5b6270', light: '#ffffff' },
  },
}
