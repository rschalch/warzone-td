// The Soviet Union: the Red Army as the attacker, and as the defender (below).

import { growAll, type EnemyDef, type TowerDef, type UnitDef } from './defs';
import { GERMAN } from './ww2_de';
import { armsGun, armsUnit } from './ww2_arms';
import { derive, slotOf, type Arsenal, type Army, type UnitHelp } from './ww2_kit';

// ---------------------------------------------------------------- the Red Army attacking

export const SU_RIFLE = 0;
export const SU_SMG = 1;
export const SU_SNIPER = 2;
export const SU_MEDIC = 3;
export const SU_GAZ = 4;
export const SU_BA64 = 5;
export const SU_T70 = 6;
export const SU_T34 = 7;
export const SU_T3485 = 8;
export const SU_KV1 = 9;
export const SU_IS2 = 10;
export const SU_IL2 = 11;
export const SU_YAK = 12;
export const SU_KATYUSHA = 13;
export const SU_SAPPER = 14;
export const SU_OFFICER = 15;

export const SOVIET: EnemyDef[] = [
  { name: 'Rifle Squad', hp: 30, speed: 44, reward: 2, armor: 0, air: false, radius: 6, lives: 1, tex: 'su_rifle', bio: 2, inf: true, gun: armsGun('mosin', 'rifle') },
  { name: 'SMG Assault', hp: 40, speed: 54, reward: 3, armor: 0, air: false, radius: 6, lives: 1, tex: 'su_smg', bio: 2, inf: true, gun: armsGun('ppsh', 'smg') },
  { name: 'Sniper', hp: 26, speed: 46, reward: 4, armor: 0, air: false, radius: 6, lives: 1, tex: 'su_sniper', bio: 2, inf: true, stealth: true, spot: 150, gun: armsGun('sniper', 'rifle') },
  { name: 'Medic', hp: 40, speed: 44, reward: 5, armor: 0, air: false, radius: 6, lives: 1, tex: 'su_medic', bio: 2, inf: true, heal: 0.08 },
  { name: 'GAZ-67 Jeep', hp: 50, speed: 95, reward: 3, armor: 0, air: false, radius: 8, lives: 1, tex: 'su_gaz', bio: 1, spot: 220 },
  { name: 'BA-64 Armoured Car', hp: 70, speed: 80, reward: 4, armor: 0, air: false, radius: 9, lives: 1, tex: 'su_ba64', bio: 0.6, spot: 200, arm: [10, 7, 7, 6], gun: armsGun('dt', 'mg') },
  { name: 'T-70 Light Tank', hp: 120, speed: 50, reward: 6, armor: 0, air: false, radius: 11, lives: 1, tex: 'su_t70', bio: 0.4, arm: [45, 25, 25, 10], gun: armsGun('k20', 'tank', { supp: 0.2, halt: 0.5 }) },
  { name: 'T-34/76', hp: 190, speed: 42, reward: 8, armor: 0, air: false, radius: 13, lives: 2, tex: 'su_t34', bio: 0.35, arm: [90, 50, 40, 20], gun: armsGun('f34', 'tank', { supp: 0.3, halt: 0.6, splash: 16 }) },
  { name: 'T-34/85', smoke: true, hp: 230, speed: 42, reward: 10, armor: 0, air: false, radius: 13, lives: 2, tex: 'su_t3485', bio: 0.35, arm: [90, 60, 45, 20], gun: armsGun('zis53', 'tank', { supp: 0.3, halt: 0.6, splash: 18 }) },
  { name: 'KV-1 Heavy Tank', hp: 320, speed: 28, reward: 14, armor: 0, air: false, radius: 14, lives: 3, tex: 'su_kv1', bio: 0.3, arm: [110, 80, 70, 30], gun: armsGun('zis5', 'tank', { supp: 0.3, halt: 0.7, splash: 16 }) },
  { name: 'IS-2 Heavy Tank', smoke: true, hp: 2000, speed: 24, reward: 80, armor: 0, air: false, radius: 16, lives: 4, tex: 'su_is2', bio: 0.25, arm: [160, 90, 60, 30], boss: true, gun: armsGun('d25t', 'tank', { supp: 0.6, halt: 0.9, splash: 30 }) },
  { name: 'Il-2 Sturmovik', hp: 95, speed: 70, reward: 6, armor: 0, air: true, radius: 13, lives: 1, tex: 'su_il2', bio: 0, arm: [12, 12, 8, 8], gun: armsGun('attack', 'rocket') },
  { name: 'Yak-9 Fighter', hp: 60, speed: 110, reward: 4, armor: 0, air: true, radius: 12, lives: 1, tex: 'su_yak', bio: 0, gun: armsGun('fighter', 'mg', { air: true }) },
  { name: 'BM-13 Katyusha', hp: 90, speed: 58, reward: 9, armor: 0, air: false, radius: 11, lives: 1, tex: 'su_katyusha', bio: 1,
    gun: armsGun('bm13', 'katyusha', { halt: 1.2 }) },
  { name: 'Sapper Squad', hp: 45, speed: 46, reward: 5, armor: 0, air: false, radius: 6, lives: 1, tex: 'su_sapper', bio: 2, inf: true,
    gun: armsGun('satchel', 'satchel') },
  { name: 'Lieutenant', hp: 40, speed: 44, reward: 8, armor: 0, air: false, radius: 6, lives: 1, tex: 'su_officer', bio: 2, inf: true, officer: true, spot: 160,
    gun: armsGun('pistol', 'smg') },
];


