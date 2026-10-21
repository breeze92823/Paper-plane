// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'paper-plane' // slug registered on bloxity.io
export const GAME_TITLE = 'Paper Plane'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

// --- Multiplayer (net.js, remotePlayers.js) -----------------------------------
// The game is single-player-complete: a slow or absent server only means playing solo.
// Paper-plane-backend deploys to two Bloxity Legion channels (`dev` -> dev, `main` ->
// prod), so the two URLs come from separate env vars and Vite's MODE picks one. Its
// local `npm start` listens on ws://localhost:2567, the dev fallback. An empty prod URL
// (not deployed yet) keeps production builds solo.
const SERVER_URL_DEV = import.meta.env.VITE_SERVER_URL_DEV || 'ws://localhost:2567'
const SERVER_URL_MAIN = import.meta.env.VITE_SERVER_URL_MAIN || ''
export const NET = {
  serverUrl: import.meta.env.MODE === 'production' ? SERVER_URL_MAIN : SERVER_URL_DEV,
  room: 'lobby', // the room registered in Paper-plane-backend's app.config.ts
  joinTimeoutMs: 45_000, // one join attempt is abandoned after this (covers a cold host boot)
  retryBackoffMs: [3_000, 6_000, 12_000, 20_000, 30_000], // between connect attempts; clamps to the last
  moveSendIntervalMs: 80, // ceiling on `move` packets; nothing is sent while standing still
  statsDebounceMs: 1_000, // live stats (leaderboards)
  progressDebounceMs: 3_000, // durable save (Mongo), signed-in players only
  authWaitMs: 8_000, // wait this long for Bloxity auth so a signed-in player joins under their id
}
export const REMOTE_PLAYER = {
  lerpRate: 0.0008, // fraction of the gap to a remote player's last sample left after 1 s
  airborneSpeed: 2.5, // m/s of smoothed vertical speed that reads as a jump/fall
  nametagY: 2.35, // m above the feet
  nametagHeight: 0.42, // m
}

// --- World (metres: +X east, +Z south, +Y up) -------------------------------
export const GROUND_Y = 0
export const GROUND_SIZE = 400 // square grass ground, centred on the origin
export const WORLD_BOUNDS = { minX: -190, maxX: 190, minZ: -190, maxZ: 190 }
export const SPAWN = { x: 0, y: 0.3, z: 12 } // on the plaza, facing the Neighbourhood street
export const SPAWN_FACING = Math.PI // yaw the character faces on spawn (PI = toward +Z, the camera)
export const STEP_UP = 0.6 // tallest ledge the player walks up without jumping

// --- Physics feel (player.js) -----------------------------------------------
export const PHYSICS = {
  moveSpeed: 10, // m/s on flat ground
  accel: 75, // m/s^2 toward the target velocity (full speed in ~0.13 s)
  decel: 69, // m/s^2 when no key is held
  turnSpeed: 12, // rad/s the body turns toward its heading
  gravity: -22, // m/s^2
  jumpSpeed: 7.5, // m/s
  killY: -30, // fell this far below the ground: respawn
}
export const PLAYER_DIMS = { radius: 0.4, height: 1.8 }

// --- Look ------------------------------------------------------------------
export const COLORS = {
  horizon: '#c4ecff',
  zenith: '#4aa6ee',
  grass: '#4cc23e',
  grassDark: '#3aa830',
}
export const FOG = { near: 90, far: 260 }
export const LIGHT = {
  sunColor: '#fff2d6',
  sunIntensity: 2.4,
  sunPosition: [30, 60, 20],
  shadowMapSize: 2048,
  shadowRange: 40, // half-width of the shadow frustum around the player
  hemiSky: '#e4f1ff',
  hemiGround: '#b9a98a',
  hemiIntensity: 1.1,
}

// The lobby's palette (map.js, props.js, terrain.js).
export const PALETTE = {
  grass: '#62d04a',
  grassAlt: '#5bc744',
  grassTop: '#6bd54d',
  dirt: '#c4925a',
  plaza: '#ece8a6',
  plazaPath: '#eed37a',
  plazaEdge: '#d2ae4a',
  field: '#5dd25a',
  road: '#5f6672',
  sidewalk: '#e8ebef',
  stone: '#5b6270',
  white: '#f3f5f7',
  hallShell: '#e9f4fb',
  whiteShade: '#e3e8ed',
  trimBlue: '#2c8cec',
  padRed: '#ef2c36',
  padEquipped: '#ffd21f',
  padOwned: '#3cd35a',
  padBase: '#9b1620',
  chevron: '#f7a21b',
  arrow: '#ffffff',
  arrowEdge: '#b9b2a0',
  trunk: '#7a4b2a',
  leaf: '#3cb83a',
  leafLight: '#58d046',
  water: '#4fc3f2',
  lamp: '#3a3f47',
  lampLight: '#ffe58a',
  ice: '#bfeeff',
  portal: '#3f8ff5',
  eggPad: '#8fd8f7',
  pedestal: '#4a1418',
  pedestalRim: '#c3202b',
  ringYellow: '#ffd21f',
  dragon: '#d21c2a',
  rewardBase: '#5a0f16',
  board: '#1d2a4a',
  eggBand: '#2c8cec',
  waterfall: '#5fd0ff',
}

