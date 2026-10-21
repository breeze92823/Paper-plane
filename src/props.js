// Mesh builders for the lobby's props. Each returns a Group with its origin on
// the ground at the prop's centre; map.js places them and adds their colliders.
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { EGG_SHOP, MATERIAL_PBR, PALETTE as P, RARITIES } from './config.js'
import {
  bullseyeTexture,
  clockTexture,
  courtTexture,
  demonEggTexture,
  facadeTexture,
  paintSign,
  SIGN_FONT,
  eggTexture,
  oddsBoardTexture,
  stripeTexture,
  studTile,
  swirlTexture,
  toTexture,
  waterfallTexture,
} from './textures.js'

// --- Geometry + material helpers ----------------------------------------------
const STUD_TILE_M = 2 // metres covered by one stud texture tile (4 studs a side)

// Box whose UVs run in metres / tile, so a repeating texture keeps one scale on any size.
export function tiledBox(w, h, d, tile = STUD_TILE_M) {
  const g = new BoxGeometry(w, h, d)
  const uv = g.attributes.uv
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]] // px nx py ny pz nz
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i
      uv.setXY(k, (uv.getX(k) * faces[f][0]) / tile, (uv.getY(k) * faces[f][1]) / tile)
    }
  }
  return g
}

// Flat XZ plane facing up, UVs in metres / tile.
export function tiledPlane(w, d, tile = STUD_TILE_M) {
  const g = new PlaneGeometry(w, d)
  const uv = g.attributes.uv
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) * w) / tile, (uv.getY(k) * d) / tile)
  g.rotateX(-Math.PI / 2)
  return g
}

// Flat polygon from (x, z) corners lying on the ground, UVs in metres / tile.
export function groundShape(points, tile = STUD_TILE_M) {
  // ShapeGeometry lies in XY with UVs equal to the shape coordinates; (x, -z)
  // there lands on (x, z) after the -90 degree X turn.
  const g = new ShapeGeometry(new Shape(points.map(([x, z]) => new Vector2(x, -z))))
  const uv = g.attributes.uv
  for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / tile, uv.getY(k) / tile)
  g.rotateX(-Math.PI / 2)
  return g
}

const solids = new Map()
export function solid(color, extra) {
  const key = color + (extra ? JSON.stringify(extra) : '')
  if (!solids.has(key)) solids.set(key, new MeshStandardMaterial({ color, ...MATERIAL_PBR.PROP, ...extra }))
  return solids.get(key)
}

const studded = new Map()
export function studMat(col, colB = col) {
  const key = col + colB
  if (!studded.has(key)) studded.set(key, new MeshStandardMaterial({ map: studTile(col, colB), ...MATERIAL_PBR.PROP }))
  return studded.get(key)
}

// Mesh with shadows on, positioned in its parent.
export function part(geo, material, x = 0, y = 0, z = 0) {
  const m = new Mesh(geo, material)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

// Gives every vertex one colour, for merging differently tinted parts into one mesh.
export function tint(geo, hex) {
  const c = new Color(hex)
  const n = geo.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3)
  geo.setAttribute('color', new Float32BufferAttribute(arr, 3))
  return geo
}

// --- Signs --------------------------------------------------------------------
// Text `height` metres tall (or `width` metres wide): camera-facing (billboard), an upright
// panel facing +Z, or painted flat on the floor reading from +Z (flat). Repainted once the web font arrives
// (a fresh texture: a resized canvas cannot reuse the old GPU allocation).
const signs = []
export function makeSign(lines, height, { billboard = true, flat = false, width } = {}) {
  const c = document.createElement('canvas')
  const sprite = billboard && !flat
  const material = sprite
    ? new SpriteMaterial({ transparent: true, depthWrite: false })
    : new MeshBasicMaterial({ transparent: true, depthWrite: false, side: DoubleSide, polygonOffset: flat, polygonOffsetFactor: -4 })
  const geo = flat ? new PlaneGeometry(1, 1).rotateX(-Math.PI / 2) : new PlaneGeometry(1, 1)
  const obj = sprite ? new Sprite(material) : new Mesh(geo, material)
  obj.renderOrder = 2
  const paint = () => {
    const aspect = paintSign(c, lines)
    material.map?.dispose()
    material.map = toTexture(c, { repeat: false })
    material.needsUpdate = true
    const h = width ? width / aspect : height
    if (flat) obj.scale.set(h * aspect, 1, h)
    else obj.scale.set(h * aspect, h, 1)
  }
  paint()
  signs.push(paint)
  return obj
}
document.fonts?.load(`700 64px ${SIGN_FONT}`).then(() => signs.forEach((paint) => paint()), () => {})

