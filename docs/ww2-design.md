# WW2 mode — design

A second ruleset inside the same game (same maps, menus, saves, replays, co-op). The player picks a side
(**Germany**, **Western Allies**, **Soviet Union**, **Japan**) and defends against an opposing faction. Realism is in the
**ratios** (time is compressed, numbers are not literal): small arms can't hurt tanks, tanks reload slowly,
armour has a facing, the attacker shoots back and thinks.

Insignia are historical (private build, not for publication): Balkenkreuz on German vehicles, swastika
on Luftwaffe tail fins, air-recognition flags and the faction flag; Allied stars / roundels, Soviet red stars.

## 1. Ballistics (the core rule)

- Weapons have `pen` (mm, falls off with range) and damage; HE weapons also have splash and blast.
- Vehicles have armour `[front, side, rear]` (mm). The hit sector comes from the angle between the unit's
  hull heading and the line to the shooter.
- `pen < armour` → bounce: ~0 damage (small chance of a track hit). `pen ≥ armour` → full damage;
  `pen ≥ 1.5 × armour` → bonus damage and a knockout chance (crew bails). Gameplay randomness from `sim.rng`.
- Soft targets (infantry, trucks): armour 0; rate of fire and splash decide.
- **Suppression** (MGs, artillery): pinned infantry crawl, take less damage, bunch up. Suppressed crews of
  guns fire slower.
- **Track hits** from HE / near misses: vehicle immobilised for a few seconds.
- Range ring of an AT gun shows where it penetrates the selected enemy's front (green) / side (yellow).
- Targeting uses the same rule as the damage (`penRatio()`: the side the target shows from the shooter, the
  penetration left at that distance): a crew only fires when pen ≥ 0.8 × that armour (a hit there still does real damage), so nothing fires and
  bounces. When a gun holds fire at something inside its circle, the panel says why (`fireStatus()`: armour too
  thick from here, ambush waiting inside the inner ring, artillery without a spotter, smoke).
  `npm run probe` (`WW2=1 ALL=1` for every matchup) checks every weapon at 50/80/95/100% of its range.

Rough penetration (mm): rifles/MG 8 · .50 cal 20 · 20 mm 30 · PTRD 35 · ZiS-3 / Sherman 75 75 · bazooka/PIAT
100 · PaK 40 120 · 88 Flak 130 · Panzerschreck 180 · 17-pdr APDS / PaK 43 190 · Panzerfaust 200 (60 m).
Rough armour (front/side/rear): Pz IV 80/30/20 · Panther 140/45/40 · Tiger 100/80/80 · King Tiger 230/80/80 ·
Sherman 90/38/38 · Pershing 150/76/50 · T-34 90/60/40 · IS-2 160/90/60 · halftracks 14/8/8.

## 2. Defences

### 2a. Emplacements (towers — still the maze walls)
Per faction, same roles with that faction's equipment: MG nest, sniper, infantry AT team, AT gun, dual AA/AT
heavy flak, light flak, mortar, howitzer, rocket artillery, flamethrower, dug-in tank, pillbox / bunker.
Maze pieces: barbed wire (infantry slow, tanks crush it), AT mines, AP mines, dragon's teeth (stop vehicles,
infantry climb over), sandbags, trenches. Support: supply depot, observation post (spotting), field HQ
(command aura), repair workshop, **barracks / motor pool / airfield** (produce units, §2b).

Emplacements now have **HP and an armour class** (sandbags < earth & timber < concrete). The enemy can destroy
them (§3). A destroyed emplacement becomes **rubble**: walkable but slow, rebuildable for less. Engineers and
the workshop repair. Upgrades (10 levels): fortification + crew veterancy every level (HP, armour class,
reload, accuracy, camo), ammo steps at some levels (APCR at 4, HE at 7), variant at the top (PaK 40 → PaK 43).

### 2b. Units (new — mobile, never block the path)
Bought from barracks / motor pool, capped by **manpower** (raised by HQ and depots). Selected and ordered like
the hero (click / box select, move, stance). Units walk the grid with their own path search and never change
the flow fields, so mazes stay valid.

- **Stances:** *Hold* (stay, fire at what comes in range), *Guard* (return to post after chasing, leash radius),
  *Hunt* (chase targets anywhere), *Ambush* (hidden, hold fire until a good shot — side armour or point blank).
