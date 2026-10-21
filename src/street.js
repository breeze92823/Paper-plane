// The street north of the Neighbourhood gate, after Stone-Skipping's LakeBanks.jsx +
// Water.jsx: the corridor from the end of the hand-built field (MAP.field.endZ) to past the
// far end, split into STREET_ZONES. Each zone carries the field's cross-section on in its own
// colours (verge, road and lane dashes, sidewalks, stone fences, lots out to the corridor
// edge), walls it in with two terraces, and gets a gate over the road where it starts. Only
// planes come up here (the gate is closed to walkers), so nothing has colliders.
// Each zone's lots are filled from its theme (streetProps.js): a seeded scatter of buildings
// and props facing the road, and a lamp every LAMP_EVERY m along both sidewalks, merged per
// CHUNK m into one lit and one unlit mesh so far stretches cull as a whole.
// The last zone, the Sky Port, is a runway up to a giant World 2 portal.
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MAP, MATERIAL_PBR, STREET, STREET_ZONES } from './config.js'
import { gate, makeSign, part, solid, stoneFence, studMat, tiledBox, tiledPlane, world2Portal } from './props.js'
import { KINDS, Kit, lamp, ZONE_THEMES } from './streetProps.js'
import { mulberry32 } from './textures.js'

// Floor layers, matching map.js: lots just under the field's verge so neither fights the ground.
const Y_LOT = 0.01
const Y_VERGE = 0.02
const Y_ROAD = 0.035
const Y_DASH = 0.05
const DASH_EVERY = 6 // m, in step with the field's dashes (map.js)

const fd = MAP.field
const zAt = (d) => STREET.startZ - d // metres up the street -> world z
const FIELD_END_D = STREET.startZ - fd.endZ // where the hand-built field stops
const END_D = STREET.length + STREET.endPast

// Each zone's stretch, as distances up the street. The first picks up where the field ends.
const ZONE_SPANS = STREET_ZONES.map((zone, i) => ({
  zone,
  d0: i === 0 ? FIELD_END_D : zone.startD,
  d1: i === STREET_ZONES.length - 1 ? END_D : STREET_ZONES[i + 1].startD,
}))

const SIDEWALK_X = fd.halfWidth + fd.sidewalk / 2
const FENCE_X = fd.halfWidth + fd.sidewalk + 0.35
const LOT_X0 = fd.halfWidth + fd.sidewalk // lots run from the sidewalk's outer edge...
const LOT_W = STREET.corridorHalf - LOT_X0 // ...to the foot of the walls
const GATE_SPAN = fd.roadHalf * 2 + 4 // as the Neighbourhood gate (map.js)
const SETBACK = 3.5 // m from the sidewalk to a building's front
const BACK_DEPTH = 9 // m, deepest a back-row piece may be
const END_CLEAR = 5 // m kept clear at either end of a zone, around its gates
const LAMP_EVERY = 12 // m, in step with the field's lamps (map.js)
const FIRST_LAMP_D = STREET.startZ - (fd.startZ - 3) // d of the field's first lamp
const CHUNK = 100 // m of scatter merged into one mesh pair

const scatterMaterial = new MeshStandardMaterial({ vertexColors: true, ...MATERIAL_PBR.PROP })
const glowMaterial = new MeshBasicMaterial({ vertexColors: true })

// A zone id -> a stable seed, so every visit builds the same street.
function seedOf(id) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

