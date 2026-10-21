// Touch controls (phones/tablets): a floating move stick on the left of the world, drag-to-look and
// pinch-to-zoom on the right, plus THROW and JUMP buttons (the HUD has the menu). Everything feeds inputState,
// exactly like the keyboard and mouse do, so the rest of the game does not know the difference.
import { inputState } from './input.js'
import { isTouch } from './device.js'

const STICK_R = 56 // px of travel for full speed
const DEAD = 0.12
const LOOK_GAIN = 1.5 // finger travel is shorter than a mouse sweep
const PINCH_GAIN = 0.03 // zoom notches per px of pinch
const SPLIT = 0.45 // fraction of the width: left of it is the stick, right of it looks

const STYLE = `
.tc-stick{position:fixed;left:var(--x,0);top:var(--y,0);width:112px;height:112px;margin:-56px 0 0 -56px;border-radius:50%;
  background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.5);pointer-events:none;z-index:5}
.tc-stick.idle{display:none}
.tc-knob{position:absolute;left:36px;top:36px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.7)}
.tc-btn{position:fixed;z-index:6;width:64px;height:64px;border-radius:50%;border:2px solid rgba(255,255,255,.6);
  background:rgba(0,0,0,.35);touch-action:none;-webkit-tap-highlight-color:transparent}
.tc-btn.on{background:rgba(255,255,255,.35)}
.tc-btn svg{width:28px;height:28px}
.tc-jump{right:24px;bottom:24px}
.tc-throw{right:100px;bottom:20px;width:76px;height:76px}
.tc-throw svg{width:36px;height:36px}
`

export function createTouchControls() {
  if (!isTouch) return

  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  const root = document.createElement('div')
  root.innerHTML = `
    <div class="tc-stick idle"><div class="tc-knob"></div></div>
    <button class="tc-btn tc-jump" aria-label="Jump"><svg viewBox="0 0 24 24"><path d="M12 19V6M6 11l6-6 6 6" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <button class="tc-btn tc-throw" aria-label="Throw"><svg viewBox="0 0 24 24"><path d="M3 11.5 21 4l-6.5 16-3-6.5Z M11.5 13.5 21 4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></button>`
  document.body.appendChild(root)
  const stick = root.querySelector('.tc-stick')
  const knob = root.querySelector('.tc-knob')

  const jump = root.querySelector('.tc-jump')
  jump.addEventListener('pointerdown', (e) => {
    jump.classList.add('on')
    inputState.jump = true
    navigator.vibrate?.(8)
    e.preventDefault()
    e.stopPropagation()
  })
  const jumpEnd = () => jump.classList.remove('on')
  jump.addEventListener('pointerup', jumpEnd)
  jump.addEventListener('pointercancel', jumpEnd)

  // Held down, it keeps throwing as each plane comes back into the hand (throw.js).
  const toss = root.querySelector('.tc-throw')
  toss.addEventListener('pointerdown', (e) => {
    toss.classList.add('on')
    inputState.action = inputState.actionPressed = true
    navigator.vibrate?.(8)
    e.preventDefault()
    e.stopPropagation()
  })
  const tossEnd = () => {
    toss.classList.remove('on')
    inputState.action = false
  }
  toss.addEventListener('pointerup', tossEnd)
  toss.addEventListener('pointercancel', tossEnd)

  // --- World touches: left = stick, right = look / pinch ------------------------------
  let stickId = null
  const sc = { x: 0, y: 0 } // stick centre
  const looks = new Map() // pointerId -> { x, y, d } (d = last pinch distance)

  const showStick = (x, y) => {
    stick.classList.remove('idle')
    stick.style.setProperty('--x', `${x}px`)
    stick.style.setProperty('--y', `${y}px`)
  }
  const releaseStick = () => {
    stickId = null
    inputState.move.x = 0
    inputState.move.z = 0
    stick.classList.add('idle')
    knob.style.transform = ''
  }
  const pinchDist = () => {
    const [a, b] = [...looks.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || e.target.tagName !== 'CANVAS') return
    if (e.clientX < window.innerWidth * SPLIT) {
      if (stickId !== null) return
      stickId = e.pointerId
      sc.x = e.clientX
      sc.y = e.clientY
      knob.style.transform = ''
      showStick(sc.x, sc.y)
    } else if (looks.size < 2) {
      looks.set(e.pointerId, { x: e.clientX, y: e.clientY, d: 0 })
      if (looks.size === 2) {
        const d = pinchDist()
        looks.forEach((v) => (v.d = d))
      }
    }
  })
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch') return
    if (e.pointerId === stickId) {
      let dx = e.clientX - sc.x
      let dy = e.clientY - sc.y
      const len = Math.hypot(dx, dy)
      if (len > STICK_R) {
        // Drag the base along so a long swipe never leaves the stick behind the thumb.
        sc.x += (dx / len) * (len - STICK_R)
        sc.y += (dy / len) * (len - STICK_R)
        showStick(sc.x, sc.y)
        dx = (dx / len) * STICK_R
        dy = (dy / len) * STICK_R
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`
      const m = Math.min(1, Math.hypot(dx, dy) / STICK_R)
      const live = m < DEAD ? 0 : (m - DEAD) / (1 - DEAD)
      const a = Math.atan2(dy, dx)
      inputState.move.x = Math.cos(a) * live
      inputState.move.z = -Math.sin(a) * live
      return
    }
    const l = looks.get(e.pointerId)
    if (!l) return
    if (looks.size === 2) {
      l.x = e.clientX
      l.y = e.clientY
      const d = pinchDist()
      inputState.zoom += (l.d - d) * PINCH_GAIN
      looks.forEach((v) => (v.d = d))
    } else {
      inputState.look.dx += (e.clientX - l.x) * LOOK_GAIN
      inputState.look.dy += (e.clientY - l.y) * LOOK_GAIN
      l.x = e.clientX
      l.y = e.clientY
    }
  })
  const lift = (e) => {
    if (e.pointerType !== 'touch') return
    if (e.pointerId === stickId) releaseStick()
    looks.delete(e.pointerId)
  }
  window.addEventListener('pointerup', lift)
  window.addEventListener('pointercancel', lift)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return
    releaseStick()
    looks.clear()
  })
  // iOS pinch/double-tap page zoom ignores the viewport lock.
  for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault())
}
