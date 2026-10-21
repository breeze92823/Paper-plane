# Paper Plane: Lobby Map

The whole playable world is one lobby: a yellow studded plaza ringed by blocky
terraced hills. The player spawns in the middle. The four sides hold the game's
attractions:

| Direction | What's there |
|---|---|
| **North** | The **Throw Area** and the throwing field running up to the Neighbourhood gate, flanked by a school and a basketball court. The World 2 portal and the Demon Egg stand either side of the field's mouth |
| **West** | The Plane Hall, where planes are bought on red pads |
| **East** | The Rebirth Training Pads |
| **South** | The FREE REWARD dragon and the Egg Row, under a cliff with a waterfall |

Everything is built procedurally in code. There are no imported models except the player avatar.

---

## Coordinates

| | |
|---|---|
| Units | metres |
| Axes | **+X = east**, **−Z = north**, **+Y = up** (three.js default) |
| Origin | middle of the plaza, on the ground |
| Spawn | **(0, 0.3, 12)**, facing north toward the Throw Area |
| Camera | third-person chase: 13 m boom, 0.5 rad pitch, orbit with the mouse, zoom with the wheel |
| Ground | 400 × 400 m studded grass plate, y = 0 |
| World bounds | ±190 m on X and Z (the hills close the playable area long before that) |

Positions below are written as **(x, z)**, with height given separately where it matters.

---

## Top-down map

North is up. The map isn't to scale; coordinates are in the landmark index.

```
                                      NORTH (−Z)
              hills ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ hills
                             ┃ ▒▒ Neighbourhood ▒▒┃  z = −104  gate
              beige house    ┃      road ¦ (grey) ┃     yellow house
              white house    ┃           ¦        ┃     pink house
              blue house     ┃▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┃     teal house        z = −76  road starts
              SCHOOL ⏰      ┃                    ┃  ⛹ basketball court
              ✎ pencil       ┃   THROWING FIELD   ┃     benches
              grass bank ▄▄▄▄┃   (green, 24 m)    ┃▄▄▄▄ grass bank
  ──────────────────────▄▄▄▄═╩═══ THROW AREA ═════╩═▄▄▄▄──────────────────── z = −35 … −28
  │                     World 2 ◎        ▼▼▼▼▼        ◎ Demon Egg  ┃▭ FREE        │
  │                     (−13,−19)      chevrons       (13,−17)     ┃▭ 1 Rebirth   │
  │ ╭─────────────╮                                                ┃▭ 3 Rebirths  │ E
  │ │ PLANE HALL  │                                                ┃▭ 6 Rebirths  │ A
  │ │ front row   │◄══ ← ← ← ← ← floor arrows ← ←   ☺ SPAWN        ┃▭ 9 Rebirths  │ S
  │ │ back row    │                                    (0,12)      ┃▭ 12 Rebirths │ T
  │ │ mouth x=−22 │                                                ┃▭ 15 Rebirths │
  │ ╰─────────────╯     FREE REWARD ◉  ○ yellow ring               ┃▭ VERY OP!    │ C
  │      WEST           (−9,21.5)                                  ┃▭ BEST OVERALL│ L
  │                ▭ Unicorn  Sunset  Sphinx  Meadow  Basic ▭      ┃  (pads x 18–30)
  │                      EGG ROW  (z = 31)                         ┃              │ I
  └─────────────────────────────────────────────────────────────── z = 40 ───────┘ F
             ≈≈≈ waterfall (x −18)        ≈ small fall (x 4)                        F
                  SOUTH CLIFF: faces at z 44 / 52 / 60, rising 15 / 20 / 25 m
                                      SOUTH (+Z)
```

---

## Landmark index

