// The Items window (the HUD's Items tile): the world blurs and the rest of the HUD steps
// aside (only the corner buttons stay), and a dark panel opens with a big title, a red X,
// and two tabs down its left side:
//  - Planes: a card for each plane owned (MAP.pads; the equipped one ticked), and a panel
//    beside it for the picked one, its Power per throw, and Equip / Equipped;
//  - Eggs and Potions: what's stored of each (daily rewards hand them out), a card per kind
//    with how many, and the side panel's Hatch (the normal hatch animation, free) or Drink
//    (its x2 boost starts, or runs longer); "No eggs stored yet." while there are none.
// The Items tile opens and closes it, and so does I (which also frees the mouse).
// Plain DOM in the HUD root, like eggUi.js, sized by its own unit so the whole window
// (tabs, panel and side panel) fits narrow screens too.
import { EGG_SHOP, MAP } from './config.js'
import { FONT, outline } from './hud.js'
import { boostLeft, equipPlane, game, parsePotion, subscribe, usePotion } from './store.js'
import { eggArt, ensureArtDefs, potionArt } from './itemArt.js'
import { hatchStored } from './hatch.js'
import { eggMessage, eggState, subscribeEggs } from './eggs.js'
import { sfx } from './sfx.js'

const T = 't' // hud.js's outlined-text class
// The HUD unit, shrunk further when the window's ~1400 x 760 reference won't fit.
const iu = (n) => `calc(${n} * var(--iu))`

const TABS = {
  planes: { title: 'PLANES', fill: ['#c4f3ff', '#6fd2ff', '#2f8fe8'] },
  eggs: { title: 'EGGS', fill: ['#fff4cf', '#ffd277', '#f0a12e'], empty: 'No eggs stored yet.' },
  potions: { title: 'POTIONS', fill: ['#f6e2ff', '#cf97ff', '#8d43f0'], empty: 'No potions stored yet.' },
}