// --- Floor decals -------------------------------------------------------------
// One chevron pointing -Z, `w` wide.
export function chevron(w, color) {
  const t = w * 0.16 // arm thickness
  const h = w * 0.32
  const pts = [[-w / 2, 0], [0, -h], [w / 2, 0], [w / 2 - t, t * 0.9], [0, -h + t * 1.6], [-w / 2 + t, t * 0.9]]
  const m = new Mesh(groundShape(pts), new MeshBasicMaterial({ color, polygonOffset: true, polygonOffsetFactor: -2 }))
  m.receiveShadow = true
  return m
}

// A floor arrow pointing -Z with a darker rim.
export function floorArrow(len, color, edge) {
  const g = new Group()
  const shape = (s) => {
    const hw = len * 0.22 * s // shaft half-width
    const head = len * 0.45 * s
    const hl = len * 0.42
    return [[-hw, len / 2], [-hw, -len / 2 + hl], [-head, -len / 2 + hl], [0, -len / 2 - 0.05 * s], [head, -len / 2 + hl], [hw, -len / 2 + hl], [hw, len / 2]]
  }
  const rim = new Mesh(groundShape(shape(1.25)), new MeshBasicMaterial({ color: edge, polygonOffset: true, polygonOffsetFactor: -2 }))
  const body = new Mesh(groundShape(shape(1)), new MeshBasicMaterial({ color, polygonOffset: true, polygonOffsetFactor: -4 }))
  body.position.y = 0.005
  g.add(rim, body)
  return g
}

// --- Nature -------------------------------------------------------------------
// Blocky pine: trunk plus four shrinking leaf tiers. Returns geometries already
// placed at (x, y, z), tinted for vertex colours, for terrain.js to merge.
export function treeParts(x, y, z, s) {
  const trunk = tint(new BoxGeometry(0.9 * s, 2.4 * s, 0.9 * s).translate(x, y + 1.2 * s, z), P.trunk)
  const tiers = [[4.6, 1.5], [3.6, 1.4], [2.5, 1.3], [1.3, 1.1]]
  const leaves = []
  let ty = y + 2 * s
  tiers.forEach(([w, h], i) => {
    leaves.push(tint(new BoxGeometry(w * s, h * s, w * s).translate(x, ty + (h * s) / 2, z), i % 2 ? P.leafLight : P.leaf))
    ty += h * s * 0.82
  })
  return { trunk, leaves }
}

// Blocky oak: tall trunk under a wide two-layer canopy with a side lobe. Same contract as treeParts.
export function oakParts(x, y, z, s) {
  const trunk = tint(new BoxGeometry(1 * s, 4.2 * s, 1 * s).translate(x, y + 2.1 * s, z), P.trunk)
  const leaves = [
    tint(new BoxGeometry(5.2 * s, 1.6 * s, 4.6 * s).translate(x, y + 4.6 * s, z), P.leaf),
    tint(new BoxGeometry(3.8 * s, 1.3 * s, 3.4 * s).translate(x + 0.4 * s, y + 6 * s, z - 0.3 * s), P.leafLight),
    tint(new BoxGeometry(2.2 * s, 1.2 * s, 2.2 * s).translate(x - 2.6 * s, y + 4.2 * s, z + 1 * s), P.leafLight),
  ]
  return { trunk, leaves }
}

// --- Throwing field + Neighbourhood ---------------------------------------------
export function building({ w, d, h, wall, glass = '#8fd3ff', frame = '#ffffff', floors, cols, brick = false, roof, roofColor, sideCols }) {
  const g = new Group()
  const front = facadeTexture({ w, h, wall, glass, frame, floors, cols, brick, door: true })
  const side = facadeTexture({ w: d, h, wall, glass, frame, floors, cols: sideCols ?? Math.max(1, Math.round((cols * d) / w)), brick })
  const top = solid(roofColor ?? wall)
  const fm = new MeshStandardMaterial({ map: front, ...MATERIAL_PBR.PROP })
  const sm = new MeshStandardMaterial({ map: side, ...MATERIAL_PBR.PROP })
  g.add(part(new BoxGeometry(w, h, d), [sm, sm, top, top, fm, fm], 0, h / 2, 0))
  if (roof === 'gable') {
    const rh = Math.min(w, d) * 0.45
    const shape = new Shape([new Vector2(-w / 2 - 0.5, 0), new Vector2(0, rh), new Vector2(w / 2 + 0.5, 0)])
    const geo = new ExtrudeGeometry(shape, { depth: d + 1, bevelEnabled: false })
    g.add(part(geo, top, 0, h, -d / 2 - 0.5))
  } else {
    // Flat roof with a darker parapet.
    g.add(part(new BoxGeometry(w + 0.4, 0.6, d + 0.4), solid(roofColor ?? '#7d3a2c'), 0, h + 0.3, 0))
  }
  return g
}

