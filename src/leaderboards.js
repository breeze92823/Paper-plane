// The three leaderboards behind the Egg Row (MAP.leaderboards), after Stone-Skipping's
// Leaderboards.jsx: Total Playtime, Total Rebirths and Total Wins, each a tall framed board
// on two legs with a plane-themed topper, facing the plaza. The rows come from
// Paper-plane-backend's `leaderboard` broadcast (net.js getLeaderboard): every account that
// ever saved, merged with whoever is online, top MAP.leaderboards.rows. Our own row is gold.
// With no server yet (or offline) a board shows just our own row, so it never sits empty.
// Each board is one canvas, repainted at most once a second and only when its rows change.
import { BoxGeometry, CanvasTexture, CylinderGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from 'three'
import { MAP, MATERIAL_PBR } from './config.js'
import { addCollider } from './colliders.js'
import { paperPlane, part, solid } from './props.js'
import { SIGN_FONT } from './textures.js'
import { getLeaderboard, getSelfId } from './net.js'
import { getDisplayName } from './bloxity.js'
import { formatNumber } from './hud.js'
import { game } from './store.js'

const L = MAP.leaderboards
const POLL_S = 1 // how often a board checks its rows
const CANVAS_W = 512
const CANVAS_H = Math.round((CANVAS_W * L.h) / L.w)
const TITLE_H = 84
const LEGS_Y0 = 0.5 // top of the base slab

function formatDuration(seconds) {
  const s = Math.floor(Math.max(0, seconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

const formatValue = (stat, value) => (stat === 'playTime' ? formatDuration(value) : formatNumber(Math.max(0, Number(value) || 0)))

// The server's rows, or (before its first broadcast / offline) just our own: Rebirths and
// Wins from the store, Playtime as this visit so far.
function boardRows(stat) {
  const rows = getLeaderboard(stat)
  if (rows.length) return rows.slice(0, L.rows)
  const value = stat === 'playTime' ? performance.now() / 1000 : game[stat]
  return [{ id: 'self', name: getDisplayName() || 'You', value }]
}

// A steady colour per name for the initial-letter avatar.
function nameHue(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

const MEDALS = ['#ffd23a', '#dfe6ee', '#e8995a']

function drawBoard(canvas, board, rows, selfId) {
  const ctx = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, board.dark)
  grad.addColorStop(1, '#0b1020')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Title band.
  ctx.fillStyle = board.color
  ctx.fillRect(0, 0, W, TITLE_H)
  ctx.fillStyle = 'rgba(0,0,0,.18)'
  ctx.fillRect(0, TITLE_H - 8, W, 8)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.font = `700 46px ${SIGN_FONT}`
  ctx.lineJoin = 'round'
  ctx.lineWidth = 9
  ctx.strokeStyle = 'rgba(10,14,30,.85)'
  const title = `${board.icon} ${board.title}`
  ctx.strokeText(title, W / 2, TITLE_H / 2)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(title, W / 2, TITLE_H / 2)

  const top = TITLE_H + 10
  const rowH = (H - top - 10) / L.rows
  for (let i = 0; i < L.rows; i++) {
    const y = top + i * rowH
    const row = rows[i]
    const self = row && (row.id === selfId || row.id === 'self')
    roundRect(ctx, 10, y + 3, W - 20, rowH - 6, 10)
    ctx.fillStyle = self ? 'rgba(255,210,58,.35)' : i % 2 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.13)'
    ctx.fill()
    if (self) {
      ctx.lineWidth = 3
      ctx.strokeStyle = '#ffd84a'
      ctx.stroke()
    }
    if (!row) continue
    const cy = y + rowH / 2

    // Rank: a medal for the top three.
    ctx.font = `700 26px ${SIGN_FONT}`
    if (i < 3) {
      ctx.beginPath()
      ctx.arc(36, cy, 17, 0, Math.PI * 2)
      ctx.fillStyle = MEDALS[i]
      ctx.fill()
      ctx.fillStyle = '#3a2a00'
    } else {
      ctx.fillStyle = '#c9d6ea'
    }
    ctx.textAlign = 'center'
    ctx.fillText(String(i + 1), 36, cy + 1)

    // Avatar: the name's initial on a colour of its own.
    const name = row.name || 'Player'
    ctx.beginPath()
    ctx.arc(84, cy, 19, 0, Math.PI * 2)
    ctx.fillStyle = `hsl(${nameHue(name)} 65% 55%)`
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 22px ${SIGN_FONT}`
    ctx.fillText(name.charAt(0).toUpperCase(), 84, cy + 1)

    // Name, clipped clear of the value column; the value in the board's colour.
    ctx.textAlign = 'left'
    ctx.font = `700 25px ${SIGN_FONT}`
    ctx.fillStyle = self ? '#fff3b0' : '#ffffff'
    ctx.save()
    ctx.beginPath()
    ctx.rect(112, y, W - 112 - 150, rowH)
    ctx.clip()
    ctx.fillText(name, 112, cy + 1)
    ctx.restore()
    ctx.textAlign = 'right'
    ctx.fillStyle = board.color
    ctx.fillText(formatValue(board.stat, row.value), W - 24, cy + 1)
  }
}

// Plane-themed decorations above each board, in its colour; `spin` is animated.
function topper(kind, color) {
  const g = new Group()
  const white = solid('#ffffff')
  const tint = solid(color)
  let spin = null
  if (kind === 'propeller') {
    // A little prop plane seen head-on: wing, nose and a spinning propeller.
    g.add(part(new BoxGeometry(4, 0.3, 0.9), tint, 0, 0.9, 0))
    g.add(part(new CylinderGeometry(0.45, 0.55, 1.4, 12).rotateX(Math.PI / 2), white, 0, 0.9, 0.2))
    spin = new Group()
    spin.position.set(0, 0.9, 0.95)
    spin.add(part(new BoxGeometry(2.4, 0.28, 0.08), solid('#22303f')))
    spin.add(part(new BoxGeometry(0.28, 2.4, 0.08), solid('#22303f')))
    g.add(spin)
    g.add(part(new BoxGeometry(0.25, 0.9, 0.25), solid('#22303f'), 0, 0.3, 0))
  } else if (kind === 'badge') {
    // A round badge with a plane on it, between two white wings.
    g.add(part(new CylinderGeometry(1.1, 1.1, 0.3, 28).rotateX(Math.PI / 2), tint, 0, 1.15, 0))
    g.add(part(new CylinderGeometry(0.85, 0.85, 0.34, 28).rotateX(Math.PI / 2), white, 0, 1.15, 0))
    const emblem = paperPlane(color)
    emblem.scale.setScalar(0.42)
    emblem.rotation.set(Math.PI / 2, 0, 0) // nose up, flat on the badge
    emblem.position.set(0, 1.15, 0.25)
    g.add(emblem)
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const feather = part(new BoxGeometry(1.6 - i * 0.35, 0.32, 0.18), white, sx * (1.7 + i * 0.1), 1.45 - i * 0.38, 0)
        feather.rotation.z = sx * (0.25 + i * 0.12)
        g.add(feather)
      }
    }
  } else {
    // A big paper plane gliding over the board.
    spin = paperPlane('#ffffff')
    spin.scale.setScalar(1.25)
    spin.position.set(0, 1.4, 0)
    spin.rotation.set(-0.15, Math.PI, 0.25)
    g.add(spin)
  }
  return { group: g, spin, kind }
}

// One board: base slab, two legs, the coloured frame, the canvas panel and its topper,
// built facing -Z (toward the plaza) at the board's x on the row.
function buildBoard(board) {
  const g = new Group()
  g.position.set(board.x, 0, L.z)
  const dark = solid('#1f2738')
  const frame = solid(board.color)
  g.add(part(new BoxGeometry(L.w + 1.6, LEGS_Y0, 2.4), dark, 0, LEGS_Y0 / 2, 0))
  g.add(part(new BoxGeometry(L.w + 1.9, 0.18, 2.7), frame, 0, 0.09, 0))
  for (const sx of [-1, 1]) g.add(part(new BoxGeometry(0.5, L.y - LEGS_Y0 + 0.4, 0.5), dark, sx * (L.w / 2 - 0.6), LEGS_Y0 + (L.y - LEGS_Y0) / 2, 0.15))
  const cy = L.y + L.h / 2
  g.add(part(new BoxGeometry(L.w + 0.6, L.h + 0.6, 0.45), frame, 0, cy, 0.15))

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  // Lit like the rest, plus a glow so it stays readable in the cliff's shade.
  const face = new MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: 0.55, ...MATERIAL_PBR.PROP })
  const panel = new Mesh(new PlaneGeometry(L.w, L.h), face)
  panel.rotation.y = Math.PI // face -Z
  panel.position.set(0, cy, -0.09)
  g.add(panel)

  const top = topper(board.topper, board.color)
  top.group.position.set(0, L.y + L.h + 0.3, 0.15)
  top.group.rotation.y = Math.PI
  g.add(top.group)

  addCollider(board.x, L.z, L.w + 1.6, 2.4, LEGS_Y0)
  for (const sx of [-1, 1]) addCollider(board.x + sx * (L.w / 2 - 0.6), L.z + 0.15, 0.6, 0.6, L.y + L.h)

  let key = ''
  const redraw = (force = false) => {
    const rows = boardRows(board.stat)
    const selfId = getSelfId()
    const next = `${selfId}|${rows.map((r) => `${r.id}:${r.name}:${board.stat === 'playTime' ? Math.floor(r.value) : r.value}`).join('|')}`
    if (next === key && !force) return
    key = next
    drawBoard(canvas, board, rows, selfId)
    texture.needsUpdate = true
  }
  return { group: g, top, redraw }
}

export function createLeaderboards() {
  const root = new Group()
  root.name = 'leaderboards'
  const boards = L.boards.map(buildBoard)
  for (const b of boards) root.add(b.group)
  for (const b of boards) b.redraw(true)
  // The sign font arrives late: repaint once it has.
  document.fonts?.load(`700 46px ${SIGN_FONT}`).then(() => boards.forEach((b) => b.redraw(true)), () => {})

  let poll = 0
  return {
    root,
    update(t, dt) {
      for (const { top } of boards) {
        if (top.kind === 'propeller') top.spin.rotation.z = t * 9
        else if (top.kind === 'plane') top.spin.position.y = 1.4 + Math.sin(t * 1.6) * 0.25
      }
      poll -= dt
      if (poll > 0) return
      poll = POLL_S
      for (const b of boards) b.redraw()
    },
  }
}
