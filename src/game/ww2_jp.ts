// Japan (the Imperial Japanese Army): emplacements and units as the defender, and its army in the
// attack. Doctrine: infantry, night and camouflage — caves, spider holes and interlocking machine
// guns, banzai charges and kamikazes — with thin armour and weak anti-tank guns.

import { growAll, type EnemyDef, type TowerDef, type UnitDef } from './defs';
import { GERMAN } from './ww2_de';
import { armsGun, armsUnit } from './ww2_arms';
import { derive, slotOf, type Arsenal, type Army, type Slot, type UnitHelp } from './ww2_kit';

const G = (slot: Slot) => slotOf(GERMAN, slot);
/** Japanese positions are better hidden than anyone's. */
const hid = (slot: Slot, extra = 0.15) => Math.min(0.95, (G(slot).camo ?? 0.3) + extra);

// ---------------------------------------------------------------- emplacements (in slot order)

export const JP_TOWERS: TowerDef[] = growAll([
  derive(G('mg'), { kind: 'type92', name: 'Type 92 HMG Nest', short: 'Type 92', desc: 'The "woodpecker": slow, heavy, accurate fire from a hidden nest.', turret: 'jp_w_mg', sfx: 'type92', color: 0xa89a5a, camo: hid('mg'), weapon: 'type92',
    lv: { cost: 14 } }),
  derive(G('lightaa'), { kind: 'type96', name: '25 mm Type 96', short: 'Type 96', desc: 'Twin 25 mm anti-aircraft cannon: deadly to aircraft and light vehicles.', turret: 'jp_w_aa', sfx: 'flak38', weapon: 'type96',
    lv: { cost: 34 } }),
  derive(G('at'), { kind: 'rodan', name: 'Type 4 "Ro-Dan" Team', short: 'Ro-Dan', desc: 'A 70 mm anti-tank rocket launcher: a Sherman\'s side, or its front point-blank.', turret: 'jp_w_at', sfx: 'bazooka', camo: hid('at'), weapon: 'rodan',
    lv: { cost: 26 } }),
  derive(G('sniper'), { kind: 'jp_sniper', name: 'Tree Sniper', short: 'Sniper', desc: 'A sniper hidden in the canopy: the hardest to find of all.', turret: 'jp_w_sniper', camo: 0.95 }),
  derive(G('flamer'), { kind: 'type100', name: 'Type 100 Flamethrower', short: 'Flamer', desc: 'Burns infantry and soft vehicles at point-blank range.', turret: 'jp_w_flamer' }),
  derive(G('atgun'), { kind: 'type1_47', name: '47 mm Type 1', short: 'Type 1', desc: 'The best Japanese anti-tank gun: kills light tanks, needs a Sherman\'s side.', turret: 'jp_w_47', sfx: 'pak40', camo: hid('atgun'), weapon: 'type1_47',
    lv: { cost: 40 } }),
  derive(G('heavyaa'), { kind: 'type88', name: '75 mm Type 88', short: 'Type 88', desc: 'Heavy anti-aircraft gun, also fired at tanks: 90 mm of penetration.', turret: 'jp_w_88', sfx: 'flak88', weapon: 'type88',
    lv: { cost: 100 } }),
  derive(G('tank'), { kind: 'jp_chihadug', name: 'Chi-Ha Kai (dug in)', short: 'Chi-Ha', desc: 'A Type 97 with the 47 mm gun, buried to the turret.', turret: 'jp_w_chiha', sfx: 'pak40', camo: hid('tank', 0.2), weapon: 'type1_47t',
    lv: { cost: 110, hp: 1260, fort: 40 } }),
  derive(G('bunker'), { kind: 'cave', name: 'Cave Bunker', short: 'Cave', desc: 'Machine guns firing from a cave in the coral: very hard to find and to destroy.', turret: 'jp_w_cave', sfx: 'type92', camo: 0.6, weapon: 'type92',
    lv: { cost: 55, range: 85, hp: 1920, fort: 100 } }),
  derive(G('mortar'), { kind: 'type97_81', name: '81 mm Type 97 Mortar', short: 'Mortar', desc: 'Bombs on infantry groups; pins them down.', turret: 'jp_w_mortar', camo: hid('mortar'), weapon: 'type97_81', lv: { cost: 32 } }),
  derive(G('howitzer'), { kind: 'type91', name: '105 mm Type 91', short: 'Type 91', desc: 'A field howitzer: big blast at long range, at anything you can see.', turret: 'jp_w_105', weapon: 'type91' }),
  derive(G('rockets'), { kind: 'type4', name: 'Type 4 Rocket Launcher', short: 'Type 4', desc: 'Six 20 cm rockets per salvo, each one a heavy blast.', turret: 'jp_type4', sfx: 'nebel', weapon: 'type4r',
    lv: { cost: 120 } }),
  derive(G('depot'), { kind: 'jp_depot', name: 'Supply Dump', short: 'Depot', desc: 'Pays out at every wave (income plus interest) and adds manpower for training units.', turret: 'jp_w_depot' }),
  derive(G('observer'), { kind: 'jp_observer', name: 'Observation Post', short: 'Observer', desc: 'Sees far (even at night), reveals snipers, speeds up artillery and extends the range of guns nearby.', turret: 'jp_w_observer' }),
  derive(G('hq'), { kind: 'jp_hq', name: 'Regimental HQ', short: 'HQ', desc: 'Officers and runners: emplacements in range fire faster.', turret: 'jp_w_hq' }),
  derive(G('workshop'), { kind: 'jp_workshop', name: 'Field Workshop', short: 'Workshop', desc: 'Engineers patch up damaged emplacements in range, even under fire.', turret: 'jp_w_workshop' }),
  derive(G('barracks'), { kind: 'jp_barracks', name: 'Barracks', short: 'Barracks', desc: 'Trains rifle squads, LMG and lunge-mine teams, snipers, engineers and medics.', turret: 'jp_w_barracks' }),
  derive(G('motorpool'), { kind: 'jp_motorpool', name: 'Tank Park', short: 'Tank Park', desc: 'Builds Ha-Go, Chi-Ha and Chi-Nu tanks.', turret: 'jp_w_motorpool' }),
  derive(G('airfield'), { kind: 'jp_airfield', name: 'Fighter Strip', short: 'Airfield', desc: 'Send (R) a pair of Zeros to patrol a point.', turret: 'jp_w_airfield' }),
  derive(G('teeth'), { kind: 'jp_logs', name: 'Log Barricade', short: 'Logs', desc: 'Coconut logs: a cheap 1×1 wall against vehicles. Infantry climb over, slowly.' }),
  derive(G('wire'), { kind: 'jp_wire', name: 'Barbed Wire', short: 'Wire', desc: 'Goes on the path. Infantry get tangled and crawl; vehicles drive through.' }),
  derive(G('atmine'), { kind: 'type93', name: 'Type 93 Mines', short: 'AT Mine', desc: 'Anti-tank mines on the path: only vehicles set them off.' }),
  derive(G('apmine'), { kind: 'type3mine', name: 'Type 3 Mines', short: 'AP Mine', desc: 'Terracotta mines the detectors can\'t find: only infantry set them off.' }),
  derive(G('roadblock'), { kind: 'jp_roadblock', name: 'Roadblock', short: 'Roadblock', desc: 'A barrier you can open and close (G) to reroute an attack mid-fight.', block: 'roadblock' }),
  derive(G('strike'), { kind: 'val', name: 'Aichi D3A "Val"', short: 'Val', desc: 'Call in (R) three dive bombers on a point.', turret: 'jp_w_valfield', sfx: 'stuka',
    lv: { cost: 210, damage: 320, salvo: 3, pen: 60 } }),
  derive(G('super'), { kind: 'type98', name: '320 mm Type 98 Mortar', short: 'Type 98', desc: 'The spigot mortar of Iwo Jima: one 300 kg bomb (R) on any point.', turret: 'jp_w_type98', sfx: 'mortar',
    lv: { cost: 340, damage: 850, splash: 85, charge: 90, pen: 90 } }),
]);

