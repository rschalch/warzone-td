// Germany: the emplacements and units of the Wehrmacht and the Luftwaffe as the defender, and its
// army as the attacker (see ww2_kit.ts for the slots and the wave builder).
//
// Penetration (`pen`, mm) and armour (`arm`, mm: front, side, rear, top) follow real figures
// loosely, keeping their order: an MG-42 can't scratch a T-34 from any side, a PaK 40 kills it
// from the flank and struggles against a KV-1's front.

import { RT, growAll, type EnemyDef, type TowerDef, type UnitDef } from './defs';
import type { Arsenal, Army, UnitHelp } from './ww2_kit';
import { armsGun, armsLv, armsUnit } from './ww2_arms';

// ---------------------------------------------------------------- emplacements (in slot order)

export const GERMAN: TowerDef[] = growAll([
  // ---- infantry weapons
  RT({
    kind: 'mg42', slot: 'mg', role: 'gun', cat: 'basic', name: 'MG-42 Nest', short: 'MG-42', desc: '1,200 rounds a minute: shreds and pins infantry. Bounces off armour.',
    hitsGround: true, hitsAir: true, airMult: 0.6, color: 0xc9b26a, turret: 'w_mg42', sfx: 'mg42',
    camo: 0.3,
    weapon: 'mg42',
    levels: [{ cost: 15, ...armsLv('mg42'), hp: 510, fort: 15 }],
  }),
  RT({
    kind: 'flak38', slot: 'lightaa', role: 'gun', cat: 'basic', name: '2 cm Flak 38', short: 'Flak 38', desc: 'Light autocannon: deadly to aircraft, light vehicles and infantry.',
    hitsGround: true, hitsAir: true, airMult: 2.2, color: 0x9aa070, turret: 'w_flak38', sfx: 'flak38',
    weapon: 'flak38',
    levels: [{ cost: 35, ...armsLv('flak38'), hp: 450, fort: 10 }],
  }),
  RT({
    kind: 'schreck', slot: 'at', role: 'at', cat: 'basic', name: 'Panzerschreck Team', short: 'Schreck', desc: 'Rocket launcher team. Very short range, goes through any tank.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x8a7a50, turret: 'w_schreck', sfx: 'schreck',
    camo: 0.7,
    weapon: 'schreck',
    levels: [{ cost: 30, ...armsLv('schreck'), hp: 300, fort: 12 }],
  }),
  RT({
    kind: 'sniper', slot: 'sniper', role: 'sniper', cat: 'basic', name: 'Scharfschütze', short: 'Sniper', desc: 'Kills a soldier per shot from far away. Useless against armour.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x6a7a4a, turret: 'w_sniper', sfx: 'sniper',
    camo: 0.85,
    weapon: 'sniper',
    levels: [{ cost: 45, ...armsLv('sniper'), hp: 240, fort: 12 }],
  }),
  RT({
    kind: 'flamer', slot: 'flamer', role: 'flame', cat: 'basic', name: 'Flammenwerfer', short: 'Flamer', desc: 'Burns infantry and soft vehicles at point-blank range. Tanks are sealed.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xff7a1a, turret: 'w_flamer', sfx: 'flame',
    camo: 0.5,
    weapon: 'flamer',
    levels: [{ cost: 40, ...armsLv('flamer'), burn: 9, hp: 330, fort: 12 }],
  }),

  // ---- anti-tank guns
  RT({
    kind: 'pak40', slot: 'atgun', role: 'at', cat: 'precision', name: '7.5 cm PaK 40', short: 'PaK 40', desc: 'Anti-tank gun: slow, decisive shots. Kills T-34s from the side.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x7a8a5a, turret: 'w_pak40', sfx: 'pak40',
    camo: 0.6,
    weapon: 'pak40',
    levels: [{ cost: 55, ...armsLv('pak40'), hp: 630, fort: 22 }],
  }),
  RT({
    kind: 'flak88', slot: 'heavyaa', role: 'at', cat: 'precision', name: '8.8 cm Flak 36', short: 'Flak 88', desc: 'The "Eighty-Eight": long range, kills tanks and bombers alike.',
    hitsGround: true, hitsAir: true, airMult: 1, color: 0xa8a890, turret: 'w_flak88', sfx: 'flak88',
    weapon: 'flak88',
    levels: [{ cost: 120, ...armsLv('flak88'), hp: 810, fort: 15 }],
  }),
  RT({
    kind: 'tiger', slot: 'tank', role: 'at', cat: 'precision', name: 'Tiger I (dug in)', short: 'Tiger', desc: 'A hull-down Tiger: the 8.8 cm KwK 36 outranges every Soviet tank.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x9a8c60, turret: 'w_tiger', sfx: 'tiger',
    camo: 0.4,
    weapon: 'kwk36',
    levels: [{ cost: 200, ...armsLv('kwk36'), hp: 2190, fort: 100 }],
  }),
  RT({
    kind: 'bunker', slot: 'bunker', role: 'bunker', cat: 'precision', name: 'MG Bunker', short: 'Bunker', desc: 'Concrete pillbox with two MGs firing at two targets at once.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x8a8a7a, turret: 'w_bunker', sfx: 'mg42',
    camo: 0.3,
    weapon: 'mg42',
    // (the embrasures narrow the MGs' field of fire)
    levels: [{ cost: 45, ...armsLv('mg42'), range: 80, hp: 1770, fort: 80 }],
  }),

  // ---- artillery
  RT({
    kind: 'mortar', slot: 'mortar', role: 'cannon', cat: 'fire', name: '8 cm Mortar', short: 'Mortar', desc: 'High-explosive bombs on infantry groups. Pins them down.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xa08a5a, turret: 'w_mortar', sfx: 'mortar',
    camo: 0.5,
    weapon: 'grw34',
    levels: [{ cost: 40, ...armsLv('grw34'), hp: 390, fort: 12 }],
  }),
  RT({
    kind: 'lefh18', slot: 'howitzer', role: 'arty', cat: 'fire', name: '10.5 cm leFH 18', short: 'Howitzer', desc: 'Huge range and blast. It fires at anything your positions, soldiers or observers can see.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x7a6a4a, turret: 'w_lefh18', sfx: 'arty',
    weapon: 'lefh18',
    levels: [{ cost: 110, ...armsLv('lefh18'), hp: 630, fort: 12 }],
  }),
  RT({
    kind: 'nebel', slot: 'rockets', role: 'cannon', cat: 'fire', name: 'Nebelwerfer 41', short: 'Nebelwerfer', desc: 'Six screaming rockets per salvo, scattered over the target area.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xb05a3a, turret: 'w_nebel', sfx: 'nebel',
    weapon: 'nebel41',
    levels: [{ cost: 130, ...armsLv('nebel41'), hp: 420, fort: 8 }],
  }),

  // ---- support
  RT({
    kind: 'depot', slot: 'depot', role: 'depot', cat: 'support', name: 'Supply Depot', short: 'Depot', desc: 'Pays out at every wave (income plus interest) and adds manpower for training units.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0xd0b050, turret: 'w_depot', aim: 'static', targeted: false,
    levels: [{ cost: 80, damage: 0, range: 180, rate: 0, income: 12, interest: 0.02, cap: 40, hp: 930, fort: 10 }],
  }),
  RT({
    kind: 'observer', slot: 'observer', role: 'radar', cat: 'support', name: 'Observation Post', short: 'Observer', desc: 'Sees far (even at night), reveals snipers, speeds up artillery and extends the range of guns nearby.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0x50c0a0, turret: 'w_observer', aim: 'spin', targeted: false,
    levels: [{ cost: 55, damage: 0, range: 170, rate: 0, buff: 0.1, hp: 330, fort: 12 }],
  }),
  RT({
    kind: 'hq', slot: 'hq', role: 'command', cat: 'support', name: 'Field HQ', short: 'HQ', desc: 'Officers and radios: emplacements in range fire faster.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0xc04a3a, turret: 'w_hq', aim: 'static', targeted: false,
    levels: [{ cost: 90, damage: 0, range: 100, rate: 0, buff: 0.15, hp: 1020, fort: 30 }],
  }),
  RT({
    kind: 'workshop', slot: 'workshop', role: 'workshop', cat: 'support', name: 'Repair Workshop', short: 'Workshop', desc: 'Pioneers patch up damaged emplacements in range, even under fire.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0x6a9ad0, turret: 'w_workshop', aim: 'static', targeted: false,
    levels: [{ cost: 70, damage: 0, range: 110, rate: 0, buff: 0.03, hp: 660, fort: 12 }],
  }),

  RT({
    kind: 'barracks', slot: 'barracks', role: 'barracks', cat: 'units', name: 'Barracks', short: 'Barracks', desc: 'Trains infantry squads, pioneers and medics to fight outside the emplacements.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0x8a9a6a, turret: 'w_barracks', aim: 'static', targeted: false, single: true,
    levels: [{ cost: 80, damage: 0, range: 0, rate: 0, hp: 900, fort: 15 }],
  }),
  RT({
    kind: 'motorpool', slot: 'motorpool', role: 'motorpool', cat: 'units', name: 'Motor Pool', short: 'Motor Pool', desc: 'Builds Panzer IVs, Panthers and Tigers that chase the enemy across the field.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0x9a8c60, turret: 'w_motorpool', aim: 'static', targeted: false, single: true,
    levels: [{ cost: 150, damage: 0, range: 0, rate: 0, hp: 1200, fort: 20 }],
  }),
  RT({
    kind: 'airfield', slot: 'airfield', role: 'airfield', cat: 'units', name: 'Fighter Airfield', short: 'Airfield', desc: 'Send (R) a pair of Fw 190s to patrol a point: they shoot down aircraft and strafe soft targets.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0x9aa0a0, turret: 'w_airfield', aim: 'static', targeted: false, manual: true, sfx: '',
    levels: [{ cost: 180, damage: 0, range: 0, rate: 0, charge: 45, hp: 900, fort: 10 }],
  }),

  // ---- obstacles
  RT({
    kind: 'teeth', slot: 'teeth', role: 'barricade', cat: 'maze', name: "Dragon's Teeth", short: 'Teeth', desc: 'Concrete obstacles: a cheap 1×1 wall against vehicles. Infantry climb over, slowly.',
    size: 1, hitsGround: false, hitsAir: false, airMult: 0, color: 0xb0aca0, turret: null, aim: 'static', targeted: false, single: true,
    levels: [{ cost: 4, damage: 0, range: 0, rate: 0 }],
  }),
  RT({
    kind: 'wire', slot: 'wire', role: 'wire', cat: 'maze', name: 'Barbed Wire', short: 'Wire', desc: 'Goes on the path. Infantry get tangled and crawl; vehicles drive through.',
    walkable: true, hitsGround: false, hitsAir: false, airMult: 0, color: 0x8a8070, turret: null, aim: 'static', targeted: false, decal: 'd_wire',
    levels: [{ cost: 10, damage: 0, range: 0, rate: 0, slow: 0.4 }],
  }),
  RT({
    kind: 'teller', slot: 'atmine', role: 'mine', cat: 'maze', name: 'Teller Mines', short: 'AT Mine', desc: 'Anti-tank mines on the path: only vehicles set them off.',
    size: 1, walkable: true, hitsGround: true, hitsAir: false, airMult: 0, color: 0x8a7a40, turret: null, aim: 'static', targeted: false, decal: 'd_teller', trigger: 'vehicle',
    levels: [{ cost: 25, damage: 160, range: 12, rate: 0.15, splash: 18, pen: 60 }],
  }),
  RT({
    kind: 'smine', slot: 'apmine', role: 'mine', cat: 'maze', name: 'S-Mines', short: 'S-Mine', desc: 'Bounding anti-personnel mines: they leap up and burst among infantry.',
    size: 1, walkable: true, hitsGround: true, hitsAir: false, airMult: 0, color: 0x6a6a50, turret: null, aim: 'static', targeted: false, decal: 'd_smine', trigger: 'infantry',
    levels: [{ cost: 12, damage: 45, range: 12, rate: 0.3, splash: 34, pen: 0, supp: 0.5 }],
  }),
  RT({
    kind: 'roadblock', slot: 'roadblock', role: 'gate', cat: 'maze', name: 'Roadblock', short: 'Roadblock', desc: 'A barrier you can open and close (G) to reroute an attack mid-fight.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0xd0a040, turret: null, aim: 'static', targeted: false, single: true,
    levels: [{ cost: 30, damage: 0, range: 0, rate: 0 }],
  }),

  // ---- Luftwaffe
  RT({
    kind: 'stuka', slot: 'strike', role: 'stuka', cat: 'super', name: 'Stuka Airfield', short: 'Stuka', desc: 'Call in (R) three Ju 87s: dive-bombing that breaks tank columns.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xe0c040, turret: 'w_stuka', aim: 'static', targeted: false, manual: true, sfx: 'stuka',
    levels: [{ cost: 220, damage: 380, range: 0, rate: 0, splash: 48, charge: 40, pen: 70, hp: 1260, fort: 10 }],
  }),
  RT({
    kind: 'v2', slot: 'super', role: 'nuke', cat: 'super', name: 'V-2 Launch Site', short: 'V-2', desc: 'Vergeltungswaffe 2: a ballistic missile (R) on any point. It falls faster than sound — no warning.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xe8e6dc, turret: 'w_v2', aim: 'static', targeted: false, manual: true, sfx: 'v2',
    levels: [{ cost: 420, damage: 1100, range: 0, rate: 0, splash: 120, charge: 110, pen: 120, hp: 1080, fort: 30 }],
  }),
]);

