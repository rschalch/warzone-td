// The Western Allies (the US Army): emplacements and units as the defender, and the army of the
// offensive. Doctrine: economy, artillery and air power; the anti-tank weapons are individually
// weaker than the German ones, but there are more of them, and the 90 mm answers the Panther.

import { growAll, type EnemyDef, type TowerDef, type UnitDef } from './defs';
import { GERMAN } from './ww2_de';
import { derive, slotOf, type Arsenal, type Army, type Slot, type UnitHelp } from './ww2_kit';

const G = (slot: Slot) => slotOf(GERMAN, slot);

// ---------------------------------------------------------------- emplacements (in slot order)

export const US_TOWERS: TowerDef[] = growAll([
  derive(G('mg'), { kind: 'm1919', name: '.30 cal M1919 Nest', short: '.30 cal', desc: 'The Browning: steady fire that cuts down and pins infantry.', turret: 'us_w_mg', sfx: 'm1919', color: 0x8a8460,
    lv: { cost: 14, damage: 3.4, rate: 7.5, range: 110 } }),
  derive(G('lightaa'), { kind: 'm45', name: 'M45 Quadmount', short: 'Quad .50', desc: 'Four .50 calibre Brownings: shreds aircraft, trucks and infantry alike.', turret: 'us_w_quad', sfx: 'dt',
    lv: { cost: 40, damage: 6, rate: 8, range: 160, pen: 22, supp: 0.06 } }),
  derive(G('at'), { kind: 'bazooka', name: 'Bazooka Team', short: 'Bazooka', desc: 'The M9 rocket launcher: short range, goes through a Panzer IV from the front.', turret: 'us_w_bazooka', sfx: 'bazooka',
    lv: { cost: 25, damage: 75, rate: 0.33, range: 80, pen: 100 } }),
  derive(G('sniper'), { kind: 'us_sniper', name: 'Sniper', short: 'Sniper', desc: 'A Springfield M1903 with a scope: one shot, one soldier.', turret: 'us_w_sniper' }),
  derive(G('flamer'), { kind: 'us_flamer', name: 'M2 Flamethrower', short: 'Flamer', desc: 'Burns infantry and soft vehicles at point-blank range.', turret: 'us_w_flamer' }),
  derive(G('atgun'), { kind: 'm1_57', name: '57 mm M1 Gun', short: '57 mm', desc: 'The Allied anti-tank gun: kills the Panzer IV, needs the flank of a Panther.', turret: 'us_w_57', sfx: 'pak40',
    lv: { cost: 48, damage: 62, rate: 0.55, range: 170, pen: 95 } }),
  derive(G('heavyaa'), { kind: 'm2_90', name: '90 mm M2 Gun', short: '90 mm', desc: 'Heavy anti-aircraft gun turned on tanks: long range, 150 mm of penetration.', turret: 'us_w_90', sfx: 'flak88',
    lv: { cost: 125, damage: 120, range: 240, pen: 150 } }),
  derive(G('tank'), { kind: 'us_shermandug', name: 'Sherman 76 (dug in)', short: 'Sherman', desc: 'An M4A3 with the 76 mm gun, hull-down behind a berm.', turret: 'us_w_sherman', sfx: 'f34',
    lv: { cost: 150, damage: 85, rate: 0.32, range: 195, pen: 110, hp: 560, fort: 75 } }),
  derive(G('bunker'), { kind: 'us_bunker', name: 'MG Bunker', short: 'Bunker', desc: 'A concrete pillbox with two .30 cals firing at two targets at once.', turret: 'us_w_bunker', sfx: 'm1919' }),
  derive(G('mortar'), { kind: 'm1_81', name: '81 mm M1 Mortar', short: 'Mortar', desc: 'High-explosive bombs on infantry groups. Pins them down.', turret: 'us_w_mortar' }),
  derive(G('howitzer'), { kind: 'm2a1', name: '105 mm M2A1', short: '105 mm', desc: 'The American way of war: a howitzer that fires fast and often. Needs an observer.', turret: 'us_w_105',
    lv: { cost: 100, rate: 0.22 } }),
  derive(G('rockets'), { kind: 'calliope', name: 'T34 Calliope', short: 'Calliope', desc: 'A Sherman with sixty rocket tubes over its turret: a storm on the target area.', turret: 'us_calliope', sfx: 'katyusha',
    lv: { cost: 140, damage: 34, rate: 0.09, splash: 32, salvo: 12 } }),
  derive(G('depot'), { kind: 'us_depot', name: 'Supply Dump', short: 'Depot', desc: 'The richest supply chain of the war: pays out well at every wave.', turret: 'us_w_depot',
    lv: { cost: 75, income: 16 } }),
  derive(G('observer'), { kind: 'us_observer', name: 'Forward Observer', short: 'Observer', desc: 'Spots for artillery, reveals snipers and extends the range of guns nearby.', turret: 'us_w_observer' }),
  derive(G('hq'), { kind: 'us_hq', name: 'Battalion HQ', short: 'HQ', desc: 'Radios and officers: emplacements in range fire faster.', turret: 'us_w_hq' }),
  derive(G('workshop'), { kind: 'us_workshop', name: 'Ordnance Workshop', short: 'Workshop', desc: 'Ordnance men patch up damaged emplacements in range, even under fire.', turret: 'us_w_workshop' }),
  derive(G('barracks'), { kind: 'us_barracks', name: 'Barracks', short: 'Barracks', desc: 'Trains rifle squads, .30 cal and bazooka teams, snipers, engineers and medics.', turret: 'us_w_barracks' }),
  derive(G('motorpool'), { kind: 'us_motorpool', name: 'Motor Pool', short: 'Motor Pool', desc: 'Builds Shermans, Easy Eights and Pershings.', turret: 'us_w_motorpool' }),
  derive(G('airfield'), { kind: 'us_airfield', name: 'Fighter Strip', short: 'Airfield', desc: 'Send (R) a pair of P-51 Mustangs to patrol a point.', turret: 'us_w_airfield' }),
  derive(G('teeth'), { kind: 'us_teeth', name: 'Concrete Blocks', short: 'Blocks', desc: 'Concrete obstacles: a cheap 1×1 wall for shaping the maze.', block: 'teeth' }),
  derive(G('wire'), { kind: 'us_wire', name: 'Concertina Wire', short: 'Wire', desc: 'Goes on the path. Infantry get tangled and crawl; vehicles drive through.' }),
  derive(G('atmine'), { kind: 'm1mine', name: 'M1 AT Mines', short: 'AT Mine', desc: 'Anti-tank mines on the path: only vehicles set them off.' }),
  derive(G('apmine'), { kind: 'm2mine', name: 'M2 Bounding Mines', short: 'AP Mine', desc: 'Bounding mines that burst at waist height: only infantry set them off.' }),
  derive(G('roadblock'), { kind: 'us_roadblock', name: 'Roadblock', short: 'Roadblock', desc: 'A barrier you can open and close (G) to reroute an attack mid-fight.', block: 'roadblock' }),
  derive(G('strike'), { kind: 'p47', name: 'P-47 Thunderbolts', short: 'P-47', desc: 'Call in (R) four Jugs: rockets and bombs on a point. Air superiority: they are back soon.', turret: 'us_w_p47field', sfx: 'rs82',
    lv: { cost: 210, damage: 260, salvo: 4, pen: 80, charge: 32 } }),
  derive(G('super'), { kind: 'littleboy', name: 'Little Boy (B-29)', short: 'Little Boy', desc: 'The atomic bomb. A B-29 drops it (R) on any point: nothing survives the blast.', turret: 'us_w_littleboy', sfx: '',
    lv: { cost: 900, damage: 4000, splash: 230, charge: 240, pen: 400 } }),
]);

