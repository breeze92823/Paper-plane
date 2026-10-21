// Touch controls (phones/tablets): a floating move stick on the left of the world, drag-to-look and
// pinch-to-zoom on the right, plus hold-to-THROW / JUMP / menu / fullscreen buttons and a "rotate your
// phone" screen in portrait. The "E Open" prompt is a tappable button already (eggUi.js). Everything
// feeds inputState, exactly like the keyboard and mouse do, so the rest of the game does not know the
// difference. While a window is open (body.win-open) the action buttons step aside.
import { inputState } from './input.js'
import { isTouch } from './device.js'
import { FONT } from './hud.js'

const STICK_R = 56 // px of travel for full speed
const DEAD = 0.12
const LOOK_GAIN = 1.5 // finger travel is shorter than a mouse sweep
const PINCH_GAIN = 0.03 // zoom notches per px of pinch
const SPLIT = 0.45 // fraction of the width: left of it is the stick, right of it looks
// The windows that take the whole screen (Pets, hatch, Rebirth, Items, Daily). The egg window is
// left out: it stays open while the player walks, and closes when they walk away.
const MODALS = '.hud :is(.pm,.hz,.rb,.iw,.dw):not([hidden])'

// Real px, kept clear of notches by the safe-area insets.
const STYLE = `
html.touch,html.touch body{-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;overscroll-behavior:none}
html.touch canvas{touch-action:none}
.tc{--pad:18px;position:fixed;inset:0;z-index:6;pointer-events:none;touch-action:none;font-family:${FONT}}
body.win-open .tc>:not(.tc-rotate):not(.tc-menu):not(.tc-full){display:none}
.tc-btn{position:absolute;display:grid;place-items:center;pointer-events:auto;touch-action:none;border:4px solid #0b1d3f;border-radius:50%;
  color:#fff;padding:0;font:inherit;font-weight:700;background:rgba(15,23,42,.6);
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.25),0 4px 0 rgba(0,0,0,.3);transition:transform .06s ease,background .1s}
.tc-btn svg{width:55%;height:55%;display:block}
.tc-btn.on{transform:scale(.92);background:rgba(255,210,26,.85)}
html.can-throw .tc-throw:not(.on){animation:tc-ready .8s ease-in-out infinite alternate;background:rgba(63,207,42,.95)}
@keyframes tc-ready{to{transform:scale(1.08)}}
.tc-throw{right:calc(var(--pad) + env(safe-area-inset-right));bottom:calc(var(--pad) + env(safe-area-inset-bottom));width:96px;height:96px;
  border-color:#0d3a12;background:rgba(63,207,42,.78)}
.tc-throw svg{width:46%;height:46%;margin-top:-4px}
.tc-throw span{position:absolute;bottom:13px;font-size:15px;letter-spacing:.5px;-webkit-text-stroke:3px #0d3a12;paint-order:stroke fill}
.tc-jump{right:calc(var(--pad) + 108px + env(safe-area-inset-right));bottom:calc(var(--pad) + env(safe-area-inset-bottom));width:68px;height:68px}
.tc-menu,.tc-full{top:calc(10px + env(safe-area-inset-top));width:44px;height:44px;border-width:3px}
.tc-menu{right:calc(10px + env(safe-area-inset-right))}
.tc-full{right:calc(62px + env(safe-area-inset-right))}
.tc-full[hidden]{display:none}

/* Floating stick: rests faintly bottom-left, then jumps under the thumb. */
.tc-stick{position:absolute;left:var(--x,calc(90px + env(safe-area-inset-left)));top:var(--y,calc(100% - 90px - env(safe-area-inset-bottom)));
  width:124px;height:124px;margin:-62px 0 0 -62px;border-radius:50%;border:4px solid rgba(255,255,255,.55);background:rgba(20,20,24,.3);transition:opacity .15s}
.tc-stick.idle{opacity:.3}
.tc-knob{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(255,255,255,.8);border:4px solid #0b1d3f}

/* Portrait: ask for landscape (the street runs across the screen). */
.tc-rotate{display:none;position:fixed;inset:0;z-index:2000;flex-direction:column;align-items:center;justify-content:center;gap:10px;
  text-align:center;color:#fff;pointer-events:auto;background:linear-gradient(#5fd7ff,#0f74f2)}
.tc-rotate div{font-size:90px;line-height:1;animation:tc-turn 2.4s ease-in-out infinite}
.tc-rotate p{margin:0;font-size:32px;font-weight:700;-webkit-text-stroke:5px #0b1d3f;paint-order:stroke fill}
.tc-rotate small{font-size:16px;opacity:.9}
@keyframes tc-turn{0%,30%{transform:rotate(0)}70%,100%{transform:rotate(-90deg)}}
@media (orientation:portrait) and (max-width:900px){.tc-rotate{display:flex}}
@media (max-height:420px){
  .tc-throw{width:82px;height:82px}
  .tc-throw span{bottom:10px;font-size:13px}
  .tc-jump{width:58px;height:58px;right:calc(var(--pad) + 94px + env(safe-area-inset-right))}
  .tc-stick{top:var(--y,calc(100% - 80px - env(safe-area-inset-bottom)))}
}
/* Key hints mean nothing without a keyboard. */
html.touch .hud .ew-acts button small,html.touch .hud .ep button b{display:none}
html.touch .hud .ep button{padding-left:calc(22 * var(--u))}
`