// Fence along local X, `len` metres: dark stone posts every ~3 m with two white rails.
export function stoneFence(len) {
  const posts = []
  const n = Math.max(1, Math.round(len / 3))
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + (i * len) / n
    posts.push(new BoxGeometry(0.7, 1.4, 0.7).translate(x, 0.7, 0))
    posts.push(new BoxGeometry(0.86, 0.16, 0.86).translate(x, 1.48, 0))
  }
  const rails = [0.55, 1.05].map((y) => new BoxGeometry(len, 0.14, 0.12).translate(0, y, 0))
  const g = new Group()
  g.add(part(mergeGeometries(posts), solid(P.stone)))
  g.add(part(mergeGeometries(rails), solid('#ffffff')))
  return g
}

// Red-brick school, front (+Z) facing the plaza: white cornices between floors, and on its
// east end (+X, toward the field) a porch with blue doors, a SCHOOL plate and a clock tower.
export function school({ w, d, h }) {
  const g = building({ w, d, h, wall: '#c9553f', floors: 3, cols: 6, brick: true, roofColor: '#7d3a2c' })
  const white = solid('#f4f1ea')
  for (let f = 1; f <= 2; f++) g.add(part(new BoxGeometry(w + 0.3, 0.3, d + 0.3), white, 0, (h * f) / 3, 0))
  const ex = w / 2
  g.add(part(new BoxGeometry(1.4, 7.2, 6), solid('#b84a36'), ex + 0.7, 3.6, 0)) // porch
  g.add(part(new BoxGeometry(1.6, 0.4, 6.4), white, ex + 0.7, 7.4, 0))
  g.add(part(new BoxGeometry(0.1, 3, 2.8), solid('#2c6fd6'), ex + 1.45, 1.5, 0)) // doors
  g.add(part(new BoxGeometry(0.2, 1.2, 4.4), solid('#2c6fd6'), ex + 1.5, 5.3, 0)) // sign plate
  const label = makeSign([{ text: 'SCHOOL', color: '#ffffff', size: 64, stroke: '#1f4fa8' }], 0.85, { billboard: false })
  label.position.set(ex + 1.62, 5.3, 0)
  label.rotation.y = Math.PI / 2
  g.add(label)
  // Clock tower on the roof at the east end.
  const tx = ex - 2.6
  g.add(part(new BoxGeometry(4.4, 6, 4.4), solid('#d8b083'), tx, h + 3, 0))
  g.add(part(new ConeGeometry(3.4, 2.6, 4).rotateY(Math.PI / 4), solid('#7d3a2c'), tx, h + 7.3, 0))
  const clock = new MeshBasicMaterial({ map: clockTexture() })
  const east = new Mesh(new CircleGeometry(1.5, 32), clock)
  east.position.set(tx + 2.22, h + 3.6, 0)
  east.rotation.y = Math.PI / 2
  const south = new Mesh(new CircleGeometry(1.5, 32), clock)
  south.position.set(tx, h + 3.6, 2.22)
  g.add(east, south)
  return g
}

// Giant pencil standing on its point.
export function pencil() {
  const g = new Group()
  g.add(part(new ConeGeometry(0.55, 1.3, 6).rotateX(Math.PI), solid('#e8c08a'), 0, 0.35, 0)) // sharpened wood, half buried
  g.add(part(new CylinderGeometry(0.55, 0.55, 4.6, 6), solid('#ffd21f'), 0, 3.3, 0))
  g.add(part(new CylinderGeometry(0.57, 0.57, 0.45, 12), solid('#c9ced6', { metalness: 0.5, roughness: 0.4 }), 0, 5.82, 0))
  g.add(part(new CylinderGeometry(0.55, 0.55, 0.7, 12), solid('#ff7aa8'), 0, 6.4, 0))
  return g
}

