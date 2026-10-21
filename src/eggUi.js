// Egg and pet screens, after Chop-trees-for-treasure's EggMenu / HatchOverlay / PetsMenu,
// as plain DOM inside the HUD (same scale unit and lettering as hud.js):
//  - the "E Open <egg>" prompt near an egg (eggs.js eggState.near); click works too;
//  - the egg window (eggState.open): price, what you have, each pet's odds and power, and
//    Open 1 / Open 3 / Auto (E / R / T);
//  - the hatch animation (eggState.hatch): eggs shake harder, flash, and the pet cards pop
//    out (rays behind Rare and up, NEW! for a first); click skips ahead, Auto runs faster;
//  - the Pets menu (the HUD's Pets tile): owned pets strongest first, click to equip or
//    unequip, Equip Best, and a delete mode.
import { EGG_SHOP, EGGS, MAP, RARITIES, RARITY_ORDER } from './config.js'
import { FONT, formatMultiplier, formatNumber, outline, u } from './hud.js'
import { closeEgg, eggMessage, eggState, openEgg, spotPrompt, subscribeEggs } from './eggs.js'
import { finishHatch, toggleAuto, tryHatch } from './hatch.js'
import { petInfo, petMultiplier, petSlots, sortedPets } from './pets.js'
import { deletePet, equipBest, game, subscribe, toggleEquip } from './store.js'
import { sfx } from './sfx.js'

const T = 't' // hud.js's outlined-text class
// Class names here avoid hud.js's own unscoped ones (.auto, .power, .tile, .bar ...), which
// would otherwise restyle these.

// Shell colours of each egg, from its stand (MAP.eggs), for the window icon and hatch egg.
const EGG_LOOK = Object.fromEntries([
  ...MAP.eggs.map((e) => [e.name.toLowerCase(), { color: e.color, spot: e.spot }]),
  ['demon', { color: '#3a0a12', spot: '#ff4a1a' }],
])