const ARMY_HELP: UnitHelp[] = [
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
  { text: 'Assault engineers with satchel charges. When your maze makes the way round long, they go straight for the weakest wall and blow it up; on the way they lift mines and cut wire.', counter: 'MG-42s and S-mines before they reach the wall; deep mazes of strong, covered emplacements are not worth breaching.' },
  { text: 'A Red Army lieutenant leading the infantry of the wave, pistol in hand. While he lives his men press on; if he falls, the wave loses heart and more of it breaks and falls back.', counter: 'Snipers pick officers off first; anything that reaches him early in the wave.' },
];

export const RED_ARMY: Army = {
  enemies: SOVIET,
  roster: {
    rifle: SU_RIFLE, assault: SU_SMG, sniper: SU_SNIPER, medic: SU_MEDIC, sapper: SU_SAPPER,
    recon: SU_GAZ, armcar: SU_BA64, light: SU_T70, medium: SU_T34, medium2: SU_T3485, heavy: SU_KV1, boss: SU_IS2,
    attack: SU_IL2, fighter: SU_YAK, rockets: SU_KATYUSHA, officer: SU_OFFICER,
  },
  help: ARMY_HELP,
};

// ---------------------------------------------------------------- the Red Army defending
//
// Doctrine: cheap and numerous. Guns cost less, the infantry anti-tank weapon is the long PTRD
// rifle (no bazooka), mines and artillery are plentiful, the ZiS-3 is everywhere.

const G = (slot: Parameters<typeof slotOf>[1]) => slotOf(GERMAN, slot);
const cheap = (t: TowerDef, f = 0.85) => Math.round(t.levels[0].cost * f);