// Fills both sides of a zone's lots from its theme, and lamps both sidewalks.
function scatter(g, zone, theme, d0, d1) {
  const kits = new Map()
  const kitAt = (d) => {
    const i = Math.floor(d / CHUNK)
    if (!kits.has(i)) kits.set(i, new Kit())
    return kits.get(i)
  }
  const r = mulberry32(seedOf(zone.id))
  for (const sx of [-1, 1]) {
    const yaw = sx < 0 ? Math.PI / 2 : -Math.PI / 2 // fronts (+Z) toward the road
    const front = [] // [d from, d to, how far back from the road it reaches]
    let d = d0 + END_CLEAR
    for (;;) {
      const kind = KINDS[theme.pick(r())]
      const size = kind.size(r, theme)
      if (d + size.w > d1 - END_CLEAR) break
      const dc = d + size.w / 2
      kind.build(kitAt(dc).at(sx * (LOT_X0 + SETBACK + size.d / 2), 0, zAt(dc), yaw), r, size, theme)
      front.push([d, d + size.w, LOT_X0 + SETBACK + size.d])
      d += size.w + theme.gap[0] + r() * (theme.gap[1] - theme.gap[0])
    }
    // The back row, against the walls: trees, or a skyline of towers. Kept shallow, and left
    // out wherever a deep front piece (a tower, an airliner) already reaches back that far.
    const back = theme.back
    for (let d = d0 + END_CLEAR; ; ) {
      const kind = KINDS[back.pick(r())]
      const size = kind.size(r, theme)
      size.d = Math.min(size.d, BACK_DEPTH)
      if (d + size.w > d1 - END_CLEAR) break
      const backFront = STREET.corridorHalf - 1 - size.d
      const blocked = front.some(([a, b, reach]) => a < d + size.w && b > d && reach > backFront - 0.5)
      if (!blocked) {
        const dc = d + size.w / 2
        kind.build(kitAt(dc).at(sx * (STREET.corridorHalf - 1 - size.d / 2), 0, zAt(dc), yaw), r, size, theme)
      }
      d += size.w + back.every[0] + r() * (back.every[1] - back.every[0])
    }
  }
  if (zone.runway) runway(kitAt, d0, d1)
  // From just before d0, so the first one carries on straight after the field's last.
  for (let d = FIRST_LAMP_D + Math.ceil((d0 - 3 - FIRST_LAMP_D) / LAMP_EVERY) * LAMP_EVERY; d < d1; d += LAMP_EVERY) {
    for (const sx of [-1, 1]) lamp(kitAt(d).at(sx * SIDEWALK_X, 0.15, zAt(d), sx < 0 ? Math.PI / 2 : -Math.PI / 2), theme.lamp)
  }
  for (const kit of kits.values()) {
    if (kit.solid.length) g.add(part(mergeGeometries(kit.solid), scatterMaterial))
    if (kit.glow.length) {
      const glow = new Mesh(mergeGeometries(kit.glow), glowMaterial)
      g.add(glow)
    }
  }
}

// The Sky Port's runway markings over its road: white threshold stripes where it starts, and
// glowing edge lights down both sides (white, amber over the last stretch, as on a real one).
function runway(kitAt, d0, d1) {
  const k = kitAt(d0)
  k.at(0, 0, 0)
  for (let i = 0; i < 6; i++) {
    const x = -fd.roadHalf + 1 + i * ((fd.roadHalf * 2 - 2) / 5)
    k.box(0.9, 0.02, 14, x, Y_DASH - 0.01, zAt(d0 + END_CLEAR + 8), '#ffffff')
  }
  const lights = d1 - STREET.endPast
  for (let d = d0 + END_CLEAR; d < lights; d += STREET.runwayLights) {
    const amber = d > lights - 120
    for (const sx of [-1, 1]) {
      kitAt(d).at(0, 0, 0).box(0.35, 0.25, 0.35, sx * (fd.roadHalf + 0.3), Y_DASH, zAt(d), amber ? '#ffb23d' : '#ffffff', true)
    }
  }
}

// The giant portal standing at the far end (World 2's, or in the Ice World a closed World 3),
// facing back down the street, with its sign.
function endPortal(animate) {
  const p = STREET.portal
  const portal = world2Portal(p.swirl)
  portal.group.scale.setScalar(p.scale)
  portal.group.position.z = zAt(END_D) + p.back
  animate.push((t) => (portal.swirl.rotation.z = -t * 0.8))
  const sign = makeSign([{ text: p.title, color: '#ffffff', size: 64 }, { text: p.sub, color: p.subColor, size: 40 }], 7)
  sign.position.set(0, 7.1 * p.scale + 4, portal.group.position.z) // above the crystal ring
  return [portal.group, sign]
}

