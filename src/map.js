// The lobby: the yellow stud plaza with its walkway and floor arrows, the plane
// hall and purchase pads to the west, the World 2 portal and Demon Egg either
// side of the throw area and the throwing field up to the Neighbourhood (north), the free reward and egg row under
// the waterfall cliff (south), the rebirth training pads to the east, and the hills
// around it all. Layout lives in config.js (MAP); builders in props.js.
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, RingGeometry } from 'three'
import { addCollider, addPusher } from './colliders.js'
import { MAP, MATERIAL_PBR, PALETTE as P, SPAWN, STREET } from './config.js'
import { goldTexture, lavaTexture, neonTexture, rainbowTexture, waterfallTexture } from './textures.js'
import {
  basketballCourt,
  bench,
  building,
  chevron,
  demonEgg,
  eggStand,
  floorArrow,
  freeReward,
  gate,
  gem,
  groundShape,
  hall,
  hexFrame,
  lampPost,
  makeSign,
  paperPlane,
  pencil,
  part,
  planeFrame,
  plotPad,
  rainbowRing,
  rubyFrame,
  school,
  solid,
  star,
  stoneFence,
  studMat,
  swirlRing,
  target,
  tiledBox,
  tiledPlane,
  waterfall,
  world2Portal,
} from './props.js'
import { createTerrain } from './terrain.js'
import { createStreet } from './street.js'
import { game, subscribe } from './store.js'

// Floor layers, lifted just enough to never fight the ground or each other.
const Y_PLAZA = 0.02
const Y_PATH = 0.035
const Y_DECAL = 0.05

// Yaw that turns an object's +Z toward the spawn point.
const faceSpawn = (x, z) => Math.atan2(SPAWN.x - x, SPAWN.z - z)

function place(obj, x, y, z, rotY = 0) {
  obj.position.set(x, y, z)
  obj.rotation.y = rotY
  return obj
}