export const SOVIET_TOWERS: TowerDef[] = growAll([
  derive(G('mg'), { kind: 'maxim', name: 'Maxim M1910 Nest', short: 'Maxim', desc: 'Water-cooled, heavy and reliable: steady fire that pins infantry.', turret: 'su_w_mg', sfx: 'maxim', color: 0xa89d6a, weapon: 'maxim',
    lv: { cost: 12 } }),
  derive(G('lightaa'), { kind: '61k', name: '37 mm 61-K', short: '61-K', desc: 'Automatic anti-aircraft gun: tears up aircraft and light vehicles.', turret: 'su_w_aa', sfx: 'flak38', weapon: 'k61',
    lv: { cost: 32 } }),
  derive(G('at'), { kind: 'ptrd', name: 'PTRD-41 Team', short: 'PTRD', desc: 'A 14.5 mm anti-tank rifle: goes through light armour and the sides of light tanks.', turret: 'su_w_ptrd', sfx: 'ptrd', weapon: 'ptrd',
    lv: { cost: 18 } }),
  derive(G('sniper'), { kind: 'su_sniper', name: 'Snaiper', short: 'Sniper', desc: 'A Mosin-Nagant with a PU scope: one shot, one soldier.', turret: 'su_w_sniper' }),
  derive(G('flamer'), { kind: 'roks', name: 'ROKS-3 Flamethrower', short: 'Flamer', desc: 'Burns infantry and soft vehicles at point-blank range.', turret: 'su_w_flamer', lv: { cost: cheap(G('flamer')) } }),
  derive(G('atgun'), { kind: 'zis3', name: '76 mm ZiS-3', short: 'ZiS-3', desc: 'The divisional gun that did everything: cheap, accurate, kills tanks from the side.', turret: 'su_w_zis3', sfx: 'pak40', weapon: 'zis3',
    lv: { cost: 48 } }),
  derive(G('heavyaa'), { kind: '52k', name: '85 mm 52-K', short: '52-K', desc: 'Heavy anti-aircraft gun that the Red Army turned on tanks: long range, 120 mm.', turret: 'su_w_52k', sfx: 'flak88', weapon: 'k52',
    lv: { cost: 105 } }),
  derive(G('tank'), { kind: 'su_t34dug', name: 'T-34/85 (dug in)', short: 'T-34/85', desc: 'A T-34/85 hull-down in a revetment: the 85 mm gun and a sloped front.', turret: 'su_w_t34', sfx: 'f34', weapon: 'zis53',
    lv: { cost: 160, hp: 1920, fort: 90 } }),
  derive(G('bunker'), { kind: 'dot', name: 'DOT Pillbox', short: 'DOT', desc: 'A concrete firing point with two Maxims.', turret: 'su_w_dot', sfx: 'maxim', weapon: 'maxim', lv: { cost: cheap(G('bunker')), range: 80 } }),
  derive(G('mortar'), { kind: 'pm41', name: '82 mm PM-41 Mortar', short: 'Mortar', desc: 'Bombs on infantry groups; pins them down.', turret: 'su_w_mortar', weapon: 'pm41', lv: { cost: cheap(G('mortar')) } }),
  derive(G('howitzer'), { kind: 'm30', name: '122 mm M-30', short: 'M-30', desc: 'The Red Army\'s workhorse howitzer: a big blast at long range, at anything you can see.', turret: 'su_w_m30', weapon: 'm30',
    lv: { cost: 110 } }),
  derive(G('rockets'), { kind: 'bm13', name: 'BM-13 Katyusha Battery', short: 'Katyusha', desc: '"Stalin\'s organ": sixteen rockets per salvo, howling over the target area.', turret: 'su_katyusha', sfx: 'katyusha', weapon: 'bm13',
    lv: { cost: 145 } }),
  derive(G('depot'), { kind: 'su_depot', name: 'Supply Dump', short: 'Depot', desc: 'Pays out at every wave (income plus interest) and adds manpower for training units.', turret: 'su_w_depot' }),
  derive(G('observer'), { kind: 'su_observer', name: 'Observation Post', short: 'Observer', desc: 'Sees far (even at night), reveals snipers, speeds up artillery and extends the range of guns nearby.', turret: 'su_w_observer' }),
  derive(G('hq'), { kind: 'su_hq', name: 'Regimental HQ', short: 'HQ', desc: 'The commissar and the radio: emplacements in range fire faster.', turret: 'su_w_hq', lv: { cost: 80 } }),
  derive(G('workshop'), { kind: 'su_workshop', name: 'Repair Workshop', short: 'Workshop', desc: 'Engineers patch up damaged emplacements in range, even under fire.', turret: 'su_w_workshop' }),
  derive(G('barracks'), { kind: 'su_barracks', name: 'Barracks', short: 'Barracks', desc: 'Trains rifle squads, Maxim and PTRD teams, snipers, sappers and medics.', turret: 'su_w_barracks' }),
  derive(G('motorpool'), { kind: 'su_motorpool', name: 'Tank Park', short: 'Tank Park', desc: 'Builds T-34/85s, KV-1s and IS-2s.', turret: 'su_w_motorpool' }),
  derive(G('airfield'), { kind: 'su_airfield', name: 'Fighter Airfield', short: 'Airfield', desc: 'Send (R) a pair of Yak-9s to patrol a point.', turret: 'su_w_airfield' }),
  derive(G('teeth'), { kind: 'hedgehog', name: 'Czech Hedgehogs', short: 'Hedgehogs', desc: 'Welded steel rails: a cheap 1×1 wall against vehicles. Infantry climb over, slowly.', turret: null }),
  derive(G('wire'), { kind: 'su_wire', name: 'Barbed Wire', short: 'Wire', desc: 'Goes on the path. Infantry get tangled and crawl; vehicles drive through.' }),
  derive(G('atmine'), { kind: 'tm41', name: 'TM-41 Mines', short: 'AT Mine', desc: 'Anti-tank mines on the path: only vehicles set them off.', lv: { cost: 20 } }),
  derive(G('apmine'), { kind: 'pomz', name: 'POMZ-2 Mines', short: 'AP Mine', desc: 'Stake mines with tripwires: only infantry set them off.', lv: { cost: 9 } }),
  derive(G('roadblock'), { kind: 'su_roadblock', block: 'roadblock', name: 'Roadblock', short: 'Roadblock', desc: 'A barrier you can open and close (G) to reroute an attack mid-fight.' }),
  derive(G('strike'), { kind: 'il2strike', name: 'Il-2 Regiment', short: 'Il-2', desc: 'Call in (R) four Shturmoviks: rockets and bombs that break tank columns.', turret: 'su_w_il2field', sfx: 'rs82',
    lv: { cost: 200, damage: 300, salvo: 4, pen: 60 } }),
  derive(G('super'), { kind: 'b4', name: '203 mm B-4 Howitzer', short: 'B-4', desc: '"Stalin\'s sledgehammer": one enormous shell (R) on any point of the map.', turret: 'su_w_b4', sfx: 'arty',
    lv: { cost: 360, damage: 950, splash: 95, charge: 95, pen: 110 } }),
]);

