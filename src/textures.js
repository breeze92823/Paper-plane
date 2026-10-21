// Canvas-painted textures: tileable grass, studded checker bricks, planks. Each
// painter is cached by its arguments. Everything is procedural, no image files.
import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace } from 'three'
import { COLORS, GROUND_SIZE, WATERFALL } from './config.js'

const cache = new Map()
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)
}

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function toTexture(c, { repeat = true, pixel = false, srgb = true } = {}) {
  const t = new CanvasTexture(c)
  if (srgb) t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping
  if (pixel) t.magFilter = NearestFilter
  return t
}

// Mix a hex colour toward white (amt > 0) or black (amt < 0).
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)),
  )
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`
}

// Deterministic PRNG so painted textures look the same every load.
export function mulberry32(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// --- Grass ------------------------------------------------------------------
const TILE_PX = 512
export const GRASS_TILE_M = 8 // metres of ground covered by one texture tile

// Paints a tileable grass tile: mottled base, soft blotches, then blade strokes.
// Returns the colour canvas and a greyscale height canvas (for the bump map).
function paintGrass() {
  const rand = mulberry32(1337)
  const color = canvas(TILE_PX, TILE_PX)
  const height = canvas(TILE_PX, TILE_PX)
  const c = color.getContext('2d')
  const h = height.getContext('2d')

  c.fillStyle = COLORS.grass
  c.fillRect(0, 0, TILE_PX, TILE_PX)
  h.fillStyle = '#808080'
  h.fillRect(0, 0, TILE_PX, TILE_PX)

  // Draws at (x, y) and again at the wrapped offsets so the tile repeats seamlessly.
  const wrapped = (x, y, r, draw) => {
    for (const ox of [-TILE_PX, 0, TILE_PX]) {
      for (const oy of [-TILE_PX, 0, TILE_PX]) {
        if (x + ox + r < 0 || x + ox - r > TILE_PX || y + oy + r < 0 || y + oy - r > TILE_PX) continue
        draw(x + ox, y + oy)
      }
    }
  }

  // Large soft blotches of lighter/darker green.
  for (let i = 0; i < 90; i++) {
    const x = rand() * TILE_PX
    const y = rand() * TILE_PX
    const r = 30 + rand() * 70
    const dark = rand() < 0.5
    wrapped(x, y, r, (px, py) => {
      const g = c.createRadialGradient(px, py, 0, px, py, r)
      g.addColorStop(0, dark ? 'rgba(40,90,30,0.28)' : 'rgba(150,200,90,0.2)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      c.fillStyle = g
      c.fillRect(px - r, py - r, r * 2, r * 2)
    })
  }

  // Blades: short strokes in a range of greens, mirrored into the height map.
  const greens = [COLORS.grassDark, COLORS.grass, '#74b552', '#3f7a2e', '#8cc760']
  for (let i = 0; i < 9000; i++) {
    const x = rand() * TILE_PX
    const y = rand() * TILE_PX
    const len = 4 + rand() * 9
    const lean = (rand() - 0.5) * 5
    const tint = greens[Math.floor(rand() * greens.length)]
    const lift = 100 + Math.floor(rand() * 140)
    wrapped(x, y, len + 6, (px, py) => {
      c.strokeStyle = tint
      c.lineWidth = 1.3
      c.beginPath()
      c.moveTo(px, py)
      c.lineTo(px + lean, py - len)
      c.stroke()
      h.strokeStyle = `rgb(${lift},${lift},${lift})`
      h.lineWidth = 1.3
      h.beginPath()
      h.moveTo(px, py)
      h.lineTo(px + lean, py - len)
      h.stroke()
    })
  }
  return { color, height }
}

// { map, bumpMap } for the ground plane; textures repeat over GROUND_SIZE.
export function grassTextures() {
  return cached('grass', () => {
    const { color, height } = paintGrass()
    const map = toTexture(color)
    const bumpMap = toTexture(height, { srgb: false })
    for (const t of [map, bumpMap]) t.repeat.set(GROUND_SIZE / GRASS_TILE_M, GROUND_SIZE / GRASS_TILE_M)
    return { map, bumpMap }
  })
}

// --- Props ------------------------------------------------------------------
// One stud: an embossed ring like a toy brick seen from above.
function stud(c, x, y, r, base) {
  c.lineWidth = r * 0.28
  c.strokeStyle = shade(base, 0.22)
  c.beginPath()
  c.arc(x, y, r, Math.PI * 0.75, Math.PI * 1.75)
  c.stroke()
  c.strokeStyle = shade(base, -0.16)
  c.beginPath()
  c.arc(x, y, r, Math.PI * 1.75, Math.PI * 2.75)
  c.stroke()
}

// 2x2 checker cells, each with 2x2 studs. One tile = 2 cells per side.
export function studTile(colA, colB, studs = 2) {
  return cached(`stud${colA}${colB}${studs}`, () => {
    const S = 256
    const c = canvas(S, S)
    const g = c.getContext('2d')
    const cell = S / 2
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const col = (i + j) % 2 ? colB : colA
        g.fillStyle = col
        g.fillRect(i * cell, j * cell, cell, cell)
        const step = cell / studs
        for (let a = 0; a < studs; a++) {
          for (let b = 0; b < studs; b++) {
            stud(g, i * cell + step * (a + 0.5), j * cell + step * (b + 0.5), step * 0.24, col)
          }
        }
      }
    }
    return toTexture(c)
  })
}

// Horizontal planks with stud rows.
export function plankTexture(col) {
  return cached(`plank${col}`, () => {
    const c = canvas(128, 128)
    const g = c.getContext('2d')
    g.fillStyle = col
    g.fillRect(0, 0, 128, 128)
    for (let y = 0; y < 128; y += 32) {
      g.fillStyle = shade(col, -0.12)
      g.fillRect(0, y + 29, 128, 3)
      g.fillStyle = shade(col, 0.12)
      g.fillRect(0, y, 128, 2)
      for (let x = 16; x < 128; x += 32) stud(g, x, y + 15, 6, col)
    }
    return toTexture(c)
  })
}

// --- Lobby --------------------------------------------------------------------
// Blocky per-pixel noise around one colour, for the hills' dirt and grass.
export function noiseTile(base, spread, seed, cells = 16) {
  return cached(`noise${base}${spread}${seed}${cells}`, () => {
    const rand = mulberry32(seed)
    const c = canvas(cells, cells)
    const g = c.getContext('2d')
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        g.fillStyle = shade(base, (rand() - 0.5) * spread)
        g.fillRect(x, y, 1, 1)
      }
    }
    return toTexture(c, { pixel: true })
  })
}

// Building wall: optional brick courses, a grid of framed windows, a door.
export function facadeTexture({ w, h, wall, glass, frame, floors, cols, brick = false, door = false }) {
  return cached(`facade${w}${h}${wall}${glass}${floors}${cols}${brick}${door}`, () => {
    const PX = 32 // pixels per metre
    const c = canvas(Math.round(w * PX), Math.round(h * PX))
    const g = c.getContext('2d')
    g.fillStyle = wall
    g.fillRect(0, 0, c.width, c.height)
    if (brick) {
      g.fillStyle = shade(wall, -0.18)
      const course = PX * 0.25
      for (let row = 0, y = 0; y < c.height; row++, y += course) {
        g.fillRect(0, y, c.width, 1.5)
        for (let x = (row % 2) * PX * 0.25; x < c.width; x += PX * 0.5) g.fillRect(x, y, 1.5, course)
      }
    }
    const floorH = c.height / floors
    const colW = c.width / cols
    for (let f = 0; f < floors; f++) {
      for (let i = 0; i < cols; i++) {
        const isDoor = door && f === floors - 1 && i === Math.floor(cols / 2)
        const ww = colW * (isDoor ? 0.42 : 0.5)
        const wh = floorH * (isDoor ? 0.78 : 0.5)
        const x = i * colW + (colW - ww) / 2
        const y = isDoor ? (f + 1) * floorH - wh : f * floorH + floorH * 0.22
        g.fillStyle = frame
        g.fillRect(x - 4, y - 4, ww + 8, wh + 8)
        g.fillStyle = isDoor ? '#7a4a2a' : glass
        g.fillRect(x, y, ww, wh)
        if (!isDoor) {
          g.fillStyle = frame
          g.fillRect(x + ww / 2 - 1.5, y, 3, wh)
          g.fillRect(x, y + wh / 2 - 1.5, ww, 3)
          g.fillStyle = 'rgba(255,255,255,0.35)'
          g.fillRect(x + 3, y + 3, ww * 0.18, wh * 0.4)
        }
      }
    }
    return toTexture(c, { repeat: false })
  })
}

// Horizontal bands, one pair per texture repeat.
export function stripeTexture(colA, colB) {
  return cached(`stripe${colA}${colB}`, () => {
    const c = canvas(8, 64)
    const g = c.getContext('2d')
    g.fillStyle = colA
    g.fillRect(0, 0, 8, 32)
    g.fillStyle = colB
    g.fillRect(0, 32, 8, 32)
    return toTexture(c, { pixel: true })
  })
}

// Concentric rings, outermost first.
export function bullseyeTexture(rings) {
  return cached(`bull${rings.join()}`, () => {
    const S = 256
    const c = canvas(S, S)
    const g = c.getContext('2d')
    rings.forEach((col, i) => {
      g.fillStyle = col
      g.beginPath()
      g.arc(S / 2, S / 2, (S / 2) * (1 - i / rings.length), 0, Math.PI * 2)
      g.fill()
    })
    return toTexture(c, { repeat: false })
  })
}

// Spiral arms for the World 2 portal, alpha fading at the rim.
export function swirlTexture(colA, colB) {
  return cached(`swirl${colA}${colB}`, () => {
    const S = 256
    const c = canvas(S, S)
    const g = c.getContext('2d')
    const img = g.createImageData(S, S)
    const a = parseInt(colA.slice(1), 16)
    const b = parseInt(colB.slice(1), 16)
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = (x - S / 2) / (S / 2)
        const dy = (y - S / 2) / (S / 2)
        const r = Math.hypot(dx, dy)
        const arm = 0.5 + 0.5 * Math.sin(Math.atan2(dy, dx) * 3 + r * 11)
        const k = Math.min(1, arm * (0.4 + r))
        const i = (y * S + x) * 4
        for (let ch = 0; ch < 3; ch++) {
          const sh = 16 - ch * 8
          img.data[i + ch] = ((a >> sh) & 255) * (1 - k) + ((b >> sh) & 255) * k
        }
        img.data[i + 3] = r > 1 ? 0 : 255 * Math.min(1, (1 - r) * 8)
      }
    }
    g.putImageData(img, 0, 0)
    return toTexture(c, { repeat: false })
  })
}

// Dark shell with glowing cracks and spots; `glow` returns only the lit parts (emissive map).
export function demonEggTexture(glow = false) {
  return cached(`egg${glow}`, () => {
    const rand = mulberry32(666)
    const c = canvas(256, 128)
    const g = c.getContext('2d')
    g.fillStyle = glow ? '#000000' : '#1a0d12'
    g.fillRect(0, 0, 256, 128)
    g.lineCap = 'round'
    for (let i = 0; i < 26; i++) {
      let x = rand() * 256
      let y = rand() * 128
      g.strokeStyle = rand() < 0.5 ? '#ff3b1f' : '#ff8a1f'
      g.lineWidth = 1.5 + rand() * 2.5
      g.beginPath()
      g.moveTo(x, y)
      for (let s = 0; s < 4; s++) {
        x += (rand() - 0.5) * 40
        y += (rand() - 0.5) * 30
        g.lineTo(x, y)
      }
      g.stroke()
    }
    for (let i = 0; i < 18; i++) {
      g.fillStyle = '#e8261a'
      g.beginPath()
      g.arc(rand() * 256, rand() * 128, 2 + rand() * 6, 0, Math.PI * 2)
      g.fill()
    }
    return toTexture(c)
  })
}

// Billboard text: centred lines of { text, color, size } with a dark outline.
// Resizes the canvas to fit; returns its width / height.
export const SIGN_FONT = '"Fredoka", "Segoe UI Emoji", "Arial Rounded MT Bold", Arial, sans-serif'
export function paintSign(c, lines) {
  const g = c.getContext('2d')
  const font = (l) => `700 ${l.size}px ${SIGN_FONT}`
  let w = 0
  let h = 0
  for (const l of lines) {
    g.font = font(l)
    w = Math.max(w, g.measureText(l.text).width)
    h += l.size * 1.12
  }
  const pad = 14
  c.width = Math.ceil(w + pad * 2)
  c.height = Math.ceil(h + pad * 2)
  g.textAlign = 'center'
  g.textBaseline = 'top'
  g.lineJoin = 'round'
  let y = pad
  for (const l of lines) {
    g.font = font(l)
    g.lineWidth = l.size * 0.24
    g.strokeStyle = l.stroke ?? '#1c1a2a'
    g.strokeText(l.text, c.width / 2, y)
    g.fillStyle = l.color
    g.fillText(l.text, c.width / 2, y)
    y += l.size * 1.12
  }
  return c.width / c.height
}

// Molten floor: dark crust plates with glowing seams and the odd hot pool.
export function lavaTexture(glow = '#ff5a14', crust = '#2a1410', hot = '#ffb21f') {
  return cached(`lava${glow}${crust}${hot}`, () => {
    const rand = mulberry32(451)
    const S = 128
    const c = canvas(S, S)
    const g = c.getContext('2d')
    g.fillStyle = glow
    g.fillRect(0, 0, S, S)
    for (let i = 0; i < 70; i++) {
      const x = rand() * S
      const y = rand() * S
      const r = 4 + rand() * 12
      for (const ox of [-S, 0, S]) {
        for (const oy of [-S, 0, S]) {
          g.fillStyle = rand() < 0.75 ? crust : hot
          g.beginPath()
          g.arc(x + ox, y + oy, r, 0, Math.PI * 2)
          g.fill()
        }
      }
    }
    return toTexture(c, { pixel: true })
  })
}

// Polished gold: diagonal bands of shine.
export function goldTexture() {
  return cached('gold', () => {
    const c = canvas(128, 128)
    const g = c.getContext('2d')
    const grad = g.createLinearGradient(0, 128, 128, 0)
    ;['#e8a812', '#ffe46a', '#ffd23a', '#fff4b0', '#ffcf2e', '#e8a812'].forEach((col, i, a) => grad.addColorStop(i / (a.length - 1), col))
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    return toTexture(c, { repeat: false })
  })
}

// Pastel rainbow wash with a sprinkle of sparkles.
export function rainbowTexture() {
  return cached('rainbow', () => {
    const rand = mulberry32(7)
    const c = canvas(256, 128)
    const g = c.getContext('2d')
    const grad = g.createLinearGradient(0, 0, 256, 128)
    ;['#ff8fd8', '#ffb36b', '#fff27a', '#8ff59a', '#7fd8ff', '#c79bff'].forEach((col, i, a) => grad.addColorStop(i / (a.length - 1), col))
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 128)
    g.fillStyle = 'rgba(255,255,255,0.9)'
    for (let i = 0; i < 40; i++) {
      const x = rand() * 256
      const y = rand() * 128
      const r = 1 + rand() * 2.5
      g.fillRect(x - r * 2, y - 0.5, r * 4, 1)
      g.fillRect(x - 0.5, y - r * 2, 1, r * 4)
    }
    return toTexture(c, { repeat: false })
  })
}

// Dark navy floor with a glowing cyan inner border and lightning cracks.
export function neonTexture() {
  return cached('neon', () => {
    const rand = mulberry32(279)
    const W = 256
    const H = 128
    const c = canvas(W, H)
    const g = c.getContext('2d')
    g.fillStyle = '#161a42'
    g.fillRect(0, 0, W, H)
    g.strokeStyle = '#3ff0ff'
    g.shadowColor = '#3ff0ff'
    g.shadowBlur = 8
    g.lineWidth = 3
    g.strokeRect(8, 8, W - 16, H - 16)
    g.lineWidth = 1.5
    for (let i = 0; i < 7; i++) {
      let x = rand() * W
      let y = rand() * H
      g.beginPath()
      g.moveTo(x, y)
      for (let s = 0; s < 5; s++) {
        x += (rand() - 0.5) * 50
        y += (rand() - 0.5) * 30
        g.lineTo(x, y)
      }
      g.stroke()
    }
    return toTexture(c, { repeat: false })
  })
}

// Egg shell: base colour with soft spots, wrapped around a sphere (equirect).
export function eggTexture(base, spot, seed = 5) {
  return cached(`eggshell${base}${spot}${seed}`, () => {
    const rand = mulberry32(seed)
    const c = canvas(256, 128)
    const g = c.getContext('2d')
    g.fillStyle = base
    g.fillRect(0, 0, 256, 128)
    for (let i = 0; i < 22; i++) {
      const x = rand() * 256
      const y = 20 + rand() * 88
      const r = 6 + rand() * 10
      g.fillStyle = spot
      for (const ox of [-256, 0, 256]) {
        g.beginPath()
        g.ellipse(x + ox, y, r, r * 0.8, 0, 0, Math.PI * 2)
        g.fill()
      }
    }
    return toTexture(c)
  })
}

// Pet-odds board: header bar and a 3x2 grid of the egg's pets (`pets`: { emoji, chance,
// rarityBg } from EGG_SHOP), each on its rarity colour with its chance.
export function oddsBoardTexture(accent, pets) {
  return cached(`odds${accent}${pets.map((p) => p.emoji).join('')}`, () => {
    const W = 256
    const H = 192
    const c = canvas(W, H)
    const g = c.getContext('2d')
    g.fillStyle = '#16203a'
    g.fillRect(0, 0, W, H)
    g.fillStyle = accent
    g.fillRect(0, 0, W, 26)
    g.fillStyle = '#ffffff'
    g.font = `700 16px ${SIGN_FONT}`
    g.textAlign = 'center'
    g.fillText('Total Chance', W / 2, 19)
    pets.slice(0, 6).forEach((pet, i) => {
      const x = 12 + (i % 3) * 80
      const y = 36 + Math.floor(i / 3) * 76
      g.fillStyle = pet.rarityBg
      g.fillRect(x, y, 72, 68)
      g.font = `30px ${SIGN_FONT}`
      g.fillText(pet.emoji, x + 36, y + 38)
      g.fillStyle = '#ffffff'
      g.font = `700 14px ${SIGN_FONT}`
      g.fillText(`${pet.chance}%`, x + 36, y + 62)
    })
    return toTexture(c, { repeat: false })
  })
}

// Falling water: vertical streaks, scrolled down at runtime via offset.y.
export function waterfallTexture() {
  return cached('waterfall', () => {
    const rand = mulberry32(88)
    const c = canvas(64, 128)
    const g = c.getContext('2d')
    g.fillStyle = WATERFALL.base
    g.fillRect(0, 0, 64, 128)
    for (let i = 0; i < 60; i++) {
      g.fillStyle = rand() < 0.5 ? WATERFALL.light : WATERFALL.dark
      const x = rand() * 64
      const y = rand() * 128
      const h = 10 + rand() * 40
      g.fillRect(x, y, 2 + rand() * 3, h)
      g.fillRect(x, y - 128, 2 + rand() * 3, h) // wrap vertically
    }
    return toTexture(c)
  })
}

// Basketball court seen from above, long axis along the canvas width: two-tone blue,
// white boundary, half-court line, centre circle, keys and three-point arcs.
export function courtTexture() {
  return cached('court', () => {
    const W = 512
    const H = 358
    const c = canvas(W, H)
    const g = c.getContext('2d')
    g.fillStyle = '#3b86dc'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#5aa6f2'
    g.fillRect(16, 16, W - 32, H - 32)
    g.strokeStyle = '#ffffff'
    g.lineWidth = 5
    g.strokeRect(16, 16, W - 32, H - 32)
    g.beginPath()
    g.moveTo(W / 2, 16)
    g.lineTo(W / 2, H - 16)
    g.stroke()
    g.beginPath()
    g.arc(W / 2, H / 2, 42, 0, Math.PI * 2)
    g.stroke()
    for (const side of [0, 1]) {
      const x = side ? W - 16 : 16
      const dir = side ? -1 : 1
      g.fillStyle = '#2f6fc0'
      g.fillRect(side ? x - 96 : x, H / 2 - 44, 96, 88)
      g.strokeRect(side ? x - 96 : x, H / 2 - 44, 96, 88)
      g.beginPath()
      g.arc(x + dir * 96, H / 2, 40, side ? Math.PI / 2 : -Math.PI / 2, side ? Math.PI * 1.5 : Math.PI / 2, side === 1)
      g.stroke()
      g.beginPath()
      g.arc(x, H / 2, 150, side ? Math.PI / 2 : -Math.PI / 2, side ? Math.PI * 1.5 : Math.PI / 2, side === 1)
      g.stroke()
    }
    return toTexture(c, { repeat: false })
  })
}

// Round clock face: white dial, hour ticks, two hands.
export function clockTexture() {
  return cached('clock', () => {
    const S = 128
    const c = canvas(S, S)
    const g = c.getContext('2d')
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#2a2f45'
    g.lineWidth = 5
    g.stroke()
    g.lineCap = 'round'
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      g.lineWidth = i % 3 ? 3 : 6
      g.beginPath()
      g.moveTo(S / 2 + Math.cos(a) * 46, S / 2 + Math.sin(a) * 46)
      g.lineTo(S / 2 + Math.cos(a) * 56, S / 2 + Math.sin(a) * 56)
      g.stroke()
    }
    g.lineWidth = 6
    g.beginPath()
    g.moveTo(S / 2, S / 2)
    g.lineTo(S / 2 + 26, S / 2 - 12)
    g.stroke()
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(S / 2, S / 2)
    g.lineTo(S / 2 - 4, S / 2 - 42)
    g.stroke()
    return toTexture(c, { repeat: false })
  })
}