// Orange picnic bench along local X.
export function bench() {
  const g = new Group()
  const wood = solid('#f08a24')
  const dark = solid('#9a5214')
  g.add(part(new BoxGeometry(2.4, 0.14, 1), wood, 0, 0.78, 0))
  for (const sz of [-1, 1]) {
    g.add(part(new BoxGeometry(2.4, 0.12, 0.38), wood, 0, 0.46, sz * 0.82))
    for (const sx of [-1, 1]) g.add(part(new BoxGeometry(0.12, 0.78, 0.12), dark, sx * 0.95, 0.39, sz * 0.6))
  }
  return g
}

// Basketball court `w` (long axis, local X) by `d`, with a hoop at each end facing in.
export function basketballCourt(w, d) {
  const g = new Group()
  g.add(part(tiledBox(w + 1, 0.1, d + 1), studMat('#e8ebef'), 0, 0.05, 0))
  const floor = new Mesh(new PlaneGeometry(w, d).rotateX(-Math.PI / 2), new MeshStandardMaterial({ map: courtTexture(), ...MATERIAL_PBR.PROP }))
  floor.position.y = 0.11
  floor.receiveShadow = true
  g.add(floor)
  const grey = solid('#9aa3ad')
  const glass = new MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, roughness: 0.3 })
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 + 0.2)
    g.add(part(new CylinderGeometry(0.12, 0.14, 3.6, 10), grey, x, 1.8, 0))
    g.add(part(new BoxGeometry(0.9, 0.12, 0.12), grey, x - sx * 0.45, 3.3, 0))
    g.add(part(new BoxGeometry(0.1, 1.2, 1.9), glass, x - sx * 0.9, 3.5, 0)) // backboard
    g.add(part(new TorusGeometry(0.4, 0.05, 8, 20).rotateX(Math.PI / 2), solid('#ff6a1f'), x - sx * 1.4, 3.1, 0))
  }
  return g
}

export function lampPost() {
  const g = new Group()
  const dark = solid(P.lamp)
  g.add(part(new CylinderGeometry(0.25, 0.32, 0.4, 8), dark, 0, 0.2, 0))
  g.add(part(new CylinderGeometry(0.11, 0.13, 4.4, 8), dark, 0, 2.4, 0))
  g.add(part(new BoxGeometry(0.6, 0.12, 0.6), dark, 0, 4.6, 0))
  g.add(part(new BoxGeometry(0.42, 0.55, 0.42), solid(P.lampLight, { emissive: P.lampLight, emissiveIntensity: 0.8 }), 0, 4.95, 0))
  g.add(part(new ConeGeometry(0.42, 0.35, 4).rotateY(Math.PI / 4), dark, 0, 5.4, 0))
  return g
}

// Striped pillars, a lintel and a see-through blue panel, `span` metres between pillar centres.
// `trim` colours the stripes and lintel; `panel: false` leaves the opening clear.
export function gate(span, height, label, { trim = P.trimBlue, panel: withPanel = true } = {}) {
  const g = new Group()
  const stripes = stripeTexture('#ffffff', trim)
  stripes.repeat.set(1, height / 1.6)
  const pillarMat = new MeshStandardMaterial({ map: stripes, ...MATERIAL_PBR.PROP })
  for (const sx of [-1, 1]) {
    g.add(part(new BoxGeometry(2.2, height, 2.2), pillarMat, (sx * span) / 2, height / 2, 0))
    g.add(part(new BoxGeometry(2.6, 0.5, 2.6), solid(trim), (sx * span) / 2, height + 0.25, 0))
  }
  g.add(part(new BoxGeometry(span + 2.6, 1.2, 1.6), solid(trim), 0, height - 0.6, 0))
  if (withPanel) {
    const panel = new Mesh(
      new PlaneGeometry(span - 2.2, height - 1.2),
      new MeshBasicMaterial({ color: '#56b6ff', transparent: true, opacity: 0.45, side: DoubleSide, depthWrite: false }),
    )
    panel.position.y = (height - 1.2) / 2
    g.add(panel)
  }
  const sign = makeSign([{ text: label, color: '#ffffff', size: 64 }], 1.1, { billboard: false })
  sign.position.set(0, height - 0.6, 0.85)
  g.add(sign)
  return g
}

