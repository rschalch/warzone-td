# WW2 mode: to-do

Three fixes, then eight realism ideas the user asked for (October 2026), to be built on the `ww2` branch (never merged to `main`).
Read `CLAUDE.md` first (ground rules: determinism, commands, saved state, both cameras, performance), then
`docs/ww2-design.md`. Work through them in order; after each one run `npx tsc --noEmit`, `npm run build` and
`npm run smoke`, add a smoke check, check balance with the bot, verify the visuals with screenshots (top and
iso), update `CLAUDE.md` / `README.md` / `docs/ww2-design.md`, then commit and push to `ww2` and tick it off here.

Balance references (bot, as of commit 0893d50):

| Run | Result |
|---|---|
| `WW2=1 MAPS=0,1,2 DIFF=easy,normal npm run bot` | Easy: wins Open Field and Crossfire by taking the enemy HQ (~wave 36–40), loses Boulder Pass at wave 31. Normal: lost at waves 24–26 |
| `BATTLE=all DIFF=easy npm run bot` | 10 of 12 battles won; Iwo Jima (24/25) and Seelow Heights (24/30) are lost |

A new feature shouldn't make these noticeably worse unless that's the point; if it does, retune.

# Fixes first

Three problems the user reported (October 2026). Do these before the realism features.

## F1. Some weapons don't fire out to the range they show — done

- [x] Found with `npm run probe` (`scripts/rangeprobe.ts`; `WW2=1 ALL=1` for every matchup): guns fired at armour
  near the edge of their circle and bounced (targeting checked the weakest side at full penetration, the damage
  the side shown at the penetration left at that distance); howitzers never fired at what no observer saw.
- [x] One rule for both (`penRatio()`): crews only engage what they can get through from where they stand
  (`HURT_RATIO` 0.8); `fireStatus()` tells the panel why a gun holds fire (armour, ambush, no spotter, smoke);
  the ambush ring (60%) and the artillery's spotting (its own 140 px, observers) are drawn when selected; the
  panel shows penetration close / far. The bunker's second MG and the commander also respect armour.
- [x] Smoke: one gun per role fires at a soldier at 95% of its range; an MG explains why it holds fire at a tank.
- Bot (0.8 threshold): Normal maps a little better on average (Crossfire 30, Boulder Pass 26, Gauntlet 20; Open
  Field 18 — was 25), Easy wins Open Field and Crossfire, loses Boulder Pass at 26 (was 31); battles unchanged.

## F2. Sound controls in the top bar — done

- [x] Mute (K), previous / next track (`,` `.`), music volume slider and the name of the piece in the top bar
  (`#audio`); `sound.skipTrack()` for recordings and the score; `settings.muted` shared with the settings screen.
  Phone width: the buttons only. Smoke checks next track, mute, K and the saved volume.

## F3. The sidebar buttons are too tight — done

- [x] Mocked up wider (390 px), two columns, icon tiles and compact rows at 1280×720: at that height only the
  icon tiles leave the info panel room. Chosen: icon tiles, six per row (one row per category), names under the
  icons from 840 px of height (squeezed to fit), a 384 px sidebar from 1600 px of width.
- [x] Info panel: tighter rows, the five targeting modes fit, training buttons are two fixed lines (name; price
  and men, or why not), upgrade values without units. Checked at 1280×720, 1440×900, 1920×1080 and 390×844;
  smoke checks that every panel button's label fits.

# Realism features

## 1. Supply

- [ ] Guns need ammunition. Each emplacement has an ammo stock that firing uses up (artillery and AT guns
  fastest, MGs slowly); empty guns fire at a fraction of their rate.
- [ ] Depots (`depot` slot) resupply positions in range; trucks drive from the HQ to the depots along a road
  (a unit kind that paths with `unitPathTo`), and the enemy can shoot them.
- [ ] The enemy's waves are supplied from their base too: shelling their supply column (or their depot
  near the HQ) makes the next wave smaller or later.
- Notes: ammo as a `Float32Array` per tower slot or a `Tower` field (saved automatically); show it in the
  tower panel and as a small bar. Keep it cheap: resupply checks every few ticks, not per frame.