const JP_UNITS: UnitDef[] = [
  { kind: 'jp_squad', name: 'Rifle Squad', short: 'Riflemen', tex: 'jp_rifle', from: 'barracks', cost: 30, manpower: 1, train: 5, hp: 130, speed: 44, radius: 6, inf: true,
    gun: armsUnit('arisaka', 'mosin'), desc: 'Riflemen with Arisakas: tough and stubborn in defence.' },
  { kind: 'jp_lmgteam', name: 'Type 99 LMG Team', short: 'LMG', tex: 'jp_mg', from: 'barracks', cost: 45, manpower: 1, train: 8, hp: 110, speed: 38, radius: 6, inf: true, camo: true,
    gun: armsUnit('type99', 'type92', { still: true }), desc: 'A light machine gun team that hides well. Must stop to fire.' },
  { kind: 'jp_lungeteam', name: 'Lunge-Mine Team', short: 'Lunge Mine', tex: 'jp_lunge', from: 'barracks', cost: 40, manpower: 1, train: 7, hp: 90, speed: 46, radius: 6, inf: true, camo: true,
    gun: armsUnit('lunge', 'bazooka'), desc: 'Men with shaped charges on poles: they must reach the tank, then it goes through any armour. Best in Ambush.' },
  { kind: 'jp_snipu', name: 'Sniper', short: 'Sniper', tex: 'jp_sniper', from: 'barracks', cost: 50, manpower: 1, train: 9, hp: 70, speed: 40, radius: 6, inf: true, camo: true,
    gun: armsUnit('sniper', 'sniper'), desc: 'A camouflaged marksman: the enemy only sees it when it fires.' },
  { kind: 'jp_engineers', name: 'Engineers', short: 'Engineers', tex: 'jp_engineer', from: 'barracks', cost: 42, manpower: 1, train: 8, hp: 120, speed: 44, radius: 6, inf: true, repair: 40,
    gun: armsUnit('arisaka', 'mosin'), desc: 'Repair emplacements and raise rubble back up, free of charge.' },
  { kind: 'jp_medicu', name: 'Medic', short: 'Medic', tex: 'jp_medic', from: 'barracks', cost: 36, manpower: 1, train: 7, hp: 90, speed: 46, radius: 6, inf: true, heal: 12,
    desc: 'Patches up soldiers and the commander nearby.' },
  { kind: 'jp_hagou', name: 'Type 95 Ha-Go', short: 'Ha-Go', tex: 'jp_hago', from: 'motorpool', cost: 110, manpower: 2, train: 10, hp: 360, speed: 58, radius: 10, arm: [12, 12, 10, 6],
    gun: armsUnit('type94_37', 'flak38', { still: true }), desc: 'A fast light tank: good against infantry and armoured cars, paper-thin armour.' },
  { kind: 'jp_chihau', name: 'Type 97 Chi-Ha Kai', short: 'Chi-Ha', tex: 'jp_chiha', from: 'motorpool', cost: 160, manpower: 2, train: 13, hp: 520, speed: 46, radius: 12, arm: [25, 25, 20, 10],
    gun: armsUnit('type1_47t', 'pak40', { still: true }), desc: 'The medium tank with the new 47 mm gun: it goes through a Sherman\'s side.' },
  { kind: 'jp_chinuu', name: 'Type 3 Chi-Nu', short: 'Chi-Nu', tex: 'jp_chinu', from: 'motorpool', cost: 260, manpower: 3, train: 18, hp: 720, speed: 40, radius: 13, arm: [50, 25, 20, 12],
    gun: armsUnit('type3_75', 'f34', { still: true }), desc: 'The 75 mm gun at last: a Sherman from the front at close range.' },
  { kind: 'jp_zerou', name: 'A6M Zero', short: 'Zero', tex: 'jp_zero', from: 'airfield', cost: 0, manpower: 0, train: 0, hp: 220, speed: 215, radius: 12, air: true,
    gun: armsUnit('fighter', 'flak38', { hitsAir: true }), desc: 'Agile fighters on patrol: they hunt aircraft first, then strafe soft targets.' },
];