- **Tanks** (Panzer IV / Panther / Tiger · Sherman / Firefly / Pershing · T-34 / KV / IS-2): turreted, armour
  facing applies to them too — they turn their front towards the biggest threat. Can dig in (hull-down:
  front armour only, can't move).
- **Infantry squads** (rifle, MG team, AT team, sniper, flamethrower), **engineers** (repair emplacements,
  lay mines and wire, clear enemy smoke/obstacles), **medics** (heal infantry, revive downed squads).
- **Planes** from the airfield: fighter sorties (air superiority over an area), ground-attack runs on a point
  (Stuka / P-47 / Il-2), recon flight (reveals). Aircraft are on cooldown timers, not hand-flown.
- Units gain veterancy; lost units refund nothing.

## 3. The attacker fights back

- Every enemy has weapons with the same ballistics: rifles suppress your infantry, tanks fire HE at
  emplacements and AP at your tanks, AT guns are towed in and set up, artillery bombards from off-map.
- **Halt and fire:** tanks stop to shoot accurately (moving fire is inaccurate), so engaging them slows them.
- **Breach logic (intelligence vs fortified positions):** besides the normal flow field, each route has a
  *breach field* where an emplacement cell is passable at a cost proportional to its HP / armour. When the
  maze detour costs much more than breaking through, assault groups (tanks, engineers with charges) push into
  the cheapest wall and destroy it. Long, thin mazes get breached; deep, well-covered ones don't.
- **Tactics:** tanks turn their front to known AT threats; infantry go prone under fire and use smoke when
  taking AT fire; engineers clear mines and cut wire ahead of the column; artillery preparation hits revealed
  positions before an assault wave; recon units probe first.
- **Adaptive waves:** the attacker's composition reacts to what it has seen — lots of AT guns → more
  infantry and artillery; lots of MGs → more armour; no flak → air attacks.

## 4. Stealth & spotting (both ways)

- Snipers, AT guns, dug-in tanks and units in Ambush have **camo**. Enemies only target what they have
  **spotted**: within spot range (smaller vs high camo, larger for recon units / spotter planes), or a
  defender that **fired recently** (muzzle flash reveals for a few seconds; snipers and suppressed guns
  reveal less). Moving breaks camo.
- Snipers have shoot-and-relocate (a short hide after a kill). Hidden AT guns in Ambush hold fire until a
  side shot or point blank — the first shot gets a bonus.
- The enemy's stealth units (scouts, infiltrators) are revealed by observation posts / recon, as radar does now.

## 5. Factions & doctrine

| | Germany | Western Allies | Soviet Union |
|---|---|---|---|
| Strength | few, expensive, long-range high-pen guns; best MG | economy, artillery and air call-ins | cheap and numerous, extra mines, manpower |
| Weakness | expensive, low manpower | weaker AT individually | lower accuracy, thin armour early |
| Super | Stuka / FW-190 strike, Nebelwerfer, **V-2** (done) | P-47 rockets, time-on-target barrage, **Little Boy** (B-29, last-tier, very long charge) | Il-2, **Katyusha** (as an attacker: done) |
| Commander | Tiger | Pershing | IS-2 |

Maps: Kursk (open steppe), Normandy bocage (hedgerows = forests), Stalingrad ruins, Bastogne (snow),
Seelow Heights.

### 5a. Historical campaign
A WW2 campaign of famous battles, each a hand-made map with its own side, enemy, briefing, a fixed
arsenal (what that army had then) and objectives beyond "survive 30 waves" (hold until relieved, keep
a bridge, keep the HQ alive):

| Battle | Year | You defend as | Notes |
|---|---|---|---|
| Moscow | 1941 | Soviet Union | winter, T-34s and KVs appear late; Germans freeze (slower) |
| Stalingrad | 1942 | Soviet Union | city ruins (rubble cells, narrow streets), Volga crossing as the exit, snipers |
| El Alamein | 1942 | Western Allies | desert, minefields ("Devil's gardens"), Afrika Korps |
| Kursk (Prokhorovka) | 1943 | Soviet Union | Pakfront in reverse: deep belts of AT guns and mines vs Tigers and Panthers |
| Omaha Beach | 1944 | Germany | the Atlantic Wall: bunkers, hedgehogs, MG-42s over the beach; landing craft waves |
| Normandy bocage | 1944 | Germany | hedgerows as forests, Shermans and Fireflies, Allied air superiority |
| Arnhem (Market Garden) | 1944 | Western Allies | hold the bridge until XXX Corps arrives |
| Battle of the Bulge (Bastogne) | 1944 | Western Allies | snow, encircled, King Tigers; air support only when the weather clears |
| Seelow Heights / Berlin | 1945 | Germany | last stand against massed IS-2s and Katyushas |

Medals per battle on the campaign map, as in the classic campaign.

As built (`src/game/battles.ts`, menu "WW2 Campaign"): Moscow 1941, Stalingrad 1942 (keep Pavlov's House),
El Alamein 1942 (minefields laid), Kursk 1943, Omaha Beach 1944 (Atlantic Wall bunkers), Normandy bocage 1944,
Arnhem 1944 (keep the bridge, paratroopers without heavy weapons), Bastogne 1944 (keep the HQ, aircraft
grounded until wave 12), Guadalcanal 1942 (keep Henderson Field), Iwo Jima 1945 (caves dug in), Okinawa 1945,
Seelow Heights 1945. Each battle: its own hand-painted map and ground theme (snow, desert, ruins, volcanic,
jungle, steppe), waves to hold, the attacker's period roster and doctrine, an optional objective that loses
the battle when knocked out, pre-built positions, banned slots, start money and enemy speed.

### 5b. Japan (Imperial Japanese Army and Navy air arm)
| | Japan |
|---|---|
| Strength | infantry in numbers and at night, fortified caves and spider holes (camo), banzai charges, light and fast |
| Weakness | thin armour (Type 95 Ha-Go 12 mm, Type 97 Chi-Ha 25 mm), weak AT (Type 1 47 mm, 50 mm pen) |
| Weapons | Arisaka rifle, Type 99 LMG, Type 92 "woodpecker" HMG, Type 89 knee mortar, Type 1 47 mm AT gun, Type 41 75 mm mountain gun, Type 4 Ha-To rocket, lunge mines; Type 97 Chi-Ha, Type 95 Ha-Go, Type 1 Chi-He |
| Air | A6M Zero, Ki-43 Oscar, D3A Val dive bomber, kamikaze (as an attacker: a plane that dives on an emplacement) |
| Super | Kamikaze strike, Type 4 rocket barrage |
| Commander | Type 97 Chi-Ha command tank |

As defender: cave networks (bunkers revealed only when they fire), spider holes (AT teams in ambush),
interlocking Type 92 nests. As attacker: banzai charges (fast infantry rushes that ignore suppression
for a few seconds), night infiltration (stealth), kamikazes against the strongest emplacement.
Pacific battles for the campaign: Guadalcanal (1942, Allies defend Henderson Field), Tarawa (1943, Japan
defends the atoll), Saipan (1944), Iwo Jima (1945, Japan: caves and tunnels on Mount Suribachi),
Okinawa (1945, Japan: Shuri Line).

## 6. Engineering

- `GameConfig.mode: 'classic' | 'ww2'`, `faction`, `enemyFaction`. A `setRuleset()` live binding (like
  `setMapSize`) swaps `TOWERS` / `ENEMIES` / waves; anything that builds another ruleset temporarily restores it.
- New sim state as typed arrays (enemy weapons/cooldowns/target, suppression, spotted, tower HP, unit SoA),
  saved by `snapshot()` automatically; object refs mapped to ids.
- New commands: `unitMove`, `unitStance`, `train`, `sortie`, `repair`, `dig`.
- Performance: spatial hash for towers + units as targets for enemies; AI decisions staggered (each enemy
  thinks every N ticks); breach fields recomputed only when the maze changes.
- The bot, the AI partner, smoke test and gauntlet need WW2 variants.

## 8. Realism features (October 2026)

### 8.1 Supply
- Every gun has an ammunition stock (`Tower.ammo`): seconds of sustained fire by role — MGs 100, snipers 80,
  AT guns, mortars and rockets 60, howitzers 50, flamethrowers 40. Empty guns fire at 40% of their rate.
- Depots supply the guns in their radius (180 px) from a store of six full stocks; our headquarters supplies the
  guns within 200 px from an endless one; guns out of reach scrounge 0.6%/s under fire and five times that while
  no attacker is on the field. A depot below 60% calls a truck from the
  nearest headquarters (one per depot, eight at most); trucks path round the maze and can be shot.
- The enemy: a supply dump behind its headquarters (a garrison position, rebuilt like the others) and a truck every
  ~12 s from the rear (+0.2 supply each, half if the dump is down). A wave uses 0.25; the counts scale with
  0.5 + 0.5 × supply, and below 0.5 the next wave waits up to 30 s longer. Destroying the dump burns 0.4.

### 8.2 Morale
- Infantry attackers have morale (`eMorale`). It falls with heavy losses (below 40% of their strength), with every
  man killed within 70 px (−0.07) and after 3 s pinned down; it comes back when they're not under fire, faster with
  their officer alive. Banzai troops lose it at a third of the rate.
- Every infantry wave brings an officer (ARole `officer`). His death costs the whole wave 0.35 morale.
- Under 0.3 a squad breaks: pinned (suppression over 60%) it surrenders — removed, bounty paid, "SURRENDERED" —
  otherwise it falls back along a flow field to its entry and leaves the field (no leak, no bounty), holding fire.
- Our side: a knocked-out position or lost unit adds suppression to the crews and soldiers within 160 px and
  leaves them shaken for 8 s (their suppression wears off at less than half the rate); veterans (`unitVet`) and
  higher-level crews feel it less.

### 8.3 Line of sight and fog of war
- Forests, mountains and rocks (ruins in the city battles) block sight. Direct-fire guns (MGs, AT guns, snipers,
  flamethrowers, bunkers, tanks dug in) need their own line of sight: a per-tower mask of the cells they see, built
  once from the terrain. Units and the commander raycast when they pick a target. Mortars, rockets and artillery fire
  at anything something of ours sees; artillery still needs an observer (whose coverage respects sight) or a target
  within 140 px. Aircraft are always seen and never blocked.
- Fog of war (gameplay state, saved): our emplacements see max(their range, 140 px), units max(their gun, 130 px),
  the commander 130 px, aircraft 220 px. An attacker that fires is seen for 2.5 s; marked ones stay seen; the enemy's
  base positions are known. Out of sight, attackers aren't drawn, picked or shown on the minimap; the renderer marks
  their last known position for 7 s. The wave preview stays.
- The panel says when a gun can't fire for lack of sight.

### 8.4 Combined arms
- Rifle and assault squads join the nearest tank of their wave on their route (three per tank) and keep pace
  with it along the flow field (they wait when they get ahead, hurry when they fall behind).
- A tank with no infantry within 60 px is unescorted: rocket teams (the `at` slot) and our soldiers do 1.5× damage
  to it, and our infantry positions (MG, rocket team, flamethrower, bunker, sniper) and soldiers within reach throw
  satchel charges on its deck (45 dmg growing with the waves, 70 mm against the top, every 7 s). Escorted tanks
  spot camouflaged positions 1.5× further.
- When its tanks close on a strongpoint they know about (fortification ≥ 25 mm or a headquarters, 90–230 px away)
  a wave lays smoke 65% of the way to it, twice at most.

### 8.5 Counter-battery
- Each shot of our mortars, rocket launchers and howitzers gives the enemy a quarter of a fix on that gun (less the
  better it is camouflaged: × (1 − 0.7 × camo)); the fix fades by 1% a second. At a full fix the enemy's battery —
  a garrison position built from its arsenal's howitzer — fires five shells on the gun (46 damage each, scattered
  over 26 px) and the fix starts again. Selling and rebuilding elsewhere starts from nothing.
- Their battery is hidden (not drawn, not targetable) until something of ours sees it — an observation post in
  sight, a recon flight's mark (which also counts as spotting for our artillery) — or until it fires (6 s).

### 8.6 Hulks
- A knocked-out tank leaves a hulk in its cell for 60 s (48 at most). If every route and every attacker on the
  way can still reach our base without it, it blocks the cell like a wall; otherwise it slows it like rubble
  (halves speed). The path check runs at most once a tick; a second hulk in the same tick only slows.
- Hulks block sight and fire (they join the forests and ruins in `sightBlock`) and give cover: infantry in the 8
  cells round one take 70% damage, ours as well as theirs.
- Our engineers with nothing to repair clear the nearest hulk within reach of their post (6 s of work); the
  enemy's sappers blow apart those next to them.

### 8.7 Night and weather
- A day lasts 12 minutes of game time; each battle starts at its historical hour (Seelow at 3 a.m., Guadalcanal at
  dusk), skirmishes at 8. Night (21-4 h, with two-hour dusk and dawn) cuts direct fire to 75% of its range and sight
  to 65%, the enemy's spotting too, and gives every position (camouflaged or not) extra camouflage.
- Flares: a mortar's "Flares" mode, at night, fires a flare every 9 s over the nearest attacker it hears (no sight
  needed); it lights 170 px for 12 s: everything there is seen and in full range of every gun.