// ---------------------------------------------------------------- units

export const GERMAN_UNITS: UnitDef[] = [
  { kind: 'grenadier', name: 'Grenadier Squad', short: 'Grenadiers', tex: 'de_rifle', from: 'barracks', cost: 35, manpower: 1, train: 6, hp: 140, speed: 42, radius: 6, inf: true,
    gun: armsUnit('kar98k', 'mosin'), desc: 'Riflemen: cheap, steady fire, and a body between the enemy and your guns.' },
  { kind: 'mgteam', name: 'MG-42 Team', short: 'MG Team', tex: 'de_mg', from: 'barracks', cost: 50, manpower: 1, train: 8, hp: 110, speed: 38, radius: 6, inf: true,
    gun: armsUnit('mg42', 'mg42', { still: true }), desc: 'A light machine gun that sets up wherever you need it. Must stop to fire.' },
  { kind: 'atteam', name: 'Panzerschreck Team', short: 'AT Team', tex: 'de_schreck', from: 'barracks', cost: 60, manpower: 1, train: 9, hp: 100, speed: 40, radius: 6, inf: true, camo: true,
    gun: armsUnit('schreck', 'schreck'), desc: 'Tank hunters. Put them in Ambush where tanks pass close: hidden until they fire.' },
  { kind: 'sniperu', name: 'Sniper', short: 'Sniper', tex: 'de_sniper', from: 'barracks', cost: 55, manpower: 1, train: 9, hp: 70, speed: 40, radius: 6, inf: true, camo: true,
    gun: armsUnit('sniper', 'sniper'), desc: 'Camouflaged marksman: the enemy only sees it when it fires.' },
  { kind: 'pioneer', name: 'Pioneers', short: 'Pioneers', tex: 'de_pioneer', from: 'barracks', cost: 45, manpower: 1, train: 8, hp: 120, speed: 44, radius: 6, inf: true, repair: 40,
    gun: armsUnit('kar98k', 'mosin'), desc: 'Combat engineers: repair damaged emplacements and raise rubble back up, free of charge.' },
  { kind: 'medic', name: 'Sanitäter', short: 'Medic', tex: 'de_medic', from: 'barracks', cost: 40, manpower: 1, train: 7, hp: 90, speed: 46, radius: 6, inf: true, heal: 12,
    desc: 'Patches up soldiers and the commander nearby.' },
  { kind: 'pz4', name: 'Panzer IV Ausf. H', short: 'Panzer IV', tex: 'de_pz4', from: 'motorpool', cost: 200, manpower: 2, train: 15, hp: 660, speed: 46, radius: 12, arm: [80, 30, 20, 15],
    gun: armsUnit('kwk40', 'pak40', { still: true, splash: 12 }), desc: 'The workhorse: the long 75 mm kills T-34s; its sides are thin.' },
  { kind: 'panther', name: 'Panther Ausf. G', short: 'Panther', tex: 'de_panther', from: 'motorpool', cost: 320, manpower: 2, train: 20, hp: 840, speed: 50, radius: 14, arm: [110, 45, 40, 16],
    gun: armsUnit('kwk42', 'pak40', { still: true, splash: 12 }), desc: 'Sloped 80 mm front, a high-velocity gun that goes through almost anything. Keep its front to the enemy.' },
  { kind: 'tigeru', name: 'Tiger I', short: 'Tiger', tex: 'de_tiger', from: 'motorpool', cost: 420, manpower: 3, train: 25, hp: 1120, speed: 32, radius: 14, arm: [100, 80, 80, 25],
    gun: armsUnit('kwk36', 'tiger', { still: true, splash: 16 }), desc: 'Thick armour all round and the 8.8 cm gun: slow, and worth three lives of any column.' },
  { kind: 'fw190', name: 'Fw 190 A', short: 'Fw 190', tex: 'de_fw190', from: 'airfield', cost: 0, manpower: 0, train: 0, hp: 280, speed: 190, radius: 12, air: true,
    gun: armsUnit('fighter', 'flak38', { hitsAir: true }), desc: 'Fighters on patrol: they hunt aircraft first, then strafe soft targets.' },
];

