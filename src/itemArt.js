// Pictures of the items daily rewards hand out, shared by the Daily Rewards window
// (dailyUi.js) and the Items window's Eggs / Potions tabs (itemsUi.js): a corked potion
// flask per boost, the Unicorn and Demon Eggs drawn in full, and any other egg in its stand's
// colours (MAP.eggs). Inline SVG; their gradients live in one hidden <svg> that
// ensureArtDefs() puts in the HUD root once. The potions' emblems are hud.js's #hi-trophy /
// #hi-arm icons.
import { MAP } from './config.js'

const DEFS = `<svg class="art-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <radialGradient id="dg-wins" cx=".36" cy=".34" r=".8"><stop offset="0" stop-color="#b8f0ff"/><stop offset=".5" stop-color="#2f8fff"/><stop offset="1" stop-color="#103796"/></radialGradient>
  <radialGradient id="dg-power" cx=".36" cy=".34" r=".8"><stop offset="0" stop-color="#fff6b0"/><stop offset=".5" stop-color="#ffc21c"/><stop offset="1" stop-color="#d06a00"/></radialGradient>
  <radialGradient id="dg-uni" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#f1ecff"/><stop offset="1" stop-color="#c9bde8"/></radialGradient>
  <radialGradient id="dg-demon" cx=".4" cy=".32" r=".85"><stop offset="0" stop-color="#5a1420"/><stop offset=".6" stop-color="#2a070d"/><stop offset="1" stop-color="#120205"/></radialGradient>
  <linearGradient id="dg-glass" x1="0" x2="1"><stop offset="0" stop-color="#e9f8ff"/><stop offset="1" stop-color="#9fc8e0"/></linearGradient>
</defs></svg>`

export function ensureArtDefs(root) {
  if (!root.querySelector('.art-defs')) root.insertAdjacentHTML('afterbegin', DEFS)
}

// A round flask with a cork, filled for its boost, and a gold emblem inside.
export function potionArt(stat) {
  const [fill, emblem, stroke] = stat === 'power' ? ['dg-power', 'arm', '#6a3200'] : ['dg-wins', 'trophy', '#0f2a55']
  return `<svg viewBox="0 0 100 100">
  <rect x="39" y="4" width="22" height="15" rx="4" fill="#b8763a" stroke="#3a1d00" stroke-width="3"/>
  <rect x="34" y="17" width="32" height="10" rx="4" fill="url(#dg-glass)" stroke="${stroke}" stroke-width="3"/>
  <path d="M41 26 v9 a31 31 0 1 0 18 0 v-9 z" fill="url(#${fill})" stroke="${stroke}" stroke-width="3.5" stroke-linejoin="round"/>
  <ellipse cx="34" cy="55" rx="6" ry="13" fill="#fff" opacity=".45"/>
  <use href="#hi-${emblem}" x="33" y="47" width="34" height="34"/>
</svg>`
}

const UNICORN_EGG = `<svg viewBox="0 0 100 110">
  <path d="M50 2 L57 27 L43 27 Z" fill="#ffd23f" stroke="#7a4a00" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M46 10 L54 14 M45 17 L55 21" stroke="#c98a00" stroke-width="2"/>
  <circle cx="34" cy="28" r="7" fill="#ff9ad5"/><circle cx="66" cy="28" r="7" fill="#c9a8ff"/><circle cx="27" cy="36" r="5" fill="#ffd1ec"/>
  <path d="M50 20 C24 20 12 60 15 78 C20 102 80 102 85 78 C88 60 76 20 50 20 Z" fill="url(#dg-uni)" stroke="#6a5a8a" stroke-width="3"/>
  <circle cx="32" cy="70" r="5" fill="#ff9ad5" opacity=".8"/><circle cx="70" cy="62" r="4" fill="#c9a8ff" opacity=".9"/><circle cx="60" cy="86" r="4" fill="#ffb3d9"/>
  <path d="M42 50 l3 7 7 .8 -5 4.7 1.3 7 -6.3-3.6 -6.3 3.6 1.3-7 -5-4.7 7-.8z" fill="#ffd23f" stroke="#c98a00" stroke-width="1.5" stroke-linejoin="round"/>
  <ellipse cx="34" cy="44" rx="6" ry="10" fill="#fff" opacity=".7"/>
</svg>`

const DEMON_EGG = `<svg viewBox="0 0 120 120">
  <path d="M30 58 C14 40 6 44 2 30 C10 34 16 32 20 26 C22 36 30 38 34 34 C34 44 40 48 42 54 Z" fill="#9a1426" stroke="#2a0008" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M90 58 C106 40 114 44 118 30 C110 34 104 32 100 26 C98 36 90 38 86 34 C86 44 80 48 78 54 Z" fill="#9a1426" stroke="#2a0008" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M42 30 C36 18 38 8 44 2 C44 12 48 18 54 22 Z" fill="#24070c" stroke="#000" stroke-width="2"/>
  <path d="M78 30 C84 18 82 8 76 2 C76 12 72 18 66 22 Z" fill="#24070c" stroke="#000" stroke-width="2"/>
  <path d="M60 16 C32 16 22 58 24 78 C28 106 92 106 96 78 C98 58 88 16 60 16 Z" fill="url(#dg-demon)" stroke="#000" stroke-width="3"/>
  <path d="M40 40 L50 52 L44 64 L54 78 L48 92 M80 38 L70 52 L76 66 L68 80 L74 94 M50 52 L70 52 M44 64 L36 70 M76 66 L86 72"
    fill="none" stroke="#ff7a1a" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 3px #ff5a00)"/>
  <path d="M60 50 L72 64 L60 80 L48 64 Z" fill="#ff9f1c" stroke="#7a2a00" stroke-width="2.5" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px #ff7a00)"/>
  <path d="M60 56 L66 64 L60 72 L54 64 Z" fill="#ffe14d"/>
  <ellipse cx="42" cy="34" rx="5" ry="9" fill="#fff" opacity=".18"/>
</svg>`

// Any other egg: a spotted shell in its stand's colours.
function plainEgg(id) {
  const look = MAP.eggs.find((e) => e.name.toLowerCase() === id) ?? { color: '#f6f3ec', spot: '#d9d4c8' }
  return `<svg viewBox="0 0 100 110">
  <path d="M50 10 C24 10 12 56 15 76 C20 102 80 102 85 76 C88 56 76 10 50 10 Z" fill="${look.color}" stroke="#3a3a3a" stroke-width="3"/>
  <circle cx="36" cy="40" r="7" fill="${look.spot}"/><circle cx="66" cy="54" r="6" fill="${look.spot}"/><circle cx="44" cy="76" r="6" fill="${look.spot}"/>
  <ellipse cx="34" cy="34" rx="6" ry="10" fill="#fff" opacity=".55"/>
</svg>`
}

export const eggArt = (id) => (id === 'unicorn' ? UNICORN_EGG : id === 'demon' ? DEMON_EGG : plainEgg(id))