// Lobby layout, metres. North (-Z) is the throw area and the field up to the Neighbourhood
// gate, south (+Z) the egg row under the waterfall cliff; the plane hall is west, the
// rebirth training pads east.
export const MAP = {
  plaza: { minX: -60, maxX: 34, minZ: -28, maxZ: 40 },
  // Deeper-yellow stepped walkway, (x, z) corners clockwise from the throw area: the throw
  // area across the field mouth, a lane south from it, a band across the spawn from the hall
  // floor to the training pads, a lane south to the eggs.
  path: [
    [-14, -35], [14, -35], [14, -28], [5, -28], [5, -12], [9, -12], [9, -4], [16, -4], [16, 17.5], [13, 17.5], [13, 19], [9, 19], [9, 21], [6, 21], [6, 27], [14, 27], [14, 38],
    [-14, 38], [-14, 27], [-6, 27], [-6, 21], [-9, 21], [-9, 19], [-13, 19], [-13, 17.5], [-20, 17.5],
    [-20, -2], [-16, -2], [-16, -4], [-9, -4], [-9, -12], [-5, -12], [-5, -28], [-14, -28],
  ],
  // Where players stand to throw: the walkway strip across the field mouth, its name painted
  // on the floor. A throw from inside [minX, maxX] x [minZ, maxZ] flies up the street (throw.js).
  throwArea: { z: -31.5, label: 'THROW AREA', labelWidth: 19, minX: -14, maxX: 14, minZ: -35, maxZ: -28 },
  // The throwing field north of it: green from startZ, an asphalt road (x +- roadHalf)
  // from roadZ to endZ, white sidewalks and stone fences either side, the gate at gateZ.
  field: { halfWidth: 12, sidewalk: 1.6, startZ: -35, roadZ: -76, roadHalf: 7, endZ: -112, gateZ: -104 },
  // Ground the hills keep clear of: plaza (with the plane hall), and the street corridor all
  // the way up (x +- STREET.corridorHalf, past the far end); street.js lines it from z = -112.
  open: [
    { minX: -66, maxX: 34, minZ: -32, maxZ: 40 },
    { minX: -42, maxX: 42, minZ: -3600, maxZ: -32 },
  ],
  // Hills past these lines (south of z = 40, east of x = 34) climb `slope` times as steeply
  // plus `add` metres: the tall cliffs behind the eggs and the training pads. Their three
  // lowest faces stay even (south: z = 44, 52, 60 at 15, 20, 25 m) for the waterfall cascade.
  cliff: { past: [['z', 40], ['x', 34]], add: 10, slope: 2, maxH: 40 },
  // Low grass banks either side of the throw area: { x, z, w, d, h }.
  banks: [
    { x: -26, z: -33.5, w: 24, d: 9, h: 1.6 },
    { x: 26, z: -33.5, w: 24, d: 9, h: 1.6 },
  ],
  // Free-standing trees on the flat: [x, z, scale, kind] (kind 'oak', else a pine).
  trees: [
    [-40, -40, 1.3, 'oak'], [40, -37, 1.2, 'oak'], [-40, -62, 1.3], [40, -60, 1.3],
    [-40, -108, 1.4], [40, -108, 1.4], [-58, -28, 1.6],
  ],
  // Beside the field. The school's front faces the plaza; its entrance, sign and clock
  // tower are on its east end, toward the field.
  school: { x: -26, z: -50, w: 22, d: 12, h: 12 },
  pencil: { x: -15.8, z: -42.6 },
  court: { x: 28, z: -48, w: 20, d: 14 },
  // Picnic benches: [x, z, yaw].
  benches: [[-16, -40, Math.PI / 2], [16, -44, Math.PI / 2], [16, -52, Math.PI / 2]],
  // Houses up the field. rot turns the front (+Z face, with the door) toward the field.
  houses: [
    { x: -26, z: -70, w: 11, d: 10, h: 7, wall: '#86c9ec', floors: 2, cols: 3, roof: 'gable', roofColor: '#2d6fb8', rot: Math.PI / 2 },
    { x: -26, z: -86, w: 10, d: 9, h: 6, wall: '#f4efe6', floors: 2, cols: 3, roof: 'gable', roofColor: '#d0473b', rot: Math.PI / 2 },
    { x: -27, z: -101, w: 10, d: 10, h: 10, wall: '#f0d9a8', floors: 3, cols: 3, roofColor: '#9a6b3c', rot: Math.PI / 2 },
    { x: 27, z: -68, w: 11, d: 9, h: 8, wall: '#e9f3f6', glass: '#5fb8f2', floors: 2, cols: 3, roof: 'gable', roofColor: '#2fa3a0', rot: -Math.PI / 2 },
    { x: 27, z: -84, w: 10, d: 9, h: 6, wall: '#f6c9d2', floors: 2, cols: 3, roof: 'gable', roofColor: '#8a4fd1', rot: -Math.PI / 2 },
    { x: 27, z: -100, w: 9, d: 9, h: 7, wall: '#fff1c9', floors: 2, cols: 2, roof: 'gable', roofColor: '#3fa65a', rot: -Math.PI / 2 },
  ],
  // Low elliptical half-tube whose mouth (x) faces the plaza, arching over z +- halfWidth
  // and `height` high, running `length` west to a closed back wall.
  hall: { mouthX: -22, z: 8, halfWidth: 21, height: 11, length: 40 },
  // Floor steps inside the hall, [minX, maxX, top height, colour], across z = hall.z +- floorHalf:
  // white floor, a step, the navy front-row platform, two steps, the raised back-row platform.
  hallFloorHalf: 19.5,
  hallFloors: [
    [-62, -20, 0.5, '#f3f5f7'],
    [-31.5, -29.5, 1, '#f3f5f7'],
    [-38, -31.5, 1.5, '#25335e'],
    [-39.5, -38, 2, '#25335e'],
    [-41, -39.5, 2.5, '#25335e'],
    [-49, -41, 3, '#25335e'],
  ],
  // Purchase pads in two rows across the hall, south to north; the back row stands before
  // display frames. Step on one to buy its plane for `wins` (or equip it, once owned): every
  // throw from a training pad earns its `power`, and it flies in its `plane` colour. wins: null
  // = owned from the start.
  pads: [
    { x: -34.75, z: 21, power: '+1', wins: null, plane: '#ffffff' },
    { x: -34.75, z: 14.5, power: '+2', wins: '3', plane: '#9fd8ff' },
    { x: -34.75, z: 8, power: '+5', wins: '25', plane: '#9cf08f' },
    { x: -34.75, z: 1.5, power: '+11', wins: '110', plane: '#ffd36b' },
    { x: -34.75, z: -5, power: '+21', wins: '280', plane: '#ff9ec7' },
    { x: -44.5, z: 21, power: '+45', wins: '700', plane: '#c79bff', frame: true },
    { x: -44.5, z: 14.5, power: '+98', wins: '2.1K', plane: '#ff8a5c', frame: true },
    { x: -44.5, z: 8, power: '+210', wins: '5.6K', plane: '#5ce1e6', frame: true },
    { x: -44.5, z: 1.5, power: '+490', wins: '14K', plane: '#ffe14d', frame: true },
    { x: -44.5, z: -5, power: '+1.1K', wins: '35K', plane: '#ff5c7a', frame: true },
  ],
  world2: { x: -13, z: -19 },
  demonEgg: { x: 13, z: -17 },
  // Rebirth training pads: a row of short raised pads, north to south (first at z0, then
  // every `spacing`), each from x0 to x1 on a light-blue studded base, with its prize on a
  // stand at the east end facing back along the pad. surface is a colour (studded) or one of
  // 'gold', 'lava', 'crimson', 'rainbow', 'neon'. Sign lines are [text, colour]; ⬢ is the
  // premium currency. Gameplay (pads.js, throw.js): a throw at the prize earns the equipped
  // plane's Power x `mult`; the pad needs `rebirths`, or a `gems` gamepass (not sold yet).
  trainingRow: { x0: 18, x1: 30, z0: -17, spacing: 6, w: 5.4, base: '#bfe9f7' },
  trainingPads: [
    { rim: '#8f99a5', surface: '#c9d2dc', prize: 'white', mult: 1, rebirths: 0, sign: [['FREE', '#b6ff5c'], ['💪 x1 Power', '#ffd84a']] },
    { rim: '#2aa83a', surface: '#5fe06a', prize: 'green', mult: 2, rebirths: 1, sign: [['1 Rebirth', '#ff9ad5'], ['💪 x2 Power', '#ffd84a']] },
    { rim: '#1f6fd6', surface: '#4aa3ff', prize: 'star', mult: 3, rebirths: 3, sign: [['3 Rebirths', '#ff9ad5'], ['💪 x3 Power', '#ffd84a']] },
    { rim: '#6a25c8', surface: '#a35cff', prize: 'gem', mult: 5, rebirths: 6, sign: [['6 Rebirths', '#ff9ad5'], ['💪 x5 Power', '#ffd84a']] },
    { rim: '#e8a812', surface: 'gold', prize: 'gold', mult: 8, rebirths: 9, sign: [['9 Rebirths', '#ff9ad5'], ['💪 x8 Power', '#ffd84a']] },
    { rim: '#ff7a1a', surface: 'lava', prize: 'hex', mult: 12, rebirths: 12, sign: [['12 Rebirths', '#ff9ad5'], ['💪 x12 Power', '#ffd84a']] },
    { rim: '#e8283a', surface: 'crimson', prize: 'ruby', mult: 18, rebirths: 15, sign: [['15 Rebirths', '#ff9ad5'], ['💪 x18 Power', '#ffd84a']] },
    { rim: '#ff8fe0', surface: 'rainbow', prize: 'rainbow', mult: 30, gems: 45, sign: [['VERY OP!', '#ff5ce1'], ['⬢ 45', '#4be36a'], ['💪 x30 Power', '#ffd84a']] },
    { rim: '#33e0ff', surface: 'neon', prize: 'swirl', mult: 100, gems: 279, sign: [['BEST OVERALL!', '#ffe23d'], ['⬢ 279', '#4be36a'], ['💪 x100 Power', '#ffd84a']] },
  ],
  chevrons: { x: 0, z: -7, count: 5, spacing: 2.1 },
  // Floor arrows from the spawn to the plane pads: quadratic curve start, control, end.
  arrows: { from: [8, 13], via: [-6, 13.5], to: [-19, 16], count: 9 },
  freeReward: { x: -9, z: 21.5 },
  yellowRing: { x: -3.6, z: 21.8 },
  // Egg row on a stage at the south end, east to west. cost: wins, or gems for ⬢ eggs.
  eggStage: { z: 31, halfWidth: 11 },
  eggs: [
    { x: 8.4, name: 'Basic', cost: '🏆 25 Wins', color: '#f6f3ec', spot: '#d9d4c8' },
    { x: 4.2, name: 'Meadow', cost: '🏆 50 Wins', color: '#7fe0b8', spot: '#4fc48e' },
    { x: 0, name: 'Sphinx', cost: '⬢ 395', color: '#f5c542', spot: '#2f6fd8', best: true },
    { x: -4.2, name: 'Sunset', cost: '🏆 4K Wins', color: '#f7b49a', spot: '#f08a6a' },
    { x: -8.4, name: 'Unicorn', cost: '⬢ 12', color: '#fbf7ff', spot: '#f3c6ff', horn: true },
  ],
  // Waterfalls cascading down the cliff behind the eggs: one sheet per terrace face
  // [z, y bottom, y top], front to back, with a stream across each terrace top between.
  waterfalls: [
    { x: -18, w: 7, faces: [[43.7, 0, 15], [51.7, 15, 20], [59.7, 20, 25]] },
    { x: 4, w: 2.4, faces: [[51.7, 15, 20]] },
  ],
}