const STYLE = `
/* Centred by a wrapper: hud.js scales buttons on press, which would drop a translate. */
.hud .ep,.hud .hz-stopwrap{position:absolute;left:50%;transform:translateX(-50%)}
.hud .ep{bottom:${u(250)}}
.hud .hz-stopwrap{bottom:${u(80)}}
.hud .ep button{display:flex;align-items:center;gap:${u(14)};
  padding:${u(10)} ${u(22)} ${u(10)} ${u(10)};border:${u(3)} solid #111;border-radius:${u(14)};background:rgba(15,23,42,.85);font-size:${u(32)}}
.hud .ep button b{display:inline-flex;align-items:center;justify-content:center;width:${u(46)};height:${u(46)};border-radius:${u(9)};
  background:#fff;color:#111;font-size:${u(30)};box-shadow:0 ${u(4)} 0 #9aa0ad}
.hud .ep[hidden],.hud .ew[hidden],.hud .hz[hidden],.hud .pm[hidden]{display:none}
.hud .eggicon{display:inline-block;width:${u(46)};height:${u(58)};border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;
  background:radial-gradient(circle at 30% 30%,var(--b) 0 12%,transparent 13%),radial-gradient(circle at 70% 55%,var(--b) 0 10%,transparent 11%),
  radial-gradient(circle at 40% 78%,var(--b) 0 9%,transparent 10%),var(--a);border:${u(3)} solid #111}

/* Egg window */
.hud .ew{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${u(620)};max-width:94vw;pointer-events:auto}
.hud .ew-body{display:flex;flex-direction:column;align-items:center;gap:${u(16)};padding:${u(26)} ${u(26)} ${u(24)};
  border:${u(3)} solid #111;border-radius:${u(14)};background:rgba(15,23,42,.9)}
.hud .ew-title{display:flex;align-items:center;gap:${u(14)};font-size:${u(50)}}
.hud .ew-close,.hud .pm-close{position:absolute;top:${u(-18)};right:${u(-12)};width:${u(52)};height:${u(52)};
  border:${u(3)} solid #111 !important;border-radius:${u(9)};background:#dc2626;font-size:${u(28)};box-shadow:0 ${u(4)} 0 rgba(0,0,0,.4)}
.hud .ew-price{font-size:${u(44)};color:#ffd84a}
.hud .ew-price.gems{color:#4be36a}
.hud .ew-have{font-size:${u(24)};color:#d8dcf0}
.hud .ew-have .ok{color:#5cff3d}.hud .ew-have .no{color:#ff5a4a}
.hud .ew-pets{display:grid;grid-template-columns:repeat(3,${u(160)});gap:${u(12)}}
.hud .ew-pets.one{grid-template-columns:${u(200)}}
.hud .ew-pet,.hud .pm-pet{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${u(4)};
  height:${u(150)};border:${u(3)} solid #111;border-radius:${u(12)};
  background:radial-gradient(circle at 50% 35%,rgba(255,255,255,.35),transparent 60%),var(--bg)}
.hud .ew-pet .emoji,.hud .pm-pet .emoji{font-size:${u(64)};line-height:1.1}
.hud .ew-pet .chance{font-size:${u(30)}}
.hud .ew-pet .pp,.hud .pm-pet .pp{font-size:${u(22)};color:#ffe14d}
.hud .ew-pet .seen{position:absolute;top:${u(6)};left:${u(8)};font-size:${u(20)};color:#5cff3d}
.hud .ew-acts{display:flex;gap:${u(14)};align-self:stretch}
.hud .ew-acts button{flex:1;display:flex;flex-direction:column;align-items:center;gap:${u(4)};padding:${u(12)} 0;
  border:${u(3)} solid #111 !important;border-radius:${u(12)};background:var(--bg);font-size:${u(34)};box-shadow:0 ${u(4)} 0 rgba(0,0,0,.4)}
.hud .ew-acts button small{font-size:${u(20)};opacity:.85}
.hud .ew-acts button:disabled{opacity:.4;cursor:not-allowed}
.hud .ew-acts .ew-auto.on{--bg:#46cf3a !important}

/* Hatch animation */
.hud .hz{position:absolute;inset:0;z-index:12;display:flex;align-items:center;justify-content:center;gap:${u(40)};
  background:rgba(0,0,0,.55);pointer-events:auto}
.hud .hz-slot{position:relative;display:flex;flex-direction:column;align-items:center;gap:${u(8)};width:${u(260)}}
.hud .hz-egg{width:${u(170)};height:${u(215)};border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;border:${u(4)} solid #111;
  background:radial-gradient(circle at 30% 30%,var(--b) 0 10%,transparent 11%),radial-gradient(circle at 68% 50%,var(--b) 0 9%,transparent 10%),
  radial-gradient(circle at 42% 76%,var(--b) 0 8%,transparent 9%),radial-gradient(circle at 35% 25%,rgba(255,255,255,.5),transparent 40%),var(--a);
  animation:hz-shake var(--shake) ease-in forwards}
@keyframes hz-shake{0%{transform:rotate(0)}10%{transform:rotate(-4deg)}20%{transform:rotate(4deg)}30%{transform:rotate(-7deg)}40%{transform:rotate(7deg)}
  50%{transform:rotate(-11deg)}60%{transform:rotate(11deg)}70%{transform:rotate(-16deg)}80%{transform:rotate(16deg)}90%{transform:rotate(-20deg) scale(1.08)}
  100%{transform:rotate(0) scale(1.2);filter:brightness(3)}}
.hud .hz-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:${u(6)};padding:${u(20)} ${u(10)};width:100%;
  border:${u(4)} solid #111;border-radius:${u(16)};background:radial-gradient(circle at 50% 30%,rgba(255,255,255,.35),transparent 60%),var(--bg);
  animation:hz-pop .45s cubic-bezier(.2,1.6,.4,1) both}
@keyframes hz-pop{0%{transform:scale(.2);opacity:0}100%{transform:scale(1);opacity:1}}
.hud .hz-card .emoji{font-size:${u(120)};line-height:1.1}
.hud .hz-card .name{font-size:${u(38)}}
.hud .hz-card .rarity{font-size:${u(28)};color:var(--rt)}
.hud .hz-card .chance{font-size:${u(22)};color:#d8dcf0}
.hud .hz-new{position:absolute;top:${u(-22)};left:50%;transform:translateX(-50%) rotate(-6deg);font-size:${u(34)};color:#ffe14d}
.hud .hz-rays{position:absolute;inset:${u(-70)};z-index:-1;border-radius:50%;
  background:repeating-conic-gradient(rgba(255,255,255,.35) 0 10deg,transparent 10deg 24deg);animation:hz-spin 6s linear infinite;
  -webkit-mask:radial-gradient(circle,#000 30%,transparent 70%);mask:radial-gradient(circle,#000 30%,transparent 70%)}
.hud .hz-rays.gold{background:repeating-conic-gradient(rgba(255,214,60,.6) 0 10deg,transparent 10deg 24deg)}
@keyframes hz-spin{to{transform:rotate(360deg)}}
.hud .hz-flash{position:absolute;inset:0;background:#fff;pointer-events:none;animation:hz-flash .5s ease-out forwards}
@keyframes hz-flash{0%{opacity:.95}100%{opacity:0}}
.hud .hz-stop{padding:${u(12)} ${u(36)};
  border:${u(3)} solid #111 !important;border-radius:${u(12)};background:#dc2626;font-size:${u(34)};box-shadow:0 ${u(4)} 0 rgba(0,0,0,.4)}

/* Pets menu */
.hud .pm{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${u(760)};max-width:94vw;pointer-events:auto}
.hud .pm-title{position:absolute;top:${u(-30)};left:${u(18)};z-index:1;font-size:${u(48)};pointer-events:none}
.hud .pm-body{display:flex;flex-direction:column;gap:${u(14)};padding:${u(40)} ${u(24)} ${u(24)};border:${u(3)} solid #111;
  border-radius:${u(14)};background:rgba(15,23,42,.9)}
.hud .pm-top{display:flex;align-items:center;gap:${u(16)};font-size:${u(26)}}
.hud .pm-top .grow{flex:1}
.hud .pm-top .mult{color:#ffd84a}
.hud .pm-top button{padding:${u(8)} ${u(16)};border:${u(3)} solid #111 !important;border-radius:${u(10)};background:var(--bg);font-size:${u(24)};
  box-shadow:0 ${u(3)} 0 rgba(0,0,0,.4)}
.hud .pm-top button.on{--bg:#dc2626 !important}
.hud .pm-grid{display:grid;grid-template-columns:repeat(auto-fill,${u(124)});gap:${u(10)};max-height:${u(430)};overflow-y:auto;padding:${u(4)}}
.hud .pm-pet{height:${u(124)};cursor:pointer}
.hud .pm-pet .emoji{font-size:${u(52)}}
.hud .pm-pet.on{box-shadow:0 0 0 ${u(4)} #5cff3d}
.hud .pm-pet.on::after{content:'✓';position:absolute;top:${u(4)};right:${u(8)};font-size:${u(24)};color:#5cff3d}
.hud .pm.deleting .pm-pet{box-shadow:0 0 0 ${u(3)} #ff5a4a}
.hud .pm-empty{grid-column:1 / -1;padding:${u(40)};text-align:center;font-size:${u(30)};color:#d8dcf0}
`

