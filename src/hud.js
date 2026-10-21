// The on-screen HUD: the Auto Throw toggle and the tutorial banner (top), the Pets / Rebirth / Items grid and stats (left), the x2
// boosts (right), and the THROW button (in the throw area), Power readout and level bar (bottom). Plain DOM
// over the canvas, drawn at a 1920x990 reference and scaled to the window; only the
// buttons take the pointer, so the world underneath still gets every other click.
// Progress (Power, Wins, Rebirths, level, Auto Throw) mirrors store.js.
import { HUD } from './config.js'
import { canAcceptRebirth, levelProgress, rebirthLevelsRequired, rebirthProgress } from './progression.js'
import { acceptRebirth, buyAutoThrow, buyX2, game, powerMultiplier, setAutoThrow, setX2, skipTutorial, subscribe } from './store.js'
import { sfx } from './sfx.js'

// Lengths in reference pixels, scaled with the window. Shared with eggUi.js.
export const u = (n) => `calc(${n} * var(--u))`

// Chunky outlined text: an even ring of shadows (scales with --u) plus a soft drop.
export function outline(w, color = '#14100c') {
  const ring = []
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    ring.push(`${u((Math.cos(a) * w).toFixed(2))} ${u((Math.sin(a) * w).toFixed(2))} 0 ${color}`)
  }
  ring.push(`0 ${u(w + 1.5)} 0 ${color}`)
  return `text-shadow:${ring.join(',')};`
}

const ZONE_SHOW_MS = 2200

export const FONT = '"Fredoka", "Arial Rounded MT Bold", "Segoe UI", Arial, sans-serif'

