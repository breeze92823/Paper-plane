// The Daily Rewards window and its Daily tile (left menu, beside Items), after the reference
// game's DAILY REWARDS screen: the world blurs and the rest of the HUD steps aside, and a
// dark panel opens with a big title, a red X, six orange day cards (Day N, what it is, its
// picture and amount, then Claim! / a countdown to the next day / LOCKED / CLAIMED), and a
// tall rainbow Day 7. The calendar itself is daily.js; this only draws it and sends clicks.
// Also: a countdown on the HUD's x2 Power / x2 Wins buttons while a daily potion runs.
// Plain DOM in the HUD root (the pictures are itemArt.js's), sized by its own unit so the
// whole panel fits narrow screens too.
import { EGG_SHOP } from './config.js'
import { eggArt, ensureArtDefs, potionArt } from './itemArt.js'
import { FONT, outline, u } from './hud.js'
import { anyReady, calendar, claim, subscribeDaily } from './daily.js'
import { boostLeft, subscribe } from './store.js'
import { sfx } from './sfx.js'

const T = 't' // hud.js's outlined-text class
const du = (n) => `calc(${n} * var(--du))`

const STYLE = `
/* Everything else steps aside, except what a claim pops up over it: the popup and the egg hatch. */
.hud.dw-open > :not(.dw):not(svg):not(.zonepop):not(.hz){visibility:hidden}
.hud.dw-open .zonepop{z-index:13}
.hud .dw{--du:min(var(--u), calc(100vw / 900), calc(100vh / 690));position:absolute;inset:0;z-index:11;pointer-events:auto;
  font-family:${FONT};backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);background:rgba(0,0,0,.06)}
.hud .dw[hidden]{display:none}
.hud .dw-panel{position:absolute;left:50%;top:50%;width:${du(834)};height:${du(578)};transform:translate(-50%, calc(-50% + ${du(18)}));
  box-sizing:border-box;padding:${du(58)} ${du(16)} ${du(16)};border:${du(5)} solid #141414;background:rgba(16,16,18,.82)}
/* Title: an outlined copy behind a gradient-filled copy (a gradient fill can't carry its own outline). */
.hud .dw-title{position:absolute;left:${du(60)};top:${du(-38)};font-size:${du(66)};line-height:1;letter-spacing:${du(1)};
  white-space:nowrap;pointer-events:none}
.hud .dw-title .o{color:#2a1c18;${outline(5, '#2a1c18')}}
.hud .dw-title .g{position:absolute;inset:0;background:linear-gradient(180deg,#ffffff 20%,#ffe9d6 55%,#ffc89a 92%);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.hud .dw-close{position:absolute;right:${du(-34)};top:${du(-34)};width:${du(92)};height:${du(92)};box-sizing:border-box;
  border:${du(5)} solid #1a0406;background:linear-gradient(#ff2a2a,#d70f18);box-shadow:inset 0 0 0 ${du(3)} rgba(255,255,255,.35);
  font-size:${du(74)};line-height:1;display:flex;align-items:center;justify-content:center}
.hud .dw-grid{display:grid;height:100%;grid-template-columns:repeat(3,1fr) 1.5fr;grid-template-rows:1fr 1fr;gap:${du(14)} ${du(12)}}

/* Day cards */
.hud .dc{position:relative;display:flex;flex-direction:column;align-items:center;min-width:0;box-sizing:border-box;
  border:${du(4)} solid #3d1d00;background:linear-gradient(#ffc61f,#ff9a06);box-shadow:inset 0 ${du(-7)} 0 rgba(0,0,0,.12)}
.hud .dc.done{filter:saturate(.55) brightness(.78)}
.hud .dc-day{width:100%;height:${du(48)};flex:none;display:flex;align-items:center;justify-content:center;font-size:${du(40)};
  background:repeating-linear-gradient(115deg,rgba(255,255,255,.2) 0 ${du(12)},transparent ${du(12)} ${du(26)}),linear-gradient(#ffdc55,#ffb51c);
  border-bottom:${du(3)} solid rgba(120,60,0,.25)}
.hud .dc-name{margin-top:${du(4)};font-size:${du(27)};white-space:nowrap}
.hud .dc-art{position:relative;flex:1;min-height:0;width:${du(118)};display:flex;align-items:center;justify-content:center}
.hud .dc-art svg{width:${du(96)};height:${du(96)};overflow:visible;filter:drop-shadow(0 ${du(4)} ${du(2)} rgba(0,0,0,.25))}
.hud .dc-art .emoji{font-size:${du(78)};line-height:1;filter:drop-shadow(0 ${du(4)} ${du(2)} rgba(0,0,0,.3))}
.hud .dc-qty{position:absolute;right:${du(-14)};bottom:${du(2)};font-size:${du(40)};color:#fff4c4}
.hud .dc-act{flex:none;margin:${du(4)} 0 ${du(9)};width:calc(100% - ${du(14)});height:${du(42)};box-sizing:border-box;
  border:${du(3)} solid #1b1b1b;display:flex;align-items:center;justify-content:center;font-size:${du(26)};
  background:linear-gradient(#c4cad2,#8f97a2);box-shadow:inset 0 ${du(3)} 0 rgba(255,255,255,.35);pointer-events:none}
.hud .dc-act.ready{background:linear-gradient(#9dff52,#2fd016);pointer-events:auto;cursor:pointer;animation:dc-ready .9s ease-in-out infinite alternate}
.hud .dc-act.ready:hover{filter:brightness(1.1)}
.hud .dc-act.claimed{background:linear-gradient(#7fe0ff,#2a9fd6)}
@keyframes dc-ready{to{transform:scale(1.05)}}

/* Day 7 */
.hud .dc.d7{grid-column:4;grid-row:1 / span 2;
  background:linear-gradient(160deg,#ff4fa0 0%,#ff7a2e 18%,#ffd83a 34%,#5be36a 50%,#3fb8ff 66%,#8f6cff 82%,#ff4fd8 100%)}
.hud .dc.d7 .dc-day{height:${du(84)};font-size:${du(66)};
  background:linear-gradient(90deg,#ff3b5c,#ff9f1c,#ffe23d,#4ce35a,#38b6ff,#9b5cff,#ff4fd8);border-bottom-color:rgba(0,0,0,.2)}
.hud .dc.d7 .dc-art{width:100%}
.hud .dc.d7 .dc-art svg{width:${du(220)};height:${du(220)}}
.hud .dc.d7 .dc-name{order:3;margin:0 0 ${du(10)};font-size:${du(44)}}
.hud .dc.d7 .dc-qty{display:none}
.hud .dc.d7 .dc-act{order:4;width:calc(100% - ${du(40)});height:${du(64)};font-size:${du(42)};margin-bottom:${du(14)}}

/* The Daily tile in the left menu (hud.js .tile), gold-rimmed; its icon pulses and a "!" shows
   while a reward waits (.ready, as the Rebirth tile does). */
.hud .tile.daily{background:linear-gradient(#ffb23d,#e0661a);box-shadow:inset 0 0 0 ${u(2.5)} rgba(255,236,180,.75)}
.hud .tile.daily svg{overflow:visible}

/* x2 boost countdowns on the HUD's x2 Power / x2 Wins buttons. */
.hud .boost2.on{box-shadow:0 0 0 ${u(4)} #5cff3d,0 0 ${u(18)} #5cff3d}
.hud .dw-boost{position:absolute;right:${u(-8)};top:${u(-16)};padding:${u(2)} ${u(8)};border:${u(2.5)} solid #0d3a12;border-radius:${u(10)};
  background:#2fd016;font-size:${u(22)}}
.hud .dw-boost[hidden]{display:none}
`

