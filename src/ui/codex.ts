// Longer explanations for the side panel: what each tower, unit, item and ability actually does,
// and how to use or counter it.

import { WW2, type TowerDef, type TowerKind } from '../game/defs';

export const TOWER_HELP: Record<TowerKind, string> = {
  gun: 'Fires a fast stream of bullets at one unit. Cheap enough to double as maze walls, but armour soaks most of each small bullet, so it struggles against tanks and the Mammoth. Hits air.',
  cannon: 'Lobs heavy shells that lead their target and explode on the ground, hurting everything nearby. Great against packed ground waves and armour. Cannot hit helicopters. Frozen units shatter for 2.5× damage.',
  missile: 'Launches homing missiles that chase their target and explode on contact. Long range and a big bonus against helicopters, so it is the all-round answer to air raids.',
  laser: 'A continuous beam that locks onto one unit and ignores armour completely. Excellent against tanks, Aegis and bosses. Damage is per second while the beam is on target.',
  tesla: 'Lightning jumps from unit to unit, losing a little power with every jump. The more crowded the lane, the more it hits. Place it where the maze bunches units together.',
  emp: 'Pulses whenever anything is in range, slowing every unit (air too) and dealing a little damage. Slowed units spend longer under your other guns.',
  flame: 'Sprays a short cone of fire that sets ground units alight. Burning units keep taking damage and can ignite the ones walking right behind them. Best at tight hairpin turns.',
  napalm: 'Lobs napalm that leaves a patch of burning ground for a few seconds. Everything that walks through catches fire, so put it where the maze makes units pass twice.',
  acid: 'Splashes acid that strips armour for several seconds. On its own it is weak; next to guns, cannons and missiles it makes every hit count. Armour can even go negative.',
  gas: 'Fires canisters that release a drifting toxic cloud. Deadly to infantry and medics, much weaker against armoured vehicles, and harmless to aircraft.',
  sniper: 'Very long range and huge single shots that ignore armour, but slow to reload. Defaults to targeting the strongest unit, which makes it a boss and tank killer.',
  rail: 'Fires a slug that pierces every unit along a straight line out to full range, air or ground. Build long straight corridors in your maze and aim the railgun down them.',
  gatling: 'Starts slowly and spins up to five times the fire rate while it keeps shooting, then overheats and must cool down. Shines against long, continuous streams of units.',
  flak: 'Anti-aircraft only. Its shells burst near helicopters and damage every aircraft around the burst. Cheap and strong against Air Raid waves.',
  arty: 'Enormous range and heavy splash, but it can only see 140px on its own. Build radars: anything inside radar coverage becomes a target. Frozen units shatter under its shells.',
  cryo: 'Each hit chills units, slowing them; enough chill freezes them solid for 1.6s. Frozen units take extra damage, and 2.5× from cannon, artillery and mine blasts. Bosses can be slowed but never frozen.',
  gravity: 'Continuously pulls ground units towards its centre and slows them, bunching a wave into a tight cluster for your splash weapons.',
  repulsor: 'Pulses to knock ground units backwards along their route, forcing them to walk that stretch of maze again. Bosses barely move.',
  hacker: 'Takes over the toughest non-boss vehicle in range. The hacked unit stops and opens fire on its own wave until the hack wears off.',
  jammer: 'An aura: units inside it lose their shields, medics cannot heal, and everything takes extra damage from all your towers. The counter to Aegis and Medics.',
  depot: 'Produces no damage. At every new wave it pays a fixed income plus interest on the money you are holding (up to a cap). Build early, then save money to earn more.',
  radar: 'An aura that reveals Ghosts (stealth units) everywhere inside it, spots targets for artillery, and gives nearby towers extra range.',
  command: 'An aura that makes every tower in range fire faster. Put it in the middle of a cluster of your strongest towers.',
  salvage: 'An aura: units destroyed inside it pay a bigger bounty. Place it where most of the killing happens.',
  barricade: 'A cheap 1×1 wall that does nothing but block the path. Use it to shape the maze cheaply and keep your money for real weapons.',
  mine: 'Goes on the path itself and never blocks it. Explodes under the first ground unit that steps on it, then re-arms after a few seconds.',
  tar: 'A 2×2 patch built on the path that never blocks it. Ground units wading through are heavily slowed, giving nearby towers more time.',
  spikes: 'A 2×2 strip built on the path that never blocks it. Damages every ground unit driving over it, ignoring armour.',
  gate: 'A wall you can open and close (G) to switch the route mid-wave. Closing is refused if units stand in it or if it would seal every route.',
  bunker: 'A sandbagged short-range bunker that fires at two different units at once. Make it part of the maze wall where units squeeze past.',
  orbital: 'Charges up, then you aim it (R, then click): a beam strikes from orbit for several seconds and drifts after the toughest unit nearby, hitting air and ground.',
  nuke: 'One launch per charge, anywhere on the map (R, then click). Massive damage in a huge radius, air and ground. Save it for bosses or a breach.',
  hive: 'Launches drones that patrol around the hive and hunt down any unit within its range, air or ground, firing as they orbit their target.',
  blackhole: 'Opens a singularity on a unit in range for a few seconds: it drags ground units in, damages them, and swallows weakened non-boss units whole.',
};