const US_UNITS: UnitDef[] = [
  { kind: 'us_squad', name: 'Rifle Squad', short: 'GIs', tex: 'us_rifle', from: 'barracks', cost: 35, manpower: 1, train: 6, hp: 70, speed: 44, radius: 6, inf: true,
    gun: { dmg: 6, range: 110, rate: 1.5, pen: 8, supp: 0.03, sfx: 'mosin' }, desc: 'GIs with M1 Garands: the semi-automatic rifle gives a squad heavy fire.' },
  { kind: 'us_30team', name: '.30 cal Team', short: '.30 cal', tex: 'us_mg', from: 'barracks', cost: 48, manpower: 1, train: 8, hp: 55, speed: 38, radius: 6, inf: true,
    gun: { dmg: 3.4, range: 120, rate: 7.5, pen: 8, supp: 0.06, still: true, sfx: 'm1919' }, desc: 'A light machine gun team. Must stop to fire.' },
  { kind: 'us_bazteam', name: 'Bazooka Team', short: 'Bazooka', tex: 'us_bazooka', from: 'barracks', cost: 55, manpower: 1, train: 9, hp: 50, speed: 40, radius: 6, inf: true, camo: true,
    gun: { dmg: 75, range: 80, rate: 0.33, pen: 100, sfx: 'bazooka' }, desc: 'Tank hunters with the M9. Best in Ambush where tanks pass close.' },
  { kind: 'us_snipu', name: 'Sniper', short: 'Sniper', tex: 'us_sniper', from: 'barracks', cost: 55, manpower: 1, train: 9, hp: 35, speed: 40, radius: 6, inf: true, camo: true,
    gun: { dmg: 60, range: 270, rate: 0.4, pen: 10, sfx: 'sniper' }, desc: 'A camouflaged marksman: the enemy only sees it when it fires.' },
  { kind: 'us_engineers', name: 'Combat Engineers', short: 'Engineers', tex: 'us_engineer', from: 'barracks', cost: 45, manpower: 1, train: 8, hp: 60, speed: 44, radius: 6, inf: true, repair: 16,
    gun: { dmg: 5, range: 100, rate: 1.2, pen: 8, sfx: 'mosin' }, desc: 'Repair emplacements and raise rubble back up, free of charge.' },
  { kind: 'us_medicu', name: 'Medic', short: 'Medic', tex: 'us_medic', from: 'barracks', cost: 40, manpower: 1, train: 7, hp: 45, speed: 46, radius: 6, inf: true, heal: 7,
    desc: 'Patches up soldiers and the commander nearby.' },
  { kind: 'us_shermanu', name: 'M4 Sherman', short: 'Sherman', tex: 'us_sherman', from: 'motorpool', cost: 170, manpower: 2, train: 13, hp: 320, speed: 50, radius: 12, arm: [90, 38, 38, 19],
    gun: { dmg: 50, range: 180, rate: 0.36, pen: 75, splash: 14, still: true, sfx: 'f34' }, desc: 'Reliable and quick to fire (its gun is stabilised), but the 75 mm struggles with Panthers.' },
  { kind: 'us_easy8u', name: 'M4A3E8 "Easy Eight"', short: 'Easy Eight', tex: 'us_easy8', from: 'motorpool', cost: 240, manpower: 2, train: 16, hp: 360, speed: 52, radius: 13, arm: [100, 38, 38, 19],
    gun: { dmg: 70, range: 195, rate: 0.34, pen: 115, splash: 12, still: true, sfx: 'f34' }, desc: 'The 76 mm Sherman on new suspension: fast, and the gun goes through a Tiger\'s side.' },
  { kind: 'us_pershingu', name: 'M26 Pershing', short: 'Pershing', tex: 'us_pershing', from: 'motorpool', cost: 400, manpower: 3, train: 24, hp: 560, speed: 38, radius: 15, arm: [150, 76, 50, 25],
    gun: { dmg: 115, range: 215, rate: 0.26, pen: 150, splash: 16, still: true, sfx: 'tiger' }, desc: 'The heavy tank at last: thick front and a 90 mm gun.' },
  { kind: 'us_p51u', name: 'P-51 Mustang', short: 'P-51', tex: 'us_p51', from: 'airfield', cost: 0, manpower: 0, train: 0, hp: 140, speed: 210, radius: 12, air: true,
    gun: { dmg: 11, range: 115, rate: 5, pen: 22, hitsAir: true, sfx: 'dt' }, desc: 'Fighters on patrol: they hunt aircraft first, then strafe soft targets.' },
];

