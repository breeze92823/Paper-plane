import { Clock, Group, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { CAMERA, GRAPHICS_PRESETS, SPAWN, SPAWN_FACING, STREET_ZONES } from './config.js'
import * as bloxity from './bloxity.js'
import { inputState, install as installInput } from './input.js'
import { createTouchControls } from './touch.js'
import { isTouch } from './device.js'
import { createHud, formatNumber } from './hud.js'
import { player, resetPlayer, step as stepPlayer } from './player.js'
import { syncYawToPlayer, update as updateCamera } from './camera.js'
import { createFog, createGround, createLights, createSky } from './world.js'
import { createMap } from './map.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { HeldPlane } from './avatar/heldPlane.js'
import * as store from './store.js'
import { flights, getTrackedFlight, stepFlights, stepThrow, takePowerGains, takeTosses, takeZonesEntered, trackedReadout } from './throw.js'
import { PLANES, stepPads, takePadMessages } from './pads.js'
import { ThrownPlanes } from './thrownPlanes.js'
import * as net from './net.js'
import { RemotePlayers } from './remotePlayers.js'

// --- Bloxity + player state -----------------------------------------------
bloxity.init()
net.init() // waits for auth itself; the game never waits on the server
resetPlayer(SPAWN, SPAWN_FACING)
syncYawToPlayer()

// --- Renderer / scene -------------------------------------------------------
const basePreset = GRAPHICS_PRESETS[bloxity.settings.graphics_quality] ?? GRAPHICS_PRESETS.High
// Phones: no MSAA and a capped pixel ratio keep a steady frame rate.
const preset = isTouch ? { ...basePreset, antialias: false, dpr: Math.min(basePreset.dpr, 1.5) } : basePreset

const renderer = new WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.shadowMap.enabled = preset.shadows
renderer.shadowMap.type = PCFSoftShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr))
document.body.appendChild(renderer.domElement)
installInput(bloxity.showMenu, renderer.domElement)
createTouchControls()
const hud = createHud()

const scene = new Scene()
scene.fog = createFog()
const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
camera.position.set(0, 12, 24)

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

const sky = createSky()
scene.add(sky, createGround())
const map = createMap()
scene.add(map.root)
const lights = createLights()
scene.add(lights.hemi, lights.sun, lights.sun.target)

// --- Player avatar ----------------------------------------------------------
// Always the game's own character (player.glb, or the procedural fallback). A
// signed-in player's equipped Bloxity cosmetics are attached to it and the
// customizer's body proportions applied; it rebuilds on customizer edits and
// sign-in/out.
const playerGroup = new Group()
scene.add(playerGroup)
// The paper plane in the right hand; world-space, it follows a socket on the fist.
const heldPlane = new HeldPlane()
// The plane in hand is the equipped one's colour.
const tintHeldPlane = (g) => heldPlane.setColor(PLANES[g.equippedPlane].plane)
tintHeldPlane(store.game)
store.subscribe(tintHeldPlane)
scene.add(heldPlane.object)
const thrownPlanes = new ThrownPlanes()
scene.add(thrownPlanes.object)
// Everyone else in the lobby (net.js); empty while playing solo.
const remotePlayers = new RemotePlayers()
scene.add(remotePlayers.object)

let avatar = null
let animator = null
let generation = 0

function setAvatar(next) {
  if (avatar) playerGroup.remove(avatar)
  disposeAnimator(animator)
  avatar = next
  playerGroup.add(avatar)
  heldPlane.attach(avatar) // both bind against the rig's rest pose, before the first update
  animator = makeAnimator(avatar, { carrying: true })
}

setAvatar(buildDefaultCharacter()) // visible immediately; replaced once the rig loads

async function loadAvatar() {
  // The SDK fires twice per change (optimistic + confirmed); only the newest load may land.
  const mine = ++generation
  const group = await loadBaseCharacter()
  if (mine !== generation) return
  const equipped = bloxity.authState.user ? bloxity.getEquippedAvatar() : null
  await attachEquippedAccessories(group, equipped, { skinTextureUrl: bloxity.getSkinTextureUrl() })
  if (mine !== generation) return
  applyProportions(group, bloxity.getProportions())
  setAvatar(group)
}