const STYLE = `
.hud{position:fixed;inset:0;pointer-events:none;z-index:4;font-family:${FONT};font-weight:700;color:#fff;
  user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;line-height:1}
.hud button{pointer-events:auto;font:inherit;color:inherit;border:0;padding:0;margin:0;background:none;cursor:pointer;
  touch-action:manipulation;transition:transform .08s ease-out}
.hud button:active{transform:scale(.93)}
.hud svg{display:block;overflow:visible}
.hud .t{${outline(3)}}
.hud [hidden]{display:none!important}

/* --- Auto Throw + tutorial banner --------------------------------------------------------- */
.hud .auto{position:absolute;top:${u(12)};left:50%;margin-left:${u(-164)};width:${u(328)};height:${u(78)};box-sizing:border-box;
  border:${u(3.5)} solid #0b1d3f;border-radius:${u(3)};
  background:linear-gradient(#5fd7ff 0%,#22a9ff 45%,#0f74f2 100%);box-shadow:inset 0 ${u(3)} 0 rgba(255,255,255,.45)}
.hud .auto .cycle{position:absolute;left:50%;top:50%;width:${u(108)};height:${u(108)};margin:${u(-56)} 0 0 ${u(-54)}}
.hud .auto .label{position:relative;font-size:${u(40)};${outline(3.5, '#0b1d3f')}}
.hud .auto .state{position:absolute;left:0;right:0;bottom:${u(-18)};font-size:${u(30)};color:#ff3d1c}
.hud .auto.on .state{color:#5cff3d}
.hud .auto .cost{position:absolute;right:${u(-4)};bottom:${u(-18)}}
.hud .cost{display:flex;align-items:center;gap:${u(3)};font-size:${u(30)};color:#a8ff3a}
.hud .cost[hidden]{display:none}
.hud .auto.locked{filter:grayscale(.6)}
.hud .cost svg{width:${u(30)};height:${u(30)}}
/* Tutorial quest banner (after Stone-Skipping's .quest): a studded yellow bar, its TUTORIAL /
   COMPLETE tag above and a red warning line under it when needed (tutorial.js). */
.hud .quest{position:absolute;top:${u(134)};left:50%;transform:translateX(-50%);width:${u(560)};height:${u(62)};
  box-sizing:border-box;display:flex;align-items:center;justify-content:center;
  background-color:#ffc93a;border:${u(2.5)} solid #1c1c1c;border-radius:${u(8)};
  box-shadow:inset 0 ${u(-5)} 0 rgba(0,0,0,.12);
  background-image:radial-gradient(circle at 50% 50%,rgba(255,255,255,.3) 0 22%,rgba(190,120,0,.18) 26% 32%,transparent 36%);
  background-size:${u(28)} ${u(28)}}
.hud .quest-tag{position:absolute;top:${u(-15)};font-size:${u(20)};color:#ffd84a}
.hud .quest-text{font-size:${u(34)};white-space:nowrap}
.hud .quest-warn{position:absolute;top:calc(100% + ${u(10)});left:50%;transform:translateX(-50%);
  font-size:${u(28)};color:#ff3b30;white-space:nowrap}
.hud .quest-warn:empty{display:none}
/* SKIP, off the banner's right end; above the REBIRTH NOW dim (hence the banner's z-index). */
.hud .quest{z-index:10}
.hud .quest-skip{position:absolute;left:calc(100% + ${u(12)});top:50%;margin-top:${u(-24)};height:${u(48)};padding:0 ${u(14)};
  box-sizing:border-box;border:${u(2.5)} solid #1c1c1c !important;border-radius:${u(8)};background:linear-gradient(#9aa3b5,#646d80);
  font-size:${u(24)};white-space:nowrap;box-shadow:inset 0 ${u(-4)} 0 rgba(0,0,0,.15);${outline(2.5, '#1c1c1c')}}
.hud .quest-skip:hover{filter:brightness(1.12)}
.hud .quest.leaving{animation:quest-out .5s ease-in forwards}
@keyframes quest-out{0%{opacity:1;transform:translateX(-50%) scale(1)}30%{opacity:1;transform:translateX(-50%) scale(1.15)}
  100%{opacity:0;transform:translateX(-50%) scale(.2)}}
/* REBIRTH NOW: dim the whole HUD and block it, but lift the menu with the Rebirth tile ringed
   (its neighbours stay dark), then in the window ring the confirm button. */
.hud .tdim{position:absolute;inset:0;z-index:9;background:rgba(0,0,0,.7);pointer-events:auto}
.hud .menu.spot{z-index:10}
.hud .menu.spot .tile:not([data-act="rebirth"]){filter:brightness(.3);pointer-events:none}
.hud .menu.spot [data-act="rebirth"]{box-shadow:0 0 0 ${u(5)} #ffd84a,0 0 ${u(28)} #ffd84a}
.hud .rb-go.spot{position:relative;z-index:2;box-shadow:0 0 0 ${u(5)} #ffd84a,0 0 0 200vmax rgba(0,0,0,.6)}
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
/* Rebirth confirm window, after the original game's: the Rebirth tile opens it. Two columns
   (this rebirth -> the next) of Power and MAX Level cards, the level bar, and REBIRTH, which
   only works once the level cap is reached. */
.hud .rb{position:absolute;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,.55);pointer-events:auto}
.hud .rb[hidden]{display:none}
.hud .rb-win{position:relative;width:${u(680)};max-width:92vw}
.hud .rb-title{position:absolute;top:${u(-38)};left:${u(44)};z-index:1;font-size:${u(64)};letter-spacing:${u(1)};
  pointer-events:none;${outline(5, '#111')}}
.hud .rb-close{position:absolute;top:${u(-24)};right:${u(-26)};z-index:1;width:${u(74)};height:${u(74)};
  border:${u(4)} solid #111 !important;border-radius:${u(4)};background:linear-gradient(#ff3b3b,#d4111b);
  font-size:${u(56)};box-shadow:inset 0 0 0 ${u(3)} #ff8a8a;${outline(4, '#111')}}
.hud .rb-body{display:flex;flex-direction:column;gap:${u(14)};padding:${u(62)} ${u(20)} ${u(16)};
  border:${u(4)} solid #111;border-radius:${u(6)};background:rgba(18,18,22,.84)}
.hud .rb-grid{display:grid;grid-template-columns:1fr ${u(78)} 1fr;gap:${u(12)} ${u(8)};align-items:center}
.hud .rb-head{text-align:center;font-size:${u(38)};margin-bottom:${u(-4)}}
.hud .rb-card,.hud .rb-bar{position:relative;display:flex;align-items:center;justify-content:center;
  border:${u(3)} solid #e07800;background:linear-gradient(#ffe23a,#ffb300 55%,#ff8c00);
  box-shadow:inset 0 ${u(-4)} 0 rgba(0,0,0,.12),inset 0 ${u(3)} 0 rgba(255,255,255,.35)}
.hud .rb-card{height:${u(88)};font-size:${u(38)};white-space:nowrap}
.hud .rb-card .rb-ico{position:absolute;left:50%;top:50%;width:${u(84)};height:${u(84)};transform:translate(-50%,-50%)}
.hud .rb-card span,.hud .rb-bar .rb-label{position:relative;${outline(3.5, '#1a0e00')}}
.hud .rb-ff{width:${u(70)};height:${u(56)};justify-self:center}
.hud .rb-bar{height:${u(60)};font-size:${u(40)};overflow:hidden;background:#5a3608}
.hud .rb-fill{position:absolute;inset:0 auto 0 0;background:linear-gradient(#ffe23a,#ffb300 55%,#ff8c00)}
.hud .rb-label{display:flex;align-items:center;gap:${u(12)};white-space:nowrap}
.hud .rb-label svg{width:${u(46)};height:${u(46)}}
.hud .rb-go{height:${u(96)};border:${u(3)} solid #0d6b06 !important;background:linear-gradient(#c6ff3a,#4cd61c 55%,#22b30f);
  font-size:${u(66)};letter-spacing:${u(1)};box-shadow:inset 0 ${u(3)} 0 rgba(255,255,255,.45);${outline(4.5, '#111')}}
.hud .rb-go:hover:not(:disabled){filter:brightness(1.08)}
.hud .rb-go:disabled{cursor:not-allowed;filter:grayscale(.85) brightness(.7)}
.hud .rb-note{position:absolute;left:0;right:0;top:100%;margin-top:${u(10)};text-align:center;font-size:${u(28)};
  color:#ff2b2b;white-space:nowrap;${outline(3, '#2a0000')}}
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

/* --- Right column -------------------------------------------------------------------------- */
.hud .side{position:absolute;right:${u(18)};top:50%;transform:translateY(calc(-50% + ${u(45)}));
  width:${u(212)};display:flex;flex-direction:column;align-items:center;gap:${u(30)}}
.hud .boost2{position:relative;width:${u(212)};height:${u(64)};box-sizing:border-box;border:${u(3)} solid #1a1205;
  border-radius:${u(3)};background:linear-gradient(#ffe95c,#ffc21c 55%,#ff9f0a);
  box-shadow:inset 0 ${u(3)} 0 rgba(255,255,255,.5)}
.hud .boost2 .arm{position:absolute;left:50%;top:${u(-14)};width:${u(52)};height:${u(52)};margin-left:${u(-26)}}
.hud .boost2 .label{position:relative;font-size:${u(30)}}
.hud .boost2 .cost{position:absolute;left:0;right:0;bottom:${u(-22)};justify-content:center}
/* Once bought, ON / OFF replaces the price; switched off, the button greys out. */
.hud .boost2 .state{position:absolute;left:0;right:0;bottom:${u(-22)};font-size:${u(28)};color:#ff3d1c}
.hud .boost2.x2on .state{color:#5cff3d}
.hud .boost2.owned:not(.x2on){filter:grayscale(.7) brightness(.85)}

/* --- Bottom centre ------------------------------------------------------------------------- */
.hud .power{position:absolute;left:50%;bottom:${u(22)};width:${u(540)};margin-left:${u(-270)}}
/* THROW, over the level bar while the player stands in the throw area. */
.hud .throw{display:flex;align-items:center;justify-content:center;gap:${u(12)};width:${u(300)};height:${u(78)};
  margin:0 auto ${u(14)};box-sizing:border-box;border:${u(3.5)} solid #0d3a12;border-radius:${u(3)};
  background:linear-gradient(#8ff25a,#3fcf2a 55%,#1f9e1a);box-shadow:inset 0 ${u(3)} 0 rgba(255,255,255,.5);
  font-size:${u(44)};animation:throw-ready .8s ease-in-out infinite alternate}
.hud .throw svg{width:${u(46)};height:${u(46)}}
.hud .throw:active{animation:none}
@keyframes throw-ready{to{transform:scale(1.06)}}
.hud .readout{display:flex;justify-content:space-between;font-size:${u(28)};color:#ffb21a;padding:0 ${u(2)} ${u(4)};
  ${outline(3, '#2a1000')}}
.hud .bar{position:relative;height:${u(48)};box-sizing:border-box;border:${u(3)} solid #1a1205;border-radius:${u(3)};
  background:#6b3e0a;overflow:hidden}
.hud .bar .fill{position:absolute;inset:0;right:auto;background:linear-gradient(#ffd23a,#ffb40f 55%,#ff9a05);
  box-shadow:inset 0 ${u(3)} 0 rgba(255,255,255,.45)}
.hud .bar .txt{position:absolute;inset:0;display:flex;justify-content:space-between;align-items:center;
  padding:0 ${u(8)};font-size:${u(28)}}

/* --- Small / touch screens (html.compact, device.js) ----------------------------------------
   Stats then menu down the top-left, x2 boosts top-right under the touch menu buttons: the bottom
   corners belong to the move stick and the THROW / JUMP buttons (touch.js). Clear of notches. */
html.compact .hud .stats{top:calc(${u(10)} + env(safe-area-inset-top));bottom:auto;left:calc(${u(8)} + env(safe-area-inset-left));gap:${u(6)}}
html.compact .hud .menu{top:calc(${u(150)} + env(safe-area-inset-top));left:calc(${u(17)} + env(safe-area-inset-left));transform:none}
html.compact .hud .side{top:calc(${u(24)} + 56px + env(safe-area-inset-top));right:calc(${u(18)} + env(safe-area-inset-right));transform:none;gap:${u(36)}}
html.compact .hud .power{bottom:calc(${u(14)} + env(safe-area-inset-bottom))}
/* SKIP tucks onto the banner's top-right corner: off its end it would run into the x2 boosts. */
html.compact .hud .quest-skip{left:auto;right:${u(12)};top:${u(-26)};margin-top:0;height:${u(42)};font-size:${u(22)}}
/* A fingertip-sized hit area around the small chip. */
html.touch .hud .quest-skip::before{content:'';position:absolute;inset:-10px -6px}
/* Touch has its own THROW button (touch.js), which pulses in the throw area instead. */
html.touch .hud .throw{display:none}
html.touch .hud :is(.ew-close,.pm-close){width:${u(66)};height:${u(66)};font-size:${u(34)}}
`

