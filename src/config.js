// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'paper-plane' // slug registered on bloxity.io
export const GAME_TITLE = 'Paper Plane'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

// --- Worlds (worlds.js) --------------------------------------------------------
// World 1 is the lobby and street as laid out below. World 2, the Ice World, is the same
// layout and the same game re-dressed in snow and ice (the ICE_* overrides below), with its
// own decor (iceWorld.js) and its own multiplayer room. A page builds one world, fixed at
// load: worlds.js travels by reloading with sessionStorage naming the destination, and only
// once the portal has let the player through (`unlockKey`), so a hand-edited key can't skip it.
export const WORLDS = {
  storageKey: 'paperPlane.world', // '2' while this tab is in the Ice World
  unlockKey: 'paperPlane.world2', // '1' once this tab went through the portal
  carryKey: 'paperPlane.carry', // progress handed across the reload (worlds.js)
  saveWaitMs: 2_500, // longest a signed-in player waits for the final save before travelling
  2: { name: 'Ice World', icon: '❄️', power: 2_500_000 },
}
function readWorld() {
  try {
    return sessionStorage.getItem(WORLDS.storageKey) === '2' && sessionStorage.getItem(WORLDS.unlockKey) === '1' ? 2 : 1
  } catch {
    return 1 // storage blocked: always the first world
  }
}
export const WORLD = readWorld()
const ICE = WORLD === 2

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
  // Ceiling on waiting to learn whether a save exists (store.js progressKnown): covers a slow
  // join or save lookup, but never stalls a new player's tutorial for long.
  progressKnownMs: 15_000,
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
  ...(ICE && { horizon: '#dff3ff', zenith: '#6aaee6', grass: '#eaf6ff', grassDark: '#d3e9f7' }),
}
export const FOG = ICE ? { near: 70, far: 230 } : { near: 90, far: 260 }
export const LIGHT = {
  sunColor: '#fff2d6',
  sunIntensity: 2.4,
  sunPosition: [30, 60, 20],
  shadowMapSize: 2048,
  shadowRange: 40, // half-width of the shadow frustum around the player
  hemiSky: '#e4f1ff',
  hemiGround: '#b9a98a',
  hemiIntensity: 1.1,
  // Snow throws back a cold, bright light: a whiter sun, a blue bounce.
  ...(ICE && { sunColor: '#f2f8ff', sunIntensity: 2.1, hemiSky: '#eef6ff', hemiGround: '#a9c8e0', hemiIntensity: 1.2 }),
}

// Waterfalls behind the eggs (textures.js waterfallTexture, map.js): colours and how fast
// the texture scrolls, m/s. In the Ice World they're frozen, barely creeping.
export const WATERFALL = ICE
  ? { base: '#bfeeff', light: 'rgba(255,255,255,0.9)', dark: 'rgba(110,190,235,0.55)', flow: 0.12 }
  : { base: '#4fc8ff', light: 'rgba(255,255,255,0.75)', dark: 'rgba(30,140,230,0.6)', flow: 1.4 }

// Falling snow around the camera (world.js createSnowfall), Ice World only.
export const SNOW = { enabled: ICE, flakes: 1400, box: 70, height: 40, fall: [1.2, 2.6], drift: 0.6, size: 0.18 }