const US_HELP: Record<string, string> = {
  m1919: 'The Browning M1919: slower than an MG-42 but steady. It cuts down and pins infantry; its bullets bounce off any armour. Wire in front of it makes a kill zone.',
  m45: 'Four .50 calibre machine guns in a power turret. The best answer to aircraft, and 22 mm of penetration goes through half-tracks and armoured cars.',
  bazooka: 'Two men with an M9 bazooka: short range, slow to reload, 100 mm of penetration — a Panzer IV from the front, a Panther or Tiger only from the side.',
  us_sniper: 'A sniper with a Springfield: one shot, one dead soldier, from far away. Useless against armour. Next to an observer +40% damage.',
  us_flamer: 'Burns infantry and open vehicles at point-blank range; closed tanks are sealed against it.',
  m1_57: 'The 57 mm (a British 6-pounder built in America): 95 mm of penetration kills a Panzer IV from any side and a Panther from the flank. Two side by side form a gun line.',
  m2_90: 'The 90 mm anti-aircraft gun: 150 mm of penetration answers the Panther\'s front and the Tiger, and its shells burst among aircraft.',
  us_shermandug: 'A Sherman with the 76 mm gun dug in hull-down: 110 mm of penetration and a sloped front.',
  us_bunker: 'A concrete pillbox with two .30 cals, each firing at its own target.',
  m1_81: 'An 81 mm mortar: bombs that burst among infantry and pin them down.',
  m2a1: 'The 105 mm howitzer. American artillery fired faster and more often than anyone\'s: a big blast at long range, but it needs observers to see.',
  calliope: 'The T34 Calliope: a rocket frame over a Sherman. Twelve rockets per salvo scattered over the target area.',
  us_depot: 'The supply chain: a larger income at every wave than any other side\'s depot, plus interest on the money you keep.',
  us_observer: 'A forward observer: artillery fires at anything it sees, enemy snipers are revealed, guns nearby get extra range.',
  us_hq: 'A battalion headquarters: every emplacement in range fires faster.',
  us_workshop: 'Ordnance men with spare parts patch up every emplacement in range. Rebuilding rubble (B) costs money.',
  us_barracks: 'Trains infantry that fight outside the maze: GIs, .30 cal and bazooka teams, snipers, engineers (who repair emplacements for free) and medics. Select a unit and click the ground to send it; give it a stance. Manpower: each HQ adds 4, each depot 2.',
  us_motorpool: 'Builds tanks: the Sherman, the Easy Eight and the Pershing. Tanks stop to fire and turn their front to the target.',
  us_airfield: 'A fighter strip. Press R and click a point: two P-51s patrol there for 25 s, shooting down aircraft first.',
  us_teeth: 'Concrete blocks: a cheap 1×1 obstacle to shape the maze.',
  us_wire: 'Concertina wire on the path: infantry get tangled and crawl, vehicles drive over it.',
  m1mine: 'Anti-tank mines: only a vehicle sets them off.',
  m2mine: 'Bounding mines: only infantry set them off.',
  us_roadblock: 'A barrier you can open and close (G) to switch the route mid-wave.',
  p47: 'P-47 Thunderbolts. When ready, press R and click: four of them strike the target with rockets and bombs on the thin top armour. With air superiority they are back quickly.',
  littleboy: 'Little Boy, the uranium bomb. When ready (it takes a long time), press R and click anywhere: a B-29 drops it and the blast destroys everything over a huge area, heavy tanks included.',
};