const JP_HELP: Record<string, string> = {
  type92: 'The Type 92 heavy machine gun, the "woodpecker" for its slow knocking: fewer rounds than an MG-42 but heavier and accurate. Its nest is well hidden.',
  type96: 'Twin 25 mm cannon: the answer to aircraft, and they go through half-tracks, armoured cars and light tanks.',
  rodan: 'Two men with the Type 4 70 mm rocket launcher, a late-war copy of the bazooka: 85 mm of penetration — a Sherman from the side, or from the front point-blank. Short range, very well hidden: put it in Ambush.',
  jp_sniper: 'A sniper tied into the treetops: the best camouflage of any position. One shot, one soldier; useless against armour.',
  type100: 'Burns infantry and open vehicles at point-blank range; closed tanks are sealed against it.',
  type1_47: 'The 47 mm Type 1 with its late-war rounds: 78 mm of penetration — a Stuart from any side, a Sherman only from its 38 mm sides. Hide it and wait for the flank.',
  type88: 'The 75 mm anti-aircraft gun: 90 mm of penetration, enough for a Sherman\'s front at close range, and it bursts among aircraft.',
  jp_chihadug: 'A Chi-Ha with the 47 mm gun dug in to the turret: well hidden, but its armour is thin.',
  cave: 'A cave cut into a coral ridge, the heart of the Iwo Jima defence: 100 mm of rock over the guns, and the enemy only finds it when it fires or walks right up to it.',
  type97_81: 'An 81 mm mortar: bombs that burst among infantry and pin them down.',
  type91: 'The 105 mm howitzer: a big blast at long range, at anything your positions, soldiers or observers can see.',
  type4: 'Type 4 rocket launchers: six 20 cm rockets per salvo, each warhead a heavy blast.',
  jp_depot: 'Guns never run out of ammunition; the depot is your war chest. Each one adds 2 manpower for training units. Produces no damage. At every wave it pays a fixed income plus interest on the money you are holding.',
  jp_observer: 'An observation post: it sees far beyond any gun and artillery fires at all of it, enemy snipers are revealed, guns nearby get extra range.',
  jp_hq: 'A regimental headquarters: every emplacement in range fires faster.',
  jp_workshop: 'Engineers with spare parts patch up every emplacement in range. Rebuilding rubble (B) costs money.',
  jp_barracks: 'Trains infantry that fight outside the maze: riflemen, LMG teams, lunge-mine teams (they must reach the tank), snipers, engineers and medics. Manpower: each HQ adds 4, each depot 2.',
  jp_motorpool: 'Builds tanks: the Ha-Go, the Chi-Ha and the Chi-Nu. Japanese tanks are fast but thinly armoured.',
  jp_airfield: 'A fighter strip. Press R and click a point: two Zeros patrol there for 25 s, shooting down aircraft first.',
  jp_logs: 'A barricade of coconut logs: a cheap 1×1 obstacle that stops vehicles. Infantry clamber over at a third of their speed.',
  jp_wire: 'Barbed wire on the path: infantry get tangled and crawl, vehicles drive over it.',
  type93: 'Anti-tank mines: only a vehicle sets them off.',
  type3mine: 'Terracotta anti-personnel mines: only infantry set them off.',
  jp_roadblock: 'A barrier you can open and close (G) to switch the route mid-wave.',
  val: 'Aichi D3A dive bombers. When ready, press R and click: three of them dive on the target; the bombs hit the thin top armour.',
  type98: 'The Type 98 spigot mortar. When ready, press R and click anywhere: a 300 kg bomb tumbles down with a blast that wrecks everything near it.',
};

