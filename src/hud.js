// The on-screen HUD: the Auto Throw toggle and current objective (top), the Pets / Rebirth / Items / Store grid and stats (left), Rewards and the x2
// boosts (right), and the Power readout, level bar and power packs (bottom). Plain DOM
// over the canvas, drawn at a 1920x990 reference and scaled to the window; only the
// buttons take the pointer, so the world underneath still gets every other click.
// Progress (Power, Wins, Rebirths, level, Auto Throw) mirrors store.js.
import { HUD } from './config.js'
import { canAcceptRebirth, levelProgress, rebirthLevelsRequired, rebirthProgress } from './progression.js'
import { acceptRebirth, game, powerMultiplier, setAutoThrow, subscribe } from './store.js'

// Lengths in reference pixels, scaled with the window.
const u = (n) => `calc(${n} * var(--u))`

// Chunky outlined text: an even ring of shadows (scales with --u) plus a soft drop.
function outline(w, color = '#14100c') {
  const ring = []
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    ring.push(`${u((Math.cos(a) * w).toFixed(2))} ${u((Math.sin(a) * w).toFixed(2))} 0 ${color}`)
  }
  ring.push(`0 ${u(w + 1.5)} 0 ${color}`)
  return `text-shadow:${ring.join(',')};`
}

const ZONE_SHOW_MS = 2200

const FONT = '"Fredoka", "Arial Rounded MT Bold", "Segoe UI", Arial, sans-serif'

