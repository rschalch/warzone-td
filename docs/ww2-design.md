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

## 7. Phases

Status: phases 0–1 done (Germany vs Soviet Union); phase 2 (return fire) done, with the Katyusha and the V-2.

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