## 2. Morale

- [ ] Enemy squads that lose most of their men, or stay pinned (`eSupp` near 1) for long, fall back towards
  their entry or surrender (removed, bounty paid, maybe a "surrendered" floating text).
- [ ] A wave whose officer or command vehicle dies loses heart: more of it falls back. Add an officer to
  infantry waves (a role in `ARole`, filled by every army).
- [ ] Our own units and crews: heavy losses nearby make crews suppressed for longer; veterans hold better
  (`unitVet`).
- Notes: retreating attackers walk the flow field backwards (`next` towards higher `dist`, or a field to
  the entry); they must not count as "on the field" for wave clear once they leave.

## 3. Line of sight and fog of war

- [ ] Forests (`T_TREE`), mountains and ruins block sight lines; a tower or unit only fires at what it can
  see (a cheap grid raycast, cached per tower and refreshed when the maze changes).
- [ ] Fog of war: enemies are only drawn where something of ours sees them (towers, units, observers, the
  recon flight); the rest of the map shows the last known positions. The wave preview stays.
- Notes: visibility is gameplay (targeting), so compute it in the sim deterministically; the fog drawing is
  renderer-only. Mind performance on the biggest map (stress test must stay at 60 fps).

## 4. Combined arms

- [ ] Enemy tanks move with infantry escorts: armoured waves get riflemen assigned to a tank (a leader id
  per attacker), who keep near it.
- [ ] A tank with no infantry within ~60 px is vulnerable: our infantry positions (Schreck, MG with grenades,
  units) get a close-assault bonus against it; escorted tanks spot camouflaged positions better.
- [ ] The enemy lays smoke ahead of an assault on a strongpoint (reuse `popSmoke` / the `sm*` arrays).

## 5. Counter-battery fire

- [ ] Each time our artillery (mortar, howitzer, rockets) fires, the enemy gains a "sound ranging" fix on it;
  after a few salvos their artillery (the `barrage` shells in the `rk*` arrays) answers on that position.
- [ ] Moving (selling and rebuilding elsewhere) or camouflage resets it; observers and the recon flight can
  find the enemy's own guns (an artillery position in their base) for our counter-battery.
- Notes: per-tower counter (`Tower` field). The enemy needs artillery pieces in its base (`garrison()` in
  `ww2.ts` builds the base from its arsenal: add the `howitzer` slot as a fixed position).

## 6. Wrecks stay on the field

- [ ] A destroyed tank leaves a hulk: a blocked cell (or a slow one, like rubble) for some time, giving cover
  to infantry next to it (less damage taken) and blocking line of fire for direct-fire guns.
- [ ] Engineers (ours) can clear hulks; the enemy's sappers too.
- Notes: today wrecks are cosmetic (`renderer.wrecks`). A hulk that blocks must go through the same path
  checks as a tower (it may not cut a route: if it would, make it slow instead of blocked). Saved state:
  typed arrays of hulk cells and timers.

## 7. Night and weather

- [ ] A day/night cycle over the waves: at night spotting and tower ranges shrink, the camouflage of both sides
  rises, and flares (a commander ability or a mortar mode) light an area for a while.
- [ ] Weather per battle and in skirmish: rain / mud (tanks slower, off-road even more), snow (everyone
  slower, `Moscow`), fog (short sight, no air support: like `airLocked`).
- Notes: the terrain shader (`terrainGL.ts`) can tint for night and weather; drive it from sim state but never
  read it back. Battles (`battles.ts`) can set their weather and time of day.

## 8. A moving front

- [ ] Capturing ground: when an enemy gun position of their base is destroyed and our units stand on it for a
  few seconds, it becomes ours (a tower of the matching slot, at that level) and the no-build zone
  (`ENEMY_ZONE`, `enemyGround()`) shrinks to the positions they still hold.
- [ ] Their headquarters can't be captured, only destroyed; the enemy tries to retake lost positions
  (a counter-attack wave aimed at them).
- [ ] The front line drawn on the minimap.
- Notes: the garrison lives in the `g*` arrays (`raiseGarrison`, `updateGarrison`); a captured slot must
  stop being rebuilt (`gKind = -1` or a flag).