| Landmark | Zone | Position (x, z) | Notes |
|---|---|---|---|
| Spawn point | Plaza | (0, 12) | On the walkway band, facing north |
| Orange chevrons | Plaza | x 0, z −7 → −15.4 | 5 floor chevrons pointing north to the Throw Area |
| White floor arrows | Plaza | (8, 13) → (−19, 16) | 9 arrows on a curve, pointing west to the Plane Hall |
| World 2 portal | North plaza | (−13, −19) | Ice-crystal ring with a spinning swirl. Sign: *World 2 / Needs 2.5M Power* |
| Demon Egg | North plaza | (13, −17) | Lava egg with flames, on a dark pedestal on a light-blue pad |
| **Throw Area** | North | x ±14, z −35 → −28 | Walkway strip across the field mouth, *THROW AREA* painted on the floor. Players throw from here |
| Throwing field | North | x ±12, z −35 → −112 | 24 m wide green studded field between sidewalks and stone fences |
| Road | North | x ±7, z −76 → −112 | Asphalt with a dashed white centre line |
| Neighbourhood gate | North | (0, −104) | Striped blue/white pillars, see-through blue panel, *🏠 Neighbourhood* |
| School | North-west | (−26, −50) | Red brick, clock tower, *SCHOOL* entrance facing the field |
| Giant pencil | North-west | (−15.8, −42.6) | Yellow pencil standing on its point by the school |
| Basketball court | North-east | (28, −48) | Blue court, white lines, two hoops |
| Plane Hall mouth | West | x −22, z −13 → 29 | Low elliptical arch, blue rim |
| Plane Hall back wall | West | x −62 | Closed half-ellipse |
| Purchase pads (front row) | West | x −34.75 | +1 (equipped) … +21 |
| Purchase pads (back row) | West | x −44.5 | +45 … +1.1K, with display frames |
| Rebirth Training Pads | East | x 18 → 30, z −17 → 31 | 9 pads, prizes at the east ends (x 27.8) |
| FREE REWARD | South plaza | (−9, 21.5) | Red dragon on a round pedestal |
| Yellow floor ring | South plaza | (−3.6, 21.8) | Flat ring beside the FREE REWARD |
| Egg Row stage | South | x −11 → 11, z 31 | Five hatchable eggs with odds boards |
| Main waterfall | South cliff | x −18 | 7 m wide, cascades 25 m down three terraces |
| Small waterfall | South cliff | x 4 | 2.4 m wide, on the second terrace (15 → 20 m) |

---

## Zones in detail

### Central plaza

- **Floor:** pale cream studded floor covering **x −60 → 34, z −28 → 40**.
- **Walkway:** deeper-yellow, stepped and outlined, laid over the floor in four parts:
  - **Throw Area** strip (x ±14, z −35 → −28) across the field mouth.
  - **North lane** (x ±5) running from the Throw Area to the band.
  - **Band** across the spawn, from the hall floor (x −20) to the training pads (x 16), z −2 → 17.5. Its edges step outward toward the Throw Area.
  - **South lane** (x ±6) stepping down from the band to the **egg area** (x ±14, z 27 → 38).
- **Decals:** the orange chevrons, the white floor arrows, the yellow ring and the *THROW AREA* lettering are flat floor decals. They aren't solid.

### North: Throw Area and the throwing field

**Throw Area**, the north edge of the plaza:

| | |
|---|---|
| Strip | Walkway-yellow, outlined, x ±14 from z −35 to −28, joined to the walkway's north lane (x ±5) |
| Lettering | *THROW AREA*, 19 m wide, in white letters with a dark outline painted flat at z −31.5, reading from the plaza |
| Sides | The grass banks |

Players stand here and throw their planes north up the field.

**Throwing field**:

| Feature | Details |
|---|---|
| Field | 24 m wide (x ±12) bright-green studded strip from z −35 to −112 |
| Road | Asphalt, x ±7, from z −76 to −112, with a dashed white centre line. The green shoulders continue either side |
| Sidewalks | White studded, 1.6 m wide (x ±12 → ±13.6), 0.15 m high, along the whole field |
| Stone fences | Dark-grey posts every ~3 m with two white rails, at x ±13.95, the full length of the field |
| Lamp posts | Yellow lamps on the sidewalks (x ±12.8), every 12 m from z −38 |
| Gate | z −104. Striped pillars 11 m tall at x ±9, blue lintel, translucent blue panel, *🏠 Neighbourhood* sign. Players can't pass it: the panel, fence pieces out to the field fences, and an invisible wall across the whole corridor (x ±50) stop them. Thrown planes fly through |
| Grass banks | 1.6 m-high grass-topped dirt banks either side of the Throw Area: x −38 → −14 and 14 → 38, z −38 → −29 |
| Trees | Blocky oaks at (−40, −40) and (40, −37); pines at (−40, −62), (40, −60), (−40, −108), (40, −108) |

**Beside the field**:

| Landmark | Centre (x, z) | Size | Details |
|---|---|---|---|
| School | (−26, −50) | 22 × 12 m, 12 m high | Red brick, 3 floors with white cornices; front faces the plaza. Its east end, toward the field, has a porch with blue doors, a blue *SCHOOL* plate and a clock tower (clock faces east and south) |
| Giant pencil | (−15.8, −42.6) | 7 m tall | Yellow, silver band, pink eraser, standing on its point between the school and the fence |
| Basketball court | (28, −48) | 20 × 14 m | Blue court with white lines, keys and arcs; a hoop with a glass backboard at each end |
| Picnic benches | (−16, −40), (16, −44), (16, −52) | 2.4 m | Orange |

**Houses** up the field (fronts with doors face the field):

| House | Centre (x, z) | Footprint (w × d) | Height | Look |
|---|---|---|---|---|
| Blue house | (−26, −70) | 11 × 10 | 7 m + gable | Light blue, dark-blue roof |
| White house | (−26, −86) | 10 × 9 | 6 m + gable | Cream, red roof |
| Beige house | (−27, −101) | 10 × 10 | 10 m | Beige, 3 floors, flat roof |
| Teal house | (27, −68) | 11 × 9 | 8 m + gable | White, teal roof |
| Pink house | (27, −84) | 10 × 9 | 6 m + gable | Pink, purple roof |
| Yellow house | (27, −100) | 9 × 9 | 7 m + gable | Pale yellow, green roof |

### North: the street (planes only)

Past the field (z −112) the road carries straight on north for 3.5 km, through themed zones to the Sky Port. Only thrown planes go up here. Distances are measured north from the Throw Area's edge (z −35), so a zone starting at *d* metres is at z = −35 − *d*.

| Zone | Starts at | Look |
|---|---|---|
| 🏠 Neighbourhood | 0 m (the field) | Gabled houses, hedges, oaks and pines |
| 🛍️ Main Street | 250 m | Shops with striped awnings, kiosks |
| 🌳 Park Avenue | 550 m | Oaks, pines, fountains, benches, flower beds, ponds |
| 🏙️ Downtown | 880 m | Towers with window bands, billboards |
| 🏖️ Seaside Boardwalk | 1,240 m | Plank road, palms, beach huts, umbrellas, lighthouses |
| ❄️ Snowy Lane | 1,640 m | White-roofed houses, snowy pines, snowmen |
| 🎃 Spooky Street | 2,060 m | Haunted houses with lit windows, dead trees, pumpkins, graves |
| 🍭 Candy Town | 2,500 m | Gingerbread houses, lollipops, candy canes, gumdrops |
| 🌃 Neon Night | 2,960 m | Dark towers with neon stripes, neon signs |
| ✈️ Sky Port | 3,400 m | Runway (threshold stripes, edge lights), hangars, control towers, airliners |

- **Every zone:** the field's cross-section carries on in the zone's colours (green or coloured verge, road with lane dashes, sidewalks, stone fences, lamps every 12 m), with lots out to x ±42 and two terraced walls beyond (5 m and 12 m high). Each zone after the first has a gate over the road where it starts, with its name.
- **The end:** a giant World 2 portal (4.5× the lobby one, *Needs 2.5M Power*) faces back down the runway at z ≈ −3570, in front of a wall across the street at z −3585. A full-length throw lands at 3,500 m, just short of the portal's pool.
- **Data:** `STREET` and `STREET_ZONES` in config.js. Buildings and props: `KINDS` and `ZONE_THEMES` in `src/streetProps.js` (seeded, so the street is the same every visit). To add a zone, add a `STREET_ZONES` entry and a theme with the same id.

### North plaza: World 2 portal and Demon Egg

- **World 2 portal**, at (−13, −19), turned to face the spawn:
  - **Base:** a shallow pool, 3.6 m radius.
  - **Ring:** 14 ice crystals in a 2.5 m radius, centred 3.1 m up, with a few loose crystals at the base.
  - **Swirl:** spins inside the ring, with a soft blue glow behind.
  - **Sign:** at 7.6 m: *🌐 World 2 · 💪 Needs 2.5M Power*.
- **Demon Egg**, at (13, −17):
  - **Base:** a 6.5 m light-blue studded pad and a dark-red stepped pedestal.
  - **Egg:** dark, with glowing lava cracks; it turns and bobs, with flickering flame cones on top.
  - **Sign:** *Demon Egg* at 6.4 m.