// The Ice World's lobby palette over World 1's: snow for grass, ice-blue cliffs, snowy pine
// tiers (leafLight), frosted stone, cold lamps.
const ICE_PALETTE = {
  grass: '#eef7fd',
  grassAlt: '#e3f1fa',
  grassTop: '#f7fbff',
  dirt: '#9fcbe8',
  plaza: '#dceffc',
  plazaPath: '#acdcf6',
  plazaEdge: '#6eb3dd',
  field: '#e8f5fd',
  road: '#6a7a8e',
  sidewalk: '#f6fbff',
  stone: '#7d90a8',
  trimBlue: '#3aa3ec',
  chevron: '#3fa9f5',
  arrowEdge: '#9ab8cc',
  trunk: '#6b4a33',
  leaf: '#2f7d5a',
  leafLight: '#f4fbff',
  water: '#9fe2ff',
  lamp: '#2f3b4a',
  lampLight: '#c4f0ff',
  eggBand: '#3aa3ec',
  waterfall: '#c4efff',
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
  ...(ICE && ICE_PALETTE),
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
    [-14, -35], [14, -35], [14, -28], [5, -28], [5, -12], [9, -12], [9, -4], [16, -4], [16, 17.5], [13, 17.5], [13, 19], [9, 19], [9, 21], [6, 21], [6, 24], [14, 24], [14, 39.5],
    [-14, 39.5], [-14, 24], [-6, 24], [-6, 21], [-9, 21], [-9, 19], [-13, 19], [-13, 17.5], [-20, 17.5],
    [-20, -2], [-16, -2], [-16, -4], [-9, -4], [-9, -12], [-5, -12], [-5, -28], [-14, -28],
  ],
  // Where players stand to throw: the walkway strip across the field mouth, its name painted
  // on the floor. A throw from inside [minX, maxX] x [minZ, maxZ] flies up the street (throw.js).
  throwArea: { z: -31.5, label: 'THROW AREA', labelWidth: 19, minX: -14, maxX: 14, minZ: -35, maxZ: -28 },
  // The throwing field north of it: green from startZ, an asphalt road (x +- roadHalf)
  // from roadZ to endZ, white sidewalks and stone fences either side, the gate at gateZ.
  // roadZ is the throw area's north edge, so the throw line is the road's start line.
  field: { halfWidth: 12, sidewalk: 1.6, startZ: -35, roadZ: -35, roadHalf: 7, endZ: -112, gateZ: -104 },
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
  // = owned from the start. `name` (and an optional `stripe` colour) is how the Items window
  // (itemsUi.js) shows it.
  pads: [
    { x: -34.75, z: 21, name: 'Notebook', power: '+1', wins: null, plane: '#ffffff' },
    { x: -34.75, z: 14.5, name: 'Colored', power: '+2', wins: '3', plane: '#9fd8ff', stripe: '#ff8fb5' },
    { x: -34.75, z: 8, name: 'Mint', power: '+5', wins: '25', plane: '#9cf08f' },
    { x: -34.75, z: 1.5, name: 'Sunny', power: '+11', wins: '110', plane: '#ffd36b' },
    { x: -34.75, z: -5, name: 'Bubblegum', power: '+21', wins: '280', plane: '#ff9ec7' },
    { x: -44.5, z: 21, name: 'Galaxy', power: '+45', wins: '700', plane: '#c79bff', frame: true },
    { x: -44.5, z: 14.5, name: 'Blaze', power: '+98', wins: '2.1K', plane: '#ff8a5c', frame: true },
    { x: -44.5, z: 8, name: 'Frost', power: '+210', wins: '5.6K', plane: '#5ce1e6', frame: true },
    { x: -44.5, z: 1.5, name: 'Golden', power: '+490', wins: '14K', plane: '#ffe14d', frame: true },
    { x: -44.5, z: -5, name: 'Ruby', power: '+1.1K', wins: '35K', plane: '#ff5c7a', frame: true },
  ],
  world2: { x: -13, z: -19 }, // the portal (PORTAL says where it leads)
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
    { rim: '#ff8fe0', surface: 'rainbow', prize: 'rainbow', mult: 30, rebirths: 20, sign: [['VERY OP!', '#ff5ce1'], ['20 Rebirths', '#ff9ad5'], ['💪 x30 Power', '#ffd84a']] },
    { rim: '#33e0ff', surface: 'neon', prize: 'swirl', mult: 100, rebirths: 30, sign: [['BEST OVERALL!', '#ffe23d'], ['30 Rebirths', '#ff9ad5'], ['💪 x100 Power', '#ffd84a']] },
  ],
  chevrons: { x: 0, z: -7, count: 5, spacing: 2.1 },
  // Floor arrows from the spawn to the plane pads: quadratic curve start, control, end.
  arrows: { from: [8, 13], via: [-6, 13.5], to: [-19, 16], count: 9 },
  freeReward: { x: -9, z: 21.5 },
  yellowRing: { x: -3.6, z: 21.8 },
  // Egg row on a stage at the south end, east to west. cost: wins, or gems for ⬢ eggs.
  eggStage: { z: 28, halfWidth: 11 },
  eggs: [
    { x: 8.4, name: 'Basic', cost: '🏆 25 Wins', color: '#f6f3ec', spot: '#d9d4c8' },
    { x: 4.2, name: 'Meadow', cost: '🏆 50 Wins', color: '#7fe0b8', spot: '#4fc48e' },
    { x: 0, name: 'Sphinx', cost: '🏆 50K Wins', color: '#f5c542', spot: '#2f6fd8', best: true },
    { x: -4.2, name: 'Sunset', cost: '🏆 4K Wins', color: '#f7b49a', spot: '#f08a6a' },
    { x: -8.4, name: 'Unicorn', cost: '🏆 500 Wins', color: '#fbf7ff', spot: '#f3c6ff', horn: true },
  ],
  // Waterfalls cascading down the cliff behind the eggs: one sheet per terrace face
  // [z, y bottom, y top], front to back, with a stream across each terrace top between.
  // The three leaderboards (leaderboards.js) in a row behind the Egg Row, facing the plaza,
  // fed by Paper-plane-backend's `leaderboard` broadcast (`stat` is its board key). Panel `w` x
  // `h` m, its bottom `y` up on two legs; `rows` names per board. Left to right as seen from
  // the plaza: Playtime, Rebirths, Wins.
  leaderboards: {
    z: 37,
    y: 5, // clear of the eggs' odds boards (4.8 m) seen from the plaza
    w: 7.6,
    h: 10,
    rows: 10,
    boards: [
      { stat: 'playTime', title: 'Total Playtime', icon: '⏱️', x: 12.2, color: '#19b6d8', dark: '#0a3a52', topper: 'propeller' },
      { stat: 'rebirths', title: 'Total Rebirths', icon: '🔄', x: 0, color: '#ef476f', dark: '#4a0f26', topper: 'badge' },
      { stat: 'wins', title: 'Total Wins', icon: '🏆', x: -12.2, color: '#f5c518', dark: '#4a3600', topper: 'plane' },
    ],
  },
  waterfalls: [
    { x: -18, w: 7, faces: [[43.7, 0, 15], [51.7, 15, 20], [59.7, 20, 25]] },
    { x: 4, w: 2.4, faces: [[51.7, 15, 20]] },
  ],
}
// Snow on every Ice World roof up the field.
if (ICE) MAP.houses = MAP.houses.map((h) => ({ ...h, roofColor: '#f4fbff' }))

