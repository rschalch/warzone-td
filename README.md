# Warzone TD

**[Play it in your browser](https://rschalch.github.io/warzone-td/)**

A tower defense game inspired by the Flash classic *Warzone Tower Defense*, built with TypeScript, Vite and PixiJS v8 (WebGL).

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run smoke    # end-to-end browser test (needs Google Chrome)
```

## How it plays
There is no road. Ground units enter through a gate on one edge and leave through another, always taking
the shortest route. Your 2×2 towers are the walls: build a maze so they walk past as many guns as possible.
A tower that would seal the route completely, or that would land on a unit, is refused. While you're placing a tower, the
current route is drawn in white and the route your new tower would create in green. Air units ignore the maze.

Five maps, from 96×64 cells (Open Field) up to 160×104 cells with three routes (Badlands). The map is larger than
the screen: pan and zoom the camera, and use the minimap in the corner to jump around.

Terrain shapes the maze: **mountain ranges** and **forests** are impassable (and never seal a route, so the gaps
between them become natural choke points), and **rivers** can be crossed but slow ground units to 55% speed. Ground units weigh
that when picking a path: they go around a river when a dry way is about as quick. Nothing can be built on
either; aircraft ignore both.

## WW2 mode (branch `ww2`)
The same game with the Second World War's weapons and realistic ratios. Pick a side — **Germany**, the **Soviet
Union**, the **Western Allies** or **Japan** — and fight another side's army, or fight the
**WW2 Campaign**: twelve historical battles from Moscow 1941 to the Seelow Heights 1945, each on its own map.

- **Two bases**: your headquarters stands where the routes end and theirs where their columns enter. Attackers
  march on your HQ and fight there (nothing slips past); the waves only stop when one headquarters falls. Their
  base has machine-gun nests and anti-tank guns, rebuilds what you destroy, and repairs its HQ if you let up.
  Emplacements take time to build and rebuild. In the campaign, holding out to the last wave also wins.
- **Armour and penetration**: every gun has penetration in mm that drops with range, every vehicle has front,
  side, rear and top armour. Rifles and MGs bounce off tanks; an anti-tank gun kills a T-34 from the side and
  bounces off its front. Shots can break a track or blow the ammunition. Machine guns pin infantry down.
  Crews hold fire at armour they can't get through from where they stand, and the panel tells you why.
- **The enemy fires back** at your emplacements and units: tanks halt to aim, emplacements have HP and
  fortification (sandbags, timber, concrete) and become rubble you can rebuild; workshops and engineers repair.
- **Units**: barracks, motor pool and airfield train squads, MG and anti-tank teams, snipers, engineers, medics,
  tanks and fighter patrols, with Hold / Guard / Hunt / Ambush stances. Units dig in (foxholes, hull-down tanks),
  earn veterancy ranks from their kills, and engineers lay anti-tank mines. Dragon's teeth stop vehicles; infantry
  climb over them.
- **Commander**: fire missions, Hold the Line (rallies suppressed crews) and recon flights that mark attackers.
- **Stealth**: camouflaged guns are hidden until spotted or until they fire; recon units find them; Ambush mode.
- **Enemy intelligence**: tanks and sappers breach long thin mazes, tanks pop smoke, artillery prepares the
  assault, waves adapt to your defence. Banzai charges and kamikazes for Japan.
- **Super-weapons**: Stuka and V-2, Il-2 regiment and the B-4 howitzer, P-47s and Little Boy, Vals and the
  Type 98 spigot mortar.
- **Music** of each side: period recordings in the public domain (Wikimedia Commons, credits in
  `public/music/CREDITS.md`): German marches and the Horst-Wessel-Lied, Soviet songs and anthems, American
  military bands, Japanese naval marches.
- **Co-op with AI** works in WW2 and in the campaign.

## Modes
- **Campaign maps** and **random maps** (size, routes, rock density and terrain from a shareable code such as `M2-12-48213`).
- **Daily challenge**: the same map, seed and twist for everyone that day.
- **Map editor**: paint rocks, rivers, mountains and forests, place entry/exit gates, save, play, or share the map as a link.
- **Co-op**: two players, one shared bank. The host gets a room code; the game runs in lockstep over a direct
  WebRTC connection (PeerJS only brokers the introduction).
- **Co-op with AI**: play alongside an AI commander that shares your bank (Support / Equal / Lead: 30, 50 or 70%).
  It reads the next wave, builds what the defence lacks (anti-air, radars, jammers, armour piercers), lengthens
  the maze, upgrades its own towers (marked with a cyan ring) and talks to you over the radio. It never touches yours.
- **Replays**: every game can be shared as a link and watched back, with a skip-to-next-wave button.
- **Difficulty** (Easy → Brutal) and **challenges** (No Barricades, Limited Arsenal, Air Raid, Ironman, Glass Cannon)
  multiply the score. Scores go to a local leaderboard.
- **Research**: wins earn medals that buy permanent perks (starting money, lives, damage, cheaper walls…).
- A **commander** you move around the map (it levels up from kills and has an airstrike, a rally and a stun
  grenade), plus three **tactical items** that recharge every wave: a barrage, a mine drop and a supply crate.

Games are saved at every wave and when you leave the tab, and can be continued from the main menu. It also installs
as an app and works offline.

## Towers
34 towers in seven groups, all shown at once in the build palette. Each has ten upgrade levels (except the barricade and the gate): every level raises damage, range and fire rate, and the tower's base changes so you can see its rank — concrete, steel, dark armour with gold trim, then gold, with chevrons and stars on the front edge.
- **Basic** — Gun, Cannon, Missile, Laser, Tesla, EMP.
- **Fire & Chem** — Flamethrower (cone, fire spreads), Napalm Mortar (burning ground), Acid Sprayer (shreds armour),
  Gas Launcher (drifting clouds, strong vs infantry).
- **Precision** — Sniper, Railgun (pierces a line), Gatling (spins up, overheats), Flak (air only), Artillery
  (huge range but needs a radar to spot).
- **Control** — Cryo (chill → freeze; frozen units shatter under splash), Gravity Well, Repulsor (knockback),
  Hacker (hijacks a vehicle to fight its own wave), Shield Jammer.
- **Support** — Supply Depot (income + interest each wave), Radar (reveals stealth, +range), Command Post
  (+fire rate), Salvage Yard (+bounty).
- **Maze** — Barricade (1×1 wall), Minefield, Tar Pit and Spike Strip (built on the path, never block it),
  Gate (open/close to reroute), Bunker (hits two units at once).
- **Super** — Orbital Laser and Nuke Silo (charge up, then you aim them), Drone Hive, Black Hole Projector.

Twelve **combos** reward placing two specific towers side by side (e.g. Gun + Gatling *Lead Storm*,
Laser + Tesla *Ion Lance*, Flamethrower + Gas *Firestorm*); the info panel lists them.

Later waves add **Ghosts** (stealth: need radar), **Aegis** (regenerating shields: jam them) and **Medics**
(heal nearby units).

## Controls
All 34 towers are in one palette of icon tiles (hover one for its name and what it does): click one, or `1`–`9`, `0` for the first ten and `Q`/`E` for previous/next; then click or drag to build (the tower type stays selected) · `Esc`/right-click stop ·
`U` upgrade · `S` sell · `T` cycle targeting (First/Last/Strong/Close) · `N` next wave (early-call bonus) ·
`Space` pause · `F` cycle speed (1×/2×/4×) · `V` switch camera (top / isometric) · `G` open/close the selected
gate · `R` aim the selected superweapon (then click a target) · `K` mute · `,` / `.` previous / next music track
(also in the top bar, with the music volume and the name of the piece playing).

`H` select the commander (click ground to move it) · `[` `]` `\` its abilities · `Z` `X` `C` tactical items ·
`Shift`-drag select a group (bulk upgrade/sell) · `Ctrl+Z` undo the last build · hold `Tab` to see every aura.

Click anything on the battlefield (a tower, an enemy, your commander) or hover any button to see what it does in the side panel.

Touch: tap to build or select, drag to pan, pinch to zoom.

Camera: drag empty ground, right-drag or middle-drag, or the arrow keys to pan · mouse wheel/pinch or `+`/`-` to zoom ·
`Home` to see the whole map · click or drag on the minimap to jump.

## Architecture
Working on the code (human or AI)? Start with [`CLAUDE.md`](CLAUDE.md): commands, ground rules and how-tos.

- `src/game/commands.ts` + `src/app/session.ts` — every player action is a command applied between ticks. The
  simulation is deterministic (gameplay and particles use separate RNGs), so a config plus the command log
  reproduces a game exactly: that is what replays, co-op lockstep (with periodic state-hash checks) and saves use.
- `src/game/config.ts` — difficulty, challenge modifiers and research perks.
- `src/audio/` — all sound effects (rendered into sample banks in a worker by `dsp.ts`) and the orchestral score are synthesised with WebAudio; no audio files.
- `scripts/gauntlet.ts` and `scripts/bot.ts` — headless balance tools: damage per dollar for every tower against a
  standard wave, and a heuristic bot that plays whole games
  (`npx vite build --ssr scripts/bot.ts --outDir .bench && node .bench/bot.js`).
- `src/game/maps.ts` — map definitions (size, gates, rock count, rivers, mountain ranges). Map size is a live
  module binding in `defs.ts` (`setMapSize`), so the hot loops read plain numbers. Rivers meander across the
  first route's direction; mountain ranges are chains of noisy discs gathered around the middle of the map. Rocks and mountains are rejected if they
  would cut a route: first a tiny local search (are the free cells around the obstacle still connected?), and a
  flood fill per route only when that fails.
- `src/game/flow.ts` — one Dijkstra distance field per route (8-way moves weighted by terrain, no corner cutting), recomputed
  when the maze changes. Each unit steps toward its cell's `next` cell, so pathing costs one lookup per unit.
- `src/game/` — simulation with no rendering code. Fixed 60 Hz tick, struct-of-arrays typed-array storage
  for enemies, projectiles and effects (no per-frame allocations), and a counting-sort spatial grid for targeting.
- `src/render/projection.ts` — two cameras over the same flat sim: **Top** (classic, default) and **Iso**
  (2:1 isometric). Press `V` or use the View button to switch; the choice is saved. Things that lie on the ground
  (terrain, range rings, route preview, shadows) draw through the camera's ground matrix. Upright objects are
  projected individually and depth-sorted each frame with an O(n) counting sort. Anything outside the
  camera's view is culled before sorting.
- `src/render/models.ts` — every unit, turret, tower block and rock is a stack of top-down parts with heights
  (sprite stacking): treads, camouflage, hatches, muzzle brakes, coil windings and so on.
- `src/game/sim.ts` also keeps per-cell aura grids (radar, jammer, salvage, tar, spikes) rebuilt only when the
  towers change, so status lookups are one array read per unit per tick.
- `src/render/bake.ts` + `bake.worker.ts` — model baking runs in parallel Web Workers (OffscreenCanvas) and
  the frames come back as ImageBitmaps, keeping startup around half a second.
- `src/render/atlas.ts` — packs every frame into one texture: per model, 16 iso headings (lit tops, shaded sides,
  outline, contact shadow) plus one top-down frame that is rotated at runtime. Also draws the effects and floor
  decals (no image files for any of these), and the terrain markings (grid, gates).
- `src/render/landscape.ts`, `terrainGL.ts` — the terrain: a heightfield shaped by the map (a ridged spine over
  every massif, valleys under the rivers) and carved by droplet hydraulic erosion in a worker, then painted in one
  WebGL2 shader in a cartoon style: painted greens, terraced cliffs with ink outlines, cel-banded light, bright
  water with foam lines. Cartoon trees and bushes (baked models) stand on the forests and mountain slopes.
- `src/ui/` — DOM HUD with diffed writes, and a 2D-canvas minimap redrawn at 10 Hz.

The **Stress test** button in the footer builds a serpentine maze of maxed towers and spawns 3000 enemies. The footer also shows FPS and sim/render cost.