const HELP: Record<string, string> = {
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
  lefh18: 'The 10.5 cm field howitzer: huge range and a big blast, firing at anything your positions, soldiers, scouts or observation posts can see (an observation post sees much further and speeds it up; shelling their base needs one in sight of it). Its shells can break a tank\'s track, and go through light armour from above.',
  nebel: 'Six rockets per salvo, howling as they come down, scattered over the target area. Devastating against infantry columns; slow to reload.',
  depot: 'Guns never run out of ammunition; the depot is your war chest. Each one adds 2 manpower for training units. Produces no damage. At every new wave it pays a fixed income plus interest on the money you are holding (up to a cap).',
  observer: 'An observation post with a scissors periscope. It sees far beyond any gun, and artillery fires at all of it (faster with a post nearby); Soviet snipers inside it are revealed, and guns nearby get extra range.',
  hq: 'A field headquarters with officers and radios: every emplacement in range fires faster.',
  teeth: 'Concrete dragon\'s teeth: a cheap 1×1 obstacle that blocks every vehicle. Shape the maze with it so tanks have to turn in front of your guns. Infantry can clamber over (at a third of their speed), so foot soldiers may take a short cut through a line of teeth — cover it with an MG.',
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

export const GERMANY: Arsenal = {
  towers: GERMAN,
  units: GERMAN_UNITS,
  combos: [
    { a: 'mg42', b: 'wire', name: 'Kill Zone', desc: '+30% fire rate', rate: 1.3 },
    { a: 'pak40', b: 'pak40', name: 'Pakfront', desc: '+20% fire rate', rate: 1.2 },
    { a: 'lefh18', b: 'observer', name: 'Fire Mission', desc: '+30% fire rate', rate: 1.3 },
    { a: 'sniper', b: 'observer', name: 'Spotter', desc: '+40% damage', dmg: 1.4 },
    { a: 'flak88', b: 'flak38', name: 'Flak Battery', desc: '+30% vs air', air: 1.3 },
    { a: 'bunker', b: 'teeth', name: 'Fortified', desc: '+25% damage', dmg: 1.25 },
  ],
  ranks: ['Schütze', 'Gefreiter', 'Obergefreiter', 'Unteroffizier', 'Feldwebel', 'Leutnant', 'Hauptmann', 'Major', 'Oberst', 'General'],
  superName: 'Luftwaffe & V-weapons',
  look: { base: 'wbase', hero: 'w_officer', nuke: 'v2shell' },
  help: HELP,
};

// ---------------------------------------------------------------- the German army attacking
//
// Doctrine: fewer men and tanks than the Red Army, but better ones — the Panther and the Tiger
// outrange and outlast most of what faces them.

const WEHRMACHT: EnemyDef[] = [
  { name: 'Grenadier Squad', hp: 34, speed: 42, reward: 2, armor: 0, air: false, radius: 6, lives: 1, tex: 'de_rifle', bio: 2, inf: true,
    gun: armsGun('kar98k', 'rifle') },
  { name: 'Sturmgrenadiere', hp: 44, speed: 52, reward: 3, armor: 0, air: false, radius: 6, lives: 1, tex: 'de_assault', bio: 2, inf: true,
    gun: armsGun('mp40', 'smg') },
  { name: 'Scharfschütze', hp: 26, speed: 46, reward: 4, armor: 0, air: false, radius: 6, lives: 1, tex: 'de_sniper', bio: 2, inf: true, stealth: true, spot: 150,
    gun: armsGun('sniper', 'rifle') },
  { name: 'Sanitäter', hp: 40, speed: 44, reward: 5, armor: 0, air: false, radius: 6, lives: 1, tex: 'de_medic', bio: 2, inf: true, heal: 0.08 },
  { name: 'Kübelwagen', hp: 50, speed: 95, reward: 3, armor: 0, air: false, radius: 8, lives: 1, tex: 'de_kubel', bio: 1, spot: 220 },
  { name: 'SdKfz 251 Half-track', hp: 95, speed: 68, reward: 5, armor: 0, air: false, radius: 10, lives: 1, tex: 'de_251', bio: 0.6, arm: [14, 8, 8, 6], spot: 180,
    gun: armsGun('mg34', 'mg') },
  { name: 'Panzer III', smoke: true, hp: 140, speed: 48, reward: 6, armor: 0, air: false, radius: 11, lives: 1, tex: 'de_pz3', bio: 0.4, arm: [50, 30, 30, 12],
    gun: armsGun('kwk39', 'tank', { supp: 0.2, halt: 0.5 }) },
  { name: 'Panzer IV', smoke: true, hp: 200, speed: 42, reward: 8, armor: 0, air: false, radius: 12, lives: 2, tex: 'de_pz4', bio: 0.35, arm: [80, 30, 20, 15],
    gun: armsGun('kwk40', 'tank', { supp: 0.3, halt: 0.6, splash: 14 }) },
  { name: 'Panther', smoke: true, hp: 260, speed: 46, reward: 11, armor: 0, air: false, radius: 14, lives: 2, tex: 'de_panther', bio: 0.35, arm: [110, 45, 40, 16],
    gun: armsGun('kwk42', 'tank', { supp: 0.3, halt: 0.6, splash: 14 }) },
  { name: 'Tiger I', smoke: true, hp: 360, speed: 28, reward: 15, armor: 0, air: false, radius: 14, lives: 3, tex: 'de_tiger', bio: 0.3, arm: [100, 80, 80, 25],
    gun: armsGun('kwk36', 'tank', { supp: 0.35, halt: 0.7, splash: 18 }) },
  { name: 'King Tiger', smoke: true, hp: 2100, speed: 22, reward: 85, armor: 0, air: false, radius: 18, lives: 4, tex: 'de_kingtiger', bio: 0.25, arm: [180, 80, 80, 40], boss: true,
    gun: armsGun('kwk43', 'tank', { supp: 0.6, halt: 0.9, splash: 30 }) },
  { name: 'Ju 87 Stuka', hp: 90, speed: 74, reward: 6, armor: 0, air: true, radius: 13, lives: 1, tex: 'de_ju87', bio: 0, arm: [10, 10, 8, 8],
    gun: armsGun('divebomb', 'rocket') },
  { name: 'Bf 109', hp: 65, speed: 115, reward: 4, armor: 0, air: true, radius: 12, lives: 1, tex: 'de_bf109', bio: 0,
    gun: armsGun('fighter', 'mg', { air: true }) },
  { name: 'Panzerwerfer 42', hp: 110, speed: 52, reward: 9, armor: 0, air: false, radius: 11, lives: 1, tex: 'de_pzwerfer', bio: 0.8, arm: [10, 8, 8, 6],
    gun: armsGun('nebel41', 'katyusha', { halt: 1.2, salvo: 10 }) },
  { name: 'Pioniere', hp: 45, speed: 46, reward: 5, armor: 0, air: false, radius: 6, lives: 1, tex: 'de_pioneer', bio: 2, inf: true,
    gun: armsGun('satchel', 'satchel') },
  { name: 'Leutnant', hp: 40, speed: 44, reward: 8, armor: 0, air: false, radius: 6, lives: 1, tex: 'de_officer', bio: 2, inf: true, officer: true, spot: 160,
    gun: armsGun('pistol', 'smg') },
];

const WEHRMACHT_HELP: UnitHelp[] = [
  { text: 'Grenadiers with Kar98k rifles and an MG 34: their fire pins your crews.', counter: 'Machine guns, mortars, AP mines; wire slows them under your guns.' },
  { text: 'Assault grenadiers with MP 40s: fast and deadly up close.', counter: 'Machine guns and flamethrowers; suppression slows them down.' },
  { text: 'A camouflaged sniper: invisible unless spotted, and it hunts your commander.', counter: 'Observation posts reveal snipers; any emplacement spots one point-blank.' },
  { text: 'A medic who patches up everyone around.', counter: 'Kill medics first (Strong targeting).' },
  { text: 'A Kübelwagen with scouts: they spot hidden guns from far away.', counter: 'Anything kills it. Keep it away from your camouflaged positions.' },
  { text: 'An armoured half-track with an MG 42; its crew spots hidden guns from afar.', counter: 'Light anti-aircraft guns and anything heavier; rifle bullets bounce off.' },
  { text: 'The Panzer III: 50 mm of front armour and a 50 mm gun.', counter: 'Any anti-tank gun; anti-tank rifles through the sides.' },
  { text: 'The Panzer IV: 80 mm at the front but thin sides, and a long 75 mm gun.', counter: 'Anti-tank guns into the sides; the front takes a 90+ mm gun.' },
  { text: 'The Panther: a sloped 110 mm front that stops most guns, and a gun that goes through almost anything. Weak 45 mm sides.', counter: 'Shoot its sides at the turns of your maze; mines and air strikes.' },
  { text: 'The Tiger I: 100 mm in front and 80 on the sides, and the 8.8 cm gun. Costs 3 lives.', counter: 'Only heavy guns (85 mm and up) or flank shots at close range. Mines and bombs from above.' },
  { text: 'A boss: the King Tiger, with 180 mm of sloped front armour and the long 8.8 cm. Costs 4 lives.', counter: 'Nothing goes through the front: its 80 mm sides at short range, mines, and bombs on its top.' },
  { text: 'The Ju 87 Stuka dive bomber: it drops a bomb on one of your positions. Armoured underneath.', counter: 'Light flak and heavy anti-aircraft guns.' },
  { text: 'A Bf 109 fighter: it goes after your aircraft.', counter: 'Anti-aircraft guns and machine guns.' },
  { text: 'The Panzerwerfer: ten rockets per salvo from long range, howling down on your positions.', counter: 'A lightly armoured half-track: long-range guns or artillery with an observer.' },
  { text: 'Pioneers with satchel charges: they blow the weakest wall of a long maze, lift mines and cut wire.', counter: 'Machine guns and AP mines before they reach the wall.' },
  { text: 'A platoon leader with his map case and pistol, leading the infantry of the wave. While he lives his men press on; if he falls, the wave loses heart and more of it breaks and falls back.', counter: 'Snipers pick officers off first; anything that reaches him early in the wave.' },
];

export const WEHRMACHT_ARMY: Army = {
  enemies: WEHRMACHT,
  roster: {
    rifle: 0, assault: 1, sniper: 2, medic: 3, recon: 4, armcar: 5, light: 6, medium: 7, medium2: 8, heavy: 9, boss: 10,
    attack: 11, fighter: 12, rockets: 13, sapper: 14, officer: 15,
  },
  doctrine: { inf: 0.85, armour: 0.85 },
  help: WEHRMACHT_HELP,
};