function art(info) {
  if (info.icon === 'winsPotion') return potionArt('wins')
  if (info.icon === 'powerPotion') return potionArt('power')
  if (info.icon === 'pet') {
    const pet = EGG_SHOP[info.reward.egg]?.pets.find((p) => p.name === info.reward.name)
    return `<span class="emoji">${pet?.emoji ?? '🐾'}</span>`
  }
  return eggArt(info.reward.egg)
}

// The calendar button's icon: a red-topped calendar with gold stars.
const CAL_ICON = `<svg viewBox="0 0 64 64">
  <rect x="6" y="10" width="52" height="48" rx="7" fill="#ffffff" stroke="#1b1b1b" stroke-width="3.5"/>
  <path d="M6 17 a7 7 0 0 1 7 -7 h38 a7 7 0 0 1 7 7 v9 H6 Z" fill="#ff3b3b" stroke="#1b1b1b" stroke-width="3.5" stroke-linejoin="round"/>
  <rect x="16" y="4" width="6" height="12" rx="3" fill="#ffd23f" stroke="#1b1b1b" stroke-width="2.5"/>
  <rect x="42" y="4" width="6" height="12" rx="3" fill="#ffd23f" stroke="#1b1b1b" stroke-width="2.5"/>
  <path d="M32 31 l3.4 7 7.6 1 -5.5 5.3 1.3 7.6 -6.8 -3.6 -6.8 3.6 1.3 -7.6 -5.5 -5.3 7.6 -1 z" fill="#ffd23f" stroke="#b07800" stroke-width="2" stroke-linejoin="round"/>
</svg>`