const SOVIET_UNITS: UnitDef[] = [
  { kind: 'su_squad', name: 'Rifle Squad', short: 'Riflemen', tex: 'su_rifle', from: 'barracks', cost: 28, manpower: 1, train: 5, hp: 130, speed: 44, radius: 6, inf: true,
    gun: armsUnit('mosin', 'mosin'), desc: 'Riflemen with Mosin-Nagants: cheap, and many.' },
  { kind: 'su_maximteam', name: 'Maxim Team', short: 'Maxim', tex: 'su_mgteam', from: 'barracks', cost: 45, manpower: 1, train: 8, hp: 110, speed: 34, radius: 6, inf: true,
    gun: armsUnit('maxim', 'maxim', { still: true }), desc: 'A Maxim on wheels: it must stop and set up to fire.' },
  { kind: 'su_ptrdteam', name: 'PTRD Team', short: 'PTRD', tex: 'su_ptrdteam', from: 'barracks', cost: 40, manpower: 1, train: 8, hp: 100, speed: 40, radius: 6, inf: true, camo: true,
    gun: armsUnit('ptrd', 'ptrd', { still: true }), desc: 'Anti-tank riflemen: they go through light armour and tank sides. Best in Ambush.' },
  { kind: 'su_sniperu', name: 'Sniper', short: 'Sniper', tex: 'su_sniper', from: 'barracks', cost: 50, manpower: 1, train: 9, hp: 70, speed: 40, radius: 6, inf: true, camo: true,
    gun: armsUnit('sniper', 'sniper'), desc: 'A camouflaged marksman: the enemy only sees it when it fires.' },
  { kind: 'su_engineers', name: 'Sappers', short: 'Sappers', tex: 'su_sapper', from: 'barracks', cost: 40, manpower: 1, train: 8, hp: 120, speed: 46, radius: 6, inf: true, repair: 40,
    gun: armsUnit('ppsh', 'ppsh'), desc: 'Combat engineers: repair emplacements and raise rubble back up, paid at the price of a repair as they work.' },
  { kind: 'su_medicu', name: 'Sanitarka', short: 'Medic', tex: 'su_medic', from: 'barracks', cost: 35, manpower: 1, train: 7, hp: 90, speed: 46, radius: 6, inf: true, heal: 12,
    desc: 'Patches up soldiers and the commander nearby.' },
  { kind: 'su_t3485u', name: 'T-34/85', short: 'T-34/85', tex: 'su_t3485', from: 'motorpool', cost: 190, manpower: 2, train: 14, hp: 660, speed: 50, radius: 13, arm: [90, 60, 45, 20],
    gun: armsUnit('zis53', 'f34', { still: true, splash: 12 }), desc: 'Fast and well armoured at the front: the tank that won the war.' },
  { kind: 'su_kv1u', name: 'KV-1', short: 'KV-1', tex: 'su_kv1', from: 'motorpool', cost: 260, manpower: 2, train: 18, hp: 960, speed: 30, radius: 14, arm: [110, 80, 70, 30],
    gun: armsUnit('zis5', 'f34', { still: true, splash: 14 }), desc: 'A heavy tank with armour all round; its 76 mm gun struggles with Panthers and Tigers.' },
  { kind: 'su_is2u', name: 'IS-2', short: 'IS-2', tex: 'su_is2', from: 'motorpool', cost: 420, manpower: 3, train: 25, hp: 1200, speed: 34, radius: 16, arm: [160, 90, 60, 30],
    gun: armsUnit('d25t', 'tiger', { still: true }), desc: 'The 122 mm gun goes through a Tiger\'s front; it reloads very slowly.' },
  { kind: 'su_yaku', name: 'Yak-9', short: 'Yak-9', tex: 'su_yak', from: 'airfield', cost: 0, manpower: 0, train: 0, hp: 240, speed: 200, radius: 12, air: true,
    gun: armsUnit('fighter', 'flak38', { hitsAir: true }), desc: 'Fighters on patrol: they hunt aircraft first, then strafe soft targets.' },
];