export function createTouchControls({ showMenu }) {
  if (!isTouch) return
  document.documentElement.classList.add('touch')

  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  const root = document.createElement('div')
  root.className = 'tc'
  root.innerHTML = `
    <div class="tc-stick idle"><div class="tc-knob"></div></div>
    <button class="tc-btn tc-menu" aria-label="Menu"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg></button>
    <button class="tc-btn tc-full" aria-label="Fullscreen" hidden><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <button class="tc-btn tc-jump" aria-label="Jump"><svg viewBox="0 0 24 24"><path d="M12 19V6M6 11l6-6 6 6" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <button class="tc-btn tc-throw" aria-label="Throw"><svg viewBox="0 0 24 24"><path d="M3 11.5 21 4l-6.5 16-3-6.5Z" fill="#fff" stroke="#0d3a12" stroke-width="2.4" stroke-linejoin="round"/><path d="M11.5 13.5 21 4" stroke="#0d3a12" stroke-width="1.8" stroke-linecap="round"/></svg><span>THROW</span></button>
    <div class="tc-rotate"><div>&#8635;</div><p>Rotate your phone</p><small>Paper Plane plays in landscape</small></div>`
  document.body.appendChild(root)
  const stick = root.querySelector('.tc-stick')
  const knob = root.querySelector('.tc-knob')

  const buzz = (ms) => navigator.vibrate?.(ms)
  const windowOpen = () => document.body.classList.contains('win-open')
  new MutationObserver(() => {
    const open = !!document.querySelector(MODALS)
    if (open !== windowOpen()) document.body.classList.toggle('win-open', open)
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] })

  // Fullscreen where the browser has it (not iPhone Safari), then try to pin landscape.
  const el = document.documentElement
  const reqFs = el.requestFullscreen ?? el.webkitRequestFullscreen
  if (reqFs) {
    const full = root.querySelector('.tc-full')
    full.hidden = false
    full.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement ?? document.webkitFullscreenElement) await (document.exitFullscreen ?? document.webkitExitFullscreen).call(document)
        else {
          await reqFs.call(el)
          await screen.orientation?.lock?.('landscape')
        }
      } catch {
        // Refused (iframe / policy): the game plays fine windowed.
      }
    })
  }
  root.querySelector('.tc-menu').addEventListener('click', () => showMenu())

  // --- Buttons ----------------------------------------------------------------
  const hold = (btn, onDown, onUp) => {
    btn.addEventListener('pointerdown', (e) => {
      btn.setPointerCapture?.(e.pointerId)
      btn.classList.add('on')
      onDown()
      buzz(8)
      e.preventDefault()
      e.stopPropagation()
    })
    const end = () => {
      btn.classList.remove('on')
      onUp?.()
    }
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, end)
  }
  hold(root.querySelector('.tc-jump'), () => (inputState.jump = true))
  // Held down, it keeps throwing as each plane comes back into the hand (throw.js).
  hold(
    root.querySelector('.tc-throw'),
    () => (inputState.action = inputState.actionPressed = true),
    () => (inputState.action = false),
  )

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
    stick.style.removeProperty('--x')
    stick.style.removeProperty('--y')
    knob.style.transform = ''
  }
  const pinchDist = () => {
    const [a, b] = [...looks.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || e.target.tagName !== 'CANVAS' || windowOpen()) return
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
  // A window opening mid-drag must not leave the character running or throwing.
  setInterval(() => {
    if (!windowOpen()) return
    if (stickId !== null) releaseStick()
    looks.clear()
    inputState.action = false
  }, 250)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return
    releaseStick()
    looks.clear()
    inputState.action = false
  })
  // iOS pinch/double-tap page zoom ignores the viewport lock.
  for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault())
}