export const JAPANESE_DEFENCE: Arsenal = {
  towers: JP_TOWERS,
  units: JP_UNITS,
  combos: [
    { a: 'type92', b: 'jp_wire', name: 'Kill Zone', desc: '+30% fire rate', rate: 1.3 },
    { a: 'cave', b: 'cave', name: 'Tunnel Network', desc: '+25% damage', dmg: 1.25 },
    { a: 'type91', b: 'jp_observer', name: 'Fire Mission', desc: '+30% fire rate', rate: 1.3 },
    { a: 'jp_sniper', b: 'jp_observer', name: 'Spotter', desc: '+40% damage', dmg: 1.4 },
    { a: 'type88', b: 'type96', name: 'AA Battery', desc: '+30% vs air', air: 1.3 },
    { a: 'type1_47', b: 'jp_logs', name: 'Ambush Pit', desc: '+25% damage', dmg: 1.25 },
  ],
  ranks: ['Nitōhei', 'Ittōhei', 'Jōtōhei', 'Gochō', 'Gunsō', 'Shōi', 'Tai-i', 'Shōsa', 'Taisa', 'Taishō'],
  superName: 'Air & heavy mortar',
  look: { base: 'jpbase', hero: 'jp_officer', nuke: 'shell' },
  help: JP_HELP,
};