export interface UnitHelp {
  text: string;
  counter: string;
}

/** Indexed like ENEMIES. */
export const ENEMY_HELP: UnitHelp[] = [
  { text: 'Light foot soldiers that come in large numbers.', counter: 'Guns, gas, flamethrowers and anything with splash.' },
  { text: 'Fast, lightly armoured buggies that try to outrun your defences.', counter: 'Slow them (EMP, tar, cryo) and keep the maze long.' },
  { text: 'Armoured troop carriers: tougher than buggies and shrug off small bullets.', counter: 'Cannons, lasers, acid to strip armour.' },
  { text: 'Heavy armour: small-calibre fire barely scratches them. Leaking one costs 2 lives.', counter: 'Lasers, snipers, railguns, cannons; acid makes everything hit harder.' },
  { text: 'Gunships that fly straight over the maze from entry to exit.', counter: 'Missiles, flak, lasers, tesla, sniper and drones. Cannons cannot hit them.' },
  { text: 'A boss: enormous HP and thick armour, slow but relentless. Leaking it costs 4 lives.', counter: 'Lasers, snipers, railguns, a nuke or orbital strike; acid and jammers help.' },
  { text: 'Stealth recon buggies: invisible to your towers unless revealed.', counter: 'Radar coverage reveals them; any tower can also hit them point-blank.' },
  { text: 'Shielded carriers: the shield soaks damage and recharges if left alone.', counter: 'Shield jammers remove the shield; keep constant pressure on them.' },
  { text: 'Field medics that periodically heal every unit around them.', counter: 'Kill them first (targeting: Strong), or jam them to stop the healing.' },
];

export const ITEM_HELP = [
  'Calls in eight artillery shells that land around the point you click over about two seconds. Strong against ground crowds.',
  'Scatters six free mines on open ground around the point you click. They stay until something steps on them and then re-arm.',
  'An instant cash drop: $40 plus $15 per wave so far. No target needed.',
];

export const ABILITY_HELP = [
  'A jet carpet-bombs a line through the point you click, at right angles to the line from your commander. Heavy damage to ground units; it grows with your commander\'s level.',
  'Your commander rallies nearby troops: every tower within 160px fires 40% faster for 8 seconds.',
  'Throws a grenade (up to 260px away) that stops every ground unit near the impact for 2.5 seconds.',
];

export const HERO_HELP = 'Your commander: a unit you move around the battlefield. Select it (H or click it), then click the ground to walk there. It shoots anything in range, earns XP from its kills and gains damage and range with every level. It cannot be hurt.';

export const HERO_HELP_WW2 = 'Your commander: an officer you move around the battlefield. Select it (H or click it), then click the ground to walk there. It shoots anything in range and earns XP. The enemy shoots back, and snipers hunt officers. When wounded it is out of action for 20 s and comes back at its command post. Wounds heal slowly.';

export const RIVER_HELP = 'Ground units wade through water at 55% speed, so a river is a natural slow zone — and they would rather walk around it when a dry way is about as quick. Aircraft fly over. Nothing can be built in the water.';

export const MOUNTAIN_HELP = 'Impassable high ground: ground units must find a way around it, and nothing can be built on it. Mountains never close a route completely; the passes between peaks are natural choke points. Aircraft fly over.';

export const FOREST_HELP = 'Dense woods: ground units can\'t get through and must go around, and nothing can be built among the trees. Like mountains, woods never close a route completely. Aircraft fly over.';