const el = (html) => {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild
}
const two = (n) => String(n).padStart(2, '0')
const clock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`
}
const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${two(s % 60)}`
}

// Builds the window, its button and the boost countdowns into the HUD root. Returns { toggle() }.
export function createDailyUi(root) {
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  // --- Daily tile ----------------------------------------------------------------------
  const button = el(`<button class="tile daily" aria-label="Daily Rewards">${CAL_ICON}<span class="name ${T}">Daily</span><span class="badge ${T}" hidden>!</span></button>`)
  const badge = button.querySelector('.badge')
  button.addEventListener('click', () => toggle())
  ;(root.querySelector('.menu') ?? root).appendChild(button)

  // --- Window ------------------------------------------------------------------------
  const days = calendar()
  ensureArtDefs(root)
  const win = el(`<div class="dw" hidden><div class="dw-panel" role="dialog" aria-label="Daily Rewards">
    <div class="dw-title"><span class="o">DAILY REWARDS</span><span class="g">DAILY REWARDS</span></div>
    <button class="dw-close ${T}" aria-label="Close">X</button>
    <div class="dw-grid">${days
      .map(
        ({ day, info }) => `<div class="dc${day === days.length ? ' d7' : ''}" data-day="${day}">
          <div class="dc-day ${T}">Day ${day}</div>
          <div class="dc-name ${T}">${info.label}</div>
          <div class="dc-art">${art(info)}<span class="dc-qty ${T}">${info.amount}</span></div>
          <button class="dc-act ${T}" data-claim="${day}"></button>
        </div>`,
      )
      .join('')}</div>
  </div></div>`)
  const cards = [...win.querySelectorAll('.dc')]
  win.querySelector('.dw-close').addEventListener('click', () => toggle(false))
  win.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-claim]')
    if (btn) claim(Number(btn.dataset.claim))
  })
  root.appendChild(win)

  function render() {
    for (const { day, status, left, pending } of calendar()) {
      const card = cards[day - 1]
      const act = card.querySelector('.dc-act')
      const shown = pending ? 'pending' : status
      if (act.dataset.status !== shown) {
        act.dataset.status = shown
        act.className = `dc-act ${T} ${shown}`
        card.classList.toggle('done', status === 'claimed')
      }
      const text = pending ? '…' : status === 'ready' ? 'Claim!' : status === 'claimed' ? 'CLAIMED' : status === 'next' ? clock(left) : 'LOCKED'
      if (act.textContent !== text) act.textContent = text
    }
  }

  function toggle(open = win.hidden) {
    if (open === win.hidden) (open ? sfx.open : sfx.close)()
    win.hidden = !open
    root.classList.toggle('dw-open', open)
    if (open) render()
  }

  // --- x2 boost countdowns ---------------------------------------------------------------
  const boosts = ['power', 'wins'].map((stat) => {
    const host = root.querySelector(`.boost2[data-act="x2${stat === 'power' ? 'Power' : 'Wins'}"]`)
    const tag = el(`<span class="dw-boost ${T}" hidden></span>`)
    host?.appendChild(tag)
    return { stat, host, tag }
  })
  function renderBoosts() {
    for (const { stat, host, tag } of boosts) {
      const left = boostLeft(stat)
      tag.hidden = left <= 0
      host?.classList.toggle('on', left > 0)
      if (left > 0) tag.textContent = mmss(left)
    }
  }

  // The countdowns tick; anything else redraws when the calendar or the store changes.
  const tick = () => {
    const ready = anyReady()
    badge.hidden = !ready
    button.classList.toggle('ready', ready)
    if (!win.hidden) render()
    renderBoosts()
  }
  subscribeDaily(tick)
  subscribe(renderBoosts)
  setInterval(tick, 250)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && !win.hidden) toggle(false)
  })
  tick()

  return { toggle }
}