// --- HUD (hud.js) -------------------------------------------------------------
// Starting values for what the HUD shows beyond the game's progress (Power, Wins,
// Rebirths, level and Auto Throw come from store.js), and the gem price on each paid button.
export const HUD = {
  start: {
    friendBoost: 0, // %
    objective: 'Buy your first paper airplane',
    alerts: { store: true, rewards: true },
  },
  prices: { autoThrow: 19, x2Power: 2, x2Wins: 19, power100K: 11, power1M: 25, power10M: 49 },
  // The layout is drawn at this reference size and scaled to the window.
  refWidth: 1000, // narrowest width the bottom row fits at scale 1
  refHeight: 990,
  maxScale: 1.3,
}

// Default (signed-out / fallback) character look.
export const CHARACTER_COLORS = { skin: '#f2c79a', suit: '#2f9e8f', hair: '#5a3a22' }

export const MATERIAL_PBR = {
  PLAYER: { roughness: 0.7, metalness: 0 },
  GROUND: { roughness: 0.95, metalness: 0 },
  PROP: { roughness: 0.85, metalness: 0 },
}

// Renderer quality, picked by the Bloxity `graphics_quality` setting.
export const GRAPHICS_PRESETS = {
  Low: { shadows: false, antialias: false, dpr: 1 },
  Medium: { shadows: true, antialias: false, dpr: 1.5 },
  High: { shadows: true, antialias: true, dpr: 2 },
  Ultra: { shadows: true, antialias: true, dpr: 2 },
}