// Where the lobby portal (MAP.world2) leads, and what it asks (eggs.js, worlds.js): World 1's
// goes on to the Ice World for WORLDS[2].power Power (once through, it stays open, saved as
// world2Unlocked; free with VITE_DEV_MODE, for testing); the Ice World's goes home for free.
// `swirl` colours its spinning centre.
export const PORTAL = ICE
  ? { to: 1, power: 0, prompt: 'Back to World 1', title: '🌐 World 1', sub: '🏠 Back to the Lobby', subColor: '#7dff6a', swirl: ['#1f8f3a', '#b6ff9a'] }
  : { to: 2, power: DEV_MODE ? 0 : WORLDS[2].power, prompt: 'Enter World 2', title: '🌐 World 2', sub: '💪 Needs 2.5M Power', subColor: '#ffb01f', swirl: ['#1d4fd8', '#9fe6ff'] }

// The Ice World's own decor around the lobby (iceWorld.js), on flat ground clear of every
// path, pad and prop: [x, z, yaw] (yaw turns the front, +Z, toward the plaza) and, for
// clusters, a scale. Each gets a collider sized to it.
export const ICE_DECOR = {
  igloos: [[-41, -21, 0.4], [-51, 34, Math.PI - 0.3], [-36, -79, Math.PI / 2]],
  snowmen: [[-30, -22, 0.3], [-49, -24, 0.6], [-27, 34, Math.PI], [-18, -62, Math.PI / 2], [18, -77, -Math.PI / 2], [-18, -95, Math.PI / 2]],
  penguins: [[-33, 33, Math.PI], [-35, 35.2, Math.PI + 0.4], [-31.4, 35.4, Math.PI - 0.5], [-41, 33.5, Math.PI + 0.2], [-55, -16, 1], [-56.5, -18, 1.3]],
  crystals: [[-24.5, -25, 1.1], [-58, -22, 1.4], [-20, 37, 1], [-44, 36.5, 0.8], [40, -51, 1.2], [-37, -93, 1], [37, -92, 1.3], [18, -88, 0.8]],
  snowPiles: [[-34, -26.5, 1], [-46, -16.5, 0.8], [-38, 37.5, 1.1], [-57, 37, 0.9], [18, -64, 0.8], [-18, -78, 0.9]],
}