const STYLE = `
/* Everything else steps aside but the corners, and what a Hatch / Drink pops up over it. */
.hud.iw-open > :not(.corner):not(.iw):not(svg):not(.zonepop):not(.hz){visibility:hidden}
.hud.iw-open .zonepop{z-index:13}
.hud .iw{--iu:min(var(--u), calc(100vw / 1400), calc(100vh / 760));position:absolute;inset:0;z-index:11;pointer-events:auto;font-family:${FONT}}
.hud .iw[hidden],.hud .iw-grid[hidden],.hud .iw-empty[hidden]{display:none}
.hud .iw-panel{position:absolute;left:50%;top:50%;width:${iu(818)};height:${iu(573)};transform:translate(-50%, calc(-50% + ${iu(36)}));
  box-sizing:border-box;border:${iu(4)} solid #1b1b1b;background:rgba(12,12,14,.74);box-shadow:inset 0 0 0 ${iu(2)} rgba(255,255,255,.12)}
/* Title: an outlined copy behind a gradient-filled copy (a gradient fill can't carry its own outline). */
.hud .iw-title{position:absolute;left:${iu(56)};top:${iu(-40)};font-size:${iu(84)};line-height:1;letter-spacing:${iu(1)};pointer-events:none}
.hud .iw-title .o{color:#10223d;${outline(5, '#10223d')}}
.hud .iw-title .g{position:absolute;inset:0;background:linear-gradient(180deg,var(--a) 15%,var(--b) 55%,var(--c) 90%);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.hud .iw-close{position:absolute;right:${iu(-28)};top:${iu(-26)};width:${iu(92)};height:${iu(92)};box-sizing:border-box;
  border:${iu(4)} solid #3a0d10;background:linear-gradient(#ff3b3b,#d9141f);font-size:${iu(76)};line-height:1;
  display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 ${iu(3)} rgba(255,255,255,.18)}
.hud .iw-tabs{position:absolute;right:calc(100% + ${iu(6)});top:${iu(61)};display:flex;flex-direction:column;gap:${iu(12)}}
.hud .iw-tab{position:relative;width:${iu(222)};height:${iu(62)};box-sizing:border-box;border:${iu(4)} solid #14213d;
  font-size:${iu(38)};display:flex;align-items:center;justify-content:center;padding-left:${iu(20)};
  box-shadow:inset 0 ${iu(-7)} 0 rgba(255,255,255,.28)}
.hud .iw-tab.planes{background:linear-gradient(#8fdcff,#4aa8f2 55%,#2c86dc)}
.hud .iw-tab.eggs{background:linear-gradient(#ffe2a6,#ffc461 55%,#f19c2c)}
.hud .iw-tab.potions{background:linear-gradient(#d9a8ff,#a35cf2 55%,#8338e0)}
.hud .iw-tab svg{position:absolute;left:${iu(-30)};top:${iu(-16)};width:${iu(64)};height:${iu(64)}}
.hud .iw-tab:hover{filter:brightness(1.08)}
.hud .iw-grid{position:absolute;left:${iu(20)};right:${iu(20)};top:${iu(84)};display:flex;flex-wrap:wrap;justify-content:center;gap:${iu(8)}}
.hud .iw-card{position:relative;width:${iu(190)};height:${iu(190)};box-sizing:border-box;border:${iu(4)} solid #14213d;
  background:linear-gradient(#64aef0,#2d6fd2);display:flex;flex-direction:column;align-items:center;padding-top:${iu(6)}}
.hud .iw-card.picked{background:linear-gradient(#9fd6ff,#4b97ea)}
.hud .iw-card:hover{filter:brightness(1.08)}
.hud .iw-card svg.plane{width:${iu(140)};height:${iu(112)}}
.hud .iw-card .name{font-size:${iu(36)};line-height:1.05;margin-top:${iu(-2)}}
.hud .iw-card .pw{font-size:${iu(31)};line-height:1;color:#ffcc2a}
.hud .iw-card.eggs{background:linear-gradient(#ffd27a,#f0a12e)}
.hud .iw-card.eggs.picked{background:linear-gradient(#ffe7b0,#ffbf55)}
.hud .iw-card.potions{background:linear-gradient(#cf97ff,#8d43f0)}
.hud .iw-card.potions.picked{background:linear-gradient(#e6c6ff,#b07af8)}
.hud .iw-card .art{width:${iu(118)};height:${iu(118)};display:flex;align-items:center;justify-content:center}
.hud .iw-card .art svg{width:100%;height:100%;overflow:visible}
.hud .iw-count{position:absolute;right:${iu(8)};top:${iu(2)};font-size:${iu(34)};color:#fff4c4}
.hud .iw-side.eggs .pic{background:linear-gradient(#ffd27a,#f0a12e)}
.hud .iw-side.potions .pic{background:linear-gradient(#cf97ff,#8d43f0)}
.hud .iw-side .pic svg.art{width:${iu(124)};height:${iu(124)};overflow:visible}
.hud .iw-side .go:disabled{background:linear-gradient(#8d9db5,#5d6d85);cursor:default}
.hud .iw-check{position:absolute;right:${iu(2)};top:${iu(2)};width:${iu(44)};height:${iu(44)}}
.hud .iw-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;
  padding:${iu(40)} ${iu(150)} 0;font-size:${iu(78)};line-height:1.2;color:#fff}
.hud .iw-side{position:absolute;left:calc(100% + ${iu(18)});top:${iu(98)};width:${iu(238)};height:${iu(454)};box-sizing:border-box;
  border:${iu(4)} solid #1b1b1b;background:rgba(12,12,14,.74);box-shadow:inset 0 0 0 ${iu(2)} rgba(255,255,255,.12);
  display:flex;flex-direction:column;align-items:center;padding-top:${iu(16)}}
.hud .iw-side[hidden]{display:none}
.hud .iw-side .pic{width:${iu(156)};height:${iu(152)};box-sizing:border-box;border:${iu(4)} solid #14213d;
  background:linear-gradient(#64aef0,#2d6fd2);display:flex;align-items:center;justify-content:center}
.hud .iw-side .pic svg{width:${iu(138)};height:${iu(120)}}
.hud .iw-side .name{margin-top:${iu(12)};font-size:${iu(48)};white-space:nowrap}
.hud .iw-side .pw{display:flex;align-items:center;gap:${iu(10)};margin-top:${iu(52)};color:#ffcc2a;font-size:${iu(38)};line-height:1.05;text-align:center}
.hud .iw-side .pw svg{width:${iu(72)};height:${iu(72)}}
.hud .iw-side .go{position:absolute;left:${iu(12)};right:${iu(12)};bottom:${iu(14)};height:${iu(54)};box-sizing:border-box;
  border:${iu(3)} solid #1b2233;font-size:${iu(36)};background:linear-gradient(#a3e635,#16a34a)}
.hud .iw-side .go.on{background:linear-gradient(#8d9db5,#5d6d85);cursor:default}
`