// --- Camera (camera.js) -------------------------------------------------------
export const CAMERA = {
  fov: 70,
  near: 0.1,
  far: 600,
  startPitch: 0.5, // radians above the horizon
  minPitch: -0.1,
  maxPitch: 1.2,
  distance: 13, // resting boom length, m
  minDistance: 3,
  maxDistance: 15,
  followLerp: 10, // 1/s: the ONE smoothing stage, on the point the camera follows
  targetHeight: 0.6, // look-at point as a fraction of player height
  lookSensitivity: 0.0026, // rad per pixel of mouse movement
  zoomStep: 0.9, // m per wheel notch
  zoomEase: 12, // 1/s the zoom glides to its target
  speedDistance: 0.8, // m the boom pulls back at full speed
  speedFov: 4, // degrees the FOV widens at full speed
  speedEase: 3, // 1/s the speed framing eases in and out
  clearEase: 4, // 1/s the boom eases back out after a wall pulled it in
  // Chasing a plane up the street: behind (south of), above and beside it, looking ahead.
  track: {
    back: 3.6, // m south of the plane (it is only 0.6 m long, so close)
    up: 2.4, // m above it: looking down puts the white plane against the road, not the hazy sky
    side: 0.6, // m east of it
    ahead: 8, // m north of the plane the camera looks at...
    lookBelow: 3, // ...and this far below the plane's height (keeps it clear of the HUD's bottom bar)
    heightEase: 4, // 1/s the camera's height follows the plane's swoops
    blendIn: 0.5, // s from the player camera into the chase
    blendOut: 0.5, // s back, when the plane landed close enough to see the player
    snapBeyond: 40, // m: a plane further than this snaps the camera home instead
  },
}