let signedIn = null
bloxity.subscribeAuth((s) => {
  const now = !!s.user
  if (now !== signedIn) {
    signedIn = now
    loadAvatar() // also runs once at start to swap in the real rig
  }
})
bloxity.onAvatarChanged(loadAvatar)
bloxity.onProportionsChanged(() => applyProportions(avatar, bloxity.getProportions()))
bloxity.onSetting((key, value) => {
  if (key === 'graphics_quality') renderer.shadowMap.enabled = (GRAPHICS_PRESETS[value] ?? GRAPHICS_PRESETS.High).shadows
})

// --- Street throw readout ------------------------------------------------------
// "123 m", then "+N Wins" once it lands (and "NEW BEST!" past the best), under the objective. Ten updates a second, so the
// HUD isn't rebuilt every frame.
let readoutTimer = 0
let readoutText = ''
function showFlight(dt) {
  // A zone the chased plane just flew into pops up at once; "NEW ZONE!" the first time ever.
  for (const { index, first } of takeZonesEntered()) {
    const zone = STREET_ZONES[index]
    hud.showPopup(`${zone.icon} ${zone.label}`, first ? 'NEW ZONE!' : `${zone.startD.toLocaleString('en-US')} m`, first ? 'good' : null)
  }
  for (const { title, sub, tone } of takePadMessages()) hud.showPopup(title, sub, tone)
  for (const gain of takePowerGains()) hud.floatGain(`+${formatNumber(gain)} 💪`)
  readoutTimer -= dt
  if (readoutTimer > 0) return
  readoutTimer = 0.1
  const r = trackedReadout()
  const metres = r && `${Math.floor(r.metres).toLocaleString('en-US')} m`
  const text = !r ? '' : r.wins === null ? metres : `${metres}  +${formatNumber(r.wins)} ${r.wins === 1 ? 'Win' : 'Wins'}${r.newBest ? '  NEW BEST!' : ''}`
  if (text !== readoutText) hud.set({ flight: (readoutText = text) })
}

// --- Loop -------------------------------------------------------------------
const clock = new Clock()
const MAX_PHYSICS_STEP = 1 / 60

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1) // clamp huge frames (tab switch, breakpoint)
  stepThrow(dt, animator, heldPlane)
  // Fixed-size physics substeps so a slow frame cannot tunnel through a thin wall.
  const substeps = Math.ceil(dt / MAX_PHYSICS_STEP)
  for (let i = 0; i < substeps; i++) stepPlayer(dt / substeps)
  stepPads()

  playerGroup.position.set(player.position.x, player.position.y, player.position.z)
  playerGroup.rotation.y = player.facing // player.js turns the heading at a fixed rate
  animator?.update(dt, {
    grounded: player.grounded,
    speed: Math.hypot(player.velocity.x, player.velocity.z),
    verticalVelocity: player.velocity.y,
    turn: inputState.move.x,
  })
  heldPlane.update(dt, {
    facing: player.facing,
    grounded: player.grounded,
    fly: animator?.fly ?? 0,
    inspect: animator?.inspect ?? 0,
    wristYaw: animator?.wristYaw ?? 0,
  })
  net.reportLocal(dt)
  for (const toss of takeTosses()) net.reportToss(toss)
  remotePlayers.update(dt)
  stepFlights(dt)
  thrownPlanes.update(dt)

  map.update(dt)
  const tracked = getTrackedFlight()
  updateCamera(camera, dt, tracked)
  if (import.meta.env.DEV) window.__game?.cameraOverride?.(camera) // e.g. a close-up while tuning the avatar
  // The sun's shadow box goes where the camera is looking: the plane, while one is chased.
  const focus = tracked ? tracked.position : player.position
  lights.follow(focus.x, focus.z)
  sky.position.set(camera.position.x, 0, camera.position.z) // the dome is finite; keep the camera inside it
  showFlight(dt)
  renderer.render(scene, camera)
  bloxity.notifyFirstFrame()
})

window.addEventListener('beforeunload', () => {
  net.teardown() // final save first, while the SDK identity is still known
  bloxity.teardown()
})

// Dev-only console hooks, e.g. __game.teleport(10, 0, -5), __game.look(0, -80) (mouse
// pixels) or __game.store.grantPower(5000); __game.store.game is the live progress.
if (import.meta.env.DEV) {
  window.__game = {
    player,
    hud,
    store,
    net,
    remotePlayers,
    flights,
    avatar: () => avatar,
    animator: () => animator,
    heldPlane,
    teleport: (x, y, z, facing = player.facing) => { resetPlayer({ x, y, z }, facing); syncYawToPlayer() },
    look: (dx, dy) => { inputState.look.dx += dx; inputState.look.dy += dy },
  }
}
