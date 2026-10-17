# Warzone TD

**[Play it in your browser](https://rschalch.github.io/warzone-td/)**

A tower defense game inspired by the Flash classic *Warzone Tower Defense*, built with TypeScript, Vite and PixiJS v8 (WebGL).

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
```

## How it plays
There is no road. Ground units enter through a gate on one edge and leave through another, always taking
the shortest route. Your 2×2 towers are the walls: build a maze so they walk past as many guns as possible.
A tower that would seal the route completely, or that would land on a unit, is refused. While you're placing a tower, the
current route is drawn in white and the route your new tower would create in green. Air units ignore the maze.

Five maps, from 96×64 cells (Open Field) up to 160×104 cells with three routes (Badlands). The map is larger than
the screen: pan and zoom the camera, and use the minimap in the corner to jump around.

## Towers
34 towers in seven tabs. Each has three levels except the barricade and the gate.
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
`Q`/`E` switch build tab, `1`–`6` pick a tower in it, then click or drag to build (the tower type stays selected) · `Esc`/right-click stop ·
`U` upgrade · `S` sell · `T` cycle targeting (First/Last/Strong/Close) · `N` next wave (early-call bonus) ·
`Space` pause · `F` cycle speed (1×/2×/4×) · `V` switch camera (top / isometric) · `G` open/close the selected
gate · `R` aim the selected superweapon (then click a target).

Camera: drag empty ground, right-drag or middle-drag, or the arrow keys to pan · mouse wheel/pinch or `+`/`-` to zoom ·
`Home` to see the whole map · click or drag on the minimap to jump.

## Architecture
- `src/game/maps.ts` — map definitions (size, gates, rock count). Map size is a live module binding in
  `defs.ts` (`setMapSize`), so the hot loops read plain numbers. Rocks grow in outcrops and are rejected if
  they would cut a route, checked with a cheap flood fill.
- `src/game/flow.ts` — one Dijkstra distance field per route (8-way moves, no corner cutting), recomputed
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
  outline, contact shadow) plus one top-down frame that is rotated at runtime. Also draws the effects, floor
  decals and the terrain. No image files.
- `src/ui/` — DOM HUD with diffed writes, and a 2D-canvas minimap redrawn at 10 Hz.

The **Stress test** button in the footer builds a serpentine maze of maxed towers and spawns 3000 enemies. The footer also shows FPS and sim/render cost.