// ---------------------------------------------------------------- WW2

export const WW2_TOWER_HELP: Record<string, string> = {
  mg42: 'The MG-42 fires so fast it sounds like tearing cloth. It cuts down infantry and pins them: suppressed soldiers crawl and keep their heads down. Its 8 mm of penetration is nothing against armour, so it ignores tanks and only bothers armoured cars from the side. Wire in front of it makes a kill zone.',
  flak38: 'A 20 mm autocannon on a light mount. Against aircraft it is the best value you can buy, and its rounds go through armoured cars and the side of a T-70. Medium tanks shrug it off.',
  schreck: 'Two men with an 8.8 cm rocket launcher. The shaped charge goes through any tank from any side, but the range is tiny and reloading is slow. Hide teams where the maze makes tanks pass close.',
  sniper: 'A marksman with a scoped Kar98k: one shot, one dead soldier, from very far away. Bullets can\'t get through armour, so the sniper only picks targets it can kill. Next to an observation post he gets +40% damage.',
  flamer: 'Burns infantry and open vehicles at point-blank range; burning soldiers set the ones behind them alight. Closed-down tanks are sealed against it. Best at a tight bend of the maze.',
  pak40: 'The standard German anti-tank gun. Each shot is slow but decisive: 115 mm of penetration kills a T-34 from the side and a KV-1 from behind. Tanks show their sides at every turn of your maze — that is where a PaK belongs. Two PaKs side by side form a Pakfront.',
  flak88: 'The famous Eighty-Eight: long range, heavy shells and 135 mm of penetration. Against aircraft its time-fused shells burst at altitude. Expensive, but it answers both tanks and bombers.',
  tiger: 'A Tiger I dug in hull-down: only the turret shows. Its 8.8 cm KwK 36 outranges every Soviet tank and goes through a T-34 from the front. The most powerful single gun you can field.',
  bunker: 'A concrete pillbox with two MGs, each firing at its own target. Short range: build it into the maze wall where infantry squeeze past.',
  mortar: 'Lobs high-explosive bombs that burst among infantry and pin them down. Blasts hit the thin top armour, but a mortar bomb is too small for any tank.',
  lefh18: 'The 10.5 cm field howitzer: huge range and a big blast, but it can only see 140px by itself — build observation posts and it fires at everything they see. Its shells can break a tank\'s track, and go through light armour from above.',
  nebel: 'Six rockets per salvo, howling as they come down, scattered over the target area. Devastating against infantry columns; slow to reload.',
  depot: 'Produces no damage. At every new wave it pays a fixed income plus interest on the money you are holding (up to a cap).',
  observer: 'An observation post with a scissors periscope. Artillery fires at anything it sees, Soviet snipers inside it are revealed, and guns nearby get extra range.',
  hq: 'A field headquarters with officers and radios: every emplacement in range fires faster.',
  teeth: 'Concrete dragon\'s teeth: a cheap 1×1 obstacle that blocks the way. Shape the maze with it so tanks have to turn in front of your guns.',
  wire: 'Barbed wire on the path. It never blocks the route; infantry get tangled and crawl through, while vehicles drive straight over it.',
  teller: 'Anti-tank mines buried in the path. Only a vehicle sets them off; the blast tears through the thin belly armour. They re-arm after a while.',
  smine: 'Bounding mines that leap up and burst at waist height. Only infantry set them off. They pin down whoever survives.',
  roadblock: 'A barrier you can open and close (G) to switch the route mid-wave. Closing is refused if units stand in it or if it would seal every route.',
  workshop: 'Pioneers with a crane truck and spare parts. They go round every emplacement in range and patch up the damage, even in the middle of a fight. They can\'t raise rubble: rebuilding a destroyed emplacement (B) costs money.',
  v2: 'The V-2 ballistic missile. When it is ready, press R and click anywhere on the map: a minute later... in this game a few seconds later, a tonne of explosive falls at three times the speed of sound. There is no warning, then the roar. It hits from straight above, so even the IS-2 is thin there.',
  barracks: 'Trains infantry that fight outside the maze: grenadiers, MG-42 teams, Panzerschreck teams, snipers, pioneers (who repair emplacements and raise rubble for free) and medics. Select a unit and click the ground to send it; give it a stance — Hold, Guard (default: fights near its post), Hunt or Ambush. Units never block the path. Manpower limits how many you field: each HQ adds 4, each depot 2.',
  motorpool: 'Builds tanks: the Panzer IV, the Panther and the Tiger. Tanks stop to fire and turn their thick front towards the target, so put them where the enemy comes at their front. Shift-drag to select several and send them together.',
  airfield: 'A fighter strip. Press R and click a point: two Fw 190s take off and patrol there for 25 s, shooting down aircraft first and then strafing soft targets. Yaks will try to shoot them down.',
  stuka: 'An airfield of Ju 87 dive bombers. When it is ready, press R and click: three Stukas dive one after another and drop their bombs on the target. The bombs hit the top armour, where even a KV-1 is thin.',
};

