// The Soviet Union: the Red Army as the attacker (and, see below, as the defender).

import type { EnemyDef } from './defs';
import type { Army, UnitHelp } from './ww2_kit';

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

export const SOVIET: EnemyDef[] = [
  { name: 'Rifle Squad', hp: 30, speed: 44, reward: 2, armor: 0, air: false, radius: 6, lives: 1, tex: 'su_rifle', bio: 2, inf: true, gun: { dmg: 2.5, range: 110, rate: 0.7, pen: 7, supp: 0.03, fx: 'rifle' } },
  { name: 'SMG Assault', hp: 40, speed: 54, reward: 3, armor: 0, air: false, radius: 6, lives: 1, tex: 'su_smg', bio: 2, inf: true, gun: { dmg: 4, range: 70, rate: 1.1, pen: 6, supp: 0.05, fx: 'smg' } },
  { name: 'Sniper', hp: 26, speed: 46, reward: 4, armor: 0, air: false, radius: 6, lives: 1, tex: 'su_sniper', bio: 2, inf: true, stealth: true, spot: 150, gun: { dmg: 14, range: 230, rate: 0.25, pen: 10, supp: 0.15, fx: 'rifle' } },
  { name: 'Medic', hp: 40, speed: 44, reward: 5, armor: 0, air: false, radius: 6, lives: 1, tex: 'su_medic', bio: 2, inf: true, heal: 0.08 },
  { name: 'GAZ-67 Jeep', hp: 50, speed: 95, reward: 3, armor: 0, air: false, radius: 8, lives: 1, tex: 'su_gaz', bio: 1, spot: 220 },
  { name: 'BA-64 Armoured Car', hp: 70, speed: 80, reward: 4, armor: 0, air: false, radius: 9, lives: 1, tex: 'su_ba64', bio: 0.6, spot: 200, arm: [10, 7, 7, 6], gun: { dmg: 3, range: 110, rate: 2, pen: 8, supp: 0.04, fx: 'mg' } },
  { name: 'T-70 Light Tank', hp: 120, speed: 50, reward: 6, armor: 0, air: false, radius: 11, lives: 1, tex: 'su_t70', bio: 0.4, arm: [45, 25, 25, 10], gun: { dmg: 20, range: 160, rate: 0.3, pen: 50, supp: 0.2, halt: 0.5, fx: 'tank' } },
  { name: 'T-34/76', hp: 190, speed: 42, reward: 8, armor: 0, air: false, radius: 13, lives: 2, tex: 'su_t34', bio: 0.35, arm: [90, 50, 40, 20], gun: { dmg: 36, range: 180, rate: 0.22, pen: 70, supp: 0.3, halt: 0.6, splash: 16, fx: 'tank' } },
  { name: 'T-34/85', hp: 230, speed: 42, reward: 10, armor: 0, air: false, radius: 13, lives: 2, tex: 'su_t3485', bio: 0.35, arm: [90, 60, 45, 20], gun: { dmg: 48, range: 190, rate: 0.2, pen: 100, supp: 0.3, halt: 0.6, splash: 18, fx: 'tank' } },
  { name: 'KV-1 Heavy Tank', hp: 320, speed: 28, reward: 14, armor: 0, air: false, radius: 14, lives: 3, tex: 'su_kv1', bio: 0.3, arm: [110, 80, 70, 30], gun: { dmg: 40, range: 180, rate: 0.2, pen: 75, supp: 0.3, halt: 0.7, splash: 16, fx: 'tank' } },
  { name: 'IS-2 Heavy Tank', hp: 2000, speed: 24, reward: 80, armor: 0, air: false, radius: 16, lives: 4, tex: 'su_is2', bio: 0.25, arm: [160, 90, 60, 30], boss: true, gun: { dmg: 140, range: 220, rate: 0.1, pen: 160, supp: 0.6, halt: 0.9, splash: 30, fx: 'tank' } },
  { name: 'Il-2 Sturmovik', hp: 95, speed: 70, reward: 6, armor: 0, air: true, radius: 13, lives: 1, tex: 'su_il2', bio: 0, arm: [12, 12, 8, 8], gun: { dmg: 32, range: 70, rate: 0.35, pen: 40, supp: 0.3, splash: 24, fx: 'rocket' } },
  { name: 'Yak-9 Fighter', hp: 60, speed: 110, reward: 4, armor: 0, air: true, radius: 12, lives: 1, tex: 'su_yak', bio: 0, gun: { dmg: 7, range: 120, rate: 3, pen: 15, supp: 0, fx: 'mg', air: true } },
  { name: 'BM-13 Katyusha', hp: 90, speed: 58, reward: 9, armor: 0, air: false, radius: 11, lives: 1, tex: 'su_katyusha', bio: 1,
    gun: { dmg: 22, range: 340, rate: 1 / 14, pen: 30, supp: 0.5, halt: 1.2, splash: 30, salvo: 16, fx: 'katyusha' } },
  { name: 'Sapper Squad', hp: 45, speed: 46, reward: 5, armor: 0, air: false, radius: 6, lives: 1, tex: 'su_sapper', bio: 2, inf: true,
    gun: { dmg: 260, range: 22, rate: 0.25, pen: 150, supp: 0.6, fx: 'satchel' } },
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
];

export const RED_ARMY: Army = {
  enemies: SOVIET,
  roster: {
    rifle: SU_RIFLE, assault: SU_SMG, sniper: SU_SNIPER, medic: SU_MEDIC, sapper: SU_SAPPER,
    recon: SU_GAZ, armcar: SU_BA64, light: SU_T70, medium: SU_T34, medium2: SU_T3485, heavy: SU_KV1, boss: SU_IS2,
    attack: SU_IL2, fighter: SU_YAK, rockets: SU_KATYUSHA,
  },
  help: ARMY_HELP,
};