// --- Plane hall -----------------------------------------------------------------
// Folded paper dart, nose toward -Z, ~2.6 m long.
export function paperPlane(color) {
  const N = [0, 0, -1.3]
  const T = [0, 0.05, 1.1]
  const K = [0, -0.4, 1.1]
  const L = [-1, 0.12, 1.1]
  const R = [1, 0.12, 1.1]
  const tris = [N, T, L, N, R, T, N, K, T, N, T, K]
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(tris.flat(), 3))
  geo.computeVertexNormals()
  const m = part(geo, new MeshStandardMaterial({ color, side: DoubleSide, roughness: 0.6, metalness: 0 }))
  return m
}

// Purchase pad: dark base ring, red top (yellow once equipped).
export function plotPad(top = P.padRed) {
  const g = new Group()
  g.add(part(new CylinderGeometry(2.3, 2.4, 0.18, 32), solid(P.padBase), 0, 0.09, 0))
  g.add(part(new CylinderGeometry(2, 2, 0.3, 32), solid(top), 0, 0.2, 0))
  return g
}

// Display frame behind a back-row pad: rounded-looking square border on a pale pane, facing +Z.
export function planeFrame() {
  const g = new Group()
  const S = 2.8
  const t = 0.28
  const rim = solid('#4f78b0')
  g.add(part(new BoxGeometry(S, t, 0.25), rim, 0, S - t / 2, 0))
  g.add(part(new BoxGeometry(S, t, 0.25), rim, 0, t / 2, 0))
  for (const sx of [-1, 1]) g.add(part(new BoxGeometry(t, S, 0.25), rim, sx * (S / 2 - t / 2), S / 2, 0))
  const pane = new Mesh(new PlaneGeometry(S - t * 2, S - t * 2), new MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.55 }))
  pane.position.set(0, S / 2, -0.05)
  g.add(pane)
  return g
}

// Low elliptical half-tube: mouth at local z = 0, running `length` along -Z to a closed
// back wall, `halfWidth` either side and `height` tall, blue rims on both ends. The
// shell casts no shadow and glows softly, so the inside reads bright like the outside.
export function hall(halfWidth, height, length) {
  const g = new Group()
  const glow = { emissive: P.hallShell, emissiveIntensity: 0.45 }
  const shellMat = new MeshStandardMaterial({ map: studTile(P.hallShell, P.hallShell), side: DoubleSide, ...glow, ...MATERIAL_PBR.PROP })
  const arc = Math.PI * Math.sqrt((halfWidth * halfWidth + height * height) / 2) // half-ellipse perimeter, approx.
  const shell = new CylinderGeometry(1, 1, length, 48, 1, true, Math.PI / 2, Math.PI)
  const uv = shell.attributes.uv
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) * arc) / 4, (uv.getY(k) * length) / 4)
  shell.rotateX(Math.PI / 2) // axis to Z, arch over the ground
  shell.scale(halfWidth, height, 1)
  const shellMesh = part(shell, shellMat, 0, 0, -length / 2)
  shellMesh.castShadow = false
  g.add(shellMesh)

  const pts = []
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI
    pts.push(new Vector2(Math.cos(a) * halfWidth, Math.sin(a) * height))
  }
  const back = part(new ShapeGeometry(new Shape(pts)), new MeshStandardMaterial({ color: P.hallShell, side: DoubleSide, ...glow, ...MATERIAL_PBR.PROP }), 0, 0, -length)
  back.castShadow = false
  g.add(back)

  for (const [z, tube] of [[0, 0.75], [-length, 0.5]]) {
    const rim = new TorusGeometry(halfWidth, tube, 12, 64, Math.PI)
    rim.scale(1, height / halfWidth, 1)
    g.add(part(rim, solid(P.trimBlue), 0, 0, z))
  }
  return g
}