// ---------------------------------------------------------------- the Japanese army attacking
//
// Doctrine: numbers of infantry and banzai charges, few and light tanks, kamikazes from the air.

const JP_ARMY_UNITS: EnemyDef[] = [
  { name: 'Rifle Squad', hp: 32, speed: 44, reward: 2, armor: 0, air: false, radius: 6, lives: 1, tex: 'jp_rifle', bio: 2, inf: true,
    gun: armsGun('arisaka', 'rifle') },
  { name: 'Banzai Charge', hp: 44, speed: 70, reward: 3, armor: 0, air: false, radius: 6, lives: 1, tex: 'jp_banzai', bio: 2, inf: true, banzai: true,
    gun: armsGun('bayonet', 'smg') },
  { name: 'Sniper', hp: 26, speed: 46, reward: 4, armor: 0, air: false, radius: 6, lives: 1, tex: 'jp_sniper', bio: 2, inf: true, stealth: true, spot: 160,
    gun: armsGun('sniper', 'rifle') },
  { name: 'Medic', hp: 40, speed: 44, reward: 5, armor: 0, air: false, radius: 6, lives: 1, tex: 'jp_medic', bio: 2, inf: true, heal: 0.08 },
  { name: 'Kurogane Scout Car', hp: 45, speed: 92, reward: 3, armor: 0, air: false, radius: 8, lives: 1, tex: 'jp_kurogane', bio: 1, spot: 220 },
  { name: 'Sumida Armoured Car', hp: 80, speed: 70, reward: 4, armor: 0, air: false, radius: 10, lives: 1, tex: 'jp_sumida', bio: 0.6, arm: [11, 6, 6, 6], spot: 190,
    gun: armsGun('type97mg', 'mg') },
  { name: 'Type 95 Ha-Go', hp: 110, speed: 60, reward: 5, armor: 0, air: false, radius: 10, lives: 1, tex: 'jp_hago', bio: 0.5, arm: [12, 12, 10, 6],
    gun: armsGun('type94_37', 'tank', { supp: 0.15, halt: 0.4 }) },
  { name: 'Type 97 Chi-Ha', hp: 160, speed: 46, reward: 7, armor: 0, air: false, radius: 12, lives: 2, tex: 'jp_chiha', bio: 0.4, arm: [25, 25, 20, 10],
    gun: armsGun('type97_57', 'tank', { supp: 0.25, halt: 0.5 }) },
  { name: 'Type 1 Chi-He', hp: 190, speed: 48, reward: 8, armor: 0, air: false, radius: 12, lives: 2, tex: 'jp_chihe', bio: 0.4, arm: [50, 25, 20, 12],
    gun: armsGun('type1_47t', 'tank', { supp: 0.25, halt: 0.5 }) },
  { name: 'Type 3 Chi-Nu', hp: 260, speed: 40, reward: 11, armor: 0, air: false, radius: 13, lives: 2, tex: 'jp_chinu', bio: 0.35, arm: [50, 25, 20, 12],
    gun: armsGun('type3_75', 'tank', { supp: 0.3, halt: 0.6 }) },
  { name: 'O-I Super-heavy Tank', hp: 2100, speed: 20, reward: 85, armor: 0, air: false, radius: 20, lives: 4, tex: 'jp_oi', bio: 0.25, arm: [150, 75, 75, 30], boss: true,
    gun: armsGun('oi_105', 'tank', { supp: 0.6, halt: 0.9 }) },
  { name: 'Kamikaze', hp: 75, speed: 105, reward: 6, armor: 0, air: true, radius: 12, lives: 1, tex: 'jp_kamikaze', bio: 0,
    gun: armsGun('kamikaze', 'kamikaze') },
  { name: 'A6M Zero', hp: 62, speed: 120, reward: 4, armor: 0, air: true, radius: 12, lives: 1, tex: 'jp_zero', bio: 0,
    gun: armsGun('fighter', 'mg', { air: true }) },
  { name: 'Type 4 Rocket Truck', hp: 90, speed: 54, reward: 9, armor: 0, air: false, radius: 11, lives: 1, tex: 'jp_type4', bio: 1,
    gun: armsGun('type4r', 'katyusha', { halt: 1.2, salvo: 4 }) },
  { name: 'Engineers', hp: 45, speed: 46, reward: 5, armor: 0, air: false, radius: 6, lives: 1, tex: 'jp_engineer', bio: 2, inf: true,
    gun: armsGun('satchel', 'satchel') },
  { name: 'Shōi', hp: 40, speed: 44, reward: 8, armor: 0, air: false, radius: 6, lives: 1, tex: 'jp_officer', bio: 2, inf: true, officer: true, spot: 160,
    gun: armsGun('pistol', 'smg') },
];