// --- Bloxity (bloxity.js, avatar/) -------------------------------------------------
// SDK setting keys this game listens for; registering a listener makes the control
// appear in the portal's settings menu.
export const SETTINGS = {
  graphics_quality: { def: 'High', type: 'enum', values: ['Low', 'Medium', 'High', 'Ultra'] },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  fullscreen: { def: 'false', type: 'bool' },
}

// The base rig, measured from player.glb: origin at the feet, 6.4 units tall at bind pose.
export const RIG_HEIGHT = 6.4
// Bind-pose values of the rig nodes the SDK proportions drive.
export const RIG = { armOffsetX: 2, legOffsetX: 0.6, neckOffsetY: 0.6 }
// getProportions() ranges, straight from the SDK spec; clamped before they reach the scene graph.
export const PROPORTIONS = {
  height: { def: 1, min: 0.5, max: 1.6 },
  shoulderWidth: { def: 1, min: 0.5, max: 1.5 },
  armLength: { def: 1, min: 0.05, max: 3 },
  legOffsetX: { def: 1, min: -0.7, max: 5 },
  torsoScaleX: { def: 1, min: 0.3, max: 2 },
  neckHeight: { def: 1, min: 0.94, max: 1.2 },
  headScale: { def: 1, min: 0.3, max: 2.6 },
}