export function createMap() {
  const root = new Group()
  const animate = [] // (t, dt) => void
  let time = 0

  root.add(createTerrain())
  root.add(createStreet(animate)) // the street past the gate, zone by zone, up to the far end

  // --- Plaza --------------------------------------------------------------------
  const pz = MAP.plaza
  const plaza = part(tiledPlane(pz.maxX - pz.minX, pz.maxZ - pz.minZ), studMat(P.plaza))
  plaza.position.set((pz.minX + pz.maxX) / 2, Y_PLAZA, (pz.minZ + pz.maxZ) / 2)
  plaza.castShadow = false
  root.add(plaza)

  const walkway = part(groundShape(MAP.path), studMat(P.plazaPath))
  walkway.position.y = Y_PATH
  walkway.castShadow = false
  root.add(walkway)
  // Darker outline: one strip per (axis-aligned) walkway edge.
  const edgeMat = new MeshBasicMaterial({ color: P.plazaEdge, polygonOffset: true, polygonOffsetFactor: -1 })
  MAP.path.forEach(([ax, az], i) => {
    const [bx, bz] = MAP.path[(i + 1) % MAP.path.length]
    if (Math.max(az, bz) > pz.maxZ - 0.01 && az === bz) return // runs off the plaza's south edge
    const len = Math.hypot(bx - ax, bz - az) + 0.5
    const strip = new Mesh(az === bz ? tiledPlane(len, 0.5) : tiledPlane(0.5, len), edgeMat)
    strip.position.set((ax + bx) / 2, Y_PATH + 0.005, (az + bz) / 2)
    strip.receiveShadow = true
    root.add(strip)
  })

  // Chevrons leading north to the street.
  const ch = MAP.chevrons
  for (let i = 0; i < ch.count; i++) root.add(place(chevron(4.6, P.chevron), ch.x, Y_DECAL, ch.z - i * ch.spacing))

  // White arrows curving from the spawn west to the plane pads.
  const { from, via, to, count } = MAP.arrows
  const curve = (t) => [0, 1].map((k) => (1 - t) * (1 - t) * from[k] + 2 * (1 - t) * t * via[k] + t * t * to[k])
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const [x, z] = curve(t)
    const [nx, nz] = curve(Math.min(1, t + 0.01))
    const [px, pz2] = curve(Math.max(0, t - 0.01))
    // Arrow points -Z by default: yaw so -Z runs along the curve tangent.
    root.add(place(floorArrow(1.3, P.arrow, P.arrowEdge), x, Y_DECAL, z, Math.atan2(-(nx - px), -(nz - pz2))))
  }

  // Yellow ring on the floor beside the free reward.
  const ring = new Mesh(new RingGeometry(1.5, 2.3, 48), new MeshBasicMaterial({ color: P.ringYellow, polygonOffset: true, polygonOffsetFactor: -2 }))
  ring.rotation.x = -Math.PI / 2
  ring.position.set(MAP.yellowRing.x, Y_DECAL, MAP.yellowRing.z)
  root.add(ring)

  // --- Plane hall + purchase pads (west) ----------------------------------------
  const H = MAP.hall
  const fz = MAP.hallFloorHalf * 2
  for (const [minX, maxX, h, color] of MAP.hallFloors) {
    const w = maxX - minX
    root.add(part(tiledBox(w, h, fz), studMat(color), (minX + maxX) / 2, h / 2, H.z))
    addCollider((minX + maxX) / 2, H.z, w, fz, h)
  }
  // Blue trim along the floor's front edge, at the mouth.
  const [, floorFront, floorH] = MAP.hallFloors[0]
  root.add(part(tiledBox(0.3, floorH + 0.04, fz), studMat(P.trimBlue), floorFront + 0.15, (floorH + 0.04) / 2, H.z))
  const floorHeight = (x) => Math.max(0, ...MAP.hallFloors.filter(([minX, maxX]) => x >= minX && x < maxX).map((f) => f[2]))

  root.add(place(hall(H.halfWidth, H.height, H.length), H.mouthX, 0, H.z, Math.PI / 2)) // tube runs west from the mouth
  // The shell's feet are walls, and so is the back.
  for (const sz of [-1, 1]) addCollider(H.mouthX - H.length / 2, H.z + sz * H.halfWidth, H.length, 1, 6)
  addCollider(H.mouthX - H.length, H.z, 1, H.halfWidth * 2, H.height)

  // Each pad's top and sign follow the store (pads.js does the buying): yellow and EQUIPPED for
  // the equipped plane, green and OWNED for the rest owned, red with the price otherwise.
  const hallPads = MAP.pads.map((pad) => {
    const y = floorHeight(pad.x)
    const plot = place(plotPad(P.padRed), pad.x, y, pad.z)
    root.add(plot)
    addCollider(pad.x, pad.z, 4, 4, y + 0.3)
    if (pad.frame) root.add(place(planeFrame(), pad.x - 3, y, pad.z, Math.PI / 2))
    const plane = paperPlane(pad.plane)
    plane.position.set(pad.x, y + 2.2, pad.z)
    root.add(plane)
    const phase = pad.z * 0.4
    animate.push((t) => {
      plane.rotation.y = t * 0.8 + phase
      plane.position.y = y + 2.2 + Math.sin(t * 2 + phase) * 0.2
    })
    return { pad, y, top: plot.children[1], sign: null, text: null }
  })
  const hallLook = (i, g) =>
    g.equippedPlane === i
      ? ['EQUIPPED', '#ffb11f', P.padEquipped]
      : g.ownedPlanes.includes(i)
        ? ['OWNED', '#5cff3d', P.padOwned]
        : [`🏆 ${MAP.pads[i].wins} Wins`, '#ffd84a', P.padRed]
  const showHall = (g) => {
    hallPads.forEach((h, i) => {
      const [text, color, top] = hallLook(i, g)
      h.top.material = solid(top)
      if (text === h.text) return
      h.text = text
      if (h.sign) {
        root.remove(h.sign)
        h.sign.material.map?.dispose()
        h.sign.material.dispose()
      }
      h.sign = place(
        makeSign([{ text: `${h.pad.power} 💪/ Power`, color: '#ffffff', size: 54 }, { text, color, size: 54 }], 1.8),
        h.pad.x, h.y + (h.pad.frame ? 5 : 4.2), h.pad.z,
      )
      root.add(h.sign)
    })
  }
  showHall(game)
  subscribe(showHall)

  // --- World 2 portal + Demon Egg -------------------------------------------------
  const w2 = MAP.world2
  const portal = world2Portal()
  root.add(place(portal.group, w2.x, 0, w2.z, faceSpawn(w2.x, w2.z)))
  addCollider(w2.x, w2.z, 6, 1.4, 6, faceSpawn(w2.x, w2.z))
  animate.push((t) => (portal.swirl.rotation.z = -t * 1.6))
  root.add(place(
    makeSign([
      { text: '🌐 World 2', color: '#ffffff', size: 64 },
      { text: '💪 Needs 2.5M Power', color: '#ffb01f', size: 40 },
    ], 2.4),
    w2.x, 7.6, w2.z,
  ))

  const de = MAP.demonEgg
  const egg = demonEgg()
  root.add(place(egg.group, de.x, 0, de.z, faceSpawn(de.x, de.z)))
  addCollider(de.x, de.z, 4.6, 4.6, 1.15)
  animate.push((t) => {
    egg.egg.rotation.y = t * 0.5
    egg.egg.position.y = 2.75 + Math.sin(t * 1.5) * 0.08
    egg.flames.forEach((f, i) => {
      const s = 0.8 + 0.3 * Math.sin(t * 9 + i * 1.7)
      f.scale.set(s, 0.7 + 0.5 * Math.abs(Math.sin(t * 6 + i)), s)
    })
  })
  root.add(place(makeSign([{ text: 'Demon Egg', color: '#ff3b3b', size: 56 }], 1.2), de.x, 6.4, de.z))

  // --- Rebirth training pads (east) ------------------------------------------------
  const tr = MAP.trainingRow
  const PAD_BASE = 0.2 // light-blue base slab
  const PAD_H = 0.4 // pad rim above the base
  const padTop = PAD_BASE + PAD_H
  const padLen = tr.x1 - tr.x0
  const padX = (tr.x0 + tr.x1) / 2
  const prizeX = tr.x1 - 2.2 // on a stand at the east end
  const firstZ = tr.z0
  const lastZ = tr.z0 + (MAP.trainingPads.length - 1) * tr.spacing
  const baseD = lastZ - firstZ + tr.w + 3
  root.add(part(tiledBox(padLen + 3, PAD_BASE, baseD), studMat(tr.base), padX, PAD_BASE / 2, (firstZ + lastZ) / 2))
  addCollider(padX, (firstZ + lastZ) / 2, padLen + 3, baseD, PAD_BASE)

  const RINGS = {
    white: ['#ffffff', '#ef2c36', '#ffffff', '#ef2c36', '#ffffff', '#ef2c36'],
    green: ['#26b043', '#7be36a', '#26b043', '#7be36a', '#1d8f36'],
    gold: ['#ffcf2e', '#e09a0f', '#ffcf2e', '#e09a0f', '#7a4a00'],
  }
  const FRAMED = { hex: hexFrame, ruby: rubyFrame, rainbow: rainbowRing, swirl: swirlRing }
  const surfaceMat = (surface) => {
    const pbr = MATERIAL_PBR.PROP
    if (surface === 'lava' || surface === 'crimson') {
      const tex = surface === 'lava' ? lavaTexture() : lavaTexture('#ff2a3a', '#3a0a12', '#ff7a7a')
      return { tile: 4, mat: new MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.3, ...pbr }) }
    }
    if (surface === 'gold') return { mat: new MeshStandardMaterial({ map: goldTexture(), roughness: 0.35, metalness: 0.4 }) }
    if (surface === 'rainbow') return { mat: new MeshStandardMaterial({ map: rainbowTexture(), emissiveMap: rainbowTexture(), emissive: '#ffffff', emissiveIntensity: 0.25, ...pbr }) }
    if (surface === 'neon') return { mat: new MeshStandardMaterial({ map: neonTexture(), emissiveMap: neonTexture(), emissive: '#ffffff', emissiveIntensity: 0.9, ...pbr }) }
    return { tile: 2, mat: studMat(surface) }
  }

  MAP.trainingPads.forEach((pad, i) => {
    const z = tr.z0 + i * tr.spacing
    const rimMat = pad.surface === 'neon' ? solid(pad.rim, { emissive: pad.rim, emissiveIntensity: 0.5 }) : studMat(pad.rim)
    root.add(part(tiledBox(padLen, PAD_H, tr.w), rimMat, padX, PAD_BASE + PAD_H / 2, z))
    addCollider(padX, z, padLen, tr.w, padTop)
    // Inset surface: tiled textures (with a `tile` size) keep their scale, the rest stretch over the whole pad.
    const { tile, mat } = surfaceMat(pad.surface)
    const geo = tile ? tiledPlane(padLen - 1, tr.w - 1, tile) : new PlaneGeometry(padLen - 1, tr.w - 1).rotateX(-Math.PI / 2)
    const inset = part(geo, mat)
    inset.position.set(padX - 0.5, padTop + 0.01, z)
    inset.castShadow = false
    root.add(inset)

    // Prizes face west, back along the pad, at three-quarter size to sit inside its width.
    const yaw = -Math.PI / 2
    const PRIZE_SCALE = 0.75
    if (RINGS[pad.prize]) {
      const t = place(target(RINGS[pad.prize]), prizeX, padTop, z, yaw)
      t.scale.setScalar(PRIZE_SCALE)
      root.add(t)
    } else {
      root.add(part(tiledBox(2.2, 1, 2.2), studMat('#2a2f45'), prizeX, padTop + 0.5, z))
      const y = padTop + 2.9
      if (pad.prize === 'star' || pad.prize === 'gem') {
        const spin = pad.prize === 'star' ? star('#ffcf2e') : gem('#9b4dff')
        spin.position.set(prizeX, y, z)
        spin.scale.multiplyScalar(PRIZE_SCALE)
        root.add(spin)
        animate.push((t) => (spin.rotation.y = t * 1.2))
      } else {
        const prize = FRAMED[pad.prize]()
        const obj = prize.group ?? prize
        obj.scale.setScalar(PRIZE_SCALE)
        root.add(place(obj, prizeX, y, z, yaw))
        if (prize.swirl) animate.push((t) => (prize.swirl.rotation.z = -t * 2))
        if (pad.prize === 'rainbow') animate.push((t) => (obj.rotation.z = t * 0.6))
      }
    }
    addCollider(prizeX, z, 2.8, 2.4, padTop + 4)
    root.add(place(
      makeSign(pad.sign.map(([text, color]) => ({ text, color, size: 50 })), 0.9 * pad.sign.length),
      prizeX, 6.6 + 0.45 * (pad.sign.length - 2), z,
    ))
  })

  // --- Free reward + egg row (south) ---------------------------------------------
  const fr = MAP.freeReward
  const reward = freeReward()
  root.add(place(reward.group, fr.x, 0, fr.z, faceSpawn(fr.x, fr.z)))
  addCollider(fr.x, fr.z, 6, 6, 1.05)
  animate.push((t) => (reward.dragon.rotation.y = Math.sin(t * 0.7) * 0.5))
  root.add(place(makeSign([{ text: 'FREE REWARD', color: '#ffb11f', size: 56 }], 1.1), fr.x, 5.6, fr.z))

  const es = MAP.eggStage
  const STAGE_H = 0.4
  root.add(part(tiledBox(es.halfWidth * 2, STAGE_H, 5.6), studMat(P.white), 0, STAGE_H / 2, es.z))
  root.add(part(tiledBox(es.halfWidth * 2, STAGE_H + 0.04, 0.3), studMat(P.trimBlue), 0, (STAGE_H + 0.04) / 2, es.z - 2.95))
  addCollider(0, es.z, es.halfWidth * 2, 5.9, STAGE_H)
  for (const e of MAP.eggs) {
    root.add(place(eggStand(e), e.x, STAGE_H, es.z, Math.PI)) // face north, board behind
    addCollider(e.x, es.z + 0.6, 3.4, 4, STAGE_H + 4)
    const lines = e.best
      ? [{ text: e.cost, color: '#4be36a', size: 34 }, { text: 'BEST IN GAME', color: '#ff3b3b', size: 34 }, { text: e.name, color: '#ffffff', size: 52 }, { text: '1000% BETTER', color: '#ffe23d', size: 34 }]
      : [{ text: e.name, color: '#ffffff', size: 52 }, { text: e.cost, color: e.cost.startsWith('⬢') ? '#4be36a' : '#ffd84a', size: 36 }]
    root.add(place(makeSign(lines, e.best ? 2.4 : 1.3), e.x, STAGE_H + (e.best ? 6.4 : 5.6), es.z + 1.7))
  }

  // Waterfalls cascading down the cliff behind the eggs, facing the plaza.
  for (const f of MAP.waterfalls) root.add(place(waterfall(f.w, f.faces), f.x, 0, 0))
  const fallTex = waterfallTexture()
  animate.push((t, dt) => (fallTex.offset.y = (fallTex.offset.y + dt * 1.4) % 1))

  // --- Throw area + field (north) -----------------------------------------------
  // The walkway's north strip is the throw area; its name is painted across it.
  const ta = MAP.throwArea
  const label = makeSign([{ text: ta.label, color: '#ffffff', size: 120, stroke: '#3a3f4a' }], 0, { flat: true, width: ta.labelWidth })
  label.position.set(0, Y_DECAL, ta.z)
  root.add(label)

  const fd = MAP.field
  const fieldLen = fd.startZ - fd.roadZ
  const roadLen = fd.roadZ - fd.endZ
  const fieldW = fd.halfWidth * 2
  root.add(place(part(tiledPlane(fieldW, fieldLen + roadLen), studMat(P.field)), 0, Y_PLAZA, (fd.startZ + fd.endZ) / 2))
  const road = part(new PlaneGeometry(fd.roadHalf * 2, roadLen).rotateX(-Math.PI / 2), solid(P.road, { roughness: 0.95 }))
  road.position.set(0, Y_PATH, (fd.roadZ + fd.endZ) / 2)
  road.castShadow = false
  root.add(road)
  const dash = new MeshBasicMaterial({ color: '#ffffff', polygonOffset: true, polygonOffsetFactor: -2 })
  // The start line painted across the road where it meets the throw area.
  const startLine = new Mesh(new PlaneGeometry(fd.roadHalf * 2, 0.6).rotateX(-Math.PI / 2), dash)
  startLine.position.set(0, Y_DECAL, fd.roadZ - 0.3)
  root.add(startLine)
  for (let z = fd.roadZ - 2; z > fd.endZ; z -= 6) {
    const d = new Mesh(new PlaneGeometry(0.35, 3).rotateX(-Math.PI / 2), dash)
    d.position.set(0, Y_DECAL, z - 1.5)
    root.add(d)
  }
  const sideLen = fd.startZ - fd.endZ
  const sideMid = (fd.startZ + fd.endZ) / 2
  for (const sx of [-1, 1]) {
    const sideX = sx * (fd.halfWidth + fd.sidewalk / 2)
    root.add(part(tiledBox(fd.sidewalk, 0.15, sideLen), studMat(P.sidewalk), sideX, 0.075, sideMid))
    addCollider(sideX, sideMid, fd.sidewalk, sideLen, 0.15)
    const fx = sx * (fd.halfWidth + fd.sidewalk + 0.35)
    root.add(place(stoneFence(sideLen - 1), fx, 0, sideMid - 0.5, Math.PI / 2))
    addCollider(fx, sideMid - 0.5, 0.7, sideLen - 1, 1.6)
    for (let z = fd.startZ - 3; z > fd.endZ + 4; z -= 12) {
      root.add(place(lampPost(), sideX, 0.15, z))
      addCollider(sideX, z, 0.6, 0.6, 5.5)
    }
  }

  // The gate is as far as anyone walks: its panel is solid and a stretch of fence closes each
  // side to the field fence. The fences can be jumped and the lots walked, so the real barrier
  // is one invisible wall across the whole corridor. Past it, only planes go (street.js).
  const gateSpan = fd.roadHalf * 2 + 4
  root.add(place(gate(gateSpan, 11, '🏠 Neighbourhood'), 0, 0, fd.gateZ))
  for (const sx of [-1, 1]) addCollider((sx * gateSpan) / 2, fd.gateZ, 2.2, 2.2, 11)
  const pillarEdge = gateSpan / 2 + 1.1
  const fenceX = fd.halfWidth + fd.sidewalk + 0.35
  for (const sx of [-1, 1]) {
    const len = fenceX - pillarEdge
    root.add(place(stoneFence(len), sx * (pillarEdge + len / 2), 0, fd.gateZ))
  }
  addCollider(0, fd.gateZ, STREET.corridorHalf * 2 + 8, 0.6, 30)

  // Players throw from the throw area and never set foot on the field or road: everything
  // between the fences north of the start line keeps them out, however high they jump. A
  // pusher rather than a collider, so planes still fly up it and the camera sees over it.
  const keepOutX = fenceX + 0.35
  addPusher((p, radius) => {
    if (Math.abs(p.x) >= keepOutX + radius || p.z >= fd.startZ + radius || p.z <= fd.endZ - radius) return
    const south = fd.startZ + radius - p.z
    const side = keepOutX + radius - Math.abs(p.x)
    if (south <= side) p.z += south
    else p.x += Math.sign(p.x || 1) * side
  })

  // --- Beside the field: school, court, benches, houses ----------------------------
  const sc = MAP.school
  root.add(place(school(sc), sc.x, 0, sc.z))
  addCollider(sc.x, sc.z, sc.w, sc.d, sc.h + 10)
  addCollider(sc.x + sc.w / 2 + 0.7, sc.z, 1.4, 6, 7.4) // porch
  root.add(place(pencil(), MAP.pencil.x, 0, MAP.pencil.z))
  addCollider(MAP.pencil.x, MAP.pencil.z, 1.1, 1.1, 6.8)

  const ct = MAP.court
  root.add(place(basketballCourt(ct.w, ct.d), ct.x, 0, ct.z))
  addCollider(ct.x, ct.z, ct.w + 1, ct.d + 1, 0.1)
  for (const sx of [-1, 1]) addCollider(ct.x + sx * (ct.w / 2 + 0.2), ct.z, 0.4, 0.4, 3.6) // hoop poles

  for (const [x, z, yaw] of MAP.benches) {
    root.add(place(bench(), x, 0, z, yaw))
    addCollider(x, z, 2.4, 2, 0.85, yaw)
  }

  for (const b of MAP.houses) {
    const { x, z, rot = 0, ...spec } = b
    root.add(place(building(spec), x, 0, z, rot))
    addCollider(x, z, spec.w, spec.d, spec.h + 4, rot)
  }

  return {
    root,
    update(dt) {
      time += dt
      for (const fn of animate) fn(time, dt)
    },
  }
}

function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * amt))
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