const STYLE = `
.hud{position:fixed;inset:0;pointer-events:none;z-index:4;font-family:${FONT};font-weight:700;color:#fff;
  user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;line-height:1}
.hud button{pointer-events:auto;font:inherit;color:inherit;border:0;padding:0;margin:0;background:none;cursor:pointer;
  touch-action:manipulation;transition:transform .08s ease-out}
.hud button:active{transform:scale(.93)}
.hud svg{display:block;overflow:visible}
.hud .t{${outline(3)}}
.hud [hidden]{display:none!important}

/* --- Auto Throw + objective ------------------------------------------------------------ */
.hud .auto{position:absolute;top:${u(12)};left:50%;margin-left:${u(-164)};width:${u(328)};height:${u(78)};box-sizing:border-box;
  border:${u(3.5)} solid #0b1d3f;border-radius:${u(3)};
  background:linear-gradient(#5fd7ff 0%,#22a9ff 45%,#0f74f2 100%);box-shadow:inset 0 ${u(3)} 0 rgba(255,255,255,.45)}
.hud .auto .cycle{position:absolute;left:50%;top:50%;width:${u(108)};height:${u(108)};margin:${u(-56)} 0 0 ${u(-54)}}
.hud .auto .label{position:relative;font-size:${u(40)};${outline(3.5, '#0b1d3f')}}
.hud .auto .state{position:absolute;left:0;right:0;bottom:${u(-18)};font-size:${u(30)};color:#ff3d1c}
.hud .auto.on .state{color:#5cff3d}
.hud .auto .cost{position:absolute;right:${u(-4)};bottom:${u(-18)}}
.hud .cost{display:flex;align-items:center;gap:${u(3)};font-size:${u(30)};color:#a8ff3a}
.hud .cost svg{width:${u(30)};height:${u(30)}}
.hud .objective{position:absolute;top:${u(122)};left:50%;transform:translateX(-50%);white-space:nowrap;
  padding:${u(8)} ${u(70)};font-size:${u(38)};
  background:linear-gradient(90deg,transparent,rgba(0,0,0,.32) 15%,rgba(0,0,0,.32) 85%,transparent)}
.hud .objective:empty{display:none}
.hud .flight{position:absolute;top:${u(190)};left:50%;transform:translateX(-50%);white-space:nowrap;font-size:${u(54)};
  ${outline(3.5, '#0b1d3f')}}
.hud .flight:empty{display:none}
/* Popup: the zone a chased plane flies into, a pad bought or locked; pops in, fades after ZONE_SHOW_MS. */
.hud .zonepop{position:absolute;top:${u(290)};left:50%;transform:translateX(-50%);text-align:center;white-space:nowrap;opacity:0}
.hud .zonepop .name{font-size:${u(86)};${outline(4.5, '#0b1d3f')}}
.hud .zonepop .sub{margin-top:${u(10)};font-size:${u(40)};color:#ffd84a}
.hud .zonepop .sub.good{color:#5cff3d}
.hud .zonepop .sub.bad{color:#ff5a4a}
/* "+N Power" rising off the Power readout, one per training-pad hit. */
/* Rebirth confirm window (after Stone-Skipping's RebirthWindow): the Rebirth tile opens it; it
   trades this rebirth's Power and Level for the next multiplier, once the level cap is reached. */
.hud .rb{position:absolute;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,.6);pointer-events:auto}
.hud .rb[hidden]{display:none}
.hud .rb-win{position:relative;width:${u(560)};max-width:92vw}
.hud .rb-title{position:absolute;top:${u(-30)};left:${u(18)};z-index:1;font-size:${u(48)};pointer-events:none}
.hud .rb-close{position:absolute;top:${u(-18)};right:${u(-12)};z-index:1;width:${u(52)};height:${u(52)};
  border:${u(3)} solid #111 !important;border-radius:${u(9)};background:#dc2626;font-size:${u(28)};
  box-shadow:0 ${u(4)} 0 rgba(0,0,0,.4)}
.hud .rb-body{display:flex;flex-direction:column;align-items:center;gap:${u(20)};padding:${u(46)} ${u(30)} ${u(34)};
  border:${u(3)} solid #111;border-radius:${u(12)};background:rgba(15,23,42,.88)}
.hud .rb-row{display:flex;align-items:center;gap:${u(34)};font-size:${u(68)};color:#fcd34d}
.hud .rb-arrow{color:#fff;font-size:${u(80)}}
.hud .rb-mult{font-size:${u(30)};color:#ffd84a}
.hud .rb-warn{color:#ef4444;font-size:${u(30)};text-align:center}
.hud .rb-bar{position:relative;width:60%;height:${u(62)};border:${u(4)} solid #111;border-radius:9999px;background:#f4f4f4;
  overflow:hidden;box-shadow:inset 0 ${u(3)} ${u(4)} rgba(0,0,0,.12)}
.hud .rb-fill{position:absolute;inset:0 auto 0 0;background:linear-gradient(180deg,#ffe24d 0%,#ff9d00 52%,#ff2d00 100%)}
.hud .rb-label{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:${u(28)}}
.hud .rb-go{align-self:stretch;padding:${u(14)} ${u(28)};border:${u(3)} solid #111 !important;border-radius:${u(12)};
  background:linear-gradient(#a3e635,#16a34a);font-size:${u(34)};box-shadow:0 ${u(4)} 0 rgba(0,0,0,.4)}
.hud .rb-go:hover:not(:disabled){filter:brightness(1.1)}
.hud .rb-go:disabled{cursor:not-allowed;opacity:.4}
/* The Rebirth tile's icon pulses once a rebirth is ready. */
.hud .tile.ready svg{animation:rebirth-ready .9s ease-in-out infinite alternate}
@keyframes rebirth-ready{to{transform:scale(1.18)}}
.hud .gain{position:absolute;left:50%;bottom:${u(150)};transform:translateX(-50%);font-size:${u(44)};color:#ffd84a;
  pointer-events:none;animation:gain 1.1s ease-out forwards}
@keyframes gain{0%{opacity:0;transform:translate(-50%,${u(20)}) scale(.7)}15%{opacity:1;transform:translate(-50%,0) scale(1.1)}
  100%{opacity:0;transform:translate(-50%,${u(-90)}) scale(1)}}
.hud .zonepop.show{animation:zonepop ${ZONE_SHOW_MS}ms ease-out forwards}
@keyframes zonepop{0%{opacity:0;transform:translateX(-50%) scale(.6)}12%{opacity:1;transform:translateX(-50%) scale(1.08)}
  20%{transform:translateX(-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translateX(-50%) scale(1)}}

/* --- Left menu grid ---------------------------------------------------------------------- */
.hud .menu{position:absolute;left:${u(17)};top:50%;transform:translateY(calc(-50% + ${u(39)}));
  display:grid;grid-template-columns:repeat(2,${u(102)});gap:${u(10)} ${u(8)}}
.hud .tile{position:relative;width:${u(102)};height:${u(102)};box-sizing:border-box;border-radius:${u(4)};
  border:${u(3)} solid #0d121c;background:linear-gradient(#45546f,#262f42);
  box-shadow:inset 0 0 0 ${u(2.5)} rgba(214,226,255,.55)}
.hud .tile svg{position:absolute;left:${u(9)};top:${u(2)};width:${u(78)};height:${u(78)}}
.hud .tile .name{position:absolute;left:${u(-6)};right:${u(-6)};bottom:${u(-4)};font-size:${u(26)}}
.hud .tile .pct{position:absolute;left:0;right:0;top:${u(-14)};font-size:${u(26)};font-style:italic;z-index:1}
.hud .badge{position:absolute;width:${u(30)};height:${u(30)};border-radius:50%;box-sizing:border-box;
  background:#f01e2c;border:${u(2.5)} solid #fff;display:grid;place-items:center;font-size:${u(20)};z-index:1}
.hud .tile .badge{right:${u(-16)};top:${u(-6)}}

/* --- Bottom-left stats --------------------------------------------------------------------- */
.hud .stats{position:absolute;left:${u(8)};bottom:${u(10)};display:flex;flex-direction:column;gap:${u(10)}}
.hud .stat{display:flex;align-items:center;gap:${u(10)};width:${u(212)};height:${u(56)};
  background:linear-gradient(90deg,rgba(0,0,0,.34) 40%,transparent)}
.hud .stat svg{width:${u(66)};height:${u(66)};flex:none}
.hud .stat span{font-size:${u(42)};color:#ffc21c;${outline(3.5, '#2a1400')}}
.hud .boost{display:flex;align-items:center;gap:${u(8)};font-size:${u(22)};font-style:italic;margin-top:${u(-2)}}
.hud .boost button{width:${u(26)};height:${u(26)};border-radius:${u(4)};background:#38c93a;border:${u(2)} solid #fff;
  box-sizing:border-box;font-size:${u(22)};font-style:normal;display:grid;place-items:center;line-height:0}

/* --- Right column -------------------------------------------------------------------------- */
.hud .side{position:absolute;right:${u(18)};top:50%;transform:translateY(calc(-50% + ${u(45)}));
  width:${u(212)};display:flex;flex-direction:column;align-items:center;gap:${u(30)}}
.hud .rewards{position:relative;width:${u(110)};height:${u(96)};margin-bottom:${u(-4)}}
.hud .rewards svg{width:${u(96)};height:${u(96)};margin:0 auto}
.hud .rewards .name{position:absolute;left:${u(-20)};right:${u(-20)};bottom:${u(-6)};font-size:${u(28)}}
.hud .rewards .badge{right:${u(-6)};top:${u(-6)};width:${u(34)};height:${u(34)};font-size:${u(22)}}
.hud .boost2{position:relative;width:${u(212)};height:${u(64)};box-sizing:border-box;border:${u(3)} solid #1a1205;
  border-radius:${u(3)};background:linear-gradient(#ffe95c,#ffc21c 55%,#ff9f0a);
  box-shadow:inset 0 ${u(3)} 0 rgba(255,255,255,.5)}
.hud .boost2 .arm{position:absolute;left:50%;top:${u(-14)};width:${u(52)};height:${u(52)};margin-left:${u(-26)}}
.hud .boost2 .label{position:relative;font-size:${u(30)}}
.hud .boost2 .cost{position:absolute;left:0;right:0;bottom:${u(-22)};justify-content:center}

/* --- Bottom centre ------------------------------------------------------------------------- */
.hud .power{position:absolute;left:50%;bottom:${u(22)};width:${u(540)};margin-left:${u(-270)}}
.hud .readout{display:flex;justify-content:space-between;font-size:${u(28)};color:#ffb21a;padding:0 ${u(2)} ${u(4)};
  ${outline(3, '#2a1000')}}
.hud .bar{position:relative;height:${u(48)};box-sizing:border-box;border:${u(3)} solid #1a1205;border-radius:${u(3)};
  background:#6b3e0a;overflow:hidden}
.hud .bar .fill{position:absolute;inset:0;right:auto;background:linear-gradient(#ffd23a,#ffb40f 55%,#ff9a05);
  box-shadow:inset 0 ${u(3)} 0 rgba(255,255,255,.45)}
.hud .bar .txt{position:absolute;inset:0;display:flex;justify-content:space-between;align-items:center;
  padding:0 ${u(8)};font-size:${u(28)}}
.hud .packs{display:flex;gap:${u(18)};margin-top:${u(10)}}
.hud .pack{position:relative;flex:1;height:${u(47)};box-sizing:border-box;border:${u(3)} solid #1a1205;border-radius:${u(3)};
  box-shadow:inset 0 ${u(3)} 0 rgba(255,255,255,.45)}
.hud .pack:nth-child(1){flex:0 0 ${u(150)};background:linear-gradient(#ffe95c,#ffc21c 55%,#ff9f0a)}
.hud .pack:nth-child(2){background:linear-gradient(#7fe3ff,#2fb0ff 55%,#1673f0)}
.hud .pack:nth-child(3){background:linear-gradient(#f08aff,#cc45f5 55%,#9324e0)}
.hud .pack .arm{position:absolute;left:${u(-6)};top:${u(-14)};width:${u(56)};height:${u(56)}}
.hud .pack .label{position:relative;padding-left:${u(34)};font-size:${u(30)}}
.hud .pack .cost{position:absolute;right:${u(18)};bottom:${u(-20)};font-size:${u(24)}}
.hud .pack .cost svg{width:${u(24)};height:${u(24)}}
`

