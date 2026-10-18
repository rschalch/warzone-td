// Longer explanations for the side panel: what each tower, unit, item and ability actually does,
// and how to use or counter it.

import type { TowerKind } from '../game/defs';

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

export const RIVER_HELP = 'Ground units wade through water at 55% speed, so a river is a natural slow zone — and they would rather walk around it when a dry way is about as quick. Aircraft fly over. Nothing can be built in the water.';

export const MOUNTAIN_HELP = 'Impassable high ground: ground units must find a way around it, and nothing can be built on it. Mountains never close a route completely; the passes between peaks are natural choke points. Aircraft fly over.';