### West: Plane Hall

A low, wide half-tube with a closed back and blue rims at both ends. Its shell glows faintly so the inside stays bright, and it casts no shadow on the pads.

| | |
|---|---|
| Mouth | x −22, facing east onto the plaza |
| Back wall | x −62 (40 m deep) |
| Span | z −13 → 29 (half-width 21 m around z 8) |
| Height | 11 m |

**Floor steps inside**, all spanning z −11.5 → 27.5:

| x range | Top height | Colour | Role |
|---|---|---|---|
| −62 → −20 | 0.5 m | white | Hall floor, with blue trim at its front edge |
| −31.5 → −29.5 | 1.0 m | white | Step |
| −38 → −31.5 | 1.5 m | navy | **Front-row platform** |
| −39.5 → −38 | 2.0 m | navy | Step |
| −41 → −39.5 | 2.5 m | navy | Step |
| −49 → −41 | 3.0 m | navy | **Back-row platform** |

Every step is 0.5 m, under the 0.6 m step-up height, so the whole hall is walkable without jumping.

**Purchase pads** (south → north). Each pad has a hovering, spinning paper plane and a *Power / Wins* sign:

| Row | z = 21 | z = 14.5 | z = 8 | z = 1.5 | z = −5 |
|---|---|---|---|---|---|
| Front (x −34.75) | **+1 · EQUIPPED** (yellow pad) | +2 · 3 Wins | +5 · 25 Wins | +11 · 110 Wins | +21 · 280 Wins |
| Back (x −44.5, framed) | +45 · 700 Wins | +98 · 2.1K Wins | +210 · 5.6K Wins | +490 · 14K Wins | +1.1K · 35K Wins |

Back-row pads each stand in front of a blue display frame at x −47.5.

### East: Rebirth Training Pads

Nine short raised pads side by side on a light-blue studded base. Players stand on a pad to train.

| | |
|---|---|
| Base slab | x 16.5 → 31.5, z −21.2 → 35.2, 0.2 m high |
| Pads | x 18 → 30 (12 m long), 5.4 m wide, every 6 m from z −17 to z 31. Rim tops at 0.6 m, with an inset surface |
| Prizes | At x 27.8, on dark stands (or their own target stands), facing west back along the pad, at ¾ scale |
| Signs | Float at about 6.6 m above each prize |

| # | z | Tier | Bonus | Surface | Prize |
|---|---|---|---|---|---|
| 1 | −17 | FREE | x1 Power | grey | Red-and-white bullseye |
| 2 | −11 | 1 Rebirth | x2 Power | green | Green bullseye |
| 3 | −5 | 3 Rebirths | x3 Power | blue | Spinning gold star |
| 4 | 1 | 6 Rebirths | x5 Power | purple | Spinning purple gem |
| 5 | 7 | 9 Rebirths | x8 Power | polished gold | Gold bullseye |
| 6 | 13 | 12 Rebirths | x12 Power | orange lava | Orange hexagon in a spiked frame |
| 7 | 19 | 15 Rebirths | x18 Power | crimson lava | Ruby in a spiked frame |
| 8 | 25 | **VERY OP!** · ⬢ 45 | x30 Power | rainbow | Rotating rainbow ring |
| 9 | 31 | **BEST OVERALL!** · ⬢ 279 | x100 Power | dark navy, cyan neon rim, lightning | Dark ring with a spinning blue swirl |

⬢ is the premium currency (gamepass tiers).

### South: FREE REWARD and Egg Row

- **FREE REWARD**, at (−9, 21.5), turned to the spawn:
  - **Pedestal:** dark-red round, with a gold top ring.
  - **Dragon:** a chunky red dragon with big white eyes, horns and wings. It sways side to side.
  - **Sign:** *FREE REWARD* at 5.6 m.
- **Yellow ring:** at (−3.6, 21.8), on the floor beside it.
- **Egg stage:** white studded, blue front trim, x −11 → 11, z 28.2 → 33.8, 0.4 m high.
- **Each egg** faces north and has:
  - a white pedestal with a blue band;
  - a spotted egg;
  - a navy pet-odds board on posts behind it;
  - a name/cost sign.