// Shared gradients and icon symbols; each icon is drawn once and <use>d everywhere.
const DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="hg-arm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe774"/><stop offset="1" stop-color="#ff9516"/></linearGradient>
  <linearGradient id="hg-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff07a"/><stop offset=".55" stop-color="#ffc21c"/><stop offset="1" stop-color="#f08a00"/></linearGradient>
  <linearGradient id="hg-cat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffab4a"/><stop offset="1" stop-color="#f2621a"/></linearGradient>
  <linearGradient id="hg-bag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a4a"/><stop offset="1" stop-color="#c5121c"/></linearGradient>
  <linearGradient id="hg-gift" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7aa6"/><stop offset="1" stop-color="#e01f55"/></linearGradient>
  <linearGradient id="hg-cycle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#8fdcff"/></linearGradient>

  <symbol id="hi-gem" viewBox="0 0 64 64">
    <path d="M32 4 56 18v28L32 60 8 46V18Z" fill="#9cf03a" stroke="#173d0a" stroke-width="5" stroke-linejoin="round"/>
    <path d="M32 18 44 25v14L32 46 20 39V25Z" fill="#2c8a1a" stroke="#173d0a" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M14 21 31 11" stroke="#e6ffc4" stroke-width="3.5" stroke-linecap="round"/>
  </symbol>

  <symbol id="hi-arm" viewBox="0 0 64 64">
    <path d="M6 60V50c0-8 6-16 10-28-6-4-6-16 6-18 12-2 20 6 14 16l-2 14c6-6 18-6 23 4 4 10-1 22-13 22Z"
      fill="url(#hg-arm)" stroke="#5c2a00" stroke-width="4" stroke-linejoin="round"/>
    <path d="M18 15q8-3 16 0M38 42q6-4 12 1" fill="none" stroke="#5c2a00" stroke-width="3" stroke-linecap="round"/>
    <path d="M18 9q4-3 9-3" fill="none" stroke="#fff6c8" stroke-width="3" stroke-linecap="round"/>
  </symbol>

  <symbol id="hi-cycle" viewBox="0 0 64 64">
    <g stroke="#0b2f6b" stroke-width="10" fill="none" stroke-linecap="round">
      <path d="M11.3 24.5A22 22 0 0 1 48.9 17.9"/><path d="M52.7 39.5A22 22 0 0 1 15.1 46.1"/>
    </g>
    <g fill="#0b2f6b" stroke="#0b2f6b" stroke-width="4" stroke-linejoin="round">
      <path d="M55 25 41.5 20.5 53.5 10Z"/><path d="M9 39 22.5 43.5 10.5 54Z"/>
    </g>
    <g stroke="url(#hg-cycle)" stroke-width="5" fill="none" stroke-linecap="round">
      <path d="M11.3 24.5A22 22 0 0 1 48.9 17.9"/><path d="M52.7 39.5A22 22 0 0 1 15.1 46.1"/>
    </g>
    <path d="M55 25 41.5 20.5 53.5 10Z" fill="#fff"/><path d="M9 39 22.5 43.5 10.5 54Z" fill="#8fdcff"/>
  </symbol>

  <symbol id="hi-cat" viewBox="0 0 64 64">
    <path d="M9 30 11 3l19 13ZM55 30 53 3 34 16Z" fill="url(#hg-cat)" stroke="#4a1800" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M14 20 15 10l7 6ZM50 20 49 10l-7 6Z" fill="#ff8fa8"/>
    <rect x="6" y="14" width="52" height="46" rx="15" fill="url(#hg-cat)" stroke="#4a1800" stroke-width="3.5"/>
    <ellipse cx="32" cy="47" rx="13" ry="9" fill="#ffe0b0"/>
    <circle cx="21" cy="34" r="8.5" fill="#fff" stroke="#4a1800" stroke-width="2.5"/><circle cx="43" cy="34" r="8.5" fill="#fff" stroke="#4a1800" stroke-width="2.5"/>
    <circle cx="22" cy="35" r="5" fill="#1a0f0a"/><circle cx="42" cy="35" r="5" fill="#1a0f0a"/>
    <circle cx="23.5" cy="33" r="1.8" fill="#fff"/><circle cx="43.5" cy="33" r="1.8" fill="#fff"/>
    <path d="M28.5 42h7L32 46Z" fill="#ff5f86" stroke="#4a1800" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M26 49q3 3 6 0 3 3 6 0" fill="none" stroke="#4a1800" stroke-width="2.2" stroke-linecap="round"/>
    <ellipse cx="13" cy="45" rx="4" ry="2.5" fill="#ff7a8f" opacity=".7"/><ellipse cx="51" cy="45" rx="4" ry="2.5" fill="#ff7a8f" opacity=".7"/>
  </symbol>

  <symbol id="hi-rebirth" viewBox="0 0 64 64">
    <path d="M5 32a27 27 0 0 1 54 0Z" fill="#ff4fa0"/>
    <path d="M5 32a27 27 0 0 0 54 0Z" fill="#62d2ff"/>
    <circle cx="32" cy="32" r="27" fill="none" stroke="#2e0f2a" stroke-width="4"/>
    <path d="M18 43A15 15 0 1 1 45 41" fill="none" stroke="#2e0f2a" stroke-width="12" stroke-linecap="round"/>
    <path d="M37 52 52 45 39 34Z" fill="#2e0f2a" stroke="#2e0f2a" stroke-width="6" stroke-linejoin="round"/>
    <path d="M18 43A15 15 0 1 1 45 41" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
    <path d="M37 52 52 45 39 34Z" fill="#fff"/>
  </symbol>

  <symbol id="hi-bag" viewBox="0 0 64 64">
    <path d="M23 13c0-10 18-10 18 0" fill="none" stroke="#3d0004" stroke-width="8"/>
    <path d="M23 13c0-10 18-10 18 0" fill="none" stroke="#e8343a" stroke-width="3.5"/>
    <rect x="9" y="10" width="46" height="51" rx="15" fill="url(#hg-bag)" stroke="#3d0004" stroke-width="3.5"/>
    <path d="M15 20q17-7 34 0" fill="none" stroke="#ff8a7a" stroke-width="3" stroke-linecap="round"/>
    <rect x="16" y="35" width="32" height="20" rx="7" fill="#e3242e" stroke="#3d0004" stroke-width="3"/>
    <path d="M16 42h32" stroke="#3d0004" stroke-width="2.5"/>
    <rect x="27" y="38" width="10" height="8" rx="2" fill="#d6dce6" stroke="#3d0004" stroke-width="2"/>
  </symbol>

  <symbol id="hi-basket" viewBox="0 0 64 64">
    <path d="M15 28C15 4 49 4 49 28" fill="none" stroke="#4a2200" stroke-width="9" stroke-linecap="round"/>
    <path d="M15 28C15 4 49 4 49 28" fill="none" stroke="#ffbf2a" stroke-width="4" stroke-linecap="round"/>
    <path d="M7 30h50l-6 28H13Z" fill="url(#hg-gold)" stroke="#4a2200" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M22 36v18M32 36v18M42 36v18M11 45h42" stroke="#c76400" stroke-width="3" stroke-linecap="round"/>
    <rect x="4" y="23" width="56" height="10" rx="4" fill="#ffd23a" stroke="#4a2200" stroke-width="3.5"/>
  </symbol>

  <symbol id="hi-gift" viewBox="0 0 64 64">
    <path d="M32 18C24 2 8 6 14 16q4 4 18 2ZM32 18c8-16 24-12 18-2q-4 4-18 2Z" fill="#ffd23a" stroke="#4a1a00" stroke-width="3.5" stroke-linejoin="round"/>
    <rect x="10" y="29" width="44" height="30" rx="4" fill="url(#hg-gift)" stroke="#4a0018" stroke-width="3.5"/>
    <rect x="6" y="18" width="52" height="14" rx="4" fill="#ff7aa6" stroke="#4a0018" stroke-width="3.5"/>
    <path d="M27 18h10v41H27Z" fill="#ffd23a" stroke="#4a1a00" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="32" cy="18" r="5" fill="#ffb000" stroke="#4a1a00" stroke-width="3"/>
  </symbol>

  <symbol id="hi-trophy" viewBox="0 0 64 64">
    <path d="M17 14H8c0 12 6 17 12 17M47 14h9c0 12-6 17-12 17" fill="none" stroke="#4a2600" stroke-width="8" stroke-linejoin="round"/>
    <path d="M17 14H8c0 12 6 17 12 17M47 14h9c0 12-6 17-12 17" fill="none" stroke="#ffc21c" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M14 7h36v14c0 13-8 21-18 21S14 34 14 21Z" fill="url(#hg-gold)" stroke="#4a2600" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M27 42h10v8H27Z" fill="#f0a000" stroke="#4a2600" stroke-width="3"/>
    <rect x="17" y="49" width="30" height="10" rx="3" fill="url(#hg-gold)" stroke="#4a2600" stroke-width="3.5"/>
    <path d="M32 13l3 6.2 6.8.8-5 4.7 1.3 6.8L32 28l-6 3.5 1.3-6.8-5-4.7 6.8-.8Z" fill="#fff6c0" stroke="#c77a00" stroke-width="1.5" stroke-linejoin="round"/>
  </symbol>
</defs></svg>`

const icon = (id, cls = '') => `<svg class="${cls}"><use href="#hi-${id}"/></svg>`
const cost = (key) => `<span class="cost t">${icon('gem')}<span data-price="${key}"></span></span>`

const MARKUP = `
${DEFS}
<button class="auto" data-act="autoThrow">
  ${icon('cycle', 'cycle')}
  <span class="label">Auto Throw</span>
  <span class="state t" data-k="autoThrow"></span>
  ${cost('autoThrow')}
</button>
<div class="objective t" data-k="objective"></div>
<div class="flight" data-k="flight"></div>
<div class="zonepop"><div class="name t"></div><div class="sub t"></div></div>

<div class="menu">
  <button class="tile" data-act="pets">${icon('cat')}<span class="name t">Pets</span></button>
  <button class="tile" data-act="rebirth"><span class="pct t" data-k="rebirthProgress"></span>${icon('rebirth')}<span class="name t">Rebirth</span></button>
  <button class="tile" data-act="items">${icon('bag')}<span class="name t">Items</span></button>
  <button class="tile" data-act="store">${icon('basket')}<span class="name t">Store</span><span class="badge t" data-alert="store">!</span></button>
</div>

<div class="stats">
  <div class="stat">${icon('trophy')}<span data-k="wins"></span></div>
  <div class="stat">${icon('rebirth')}<span data-k="rebirths"></span></div>
  <div class="boost t"><span>Friend Boost: <span data-k="friendBoost"></span></span><button class="t" data-act="invite" aria-label="Invite friends">+</button></div>
</div>

<div class="side">
  <button class="rewards" data-act="rewards">${icon('gift')}<span class="name t">Rewards</span><span class="badge t" data-alert="rewards">!</span></button>
  <button class="boost2" data-act="x2Power">${icon('arm', 'arm')}<span class="label t">x2 Power</span>${cost('x2Power')}</button>
  <button class="boost2" data-act="x2Wins">${icon('arm', 'arm')}<span class="label t">x2 Wins</span>${cost('x2Wins')}</button>
</div>

<div class="power">
  <div class="readout"><span>Power: <span data-k="power"></span></span><span>Multiplier: <span data-k="multiplier"></span></span></div>
  <div class="bar"><div class="fill"></div><div class="txt t"><span>LEVEL <span data-k="level"></span></span><span data-k="maxLevel"></span></div></div>
  <div class="packs">
    <button class="pack" data-act="power100K">${icon('arm', 'arm')}<span class="label t">+100K</span>${cost('power100K')}</button>
    <button class="pack" data-act="power1M">${icon('arm', 'arm')}<span class="label t">+1M</span>${cost('power1M')}</button>
    <button class="pack" data-act="power10M">${icon('arm', 'arm')}<span class="label t">+10M</span>${cost('power10M')}</button>
  </div>
</div>

<div class="rb" hidden>
  <div class="rb-win" role="dialog" aria-label="Rebirth">
    <span class="rb-title t">Rebirth</span>
    <button class="rb-close t" data-act="rebirthClose" aria-label="Close">X</button>
    <div class="rb-body">
      <div class="rb-row t"><span data-rb="from"></span><span class="rb-arrow">▶</span><span data-rb="to"></span></div>
      <div class="rb-mult t" data-rb="mult"></div>
      <div class="rb-warn t">Rebirth resets your Power and Level!</div>
      <div class="rb-bar"><div class="rb-fill"></div><span class="rb-label t" data-rb="level"></span></div>
      <button class="rb-go t" data-act="rebirthConfirm" data-rb="go"></button>
    </div>
  </div>
</div>`

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi']
// 9600 -> "9.6K", 1250000 -> "1.2M", 24 -> "24"
export function formatNumber(n) {
  let i = 0
  while (Math.abs(n) >= 1000 && i < SUFFIXES.length - 1) {
    n /= 1000
    i++
  }
  const s = i === 0 ? String(Math.floor(n)) : (Math.floor(n * 10) / 10).toFixed(1).replace(/\.0$/, '')
  return s + SUFFIXES[i]
}

// How each state key is shown.
const FORMAT = {
  wins: formatNumber,
  rebirths: formatNumber,
  power: formatNumber,
  friendBoost: (v) => `+${v}%`,
  multiplier: (v) => `x${v}`,
  rebirthProgress: (v) => `${Math.round(v)}%`,
  autoThrow: (v) => (v ? 'ON' : 'OFF'),
  maxLevel: (v) => (v ? 'MAX LEVEL' : ''),
}

// The HUD fields that come from the game's progress.
function progressFields(g) {
  const { level, into, span } = levelProgress(g.power)
  const maxLevel = level >= rebirthLevelsRequired(g.rebirths)
  return {
    power: g.power,
    wins: g.wins,
    rebirths: g.rebirths,
    multiplier: powerMultiplier(),
    level,
    levelProgress: maxLevel ? 1 : into / span, // a full bar at the cap, beside MAX LEVEL
    maxLevel,
    rebirthProgress: rebirthProgress(g.power, g.rebirths) * 100,
    autoThrow: g.autoThrow,
  }
}

// Builds the HUD. `actions` maps a button name (data-act) to a handler; Auto Throw acts on the
// store itself, and Rebirth opens the confirm window, which does. Returns { state, set(patch), setAlert(name, on), showPopup(name, sub, tone), floatGain(text) }.
export function createHud(actions = {}) {
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  const root = document.createElement('div')
  root.className = 'hud'
  root.innerHTML = MARKUP
  document.body.appendChild(root)

  const fit = () => {
    const s = Math.min(window.innerWidth / HUD.refWidth, window.innerHeight / HUD.refHeight, HUD.maxScale)
    root.style.setProperty('--u', `${s}px`)
  }
  window.addEventListener('resize', fit)
  fit()

  for (const el of root.querySelectorAll('[data-price]')) el.textContent = HUD.prices[el.dataset.price]

  const state = { ...HUD.start, alerts: { ...HUD.start.alerts }, flight: '', ...progressFields(game) }
  const fields = [...root.querySelectorAll('[data-k]')]
  const autoBtn = root.querySelector('.auto')
  const fill = root.querySelector('.bar .fill')
  const rebirthTile = root.querySelector('[data-act="rebirth"]')

  function render() {
    for (const el of fields) {
      const v = state[el.dataset.k]
      el.textContent = FORMAT[el.dataset.k] ? FORMAT[el.dataset.k](v) : v
    }
    autoBtn.classList.toggle('on', state.autoThrow)
    rebirthTile.classList.toggle('ready', canAcceptRebirth(game.power, game.rebirths))
    fill.style.width = `${Math.max(0, Math.min(1, state.levelProgress)) * 100}%`
    for (const el of root.querySelectorAll('[data-alert]')) el.hidden = !state.alerts[el.dataset.alert]
  }

  function set(patch) {
    Object.assign(state, patch)
    render()
  }

  function setAlert(name, on) {
    state.alerts[name] = on
    render()
  }

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]')
    if (!btn) return
    const act = btn.dataset.act
    if (act === 'autoThrow') setAutoThrow(!game.autoThrow)
    if (act === 'rebirth') openRebirth(true)
    if (act === 'rebirthClose') openRebirth(false)
    if (act === 'rebirthConfirm' && acceptRebirth()) openRebirth(false)
    actions[act]?.(state)
  })

  // --- Rebirth window -------------------------------------------------------------
  const rb = root.querySelector('.rb')
  const rbField = (name) => rb.querySelector(`[data-rb="${name}"]`)
  const rbFill = rb.querySelector('.rb-fill')
  function renderRebirth(g) {
    if (rb.hidden) return
    const need = rebirthLevelsRequired(g.rebirths)
    const { level } = levelProgress(g.power)
    const ready = canAcceptRebirth(g.power, g.rebirths)
    rbField('from').textContent = `X${formatNumber(g.rebirths)}`
    rbField('to').textContent = `X${formatNumber(g.rebirths + 1)}`
    rbField('mult').textContent = `Multiplier x${formatNumber(powerMultiplier())} ▶ x${formatNumber(g.multiplier * (g.rebirths + 2))}`
    rbField('level').textContent = `Level ${formatNumber(level)}/${formatNumber(need)}`
    rbFill.style.width = `${rebirthProgress(g.power, g.rebirths) * 100}%`
    const go = rbField('go')
    go.disabled = !ready
    go.textContent = ready ? 'Rebirth' : `Level ${formatNumber(need)} needed`
  }
  function openRebirth(open) {
    rb.hidden = !open
    renderRebirth(game)
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && !rb.hidden) openRebirth(false)
  })

  subscribe((g) => {
    set(progressFields(g))
    renderRebirth(g) // live, so it fills while a training pad keeps earning
  })
  render()
  // Pops `name` (and a smaller `sub` line, green for 'good', red for 'bad', else gold) up the
  // middle of the screen.
  const zonePop = root.querySelector('.zonepop')
  function showPopup(name, sub, tone = null) {
    zonePop.querySelector('.name').textContent = name
    const s = zonePop.querySelector('.sub')
    s.textContent = sub
    s.classList.toggle('good', tone === 'good')
    s.classList.toggle('bad', tone === 'bad')
    zonePop.classList.remove('show')
    void zonePop.offsetWidth // restart the animation
    zonePop.classList.add('show')
  }

  // Floats `text` up off the Power readout.
  function floatGain(text) {
    const el = document.createElement('div')
    el.className = 'gain t'
    el.textContent = text
    el.addEventListener('animationend', () => el.remove())
    root.appendChild(el)
  }

  return { state, set, setAlert, showPopup, floatGain }
}