/** Indexed like the Soviet ENEMIES in ww2.ts. */
export const SOVIET_HELP: UnitHelp[] = [
  { text: 'Riflemen with Mosin-Nagants, coming in great numbers. Their fire pins your crews, who then shoot slower; it only chips away at sandbags.', counter: 'MG-42s, mortars, S-mines; wire slows them under your guns. Pinned infantry fire less.' },
  { text: 'Assault troops with PPSh submachine guns: faster and tougher than riflemen, deadly up close.', counter: 'MG-42s and flamethrowers; suppression slows them down.' },
  { text: 'A sniper in camouflage: invisible to your guns unless spotted. Picks off your commander from far away.', counter: 'Observation posts reveal snipers; any emplacement spots one point-blank.' },
  { text: 'A field medic who patches up everyone around.', counter: 'Kill medics first (Strong targeting), with snipers or MGs.' },
  { text: 'A fast, unarmoured jeep carrying scouts: they spot camouflaged guns from far away and give them away to the whole column.', counter: 'Anything hits it: MGs, flak, mortars. Keep the maze long.' },
  { text: 'A light armoured car on reconnaissance: rifle bullets bounce off its front, and its crew spots hidden guns from afar.', counter: 'Flak 38 and anything heavier; MGs only from the side and rear.' },
  { text: 'A light tank with 45 mm of front armour and a 45 mm gun. Tanks halt to fire: hitting them while they aim is your chance.', counter: 'Flak 38 through the sides, any anti-tank gun from any side.' },
  { text: 'The T-34: sloped 90 mm front, much thinner sides. Leaking one costs 2 lives.', counter: 'PaK 40 into the sides at the turns of your maze; Panzerschreck, Tiger and 88 from any side.' },
  { text: 'The up-gunned T-34 of 1944, with a tougher turret and sides.', counter: 'Tiger, 88 and Panzerschreck; PaK 40 into the sides.' },
  { text: 'The KV-1 heavy tank: slow, with armour that defeats most guns from the front. Costs 3 lives.', counter: 'Tiger, Panzerschreck, 88 from the side; Teller mines and Stukas hit it from below and above.' },
  { text: 'A boss: the IS-2 heavy tank with 160 mm of front armour and a 122 mm gun. Costs 4 lives.', counter: 'Only the Panzerschreck goes through the front. Flank it with Tigers and 88s; mines and Stukas.' },
  { text: 'The Il-2 Sturmovik ground-attack plane, armoured underneath: MG bullets bounce off.', counter: 'Flak 38 and the 88.' },
  { text: 'A fast, unarmoured fighter.', counter: 'Flak 38, the 88, and MG-42s.' },
  { text: 'The Katyusha — "Stalin\'s organ": sixteen rockets rippled off a truck, howling down on your positions from long range. The blasts hit sandbagged positions from above.', counter: 'It is a soft truck: anything kills it if it reaches it. Long-range guns (88, Flak 38) or artillery spotted by an observation post; concrete bunkers shrug off the rockets.' },
];

const CAMO_HELP = ' <i>Camouflaged:</i> the enemy only finds it close up (recon jeeps and armoured cars from further off), or for a few seconds after it fires. Its first shot from hiding hits harder; in <b>Ambush</b> mode it waits for a flank or point-blank shot.';

export const towerHelp = (def: TowerDef): string =>
  (WW2 ? (WW2_TOWER_HELP[def.kind] ?? def.desc) + (def.camo ? CAMO_HELP : '') : TOWER_HELP[def.kind as TowerKind] ?? def.desc);
export const enemyHelp = (kind: number): UnitHelp => (WW2 ? SOVIET_HELP : ENEMY_HELP)[kind];