// --- Tutorial (tutorial.js) --------------------------------------------------------
// The onboarding quest, after Stone-Skipping's: 0 get `power` Power (training pad), 1 get
// `wins` Wins (Throw Area), 2 equip a new plane (Plane Hall), 3 reach level `level`, 4 rebirth,
// 5 done. Paper-plane-backend's constants.ts mirrors these numbers for old saves.
export const TUTORIAL = {
  power: 30,
  wins: 3, // the +2 plane's price (MAP.pads[1])
  level: 20, // the first rebirth's level cap
  doneStep: 5,
  completeLingerMs: 10_000, // the COMPLETE banner stays this long, then pops out
  // Where the guide arrows lead at steps 0..3: the FREE training pad, the Throw Area, the
  // +2 plane's pad, the FREE pad again. None for rebirth and done.
  targets: [
    { x: MAP.trainingRow.x0 + 2, z: MAP.trainingRow.z0 },
    { x: 0, z: MAP.throwArea.z },
    { x: MAP.pads[1].x, z: MAP.pads[1].z },
    { x: MAP.trainingRow.x0 + 2, z: MAP.trainingRow.z0 },
  ],
}

// --- HUD (hud.js) -------------------------------------------------------------
// Starting values for what the HUD shows beyond the game's progress (Power, Wins,
// Rebirths, level and Auto Throw come from store.js), and the Wins price on each paid button.
export const HUD = {
  start: {
    alerts: {},
  },
  // Each bought once, then switched on/off from its button (store.js buyAutoThrow / buyX2).
  prices: { autoThrow: 5000, x2Power: 100_000, x2Wins: 500_000 },
  // The layout is drawn at this reference size and scaled to the window.
  refWidth: 1000, // narrowest width the bottom row fits at scale 1
  refHeight: 990,
  maxScale: 1.3,
  // Phones / small windows (html.compact, device.js): a shorter reference, so the HUD stays big enough
  // to read and tap; hud.js moves the stats and menu to the top-left and the x2 boosts up, clear of
  // the touch stick and buttons.
  compactRefHeight: 640,
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

// The air around a chased street throw (airflow.js): wingtip vortex ribbons, wind streaks, a
// launch ring, touchdown dust, and how hard the camera feels the speed. Metres, seconds.
export const AIRFLOW = {
  trailPoints: 160, // samples per wingtip ribbon (enough for trailLife at high refresh rates)
  trailLife: 0.6, // s a stretch of vortex lasts
  trailWidth: 0.05, // m half-width at the wingtip; it spreads as it ages
  trailAlpha: 0.6,
  vortexRadius: 0.28, // m the corkscrew swings out to, once grown
  vortexTwist: 0.35, // turns per metre of trail
  trailGrow: 3.5, // m behind the wingtip it takes to reach full size: the camera is only ~4 m back
  streaks: 90,
  streakAhead: [6, 70], // m ahead of the plane they are placed
  streakRadius: [1.2, 7], // m out from the flight path
  streakBlur: 0.05, // s of travel each streak is drawn as long as
  streakMaxLen: 7, // m
  streakWidth: 0.035, // m half-width
  streakAlpha: 0.75,
  rings: 3, // launch rings shed
  ringEvery: 0.12, // s between them
  ringLife: 0.7, // s each takes to fade
  ringGrow: 7, // times its size it ends at
  ringAlpha: 0.75,
  ringColor: '#e3f4ff',
  dustPuffs: 12,
  dustLife: 1.1, // s
  dustSize: 0.9, // m
  dustAlpha: 0.55,
  dustColor: '#efe8d8',
  fovAtSpeed: 12, // degrees wider at full speed
  shake: 0.06, // m of buffeting at full speed
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
  portal: ICE
    ? { scale: 4.5, back: 15, title: '🌐 World 3', sub: '🔒 Coming Soon', subColor: '#9fe6ff', swirl: ['#5a1fd8', '#e0b0ff'] }
    : { scale: 4.5, back: 15, title: '🌐 World 2', sub: '💪 Needs 2.5M Power', subColor: '#ffb01f', swirl: ['#1d4fd8', '#9fe6ff'] },
  runwayLights: 8, // m between the Sky Port's runway edge lights
}

// Themed stretches of the street, after Stone-Skipping's LAKE_ZONES. Each starts `startD`
// metres up the street from the Throw Area (STREET.startZ), where its gate stands over the
// road, and runs to the next one's start (the last runs to the end). The first is the
// hand-built Neighbourhood field and its gate (map.js); street.js carries its colours on.
// Colours: road + lane dashes, verge (between road and sidewalk), sidewalk, lots (beyond
// the fences, a checker pair), walls (top, side), gate trim.
// The Ice World's street: the same ten stretches (ids, so streetProps.js's ICE_THEMES, and
// distances), each re-dressed in snow and ice. The first carries the lobby field on, so it
// takes its colours from PALETTE like World 1's.
const ICE_STREET_ZONES = [
  { id: 'neighbourhood', label: 'Frost Village', icon: '🏘️', startD: 0, road: PALETTE.road, dash: '#ffffff', verge: PALETTE.field, sidewalk: PALETTE.sidewalk, lot: [PALETTE.grass, PALETTE.grassAlt], wall: [PALETTE.grassTop, PALETTE.dirt], trim: PALETTE.trimBlue },
  { id: 'main', label: 'Glacier Market', icon: '🧊', startD: 250, road: '#56657a', dash: '#bfefff', verge: '#d5e6f2', sidewalk: '#eef4fa', lot: ['#dfeaf3', '#d4e2ee'], wall: ['#bcdcf0', '#7fa9c9'], trim: '#2f8fd8' },
  { id: 'park', label: 'Frozen Park', icon: '⛸️', startD: 550, road: '#6a7684', dash: '#ffffff', verge: '#f0f8fd', sidewalk: '#e2eef6', lot: ['#f2f9fe', '#e6f2fa'], wall: ['#f6fbff', '#8fbcd8'], trim: '#46b7e0' },
  { id: 'downtown', label: 'Ice City', icon: '🏙️', startD: 880, road: '#3a4250', dash: '#ffffff', verge: '#b9c9d8', sidewalk: '#d3e0eb', lot: ['#a9bccd', '#9fb3c5'], wall: ['#8fa9c4', '#5a7290'], trim: '#5aa0e0' },
  { id: 'seaside', label: 'Penguin Bay', icon: '🐧', startD: 1240, road: '#7d93a8', dash: '#ffffff', verge: '#dff3ff', sidewalk: '#c9e3f2', lot: ['#e9f7ff', '#dcf0fb'], wall: ['#ffffff', '#a8d8f0'], trim: '#1fb5d6' },
  { id: 'snowy', label: 'Blizzard Pass', icon: '🌨️', startD: 1640, road: '#8a98a8', dash: '#ffffff', verge: '#ffffff', sidewalk: '#e9f2f8', lot: ['#fbfdff', '#eef5fa'], wall: ['#ffffff', '#c9dde9'], trim: '#7fc4ea' },
  { id: 'spooky', label: 'Yeti Woods', icon: '👣', startD: 2060, road: '#3a4458', dash: '#9fe6ff', verge: '#4a5a72', sidewalk: '#6b7d95', lot: ['#3f4c63', '#37435a'], wall: ['#2a3448', '#1f2738'], trim: '#9fe6ff' },
  { id: 'candy', label: 'Candy Cane Lane', icon: '🍬', startD: 2500, road: '#ff9fc8', dash: '#ffffff', verge: '#ffe3f0', sidewalk: '#fff6fb', lot: ['#ffeaf3', '#ffdcea'], wall: ['#ffffff', '#ff9fc8'], trim: '#e8323a' },
  { id: 'neon', label: 'Aurora Lights', icon: '🌌', startD: 2960, road: '#101a2a', dash: '#4bffb0', verge: '#1c2c44', sidewalk: '#22406b', lot: ['#16243a', '#121e32'], wall: ['#1a2f52', '#10203a'], trim: '#4bffb0' },
  { id: 'skyport', label: 'Polar Port', icon: '✈️', startD: 3400, runway: true, road: '#3a4250', dash: '#ffffff', verge: '#c9d6e2', sidewalk: '#dfe8f0', lot: ['#e9f1f7', '#dfe9f1'], wall: ['#e9f1f7', '#8fa9c4'], trim: '#ff8a1f' },
]

export const STREET_ZONES = ICE ? ICE_STREET_ZONES : [
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

// --- Eggs and pets (eggs.js, hatch.js, pets.js, eggUi.js, petFollowers.js) ------------
// After Chop-trees-for-treasure's data/eggs.js. Keyed by egg id: the lower-cased MAP.eggs
// name, plus 'demon' for the Demon Egg on the north plaza. Each egg hatches one of its
// six pets at `chance` % (the odds boards show the same numbers); `power` is what the
// pet adds to the Power multiplier while equipped (pets.js: 1 + the sum over equipped).
// `currency` 'gems' eggs can't be opened until gems are sold. Pet names are unique within
// an egg; saves store { egg, name }, and Paper-plane-backend's constants.ts EGG_PETS must
// list the same names or it drops them.
export const EGG_SHOP = {
  basic: {
    name: 'Basic Egg', cost: 25, currency: 'wins',
    pets: [
      { name: 'Paper Crane', emoji: '🕊️', color: '#f4f1e8', chance: 40, rarity: 'common', power: 0.1 },
      { name: 'Pigeon', emoji: '🐦', color: '#9aa7b8', chance: 30, rarity: 'uncommon', power: 0.15 },
      { name: 'Origami Frog', emoji: '🐸', color: '#6fd35a', chance: 15, rarity: 'rare', power: 0.25 },
      { name: 'Kite Cat', emoji: '🐱', color: '#ffb84d', chance: 10, rarity: 'epic', power: 0.4 },
      { name: 'Balloon Pup', emoji: '🐶', color: '#ff7fb0', chance: 4, rarity: 'legendary', power: 0.8 },
      { name: 'Golden Crane', emoji: '🦢', color: '#ffd23f', chance: 1, rarity: 'mythic', power: 2 },
    ],
  },
  meadow: {
    name: 'Meadow Egg', cost: 50, currency: 'wins',
    pets: [
      { name: 'Ladybug', emoji: '🐞', color: '#e8323a', chance: 40, rarity: 'common', power: 0.2 },
      { name: 'Bunny', emoji: '🐰', color: '#f2ece4', chance: 30, rarity: 'uncommon', power: 0.3 },
      { name: 'Butterfly', emoji: '🦋', color: '#4fa8ff', chance: 15, rarity: 'rare', power: 0.5 },
      { name: 'Bumblebee', emoji: '🐝', color: '#ffd23a', chance: 10, rarity: 'epic', power: 0.8 },
      { name: 'Hummingbird', emoji: '🐤', color: '#3fd6a0', chance: 4, rarity: 'legendary', power: 1.5 },
      { name: 'Fairy Fox', emoji: '🦊', color: '#ff8a3d', chance: 1, rarity: 'mythic', power: 4 },
    ],
  },
  sunset: {
    name: 'Sunset Egg', cost: 4000, currency: 'wins',
    pets: [
      { name: 'Sunset Duck', emoji: '🦆', color: '#f7b49a', chance: 40, rarity: 'common', power: 1 },
      { name: 'Flamingo', emoji: '🦩', color: '#ff8fbf', chance: 30, rarity: 'uncommon', power: 1.5 },
      { name: 'Parrot', emoji: '🦜', color: '#3fcf5a', chance: 15, rarity: 'rare', power: 2.5 },
      { name: 'Phoenix Chick', emoji: '🐣', color: '#ffb02e', chance: 10, rarity: 'epic', power: 4 },
      { name: 'Sun Hawk', emoji: '🦅', color: '#c8742f', chance: 4, rarity: 'legendary', power: 8 },
      { name: 'Sunset Dragon', emoji: '🐉', color: '#ff5c3a', chance: 1, rarity: 'mythic', power: 20 },
    ],
  },
  unicorn: {
    name: 'Unicorn Egg', cost: 500, currency: 'wins',
    pets: [
      { name: 'Cloud Pony', emoji: '🐴', color: '#eef4ff', chance: 40, rarity: 'common', power: 0.5 },
      { name: 'Moon Bat', emoji: '🦇', color: '#7a6ad8', chance: 30, rarity: 'uncommon', power: 0.8 },
      { name: 'Rainbow Owl', emoji: '🦉', color: '#c9a0ff', chance: 15, rarity: 'rare', power: 1.2 },
      { name: 'Star Cat', emoji: '🐈', color: '#ffe08a', chance: 10, rarity: 'epic', power: 2 },
      { name: 'Unicorn', emoji: '🦄', color: '#fbe8ff', chance: 4, rarity: 'legendary', power: 5 },
      { name: 'Galaxy Unicorn', emoji: '🦄', color: '#b06cff', chance: 1, rarity: 'mythic', power: 12 },
    ],
  },
  sphinx: {
    name: 'Sphinx Egg', cost: 50_000, currency: 'wins',
    pets: [
      { name: 'Camel', emoji: '🐫', color: '#d9a865', chance: 40, rarity: 'common', power: 3 },
      { name: 'Scarab', emoji: '🪲', color: '#2f6fd8', chance: 30, rarity: 'uncommon', power: 5 },
      { name: 'Falcon', emoji: '🦅', color: '#a87a4a', chance: 15, rarity: 'rare', power: 8 },
      { name: 'Jackal', emoji: '🐺', color: '#5a4a3a', chance: 10, rarity: 'epic', power: 12 },
      { name: 'Sphinx', emoji: '🦁', color: '#f5c542', chance: 4, rarity: 'legendary', power: 30 },
      { name: 'Golden Sphinx', emoji: '🦁', color: '#ffd700', chance: 1, rarity: 'mythic', power: 100 },
    ],
  },
  // Not on the egg row: the Demon Egg stand on the north plaza sells this one pet outright.
  demon: {
    name: 'Demon Egg', cost: 1_000_000, currency: 'wins',
    pets: [{ name: 'Demon Dragon', emoji: '🐲', color: '#e8283a', chance: 100, rarity: 'mythic', power: 250 }],
  },
  // Not an egg anyone opens: pets only the daily rewards hand out (DAILY, daily.js).
  daily: {
    name: 'Daily Rewards', cost: 0, currency: 'reward',
    pets: [{ name: 'Dragon', emoji: '🐉', color: '#3fcf5a', chance: 100, rarity: 'epic', power: 2 }],
  },
}

// --- Daily rewards (daily.js, dailyUi.js) -----------------------------------------------
// A 7-day calendar: Day N unlocks N - 1 days after the cycle starts, stays claimable until
// claimed (in any order), and claiming the last starts the next cycle a week after this one
// began. A signed-in player's calendar lives on the server (Paper-plane-backend
// src/daily.ts, which decides each claim and the reward); a guest's in this browser.
// `reward` must match the server's DAILY_REWARDS; the rest is how the window draws it.
const MINUTE = 60_000
export const DAILY = {
  dayMs: Number(import.meta.env.VITE_DAILY_DAY_MS) > 0 ? Number(import.meta.env.VITE_DAILY_DAY_MS) : 86_400_000,
  storageKey: 'paperPlane.daily', // a guest's calendar (localStorage)
  days: [
    { label: 'x2 Wins', icon: 'winsPotion', amount: '5m', reward: { kind: 'boost', stat: 'wins', ms: 5 * MINUTE } },
    { label: 'Dragon', icon: 'pet', amount: 'x1', reward: { kind: 'pet', egg: 'daily', name: 'Dragon' } },
    { label: 'x2 Power', icon: 'powerPotion', amount: '5m', reward: { kind: 'boost', stat: 'power', ms: 5 * MINUTE } },
    { label: 'Unicorn Egg', icon: 'egg', amount: 'x1', reward: { kind: 'egg', egg: 'unicorn' } },
    { label: 'x2 Power', icon: 'powerPotion', amount: '5m', reward: { kind: 'boost', stat: 'power', ms: 5 * MINUTE } },
    { label: 'x2 Wins', icon: 'winsPotion', amount: '5m', reward: { kind: 'boost', stat: 'wins', ms: 5 * MINUTE } },
    { label: 'Demon Egg', icon: 'egg', amount: 'x1', reward: { kind: 'egg', egg: 'demon' } },
  ],
}

export const RARITIES = {
  common: { label: 'Common', bg: '#9aa0ad', text: '#ffffff' },
  uncommon: { label: 'Uncommon', bg: '#46cf3a', text: '#c6ff9a' },
  rare: { label: 'Rare', bg: '#3a7ef0', text: '#9ad8ff' },
  epic: { label: 'Epic', bg: '#9a3fe0', text: '#e6b0ff' },
  legendary: { label: 'Legendary', bg: '#ff9a1f', text: '#fff3a0' },
  mythic: { label: 'Mythic', bg: '#ff3fa8', text: '#ffd1ec' },
}
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

export const EGGS = {
  range: { open: 4.5, close: 6.5 }, // m from an egg: the E prompt shows inside `open`; an open window shuts past `close`
  openMany: 3, // pets per Open 3
  inventoryMax: 60,
  slots: 1, // pets equipped at the start (more slots can come from upgrades later)
  hatchMs: { shake: 1700, reveal: 1900, autoSpeed: 0.55 }, // the hatch animation; Auto plays it faster
  autoDelayMs: 350, // between Auto's hatches
}

// Equipped pets flying after the player (petFollowers.js).
export const PET_FOLLOW = {
  radius: 2.1, // m behind the player
  spread: 0.62, // rad between neighbours in the arc
  height: 1.6, // m above the feet
  bob: 0.18, // m
  followHz: 5, // how quickly they ease after the player
  scale: 0.55,
}