// Box with one colour on its top and another on its sides (BoxGeometry face order).
function terrace(w, h, d, top, side) {
  const sideMat = studMat(side)
  const mesh = new Mesh(tiledBox(w, h, d), [sideMat, sideMat, studMat(top), sideMat, sideMat, sideMat])
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function buildZone({ zone, d0, d1 }) {
  const g = new Group()
  g.name = `street:${zone.id}`
  const len = d1 - d0
  const z = zAt((d0 + d1) / 2)

  const flat = (mesh, y) => {
    mesh.position.set(mesh.position.x, y, z)
    mesh.castShadow = false
    mesh.receiveShadow = true
    return mesh
  }
  g.add(flat(new Mesh(tiledPlane(fd.halfWidth * 2, len), studMat(zone.verge)), Y_VERGE))
  g.add(flat(new Mesh(new PlaneGeometry(fd.roadHalf * 2, len).rotateX(-Math.PI / 2), solid(zone.road, { roughness: 0.95 })), Y_ROAD))

  // Lane dashes, 3 m long every DASH_EVERY, phased to carry on from the field's.
  const dashes = []
  const phase = fd.roadZ - 2 - 1.5 // the field's first dash centre
  const first = Math.ceil((phase - zAt(d0)) / DASH_EVERY)
  for (let k = first; phase - k * DASH_EVERY > zAt(d1) + 1.5; k++) {
    dashes.push(new PlaneGeometry(0.35, 3).rotateX(-Math.PI / 2).translate(0, Y_DASH, phase - k * DASH_EVERY))
  }
  if (dashes.length) {
    const dash = new MeshBasicMaterial({ color: zone.dash, polygonOffset: true, polygonOffsetFactor: -2 })
    g.add(new Mesh(mergeGeometries(dashes), dash))
  }

  for (const sx of [-1, 1]) {
    g.add(part(tiledBox(fd.sidewalk, 0.15, len), studMat(zone.sidewalk), sx * SIDEWALK_X, 0.075, z))
    const fence = stoneFence(len)
    fence.position.set(sx * FENCE_X, 0, z)
    fence.rotation.y = Math.PI / 2
    g.add(fence)
    const lot = new Mesh(tiledPlane(LOT_W, len), studMat(zone.lot[0], zone.lot[1]))
    lot.position.x = sx * (LOT_X0 + LOT_W / 2)
    g.add(flat(lot, Y_LOT))

    // Terraced walls closing the corridor, stepping up away from the street.
    let x = STREET.corridorHalf
    for (const [w, h] of STREET.walls) {
      const wall = terrace(w, h, len, zone.wall[0], zone.wall[1])
      wall.position.set(sx * (x + w / 2), h / 2, z)
      g.add(wall)
      x += w
    }
  }

  const theme = ZONE_THEMES[zone.id]
  if (theme) scatter(g, zone, theme, d0, d1)

  // The zone's gate over the road where it starts (the Neighbourhood's own is in map.js).
  if (zone.startD > 0) {
    const zoneGate = gate(GATE_SPAN, STREET.gateHeight, `${zone.icon} ${zone.label}`, { trim: zone.trim, panel: false })
    zoneGate.position.z = zAt(zone.startD)
    g.add(zoneGate)
  }
  return g
}

// `animate` collects per-frame callbacks (t, dt), as map.js's own list.
export function createStreet(animate) {
  const root = new Group()
  root.name = 'street'
  for (const span of ZONE_SPANS) root.add(buildZone(span))
  root.add(...endPortal(animate))

  // A wall straight across past the far end, in the last zone's colours.
  const last = STREET_ZONES[STREET_ZONES.length - 1]
  const reach = STREET.walls.reduce((sum, [w]) => sum + w, STREET.corridorHalf)
  const height = Math.max(...STREET.walls.map(([, h]) => h))
  const end = terrace(reach * 2, height, 4, last.wall[0], last.wall[1])
  end.position.set(0, height / 2, zAt(END_D) - 2)
  root.add(end)
  return root
}