// One darker shade of a #rrggbb colour (amt 0..1).
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - amt)))
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

// A folded dart, nose to the top right, in the plane's colour: the near wing lit, the far
// wing and keel shaded, an outline, and the plane's stripe (or ruled lines on a white,
// notebook-paper one) across the near wing.
let clipIds = 0
// Leading edge of the near wing runs (94,4) -> (2,42); `band(off, w)` is a strip parallel to
// it, `off` units back toward the trailing edge.
const band = (off, w, color) => `<line x1="0" y1="${42.8 + off}" x2="100" y2="${4.8 + off}" stroke="${color}" stroke-width="${w}"/>`
function planeSvg({ plane, stripe }) {
  const id = `iwc${clipIds++}`
  const near = '94,4 2,42 44,56'
  const marks =
    plane.toLowerCase() === '#ffffff'
      ? [7, 13, 19, 25].map((off) => band(off, 1.4, '#8fc3ff')).join('') + '<line x1="40" y1="70" x2="72" y2="0" stroke="#ff8f9f" stroke-width="1.4"/>'
      : band(12, 8, stripe ?? shade(plane, 0.28)) + band(20, 2.6, stripe ? '#ffe14d' : shade(plane, 0.12))
  return `<svg class="plane" viewBox="0 0 100 90">
    <defs><clipPath id="${id}"><polygon points="${near}"/></clipPath></defs>
    <polygon points="94,4 44,56 58,88" fill="${shade(plane, 0.2)}"/>
    <polygon points="94,4 44,56 36,68" fill="${shade(plane, 0.38)}"/>
    <polygon points="${near}" fill="${plane}"/>
    <g clip-path="url(#${id})">${marks}</g>
    <line x1="94" y1="4" x2="44" y2="56" stroke="rgba(0,0,0,.25)" stroke-width="1.6"/>
    <polygon points="94,4 2,42 44,56 36,68 44,56 58,88" fill="none" stroke="#1d2a44" stroke-width="3.2" stroke-linejoin="round"/>
  </svg>`
}

// The tab icons: a light-blue dart for Planes, a spotted pink egg for Eggs.
const PLANE_TAB_ICON = planeSvg({ plane: '#bfe8ff', stripe: '#5fb4f5' }).replace('class="plane"', '')
const EGG_TAB_ICON = `<svg viewBox="0 0 64 64">
  <path d="M32 4C19 4 9 24 9 38c0 13 10 22 23 22s23-9 23-22C55 24 45 4 32 4Z" fill="#ffc3e6" stroke="#5a2a4a" stroke-width="3"/>
  <path d="M12 34c6 3 12-2 20 1s14-1 21-3" stroke="#ffffff" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M12 45c7 3 13-2 20 1s13-1 20-4" stroke="#b98aff" stroke-width="4" fill="none" stroke-linecap="round"/>
  <circle cx="24" cy="20" r="4" fill="#b98aff"/><circle cx="40" cy="24" r="3.5" fill="#7fd0ff"/><circle cx="34" cy="13" r="2.5" fill="#fff"/>
</svg>`
const POTION_TAB_ICON = `<svg viewBox="0 0 64 64">
  <path d="M25 6h14v5h-2v12c9 3 15 11 15 20 0 11-9 17-20 17S12 54 12 43c0-9 6-17 15-20V11h-2Z" fill="#e9dcff" stroke="#3a1a5a" stroke-width="3" stroke-linejoin="round"/>
  <path d="M15 41c5 2 10-1 17 0s11 2 17-1c0 9-8 15-17 15S15 50 15 41Z" fill="#b14dff"/>
  <circle cx="26" cy="47" r="3" fill="#e7b8ff"/><circle cx="36" cy="44" r="2" fill="#e7b8ff"/>
  <rect x="23" y="3" width="18" height="7" rx="2" fill="#a8763f" stroke="#3a1a5a" stroke-width="2.5"/>
</svg>`
const CHECK = `<svg class="iw-check" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="#3ad13a" stroke="#123a12" stroke-width="3"/>
  <path d="M12 22.5l7 7 13-14" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`