const SOVIET_HELP: Record<string, string> = {
  maxim: 'The Maxim M1910 on its wheeled mount: slower than an MG-42 but tireless thanks to its water jacket. It cuts down and pins infantry; its bullets bounce off any armour.',
  '61k': 'A 37 mm automatic gun: the best answer to aircraft, and it goes through armoured cars and the sides of light tanks.',
  ptrd: 'Two men with a 2-metre single-shot anti-tank rifle. 40 mm of penetration: armoured cars, light tanks and the sides of a Panzer IV, nothing more. Cheap — hide them where light vehicles pass close.',
  su_sniper: 'A sniper with a Mosin-Nagant: one shot, one dead soldier, from very far away. Useless against armour. Next to an observation post +40% damage.',
  roks: 'Burns infantry and open vehicles at point-blank range; closed tanks are sealed against it.',
  zis3: 'The ZiS-3: cheap, quick to load, 95 mm of penetration — it kills Panzer IVs from the front and Panthers from the side. Two side by side form a Pakfront.',
  '52k': 'An 85 mm anti-aircraft gun: its 120 mm of penetration answers the Panther and the Tiger, and its shells burst among aircraft.',
  su_t34dug: 'A T-34/85 dug in hull-down. Only the turret shows; its 85 mm gun outranges the Panzer IV.',
  dot: 'A concrete pillbox with two Maxims, each firing at its own target. Short range: build it into the maze wall.',
  pm41: 'An 82 mm mortar: bombs that burst among infantry and pin them down.',
  m30: 'The 122 mm M-30 howitzer: a huge blast at long range, at anything your positions, soldiers or observation posts can see.',
  bm13: 'The Katyusha on a Studebaker truck: sixteen rockets per salvo, scattered over the target area with their famous howl. Devastating against infantry and soft vehicles.',
  su_depot: 'Guns never run out of ammunition; the depot is your war chest. Each one adds 2 manpower for training units. Produces no damage. At every wave it pays a fixed income plus interest on the money you are holding.',
  su_observer: 'An observation post: it sees far beyond any gun and artillery fires at all of it, enemy snipers inside it are revealed, guns nearby get extra range.',
  su_hq: 'A regimental headquarters: every emplacement in range fires faster.',
  su_workshop: 'Engineers with spare parts: they patch up every emplacement in range. Rebuilding rubble (B) costs money.',
  su_barracks: 'Trains infantry that fight outside the maze: riflemen, Maxim and PTRD teams, snipers, sappers (who repair emplacements, paid as a repair) and medics. Select a unit and click the ground to send it; give it a stance. Manpower: each HQ adds 4, each depot 2.',
  su_motorpool: 'Builds tanks: the T-34/85, the KV-1 and the IS-2. Tanks stop to fire and turn their front to the target.',
  su_airfield: 'A fighter strip. Press R and click a point: two Yak-9s patrol there for 25 s, shooting down aircraft first.',
  hedgehog: 'Czech hedgehogs: welded rails that no tank climbs. A cheap 1×1 obstacle; infantry clamber over at a third of their speed.',
  su_wire: 'Barbed wire on the path: infantry get tangled and crawl, vehicles drive over it.',
  tm41: 'Anti-tank mines: only a vehicle sets them off, and the blast tears through the belly armour.',
  pomz: 'Stake mines with tripwires: only infantry set them off.',
  su_roadblock: 'A barrier you can open and close (G) to switch the route mid-wave.',
  il2strike: 'An Il-2 regiment. When ready, press R and click: four Shturmoviks dive on the target with rockets and bombs that hit the thin top armour.',
  b4: 'The B-4 203 mm howitzer. When ready, press R and click anywhere: one 100 kg shell falls with a blast that wrecks even heavy tanks from above.',
};