// --- Centre attractions -------------------------------------------------------
// World 2 teleporter: shallow pool, ring of ice crystals, spinning swirl.
export function world2Portal() {
  const g = new Group()
  g.add(part(new CylinderGeometry(3.6, 3.8, 0.3, 40), solid(P.whiteShade), 0, 0.15, 0))
  g.add(part(new CylinderGeometry(3.2, 3.2, 0.32, 40), solid(P.water, { roughness: 0.2 }), 0, 0.17, 0))
  const ice = new MeshStandardMaterial({ color: P.ice, emissive: '#5fb8ff', emissiveIntensity: 0.25, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 })
  const R = 2.5
  const cy = 3.1
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    const crystal = part(new OctahedronGeometry(0.55, 0), ice, Math.cos(a) * R, cy + Math.sin(a) * R, 0)
    crystal.scale.set(0.7, 1.7 + (i % 3) * 0.35, 0.7)
    crystal.rotation.z = a - Math.PI / 2
    g.add(crystal)
  }
  for (const [x, s] of [[-2.2, 1.6], [2.3, 1.3], [-1.2, 1]]) {
    const c = part(new OctahedronGeometry(0.6, 0), ice, x, 0.9 * s, 0.6)
    c.scale.set(0.8, 1.8 * s, 0.8)
    g.add(c)
  }
  const swirl = new Mesh(
    new CircleGeometry(R - 0.25, 48),
    new MeshBasicMaterial({ map: swirlTexture('#1d4fd8', '#9fe6ff'), transparent: true, side: DoubleSide }),
  )
  swirl.position.y = cy
  g.add(swirl)
  const glow = new Mesh(
    new CircleGeometry(R + 0.6, 40),
    new MeshBasicMaterial({ color: '#7fd0ff', transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
  )
  glow.position.set(0, cy, -0.05)
  g.add(glow)
  return { group: g, swirl }
}

// Demon egg on a dark pedestal, flames licking the top.
export function demonEgg() {
  const g = new Group()
  g.add(part(tiledBox(6.5, 0.2, 6.5), studMat(P.eggPad), 0, 0.1, 0))
  g.add(part(new CylinderGeometry(2.3, 2.5, 0.5, 32), solid(P.pedestal), 0, 0.45, 0))
  g.add(part(new CylinderGeometry(2.1, 2.1, 0.18, 32), solid(P.pedestalRim, { emissive: '#5a0000' }), 0, 0.79, 0))
  g.add(part(new CylinderGeometry(1.7, 1.9, 0.3, 32), solid(P.pedestal), 0, 1.0, 0))
  const egg = part(
    new SphereGeometry(1, 40, 28),
    new MeshStandardMaterial({ map: demonEggTexture(), emissiveMap: demonEggTexture(true), emissive: '#ffffff', emissiveIntensity: 1.1, roughness: 0.45, metalness: 0.1 }),
    0,
    2.75,
    0,
  )
  egg.scale.set(1.25, 1.65, 1.25)
  g.add(egg)
  const flames = []
  const flameMats = ['#ff3a12', '#ff8a1c', '#ffd23a'].map((c) => new MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9 }))
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    const r = i === 0 ? 0 : 0.5
    const f = new Mesh(new ConeGeometry(0.32, 1.2, 6), flameMats[i % 3])
    f.position.set(Math.cos(a) * r, 4.6 + (i === 0 ? 0.3 : 0), Math.sin(a) * r)
    flames.push(f)
    g.add(f)
  }
  return { group: g, egg, flames }
}

// --- Rebirth training pads ----------------------------------------------------
// Bullseye on a stand, facing +Z.
export function target(rings) {
  const g = new Group()
  g.add(part(tiledBox(3.4, 0.6, 2.2), studMat('#d6dce2'), 0, 0.3, 0))
  g.add(part(new BoxGeometry(0.5, 1.6, 0.5), solid('#9aa3ad'), 0, 1.4, -0.2))
  const face = new CylinderGeometry(1.9, 1.9, 0.45, 40).rotateX(Math.PI / 2)
  const faceMat = new MeshStandardMaterial({ map: bullseyeTexture(rings), ...MATERIAL_PBR.PROP })
  // Cap faces carry the bullseye; the rim stays the outer ring colour.
  g.add(part(face, [solid(rings[0]), faceMat, faceMat], 0, 3.9, 0))
  return g
}

export function star(color) {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.9 : 2
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    pts.push(new Vector2(Math.cos(a) * r, Math.sin(a) * r))
  }
  const geo = new ExtrudeGeometry(new Shape(pts), { depth: 0.6, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 2 })
  geo.center()
  return part(geo, solid(color, { emissive: '#7a5200', emissiveIntensity: 0.3, roughness: 0.4, metalness: 0.3 }))
}

export function gem(color) {
  const m = part(new OctahedronGeometry(1.6, 0), solid(color, { emissive: '#3a0f80', emissiveIntensity: 0.4, roughness: 0.25, metalness: 0.2 }))
  m.scale.set(1, 1.35, 1)
  return m
}