// Procedural animation (avatar/animator.js), ported from +1 Cut Grass Adventure.
// Rotations are radians in CHARACTER space: +X swings a limb backward, +Y yaws, +Z rolls.
// So knees flex with +X and elbows with -X.
const deg = (d) => (d * Math.PI) / 180
export const ANIM = {
  airborneDelay: 0.07, // s off the ground before the air pose (ignores a step down a ledge)
  // Walk -> run is one cycle at two depths; phase advances with distance travelled.
  locomotion: {
    minFrequency: 0.7,
    maxFrequency: 3.6,
    strideDistance: 3.8, // m per cycle
    idleSpeed: 0.6,
    walkSpeed: 2.5,
    runSpeed: 8,
    sprintSpeed: 13,
    hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
    kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
    armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
    elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
    torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
    torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
    headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
    torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
    bob: { walk: 0.03, run: 0.07, sprint: 0.09 }, // m, on the avatar root
    bankAngle: deg(9),
    bankRate: 8,
  },
  idle: {
    breathFrequency: 0.35,
    breathAmount: deg(1.8),
    breathBob: 0.007,
    basePose: {
      ArmL1: { x: deg(-8), z: deg(14) },
      ArmL2: { x: deg(-16) },
      ArmR1: { x: deg(4), z: deg(-6) },
      ArmR2: { x: deg(-10) },
      LegL1: { x: deg(-4) },
      LegR1: { x: deg(4) },
    },
  },
  airborne: {
    rise: {
      LegL1: { x: deg(-38) }, LegR1: { x: deg(8) }, LegL2: { x: deg(62) }, LegR2: { x: deg(40) },
      ArmL1: { x: deg(-40), z: deg(34) }, ArmR1: { x: deg(-30), z: deg(-34) },
      ArmL2: { x: deg(-30) }, ArmR2: { x: deg(-30) }, Spine1: { x: deg(6) },
    },
    fall: {
      LegL1: { x: deg(-14) }, LegR1: { x: deg(10) }, LegL2: { x: deg(22) }, LegR2: { x: deg(18) },
      ArmL1: { x: deg(-70), z: deg(40) }, ArmR1: { x: deg(-60), z: deg(-40) },
      ArmL2: { x: deg(-20) }, ArmR2: { x: deg(-20) }, Spine1: { x: deg(-4) },
    },
    velocityReference: 8, // m/s vertical speed that reads as fully rising / falling
  },
  landing: {
    duration: 0.16,
    pose: {
      LegL1: { x: deg(-34) }, LegR1: { x: deg(-34) }, LegL2: { x: deg(58) }, LegR2: { x: deg(58) },
      ArmL1: { x: deg(-18), z: deg(20) }, ArmR1: { x: deg(-18), z: deg(-20) }, Spine1: { x: deg(14) },
    },
    bobY: -0.2,
  },
  transitions: { toLocomotion: 0.14, toAirborne: 0.12, toLanding: 0.06 }, // s to blend a pose change
  // Right arm while carrying the paper plane, layered over every state. `hold`
  // keeps it at the waist, forearm level; `fly` holds it out at arm's length
  // once running; `air` lifts it clear on a jump. Negative x = forward.
  carry: {
    hold: { ArmR1: { x: deg(-14), y: deg(14), z: deg(-9) }, ArmR2: { x: deg(-80) } },
    fly: { ArmR1: { x: deg(-80), y: deg(-28), z: deg(-4) }, ArmR2: { x: deg(-24) } },
    air: { ArmR1: { x: deg(-118), y: deg(-20), z: deg(-10) }, ArmR2: { x: deg(-10) } },
    // Idle "look at the plane": additive, brings it up and across, head turns to it.
    inspect: {
      ArmR1: { x: deg(-16), y: deg(14), z: deg(4) },
      ArmR2: { x: deg(-24) },
      Neck1: { x: deg(13), y: deg(-22) },
      Spine1: { y: deg(-5) },
    },
    inspectEvery: [7, 12], // s of idle between looks
    inspectDuration: 3.2, // s
    walkSwing: deg(8), // the carrying arm still swings a little at a walk
    flyBob: deg(2), // and rides the footfalls when flown
    raiseRate: 7, // 1/s the arm eases between hold / fly / air
    wristFollow: 0.75, // share of the arm's yaw the wrist undoes, so the nose keeps pointing ahead
  },
  // Overhand dart toss, played once per throw over everything else. `u` is the 0..1
  // fraction of `duration`; poses are absolute and eased between keys. The layer fades in
  // over [0, fadeIn] and out over [fadeOut, 1].
  toss: {
    duration: 0.8, // s
    releaseAt: 0.52, // u at which the plane leaves the hand
    controlAt: 0.8, // u at which movement comes back
    fadeIn: 0.18,
    fadeOut: 0.72,
    keys: [
      // cocked: elbow out to the side at shoulder height, forearm bent forward so the hand
      // (and the plane's nose) points ahead beside the head; left arm aims, weight back
      { u: 0, pose: { ArmR1: { x: deg(10), z: deg(-85) }, ArmR2: { x: deg(-100) }, ArmL1: { x: deg(-70), z: deg(18) }, Spine1: { x: deg(-6), y: deg(-14) }, LegL1: { x: deg(-14) }, LegR1: { x: deg(12) } } },
      { u: 0.4, pose: { ArmR1: { x: deg(16), z: deg(-88) }, ArmR2: { x: deg(-105) }, ArmL1: { x: deg(-70), z: deg(18) }, Spine1: { x: deg(-8), y: deg(-16) }, LegL1: { x: deg(-14) }, LegR1: { x: deg(12) } } },
      // release: the arm pushes through forward and slightly up, chest turns into it
      { u: 0.55, pose: { ArmR1: { x: deg(-110), z: deg(-10) }, ArmR2: { x: deg(-10) }, ArmL1: { x: deg(-30), z: deg(14) }, Spine1: { x: deg(8), y: deg(10) }, LegL1: { x: deg(-18) }, LegR1: { x: deg(14) } } },
      // follow-through: arm carries on down ahead, leaning in
      { u: 0.75, pose: { ArmR1: { x: deg(-72), z: deg(-6) }, ArmR2: { x: deg(-6) }, ArmL1: { x: deg(-14), z: deg(12) }, Spine1: { x: deg(12), y: deg(12) }, LegL1: { x: deg(-16) }, LegR1: { x: deg(12) } } },
      { u: 1, pose: { ArmR1: { x: deg(-60), z: deg(-6) }, ArmR2: { x: deg(-8) }, ArmL1: { x: deg(-10), z: deg(12) }, Spine1: { x: deg(8), y: deg(6) }, LegL1: { x: deg(-10) }, LegR1: { x: deg(8) } } },
    ],
  },
}

