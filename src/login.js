// "Log in with Bloxity" button (after Dig-sand-adventure's login.js): shown only while
// nobody is signed in, hidden once auth.user exists. Also hidden until auth has settled
// (so it doesn't flash during loading), in VITE_DEV_MODE (no SDK), and while a window is
// open (touch.js's MODALS). Top-right: the HUD owns the top centre (Auto Throw) and bottom centre (Power);
// on touch it sits left of the menu / fullscreen buttons (touch.js).
import { DEV_MODE } from './config.js'
import { sdk, subscribeAuth } from './bloxity.js'
import { FONT } from './hud.js'

const PORTAL_URL = 'https://bloxity.io'

const STYLE = `
.bx-login{position:fixed;z-index:5;top:calc(14px + env(safe-area-inset-top));right:calc(18px + env(safe-area-inset-right));
  padding:10px 20px;border:3px solid #0b1d3f;border-radius:12px;background:linear-gradient(#ffe36a,#ffc21c 55%,#f5a300);
  color:#0b1d3f;font:700 18px ${FONT};white-space:nowrap;cursor:pointer;box-shadow:inset 0 3px 0 rgba(255,255,255,.5),0 4px 0 #0b1d3f;
  touch-action:manipulation;transition:transform .08s ease-out}
.bx-login:active{transform:translateY(2px) scale(.96)}
.bx-login[hidden],html:has(.hud :is(.pm,.hz,.rb,.iw,.dw):not([hidden])) .bx-login{display:none}
html.compact .bx-login{padding:5px 11px;font-size:14px;border-radius:10px}
html.touch .bx-login{top:calc(16px + env(safe-area-inset-top));right:calc(114px + env(safe-area-inset-right))}
`

function openLogin() {
  // Must run synchronously inside the click handler or browsers block the standalone popup.
  // showAuthPopup() picks the in-game modal (embedded) or the bloxity.io/auth popup
  // (standalone); the flow finishes by firing onUserChanged, so the promise is ignored.
  const auth = sdk()?.auth
  for (const name of ['showAuthPopup', 'showAuthModal', 'showAuthWindow']) {
    if (typeof auth?.[name] !== 'function') continue
    try {
      const result = auth[name]()
      if (result && typeof result.catch === 'function') result.catch(() => {})
      return
    } catch (err) {
      console.warn(`[bloxity] auth.${name} failed`, err)
    }
  }
  window.open(PORTAL_URL, '_blank', 'noopener')
}

export function createLoginButton() {
  if (DEV_MODE) return
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'bx-login'
  btn.hidden = true
  btn.addEventListener('click', openLogin)
  document.body.appendChild(btn)

  const label = () => (btn.textContent = document.documentElement.classList.contains('compact') ? 'Log in' : 'Log in with Bloxity')
  label()
  window.addEventListener('resize', label)
  subscribeAuth((s) => {
    btn.hidden = !s.ready || !!s.user
  })
}
