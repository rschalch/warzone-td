# WW2 mode: to-do

Three fixes, then eight realism ideas the user asked for (October 2026), built on the `ww2` branch (never merged to `main`). All done.
Read `CLAUDE.md` first (ground rules: determinism, commands, saved state, both cameras, performance), then
`docs/ww2-design.md`. Work through them in order; after each one run `npx tsc --noEmit`, `npm run build` and
`npm run smoke`, add a smoke check, check balance with the bot, verify the visuals with screenshots (top and
iso), update `CLAUDE.md` / `README.md` / `docs/ww2-design.md`, then commit and push to `ww2` and tick it off here.

Balance references (bot, as of commit 0893d50, before the features below):

| Run | Result |
|---|---|
| `WW2=1 MAPS=0,1,2 DIFF=easy,normal npm run bot` | Easy: wins Open Field and Crossfire by taking the enemy HQ (~wave 36–40), loses Boulder Pass at wave 31. Normal: lost at waves 24–26 |
| `BATTLE=all DIFF=easy npm run bot` | 10 of 12 battles won; Iwo Jima (24/25) and Seelow Heights (24/30) are lost |

After all of them (October 2026, `SEEDS=3`; single runs vary a lot, so compare three seeds):

| Run | Result |
|---|---|
| `SEEDS=3 WW2=1 MAPS=0,1,2 DIFF=easy,normal npm run bot` | Easy: Open Field and Crossfire won 2 of 3, Boulder Pass lost ~wave 29 (as before). Normal: Open Field ~23, Crossfire ~28, Boulder Pass ~17 (was ~20: sight and hulks on a rocky map) |
| After the second fix round (5×5 HQ, scouts, crew ranks, accuracy; enemy HQ kept where the bot's guns reach it), `SEEDS=3`/`5 WW2=1 MAPS=0,1,2` | Easy: Open Field won 3 of 5, Crossfire 3 of 3, Boulder Pass ~28. Normal: Crossfire ~27, Boulder Pass ~22. Moving their HQ further from the road cost the bot its wins (it shells the HQ) |
| `BATTLE=all DIFF=easy npm run bot` | 10 of 12 won (Iwo Jima now won); Okinawa and Seelow Heights lost on their last wave |

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

## 1. Supply — done

- [x] Ammunition per emplacement (`Tower.ammo`, seconds of fire by role: artillery and AT guns run dry first),
  empty guns at 40% of their rate; ammo bar under the gun and a row in the panel (with "no supply").
- [x] Depots (radius 180) refill guns from their store; the HQ supplies its surroundings; crews out of reach scrounge
  (five times faster between waves). A depot running low calls a supply truck from the HQ (a unit kind of every
  arsenal, `unitPathTo`), which the enemy can shoot.
- [x] The enemy: a supply dump behind its HQ and a truck column from the rear; `foeSupply` shrinks the next waves and
  delays them when low; shown in the wave preview. The bot and the AI partner build depots for dry guns.
- Bot: Easy wins Open Field and Crossfire; Normal: Crossfire 37 (was 24), Open Field 19 (was 25).

## 2. Morale — done

- [x] Infantry morale: heavy losses, long pins and deaths nearby wear it down; broken squads surrender when pinned
  (bounty, floating "SURRENDERED") or fall back along a flow field to the entry and leave (not a leak, not counted
  once gone).
- [x] An officer (new ARole `officer`, filled by every army, a model per side) leads each infantry wave; his death
  shakes the whole wave ("OFFICER DOWN").
- [x] Our crews and units are suppressed and stay shaken after losses nearby; veterans and seasoned crews hold better.

## 3. Line of sight and fog of war — done

- [x] Forests, mountains and rocks/ruins block sight; towers use a cached per-tower mask, units a raycast; indirect
  fire needs anything of ours to see the target; observers' coverage respects sight; the panel explains.
- [x] Fog of war in the sim (`seenGrid`, saved; updated every 15 ticks); the renderer darkens unseen ground and marks
  last known positions; minimap and picking ignore unseen attackers; the wave preview stays. WW2 stress test: 60 fps.

## 4. Combined arms — done

- [x] Escorts: riflemen pair with a tank of their wave (`eLead`) and keep pace with it.
- [x] Unescorted tanks: +50% from infantry AT weapons, satchel charges from infantry positions and soldiers;
  escorted tanks spot better. The panel tells whether a tank is escorted.
- [x] Smoke ahead of an assault on a known strongpoint (the `sm*` arrays).

## 5. Counter-battery fire — done

- [x] `Tower.fix` grows with each salvo of our artillery (camouflage muffles it); at a full fix the enemy's battery
  (a new garrison position from its arsenal's howitzer) answers with shells on that gun; the panel shows the fix.
- [x] Their battery is hidden until an observer sees it, a recon flight marks it (marks also spot for our
  artillery) or it fires; then our howitzers can take it on.

## 6. Wrecks stay on the field — done

- [x] Knocked-out tanks leave hulks (typed arrays, saved): blocking if no route needs the cell, slowing otherwise;
  cover for infantry next to them (both sides); they block sight and the line of fire.
- [x] Our engineers clear hulks near their post; the enemy's sappers clear those next to them.

## 7. Night and weather — done

- [x] A day/night clock through the battle: at night shorter direct fire and sight, more camouflage for everyone;
  mortars fire flares ("Flares" mode) that light an area for every gun.
- [x] Weather per battle (and from the seed in skirmish): rain/mud, snow, fog (short sight, no aircraft for either
  side). Drawn as a night wash, flare light, rain, snow and haze; the wave preview shows the hour and the weather.

## 8. A moving front — done

- [x] Our soldiers take a knocked-out gun position of theirs by holding it: it becomes a tower of ours (that slot),
  the no-build zone shrinks to the positions they still hold; a captured slot isn't rebuilt (`gKind` -1, `gOrig`).
- [x] Their headquarters can only be destroyed; they counter-attack lost positions (a group sent at it along its
  own flow field) and get them back if they fall.
- [x] The front line on the minimap.