const el = (html) => {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild
}
const pct = (n) => `${Number.isInteger(n) || n >= 10 ? Math.round(n) : +n.toFixed(1)}%`
const eggVars = (id) => `--a:${EGG_LOOK[id]?.color ?? '#fff'};--b:${EGG_LOOK[id]?.spot ?? '#ddd'}`

// Builds the egg and pet screens into the HUD root. Returns { togglePets() } for the Pets tile.
export function createEggUi(root) {
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  // --- E prompt ---------------------------------------------------------------------
  const prompt = el(`<div class="ep" hidden><button><b>E</b><span class="${T}"></span></button></div>`)
  prompt.querySelector('button').addEventListener('click', () => eggState.near && openEgg(eggState.near))
  root.appendChild(prompt)

  // --- Egg window -------------------------------------------------------------------
  const win = el(`<div class="ew" hidden><button class="ew-close ${T}" aria-label="Close">X</button><div class="ew-body"></div></div>`)
  win.querySelector('.ew-close').addEventListener('click', closeEgg)
  const winBody = win.querySelector('.ew-body')
  root.appendChild(win)
  let shownEgg = null

  function buildWindow(id) {
    const egg = EGG_SHOP[id]
    const gems = egg.currency === 'gems'
    winBody.innerHTML = `
      <div class="ew-title ${T}"><span class="eggicon" style="${eggVars(id)}"></span>${egg.name}</div>
      <div class="ew-price ${T}${gems ? ' gems' : ''}">${gems ? '⬢' : '🏆'} ${formatNumber(egg.cost)}</div>
      <div class="ew-have ${T}"></div>
      <div class="ew-pets${egg.pets.length === 1 ? ' one' : ''}">${egg.pets
        .map((p) => {
          const r = RARITIES[p.rarity]
          return `<div class="ew-pet" style="--bg:${r.bg}" title="${p.name} · ${r.label} · +x${p.power} Power" data-key="${id}:${p.name}">
            <span class="seen ${T}"></span><span class="emoji">${p.emoji}</span>
            <span class="chance ${T}">${pct(p.chance)}</span><span class="pp ${T}">+x${p.power}</span></div>`
        })
        .join('')}</div>
      <div class="ew-acts">
        <button class="${T}" style="--bg:#3a8ef0" data-n="1">Open 1<small>E</small></button>
        <button class="${T}" style="--bg:#e8303a" data-n="${EGGS.openMany}">Open ${EGGS.openMany}<small>R</small></button>
        <button class="ew-auto ${T}" style="--bg:#7a8094">Auto<small>T</small></button>
      </div>`
    for (const b of winBody.querySelectorAll('[data-n]')) b.addEventListener('click', () => tryHatch(id, Number(b.dataset.n)))
    winBody.querySelector('.ew-auto').addEventListener('click', () => toggleAuto(id))
  }

  // The parts of the window that follow the store and Auto.
  function refreshWindow() {
    const id = eggState.open
    if (!id) return
    const egg = EGG_SHOP[id]
    const have = winBody.querySelector('.ew-have')
    if (egg.currency === 'gems') {
      have.innerHTML = 'Gems are <span class="no">coming soon</span>'
    } else {
      have.innerHTML = `You have 🏆 <span class="${game.wins >= egg.cost ? 'ok' : 'no'}">${formatNumber(game.wins)}</span>`
    }
    const seen = new Set(game.discovered)
    for (const tile of winBody.querySelectorAll('.ew-pet')) tile.querySelector('.seen').textContent = seen.has(tile.dataset.key) ? '✓' : ''
    for (const b of winBody.querySelectorAll('.ew-acts button')) b.disabled = egg.currency === 'gems'
    const auto = winBody.querySelector('.ew-auto')
    auto.classList.toggle('on', eggState.auto)
    auto.firstChild.textContent = eggState.auto ? 'Auto: ON' : 'Auto'
  }

  // --- Hatch animation --------------------------------------------------------------
  const overlay = el(`<div class="hz" hidden></div>`)
  root.appendChild(overlay)
  let playing = 0 // eggState.hatch.n on screen
  let phase = null
  let shakeSound = { stop() {} }
  let timer = 0

  function revealHatch(h) {
    phase = 'reveal'
    // The shake stops where it is (a click skips ahead); the shell cracks and the chimes run
    // as long as the rarest pet deserves.
    shakeSound.stop()
    sfx.eggCrack()
    sfx.reveal(Math.max(...h.pets.map((pet) => RARITY_ORDER.indexOf(petInfo(pet).rarity))), h.pets.some((pet) => pet.isNew))
    overlay.innerHTML = h.pets
      .map((pet) => {
        const info = petInfo(pet)
        const r = RARITIES[info.rarity]
        const rank = RARITY_ORDER.indexOf(info.rarity)
        const rays = rank >= RARITY_ORDER.indexOf('rare') ? `<div class="hz-rays${rank >= RARITY_ORDER.indexOf('legendary') ? ' gold' : ''}"></div>` : ''
        return `<div class="hz-slot"><div class="hz-card" style="--bg:${r.bg};--rt:${r.text}">${rays}
          ${pet.isNew ? `<span class="hz-new ${T}">NEW!</span>` : ''}<span class="emoji">${info.emoji}</span>
          <span class="name ${T}">${info.name}</span><span class="rarity ${T}">${r.label}</span>
          <span class="chance ${T}">${pct(info.chance)}</span></div></div>`
      })
      .join('')
    overlay.appendChild(el(`<div class="hz-flash"></div>`))
    addStop()
    clearTimeout(timer)
    timer = setTimeout(endHatch, EGGS.hatchMs.reveal * speed())
  }

  function endHatch() {
    clearTimeout(timer)
    phase = null
    overlay.hidden = true
    overlay.innerHTML = ''
    finishHatch()
  }

  const speed = () => (eggState.auto ? EGGS.hatchMs.autoSpeed : 1)

  function addStop() {
    if (!eggState.auto) return
    const stop = el(`<div class="hz-stopwrap"><button class="hz-stop ${T}">Stop Auto</button></div>`)
    stop.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation()
      eggState.auto = false
      stop.remove()
    })
    overlay.appendChild(stop)
  }

  function startHatch(h) {
    playing = h.n
    phase = 'shake'
    const shake = EGGS.hatchMs.shake * speed()
    shakeSound = sfx.eggShake(shake)
    overlay.innerHTML = h.pets.map(() => `<div class="hz-slot"><div class="hz-egg" style="${eggVars(h.egg)};--shake:${shake}ms"></div></div>`).join('')
    addStop()
    overlay.hidden = false
    clearTimeout(timer)
    timer = setTimeout(() => revealHatch(h), shake)
  }

  // Click skips ahead a phase.
  overlay.addEventListener('click', () => {
    if (phase === 'shake' && eggState.hatch) revealHatch(eggState.hatch)
    else if (phase === 'reveal') endHatch()
  })

  // --- Pets menu --------------------------------------------------------------------
  const menu = el(`<div class="pm" hidden><span class="pm-title ${T}">Pets</span><button class="pm-close ${T}" aria-label="Close">X</button>
    <div class="pm-body"><div class="pm-top"></div><div class="pm-grid"></div></div></div>`)
  root.appendChild(menu)
  const menuTop = menu.querySelector('.pm-top')
  const menuGrid = menu.querySelector('.pm-grid')
  let deleting = false

  function renderMenu() {
    if (menu.hidden) return
    const equipped = new Set(game.equipped)
    menuTop.innerHTML = `
      <span class="${T}">${game.pets.length}/${EGGS.inventoryMax}</span>
      <span class="${T}">Equipped ${Math.min(game.equipped.length, petSlots(game))}/${petSlots(game)}</span>
      <span class="mult ${T}">x${formatMultiplier(petMultiplier(game))} Power</span>
      <span class="grow"></span>
      <button class="${T}" style="--bg:#46cf3a" data-pm="best">Equip Best</button>
      <button class="${T}${deleting ? ' on' : ''}" style="--bg:#7a8094" data-pm="delete">${deleting ? 'Done' : 'Delete'}</button>`
    menu.classList.toggle('deleting', deleting)
    if (!game.pets.length) {
      menuGrid.innerHTML = `<div class="pm-empty ${T}">No pets yet. Hatch an egg!</div>`
      return
    }
    menuGrid.innerHTML = sortedPets(game.pets)
      .map((pet) => {
        const info = petInfo(pet)
        const r = RARITIES[info.rarity]
        return `<div class="pm-pet${equipped.has(pet.id) ? ' on' : ''}" style="--bg:${r.bg}" data-id="${pet.id}" title="${info.name} · ${r.label}">
          <span class="emoji">${info.emoji}</span><span class="pp ${T}">+x${info.power}</span></div>`
      })
      .join('')
  }

  menu.querySelector('.pm-close').addEventListener('click', () => togglePets(false))
  menuTop.addEventListener('click', (e) => {
    const act = e.target.closest('[data-pm]')?.dataset.pm
    if (act === 'best') {
      equipBest()
      sfx.equip()
    }
    if (act === 'delete') {
      deleting = !deleting
      renderMenu()
    }
  })
  menuGrid.addEventListener('click', (e) => {
    const id = Number(e.target.closest('[data-id]')?.dataset.id)
    if (!id) return
    if (deleting) {
      deletePet(id)
      sfx.poof()
    } else if (toggleEquip(id)) (game.equipped.includes(id) ? sfx.equip : sfx.unequip)()
    else eggMessage('Slots full', `${petSlots(game)} pet${petSlots(game) === 1 ? '' : 's'} max: unequip one first`)
  })

  function togglePets(open = menu.hidden) {
    if (open === menu.hidden) (open ? sfx.open : sfx.close)()
    menu.hidden = !open
    deleting = false
    if (open) {
      document.exitPointerLock?.()
      renderMenu()
    }
  }

  // --- Wiring -----------------------------------------------------------------------
  function render() {
    const near = eggState.near
    prompt.hidden = !near || !!eggState.open
    if (near) prompt.querySelector('span').textContent = spotPrompt(near)
    if (eggState.open !== shownEgg) {
      if (eggState.open) sfx.open()
      else sfx.close()
      shownEgg = eggState.open
      if (shownEgg) buildWindow(shownEgg)
    }
    win.hidden = !eggState.open || !!eggState.hatch
    refreshWindow()
    if (eggState.hatch && eggState.hatch.n !== playing) startHatch(eggState.hatch)
  }
  subscribeEggs(render)
  subscribe(() => {
    refreshWindow()
    renderMenu()
  })

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return
    if (e.code === 'Escape') {
      if (!menu.hidden) togglePets(false)
      if (eggState.open && !eggState.hatch) closeEgg()
    }
    if (!eggState.open || eggState.hatch) return
    if (e.code === 'KeyR') tryHatch(eggState.open, EGGS.openMany)
    if (e.code === 'KeyT') toggleAuto(eggState.open)
  })

  render()
  return { togglePets }
}