const el = (html) => {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstChild
}

// Builds the window into the HUD root. Returns { toggle(open?) } for the Items tile.
export function createItemsUi(root) {
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  const win = el(`<div class="iw" hidden>
    <div class="iw-panel">
      <div class="iw-tabs">
        <button class="iw-tab planes ${T}" data-tab="planes">${PLANE_TAB_ICON}Planes</button>
        <button class="iw-tab eggs ${T}" data-tab="eggs">${EGG_TAB_ICON}Eggs</button>
        <button class="iw-tab potions ${T}" data-tab="potions">${POTION_TAB_ICON}Potions</button>
      </div>
      <div class="iw-title"><span class="o"></span><span class="g"></span></div>
      <button class="iw-close ${T}" aria-label="Close">X</button>
      <div class="iw-grid"></div>
      <div class="iw-empty"></div>
      <div class="iw-side">
        <div class="pic"></div>
        <div class="name ${T}"></div>
        <div class="pw ${T}"><svg><use href="#hi-arm"/></svg><span></span></div>
        <button class="go ${T}"></button>
      </div>
    </div>
  </div>`)
  root.appendChild(win)
  ensureArtDefs(root)
  const $ = (sel) => win.querySelector(sel)
  const grid = $('.iw-grid')
  const side = $('.iw-side')

  let tab = 'planes'
  let picked = game.equippedPlane
  const pickedItem = { eggs: null, potions: null } // key of the picked egg / potion

  // What's stored on the eggs / potions tab, in a stable order: [{ key, n, name, sub, art }].
  function storedItems() {
    if (tab === 'eggs') {
      return Object.keys(EGG_SHOP)
        .filter((id) => game.storedEggs[id] > 0)
        .map((id) => ({ key: id, n: game.storedEggs[id], name: EGG_SHOP[id].name, sub: 'Hatch a pet', art: eggArt(id) }))
    }
    return Object.keys(game.potions)
      .map((key) => ({ key, p: parsePotion(key) }))
      .filter(({ key, p }) => p && game.potions[key] > 0)
      .sort((a, b) => a.p.stat.localeCompare(b.p.stat) || a.p.minutes - b.p.minutes)
      .map(({ key, p }) => ({ key, n: game.potions[key], name: `x2 ${p.stat === 'power' ? 'Power' : 'Wins'}`, sub: `${p.minutes} min`, art: potionArt(p.stat), stat: p.stat }))
  }

  // The eggs / potions tab: a card per stored kind, and the side panel's Hatch / Drink.
  function renderStored(t) {
    const items = storedItems()
    const none = !items.length
    grid.hidden = none
    side.hidden = none
    side.className = `iw-side ${tab}`
    $('.iw-empty').hidden = !none
    $('.iw-empty').textContent = t.empty
    if (none) return
    if (!items.some((it) => it.key === pickedItem[tab])) pickedItem[tab] = items[0].key
    const it = items.find((x) => x.key === pickedItem[tab])
    grid.innerHTML = items
      .map(
        (x) => `<button class="iw-card ${tab}${x.key === it.key ? ' picked' : ''}" data-item="${x.key}"><span class="art">${x.art}</span>
          <span class="name ${T}">${x.name}</span><span class="pw ${T}">${x.sub}</span><span class="iw-count ${T}">x${x.n}</span></button>`,
      )
      .join('')
    $('.iw-side .pic').innerHTML = it.art.replace('<svg ', '<svg class="art" ')
    $('.iw-side .name').textContent = it.name
    $('.iw-side .pw use').setAttribute('href', tab === 'eggs' ? '#hi-cat' : it.stat === 'power' ? '#hi-arm' : '#hi-trophy')
    const go = $('.iw-side .go')
    go.classList.remove('on')
    if (tab === 'eggs') {
      $('.iw-side .pw span').innerHTML = `x${it.n}<br>stored`
      go.textContent = 'Hatch'
      go.disabled = !!eggState.hatch
    } else {
      const left = boostLeft(it.stat)
      $('.iw-side .pw span').innerHTML = left > 0 ? `Active<br>${Math.floor(left / 60_000)}:${String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')}` : `x${it.n}<br>stored`
      go.textContent = left > 0 ? 'Drink more' : 'Drink'
      go.disabled = false
    }
  }

  function render() {
    if (win.hidden) return
    const t = TABS[tab]
    const title = $('.iw-title')
    title.querySelector('.o').textContent = t.title
    title.querySelector('.g').textContent = t.title
    title.style.cssText = `--a:${t.fill[0]};--b:${t.fill[1]};--c:${t.fill[2]}`
    if (tab !== 'planes') return renderStored(t)
    grid.hidden = false
    side.hidden = false
    side.className = 'iw-side'
    $('.iw-empty').hidden = true
    $('.iw-side .pw use').setAttribute('href', '#hi-arm')
    $('.iw-side .go').disabled = false

    const owned = [...game.ownedPlanes].sort((a, b) => a - b)
    if (!owned.includes(picked)) picked = game.equippedPlane
    grid.innerHTML = owned
      .map((i) => {
        const p = MAP.pads[i]
        return `<button class="iw-card${i === picked ? ' picked' : ''}" data-plane="${i}">${planeSvg(p)}
          <span class="name ${T}">${p.name}</span><span class="pw ${T}">${p.power} Power</span>${i === game.equippedPlane ? CHECK : ''}</button>`
      })
      .join('')

    const p = MAP.pads[picked]
    $('.iw-side .pic').innerHTML = planeSvg(p)
    $('.iw-side .name').textContent = p.name
    $('.iw-side .pw span').innerHTML = `${p.power}<br>Power`
    const go = $('.iw-side .go')
    const on = picked === game.equippedPlane
    go.textContent = on ? 'Equipped' : 'Equip'
    go.classList.toggle('on', on)
  }

  win.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]')
    if (t && t.dataset.tab !== tab) {
      tab = t.dataset.tab
      sfx.tab()
    }
    const card = e.target.closest('[data-plane]')
    if (card) picked = Number(card.dataset.plane)
    const item = e.target.closest('[data-item]')
    if (item) pickedItem[tab] = item.dataset.item
    const go = e.target.closest('.iw-side .go')
    if (go && !go.disabled) {
      if (tab === 'planes' && picked !== game.equippedPlane) {
        equipPlane(picked) // re-renders through the store
        sfx.equip()
      } else if (tab === 'eggs') {
        hatchStored(pickedItem.eggs) // hatch.js says why if it can't
      } else if (tab === 'potions') {
        const p = parsePotion(pickedItem.potions)
        if (p && usePotion(pickedItem.potions)) {
          sfx.potion()
          eggMessage(`🧪 x2 ${p.stat === 'power' ? 'Power' : 'Wins'}!`, `for ${Math.round(boostLeft(p.stat) / 60_000)} minutes`, 'good')
        }
      }
    }
    if (e.target.closest('.iw-close')) return toggle(false)
    render()
  })

  // The world behind blurs; the rest of the HUD hides (CSS on .iw-open) but the corners.
  const canvas = () => document.querySelector('body > canvas')
  function toggle(open = win.hidden) {
    if (open === win.hidden) (open ? sfx.open : sfx.close)()
    win.hidden = !open
    root.classList.toggle('iw-open', open)
    const c = canvas()
    if (c) c.style.filter = open ? 'blur(6px)' : ''
    if (open) {
      document.exitPointerLock?.()
      picked = game.equippedPlane
      render()
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && !win.hidden) toggle(false)
    // I opens it from play, where the mouse is locked and the Items tile can't be clicked.
    if (e.code === 'KeyI' && !e.repeat && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) toggle()
  })
  subscribe(render)
  subscribeEggs(render) // Hatch is greyed out while a hatch plays
  // A running potion's countdown on the Potions tab.
  setInterval(() => !win.hidden && tab === 'potions' && render(), 1000)
  return { toggle }
}
