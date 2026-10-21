// The onboarding quest, after Stone-Skipping's (components/Hud.jsx + GuideArrows.jsx):
//   0 GET 30 POWER      throw at the FREE training pad's prize
//   1 GET 3 WINS        throw up the street from the Throw Area
//   2 EQUIP A NEW PLANE buy the +2 plane in the Plane Hall
//   3 REACH LEVEL 20    back to the training pad
//   4 REBIRTH NOW       the screen dims but for the Rebirth tile, then the confirm button
//   5 TUTORIAL COMPLETE the banner lingers, then pops out
// The step lives in the store (saved by net.js) and only moves forward; it advances the
// moment its goal is met, so a player who is already past several catches up at once.
// stepTutorial() gives main.js what to show this frame: the banner and the arrows' target.
import { TUTORIAL as T } from './config.js'
import { formatNumber } from './hud.js'
import { padState } from './pads.js'
import { player } from './player.js'
import { isInThrowArea } from './throw.js'
import { advanceTutorial, game, subscribe } from './store.js'

function check(g) {
  const s = g.tutorialStep
  if (s === 0 && g.power >= T.power) advanceTutorial(1)
  else if (s === 1 && g.wins >= T.wins) advanceTutorial(2)
  else if (s === 2 && g.equippedPlane !== 0) advanceTutorial(3)
  else if (s === 3 && g.level >= T.level) advanceTutorial(4)
  else if (s === 4 && g.rebirths >= 1) advanceTutorial(T.doneStep)
}
subscribe(check)
check(game)

const progress = (have, need) => `(${formatNumber(Math.min(have, need))}/${formatNumber(need)})`

function questText(g) {
  switch (g.tutorialStep) {
    case 0:
      return `GET ${T.power} POWER ${progress(g.power, T.power)}`
    case 1:
      return `GET ${T.wins} WINS ${progress(g.wins, T.wins)}`
    case 2:
      return 'EQUIP A NEW PLANE'
    case 3:
      return `REACH LEVEL ${T.level} ${progress(g.level, T.level)}`
    case 4:
      return 'REBIRTH NOW'
    default:
      return 'TUTORIAL COMPLETE'
  }
}

let completeFor = 0 // s the COMPLETE banner has been up

// { banner: null | { tag, text, warn, leaving }, target: null | { x, z }, spotlight }
// `spotlight` dims the HUD down to the Rebirth tile (and the window's confirm button).
export function stepTutorial(dt) {
  const g = game
  const step = g.tutorialStep
  if (!g.progressKnown) return { banner: null, target: null, spotlight: false }

  let banner = null
  if (step < T.doneStep) {
    // Throwing on a training pad pays Power, not Wins: say where Wins come from.
    const warn = step === 1 && padState.training ? 'THROW FROM THE THROW AREA FOR WINS' : ''
    banner = { tag: 'TUTORIAL', text: questText(g), warn, leaving: false }
  } else if (!g.tutorialResumedDone) {
    completeFor += dt
    const linger = T.completeLingerMs / 1000
    if (completeFor < linger + 0.5) banner = { tag: 'COMPLETE', text: questText(g), warn: '', leaving: completeFor >= linger }
  }

  // The trail hides once the player is where it leads.
  let target = T.targets[step] ?? null
  const p = player.position
  if (target && (step === 0 || step === 3) && padState.training?.index === 0) target = null
  if (target && step === 1 && isInThrowArea(p.x, p.z)) target = null
  return { banner, target, spotlight: step === 4 }
}