export const SOVIET_DEFENCE: Arsenal = {
  towers: SOVIET_TOWERS,
  units: SOVIET_UNITS,
  combos: [
    { a: 'maxim', b: 'su_wire', name: 'Kill Zone', desc: '+30% fire rate', rate: 1.3 },
    { a: 'zis3', b: 'zis3', name: 'Pakfront', desc: '+20% fire rate', rate: 1.2 },
    { a: 'm30', b: 'su_observer', name: 'Fire Mission', desc: '+30% fire rate', rate: 1.3 },
    { a: 'su_sniper', b: 'su_observer', name: 'Spotter', desc: '+40% damage', dmg: 1.4 },
    { a: '52k', b: '61k', name: 'Flak Battery', desc: '+30% vs air', air: 1.3 },
    { a: 'dot', b: 'hedgehog', name: 'Fortified', desc: '+25% damage', dmg: 1.25 },
  ],
  ranks: ['Krasnoarmeyets', 'Yefreytor', 'Ml. serzhant', 'Serzhant', 'Starshina', 'Leytenant', 'Kapitan', 'Mayor', 'Polkovnik', 'General'],
  superName: 'Air & heavy artillery',
  look: { base: 'subase', hero: 'su_officer', nuke: 'shell' },
  help: SOVIET_HELP,
};