export const ALLIED_DEFENCE: Arsenal = {
  towers: US_TOWERS,
  units: US_UNITS,
  combos: [
    { a: 'm1919', b: 'us_wire', name: 'Kill Zone', desc: '+30% fire rate', rate: 1.3 },
    { a: 'm1_57', b: 'm1_57', name: 'Gun Line', desc: '+20% fire rate', rate: 1.2 },
    { a: 'm2a1', b: 'us_observer', name: 'Time on Target', desc: '+30% fire rate', rate: 1.3 },
    { a: 'us_sniper', b: 'us_observer', name: 'Spotter', desc: '+40% damage', dmg: 1.4 },
    { a: 'm2_90', b: 'm45', name: 'AA Battery', desc: '+30% vs air', air: 1.3 },
    { a: 'us_bunker', b: 'us_teeth', name: 'Fortified', desc: '+25% damage', dmg: 1.25 },
  ],
  ranks: ['Private', 'Private 1st Class', 'Corporal', 'Sergeant', '2nd Lieutenant', '1st Lieutenant', 'Captain', 'Major', 'Colonel', 'General'],
  superName: 'Air power',
  look: { base: 'usbase', hero: 'us_officer', nuke: 'littleboy' },
  help: US_HELP,
};

// ---------------------------------------------------------------- the US Army attacking
//
// Doctrine: air power and plentiful Shermans; the tanks fire on the move almost as well as from
// the halt (gyrostabilisers), so they stop only briefly.

