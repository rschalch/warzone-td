// Germany: the emplacements and units of the Wehrmacht and the Luftwaffe as the defender, and its
// army as the attacker (see ww2_kit.ts for the slots and the wave builder).
//
// Penetration (`pen`, mm) and armour (`arm`, mm: front, side, rear, top) follow real figures
// loosely, keeping their order: an MG-42 can't scratch a T-34 from any side, a PaK 40 kills it
// from the flank and struggles against a KV-1's front.

import { RT, growAll, type TowerDef, type UnitDef } from './defs';
import type { Arsenal } from './ww2_kit';

// ---------------------------------------------------------------- emplacements (in slot order)

export const GERMAN: TowerDef[] = growAll([
  // ---- infantry weapons
  RT({
    kind: 'mg42', slot: 'mg', role: 'gun', cat: 'basic', name: 'MG-42 Nest', short: 'MG-42', desc: '1,200 rounds a minute: shreds and pins infantry. Bounces off armour.',
    hitsGround: true, hitsAir: true, airMult: 0.6, color: 0xc9b26a, turret: 'w_mg42', sfx: 'mg42',
    camo: 0.3,
    levels: [{ cost: 15, damage: 3.2, range: 100, rate: 10, pen: 8, supp: 0.07, hp: 170, fort: 15 }],
  }),
  RT({
    kind: 'flak38', slot: 'lightaa', role: 'gun', cat: 'basic', name: '2 cm Flak 38', short: 'Flak 38', desc: 'Light autocannon: deadly to aircraft, light vehicles and infantry.',
    hitsGround: true, hitsAir: true, airMult: 2.2, color: 0x9aa070, turret: 'w_flak38', sfx: 'flak38',
    levels: [{ cost: 35, damage: 9, range: 165, rate: 3.5, pen: 30, supp: 0.04, hp: 150, fort: 10 }],
  }),
  RT({
    kind: 'schreck', slot: 'at', role: 'at', cat: 'basic', name: 'Panzerschreck Team', short: 'Schreck', desc: 'Rocket launcher team. Very short range, goes through any tank.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x8a7a50, turret: 'w_schreck', sfx: 'schreck',
    camo: 0.7,
    levels: [{ cost: 30, damage: 85, range: 70, rate: 0.3, pen: 170, hp: 100, fort: 12 }],
  }),
  RT({
    kind: 'sniper', slot: 'sniper', role: 'sniper', cat: 'basic', name: 'Scharfschütze', short: 'Sniper', desc: 'Kills a soldier per shot from far away. Useless against armour.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x6a7a4a, turret: 'w_sniper', sfx: 'sniper',
    camo: 0.85,
    levels: [{ cost: 45, damage: 60, range: 280, rate: 0.4, pen: 10, hp: 80, fort: 12 }],
  }),
  RT({
    kind: 'flamer', slot: 'flamer', role: 'flame', cat: 'basic', name: 'Flammenwerfer', short: 'Flamer', desc: 'Burns infantry and soft vehicles at point-blank range. Tanks are sealed.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xff7a1a, turret: 'w_flamer', sfx: 'flame',
    camo: 0.5,
    levels: [{ cost: 40, damage: 22, range: 60, rate: 0, burn: 9, pen: 12, hp: 110, fort: 12 }],
  }),

  // ---- anti-tank guns
  RT({
    kind: 'pak40', slot: 'atgun', role: 'at', cat: 'precision', name: '7.5 cm PaK 40', short: 'PaK 40', desc: 'Anti-tank gun: slow, decisive shots. Kills T-34s from the side.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x7a8a5a, turret: 'w_pak40', sfx: 'pak40',
    camo: 0.6,
    levels: [{ cost: 55, damage: 75, range: 170, rate: 0.45, pen: 115, hp: 210, fort: 22 }],
  }),
  RT({
    kind: 'flak88', slot: 'heavyaa', role: 'at', cat: 'precision', name: '8.8 cm Flak 36', short: 'Flak 88', desc: 'The "Eighty-Eight": long range, kills tanks and bombers alike.',
    hitsGround: true, hitsAir: true, airMult: 1, color: 0xa8a890, turret: 'w_flak88', sfx: 'flak88',
    levels: [{ cost: 120, damage: 120, range: 240, rate: 0.3, pen: 135, splash: 30, hp: 270, fort: 15 }],
  }),
  RT({
    kind: 'tiger', slot: 'tank', role: 'at', cat: 'precision', name: 'Tiger I (dug in)', short: 'Tiger', desc: 'A hull-down Tiger: the 8.8 cm KwK 36 outranges every Soviet tank.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x9a8c60, turret: 'w_tiger', sfx: 'tiger',
    camo: 0.4,
    levels: [{ cost: 200, damage: 130, range: 210, rate: 0.28, pen: 140, hp: 730, fort: 100 }],
  }),
  RT({
    kind: 'bunker', slot: 'bunker', role: 'bunker', cat: 'precision', name: 'MG Bunker', short: 'Bunker', desc: 'Concrete pillbox with two MGs firing at two targets at once.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x8a8a7a, turret: 'w_bunker', sfx: 'mg42',
    camo: 0.3,
    levels: [{ cost: 45, damage: 3.5, range: 75, rate: 8, pen: 8, supp: 0.05, hp: 590, fort: 80 }],
  }),

  // ---- artillery
  RT({
    kind: 'mortar', slot: 'mortar', role: 'cannon', cat: 'fire', name: '8 cm Mortar', short: 'Mortar', desc: 'High-explosive bombs on infantry groups. Pins them down.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xa08a5a, turret: 'w_mortar', sfx: 'mortar',
    camo: 0.5,
    levels: [{ cost: 40, damage: 26, range: 180, rate: 0.5, splash: 38, pen: 12, supp: 0.25, hp: 130, fort: 12 }],
  }),
  RT({
    kind: 'lefh18', slot: 'howitzer', role: 'arty', cat: 'fire', name: '10.5 cm leFH 18', short: 'Howitzer', desc: 'Huge range and blast, but it needs an observation post to spot for it.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0x7a6a4a, turret: 'w_lefh18', sfx: 'arty',
    levels: [{ cost: 110, damage: 150, range: 480, rate: 0.18, splash: 58, pen: 28, supp: 0.5, hp: 210, fort: 12 }],
  }),
  RT({
    kind: 'nebel', slot: 'rockets', role: 'cannon', cat: 'fire', name: 'Nebelwerfer 41', short: 'Nebelwerfer', desc: 'Six screaming rockets per salvo, scattered over the target area.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xb05a3a, turret: 'w_nebel', sfx: 'nebel',
    levels: [{ cost: 130, damage: 45, range: 300, rate: 0.1, splash: 36, pen: 18, supp: 0.4, salvo: 6, hp: 140, fort: 8 }],
  }),

  // ---- support
  RT({
    kind: 'depot', slot: 'depot', role: 'depot', cat: 'support', name: 'Supply Depot', short: 'Depot', desc: 'Pays out at every wave, plus interest on the money you keep.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0xd0b050, turret: 'w_depot', aim: 'static', targeted: false,
    levels: [{ cost: 80, damage: 0, range: 0, rate: 0, income: 12, interest: 0.02, cap: 40, hp: 310, fort: 10 }],
  }),
  RT({
    kind: 'observer', slot: 'observer', role: 'radar', cat: 'support', name: 'Observation Post', short: 'Observer', desc: 'Spots for artillery, reveals snipers and extends the range of guns nearby.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0x50c0a0, turret: 'w_observer', aim: 'spin', targeted: false,
    levels: [{ cost: 55, damage: 0, range: 170, rate: 0, buff: 0.1, hp: 110, fort: 12 }],
  }),
  RT({
    kind: 'hq', slot: 'hq', role: 'command', cat: 'support', name: 'Field HQ', short: 'HQ', desc: 'Officers and radios: emplacements in range fire faster.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0xc04a3a, turret: 'w_hq', aim: 'static', targeted: false,
    levels: [{ cost: 90, damage: 0, range: 100, rate: 0, buff: 0.15, hp: 340, fort: 30 }],
  }),
  RT({
    kind: 'workshop', slot: 'workshop', role: 'workshop', cat: 'support', name: 'Repair Workshop', short: 'Workshop', desc: 'Pioneers patch up damaged emplacements in range, even under fire.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0x6a9ad0, turret: 'w_workshop', aim: 'static', targeted: false,
    levels: [{ cost: 70, damage: 0, range: 110, rate: 0, buff: 0.03, hp: 220, fort: 12 }],
  }),

  RT({
    kind: 'barracks', slot: 'barracks', role: 'barracks', cat: 'units', name: 'Barracks', short: 'Barracks', desc: 'Trains infantry squads, pioneers and medics to fight outside the emplacements.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0x8a9a6a, turret: 'w_barracks', aim: 'static', targeted: false, single: true,
    levels: [{ cost: 80, damage: 0, range: 0, rate: 0, hp: 300, fort: 15 }],
  }),
  RT({
    kind: 'motorpool', slot: 'motorpool', role: 'motorpool', cat: 'units', name: 'Motor Pool', short: 'Motor Pool', desc: 'Builds Panzer IVs, Panthers and Tigers that chase the enemy across the field.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0x9a8c60, turret: 'w_motorpool', aim: 'static', targeted: false, single: true,
    levels: [{ cost: 150, damage: 0, range: 0, rate: 0, hp: 400, fort: 20 }],
  }),
  RT({
    kind: 'airfield', slot: 'airfield', role: 'airfield', cat: 'units', name: 'Fighter Airfield', short: 'Airfield', desc: 'Send (R) a pair of Fw 190s to patrol a point: they shoot down aircraft and strafe soft targets.',
    hitsGround: false, hitsAir: false, airMult: 0, color: 0x9aa0a0, turret: 'w_airfield', aim: 'static', targeted: false, manual: true, sfx: '',
    levels: [{ cost: 180, damage: 0, range: 0, rate: 0, charge: 45, hp: 300, fort: 10 }],
  }),

  // ---- obstacles
  RT({
    kind: 'teeth', slot: 'teeth', role: 'barricade', cat: 'maze', name: "Dragon's Teeth", short: 'Teeth', desc: 'Concrete obstacles: a cheap 1×1 wall for shaping the maze.',
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
    levels: [{ cost: 220, damage: 380, range: 0, rate: 0, splash: 48, charge: 40, pen: 70, hp: 420, fort: 10 }],
  }),
  RT({
    kind: 'v2', slot: 'super', role: 'nuke', cat: 'super', name: 'V-2 Launch Site', short: 'V-2', desc: 'Vergeltungswaffe 2: a ballistic missile (R) on any point. It falls faster than sound — no warning.',
    hitsGround: true, hitsAir: false, airMult: 0, color: 0xe8e6dc, turret: 'w_v2', aim: 'static', targeted: false, manual: true, sfx: 'v2',
    levels: [{ cost: 420, damage: 1100, range: 0, rate: 0, splash: 120, charge: 110, pen: 120, hp: 360, fort: 30 }],
  }),
]);