| Egg (east → west) | x | Cost | Look |
|---|---|---|---|
| Basic | 8.4 | 🏆 25 Wins | Off-white |
| Meadow | 4.2 | 🏆 50 Wins | Mint green |
| Sphinx | 0 | ⬢ 395 | Gold with blue spots, glossy. Sign: *BEST IN GAME · 1000% BETTER*, gold board |
| Sunset | −4.2 | 🏆 4K Wins | Peach |
| Unicorn | −8.4 | ⬢ 12 | White with pink spots, gold horn, pink mane |

### Surrounding terrain

| Feature | Details |
|---|---|
| Blocks | 8 × 8 m dirt columns with grass caps on a grid (x −152 → 152, z −176 → 104), merged into a few meshes |
| Open ground | Columns never stand on the plaza (x −66 → 34, z −32 → 40) or the field corridor (x −42 → 42, z −112 → −32) |
| Ordinary hills | Step up 2.5 m for every 7 m from the open ground, with random half-level bumps, capped at 20 m |
| Cliffs | **South of z 40** and **east of x 34**: twice as steep plus 10 m, capped at 40 m |
| South cliff faces | z 44, 52, 60 rise to 15, 20, 25 m. These three are kept even for the waterfall |
| East cliff | Its first face at x 36 rises 15 m, a few metres behind the training pads |
| Waterfalls | **Main** (x −18, 7 m wide): sheets down the 44 / 52 / 60 faces, streams across the terrace tops between them, a lip at the top and a splash pool at the foot (z ≈ 42.5). **Small** (x 4, 2.4 m wide): the 52 face, 15 → 20 m |
| Trees | Blocky four-tier pines on about 20% of columns within 60 m of the open ground, plus the free-standing oaks and pines listed above |

---

## Movement and collision

- **Step-up height:** the player walks up any ledge of **0.6 m** or less: the hall steps, pad rims, egg stage, training base and pads, sidewalks, the basketball court and the walkway.
- **Solid:**
  - the school (and its porch), houses, the giant pencil, stone fences, lamp posts, gate pillars, hoop poles, benches;
  - the hall's side feet and back wall;
  - the portal ring, Demon Egg pedestal, FREE REWARD pedestal;
  - the training-pad prizes, eggs and boards;
  - free-standing trunks;
  - hill columns within 30 m of open ground.
- **Not solid:** floor decals (walkway, Throw Area lettering, chevrons, arrows, yellow ring), the gate's blue panel, waterfalls, signs.
- Falling below y −30 respawns the player.

## Animated elements

| Element | Motion |
|---|---|
| Paper planes over the purchase pads | Spin and bob |
| World 2 swirl | Spins |
| Demon Egg | Turns and bobs; flames flicker |
| Star and gem prizes | Spin |
| Rainbow ring | Rotates in place |
| BEST OVERALL swirl | Spins |
| FREE REWARD dragon | Sways |
| Waterfalls | Water texture scrolls downhill |

---

## Where it lives in code

| File | Contents |
|---|---|
| `src/config.js` → `MAP`, `PALETTE` | **All layout and content**: plaza, walkway, Throw Area, field, school, court, benches, houses, hills, hall, pads, training pads, eggs, waterfalls, colours. Change positions, prices and sign text here |
| `src/map.js` | Places every landmark and adds its colliders and animations |
| `src/props.js` | Builders for each prop (hall, pads, portal, egg, prizes, dragon, egg stands, waterfall, stone fences, lamps, gate, school, pencil, court, benches, houses, pines, oaks) and floor/panel/billboard text |
| `src/config.js` → `STREET`, `STREET_ZONES` | The street past the gate: its length, walls, zones and their colours, the end portal |
| `src/street.js` | Builds the street zone by zone: ground, road, fences, walls, zone gates, the runway, the end portal, and places each zone's scatter |
| `src/streetProps.js` | The street's building and prop types and each zone's theme |
| `src/terrain.js` | The terraced hills, cliffs and hill trees |
| `src/textures.js` | Canvas-painted textures: studs, facades, lava, gold, rainbow, neon, swirl, egg shells, odds boards, water, court, clock, signs |
| `src/world.js` | Sky, ground, lights, fog |

The on-screen HUD (Auto Throw, Pets/Rebirth/Items/Store, boosts, power bar) is separate (`src/hud.js`) and isn't part of the map.