const US_ARMY_UNITS: EnemyDef[] = [
  { name: 'GI Rifle Squad', hp: 34, speed: 44, reward: 2, armor: 0, air: false, radius: 6, lives: 1, tex: 'us_rifle', bio: 2, inf: true,
    gun: { dmg: 3, range: 110, rate: 0.8, pen: 7, supp: 0.03, fx: 'rifle' } },
  { name: 'Rangers', hp: 46, speed: 54, reward: 3, armor: 0, air: false, radius: 6, lives: 1, tex: 'us_ranger', bio: 2, inf: true,
    gun: { dmg: 4.2, range: 70, rate: 1.2, pen: 6, supp: 0.05, fx: 'smg' } },
  { name: 'Sniper', hp: 26, speed: 46, reward: 4, armor: 0, air: false, radius: 6, lives: 1, tex: 'us_sniper', bio: 2, inf: true, stealth: true, spot: 150,
    gun: { dmg: 14, range: 230, rate: 0.25, pen: 10, supp: 0.15, fx: 'rifle' } },
  { name: 'Medic', hp: 40, speed: 46, reward: 5, armor: 0, air: false, radius: 6, lives: 1, tex: 'us_medic', bio: 2, inf: true, heal: 0.09 },
  { name: 'Jeep', hp: 50, speed: 100, reward: 3, armor: 0, air: false, radius: 8, lives: 1, tex: 'us_jeep', bio: 1, spot: 220 },
  { name: 'M8 Greyhound', hp: 70, speed: 82, reward: 5, armor: 0, air: false, radius: 10, lives: 1, tex: 'us_m8', bio: 0.6, arm: [12, 8, 8, 6], spot: 200,
    gun: { dmg: 14, range: 150, rate: 0.6, pen: 45, supp: 0.1, halt: 0.25, fx: 'tank' } },
  { name: 'M5 Stuart', hp: 125, speed: 56, reward: 6, armor: 0, air: false, radius: 11, lives: 1, tex: 'us_stuart', bio: 0.4, arm: [44, 25, 22, 13],
    gun: { dmg: 18, range: 160, rate: 0.4, pen: 45, supp: 0.2, halt: 0.3, fx: 'tank' } },
  { name: 'M4 Sherman', hp: 185, speed: 42, reward: 8, armor: 0, air: false, radius: 12, lives: 2, tex: 'us_sherman', bio: 0.35, arm: [90, 38, 38, 19],
    gun: { dmg: 34, range: 180, rate: 0.24, pen: 70, supp: 0.3, halt: 0.5, splash: 16, fx: 'tank' } },
  { name: 'M4A3E8 Easy Eight', hp: 215, speed: 44, reward: 10, armor: 0, air: false, radius: 13, lives: 2, tex: 'us_easy8', bio: 0.35, arm: [100, 38, 38, 19],
    gun: { dmg: 42, range: 190, rate: 0.22, pen: 110, supp: 0.3, halt: 0.5, splash: 14, fx: 'tank' } },
  { name: 'M4A3E2 Jumbo', hp: 330, speed: 34, reward: 13, armor: 0, air: false, radius: 13, lives: 3, tex: 'us_jumbo', bio: 0.3, arm: [150, 76, 38, 25],
    gun: { dmg: 36, range: 180, rate: 0.26, pen: 70, supp: 0.3, halt: 0.4, splash: 16, fx: 'tank' } },
  { name: 'M26 Pershing', hp: 2000, speed: 26, reward: 80, armor: 0, air: false, radius: 16, lives: 4, tex: 'us_pershing', bio: 0.25, arm: [150, 76, 50, 25], boss: true,
    gun: { dmg: 120, range: 220, rate: 0.12, pen: 150, supp: 0.6, halt: 0.6, splash: 26, fx: 'tank' } },
  { name: 'P-47 Thunderbolt', hp: 110, speed: 80, reward: 6, armor: 0, air: true, radius: 14, lives: 1, tex: 'us_p47', bio: 0, arm: [12, 12, 8, 8],
    gun: { dmg: 30, range: 70, rate: 0.35, pen: 60, supp: 0.3, splash: 24, fx: 'rocket' } },
  { name: 'P-51 Mustang', hp: 70, speed: 125, reward: 4, armor: 0, air: true, radius: 12, lives: 1, tex: 'us_p51', bio: 0,
    gun: { dmg: 8, range: 120, rate: 3, pen: 18, supp: 0, fx: 'mg', air: true } },
  { name: 'T34 Calliope', hp: 170, speed: 40, reward: 10, armor: 0, air: false, radius: 12, lives: 1, tex: 'us_calliope', bio: 0.35, arm: [90, 38, 38, 19],
    gun: { dmg: 22, range: 320, rate: 1 / 14, pen: 30, supp: 0.5, halt: 1.2, splash: 30, salvo: 14, fx: 'katyusha' } },
  { name: 'Combat Engineers', hp: 46, speed: 46, reward: 5, armor: 0, air: false, radius: 6, lives: 1, tex: 'us_engineer', bio: 2, inf: true,
    gun: { dmg: 260, range: 22, rate: 0.25, pen: 150, supp: 0.6, fx: 'satchel' } },
];