const JP_ARMY_HELP: UnitHelp[] = [
  { text: 'Riflemen with Arisakas, in great numbers.', counter: 'Machine guns, mortars, AP mines; wire slows them.' },
  { text: 'A banzai charge: fast, shouting infantry that suppression can\'t slow down. They fight with the bayonet.', counter: 'Mass machine guns and mines; wire still tangles them.' },
  { text: 'A camouflaged sniper: invisible unless spotted, and it hunts your commander.', counter: 'Observation posts reveal snipers.' },
  { text: 'A medic who patches up everyone around.', counter: 'Kill medics first (Strong targeting).' },
  { text: 'A Kurogane scout car: its crew spots hidden guns from far away.', counter: 'Anything kills it.' },
  { text: 'A six-wheeled armoured car with a machine gun; it spots hidden guns.', counter: 'Light flak and anything heavier.' },
  { text: 'The Ha-Go light tank: fast, with 12 mm of armour that even heavy machine guns can pierce.', counter: '.50 calibres, any anti-tank weapon.' },
  { text: 'The Chi-Ha medium tank: 25 mm of armour and a short 57 mm gun. Costs 2 lives.', counter: 'Any anti-tank gun or bazooka from any side.' },
  { text: 'The Chi-He: 50 mm in front and a 47 mm gun.', counter: 'Any anti-tank gun; bazookas from any side.' },
  { text: 'The Chi-Nu: the 75 mm gun on a thinly armoured hull.', counter: 'Any anti-tank weapon; its sides are only 25 mm.' },
  { text: 'A boss: the O-I super-heavy tank, a 120-tonne prototype with three turrets and 150 mm of front armour. Costs 4 lives.', counter: 'Heavy guns into its 75 mm sides, mines and air strikes.' },
  { text: 'A kamikaze: a Zero carrying a bomb that dives into your most valuable emplacement.', counter: 'Shoot it down before it arrives: anti-aircraft guns all along its path.' },
  { text: 'An A6M Zero fighter: it hunts your aircraft.', counter: 'Anti-aircraft guns and machine guns.' },
  { text: 'A Type 4 rocket truck: four heavy rockets per salvo from long range.', counter: 'An unarmoured truck: long-range guns or artillery with an observer.' },
  { text: 'Engineers with charges: they blow the weakest wall of a long maze, lift mines and cut wire.', counter: 'Machine guns and AP mines before they reach the wall.' },
  { text: 'A sword-carrying second lieutenant leading the infantry of the wave. While he lives his men press on; if he falls, the wave loses heart (banzai troops less so).', counter: 'Snipers pick officers off first; anything that reaches him early in the wave.' },
];

export const JP_ARMY: Army = {
  enemies: JP_ARMY_UNITS,
  roster: {
    rifle: 0, assault: 1, sniper: 2, medic: 3, recon: 4, armcar: 5, light: 6, medium: 7, medium2: 8, heavy: 9, boss: 10,
    attack: 11, fighter: 12, rockets: 13, sapper: 14, officer: 15,
  },
  doctrine: { inf: 1.4, armour: 0.6 },
  help: JP_ARMY_HELP,
};