// Training-pad prizes for the gamepass / high rebirth tiers: upright, facing +Z.
// Red diamond set in a dark spiked frame.
export function rubyFrame() {
  const g = spikedFrame()
  const ruby = part(new OctahedronGeometry(1.3, 0), solid('#e8122a', { emissive: '#7a0010', emissiveIntensity: 0.5, roughness: 0.25 }), 0, 0, 0.5)
  ruby.scale.set(1, 1.2, 0.5)
  g.add(ruby)
  return g
}

// Orange hexagon set in a dark spiked frame.
export function hexFrame() {
  const g = spikedFrame()
  g.add(part(new CylinderGeometry(1.4, 1.4, 0.4, 6).rotateX(Math.PI / 2), solid('#ff8a1c', { emissive: '#7a3000', emissiveIntensity: 0.4 }), 0, 0, 0.35))
  g.add(part(new CylinderGeometry(0.8, 0.8, 0.42, 6).rotateX(Math.PI / 2), solid('#c94f00'), 0, 0, 0.4))
  return g
}

// Dark octagon with spikes round the rim, facing +Z.
function spikedFrame() {
  const g = new Group()
  const dark = solid('#1f1a24')
  g.add(part(new CylinderGeometry(2, 2, 0.5, 8).rotateX(Math.PI / 2), dark))
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    const spike = part(new ConeGeometry(0.35, 0.9, 4), dark, Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0)
    spike.rotation.z = a - Math.PI / 2
    g.add(spike)
  }
  return g
}

// Thick ring made of rainbow segments.
export function rainbowRing() {
  const g = new Group()
  const cols = ['#ff3b3b', '#ff9a1f', '#ffe23d', '#4be36a', '#33a8ff', '#a64dff']
  cols.forEach((c, i) => {
    const seg = part(new TorusGeometry(1.6, 0.55, 12, 16, (Math.PI * 2) / cols.length), solid(c, { emissive: c, emissiveIntensity: 0.2 }))
    seg.rotation.z = (i / cols.length) * Math.PI * 2
    g.add(seg)
  })
  return g
}

// Dark ring around a spinning blue swirl. Returns { group, swirl }.
export function swirlRing() {
  const g = new Group()
  g.add(part(new TorusGeometry(1.7, 0.4, 12, 40), solid('#1b2133', { metalness: 0.3, roughness: 0.4 })))
  const swirl = new Mesh(new CircleGeometry(1.45, 40), new MeshBasicMaterial({ map: swirlTexture('#0b1f6b', '#46c8ff'), transparent: true, side: DoubleSide }))
  g.add(swirl)
  return { group: g, swirl }
}

// --- South end: free reward + eggs ----------------------------------------------
// Chunky red dragon on a round pedestal. Returns { group, dragon }.
export function freeReward() {
  const g = new Group()
  g.add(part(new CylinderGeometry(3, 3.2, 0.5, 36), solid(P.rewardBase), 0, 0.25, 0))
  g.add(part(new CylinderGeometry(2.5, 2.6, 0.5, 36), solid('#a3121f'), 0, 0.75, 0))
  g.add(part(new CylinderGeometry(2.3, 2.3, 0.06, 36), solid('#ffcf2e', { emissive: '#7a5200' }), 0, 1.02, 0))
  const d = new Group()
  d.position.y = 1.05
  const red = solid(P.dragon)
  const dark = solid('#7a0d16')
  const white = solid('#ffffff')
  const black = solid('#111118')
  d.add(part(new BoxGeometry(1.6, 1.3, 2.2), red, 0, 0.95, 0))
  d.add(part(new BoxGeometry(1.5, 1.2, 1.3), red, 0, 2.1, 0.75))
  d.add(part(new BoxGeometry(1.0, 0.5, 0.6), red, 0, 1.85, 1.6)) // snout
  for (const sx of [-1, 1]) {
    d.add(part(new CylinderGeometry(0.32, 0.32, 0.08, 20).rotateX(Math.PI / 2), white, sx * 0.38, 2.3, 1.42))
    d.add(part(new CylinderGeometry(0.17, 0.17, 0.1, 16).rotateX(Math.PI / 2), black, sx * 0.38, 2.3, 1.45))
    const horn = part(new ConeGeometry(0.16, 0.6, 6), dark, sx * 0.5, 2.95, 0.5)
    horn.rotation.x = -0.4
    d.add(horn)
    const wing = part(new BoxGeometry(1.6, 0.1, 1.2), dark, sx * 1.4, 1.6, -0.2)
    wing.rotation.z = sx * 0.5
    d.add(wing)
    d.add(part(new BoxGeometry(0.45, 0.6, 0.5), red, sx * 0.5, 0.3, 0.6)) // feet
  }
  d.add(part(new BoxGeometry(0.6, 0.5, 1.2), red, 0, 0.6, -1.5))
  d.add(part(new BoxGeometry(0.35, 0.35, 0.9), dark, 0, 0.5, -2.4))
  g.add(d)
  return { group: g, dragon: d }
}