// Shared gradients and icon symbols; each icon is drawn once and <use>d everywhere.
const DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="hg-arm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe774"/><stop offset="1" stop-color="#ff9516"/></linearGradient>
  <linearGradient id="hg-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff07a"/><stop offset=".55" stop-color="#ffc21c"/><stop offset="1" stop-color="#f08a00"/></linearGradient>
  <linearGradient id="hg-cat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffab4a"/><stop offset="1" stop-color="#f2621a"/></linearGradient>
  <linearGradient id="hg-bag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a4a"/><stop offset="1" stop-color="#c5121c"/></linearGradient>
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

  <!-- Chop-trees-for-treasure's rebirth icon image (public/ui/rebirth.png). -->
  <symbol id="hi-rebirth" viewBox="0 0 64 64">
    <image href="${import.meta.env.BASE_URL}ui/rebirth.png" width="64" height="64"/>
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

  <symbol id="hi-trophy" viewBox="0 0 64 64">
    <path d="M17 14H8c0 12 6 17 12 17M47 14h9c0 12-6 17-12 17" fill="none" stroke="#4a2600" stroke-width="8" stroke-linejoin="round"/>
    <path d="M17 14H8c0 12 6 17 12 17M47 14h9c0 12-6 17-12 17" fill="none" stroke="#ffc21c" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M14 7h36v14c0 13-8 21-18 21S14 34 14 21Z" fill="url(#hg-gold)" stroke="#4a2600" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M27 42h10v8H27Z" fill="#f0a000" stroke="#4a2600" stroke-width="3"/>
    <rect x="17" y="49" width="30" height="10" rx="3" fill="url(#hg-gold)" stroke="#4a2600" stroke-width="3.5"/>
    <path d="M32 13l3 6.2 6.8.8-5 4.7 1.3 6.8L32 28l-6 3.5 1.3-6.8-5-4.7 6.8-.8Z" fill="#fff6c0" stroke="#c77a00" stroke-width="1.5" stroke-linejoin="round"/>
  </symbol>

  <symbol id="hi-plane" viewBox="0 0 24 24">
    <path d="M3 11.5 21 4l-6.5 16-3-6.5Z" fill="#fff" stroke="#0d3a12" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M11.5 13.5 21 4" stroke="#0d3a12" stroke-width="1.8" stroke-linecap="round"/>
  </symbol>
  <linearGradient id="hg-ff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2fcff"/><stop offset=".5" stop-color="#9fe2ff"/><stop offset="1" stop-color="#3fa9f5"/></linearGradient>
  <symbol id="hi-lvlstar" viewBox="0 0 64 64">
    <path d="M32 4l8.4 17.4 19.2 2.6-14 13.4 3.4 19L32 47.2 15 56.4l3.4-19-14-13.4 19.2-2.6Z"
      fill="url(#hg-gold)" stroke="#8a4a00" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M24 22l5-10" stroke="#fff8c8" stroke-width="3" stroke-linecap="round"/>
  </symbol>
  <symbol id="hi-ff" viewBox="0 0 80 64">
    <g fill="url(#hg-ff)" stroke="#1f6fbf" stroke-width="4" stroke-linejoin="round">
      <path d="M6 8 36 32 6 56Z"/><path d="M38 8 74 32 38 56Z"/>
    </g>
    <path d="M12 18 28 31M44 18 64 31" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>
  </symbol>
</defs></svg>`

const icon = (id, cls = '') => `<svg class="${cls}"><use href="#hi-${id}"/></svg>`
const cost = (key, ico = 'gem') => `<span class="cost t">${icon(ico)}<span data-price="${key}"></span></span>`

const MARKUP = `
${DEFS}
<button class="auto" data-act="autoThrow">
  ${icon('cycle', 'cycle')}
  <span class="label">Auto Throw</span>
  <span class="state t" data-k="autoThrow"></span>
  ${cost('autoThrow', 'trophy')}
</button>
<div class="quest" hidden><div class="quest-tag t"></div><div class="quest-text t"></div><div class="quest-warn t"></div><button class="quest-skip" data-act="skipTutorial" hidden>SKIP</button></div>
<div class="tdim" hidden></div>
<div class="flight" data-k="flight"></div>
<div class="zonepop"><div class="name t"></div><div class="sub t"></div></div>

<div class="menu">
  <button class="tile" data-act="pets">${icon('cat')}<span class="name t">Pets</span></button>
  <button class="tile" data-act="rebirth"><span class="pct t" data-k="rebirthProgress"></span>${icon('rebirth')}<span class="name t">Rebirth</span></button>
  <button class="tile" data-act="items">${icon('bag')}<span class="name t">Items</span></button>
</div>

<div class="stats">
  <div class="stat">${icon('trophy')}<span data-k="wins"></span></div>
  <div class="stat">${icon('rebirth')}<span data-k="rebirths"></span></div>
</div>

<div class="side">
  <button class="boost2" data-act="x2Power" data-x2="power">${icon('arm', 'arm')}<span class="label t">x2 Power</span>${cost('x2Power', 'trophy')}<span class="state t"></span></button>
  <button class="boost2" data-act="x2Wins" data-x2="wins">${icon('arm', 'arm')}<span class="label t">x2 Wins</span>${cost('x2Wins', 'trophy')}<span class="state t"></span></button>
</div>

<div class="power">
  <button class="throw" data-act="throw" hidden>${icon('plane')}<span class="t">THROW</span></button>
  <div class="readout"><span>Power: <span data-k="power"></span></span><span>Multiplier: <span data-k="multiplier"></span></span></div>
  <div class="bar"><div class="fill"></div><div class="txt t"><span>LEVEL <span data-k="level"></span></span><span data-k="maxLevel"></span></div></div>
</div>

<div class="rb" hidden>
  <div class="rb-win" role="dialog" aria-label="Rebirth">
    <span class="rb-title">REBIRTH</span>
    <button class="rb-close" data-act="rebirthClose" aria-label="Close">X</button>
    <div class="rb-body">
      <div class="rb-grid">
        <div class="rb-head t" data-rb="fromHead"></div><div></div><div class="rb-head t" data-rb="toHead"></div>
        <div class="rb-card">${icon('arm', 'rb-ico')}<span data-rb="fromPower"></span></div>
        ${icon('ff', 'rb-ff')}
        <div class="rb-card">${icon('arm', 'rb-ico')}<span data-rb="toPower"></span></div>
        <div class="rb-card">${icon('lvlstar', 'rb-ico')}<span data-rb="fromMax"></span></div>
        ${icon('ff', 'rb-ff')}
        <div class="rb-card">${icon('lvlstar', 'rb-ico')}<span data-rb="toMax"></span></div>
      </div>
      <div class="rb-bar"><div class="rb-fill"></div><span class="rb-label">${icon('lvlstar')}<span data-rb="level"></span></span></div>
      <button class="rb-go" data-act="rebirthConfirm">REBIRTH</button>
    </div>
    <div class="rb-note">Rebirth resets Power &amp; Levels. Wins, Planes and Pets stay!</div>
  </div>
</div>`

// A multiplier with pets in it: 1.35 -> "1.35", 2 -> "2", 1234.5 -> "1.2K".
export const formatMultiplier = (v) => (v >= 1000 ? formatNumber(v) : String(+v.toFixed(2)))

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
  multiplier: (v) => `x${formatMultiplier(v)}`,
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
    autoThrowOwned: g.autoThrowOwned,
  }
}

// Builds the HUD. `actions` maps a button name (data-act) to a handler; Auto Throw acts on the
// store itself, and Rebirth opens the confirm window, which does. Returns { root, state, set(patch), setAlert(name, on), showPopup(name, sub, tone), floatGain(text), setQuest(view) }.
export function createHud(actions = {}) {
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  const root = document.createElement('div')
  root.className = 'hud'
  root.innerHTML = MARKUP
  document.body.appendChild(root)

  const fit = () => {
    const refHeight = document.documentElement.classList.contains('compact') ? HUD.compactRefHeight : HUD.refHeight
    const s = Math.min(window.innerWidth / HUD.refWidth, window.innerHeight / refHeight, HUD.maxScale)
    root.style.setProperty('--u', `${s}px`)
  }
  window.addEventListener('resize', fit)
  fit()

  for (const el of root.querySelectorAll('[data-price]')) el.textContent = formatNumber(HUD.prices[el.dataset.price])

  const state = { ...HUD.start, alerts: { ...HUD.start.alerts }, flight: '', canThrow: false, ...progressFields(game) }
  const fields = [...root.querySelectorAll('[data-k]')]
  const autoBtn = root.querySelector('.auto')
  const autoCost = autoBtn.querySelector('.cost')
  const autoState = autoBtn.querySelector('.state')
  const throwBtn = root.querySelector('.throw')
  const fill = root.querySelector('.bar .fill')
  const rebirthTile = root.querySelector('[data-act="rebirth"]')
  const x2Btns = [...root.querySelectorAll('[data-x2]')]

  function render() {
    for (const el of fields) {
      const v = state[el.dataset.k]
      el.textContent = FORMAT[el.dataset.k] ? FORMAT[el.dataset.k](v) : v
    }
    autoBtn.classList.toggle('on', state.autoThrow)
    autoBtn.classList.toggle('locked', !state.autoThrowOwned)
    autoCost.hidden = state.autoThrowOwned
    autoState.hidden = !state.autoThrowOwned
    throwBtn.hidden = !state.canThrow
    document.documentElement.classList.toggle('can-throw', state.canThrow) // touch.js pulses its THROW
    for (const btn of x2Btns) {
      const stat = btn.dataset.x2
      const owned = game.x2Owned[stat]
      const on = owned && game.x2On[stat]
      btn.classList.toggle('owned', owned)
      btn.classList.toggle('x2on', on)
      btn.querySelector('.cost').hidden = owned
      const label = btn.querySelector('.state')
      label.hidden = !owned
      label.textContent = on ? 'ON' : 'OFF'
    }
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

  // Every button (here and in the windows built into this root) gives a tactile click as it
  // goes down; what it then does may add its own sound. THROW sounds like the throw instead.
  root.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button')
    if (b && !b.disabled && b.dataset.act !== 'throw') sfx.click()
  })

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]')
    if (!btn) return
    const act = btn.dataset.act
    if (act === 'autoThrow') {
      if (game.autoThrowOwned) {
        setAutoThrow(!game.autoThrow)
        if (game.autoThrow) sfx.toggleOn()
        else sfx.toggleOff()
      } else if (buyAutoThrow(HUD.prices.autoThrow)) sfx.buy()
      else sfx.denied()
    }
    // x2 Power / x2 Wins: bought once with Wins (switched on), then ON / OFF like Auto Throw.
    const x2 = btn.dataset.x2
    if (x2) {
      if (game.x2Owned[x2]) {
        setX2(x2, !game.x2On[x2])
        if (game.x2On[x2]) sfx.toggleOn()
        else sfx.toggleOff()
      } else if (buyX2(x2, HUD.prices[act])) {
        sfx.buy()
        showPopup(`x2 ${x2 === 'power' ? 'Power' : 'Wins'} bought!`, 'Tap it to switch it on or off', 'good')
      } else {
        sfx.denied()
        showPopup(`🏆 ${formatNumber(HUD.prices[act])} Wins`, `needed: you have ${formatNumber(game.wins)}`, 'bad')
      }
    }
    if (act === 'skipTutorial') skipTutorial()
    if (act === 'rebirth') openRebirth(true)
    if (act === 'rebirthClose') openRebirth(false)
    if (act === 'rebirthConfirm' && acceptRebirth()) {
      sfx.rebirth()
      openRebirth(false, true)
    }
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
    // The next rebirth swaps this one's (rebirths + 1) factor for (rebirths + 2); pets and boosts carry over.
    const mult = powerMultiplier()
    rbField('fromHead').textContent = `Rebirth ${formatNumber(g.rebirths)}:`
    rbField('toHead').textContent = `Rebirth ${formatNumber(g.rebirths + 1)}:`
    rbField('fromPower').textContent = `X${formatMultiplier(mult)} Power`
    rbField('toPower').textContent = `X${formatMultiplier((mult / (g.rebirths + 1)) * (g.rebirths + 2))} Power`
    rbField('fromMax').textContent = `MAX Level ${formatNumber(need)}`
    rbField('toMax').textContent = `MAX Level ${formatNumber(rebirthLevelsRequired(g.rebirths + 1))}`
    rbField('level').textContent = ready ? `Level ${formatNumber(need)} COMPLETE` : `Level ${formatNumber(level)} / ${formatNumber(need)}`
    rbFill.style.width = `${ready ? 100 : rebirthProgress(g.power, g.rebirths) * 100}%`
    rb.querySelector('.rb-go').disabled = !ready
  }
  // `quiet` skips the closing swoosh (a rebirth has its own sound).
  function openRebirth(open, quiet = false) {
    if (open === rb.hidden && !quiet) (open ? sfx.open : sfx.close)()
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

  // --- Tutorial (tutorial.js's stepTutorial view, every frame; only real changes touch the DOM)
  const quest = root.querySelector('.quest')
  const questTag = quest.querySelector('.quest-tag')
  const questText = quest.querySelector('.quest-text')
  const questWarn = quest.querySelector('.quest-warn')
  const questSkip = quest.querySelector('.quest-skip')
  const dim = root.querySelector('.tdim')
  const menu = root.querySelector('.menu')
  const confirmBtn = rb.querySelector('.rb-go')
  let lastQuest = ''
  function setQuest({ banner, spotlight }) {
    const key = JSON.stringify([banner, spotlight])
    if (key === lastQuest) return
    lastQuest = key
    quest.hidden = !banner
    if (banner) {
      questTag.textContent = banner.tag
      questText.textContent = banner.text
      questWarn.textContent = banner.warn
      quest.classList.toggle('leaving', banner.leaving)
      questSkip.hidden = banner.tag !== 'TUTORIAL'
    }
    dim.hidden = !spotlight
    menu.classList.toggle('spot', spotlight)
    confirmBtn.classList.toggle('spot', spotlight)
  }

  return { root, state, set, setAlert, showPopup, floatGain, setQuest }
}