- Weather per battle (and from the seed in skirmish): rain (mud: vehicles 80%, infantry 95%, sight 85%), snow
  (everyone 85%), fog (sight 55%, no aircraft on either side: our strike, super-weapon and airfield are grounded,
  their air groups stay home).
- Drawn over the world: a blue night wash that muzzle flashes, explosions and flares glow through, rain streaks,
  snowflakes, a grey fog haze. The wave preview shows the hour and the weather.

### 8.8 A moving front
- A position of their base that we knocked out (MG nest, AT gun, supply dump, battery; never the headquarters),
  held for 5 s by any of our ground units with no attacker within 70 px before they rebuild it, becomes ours: a
  tower of our matching slot (MG, AT gun, depot, howitzer) at a level that grows with the waves. Their no-build
  zone covers only the positions they still hold.
- 20 s later they counter-attack from their headquarters: riflemen and assault squads (and two tanks from wave 8)
  that follow a flow field straight to the position and fight there, then go on towards our base. If the position
  is knocked out (or we give it up) it is theirs again, rebuilt after 20 s.
- The minimap shades their ground and outlines it: the front line. Their HQ's guns cover the positions next to it,
  so the ones near their other entries are the easier prizes.

## 7. Phases

Status: phases 0–6 done. Four sides, each playable as defender and as attacker, in six matchups:
Germany vs Soviet Union, Soviet Union vs Germany, Germany vs Allies (Normandy), Allies vs Germany (the
Bulge), Allies vs Japan (Guadalcanal), Japan vs Allies (Iwo Jima). Phase 7 (the campaign) is done: twelve battles in `src/game/battles.ts`.
Since then: units dig in, gain veterancy and lay mines; infantry climb dragon's teeth; WW2 commander abilities
(fire mission, hold the line, recon flight); faction music from public-domain period tunes; the AI partner plays WW2.
Then: **bases**. Both sides have a headquarters: ours where the routes end (the attackers march on it and stay to
fight it, nothing leaks), theirs with gun positions at the entry. Skirmish: the waves never stop, only an HQ's fall
ends the game; battles can also be won by holding out. Fortified targets take damage by (pen/armour)², the enemy
rebuilds lost guns and repairs its HQ when left alone, emplacements take time to build, infantry throw grenades.
German marching songs (Erika, Westerwaldlied, Horst-Wessel-Lied) transcribed from the scores on Wikipedia.

0. **Scaffold:** mode + faction menu, ruleset switch, WW2 tables, palette per faction.
1. **Ballistics:** pen / armour / facing / range falloff, suppression, knockouts, track hits. Germany vs
   Soviets on one map, ~12 emplacements, ~8 enemy types, models, sounds. Playable.
2. **Return fire:** emplacement HP and armour class, enemy weapons, halt-and-fire, rubble, repair workshop.
3. **Units:** barracks / motor pool / airfield, selection and orders, stances, tanks, squads, engineers,
   medics, sorties.
4. **Stealth & spotting:** camo, reveal-on-fire, ambush, recon both ways.
5. **Enemy intelligence:** breach fields, threat facing, smoke, artillery preparation, adaptive waves.
6. **Other factions**: Western Allies (super-weapon: Little Boy), Soviet Union as defender, Japan (§5b); music and sound, balance (gauntlet + bot).
7. **Historical campaign** (§5a): battle maps, briefings, period arsenals, objectives.