// ---------------------------------------------------------------- units

export const GERMAN_UNITS: UnitDef[] = [
  { kind: 'grenadier', name: 'Grenadier Squad', short: 'Grenadiers', tex: 'de_rifle', from: 'barracks', cost: 35, manpower: 1, train: 6, hp: 70, speed: 42, radius: 6, inf: true,
    gun: { dmg: 5, range: 110, rate: 1.4, pen: 8, supp: 0.03, sfx: 'mosin' }, desc: 'Riflemen: cheap, steady fire, and a body between the enemy and your guns.' },
  { kind: 'mgteam', name: 'MG-42 Team', short: 'MG Team', tex: 'de_mg', from: 'barracks', cost: 50, manpower: 1, train: 8, hp: 55, speed: 38, radius: 6, inf: true,
    gun: { dmg: 3, range: 125, rate: 9, pen: 8, supp: 0.07, still: true, sfx: 'mg42' }, desc: 'A light machine gun that sets up wherever you need it. Must stop to fire.' },
  { kind: 'atteam', name: 'Panzerschreck Team', short: 'AT Team', tex: 'de_schreck', from: 'barracks', cost: 60, manpower: 1, train: 9, hp: 50, speed: 40, radius: 6, inf: true, camo: true,
    gun: { dmg: 85, range: 75, rate: 0.3, pen: 170, sfx: 'schreck' }, desc: 'Tank hunters. Put them in Ambush where tanks pass close: hidden until they fire.' },
  { kind: 'sniperu', name: 'Sniper', short: 'Sniper', tex: 'de_sniper', from: 'barracks', cost: 55, manpower: 1, train: 9, hp: 35, speed: 40, radius: 6, inf: true, camo: true,
    gun: { dmg: 60, range: 270, rate: 0.4, pen: 10, sfx: 'sniper' }, desc: 'Camouflaged marksman: the enemy only sees it when it fires.' },
  { kind: 'pioneer', name: 'Pioneers', short: 'Pioneers', tex: 'de_pioneer', from: 'barracks', cost: 45, manpower: 1, train: 8, hp: 60, speed: 44, radius: 6, inf: true, repair: 14,
    gun: { dmg: 4, range: 90, rate: 1, pen: 8, sfx: 'mosin' }, desc: 'Combat engineers: repair damaged emplacements and raise rubble back up, free of charge.' },
  { kind: 'medic', name: 'Sanitäter', short: 'Medic', tex: 'de_medic', from: 'barracks', cost: 40, manpower: 1, train: 7, hp: 45, speed: 46, radius: 6, inf: true, heal: 6,
    desc: 'Patches up soldiers and the commander nearby.' },
  { kind: 'pz4', name: 'Panzer IV Ausf. H', short: 'Panzer IV', tex: 'de_pz4', from: 'motorpool', cost: 200, manpower: 2, train: 15, hp: 330, speed: 46, radius: 12, arm: [80, 30, 20, 15],
    gun: { dmg: 75, range: 190, rate: 0.32, pen: 105, splash: 12, still: true, sfx: 'pak40' }, desc: 'The workhorse: the long 75 mm kills T-34s; its sides are thin.' },
  { kind: 'panther', name: 'Panther Ausf. G', short: 'Panther', tex: 'de_panther', from: 'motorpool', cost: 320, manpower: 2, train: 20, hp: 420, speed: 50, radius: 14, arm: [110, 45, 40, 16],
    gun: { dmg: 90, range: 220, rate: 0.3, pen: 150, splash: 12, still: true, sfx: 'pak40' }, desc: 'Sloped 80 mm front, a high-velocity gun that goes through almost anything. Keep its front to the enemy.' },
  { kind: 'tigeru', name: 'Tiger I', short: 'Tiger', tex: 'de_tiger', from: 'motorpool', cost: 420, manpower: 3, train: 25, hp: 560, speed: 32, radius: 14, arm: [100, 80, 80, 25],
    gun: { dmg: 125, range: 210, rate: 0.24, pen: 140, splash: 16, still: true, sfx: 'tiger' }, desc: 'Thick armour all round and the 8.8 cm gun: slow, and worth three lives of any column.' },
  { kind: 'fw190', name: 'Fw 190 A', short: 'Fw 190', tex: 'de_fw190', from: 'airfield', cost: 0, manpower: 0, train: 0, hp: 140, speed: 190, radius: 12, air: true,
    gun: { dmg: 10, range: 110, rate: 5, pen: 20, hitsAir: true, sfx: 'flak38' }, desc: 'Fighters on patrol: they hunt aircraft first, then strafe soft targets.' },
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