// A Throw Area throw's run up the street (throw.js), after Stone-Skipping's canal run:
// Power sets the range (progression.js streetReach), the plane flies straight up the
// lane, fast at first and slowing as it covers its range, and touches down exactly there.
export const STREET = {
  startZ: -35, // the Throw Area's north edge; distances are measured north from here
  length: 3500, // m to the far end
  laneHalf: 6, // m either side of x = 0 the plane steers into
  laneIn: 30, // m it takes to steer into the lane
  speed: 140, // m/s at release for a full-length run
  minSpeedScale: 0.3, // floor on the speed scale for the shortest runs
  fadeEnd: 0.5, // share of the speed (and cruise height) left at the end of the run
  cruisePerMetre: 0.06, // cruise height per metre of range, clamped to `cruise`
  cruise: [3, 8], // m: tops of the swoops stay under the gate lintels (9.8 m)
  climb: [25, 0.25], // m (at most) / share of the range spent climbing to cruise
  descent: [60, 0.4], // m (at most) / share of the range spent gliding down to land
  swoop: 1.2, // m up and down on top of the cruise
  maxSlideSpeed: 12, // m/s it skids on with after touching down
  trackHold: 1.2, // s the camera stays on the plane after it lands
  // street.js: the corridor north of the hand-built field (which ends at MAP.field.endZ).
  corridorHalf: 42, // m either side of x = 0 to the foot of the walls (MAP.open matches)
  walls: [[6, 5], [10, 12]], // terraces outward from the corridor: [width, height] m
  gateHeight: 11, // zone gates match the Neighbourhood gate
  endPast: 50, // m of street past the far end before the closing wall: room for the portal
  // The giant World 2 portal at the far end of the Sky Port, facing back down the street,
  // `back` m short of the closing wall (clear of where a full-length throw skids to a stop).
  portal: { scale: 4.5, back: 15, title: '🌐 World 2', sub: '💪 Needs 2.5M Power' },
  runwayLights: 8, // m between the Sky Port's runway edge lights
}

// Themed stretches of the street, after Stone-Skipping's LAKE_ZONES. Each starts `startD`
// metres up the street from the Throw Area (STREET.startZ), where its gate stands over the
// road, and runs to the next one's start (the last runs to the end). The first is the
// hand-built Neighbourhood field and its gate (map.js); street.js carries its colours on.
// Colours: road + lane dashes, verge (between road and sidewalk), sidewalk, lots (beyond
// the fences, a checker pair), walls (top, side), gate trim.
export const STREET_ZONES = [
  { id: 'neighbourhood', label: 'Neighbourhood', icon: '🏠', startD: 0, road: PALETTE.road, dash: '#ffffff', verge: PALETTE.field, sidewalk: PALETTE.sidewalk, lot: [PALETTE.grass, PALETTE.grassAlt], wall: [PALETTE.grassTop, PALETTE.dirt], trim: PALETTE.trimBlue },
  { id: 'main', label: 'Main Street', icon: '🛍️', startD: 250, road: '#4a4f5a', dash: '#ffd23a', verge: '#c9c2b4', sidewalk: '#efe4d2', lot: ['#d9cdb8', '#cfc1a8'], wall: ['#d07a55', '#a3523a'], trim: '#e0573a' },
  { id: 'park', label: 'Park Avenue', icon: '🌳', startD: 550, road: '#5a5f63', dash: '#ffffff', verge: '#5fcf4a', sidewalk: '#e6e0c8', lot: ['#4fbf3f', '#46b237'], wall: ['#3e9a35', '#7a5530'], trim: '#2f9e44' },
  { id: 'downtown', label: 'Downtown', icon: '🏙️', startD: 880, road: '#2f3238', dash: '#ffffff', verge: '#9aa3ad', sidewalk: '#c3c9d1', lot: ['#8a939e', '#7f8893'], wall: ['#6b7b90', '#46546a'], trim: '#4a6fa5' },
  { id: 'seaside', label: 'Seaside Boardwalk', icon: '🏖️', startD: 1240, road: '#c9a46a', dash: '#8a6a3a', verge: '#f3dfa0', sidewalk: '#b98a52', lot: ['#f6e4a8', '#eed58e'], wall: ['#f0d58a', '#d9b56a'], trim: '#1fb5d6' },
  { id: 'snowy', label: 'Snowy Lane', icon: '❄️', startD: 1640, road: '#7d8da0', dash: '#ffffff', verge: '#f4fbff', sidewalk: '#dfeef6', lot: ['#f6fcff', '#e8f4fa'], wall: ['#ffffff', '#b9d7e6'], trim: '#5fb8e8' },
  { id: 'spooky', label: 'Spooky Street', icon: '🎃', startD: 2060, road: '#3a2f45', dash: '#ff8a1f', verge: '#4a3d5c', sidewalk: '#6b5a7a', lot: ['#3d3350', '#352b47'], wall: ['#2a2238', '#1f1a2b'], trim: '#ff8a1f' },
  { id: 'candy', label: 'Candy Town', icon: '🍭', startD: 2500, road: '#ff8fc0', dash: '#ffffff', verge: '#ffd1e6', sidewalk: '#fff0a8', lot: ['#ffc2dc', '#ffb0d1'], wall: ['#ff7fb5', '#e8609a'], trim: '#ff4f9a' },
  { id: 'neon', label: 'Neon Night', icon: '🌃', startD: 2960, road: '#141626', dash: '#33e0ff', verge: '#232848', sidewalk: '#3a2f6b', lot: ['#1c2140', '#181c38'], wall: ['#2b1f5a', '#1a1440'], trim: '#33e0ff' },
  // The far end: a runway (`runway: true` adds threshold stripes and edge lights) up to the portal.
  { id: 'skyport', label: 'Sky Port', icon: '✈️', startD: 3400, runway: true, road: '#3a3d44', dash: '#ffffff', verge: '#6b7380', sidewalk: '#c3c9d1', lot: ['#9aa3ad', '#8f98a3'], wall: ['#c3c9d1', '#6b7b90'], trim: '#ff8a1f' },
]