const US_ARMY_HELP: UnitHelp[] = [
  { text: 'GIs with M1 Garands: semi-automatic rifles, so a squad pours out fire that pins your crews.', counter: 'Machine guns, mortars, AP mines; wire slows them.' },
  { text: 'Rangers with Thompsons: fast, tough assault troops.', counter: 'Machine guns and flamethrowers.' },
  { text: 'A camouflaged sniper: invisible unless spotted, and it hunts your commander.', counter: 'Observation posts reveal snipers.' },
  { text: 'A medic who patches up everyone around.', counter: 'Kill medics first (Strong targeting).' },
  { text: 'A Jeep with scouts: they spot hidden guns from far away.', counter: 'Anything kills it.' },
  { text: 'The M8 Greyhound armoured car: fast, with a 37 mm gun; its crew spots hidden guns.', counter: 'Light flak and anything heavier.' },
  { text: 'The M5 Stuart: a fast light tank with thin armour.', counter: 'Any anti-tank weapon from any side.' },
  { text: 'The M4 Sherman: 90 mm of sloped front, thin sides; it stops only briefly to fire. Costs 2 lives.', counter: 'Anti-tank guns into its 38 mm sides; most guns from the front at short range.' },
  { text: 'The Easy Eight: a 76 mm Sherman that goes through a Panther\'s side and a Panzer IV\'s front.', counter: 'Flank shots; it is no better armoured than the Sherman.' },
  { text: 'The Jumbo: an assault Sherman with 150 mm of front armour, made to lead columns. Costs 3 lives.', counter: 'Heavy guns or flank shots — its rear is thin.' },
  { text: 'A boss: the M26 Pershing, with 150 mm of front armour and a 90 mm gun. Costs 4 lives.', counter: 'Heavy guns into its 76 mm sides; mines and air strikes.' },
  { text: 'The P-47 Thunderbolt: a heavy fighter-bomber firing rockets at your positions. Armoured.', counter: 'Light flak and heavy anti-aircraft guns.' },
  { text: 'The P-51 Mustang: a fighter that hunts your aircraft.', counter: 'Anti-aircraft guns and machine guns.' },
  { text: 'The Calliope: a Sherman carrying a frame of rocket tubes, firing salvos from long range.', counter: 'It is still a Sherman: anti-tank guns into its sides.' },
  { text: 'Combat engineers with Bangalore torpedoes and charges: they blow the weakest wall of a long maze, lift mines and cut wire.', counter: 'Machine guns and AP mines before they reach the wall.' },
];

export const US_ARMY: Army = {
  enemies: US_ARMY_UNITS,
  roster: {
    rifle: 0, assault: 1, sniper: 2, medic: 3, recon: 4, armcar: 5, light: 6, medium: 7, medium2: 8, heavy: 9, boss: 10,
    attack: 11, fighter: 12, rockets: 13, sapper: 14,
  },
  doctrine: { inf: 0.9, armour: 0.9 },
  help: US_ARMY_HELP,
};