// One hatchable egg: pedestal, spotted egg, pet-odds board behind it.
export function eggStand({ name, color, spot, horn = false, best = false }) {
  const g = new Group()
  g.add(part(new CylinderGeometry(1.35, 1.5, 0.9, 32), solid(P.white), 0, 0.45, 0))
  g.add(part(new CylinderGeometry(1.42, 1.42, 0.25, 32), solid(P.eggBand), 0, 0.5, 0))
  const shell = new MeshStandardMaterial({
    map: eggTexture(color, spot, color.length + spot.charCodeAt(2)),
    roughness: best ? 0.3 : 0.55,
    metalness: best ? 0.45 : 0,
  })
  const egg = part(new SphereGeometry(1, 32, 24), shell, 0, 2.2, 0)
  egg.scale.set(1.05, 1.35, 1.05)
  g.add(egg)
  if (horn) {
    const h = part(new ConeGeometry(0.22, 1.1, 10), solid('#ffd24a', { metalness: 0.3 }), 0, 3.9, 0.35)
    h.rotation.x = 0.35
    g.add(h)
    g.add(part(new BoxGeometry(0.3, 1.2, 0.3), solid('#ff9ad5'), 0, 3.1, -0.9))
  }
  // Board on two posts, behind the egg.
  const dark = solid('#2a3350')
  for (const sx of [-1, 1]) g.add(part(new BoxGeometry(0.2, 4.2, 0.2), dark, sx * 1.6, 2.1, -1.7))
  const pets = (EGG_SHOP[name.toLowerCase()]?.pets ?? []).map((p) => ({ ...p, rarityBg: RARITIES[p.rarity].bg }))
  const face = new MeshStandardMaterial({ map: oddsBoardTexture(best ? '#e8b51f' : '#2c8cec', pets), ...MATERIAL_PBR.PROP })
  const edge = solid(P.board)
  g.add(part(new BoxGeometry(3.4, 2.55, 0.18), [edge, edge, edge, edge, face, edge], 0, 3.1, -1.7))
  return g
}

// Cascade `w` wide facing -Z: one falling sheet per terrace face [z, y bottom, y top]
// (front to back, in the parent's z/y), a stream across each terrace top between faces,
// a lip on the top face and a splash pool at the foot. All share the scrolling texture.
export function waterfall(w, faces) {
  const g = new Group()
  const water = new MeshBasicMaterial({ map: waterfallTexture(), transparent: true, opacity: 0.92 })
  const sheet = (len, orient, y, z) => {
    const geo = new PlaneGeometry(w, len)
    const uv = geo.attributes.uv
    for (let k = 0; k < uv.count; k++) uv.setY(k, (uv.getY(k) * len) / 6) // one texture repeat per 6 m
    const m = new Mesh(orient(geo), water)
    m.position.set(0, y, z)
    g.add(m)
  }
  faces.forEach(([z, y0, y1], i) => {
    // Falling: faces -Z, texture v up so the scroll runs downhill.
    sheet(y1 - y0, (geo) => geo.rotateY(Math.PI), (y0 + y1) / 2, z - 0.15)
    const next = faces[i + 1]
    if (next) {
      // Across the terrace top toward the drop: faces up, v running back toward +Z.
      const len = next[0] - z
      sheet(len, (geo) => geo.rotateX(-Math.PI / 2).rotateY(Math.PI), y1 + 0.04, z + len / 2)
    }
  })
  const [topZ, , topY] = faces[faces.length - 1]
  g.add(part(new BoxGeometry(w + 0.6, 0.6, 0.8), solid('#eafcff'), 0, topY, topZ - 0.3)) // lip
  const [footZ, footY] = faces[0]
  g.add(part(new CylinderGeometry(w * 0.75, w * 0.8, 0.3, 28), solid('#e9fbff'), 0, footY + 0.15, footZ - 1.2))
  g.add(part(new CylinderGeometry(w * 0.65, w * 0.65, 0.32, 28), solid(P.water, { roughness: 0.15 }), 0, footY + 0.17, footZ - 1.2))
  return g
}