// Throwing (throw.js) and a thrown plane's glide (anywhere but the street, which gets
// its own run in a later phase). Metres, seconds.
export const THROW = {
  reloadTime: 0.3, // s after release before the next plane is in hand
  popTime: 0.15, // s the new plane takes to grow into the hand
  launchSpeed: 13, // m/s along the aim at release
  launchPitch: deg(10), // above horizontal
  glideSpeed: 7, // m/s the plane slows to
  speedRate: 0.5, // 1/s it eases toward glideSpeed
  sinkRate: 1.1, // m/s steady descent
  liftRate: 1.4, // 1/s the climb from the launch eases into the sink
  wobble: 0.9, // m/s of phugoid swoop on top of the sink
  wobblePeriod: 2.4, // s
  wobbleDecay: 0.35, // 1/s
  bank: deg(9), // roll that rides the swoop
  turnRate: 12, // 1/s the nose eases onto the flight path
  stallGravity: -9.8, // m/s^2 once it has hit a wall
  slideDrag: 6, // 1/s on the ground
  lieTime: 2, // s it rests where it landed
  fadeTime: 0.35, // s it shrinks away
  maxFlightTime: 20,
  poolSize: 16, // most planes drawn at once (ours and other players'), the oldest goes first
  // A training-pad throw at the prize (pads.js): a low arc at a steady speed into its face.
  prizeSpeed: 15, // m/s
  prizeArc: 0.8, // m the arc rises above the straight line
  prizeFace: 0.45, // m short of the prize's centre, where its face is
}

// The paper plane carried in the right hand (avatar/heldPlane.js). Metres,
// nose along +Z, wings along X.
export const HELD_PLANE = {
  length: 0.6,
  span: 0.4,
  keelDepth: 0.07, // at the tail; the keel grows from nothing at the nose
  keelSpread: 0.012, // m the two keel layers open at the bottom of the tail
  keelGap: 0.0012,
  dihedral: deg(4), // inner wing panel
  outerDihedral: deg(10), // outer panel, past the wing fold
  crease: 0.46, // wing fold, as a fraction of the half-span
  trailingCurl: 0.004, // m the trailing edge is bent up (elevator trim)
  paperColor: '#f6f4ee',
  paperTile: 0.35, // m of paper per texture repeat
  // Pinch point on the fist in rig units, character space at bind pose (the
  // forearm's front face near the hand); the plane is held there by its keel.
  grip: { x: -2, y: 2.56, z: 0.9 },
  gripFraction: 0.62, // pinch point along the keel, from the nose
  gripPitch: deg(-4), // + nose further down the forearm
  gripYaw: 0,
  gripRoll: 0,
  // Wobble at the pinch: a damped torsion spring driven by the hand.
  stiffness: 240, // 1/s^2
  damping: 0.32, // ratio; under 1 so the paper rocks a little after a jolt
  inertia: 0.003, // rad per m/s^2 of hand acceleration
  maxAccel: 40, // m/s^2, clamps a teleport or respawn spike
  accelSmoothing: 18, // 1/s
  // Airflow over the plane while it moves.
  airspeedReference: 10, // m/s that counts as full airflow
  trimPerSpeed: 0.006, // rad nose-up per m/s of forward airspeed
  weathervane: 0.35, // fraction of the sideslip the nose turns into the wind
  flexPerAir: deg(7), // extra wing dihedral at full airflow
  flexPerAccel: 0.0007, // rad of sag per m/s^2 the hand surges upward
  maxFlex: deg(12),
  flexStiffness: 420,
  flutterFrequency: [3, 15], // Hz: at rest, plus per unit of airflow
  flutterAmplitude: 0.0045, // m at the trailing edge at full airflow
  idleBreeze: 0.0006, // m of drift flutter when still
  keelSwayPerAccel: 0.00012,
  // Deliberate handling.
  bankPerTurn: 0.16, // rad of bank per rad/s of turn while flown
  maxBank: deg(40),
  swoopRoll: deg(5),
  swoopPitch: deg(4),
  airPitch: deg(8), // nose up while airborne
  fidget: deg(1.4), // finger adjustments while held still
  inspectRoll: deg(28),
  inspectPitch: deg(14),
  inspectRock: deg(9),
}

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Coerce one raw SDK string against its SETTINGS entry.
export function coerceSetting(key, raw) {
  const spec = SETTINGS[key]
  if (!spec) return raw
  const value = raw === '' || raw == null ? spec.def : raw
  if (spec.type === 'bool') return value === 'true'
  if (spec.type === 'enum') return spec.values.includes(value) ? value : spec.def
  const n = Number(value)
  return clamp(Number.isFinite(n) ? n : Number(spec.def), spec.min, spec.max)
}
