var COLS = 96;
var ROWS = 64;
var MAP_W = COLS * 20;
var MAP_H = ROWS * 20;
function setMapSize(cols, rows) {
	COLS = cols;
	ROWS = rows;
	MAP_W = cols * 20;
	MAP_H = rows * 20;
}
var DT = 1 / 60;
var MAX_ENEMIES = 4096;
var MAX_PROJECTILES = 8192;
var MAX_FX = 6144;
/** Paid at each new wave for holding the last one: base + per wave number. */
var WAVE_BONUS = [40, 8];
var SELL_RATIO = .7;
var CLASSIC_ENEMIES = [
	{
		name: "Infantry",
		hp: 32,
		speed: 52,
		reward: 2,
		armor: 0,
		air: false,
		radius: 6,
		lives: 1,
		tex: "infantry",
		bio: 2,
		inf: true
	},
	{
		name: "Buggy",
		hp: 48,
		speed: 96,
		reward: 3,
		armor: 0,
		air: false,
		radius: 8,
		lives: 1,
		tex: "buggy",
		bio: 1
	},
	{
		name: "APC",
		hp: 110,
		speed: 48,
		reward: 5,
		armor: 2,
		air: false,
		radius: 10,
		lives: 1,
		tex: "apc",
		bio: .5
	},
	{
		name: "Tank",
		hp: 190,
		speed: 34,
		reward: 7,
		armor: 5,
		air: false,
		radius: 12,
		lives: 2,
		tex: "tank",
		bio: .35
	},
	{
		name: "Helicopter",
		hp: 85,
		speed: 62,
		reward: 5,
		armor: 0,
		air: true,
		radius: 11,
		lives: 1,
		tex: "heli",
		bio: 0,
		rotor: true
	},
	{
		name: "Mammoth",
		hp: 2e3,
		speed: 22,
		reward: 80,
		armor: 7,
		air: false,
		radius: 18,
		lives: 4,
		tex: "boss",
		bio: .25,
		boss: true
	},
	{
		name: "Ghost",
		hp: 70,
		speed: 74,
		reward: 5,
		armor: 1,
		air: false,
		radius: 8,
		lives: 1,
		tex: "ghost",
		bio: 1,
		stealth: true
	},
	{
		name: "Aegis",
		hp: 150,
		speed: 40,
		reward: 8,
		armor: 3,
		air: false,
		radius: 11,
		lives: 2,
		tex: "aegis",
		bio: .5,
		shield: 1
	},
	{
		name: "Medic",
		hp: 120,
		speed: 44,
		reward: 7,
		armor: 1,
		air: false,
		radius: 10,
		lives: 1,
		tex: "medic",
		bio: 1.2,
		heal: .12
	}
];
var CLASSIC_CATEGORIES = [
	{
		id: "basic",
		name: "Basic"
	},
	{
		id: "fire",
		name: "Fire & Chem"
	},
	{
		id: "precision",
		name: "Precision"
	},
	{
		id: "control",
		name: "Control"
	},
	{
		id: "support",
		name: "Support"
	},
	{
		id: "maze",
		name: "Maze"
	},
	{
		id: "super",
		name: "Super"
	}
];
var T$1 = (d) => ({
	size: 2,
	aim: "track",
	targeted: true,
	role: d.kind,
	...d
});
/** A tower of another ruleset that behaves like `role`. */
var RT = (d) => ({
	size: 2,
	aim: "track",
	targeted: true,
	...d
});
var CLASSIC_TOWERS = [
	T$1({
		kind: "gun",
		cat: "basic",
		name: "Machine Gun",
		short: "Gun",
		desc: "Cheap and fast — the backbone of any maze.",
		hitsGround: true,
		hitsAir: true,
		airMult: 1,
		color: 14205530,
		turret: "t_gun",
		levels: [{
			cost: 10,
			damage: 4.5,
			range: 80,
			rate: 5
		}]
	}),
	T$1({
		kind: "cannon",
		cat: "basic",
		name: "Cannon",
		short: "Cannon",
		desc: "Heavy splash shells. Ground only.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 13073211,
		turret: "t_cannon",
		levels: [{
			cost: 40,
			damage: 42,
			range: 125,
			rate: .85,
			splash: 42
		}]
	}),
	T$1({
		kind: "missile",
		cat: "basic",
		name: "Missile",
		short: "Missile",
		desc: "Long-range homing. Bonus vs air.",
		hitsGround: true,
		hitsAir: true,
		airMult: 1.8,
		color: 14277081,
		turret: "t_missile",
		levels: [{
			cost: 50,
			damage: 40,
			range: 175,
			rate: 1,
			splash: 26
		}]
	}),
	T$1({
		kind: "laser",
		cat: "basic",
		name: "Laser",
		short: "Laser",
		desc: "Continuous beam, ignores armor.",
		hitsGround: true,
		hitsAir: true,
		airMult: 1,
		color: 16730714,
		turret: "t_laser",
		levels: [{
			cost: 65,
			damage: 46,
			range: 135,
			rate: 0
		}]
	}),
	T$1({
		kind: "tesla",
		cat: "basic",
		name: "Tesla Coil",
		short: "Tesla",
		desc: "Lightning chains between enemies.",
		hitsGround: true,
		hitsAir: true,
		airMult: 1,
		color: 7325951,
		turret: "t_tesla",
		aim: "spin",
		levels: [{
			cost: 75,
			damage: 30,
			range: 115,
			rate: 1.2,
			chain: 3
		}]
	}),
	T$1({
		kind: "emp",
		cat: "basic",
		name: "EMP Pulse",
		short: "EMP",
		desc: "Slows everything in range.",
		hitsGround: true,
		hitsAir: true,
		airMult: 1,
		color: 9236648,
		turret: "t_emp",
		aim: "spin",
		targeted: false,
		levels: [{
			cost: 30,
			damage: 3,
			range: 85,
			rate: 1,
			slow: .55,
			slowTime: 1.4
		}]
	}),
	T$1({
		kind: "flame",
		cat: "fire",
		name: "Flamethrower",
		short: "Flamer",
		desc: "Short cone of fire. Burning units ignite the ones behind them. Ground only.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 16742938,
		turret: "t_flame",
		levels: [{
			cost: 45,
			damage: 26,
			range: 70,
			rate: 0,
			burn: 8
		}]
	}),
	T$1({
		kind: "napalm",
		cat: "fire",
		name: "Napalm Mortar",
		short: "Napalm",
		desc: "Lobs napalm that leaves burning ground behind. Ground only.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 14698538,
		turret: "t_napalm",
		levels: [{
			cost: 60,
			damage: 18,
			range: 160,
			rate: .35,
			splash: 34,
			duration: 4
		}]
	}),
	T$1({
		kind: "acid",
		cat: "fire",
		name: "Acid Sprayer",
		short: "Acid",
		desc: "Corrodes armour so every other tower hits harder.",
		hitsGround: true,
		hitsAir: true,
		airMult: 1,
		color: 10936878,
		turret: "t_acid",
		levels: [{
			cost: 40,
			damage: 12,
			range: 110,
			rate: 1.2,
			splash: 26,
			shred: 4,
			duration: 5
		}]
	}),
	T$1({
		kind: "gas",
		cat: "fire",
		name: "Gas Launcher",
		short: "Gas",
		desc: "Drifting toxic clouds. Deadly to infantry, weak against armour.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 10211674,
		turret: "t_gas",
		levels: [{
			cost: 50,
			damage: 14,
			range: 130,
			rate: .3,
			splash: 40,
			duration: 5
		}]
	}),
	T$1({
		kind: "sniper",
		cat: "precision",
		name: "Sniper",
		short: "Sniper",
		desc: "Huge range and damage, slow to fire. Ignores armour.",
		hitsGround: true,
		hitsAir: true,
		airMult: 1,
		color: 6982234,
		turret: "t_sniper",
		levels: [{
			cost: 70,
			damage: 90,
			range: 300,
			rate: .45
		}]
	}),
	T$1({
		kind: "rail",
		cat: "precision",
		name: "Railgun",
		short: "Railgun",
		desc: "The slug pierces every unit in a straight line. Feed it long corridors.",
		hitsGround: true,
		hitsAir: true,
		airMult: 1,
		color: 5813503,
		turret: "t_rail",
		levels: [{
			cost: 110,
			damage: 120,
			range: 240,
			rate: .33
		}]
	}),
	T$1({
		kind: "gatling",
		cat: "precision",
		name: "Gatling",
		short: "Gatling",
		desc: "Spins up the longer it fires, then overheats.",
		hitsGround: true,
		hitsAir: true,
		airMult: 1,
		color: 11575424,
		turret: "t_gatling",
		levels: [{
			cost: 55,
			damage: 6,
			range: 95,
			rate: 3
		}]
	}),
	T$1({
		kind: "flak",
		cat: "precision",
		name: "Flak Cannon",
		short: "Flak",
		desc: "Air only. Bursting shells shred groups of helicopters.",
		hitsGround: false,
		hitsAir: true,
		airMult: 1,
		color: 9082536,
		turret: "t_flak",
		levels: [{
			cost: 45,
			damage: 26,
			range: 170,
			rate: 1.1,
			splash: 36
		}]
	}),
	T$1({
		kind: "arty",
		cat: "precision",
		name: "Artillery",
		short: "Artillery",
		desc: "Enormous range, but it only sees 140px — use radars to spot for it.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 8022602,
		turret: "t_arty",
		levels: [{
			cost: 120,
			damage: 180,
			range: 520,
			rate: .22,
			splash: 60
		}]
	}),
	T$1({
		kind: "cryo",
		cat: "control",
		name: "Cryo",
		short: "Cryo",
		desc: "Chills and then freezes units solid. Frozen units shatter under splash.",
		hitsGround: true,
		hitsAir: true,
		airMult: 1,
		color: 10479871,
		turret: "t_cryo",
		levels: [{
			cost: 50,
			damage: 4,
			range: 105,
			rate: 1.5,
			splash: 22,
			chill: .25
		}]
	}),
	T$1({
		kind: "gravity",
		cat: "control",
		name: "Gravity Well",
		short: "Gravity",
		desc: "Pulls ground units towards it, bunching them up for splash.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 10514687,
		turret: "t_gravity",
		aim: "spin",
		targeted: false,
		levels: [{
			cost: 70,
			damage: 4,
			range: 75,
			rate: 0,
			pull: 22,
			slow: .8
		}]
	}),
	T$1({
		kind: "repulsor",
		cat: "control",
		name: "Repulsor",
		short: "Repulsor",
		desc: "Knocks ground units back so they walk that stretch again.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 5949672,
		turret: "t_repulsor",
		aim: "spin",
		targeted: false,
		levels: [{
			cost: 60,
			damage: 6,
			range: 70,
			rate: .4,
			knock: 34
		}]
	}),
	T$1({
		kind: "hacker",
		cat: "control",
		name: "Hacker",
		short: "Hacker",
		desc: "Takes over a vehicle, which stops and fires on its own wave.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 3866506,
		turret: "t_hacker",
		levels: [{
			cost: 90,
			damage: 30,
			range: 120,
			rate: .15,
			duration: 3
		}]
	}),
	T$1({
		kind: "jammer",
		cat: "control",
		name: "Shield Jammer",
		short: "Jammer",
		desc: "Kills shields and medic healing in range; jammed units take extra damage.",
		hitsGround: true,
		hitsAir: true,
		airMult: 1,
		color: 16734928,
		turret: "t_jammer",
		aim: "spin",
		targeted: false,
		levels: [{
			cost: 55,
			damage: 0,
			range: 90,
			rate: 0,
			buff: .15
		}]
	}),
	T$1({
		kind: "depot",
		cat: "support",
		name: "Supply Depot",
		short: "Depot",
		desc: "Pays out at every wave, plus interest on the money you keep.",
		hitsGround: false,
		hitsAir: false,
		airMult: 0,
		color: 15777856,
		turret: "t_depot",
		aim: "static",
		targeted: false,
		levels: [{
			cost: 80,
			damage: 0,
			range: 0,
			rate: 0,
			income: 12,
			interest: .02,
			cap: 40
		}]
	}),
	T$1({
		kind: "radar",
		cat: "support",
		name: "Radar",
		short: "Radar",
		desc: "Reveals stealth units, spots for artillery and extends the range of nearby towers.",
		hitsGround: false,
		hitsAir: false,
		airMult: 0,
		color: 4251840,
		turret: "t_radar",
		aim: "spin",
		targeted: false,
		levels: [{
			cost: 60,
			damage: 0,
			range: 150,
			rate: 0,
			buff: .1
		}]
	}),
	T$1({
		kind: "command",
		cat: "support",
		name: "Command Post",
		short: "Command",
		desc: "Towers in range fire faster.",
		hitsGround: false,
		hitsAir: false,
		airMult: 0,
		color: 15227466,
		turret: "t_command",
		aim: "static",
		targeted: false,
		levels: [{
			cost: 90,
			damage: 0,
			range: 90,
			rate: 0,
			buff: .15
		}]
	}),
	T$1({
		kind: "salvage",
		cat: "support",
		name: "Salvage Yard",
		short: "Salvage",
		desc: "Units destroyed in range pay a bigger bounty.",
		hitsGround: false,
		hitsAir: false,
		airMult: 0,
		color: 12623984,
		turret: "t_salvage",
		aim: "spin",
		targeted: false,
		levels: [{
			cost: 70,
			damage: 0,
			range: 120,
			rate: 0,
			buff: .25
		}]
	}),
	T$1({
		kind: "barricade",
		cat: "maze",
		name: "Barricade",
		short: "Barricade",
		desc: "A cheap 1×1 wall for fine-grained mazes. Does not shoot.",
		size: 1,
		hitsGround: false,
		hitsAir: false,
		airMult: 0,
		color: 10132106,
		turret: null,
		aim: "static",
		targeted: false,
		single: true,
		levels: [{
			cost: 3,
			damage: 0,
			range: 0,
			rate: 0
		}]
	}),
	T$1({
		kind: "mine",
		cat: "maze",
		name: "Minefield",
		short: "Mine",
		desc: "Goes on the path itself. Blows up under ground units, then re-arms.",
		size: 1,
		walkable: true,
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 13647920,
		turret: null,
		aim: "static",
		targeted: false,
		levels: [{
			cost: 15,
			damage: 60,
			range: 12,
			rate: .25,
			splash: 30
		}]
	}),
	T$1({
		kind: "tar",
		cat: "maze",
		name: "Tar Pit",
		short: "Tar",
		desc: "Goes on the path. Everything that wades through it slows down.",
		walkable: true,
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 3813416,
		turret: null,
		aim: "static",
		targeted: false,
		levels: [{
			cost: 20,
			damage: 0,
			range: 0,
			rate: 0,
			slow: .55
		}]
	}),
	T$1({
		kind: "spikes",
		cat: "maze",
		name: "Spike Strip",
		short: "Spikes",
		desc: "Goes on the path. Shreds anything that drives over it.",
		walkable: true,
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 9079440,
		turret: null,
		aim: "static",
		targeted: false,
		levels: [{
			cost: 25,
			damage: 35,
			range: 0,
			rate: 0
		}]
	}),
	T$1({
		kind: "gate",
		cat: "maze",
		name: "Gate",
		short: "Gate",
		desc: "A wall you can open and close (G) to reroute a wave mid-fight.",
		hitsGround: false,
		hitsAir: false,
		airMult: 0,
		color: 14725184,
		turret: null,
		aim: "static",
		targeted: false,
		single: true,
		levels: [{
			cost: 35,
			damage: 0,
			range: 0,
			rate: 0
		}]
	}),
	T$1({
		kind: "bunker",
		cat: "maze",
		name: "Bunker",
		short: "Bunker",
		desc: "Short range, but fires at two units at once as they pass.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 6975568,
		turret: "t_bunker",
		levels: [{
			cost: 40,
			damage: 11,
			range: 62,
			rate: 4
		}]
	}),
	T$1({
		kind: "orbital",
		cat: "super",
		name: "Orbital Laser",
		short: "Orbital",
		desc: "Charges up; then you aim (R) a beam from orbit that hunts down units.",
		hitsGround: true,
		hitsAir: true,
		airMult: 1,
		color: 16726634,
		turret: "t_orbital",
		aim: "spin",
		targeted: false,
		manual: true,
		levels: [{
			cost: 250,
			damage: 300,
			range: 0,
			rate: 0,
			splash: 30,
			charge: 35,
			duration: 4
		}]
	}),
	T$1({
		kind: "nuke",
		cat: "super",
		name: "Nuke Silo",
		short: "Nuke",
		desc: "One launch per charge (R), anywhere on the map. Clears a huge area.",
		hitsGround: true,
		hitsAir: true,
		airMult: 1,
		color: 16769088,
		turret: "t_nuke",
		aim: "static",
		targeted: false,
		manual: true,
		levels: [{
			cost: 300,
			damage: 2500,
			range: 0,
			rate: 0,
			splash: 150,
			charge: 60
		}]
	}),
	T$1({
		kind: "hive",
		cat: "super",
		name: "Drone Hive",
		short: "Drones",
		desc: "Launches drones that hunt units around the hive, air or ground.",
		hitsGround: true,
		hitsAir: true,
		airMult: 1,
		color: 5296383,
		turret: "t_hive",
		aim: "static",
		levels: [{
			cost: 150,
			damage: 14,
			range: 260,
			rate: 3,
			drones: 2
		}]
	}),
	T$1({
		kind: "blackhole",
		cat: "super",
		name: "Black Hole Projector",
		short: "Black Hole",
		desc: "Opens a singularity that drags units in and swallows the weak ones.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 9060607,
		turret: "t_blackhole",
		aim: "spin",
		levels: [{
			cost: 350,
			damage: 80,
			range: 200,
			rate: .125,
			splash: 80,
			pull: 110,
			duration: 3
		}]
	})
];
/** Rank names shown next to the level. */
var CLASSIC_RANKS = [
	"Recruit",
	"Private",
	"Corporal",
	"Sergeant",
	"Lieutenant",
	"Captain",
	"Major",
	"Colonel",
	"General",
	"Legend"
];
var r1 = (n) => Math.round(n * 10) / 10;
var r2 = (n) => Math.round(n * 100) / 100;
/** Level n (0-based) of a tower, grown from its level-1 stats. */
function grow(b, n) {
	const power = 1 + .35 * n + .03 * n * n;
	const lv = {
		cost: n === 0 ? b.cost : Math.round(b.cost * (.5 + .28 * n)),
		damage: r1(b.damage * power),
		range: Math.round(b.range * (1 + .045 * n)),
		rate: r2(b.rate * (1 + .06 * n))
	};
	if (b.splash) lv.splash = Math.round(b.splash * (1 + .04 * n));
	if (b.chain) lv.chain = b.chain + Math.floor(n / 2);
	if (b.slow) lv.slow = r2(Math.max(.2, b.slow - .035 * n));
	if (b.slowTime) lv.slowTime = r1(b.slowTime * (1 + .05 * n));
	if (b.burn) lv.burn = r1(b.burn * power);
	if (b.shred) lv.shred = r1(b.shred * (1 + .25 * n));
	if (b.chill) lv.chill = r2(Math.min(.8, b.chill + .03 * n));
	if (b.pull) lv.pull = Math.round(b.pull * (1 + .08 * n));
	if (b.knock) lv.knock = Math.round(b.knock * (1 + .07 * n));
	if (b.duration) lv.duration = r1(b.duration * (1 + .06 * n));
	if (b.buff) lv.buff = r2(b.buff * (1 + .12 * n));
	if (b.income) lv.income = Math.round(b.income * (1 + .3 * n));
	if (b.interest) lv.interest = r2(b.interest + .004 * n);
	if (b.cap) lv.cap = Math.round(b.cap * (1 + .3 * n));
	if (b.charge) lv.charge = Math.round(b.charge * (1 - .045 * n));
	if (b.drones) lv.drones = b.drones + Math.floor(n / 3);
	if (b.pen) lv.pen = Math.round(b.pen * (1 + .035 * n));
	if (b.supp) lv.supp = r2(b.supp * (1 + .06 * n));
	if (b.salvo) lv.salvo = b.salvo + Math.floor(n / 3);
	if (b.hp) lv.hp = Math.round(b.hp * (1 + .15 * n));
	if (b.fort) lv.fort = b.fort + (n >= 3 ? 12 : 0) + (n >= 6 ? 25 : 0);
	return lv;
}
/** Fills in levels 2..MAX_LEVEL of every upgradable tower. */
function growAll(towers) {
	for (const t of towers) if (!t.single && t.levels.length === 1) t.levels = Array.from({ length: 10 }, (_, n) => grow(t.levels[0], n));
	return towers;
}
growAll(CLASSIC_TOWERS);
var CLASSIC_COMBOS = [
	{
		a: "gun",
		b: "gatling",
		name: "Lead Storm",
		desc: "+25% fire rate",
		rate: 1.25
	},
	{
		a: "cannon",
		b: "cryo",
		name: "Shatter",
		desc: "+40% damage",
		dmg: 1.4
	},
	{
		a: "missile",
		b: "radar",
		name: "Guided",
		desc: "+25% range and damage",
		dmg: 1.25,
		range: 1.25
	},
	{
		a: "laser",
		b: "tesla",
		name: "Ion Lance",
		desc: "+40% damage",
		dmg: 1.4
	},
	{
		a: "flame",
		b: "gas",
		name: "Firestorm",
		desc: "+30% damage; gas clouds burn",
		dmg: 1.3
	},
	{
		a: "sniper",
		b: "radar",
		name: "Overwatch",
		desc: "+50% damage",
		dmg: 1.5
	},
	{
		a: "rail",
		b: "tesla",
		name: "Gauss",
		desc: "+40% damage",
		dmg: 1.4
	},
	{
		a: "emp",
		b: "gravity",
		name: "Event Horizon",
		desc: "+30% range",
		range: 1.3
	},
	{
		a: "napalm",
		b: "acid",
		name: "Hellfire",
		desc: "+30% damage",
		dmg: 1.3
	},
	{
		a: "flak",
		b: "missile",
		name: "Sky Net",
		desc: "+35% vs air",
		air: 1.35
	},
	{
		a: "arty",
		b: "command",
		name: "Fire Mission",
		desc: "+30% fire rate",
		rate: 1.3
	},
	{
		a: "bunker",
		b: "barricade",
		name: "Fortified",
		desc: "+30% damage",
		dmg: 1.3
	}
];
function hpScale(wave) {
	const n = wave - 1;
	return 1 + .15 * n + .009 * n * n;
}
function rewardScale(wave) {
	return 1.3 * (1 + .07 * (wave - 1));
}
function classicWave(wave) {
	const n = wave;
	const g = [];
	const add = (kind, count, interval, delay = 0) => g.push({
		kind,
		count: Math.max(1, Math.round(count)),
		interval,
		delay
	});
	if (n % 10 === 0) {
		add(5, n / 10, 6);
		add(3, 2 + n / 6, 1.6, 2);
		add(0, 8 + n * .8, .35, 0);
	} else if (n % 5 === 0) {
		add(4, 6 + n * .6, .9);
		add(1, 4 + n * .3, .7, 3);
	} else switch (n % 4) {
		case 1:
			add(0, 10 + n * 1.4, .55);
			if (n > 6) add(2, n * .3, 1.5, 4);
			break;
		case 2:
			add(1, 6 + n * .9, .6);
			add(0, 6 + n * .6, .5, 2);
			break;
		case 3:
			add(2, 4 + n * .5, 1.1);
			if (n > 3) add(3, n * .25, 2, 3);
			break;
		default:
			add(0, 8 + n, .45);
			add(3, 1 + n * .3, 1.8, 2);
			if (n > 8) add(4, n * .3, 1.2, 5);
	}
	if (n >= 7 && n % 3 === 1) add(6, 3 + n * .35, .9, 6);
	if (n >= 9 && n % 4 === 1) add(7, 2 + n * .25, 1.6, 4);
	if (n >= 11 && n % 2 === 1) add(8, 1 + n * .08, 3, 3);
	return g;
}
var CLASSIC = {
	id: "classic",
	towers: CLASSIC_TOWERS,
	enemies: CLASSIC_ENEMIES,
	combos: CLASSIC_COMBOS,
	categories: CLASSIC_CATEGORIES,
	ranks: CLASSIC_RANKS,
	wave: classicWave
};
var RULESET = "classic";
var TOWERS = CLASSIC_TOWERS;
var ENEMIES = CLASSIC_ENEMIES;
var COMBOS = CLASSIC_COMBOS;
var buildWave = classicWave;
/** True while WW2 rules are in play (armour penetration, suppression…). */
var WW2$1 = false;
var UNITS = [];
function installRuleset(r) {
	RULESET = r.id;
	TOWERS = r.towers;
	ENEMIES = r.enemies;
	COMBOS = r.combos;
	r.categories;
	r.ranks;
	buildWave = r.wave;
	WW2$1 = r.id === "ww2";
	UNITS = r.units ?? [];
	r.side;
	r.foe;
	r.look;
}
/** Index of the first tower of this kind, or else of this role (-1 if none). */
function towerIndex(kind) {
	const i = TOWERS.findIndex((t) => t.kind === kind);
	return i >= 0 ? i : TOWERS.findIndex((t) => t.role === kind);
}
//#endregion
//#region src/game/rng.ts
/** mulberry32: tiny, fast, deterministic. */
var Rng = class {
	s;
	constructor(seed) {
		this.s = seed >>> 0;
	}
	next() {
		let t = this.s = this.s + 1831565813 | 0;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	}
	range(a, b) {
		return a + (b - a) * this.next();
	}
	int(n) {
		return this.next() * n | 0;
	}
};
//#endregion
//#region src/game/maps.ts
var MAPS = [
	{
		name: "Open Field",
		desc: "One way in, one way out across a wide plain. Build the longest maze you can.",
		seed: 11,
		cols: 96,
		rows: 64,
		routes: [{
			entry: {
				side: "L",
				from: 30,
				to: 33
			},
			exit: {
				side: "R",
				from: 30,
				to: 33
			}
		}],
		rocks: 28,
		forests: 9,
		rivers: 1,
		mountains: 3
	},
	{
		name: "Crossfire",
		desc: "Two crossing routes share the field. One maze must serve both.",
		seed: 23,
		cols: 104,
		rows: 72,
		routes: [{
			entry: {
				side: "L",
				from: 34,
				to: 37
			},
			exit: {
				side: "R",
				from: 34,
				to: 37
			}
		}, {
			entry: {
				side: "T",
				from: 50,
				to: 53
			},
			exit: {
				side: "B",
				from: 50,
				to: 53
			}
		}],
		rocks: 40,
		forests: 11,
		rivers: 1,
		mountains: 4
	},
	{
		name: "Boulder Pass",
		desc: "Corner to corner through a rocky field and the mountains around it.",
		seed: 37,
		cols: 120,
		rows: 80,
		routes: [{
			entry: {
				side: "L",
				from: 4,
				to: 7
			},
			exit: {
				side: "R",
				from: 72,
				to: 75
			}
		}],
		rocks: 150,
		forests: 7,
		mountains: 7
	},
	{
		name: "The Gauntlet",
		desc: "A long, narrow strip crossed by two rivers. Plenty of road to fill with guns.",
		seed: 53,
		cols: 176,
		rows: 48,
		routes: [{
			entry: {
				side: "L",
				from: 22,
				to: 25
			},
			exit: {
				side: "R",
				from: 22,
				to: 25
			}
		}],
		rocks: 60,
		forests: 9,
		rivers: 2,
		mountains: 4
	},
	{
		name: "Badlands",
		desc: "A huge front of rock, mountains and a river, with three assault routes. Spread out or funnel them together.",
		seed: 71,
		cols: 160,
		rows: 104,
		routes: [
			{
				entry: {
					side: "L",
					from: 22,
					to: 25
				},
				exit: {
					side: "R",
					from: 78,
					to: 81
				}
			},
			{
				entry: {
					side: "T",
					from: 70,
					to: 73
				},
				exit: {
					side: "B",
					from: 70,
					to: 73
				}
			},
			{
				entry: {
					side: "B",
					from: 128,
					to: 131
				},
				exit: {
					side: "L",
					from: 80,
					to: 83
				}
			}
		],
		rocks: 180,
		forests: 14,
		rivers: 1,
		mountains: 7
	}
];
/** Every map module (sim, flow fields, renderer) reads the live map size; call before building. */
function useMapSize(def) {
	setMapSize(def.cols, def.rows);
}
/** Ground units wade through water at this fraction of their speed. */
var WATER_SLOW = .55;
var GATE_DEPTH = 2;
function gateCells(g, depth) {
	const out = [];
	for (let k = g.from; k <= g.to; k++) for (let d = 0; d < depth; d++) {
		let c;
		let r;
		if (g.side === "L") [c, r] = [d, k];
		else if (g.side === "R") [c, r] = [COLS - 1 - d, k];
		else if (g.side === "T") [c, r] = [k, d];
		else [c, r] = [k, ROWS - 1 - d];
		out.push(r * COLS + c);
	}
	return out;
}
var inward = {
	L: [1, 0],
	R: [-1, 0],
	T: [0, 1],
	B: [0, -1]
};
function gateCenter(g, outside) {
	const mid = (g.from + g.to + 1) / 2 * 20;
	if (g.side === "L") return [-outside, mid];
	if (g.side === "R") return [COLS * 20 + outside, mid];
	if (g.side === "T") return [mid, -outside];
	return [mid, ROWS * 20 + outside];
}
/**
* Can a ground unit get from every entry cell to the exit? A plain 4-neighbour flood fill:
* diagonal moves never cut corners, so they can't connect anything 4-neighbour moves can't.
* Much cheaper than a full flow field, which matters when scattering hundreds of rocks.
*/
function connected(blocked, route, seen, queue) {
	seen.fill(0);
	let head = 0;
	let tail = 0;
	for (const i of route.exit) {
		seen[i] = 1;
		queue[tail++] = i;
	}
	let left = 0;
	for (const i of route.entry) {
		if (seen[i]) continue;
		seen[i] = 2;
		left++;
	}
	const visit = (j) => {
		if (seen[j] === 1 || blocked[j]) return;
		if (seen[j] === 2) left--;
		seen[j] = 1;
		queue[tail++] = j;
	};
	while (head < tail && left > 0) {
		const i = queue[head++];
		const c = i % COLS;
		if (c > 0) visit(i - 1);
		if (c < COLS - 1) visit(i + 1);
		if (i >= COLS) visit(i - COLS);
		if (i + COLS < seen.length) visit(i + COLS);
	}
	return left === 0;
}
/** Run-length encodes the water / mountain cells of a grid for MapDef.paint: "<type><run, base 36>" joined by dots. */
function encodePaint(cells) {
	const out = [];
	for (let i = 0; i < cells.length;) {
		let j = i;
		while (j < cells.length && cells[j] === cells[i]) j++;
		out.push(`${cells[i]}${(j - i).toString(36)}`);
		i = j;
	}
	return out.join(".");
}
function decodePaint(paint, n) {
	const cells = new Uint8Array(n);
	let i = 0;
	for (const run of paint.split(".")) {
		const t = Number(run[0]);
		const len = parseInt(run.slice(1), 36) || 0;
		if (t === 3 || t === 4 || t === 5) cells.fill(t, i, Math.min(n, i + len));
		i += len;
	}
	return cells;
}
/** Smooth seeded value noise in [0,1) over the cell grid, one lattice point every `step` cells. */
function valueNoise(rng, step) {
	const w = Math.ceil(COLS / step) + 2;
	const h = Math.ceil(ROWS / step) + 2;
	const v = new Float32Array(w * h);
	for (let i = 0; i < v.length; i++) v[i] = rng.next();
	return (c, r) => {
		const x = Math.max(0, c / step);
		const y = Math.max(0, r / step);
		const ix = Math.min(w - 2, x | 0);
		const iy = Math.min(h - 2, y | 0);
		let fx = x - ix;
		let fy = y - iy;
		fx = fx * fx * (3 - 2 * fx);
		fy = fy * fy * (3 - 2 * fy);
		const a = v[iy * w + ix] + (v[iy * w + ix + 1] - v[iy * w + ix]) * fx;
		return a + (v[(iy + 1) * w + ix] + (v[(iy + 1) * w + ix + 1] - v[(iy + 1) * w + ix]) * fx - a) * fy;
	};
}
/** 4-neighbour steps from each cell to the nearest gate cell, capped at `cap`. */
function gateDistance(grid, cap) {
	const d = new Uint8Array(grid.length).fill(cap);
	const queue = [];
	for (let i = 0; i < grid.length; i++) if (grid[i] === 2) {
		d[i] = 0;
		queue.push(i);
	}
	for (let h = 0; h < queue.length; h++) {
		const i = queue[h];
		if (d[i] + 1 >= cap) continue;
		const c = i % COLS;
		for (const j of [
			c > 0 ? i - 1 : -1,
			c < COLS - 1 ? i + 1 : -1,
			i - COLS,
			i + COLS
		]) {
			if (j < 0 || j >= grid.length || d[j] <= d[i] + 1) continue;
			d[j] = d[i] + 1;
			queue.push(j);
		}
	}
	return d;
}
/**
* A meandering river across the map, perpendicular to the first route so ground units have to
* wade through it (rather than wading along it). `at` is where it crosses, as a fraction of the map.
*/
function carveRiver(grid, rng, vertical, at) {
	const len = vertical ? ROWS : COLS;
	const span = vertical ? COLS : ROWS;
	const wander = valueNoise(rng, 9);
	const amp = span * rng.range(.05, .1);
	const freq = rng.range(.8, 1.8);
	const phase = rng.range(0, Math.PI * 2);
	const base = span * at;
	let prev = -1;
	for (let t = 0; t < len; t++) {
		const centre = base + amp * Math.sin(t / len * Math.PI * 2 * freq + phase) + (wander(t, at * 50) - .5) * span * .12;
		const half = 1 + 1.4 * wander(at * 50 + 7, t);
		const lo = Math.round(Math.min(centre, prev < 0 ? centre : prev) - half);
		const hi = Math.round(Math.max(centre, prev < 0 ? centre : prev) + half);
		prev = centre;
		for (let k = Math.max(0, lo); k <= Math.min(span - 1, hi); k++) {
			const i = vertical ? t * COLS + k : k * COLS + t;
			if (grid[i] === 0) grid[i] = 3;
		}
	}
}
/** Signed turn from heading a to heading b, in (-π, π]. */
function angleTo(a, b) {
	let d = (b - a) % (Math.PI * 2);
	if (d > Math.PI) d -= Math.PI * 2;
	if (d < -Math.PI) d += Math.PI * 2;
	return d;
}
function buildMap(def) {
	useMapSize(def);
	const grid = new Uint8Array(COLS * ROWS);
	const routes = def.routes.map(({ entry, exit }) => {
		for (const i of gateCells(entry, GATE_DEPTH)) grid[i] = 2;
		for (const i of gateCells(exit, GATE_DEPTH)) grid[i] = 2;
		const [ix, iy] = inward[exit.side];
		return {
			entry: gateCells(entry, 1),
			exit: gateCells(exit, 1),
			inDir: inward[entry.side],
			outDir: [-ix, -iy],
			airFrom: gateCenter(entry, 20),
			airTo: gateCenter(exit, 20)
		};
	});
	const blocked = new Uint8Array(COLS * ROWS);
	const seen = new Uint8Array(COLS * ROWS);
	const queue = new Int32Array(COLS * ROWS);
	const allOpen = () => {
		for (const route of routes) if (!connected(blocked, route, seen, queue)) return false;
		return true;
	};
	const stamp = new Int32Array(COLS * ROWS);
	let gen = 0;
	const keepsOpen = (cells) => {
		for (const i of cells) blocked[i] = 1;
		gen += 2;
		const ring = [];
		const neighbours = (i, fn) => {
			const c = i % COLS;
			if (c > 0) fn(i - 1);
			if (c < COLS - 1) fn(i + 1);
			if (i >= COLS) fn(i - COLS);
			if (i + COLS < blocked.length) fn(i + COLS);
		};
		for (const i of cells) neighbours(i, (j) => {
			if (!blocked[j] && stamp[j] !== gen) {
				stamp[j] = gen;
				ring.push(j);
			}
		});
		let left = ring.length - 1;
		let head = 0;
		let tail = 0;
		if (ring.length) {
			stamp[ring[0]] = gen + 1;
			queue[tail++] = ring[0];
		}
		while (head < tail && left > 0) neighbours(queue[head++], (j) => {
			if (blocked[j] || stamp[j] === gen + 1) return;
			if (stamp[j] === gen) left--;
			stamp[j] = gen + 1;
			queue[tail++] = j;
		});
		const ok = left <= 0 || allOpen();
		for (const i of cells) blocked[i] = 0;
		return ok;
	};
	if (def.paint) {
		const painted = decodePaint(def.paint, grid.length);
		const mount = [];
		for (let i = 0; i < grid.length; i++) {
			if (grid[i] !== 0 || !painted[i]) continue;
			grid[i] = painted[i];
			if (painted[i] === 4 || painted[i] === 5) {
				blocked[i] = 1;
				mount.push(i);
			}
		}
		if (!allOpen()) {
			for (const i of mount) blocked[i] = 0;
			for (const i of mount) {
				blocked[i] = 1;
				if (!allOpen()) {
					blocked[i] = 0;
					grid[i] = 0;
				}
			}
		}
	}
	const tr = new Rng(def.seed * 31 + 7);
	const rivers = def.rivers ?? 0;
	const side = def.routes[0]?.entry.side ?? "L";
	const vertical = side === "L" || side === "R";
	const ends = def.routes.flatMap((r) => [r.entry, r.exit]).filter((g) => (g.side === "T" || g.side === "B") === vertical);
	const span = vertical ? COLS : ROWS;
	for (let k = 0; k < rivers; k++) {
		let at = (k + 1) / (rivers + 1);
		for (let attempt = 0; attempt < 24; attempt++) {
			const cand = (k + 1) / (rivers + 1) + tr.range(-.12, .12) * (1 + attempt / 6);
			if (cand < .15 || cand > .85) continue;
			at = cand;
			if (ends.every((g) => Math.abs((g.from + g.to) / 2 - cand * span) > span * .16 + 6)) break;
		}
		carveRiver(grid, tr, vertical, at);
	}
	const ranges = def.mountains ?? 0;
	if (ranges) {
		const edge = valueNoise(tr, 3);
		const nearGate = gateDistance(grid, 16);
		const cap = grid.length * .2;
		const cx = COLS / 2;
		const cy = ROWS / 2;
		const central = (half) => (tr.next() + tr.next() - 1) * half;
		let raised = 0;
		for (let m = 0; m < ranges && raised < cap; m++) {
			let x = 0;
			let y = 0;
			const clear = (c, r) => {
				for (let y2 = Math.max(0, r - 9); y2 <= Math.min(ROWS - 1, r + 9); y2++) for (let x2 = Math.max(0, c - 9); x2 <= Math.min(COLS - 1, c + 9); x2++) if (grid[y2 * COLS + x2] === 4) return false;
				return true;
			};
			for (let attempt = 0; attempt < 40; attempt++) {
				x = cx + central(COLS * (.3 + attempt * .004));
				y = cy + central(ROWS * (.3 + attempt * .004));
				if (nearGate[(y | 0) * COLS + (x | 0)] >= 16 && grid[(y | 0) * COLS + (x | 0)] === 0 && clear(x | 0, y | 0)) break;
			}
			let heading = tr.range(0, Math.PI * 2);
			const length = Math.max(COLS, ROWS) * tr.range(.18, .36);
			const peak = tr.range(4.5, 8);
			for (let walked = 0, stride = 1.8; walked < length; walked += stride) {
				const radius = peak * (.45 + .55 * Math.sqrt(Math.sin(walked / length * Math.PI)));
				const cells = [];
				for (let r = Math.floor(y - radius - 2); r <= y + radius + 2; r++) for (let c = Math.floor(x - radius - 2); c <= x + radius + 2; c++) {
					if (c < 1 || r < 1 || c >= COLS - 1 || r >= ROWS - 1) continue;
					const i = r * COLS + c;
					if (grid[i] !== 0 || nearGate[i] < 7) continue;
					if (Math.hypot(c + .5 - x, r + .5 - y) > radius * (.7 + .6 * edge(c, r))) continue;
					cells.push(i);
				}
				if (keepsOpen(cells)) {
					for (const i of cells) {
						grid[i] = 4;
						blocked[i] = 1;
					}
					raised += cells.length;
				}
				heading += tr.range(-.35, .35);
				const off = Math.max(Math.abs(x - cx) / COLS, Math.abs(y - cy) / ROWS);
				if (off > .22) heading += angleTo(heading, Math.atan2(cy - y, cx - x)) * Math.min(.5, (off - .22) * 4);
				stride = Math.max(1.8, radius * .6);
				x += Math.cos(heading) * stride;
				y += Math.sin(heading) * stride;
				if (Math.abs(x - cx) > COLS * .4 || Math.abs(y - cy) > ROWS * .4) break;
			}
		}
	}
	const groves = def.forests ?? 0;
	if (groves) {
		const fr = new Rng(def.seed * 53 + 11);
		const edge = valueNoise(fr, 2);
		const nearGate = gateDistance(grid, 10);
		for (let g = 0; g < groves; g++) {
			const big = fr.next() < .45;
			const radius = big ? fr.range(2.5, 4.5) : fr.range(1.2, 2.4);
			let x = 0;
			let y = 0;
			let ok = false;
			for (let attempt = 0; attempt < 30 && !ok; attempt++) {
				x = fr.range(3, COLS - 3);
				y = fr.range(2, ROWS - 2);
				const i = (y | 0) * COLS + (x | 0);
				ok = grid[i] === 0 && nearGate[i] >= 10;
			}
			if (!ok) continue;
			const parts = big ? 2 + fr.int(3) : 1;
			for (let p = 0; p < parts; p++) {
				const px = x + (p ? fr.range(-radius, radius) * 1.2 : 0);
				const py = y + (p ? fr.range(-radius, radius) * 1.2 : 0);
				const pr = radius * (p ? fr.range(.6, .9) : 1);
				const cells = [];
				for (let r = Math.floor(py - pr - 1); r <= py + pr + 1; r++) for (let c = Math.floor(px - pr - 1); c <= px + pr + 1; c++) {
					if (c < 1 || r < 1 || c >= COLS - 1 || r >= ROWS - 1) continue;
					const i = r * COLS + c;
					if (grid[i] !== 0 || nearGate[i] < 5) continue;
					if (Math.hypot(c + .5 - px, r + .5 - py) > pr * (.65 + .7 * edge(c, r))) continue;
					cells.push(i);
				}
				if (cells.length && keepsOpen(cells)) for (const i of cells) {
					grid[i] = 5;
					blocked[i] = 1;
				}
			}
		}
	}
	const rng = new Rng(def.seed);
	const rocks = [];
	const tryRock = (c, r, s) => {
		const cells = [];
		for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) cells.push((r + dy) * COLS + c + dx);
		if (c < 0 || r < 0 || c + s > COLS || r + s > ROWS || cells.some((i) => grid[i] !== 0)) return false;
		if (!keepsOpen(cells)) return false;
		for (const i of cells) {
			grid[i] = 1;
			blocked[i] = 1;
		}
		rocks.push({
			c,
			r,
			s
		});
		return true;
	};
	if (def.rockList) {
		for (const k of def.rockList) tryRock(k.c, k.r, k.s);
		return {
			def,
			grid,
			routes,
			rocks
		};
	}
	let tries = 0;
	while (rocks.length < def.rocks && tries++ < def.rocks * 20) {
		const s = rng.next() < .4 ? 2 : 1;
		let c = 3 + rng.int(COLS - 6 - s);
		let r = 1 + rng.int(ROWS - 2 - s);
		if (rocks.length && rng.next() < .55) {
			const near = rocks[rng.int(rocks.length)];
			c = near.c + rng.int(5) - 2;
			r = near.r + rng.int(5) - 2;
			if (c < 3 || r < 1 || c + s > COLS - 3 || r + s > ROWS - 1) continue;
		}
		tryRock(c, r, s);
	}
	return {
		def,
		grid,
		routes,
		rocks
	};
}
//#endregion
//#region src/game/battles.ts
var Painter = class {
	cols;
	rows;
	rng;
	cells;
	rocks = [];
	constructor(cols, rows, rng = new Rng(1)) {
		this.cols = cols;
		this.rows = rows;
		this.rng = rng;
		this.cells = new Uint8Array(cols * rows);
	}
	set(c, r, t) {
		c = Math.round(c);
		r = Math.round(r);
		if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
		this.cells[r * this.cols + c] = t;
	}
	rect(c0, r0, c1, r1, t) {
		for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.set(c, r, t);
		return this;
	}
	disc(cx, cy, rad, t, ragged = .25) {
		for (let r = Math.floor(cy - rad - 2); r <= cy + rad + 2; r++) for (let c = Math.floor(cx - rad - 2); c <= cx + rad + 2; c++) if (Math.hypot(c + .5 - cx, r + .5 - cy) <= rad * (1 - ragged / 2 + this.rng.next() * ragged)) this.set(c, r, t);
		return this;
	}
	/** A meandering band from (c0,r0) to (c1,r1), `w` cells wide (a river, a ridge, a hedgerow). */
	band(c0, r0, c1, r1, w, t, wobble = 0, gaps = [], gapW = 3) {
		const len = Math.max(1, Math.hypot(c1 - c0, r1 - r0));
		const nx = -(r1 - r0) / len;
		const ny = (c1 - c0) / len;
		const phase = this.rng.next() * Math.PI * 2;
		for (let s = 0; s <= len; s += .5) {
			const f = s / len;
			if (gaps.some((g) => Math.abs(f * len - g * len) < gapW / 2)) continue;
			const off = wobble * Math.sin(f * Math.PI * 3 + phase);
			const x = c0 + (c1 - c0) * f + nx * off;
			const y = r0 + (r1 - r0) * f + ny * off;
			for (let k = -w / 2; k <= w / 2; k += .5) this.set(x + nx * k, y + ny * k, t);
		}
		return this;
	}
	/** Scattered woods. */
	woods(n, c0, r0, c1, r1, size) {
		for (let k = 0; k < n; k++) this.disc(this.rng.range(c0, c1), this.rng.range(r0, r1), this.rng.range(size[0], size[1]), 5, .5);
		return this;
	}
	rock(c, r, s) {
		this.rocks.push({
			c,
			r,
			s
		});
		return this;
	}
	get paint() {
		return encodePaint(this.cells);
	}
};
var water = 3;
var mount = 4;
var tree = 5;
function moscow() {
	const p = new Painter(100, 64, new Rng(1941));
	p.band(58, 0, 64, 63, 3, water, 3);
	p.woods(14, 8, 4, 92, 60, [2, 4.5]);
	return {
		name: "Moscow, 1941",
		desc: "Winter before Moscow.",
		seed: 1941,
		cols: 100,
		rows: 64,
		routes: [{
			entry: {
				side: "L",
				from: 30,
				to: 33
			},
			exit: {
				side: "R",
				from: 30,
				to: 33
			}
		}],
		rocks: 24,
		paint: p.paint,
		theme: "snow"
	};
}
function stalingrad() {
	const p = new Painter(96, 64, new Rng(1942));
	p.rect(84, 0, 89, 63, water);
	for (let bx = 6; bx < 78; bx += 9) for (let by = 3; by < 60; by += 8) {
		if (p.rng.next() < .25) continue;
		for (let k = 0; k < 5; k++) p.rock(bx + p.rng.int(5), by + p.rng.int(4), p.rng.next() < .5 ? 2 : 1);
	}
	return {
		name: "Stalingrad, 1942",
		desc: "The ruined city on the Volga.",
		seed: 1942,
		cols: 96,
		rows: 64,
		routes: [{
			entry: {
				side: "L",
				from: 30,
				to: 33
			},
			exit: {
				side: "R",
				from: 30,
				to: 33
			}
		}],
		rocks: 0,
		rockList: p.rocks,
		paint: p.paint,
		theme: "ruins"
	};
}
function alamein() {
	const p = new Painter(104, 64, new Rng(1943));
	p.band(20, 22, 70, 18, 4, mount, 2, [.45], 6);
	p.band(40, 46, 96, 50, 3, mount, 2, [.3, .75], 6);
	return {
		name: "El Alamein, 1942",
		desc: "The desert line between the sea and the Qattara Depression.",
		seed: 1943,
		cols: 104,
		rows: 64,
		routes: [{
			entry: {
				side: "L",
				from: 30,
				to: 33
			},
			exit: {
				side: "R",
				from: 30,
				to: 33
			}
		}],
		rocks: 20,
		paint: p.paint,
		theme: "desert"
	};
}
function kursk() {
	const p = new Painter(120, 72, new Rng(1944));
	p.woods(6, 10, 4, 110, 68, [1.5, 3]);
	p.band(70, 0, 74, 71, 2, water, 4);
	return {
		name: "Kursk, 1943",
		desc: "Open steppe, two pincers, the greatest tank battle.",
		seed: 1944,
		cols: 120,
		rows: 72,
		routes: [{
			entry: {
				side: "L",
				from: 12,
				to: 15
			},
			exit: {
				side: "R",
				from: 34,
				to: 37
			}
		}, {
			entry: {
				side: "L",
				from: 56,
				to: 59
			},
			exit: {
				side: "R",
				from: 34,
				to: 37
			}
		}],
		rocks: 16,
		paint: p.paint,
		theme: "steppe"
	};
}
function omaha() {
	const p = new Painter(96, 72, new Rng(1945));
	p.rect(0, 62, 95, 71, water);
	p.band(0, 34, 95, 34, 5, mount, 1, [
		.2,
		.52,
		.82
	], 7);
	return {
		name: "Omaha Beach, 1944",
		desc: "The bluffs over the beach, the draws leading inland.",
		seed: 1945,
		cols: 96,
		rows: 72,
		routes: [{
			entry: {
				side: "B",
				from: 18,
				to: 21
			},
			exit: {
				side: "T",
				from: 30,
				to: 33
			}
		}, {
			entry: {
				side: "B",
				from: 74,
				to: 77
			},
			exit: {
				side: "T",
				from: 62,
				to: 65
			}
		}],
		rocks: 10,
		paint: p.paint,
		theme: "temperate"
	};
}
function bocage() {
	const p = new Painter(104, 72, new Rng(1946));
	for (let c = 12; c < 100; c += 13) p.band(c, 0, c, 71, 1.5, tree, 0, [.15 + c * 7 % 5 * .15, .7], 4);
	for (let r = 10; r < 70; r += 12) p.band(0, r, 103, r, 1.5, tree, 0, [
		.1 + r * 3 % 7 * .1,
		.55,
		.9
	], 4);
	return {
		name: "Normandy bocage, 1944",
		desc: "Small fields boxed in by hedgerows.",
		seed: 1946,
		cols: 104,
		rows: 72,
		routes: [{
			entry: {
				side: "L",
				from: 34,
				to: 37
			},
			exit: {
				side: "R",
				from: 34,
				to: 37
			}
		}],
		rocks: 12,
		paint: p.paint,
		theme: "temperate"
	};
}
function arnhem() {
	const p = new Painter(96, 64, new Rng(1947));
	p.rect(0, 30, 95, 34, water);
	p.woods(5, 6, 4, 90, 26, [2, 3.5]);
	return {
		name: "Arnhem, 1944",
		desc: "The bridge too far, held by paratroopers.",
		seed: 1947,
		cols: 96,
		rows: 64,
		routes: [{
			entry: {
				side: "T",
				from: 46,
				to: 49
			},
			exit: {
				side: "B",
				from: 46,
				to: 49
			}
		}],
		rocks: 26,
		paint: p.paint,
		theme: "temperate"
	};
}
function bastogne() {
	const p = new Painter(112, 72, new Rng(1948));
	p.woods(22, 4, 4, 108, 68, [2.5, 5]);
	return {
		name: "Bastogne, 1944",
		desc: "Encircled in the snow of the Ardennes.",
		seed: 1948,
		cols: 112,
		rows: 72,
		routes: [
			{
				entry: {
					side: "L",
					from: 34,
					to: 37
				},
				exit: {
					side: "R",
					from: 34,
					to: 37
				}
			},
			{
				entry: {
					side: "T",
					from: 30,
					to: 33
				},
				exit: {
					side: "R",
					from: 34,
					to: 37
				}
			},
			{
				entry: {
					side: "B",
					from: 30,
					to: 33
				},
				exit: {
					side: "R",
					from: 34,
					to: 37
				}
			}
		],
		rocks: 20,
		paint: p.paint,
		theme: "snow"
	};
}
function guadalcanal() {
	const p = new Painter(96, 64, new Rng(1949));
	p.woods(26, 4, 3, 80, 61, [2, 5]);
	p.band(46, 0, 50, 63, 2, water, 3);
	return {
		name: "Guadalcanal, 1942",
		desc: "The jungle perimeter round Henderson Field.",
		seed: 1949,
		cols: 96,
		rows: 64,
		routes: [{
			entry: {
				side: "L",
				from: 14,
				to: 17
			},
			exit: {
				side: "R",
				from: 30,
				to: 33
			}
		}, {
			entry: {
				side: "L",
				from: 46,
				to: 49
			},
			exit: {
				side: "R",
				from: 30,
				to: 33
			}
		}],
		rocks: 12,
		paint: p.paint,
		theme: "jungle"
	};
}
function iwojima() {
	const p = new Painter(96, 72, new Rng(1950));
	p.rect(0, 64, 95, 71, water);
	p.disc(12, 52, 9, mount, .2);
	p.band(30, 26, 88, 22, 3, mount, 2, [.35, .7], 6);
	return {
		name: "Iwo Jima, 1945",
		desc: "Black volcanic sand, Mount Suribachi and the caves.",
		seed: 1950,
		cols: 96,
		rows: 72,
		routes: [{
			entry: {
				side: "B",
				from: 44,
				to: 47
			},
			exit: {
				side: "T",
				from: 50,
				to: 53
			}
		}],
		rocks: 30,
		paint: p.paint,
		theme: "volcanic"
	};
}
function okinawa() {
	const p = new Painter(104, 80, new Rng(1951));
	p.band(0, 22, 103, 24, 3, mount, 2, [.25, .7], 6);
	p.band(0, 42, 103, 40, 3, mount, 2, [.45, .85], 6);
	p.band(0, 60, 103, 62, 3, mount, 2, [.15, .6], 6);
	return {
		name: "Okinawa, 1945",
		desc: "The Shuri Line: ridge after ridge.",
		seed: 1951,
		cols: 104,
		rows: 80,
		routes: [{
			entry: {
				side: "T",
				from: 50,
				to: 53
			},
			exit: {
				side: "B",
				from: 50,
				to: 53
			}
		}],
		rocks: 24,
		paint: p.paint,
		theme: "temperate"
	};
}
function seelow() {
	const p = new Painter(112, 68, new Rng(1952));
	p.band(18, 0, 22, 67, 3, water, 2);
	p.band(58, 0, 62, 67, 4, mount, 2, [.3, .7], 7);
	return {
		name: "Seelow Heights, 1945",
		desc: "The last line before Berlin.",
		seed: 1952,
		cols: 112,
		rows: 68,
		routes: [{
			entry: {
				side: "L",
				from: 32,
				to: 35
			},
			exit: {
				side: "R",
				from: 32,
				to: 35
			}
		}],
		rocks: 18,
		paint: p.paint,
		theme: "temperate"
	};
}
var BATTLES = [
	{
		id: "moscow",
		name: "Moscow",
		place: "Moscow, December 1941",
		year: 1941,
		side: "su",
		foe: "de",
		map: moscow(),
		waves: 20,
		brief: "Operation Typhoon has brought the Wehrmacht to the gates of Moscow, and the winter has come early. The German columns are frozen and short of everything — but they keep coming. Hold until the Siberian divisions arrive.",
		foeSpeed: .85,
		roster: {
			medium2: 7,
			heavy: 7,
			boss: 9
		},
		banned: ["super"],
		weather: "snow",
		hour: 10
	},
	{
		id: "stalingrad",
		name: "Stalingrad",
		place: "Stalingrad, autumn 1942",
		year: 1942,
		side: "su",
		foe: "de",
		map: stalingrad(),
		waves: 25,
		brief: "\"There is no land beyond the Volga.\" Every ruined block is a fortress. The 6th Army throws its infantry and pioneers at the city; snipers hunt in the rubble. Keep Pavlov's House standing and hold the river bank.",
		objective: {
			slot: "hq",
			col: 70,
			row: 26,
			name: "Pavlov's House"
		},
		roster: {
			medium2: 7,
			boss: 9
		},
		doctrine: {
			inf: 1.25,
			armour: .7
		},
		hour: 15
	},
	{
		id: "alamein",
		name: "El Alamein",
		place: "El Alamein, July 1942",
		year: 1942,
		side: "us",
		foe: "de",
		map: alamein(),
		waves: 20,
		brief: "Rommel's Afrika Korps races for Alexandria and the Suez Canal. Between the sea and the impassable Qattara Depression there is one line left to hold. The minefields are already laid.",
		roster: {
			medium2: 7,
			heavy: 7,
			boss: 9
		},
		banned: ["super"],
		hour: 5,
		preset: [...[
			0,
			1,
			2,
			3,
			4,
			5
		].map((k) => ({
			slot: "atmine",
			col: 54 + k % 3 * 2,
			row: 29 + Math.floor(k / 3) * 3
		})), ...[
			0,
			1,
			2,
			3
		].map((k) => ({
			slot: "apmine",
			col: 60 + k % 2 * 2,
			row: 30 + Math.floor(k / 2) * 2
		}))]
	},
	{
		id: "kursk",
		name: "Kursk",
		place: "Prokhorovka, July 1943",
		year: 1943,
		side: "su",
		foe: "de",
		map: kursk(),
		waves: 30,
		brief: "Operation Citadel: the Panthers and Tigers make their debut against the Kursk salient. The Red Army has had three months to dig belts of anti-tank guns and mines. Build a Pakfront deep enough to stop the greatest tank battle in history.",
		doctrine: {
			inf: .8,
			armour: 1.4
		},
		money: 1.4,
		hour: 7
	},
	{
		id: "omaha",
		name: "Omaha Beach",
		place: "Normandy, 6 June 1944",
		year: 1944,
		side: "de",
		foe: "us",
		map: omaha(),
		waves: 20,
		brief: "D-Day. The Allied landing craft are coming in on the beach under your bluffs. The Atlantic Wall bunkers and hedgehogs are in place; the draws are the only ways up. Few tanks make it ashore — the infantry come in waves.",
		doctrine: {
			inf: 1.35,
			armour: .5,
			air: 1.4
		},
		weather: "rain",
		hour: 6,
		preset: [
			{
				slot: "bunker",
				col: 16,
				row: 38,
				level: 2
			},
			{
				slot: "bunker",
				col: 48,
				row: 38,
				level: 2
			},
			{
				slot: "bunker",
				col: 78,
				row: 38,
				level: 2
			},
			{
				slot: "mg",
				col: 22,
				row: 38
			},
			{
				slot: "mg",
				col: 72,
				row: 38
			},
			...[
				0,
				1,
				2,
				3,
				4,
				5,
				6,
				7
			].map((k) => ({
				slot: "teeth",
				col: 10 + k * 10,
				row: 58
			}))
		]
	},
	{
		id: "bocage",
		name: "Normandy Bocage",
		place: "Saint-Lô, July 1944",
		year: 1944,
		side: "de",
		foe: "us",
		map: bocage(),
		waves: 25,
		brief: "Behind the beaches the Allies are stuck in the hedgerow country: every small field is a fortress. The enemy rules the sky — the fighter-bombers come every wave.",
		doctrine: {
			inf: 1,
			armour: .9,
			air: 1.7
		},
		weather: "rain",
		hour: 9
	},
	{
		id: "arnhem",
		name: "Arnhem",
		place: "Arnhem, September 1944",
		year: 1944,
		side: "us",
		foe: "de",
		map: arnhem(),
		waves: 15,
		brief: "Market Garden: the paratroopers hold the north end of the bridge and wait for XXX Corps. They have no tanks and no heavy guns, and two SS Panzer divisions are refitting nearby. Keep the bridge until relieved.",
		objective: {
			slot: "hq",
			col: 52,
			row: 36,
			name: "Arnhem Bridge"
		},
		banned: [
			"tank",
			"motorpool",
			"heavyaa",
			"howitzer",
			"rockets",
			"super"
		],
		money: 1.3,
		weather: "fog",
		hour: 11
	},
	{
		id: "bastogne",
		name: "Bastogne",
		place: "The Ardennes, December 1944",
		year: 1944,
		side: "us",
		foe: "de",
		map: bastogne(),
		waves: 25,
		brief: "The Battle of the Bulge. The 101st Airborne is surrounded in Bastogne, attacked from every side by King Tigers in the snow. The sky is closed: no air support until the weather clears. \"Nuts!\"",
		objective: {
			slot: "hq",
			col: 96,
			row: 33,
			name: "101st Airborne HQ"
		},
		airFrom: 12,
		weather: "snow",
		hour: 13
	},
	{
		id: "guadalcanal",
		name: "Guadalcanal",
		place: "Henderson Field, October 1942",
		year: 1942,
		side: "us",
		foe: "jp",
		map: guadalcanal(),
		waves: 20,
		brief: "The Marines hold the perimeter round Henderson Field. At night the Japanese come out of the jungle in banzai charges. Lose the airfield and the island is lost.",
		objective: {
			slot: "airfield",
			col: 84,
			row: 30,
			name: "Henderson Field"
		},
		doctrine: {
			inf: 1.6,
			armour: .4
		},
		banned: ["super"],
		weather: "rain",
		hour: 17
	},
	{
		id: "iwojima",
		name: "Iwo Jima",
		place: "Iwo Jima, February 1945",
		year: 1945,
		side: "jp",
		foe: "us",
		map: iwojima(),
		waves: 25,
		brief: "General Kuribayashi has dug the whole island into a fortress of caves and tunnels. The Marines will land on the black sand beach, where the loose volcanic ash bogs down men and vehicles; let them come inland before the caves open fire.",
		preset: [
			{
				slot: "bunker",
				col: 30,
				row: 44,
				level: 1
			},
			{
				slot: "bunker",
				col: 62,
				row: 44,
				level: 1
			},
			{
				slot: "bunker",
				col: 46,
				row: 30,
				level: 1
			},
			{
				slot: "bunker",
				col: 38,
				row: 52,
				level: 1
			},
			{
				slot: "bunker",
				col: 56,
				row: 52,
				level: 1
			},
			{
				slot: "bunker",
				col: 46,
				row: 16,
				level: 1
			}
		],
		doctrine: {
			inf: 1.15,
			armour: .6
		},
		money: 1.5,
		foeSpeed: .85,
		hour: 9
	},
	{
		id: "okinawa",
		name: "Okinawa",
		place: "The Shuri Line, May 1945",
		year: 1945,
		side: "jp",
		foe: "us",
		map: okinawa(),
		waves: 25,
		brief: "Ridge after ridge across southern Okinawa: the Shuri Line. The May rains have turned the ground to mud under the American tanks and flamethrowers; every ridge must cost them dearly.",
		doctrine: {
			inf: .9,
			armour: .6
		},
		money: 1.8,
		foeSpeed: .85,
		weather: "rain",
		hour: 8
	},
	{
		id: "seelow",
		name: "Seelow Heights",
		place: "The Oder, April 1945",
		year: 1945,
		side: "de",
		foe: "su",
		map: seelow(),
		waves: 30,
		brief: "The last defensive line before Berlin. Zhukov's fronts cross the Oder with a million men, thousands of Katyushas and the IS-2s. Hold the heights.",
		doctrine: {
			inf: 1.1,
			armour: 1.3
		},
		hour: 3
	}
];
var battleById = (id) => id ? BATTLES.find((b) => b.id === id) : void 0;
//#endregion
//#region src/game/ww2_de.ts
var GERMAN = growAll([
	RT({
		kind: "mg42",
		slot: "mg",
		role: "gun",
		cat: "basic",
		name: "MG-42 Nest",
		short: "MG-42",
		desc: "1,200 rounds a minute: shreds and pins infantry. Bounces off armour.",
		hitsGround: true,
		hitsAir: true,
		airMult: .6,
		color: 13218410,
		turret: "w_mg42",
		sfx: "mg42",
		camo: .3,
		levels: [{
			cost: 15,
			damage: 3.2,
			range: 100,
			rate: 10,
			pen: 8,
			supp: .07,
			hp: 170,
			fort: 15
		}]
	}),
	RT({
		kind: "flak38",
		slot: "lightaa",
		role: "gun",
		cat: "basic",
		name: "2 cm Flak 38",
		short: "Flak 38",
		desc: "Light autocannon: deadly to aircraft, light vehicles and infantry.",
		hitsGround: true,
		hitsAir: true,
		airMult: 2.2,
		color: 10133616,
		turret: "w_flak38",
		sfx: "flak38",
		levels: [{
			cost: 35,
			damage: 9,
			range: 165,
			rate: 3.5,
			pen: 30,
			supp: .04,
			hp: 150,
			fort: 10
		}]
	}),
	RT({
		kind: "schreck",
		slot: "at",
		role: "at",
		cat: "basic",
		name: "Panzerschreck Team",
		short: "Schreck",
		desc: "Rocket launcher team. Very short range, goes through any tank.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 9075280,
		turret: "w_schreck",
		sfx: "schreck",
		camo: .7,
		levels: [{
			cost: 30,
			damage: 85,
			range: 70,
			rate: .3,
			pen: 170,
			hp: 100,
			fort: 12
		}]
	}),
	RT({
		kind: "sniper",
		slot: "sniper",
		role: "sniper",
		cat: "basic",
		name: "Scharfschütze",
		short: "Sniper",
		desc: "Kills a soldier per shot from far away. Useless against armour.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 6978122,
		turret: "w_sniper",
		sfx: "sniper",
		camo: .85,
		levels: [{
			cost: 45,
			damage: 60,
			range: 280,
			rate: .4,
			pen: 10,
			hp: 80,
			fort: 12
		}]
	}),
	RT({
		kind: "flamer",
		slot: "flamer",
		role: "flame",
		cat: "basic",
		name: "Flammenwerfer",
		short: "Flamer",
		desc: "Burns infantry and soft vehicles at point-blank range. Tanks are sealed.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 16742938,
		turret: "w_flamer",
		sfx: "flame",
		camo: .5,
		levels: [{
			cost: 40,
			damage: 22,
			range: 60,
			rate: 0,
			burn: 9,
			pen: 12,
			hp: 110,
			fort: 12
		}]
	}),
	RT({
		kind: "pak40",
		slot: "atgun",
		role: "at",
		cat: "precision",
		name: "7.5 cm PaK 40",
		short: "PaK 40",
		desc: "Anti-tank gun: slow, decisive shots. Kills T-34s from the side.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 8030810,
		turret: "w_pak40",
		sfx: "pak40",
		camo: .6,
		levels: [{
			cost: 55,
			damage: 75,
			range: 170,
			rate: .45,
			pen: 115,
			hp: 210,
			fort: 22
		}]
	}),
	RT({
		kind: "flak88",
		slot: "heavyaa",
		role: "at",
		cat: "precision",
		name: "8.8 cm Flak 36",
		short: "Flak 88",
		desc: "The \"Eighty-Eight\": long range, kills tanks and bombers alike.",
		hitsGround: true,
		hitsAir: true,
		airMult: 1,
		color: 11053200,
		turret: "w_flak88",
		sfx: "flak88",
		levels: [{
			cost: 120,
			damage: 120,
			range: 240,
			rate: .3,
			pen: 135,
			splash: 30,
			hp: 270,
			fort: 15
		}]
	}),
	RT({
		kind: "tiger",
		slot: "tank",
		role: "at",
		cat: "precision",
		name: "Tiger I (dug in)",
		short: "Tiger",
		desc: "A hull-down Tiger: the 8.8 cm KwK 36 outranges every Soviet tank.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 10128480,
		turret: "w_tiger",
		sfx: "tiger",
		camo: .4,
		levels: [{
			cost: 200,
			damage: 130,
			range: 210,
			rate: .28,
			pen: 140,
			hp: 730,
			fort: 100
		}]
	}),
	RT({
		kind: "bunker",
		slot: "bunker",
		role: "bunker",
		cat: "precision",
		name: "MG Bunker",
		short: "Bunker",
		desc: "Concrete pillbox with two MGs firing at two targets at once.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 9079418,
		turret: "w_bunker",
		sfx: "mg42",
		camo: .3,
		levels: [{
			cost: 45,
			damage: 3.5,
			range: 75,
			rate: 8,
			pen: 8,
			supp: .05,
			hp: 590,
			fort: 80
		}]
	}),
	RT({
		kind: "mortar",
		slot: "mortar",
		role: "cannon",
		cat: "fire",
		name: "8 cm Mortar",
		short: "Mortar",
		desc: "High-explosive bombs on infantry groups. Pins them down.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 10521178,
		turret: "w_mortar",
		sfx: "mortar",
		camo: .5,
		levels: [{
			cost: 40,
			damage: 26,
			range: 180,
			rate: .5,
			splash: 38,
			pen: 12,
			supp: .25,
			hp: 130,
			fort: 12
		}]
	}),
	RT({
		kind: "lefh18",
		slot: "howitzer",
		role: "arty",
		cat: "fire",
		name: "10.5 cm leFH 18",
		short: "Howitzer",
		desc: "Huge range and blast, but it needs an observation post to spot for it.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 8022602,
		turret: "w_lefh18",
		sfx: "arty",
		levels: [{
			cost: 110,
			damage: 150,
			range: 480,
			rate: .18,
			splash: 58,
			pen: 28,
			supp: .5,
			hp: 210,
			fort: 12
		}]
	}),
	RT({
		kind: "nebel",
		slot: "rockets",
		role: "cannon",
		cat: "fire",
		name: "Nebelwerfer 41",
		short: "Nebelwerfer",
		desc: "Six screaming rockets per salvo, scattered over the target area.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 11557434,
		turret: "w_nebel",
		sfx: "nebel",
		levels: [{
			cost: 130,
			damage: 65,
			range: 300,
			rate: .1,
			splash: 38,
			pen: 18,
			supp: .4,
			salvo: 6,
			hp: 140,
			fort: 8
		}]
	}),
	RT({
		kind: "depot",
		slot: "depot",
		role: "depot",
		cat: "support",
		name: "Supply Depot",
		short: "Depot",
		desc: "Keeps the guns in range supplied with ammunition (trucks from the HQ refill it), and pays out at every wave.",
		hitsGround: false,
		hitsAir: false,
		airMult: 0,
		color: 13676624,
		turret: "w_depot",
		aim: "static",
		targeted: false,
		levels: [{
			cost: 80,
			damage: 0,
			range: 180,
			rate: 0,
			income: 12,
			interest: .02,
			cap: 40,
			hp: 310,
			fort: 10
		}]
	}),
	RT({
		kind: "observer",
		slot: "observer",
		role: "radar",
		cat: "support",
		name: "Observation Post",
		short: "Observer",
		desc: "Spots for artillery, reveals snipers and extends the range of guns nearby.",
		hitsGround: false,
		hitsAir: false,
		airMult: 0,
		color: 5292192,
		turret: "w_observer",
		aim: "spin",
		targeted: false,
		levels: [{
			cost: 55,
			damage: 0,
			range: 170,
			rate: 0,
			buff: .1,
			hp: 110,
			fort: 12
		}]
	}),
	RT({
		kind: "hq",
		slot: "hq",
		role: "command",
		cat: "support",
		name: "Field HQ",
		short: "HQ",
		desc: "Officers and radios: emplacements in range fire faster.",
		hitsGround: false,
		hitsAir: false,
		airMult: 0,
		color: 12601914,
		turret: "w_hq",
		aim: "static",
		targeted: false,
		levels: [{
			cost: 90,
			damage: 0,
			range: 100,
			rate: 0,
			buff: .15,
			hp: 340,
			fort: 30
		}]
	}),
	RT({
		kind: "workshop",
		slot: "workshop",
		role: "workshop",
		cat: "support",
		name: "Repair Workshop",
		short: "Workshop",
		desc: "Pioneers patch up damaged emplacements in range, even under fire.",
		hitsGround: false,
		hitsAir: false,
		airMult: 0,
		color: 6986448,
		turret: "w_workshop",
		aim: "static",
		targeted: false,
		levels: [{
			cost: 70,
			damage: 0,
			range: 110,
			rate: 0,
			buff: .03,
			hp: 220,
			fort: 12
		}]
	}),
	RT({
		kind: "barracks",
		slot: "barracks",
		role: "barracks",
		cat: "units",
		name: "Barracks",
		short: "Barracks",
		desc: "Trains infantry squads, pioneers and medics to fight outside the emplacements.",
		hitsGround: false,
		hitsAir: false,
		airMult: 0,
		color: 9083498,
		turret: "w_barracks",
		aim: "static",
		targeted: false,
		single: true,
		levels: [{
			cost: 80,
			damage: 0,
			range: 0,
			rate: 0,
			hp: 300,
			fort: 15
		}]
	}),
	RT({
		kind: "motorpool",
		slot: "motorpool",
		role: "motorpool",
		cat: "units",
		name: "Motor Pool",
		short: "Motor Pool",
		desc: "Builds Panzer IVs, Panthers and Tigers that chase the enemy across the field.",
		hitsGround: false,
		hitsAir: false,
		airMult: 0,
		color: 10128480,
		turret: "w_motorpool",
		aim: "static",
		targeted: false,
		single: true,
		levels: [{
			cost: 150,
			damage: 0,
			range: 0,
			rate: 0,
			hp: 400,
			fort: 20
		}]
	}),
	RT({
		kind: "airfield",
		slot: "airfield",
		role: "airfield",
		cat: "units",
		name: "Fighter Airfield",
		short: "Airfield",
		desc: "Send (R) a pair of Fw 190s to patrol a point: they shoot down aircraft and strafe soft targets.",
		hitsGround: false,
		hitsAir: false,
		airMult: 0,
		color: 10133664,
		turret: "w_airfield",
		aim: "static",
		targeted: false,
		manual: true,
		sfx: "",
		levels: [{
			cost: 180,
			damage: 0,
			range: 0,
			rate: 0,
			charge: 45,
			hp: 300,
			fort: 10
		}]
	}),
	RT({
		kind: "teeth",
		slot: "teeth",
		role: "barricade",
		cat: "maze",
		name: "Dragon's Teeth",
		short: "Teeth",
		desc: "Concrete obstacles: a cheap 1×1 wall against vehicles. Infantry climb over, slowly.",
		size: 1,
		hitsGround: false,
		hitsAir: false,
		airMult: 0,
		color: 11578528,
		turret: null,
		aim: "static",
		targeted: false,
		single: true,
		levels: [{
			cost: 4,
			damage: 0,
			range: 0,
			rate: 0
		}]
	}),
	RT({
		kind: "wire",
		slot: "wire",
		role: "wire",
		cat: "maze",
		name: "Barbed Wire",
		short: "Wire",
		desc: "Goes on the path. Infantry get tangled and crawl; vehicles drive through.",
		walkable: true,
		hitsGround: false,
		hitsAir: false,
		airMult: 0,
		color: 9076848,
		turret: null,
		aim: "static",
		targeted: false,
		decal: "d_wire",
		levels: [{
			cost: 10,
			damage: 0,
			range: 0,
			rate: 0,
			slow: .4
		}]
	}),
	RT({
		kind: "teller",
		slot: "atmine",
		role: "mine",
		cat: "maze",
		name: "Teller Mines",
		short: "AT Mine",
		desc: "Anti-tank mines on the path: only vehicles set them off.",
		size: 1,
		walkable: true,
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 9075264,
		turret: null,
		aim: "static",
		targeted: false,
		decal: "d_teller",
		trigger: "vehicle",
		levels: [{
			cost: 25,
			damage: 160,
			range: 12,
			rate: .15,
			splash: 18,
			pen: 60
		}]
	}),
	RT({
		kind: "smine",
		slot: "apmine",
		role: "mine",
		cat: "maze",
		name: "S-Mines",
		short: "S-Mine",
		desc: "Bounding anti-personnel mines: they leap up and burst among infantry.",
		size: 1,
		walkable: true,
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 6974032,
		turret: null,
		aim: "static",
		targeted: false,
		decal: "d_smine",
		trigger: "infantry",
		levels: [{
			cost: 12,
			damage: 45,
			range: 12,
			rate: .3,
			splash: 34,
			pen: 0,
			supp: .5
		}]
	}),
	RT({
		kind: "roadblock",
		slot: "roadblock",
		role: "gate",
		cat: "maze",
		name: "Roadblock",
		short: "Roadblock",
		desc: "A barrier you can open and close (G) to reroute an attack mid-fight.",
		hitsGround: false,
		hitsAir: false,
		airMult: 0,
		color: 13672512,
		turret: null,
		aim: "static",
		targeted: false,
		single: true,
		levels: [{
			cost: 30,
			damage: 0,
			range: 0,
			rate: 0
		}]
	}),
	RT({
		kind: "stuka",
		slot: "strike",
		role: "stuka",
		cat: "super",
		name: "Stuka Airfield",
		short: "Stuka",
		desc: "Call in (R) three Ju 87s: dive-bombing that breaks tank columns.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 14729280,
		turret: "w_stuka",
		aim: "static",
		targeted: false,
		manual: true,
		sfx: "stuka",
		levels: [{
			cost: 220,
			damage: 380,
			range: 0,
			rate: 0,
			splash: 48,
			charge: 40,
			pen: 70,
			hp: 420,
			fort: 10
		}]
	}),
	RT({
		kind: "v2",
		slot: "super",
		role: "nuke",
		cat: "super",
		name: "V-2 Launch Site",
		short: "V-2",
		desc: "Vergeltungswaffe 2: a ballistic missile (R) on any point. It falls faster than sound — no warning.",
		hitsGround: true,
		hitsAir: false,
		airMult: 0,
		color: 15263452,
		turret: "w_v2",
		aim: "static",
		targeted: false,
		manual: true,
		sfx: "v2",
		levels: [{
			cost: 420,
			damage: 1100,
			range: 0,
			rate: 0,
			splash: 120,
			charge: 110,
			pen: 120,
			hp: 360,
			fort: 30
		}]
	})
]);
var GERMANY = {
	towers: GERMAN,
	units: [
		{
			kind: "grenadier",
			name: "Grenadier Squad",
			short: "Grenadiers",
			tex: "de_rifle",
			from: "barracks",
			cost: 35,
			manpower: 1,
			train: 6,
			hp: 70,
			speed: 42,
			radius: 6,
			inf: true,
			gun: {
				dmg: 5,
				range: 110,
				rate: 1.4,
				pen: 8,
				supp: .03,
				sfx: "mosin"
			},
			desc: "Riflemen: cheap, steady fire, and a body between the enemy and your guns."
		},
		{
			kind: "mgteam",
			name: "MG-42 Team",
			short: "MG Team",
			tex: "de_mg",
			from: "barracks",
			cost: 50,
			manpower: 1,
			train: 8,
			hp: 55,
			speed: 38,
			radius: 6,
			inf: true,
			gun: {
				dmg: 3,
				range: 125,
				rate: 9,
				pen: 8,
				supp: .07,
				still: true,
				sfx: "mg42"
			},
			desc: "A light machine gun that sets up wherever you need it. Must stop to fire."
		},
		{
			kind: "atteam",
			name: "Panzerschreck Team",
			short: "AT Team",
			tex: "de_schreck",
			from: "barracks",
			cost: 60,
			manpower: 1,
			train: 9,
			hp: 50,
			speed: 40,
			radius: 6,
			inf: true,
			camo: true,
			gun: {
				dmg: 85,
				range: 75,
				rate: .3,
				pen: 170,
				sfx: "schreck"
			},
			desc: "Tank hunters. Put them in Ambush where tanks pass close: hidden until they fire."
		},
		{
			kind: "sniperu",
			name: "Sniper",
			short: "Sniper",
			tex: "de_sniper",
			from: "barracks",
			cost: 55,
			manpower: 1,
			train: 9,
			hp: 35,
			speed: 40,
			radius: 6,
			inf: true,
			camo: true,
			gun: {
				dmg: 60,
				range: 270,
				rate: .4,
				pen: 10,
				sfx: "sniper"
			},
			desc: "Camouflaged marksman: the enemy only sees it when it fires."
		},
		{
			kind: "pioneer",
			name: "Pioneers",
			short: "Pioneers",
			tex: "de_pioneer",
			from: "barracks",
			cost: 45,
			manpower: 1,
			train: 8,
			hp: 60,
			speed: 44,
			radius: 6,
			inf: true,
			repair: 14,
			gun: {
				dmg: 4,
				range: 90,
				rate: 1,
				pen: 8,
				sfx: "mosin"
			},
			desc: "Combat engineers: repair damaged emplacements and raise rubble back up, free of charge."
		},
		{
			kind: "medic",
			name: "Sanitäter",
			short: "Medic",
			tex: "de_medic",
			from: "barracks",
			cost: 40,
			manpower: 1,
			train: 7,
			hp: 45,
			speed: 46,
			radius: 6,
			inf: true,
			heal: 6,
			desc: "Patches up soldiers and the commander nearby."
		},
		{
			kind: "pz4",
			name: "Panzer IV Ausf. H",
			short: "Panzer IV",
			tex: "de_pz4",
			from: "motorpool",
			cost: 200,
			manpower: 2,
			train: 15,
			hp: 330,
			speed: 46,
			radius: 12,
			arm: [
				80,
				30,
				20,
				15
			],
			gun: {
				dmg: 75,
				range: 190,
				rate: .32,
				pen: 105,
				splash: 12,
				still: true,
				sfx: "pak40"
			},
			desc: "The workhorse: the long 75 mm kills T-34s; its sides are thin."
		},
		{
			kind: "panther",
			name: "Panther Ausf. G",
			short: "Panther",
			tex: "de_panther",
			from: "motorpool",
			cost: 320,
			manpower: 2,
			train: 20,
			hp: 420,
			speed: 50,
			radius: 14,
			arm: [
				110,
				45,
				40,
				16
			],
			gun: {
				dmg: 90,
				range: 220,
				rate: .3,
				pen: 150,
				splash: 12,
				still: true,
				sfx: "pak40"
			},
			desc: "Sloped 80 mm front, a high-velocity gun that goes through almost anything. Keep its front to the enemy."
		},
		{
			kind: "tigeru",
			name: "Tiger I",
			short: "Tiger",
			tex: "de_tiger",
			from: "motorpool",
			cost: 420,
			manpower: 3,
			train: 25,
			hp: 560,
			speed: 32,
			radius: 14,
			arm: [
				100,
				80,
				80,
				25
			],
			gun: {
				dmg: 125,
				range: 210,
				rate: .24,
				pen: 140,
				splash: 16,
				still: true,
				sfx: "tiger"
			},
			desc: "Thick armour all round and the 8.8 cm gun: slow, and worth three lives of any column."
		},
		{
			kind: "fw190",
			name: "Fw 190 A",
			short: "Fw 190",
			tex: "de_fw190",
			from: "airfield",
			cost: 0,
			manpower: 0,
			train: 0,
			hp: 140,
			speed: 190,
			radius: 12,
			air: true,
			gun: {
				dmg: 10,
				range: 110,
				rate: 5,
				pen: 20,
				hitsAir: true,
				sfx: "flak38"
			},
			desc: "Fighters on patrol: they hunt aircraft first, then strafe soft targets."
		}
	],
	combos: [
		{
			a: "mg42",
			b: "wire",
			name: "Kill Zone",
			desc: "+30% fire rate",
			rate: 1.3
		},
		{
			a: "pak40",
			b: "pak40",
			name: "Pakfront",
			desc: "+20% fire rate",
			rate: 1.2
		},
		{
			a: "lefh18",
			b: "observer",
			name: "Fire Mission",
			desc: "+30% fire rate",
			rate: 1.3
		},
		{
			a: "sniper",
			b: "observer",
			name: "Spotter",
			desc: "+40% damage",
			dmg: 1.4
		},
		{
			a: "flak88",
			b: "flak38",
			name: "Flak Battery",
			desc: "+30% vs air",
			air: 1.3
		},
		{
			a: "bunker",
			b: "teeth",
			name: "Fortified",
			desc: "+25% damage",
			dmg: 1.25
		}
	],
	ranks: [
		"Schütze",
		"Gefreiter",
		"Obergefreiter",
		"Unteroffizier",
		"Feldwebel",
		"Leutnant",
		"Hauptmann",
		"Major",
		"Oberst",
		"General"
	],
	superName: "Luftwaffe & V-weapons",
	look: {
		base: "wbase",
		hero: "w_officer",
		nuke: "v2shell"
	},
	help: {
		mg42: "The MG-42 fires so fast it sounds like tearing cloth. It cuts down infantry and pins them: suppressed soldiers crawl and keep their heads down. Its 8 mm of penetration is nothing against armour, so it ignores tanks and only bothers armoured cars from the side. Wire in front of it makes a kill zone.",
		flak38: "A 20 mm autocannon on a light mount. Against aircraft it is the best value you can buy, and its rounds go through armoured cars and the side of a T-70. Medium tanks shrug it off.",
		schreck: "Two men with an 8.8 cm rocket launcher. The shaped charge goes through any tank from any side, but the range is tiny and reloading is slow. Hide teams where the maze makes tanks pass close.",
		sniper: "A marksman with a scoped Kar98k: one shot, one dead soldier, from very far away. Bullets can't get through armour, so the sniper only picks targets it can kill. Next to an observation post he gets +40% damage.",
		flamer: "Burns infantry and open vehicles at point-blank range; burning soldiers set the ones behind them alight. Closed-down tanks are sealed against it. Best at a tight bend of the maze.",
		pak40: "The standard German anti-tank gun. Each shot is slow but decisive: 115 mm of penetration kills a T-34 from the side and a KV-1 from behind. Tanks show their sides at every turn of your maze — that is where a PaK belongs. Two PaKs side by side form a Pakfront.",
		flak88: "The famous Eighty-Eight: long range, heavy shells and 135 mm of penetration. Against aircraft its time-fused shells burst at altitude. Expensive, but it answers both tanks and bombers.",
		tiger: "A Tiger I dug in hull-down: only the turret shows. Its 8.8 cm KwK 36 outranges every Soviet tank and goes through a T-34 from the front. The most powerful single gun you can field.",
		bunker: "A concrete pillbox with two MGs, each firing at its own target. Short range: build it into the maze wall where infantry squeeze past.",
		mortar: "Lobs high-explosive bombs that burst among infantry and pin them down. Blasts hit the thin top armour, but a mortar bomb is too small for any tank.",
		lefh18: "The 10.5 cm field howitzer: huge range and a big blast, but it can only see 140px by itself — build observation posts and it fires at everything they see. Its shells can break a tank's track, and go through light armour from above.",
		nebel: "Six rockets per salvo, howling as they come down, scattered over the target area. Devastating against infantry columns; slow to reload.",
		depot: "Every gun has an ammunition stock that firing uses up (artillery and anti-tank guns fastest, machine guns slowest); empty guns fire at a third of their rate. Guns in the depot's radius are refilled from its store, and the headquarters sends a truck to refill the store when it runs low (the enemy shoots at the trucks). The headquarters also supplies the guns near it. Produces no damage. At every new wave it pays a fixed income plus interest on the money you are holding (up to a cap).",
		observer: "An observation post with a scissors periscope. Artillery fires at anything it sees, Soviet snipers inside it are revealed, and guns nearby get extra range.",
		hq: "A field headquarters with officers and radios: every emplacement in range fires faster.",
		teeth: "Concrete dragon's teeth: a cheap 1×1 obstacle that blocks every vehicle. Shape the maze with it so tanks have to turn in front of your guns. Infantry can clamber over (at a third of their speed), so foot soldiers may take a short cut through a line of teeth — cover it with an MG.",
		wire: "Barbed wire on the path. It never blocks the route; infantry get tangled and crawl through, while vehicles drive straight over it.",
		teller: "Anti-tank mines buried in the path. Only a vehicle sets them off; the blast tears through the thin belly armour. They re-arm after a while.",
		smine: "Bounding mines that leap up and burst at waist height. Only infantry set them off. They pin down whoever survives.",
		roadblock: "A barrier you can open and close (G) to switch the route mid-wave. Closing is refused if units stand in it or if it would seal every route.",
		workshop: "Pioneers with a crane truck and spare parts. They go round every emplacement in range and patch up the damage, even in the middle of a fight. They can't raise rubble: rebuilding a destroyed emplacement (B) costs money.",
		v2: "The V-2 ballistic missile. When it is ready, press R and click anywhere on the map: a minute later... in this game a few seconds later, a tonne of explosive falls at three times the speed of sound. There is no warning, then the roar. It hits from straight above, so even the IS-2 is thin there.",
		barracks: "Trains infantry that fight outside the maze: grenadiers, MG-42 teams, Panzerschreck teams, snipers, pioneers (who repair emplacements and raise rubble for free) and medics. Select a unit and click the ground to send it; give it a stance — Hold, Guard (default: fights near its post), Hunt or Ambush. Units never block the path. Manpower limits how many you field: each HQ adds 4, each depot 2.",
		motorpool: "Builds tanks: the Panzer IV, the Panther and the Tiger. Tanks stop to fire and turn their thick front towards the target, so put them where the enemy comes at their front. Shift-drag to select several and send them together.",
		airfield: "A fighter strip. Press R and click a point: two Fw 190s take off and patrol there for 25 s, shooting down aircraft first and then strafing soft targets. Yaks will try to shoot them down.",
		stuka: "An airfield of Ju 87 dive bombers. When it is ready, press R and click: three Stukas dive one after another and drop their bombs on the target. The bombs hit the top armour, where even a KV-1 is thin."
	}
};
var WEHRMACHT_ARMY = {
	enemies: [
		{
			name: "Grenadier Squad",
			hp: 34,
			speed: 42,
			reward: 2,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "de_rifle",
			bio: 2,
			inf: true,
			gun: {
				dmg: 3,
				range: 110,
				rate: .75,
				pen: 7,
				supp: .03,
				fx: "rifle"
			}
		},
		{
			name: "Sturmgrenadiere",
			hp: 44,
			speed: 52,
			reward: 3,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "de_assault",
			bio: 2,
			inf: true,
			gun: {
				dmg: 4.2,
				range: 70,
				rate: 1.2,
				pen: 6,
				supp: .05,
				fx: "smg"
			}
		},
		{
			name: "Scharfschütze",
			hp: 26,
			speed: 46,
			reward: 4,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "de_sniper",
			bio: 2,
			inf: true,
			stealth: true,
			spot: 150,
			gun: {
				dmg: 14,
				range: 230,
				rate: .25,
				pen: 10,
				supp: .15,
				fx: "rifle"
			}
		},
		{
			name: "Sanitäter",
			hp: 40,
			speed: 44,
			reward: 5,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "de_medic",
			bio: 2,
			inf: true,
			heal: .08
		},
		{
			name: "Kübelwagen",
			hp: 50,
			speed: 95,
			reward: 3,
			armor: 0,
			air: false,
			radius: 8,
			lives: 1,
			tex: "de_kubel",
			bio: 1,
			spot: 220
		},
		{
			name: "SdKfz 251 Half-track",
			hp: 95,
			speed: 68,
			reward: 5,
			armor: 0,
			air: false,
			radius: 10,
			lives: 1,
			tex: "de_251",
			bio: .6,
			arm: [
				14,
				8,
				8,
				6
			],
			spot: 180,
			gun: {
				dmg: 3,
				range: 110,
				rate: 2.2,
				pen: 8,
				supp: .05,
				fx: "mg"
			}
		},
		{
			name: "Panzer III",
			hp: 140,
			speed: 48,
			reward: 6,
			armor: 0,
			air: false,
			radius: 11,
			lives: 1,
			tex: "de_pz3",
			bio: .4,
			arm: [
				50,
				30,
				30,
				12
			],
			gun: {
				dmg: 22,
				range: 165,
				rate: .3,
				pen: 60,
				supp: .2,
				halt: .5,
				fx: "tank"
			}
		},
		{
			name: "Panzer IV",
			hp: 200,
			speed: 42,
			reward: 8,
			armor: 0,
			air: false,
			radius: 12,
			lives: 2,
			tex: "de_pz4",
			bio: .35,
			arm: [
				80,
				30,
				20,
				15
			],
			gun: {
				dmg: 36,
				range: 185,
				rate: .24,
				pen: 105,
				supp: .3,
				halt: .6,
				splash: 14,
				fx: "tank"
			}
		},
		{
			name: "Panther",
			hp: 260,
			speed: 46,
			reward: 11,
			armor: 0,
			air: false,
			radius: 14,
			lives: 2,
			tex: "de_panther",
			bio: .35,
			arm: [
				110,
				45,
				40,
				16
			],
			gun: {
				dmg: 46,
				range: 210,
				rate: .22,
				pen: 150,
				supp: .3,
				halt: .6,
				splash: 14,
				fx: "tank"
			}
		},
		{
			name: "Tiger I",
			hp: 360,
			speed: 28,
			reward: 15,
			armor: 0,
			air: false,
			radius: 14,
			lives: 3,
			tex: "de_tiger",
			bio: .3,
			arm: [
				100,
				80,
				80,
				25
			],
			gun: {
				dmg: 52,
				range: 200,
				rate: .2,
				pen: 140,
				supp: .35,
				halt: .7,
				splash: 18,
				fx: "tank"
			}
		},
		{
			name: "King Tiger",
			hp: 2100,
			speed: 22,
			reward: 85,
			armor: 0,
			air: false,
			radius: 18,
			lives: 4,
			tex: "de_kingtiger",
			bio: .25,
			arm: [
				180,
				80,
				80,
				40
			],
			boss: true,
			gun: {
				dmg: 140,
				range: 230,
				rate: .1,
				pen: 190,
				supp: .6,
				halt: .9,
				splash: 30,
				fx: "tank"
			}
		},
		{
			name: "Ju 87 Stuka",
			hp: 90,
			speed: 74,
			reward: 6,
			armor: 0,
			air: true,
			radius: 13,
			lives: 1,
			tex: "de_ju87",
			bio: 0,
			arm: [
				10,
				10,
				8,
				8
			],
			gun: {
				dmg: 44,
				range: 60,
				rate: .3,
				pen: 70,
				supp: .35,
				splash: 26,
				fx: "rocket"
			}
		},
		{
			name: "Bf 109",
			hp: 65,
			speed: 115,
			reward: 4,
			armor: 0,
			air: true,
			radius: 12,
			lives: 1,
			tex: "de_bf109",
			bio: 0,
			gun: {
				dmg: 7,
				range: 120,
				rate: 3,
				pen: 15,
				supp: 0,
				fx: "mg",
				air: true
			}
		},
		{
			name: "Panzerwerfer 42",
			hp: 110,
			speed: 52,
			reward: 9,
			armor: 0,
			air: false,
			radius: 11,
			lives: 1,
			tex: "de_pzwerfer",
			bio: .8,
			arm: [
				10,
				8,
				8,
				6
			],
			gun: {
				dmg: 24,
				range: 330,
				rate: 1 / 14,
				pen: 30,
				supp: .5,
				halt: 1.2,
				splash: 30,
				salvo: 10,
				fx: "katyusha"
			}
		},
		{
			name: "Pioniere",
			hp: 45,
			speed: 46,
			reward: 5,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "de_pioneer",
			bio: 2,
			inf: true,
			gun: {
				dmg: 260,
				range: 22,
				rate: .25,
				pen: 150,
				supp: .6,
				fx: "satchel"
			}
		},
		{
			name: "Leutnant",
			hp: 40,
			speed: 44,
			reward: 8,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "de_officer",
			bio: 2,
			inf: true,
			officer: true,
			spot: 160,
			gun: {
				dmg: 3,
				range: 80,
				rate: .6,
				pen: 6,
				supp: .02,
				fx: "smg"
			}
		}
	],
	roster: {
		rifle: 0,
		assault: 1,
		sniper: 2,
		medic: 3,
		recon: 4,
		armcar: 5,
		light: 6,
		medium: 7,
		medium2: 8,
		heavy: 9,
		boss: 10,
		attack: 11,
		fighter: 12,
		rockets: 13,
		sapper: 14,
		officer: 15
	},
	doctrine: {
		inf: .85,
		armour: .85
	},
	help: [
		{
			text: "Grenadiers with Kar98k rifles and an MG 34: their fire pins your crews.",
			counter: "Machine guns, mortars, AP mines; wire slows them under your guns."
		},
		{
			text: "Assault grenadiers with MP 40s: fast and deadly up close.",
			counter: "Machine guns and flamethrowers; suppression slows them down."
		},
		{
			text: "A camouflaged sniper: invisible unless spotted, and it hunts your commander.",
			counter: "Observation posts reveal snipers; any emplacement spots one point-blank."
		},
		{
			text: "A medic who patches up everyone around.",
			counter: "Kill medics first (Strong targeting)."
		},
		{
			text: "A Kübelwagen with scouts: they spot hidden guns from far away.",
			counter: "Anything kills it. Keep it away from your camouflaged positions."
		},
		{
			text: "An armoured half-track with an MG 42; its crew spots hidden guns from afar.",
			counter: "Light anti-aircraft guns and anything heavier; rifle bullets bounce off."
		},
		{
			text: "The Panzer III: 50 mm of front armour and a 50 mm gun.",
			counter: "Any anti-tank gun; anti-tank rifles through the sides."
		},
		{
			text: "The Panzer IV: 80 mm at the front but thin sides, and a long 75 mm gun.",
			counter: "Anti-tank guns into the sides; the front takes a 90+ mm gun."
		},
		{
			text: "The Panther: a sloped 110 mm front that stops most guns, and a gun that goes through almost anything. Weak 45 mm sides.",
			counter: "Shoot its sides at the turns of your maze; mines and air strikes."
		},
		{
			text: "The Tiger I: 100 mm in front and 80 on the sides, and the 8.8 cm gun. Costs 3 lives.",
			counter: "Only heavy guns (85 mm and up) or flank shots at close range. Mines and bombs from above."
		},
		{
			text: "A boss: the King Tiger, with 180 mm of sloped front armour and the long 8.8 cm. Costs 4 lives.",
			counter: "Nothing goes through the front: its 80 mm sides at short range, mines, and bombs on its top."
		},
		{
			text: "The Ju 87 Stuka dive bomber: it drops a bomb on one of your positions. Armoured underneath.",
			counter: "Light flak and heavy anti-aircraft guns."
		},
		{
			text: "A Bf 109 fighter: it goes after your aircraft.",
			counter: "Anti-aircraft guns and machine guns."
		},
		{
			text: "The Panzerwerfer: ten rockets per salvo from long range, howling down on your positions.",
			counter: "A lightly armoured half-track: long-range guns or artillery with an observer."
		},
		{
			text: "Pioneers with satchel charges: they blow the weakest wall of a long maze, lift mines and cut wire.",
			counter: "Machine guns and AP mines before they reach the wall."
		},
		{
			text: "A platoon leader with his map case and pistol, leading the infantry of the wave. While he lives his men press on; if he falls, the wave loses heart and more of it breaks and falls back.",
			counter: "Snipers pick officers off first; anything that reaches him early in the wave."
		}
	]
};
//#endregion
//#region src/game/ww2_kit.ts
/**
* Every arsenal fills the same slots, in this order (the palette order), so the bot, the tests and
* the help can find "the anti-tank gun" whatever it is called.
*/
var SLOTS = [
	"mg",
	"lightaa",
	"at",
	"sniper",
	"flamer",
	"atgun",
	"heavyaa",
	"tank",
	"bunker",
	"mortar",
	"howitzer",
	"rockets",
	"depot",
	"observer",
	"hq",
	"workshop",
	"barracks",
	"motorpool",
	"airfield",
	"teeth",
	"wire",
	"atmine",
	"apmine",
	"roadblock",
	"strike",
	"super"
];
var INF = [
	"rifle",
	"assault",
	"sniper",
	"medic",
	"sapper",
	"officer"
];
var AIR = ["attack", "fighter"];
/**
* Wave n of an offensive by any army: infantry, motorised, armoured and combined-arms waves in
* turn, aircraft every fifth wave, a heavy breakthrough every tenth. Later in the war the late
* medium tank replaces the early one (wave 16).
*/
function assault(n, army) {
	const g = [];
	const R = army.roster;
	const d = army.doctrine ?? {};
	const add = (role, count, interval, delay = 0) => {
		const kind = R[role];
		if (kind === void 0) return;
		const f = INF.includes(role) ? d.inf ?? 1 : AIR.includes(role) ? d.air ?? 1 : role === "rockets" ? 1 : d.armour ?? 1;
		g.push({
			kind,
			count: Math.max(1, Math.round(count * f)),
			interval,
			delay
		});
	};
	const medium = n >= 16 && R.medium2 !== void 0 ? "medium2" : "medium";
	if (n % 10 === 0) {
		add("boss", n / 10, 7);
		add(medium, 2 + n / 6, 1.8, 2);
		add("rifle", 10 + n, .3);
	} else if (n % 5 === 0) {
		add("fighter", 4 + n * .3, .8);
		add("attack", n * .4 - 1, 1.2, 3);
		add("rifle", 8 + n * .6, .45, 3);
	} else switch (n % 4) {
		case 1:
			add("rifle", 12 + n * 1.6, .45);
			if (n > 3) add("assault", n * .6, .6, 3);
			break;
		case 2:
			add("recon", 4 + n * .5, .7);
			add("armcar", 2 + n * .4, 1.1, 2);
			add("assault", 4 + n * .5, .5, 4);
			break;
		case 3:
			if (n < 8) add("light", 2 + n * .4, 1.6);
			if (n >= 6) add(medium, n * .25, 2, 2);
			if (n >= 12) add("heavy", n * .1, 3, 6);
			add("assault", 4 + n * .4, .6, 1);
			break;
		default:
			add("rifle", 8 + n, .4);
			add(n >= 8 ? medium : "light", 1 + n * .3, 1.8, 2);
			if (n > 8) add("attack", n * .25, 1.4, 6);
	}
	if (R.officer !== void 0 && g.some((x) => x.kind === R.rifle || x.kind === R.assault)) g.push({
		kind: R.officer,
		count: 1,
		interval: 1,
		delay: 2
	});
	if (n >= 6 && n % 10 !== 0 && n % 5 !== 0 && n % 4 !== 1) add("sapper", 2 + n * .12, 1.4, 3);
	if (n >= 8 && n % 10 !== 0 && n % 5 !== 0 && (n % 4 === 3 || n % 4 === 0)) add("rockets", 1 + n * .05, 5, 6);
	if (n >= 7 && n % 3 === 1) add("sniper", 2 + n * .25, 1.2, 5);
	if (n >= 9 && n % 2 === 1) add("medic", 1 + n * .1, 3, 3);
	return g;
}
/**
* Another side's version of a tower: the template's behaviour and level-1 stats with this side's
* names, model and sound, and any stats changed. Grow the finished list with growAll().
*/
function derive(base, over) {
	const { lv, ...rest } = over;
	return RT({
		...base,
		...rest,
		levels: [{
			...base.levels[0],
			...lv
		}]
	});
}
/** The tower of a slot in an arsenal. */
var slotOf = (towers, slot) => towers[SLOTS.indexOf(slot)];
var RED_ARMY = {
	enemies: [
		{
			name: "Rifle Squad",
			hp: 30,
			speed: 44,
			reward: 2,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "su_rifle",
			bio: 2,
			inf: true,
			gun: {
				dmg: 2.5,
				range: 110,
				rate: .7,
				pen: 7,
				supp: .03,
				fx: "rifle"
			}
		},
		{
			name: "SMG Assault",
			hp: 40,
			speed: 54,
			reward: 3,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "su_smg",
			bio: 2,
			inf: true,
			gun: {
				dmg: 4,
				range: 70,
				rate: 1.1,
				pen: 6,
				supp: .05,
				fx: "smg"
			}
		},
		{
			name: "Sniper",
			hp: 26,
			speed: 46,
			reward: 4,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "su_sniper",
			bio: 2,
			inf: true,
			stealth: true,
			spot: 150,
			gun: {
				dmg: 14,
				range: 230,
				rate: .25,
				pen: 10,
				supp: .15,
				fx: "rifle"
			}
		},
		{
			name: "Medic",
			hp: 40,
			speed: 44,
			reward: 5,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "su_medic",
			bio: 2,
			inf: true,
			heal: .08
		},
		{
			name: "GAZ-67 Jeep",
			hp: 50,
			speed: 95,
			reward: 3,
			armor: 0,
			air: false,
			radius: 8,
			lives: 1,
			tex: "su_gaz",
			bio: 1,
			spot: 220
		},
		{
			name: "BA-64 Armoured Car",
			hp: 70,
			speed: 80,
			reward: 4,
			armor: 0,
			air: false,
			radius: 9,
			lives: 1,
			tex: "su_ba64",
			bio: .6,
			spot: 200,
			arm: [
				10,
				7,
				7,
				6
			],
			gun: {
				dmg: 3,
				range: 110,
				rate: 2,
				pen: 8,
				supp: .04,
				fx: "mg"
			}
		},
		{
			name: "T-70 Light Tank",
			hp: 120,
			speed: 50,
			reward: 6,
			armor: 0,
			air: false,
			radius: 11,
			lives: 1,
			tex: "su_t70",
			bio: .4,
			arm: [
				45,
				25,
				25,
				10
			],
			gun: {
				dmg: 20,
				range: 160,
				rate: .3,
				pen: 50,
				supp: .2,
				halt: .5,
				fx: "tank"
			}
		},
		{
			name: "T-34/76",
			hp: 190,
			speed: 42,
			reward: 8,
			armor: 0,
			air: false,
			radius: 13,
			lives: 2,
			tex: "su_t34",
			bio: .35,
			arm: [
				90,
				50,
				40,
				20
			],
			gun: {
				dmg: 36,
				range: 180,
				rate: .22,
				pen: 70,
				supp: .3,
				halt: .6,
				splash: 16,
				fx: "tank"
			}
		},
		{
			name: "T-34/85",
			hp: 230,
			speed: 42,
			reward: 10,
			armor: 0,
			air: false,
			radius: 13,
			lives: 2,
			tex: "su_t3485",
			bio: .35,
			arm: [
				90,
				60,
				45,
				20
			],
			gun: {
				dmg: 48,
				range: 190,
				rate: .2,
				pen: 100,
				supp: .3,
				halt: .6,
				splash: 18,
				fx: "tank"
			}
		},
		{
			name: "KV-1 Heavy Tank",
			hp: 320,
			speed: 28,
			reward: 14,
			armor: 0,
			air: false,
			radius: 14,
			lives: 3,
			tex: "su_kv1",
			bio: .3,
			arm: [
				110,
				80,
				70,
				30
			],
			gun: {
				dmg: 40,
				range: 180,
				rate: .2,
				pen: 75,
				supp: .3,
				halt: .7,
				splash: 16,
				fx: "tank"
			}
		},
		{
			name: "IS-2 Heavy Tank",
			hp: 2e3,
			speed: 24,
			reward: 80,
			armor: 0,
			air: false,
			radius: 16,
			lives: 4,
			tex: "su_is2",
			bio: .25,
			arm: [
				160,
				90,
				60,
				30
			],
			boss: true,
			gun: {
				dmg: 140,
				range: 220,
				rate: .1,
				pen: 160,
				supp: .6,
				halt: .9,
				splash: 30,
				fx: "tank"
			}
		},
		{
			name: "Il-2 Sturmovik",
			hp: 95,
			speed: 70,
			reward: 6,
			armor: 0,
			air: true,
			radius: 13,
			lives: 1,
			tex: "su_il2",
			bio: 0,
			arm: [
				12,
				12,
				8,
				8
			],
			gun: {
				dmg: 32,
				range: 70,
				rate: .35,
				pen: 40,
				supp: .3,
				splash: 24,
				fx: "rocket"
			}
		},
		{
			name: "Yak-9 Fighter",
			hp: 60,
			speed: 110,
			reward: 4,
			armor: 0,
			air: true,
			radius: 12,
			lives: 1,
			tex: "su_yak",
			bio: 0,
			gun: {
				dmg: 7,
				range: 120,
				rate: 3,
				pen: 15,
				supp: 0,
				fx: "mg",
				air: true
			}
		},
		{
			name: "BM-13 Katyusha",
			hp: 90,
			speed: 58,
			reward: 9,
			armor: 0,
			air: false,
			radius: 11,
			lives: 1,
			tex: "su_katyusha",
			bio: 1,
			gun: {
				dmg: 22,
				range: 340,
				rate: 1 / 14,
				pen: 30,
				supp: .5,
				halt: 1.2,
				splash: 30,
				salvo: 16,
				fx: "katyusha"
			}
		},
		{
			name: "Sapper Squad",
			hp: 45,
			speed: 46,
			reward: 5,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "su_sapper",
			bio: 2,
			inf: true,
			gun: {
				dmg: 260,
				range: 22,
				rate: .25,
				pen: 150,
				supp: .6,
				fx: "satchel"
			}
		},
		{
			name: "Lieutenant",
			hp: 40,
			speed: 44,
			reward: 8,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "su_officer",
			bio: 2,
			inf: true,
			officer: true,
			spot: 160,
			gun: {
				dmg: 3,
				range: 80,
				rate: .6,
				pen: 6,
				supp: .02,
				fx: "smg"
			}
		}
	],
	roster: {
		rifle: 0,
		assault: 1,
		sniper: 2,
		medic: 3,
		sapper: 14,
		recon: 4,
		armcar: 5,
		light: 6,
		medium: 7,
		medium2: 8,
		heavy: 9,
		boss: 10,
		attack: 11,
		fighter: 12,
		rockets: 13,
		officer: 15
	},
	help: [
		{
			text: "Riflemen with Mosin-Nagants, coming in great numbers. Their fire pins your crews, who then shoot slower; it only chips away at sandbags.",
			counter: "MG-42s, mortars, S-mines; wire slows them under your guns. Pinned infantry fire less."
		},
		{
			text: "Assault troops with PPSh submachine guns: faster and tougher than riflemen, deadly up close.",
			counter: "MG-42s and flamethrowers; suppression slows them down."
		},
		{
			text: "A sniper in camouflage: invisible to your guns unless spotted. Picks off your commander from far away.",
			counter: "Observation posts reveal snipers; any emplacement spots one point-blank."
		},
		{
			text: "A field medic who patches up everyone around.",
			counter: "Kill medics first (Strong targeting), with snipers or MGs."
		},
		{
			text: "A fast, unarmoured jeep carrying scouts: they spot camouflaged guns from far away and give them away to the whole column.",
			counter: "Anything hits it: MGs, flak, mortars. Keep the maze long."
		},
		{
			text: "A light armoured car on reconnaissance: rifle bullets bounce off its front, and its crew spots hidden guns from afar.",
			counter: "Flak 38 and anything heavier; MGs only from the side and rear."
		},
		{
			text: "A light tank with 45 mm of front armour and a 45 mm gun. Tanks halt to fire: hitting them while they aim is your chance.",
			counter: "Flak 38 through the sides, any anti-tank gun from any side."
		},
		{
			text: "The T-34: sloped 90 mm front, much thinner sides. Leaking one costs 2 lives.",
			counter: "PaK 40 into the sides at the turns of your maze; Panzerschreck, Tiger and 88 from any side."
		},
		{
			text: "The up-gunned T-34 of 1944, with a tougher turret and sides.",
			counter: "Tiger, 88 and Panzerschreck; PaK 40 into the sides."
		},
		{
			text: "The KV-1 heavy tank: slow, with armour that defeats most guns from the front. Costs 3 lives.",
			counter: "Tiger, Panzerschreck, 88 from the side; Teller mines and Stukas hit it from below and above."
		},
		{
			text: "A boss: the IS-2 heavy tank with 160 mm of front armour and a 122 mm gun. Costs 4 lives.",
			counter: "Only the Panzerschreck goes through the front. Flank it with Tigers and 88s; mines and Stukas."
		},
		{
			text: "The Il-2 Sturmovik ground-attack plane, armoured underneath: MG bullets bounce off.",
			counter: "Flak 38 and the 88."
		},
		{
			text: "A fast, unarmoured fighter.",
			counter: "Flak 38, the 88, and MG-42s."
		},
		{
			text: "The Katyusha — \"Stalin's organ\": sixteen rockets rippled off a truck, howling down on your positions from long range. The blasts hit sandbagged positions from above.",
			counter: "It is a soft truck: anything kills it if it reaches it. Long-range guns (88, Flak 38) or artillery spotted by an observation post; concrete bunkers shrug off the rockets."
		},
		{
			text: "Assault engineers with satchel charges. When your maze makes the way round long, they go straight for the weakest wall and blow it up; on the way they lift mines and cut wire.",
			counter: "MG-42s and S-mines before they reach the wall; deep mazes of strong, covered emplacements are not worth breaching."
		},
		{
			text: "A Red Army lieutenant leading the infantry of the wave, pistol in hand. While he lives his men press on; if he falls, the wave loses heart and more of it breaks and falls back.",
			counter: "Snipers pick officers off first; anything that reaches him early in the wave."
		}
	]
};
var G$2 = (slot) => slotOf(GERMAN, slot);
var cheap = (t, f = .85) => Math.round(t.levels[0].cost * f);
var SOVIET_DEFENCE = {
	towers: growAll([
		derive(G$2("mg"), {
			kind: "maxim",
			name: "Maxim M1910 Nest",
			short: "Maxim",
			desc: "Water-cooled, heavy and reliable: steady fire that pins infantry.",
			turret: "su_w_mg",
			sfx: "maxim",
			color: 11050346,
			lv: {
				cost: 12,
				damage: 3.8,
				rate: 7,
				range: 105
			}
		}),
		derive(G$2("lightaa"), {
			kind: "61k",
			name: "37 mm 61-K",
			short: "61-K",
			desc: "Automatic anti-aircraft gun: tears up aircraft and light vehicles.",
			turret: "su_w_aa",
			sfx: "flak38",
			lv: {
				cost: 32,
				damage: 13,
				rate: 2.4,
				range: 170,
				pen: 40
			}
		}),
		derive(G$2("at"), {
			kind: "ptrd",
			name: "PTRD-41 Team",
			short: "PTRD",
			desc: "A 14.5 mm anti-tank rifle: goes through light armour and the sides of light tanks.",
			turret: "su_w_ptrd",
			sfx: "ptrd",
			lv: {
				cost: 20,
				damage: 32,
				rate: .8,
				range: 115,
				pen: 38
			}
		}),
		derive(G$2("sniper"), {
			kind: "su_sniper",
			name: "Snaiper",
			short: "Sniper",
			desc: "A Mosin-Nagant with a PU scope: one shot, one soldier.",
			turret: "su_w_sniper"
		}),
		derive(G$2("flamer"), {
			kind: "roks",
			name: "ROKS-3 Flamethrower",
			short: "Flamer",
			desc: "Burns infantry and soft vehicles at point-blank range.",
			turret: "su_w_flamer",
			lv: { cost: cheap(G$2("flamer")) }
		}),
		derive(G$2("atgun"), {
			kind: "zis3",
			name: "76 mm ZiS-3",
			short: "ZiS-3",
			desc: "The divisional gun that did everything: cheap, accurate, kills tanks from the side.",
			turret: "su_w_zis3",
			sfx: "pak40",
			lv: {
				cost: 44,
				damage: 68,
				rate: .5,
				range: 175,
				pen: 95
			}
		}),
		derive(G$2("heavyaa"), {
			kind: "52k",
			name: "85 mm 52-K",
			short: "52-K",
			desc: "Heavy anti-aircraft gun that the Red Army turned on tanks: long range, 120 mm.",
			turret: "su_w_52k",
			sfx: "flak88",
			lv: {
				cost: 105,
				damage: 110,
				range: 230,
				pen: 120
			}
		}),
		derive(G$2("tank"), {
			kind: "su_t34dug",
			name: "T-34/85 (dug in)",
			short: "T-34/85",
			desc: "A T-34/85 hull-down in a revetment: the 85 mm gun and a sloped front.",
			turret: "su_w_t34",
			sfx: "f34",
			lv: {
				cost: 160,
				damage: 95,
				rate: .3,
				range: 195,
				pen: 100,
				hp: 640,
				fort: 90
			}
		}),
		derive(G$2("bunker"), {
			kind: "dot",
			name: "DOT Pillbox",
			short: "DOT",
			desc: "A concrete firing point with two Maxims.",
			turret: "su_w_dot",
			sfx: "maxim",
			lv: { cost: cheap(G$2("bunker")) }
		}),
		derive(G$2("mortar"), {
			kind: "pm41",
			name: "82 mm PM-41 Mortar",
			short: "Mortar",
			desc: "Bombs on infantry groups; pins them down.",
			turret: "su_w_mortar",
			lv: { cost: cheap(G$2("mortar")) }
		}),
		derive(G$2("howitzer"), {
			kind: "m30",
			name: "122 mm M-30",
			short: "M-30",
			desc: "The Red Army's workhorse howitzer: a big blast at long range, with an observer to spot.",
			turret: "su_w_m30",
			lv: {
				cost: 105,
				damage: 175,
				splash: 62,
				rate: .16
			}
		}),
		derive(G$2("rockets"), {
			kind: "bm13",
			name: "BM-13 Katyusha Battery",
			short: "Katyusha",
			desc: "\"Stalin's organ\": sixteen rockets per salvo, howling over the target area.",
			turret: "su_katyusha",
			sfx: "katyusha",
			lv: {
				cost: 145,
				damage: 30,
				rate: .08,
				splash: 32,
				salvo: 16
			}
		}),
		derive(G$2("depot"), {
			kind: "su_depot",
			name: "Supply Dump",
			short: "Depot",
			desc: "Keeps the guns in range supplied with ammunition (trucks from the HQ refill it), and pays out at every wave.",
			turret: "su_w_depot"
		}),
		derive(G$2("observer"), {
			kind: "su_observer",
			name: "Observation Post",
			short: "Observer",
			desc: "Spots for artillery, reveals snipers and extends the range of guns nearby.",
			turret: "su_w_observer"
		}),
		derive(G$2("hq"), {
			kind: "su_hq",
			name: "Regimental HQ",
			short: "HQ",
			desc: "The commissar and the radio: emplacements in range fire faster.",
			turret: "su_w_hq",
			lv: { cost: 80 }
		}),
		derive(G$2("workshop"), {
			kind: "su_workshop",
			name: "Repair Workshop",
			short: "Workshop",
			desc: "Engineers patch up damaged emplacements in range, even under fire.",
			turret: "su_w_workshop"
		}),
		derive(G$2("barracks"), {
			kind: "su_barracks",
			name: "Barracks",
			short: "Barracks",
			desc: "Trains rifle squads, Maxim and PTRD teams, snipers, sappers and medics.",
			turret: "su_w_barracks"
		}),
		derive(G$2("motorpool"), {
			kind: "su_motorpool",
			name: "Tank Park",
			short: "Tank Park",
			desc: "Builds T-34/85s, KV-1s and IS-2s.",
			turret: "su_w_motorpool"
		}),
		derive(G$2("airfield"), {
			kind: "su_airfield",
			name: "Fighter Airfield",
			short: "Airfield",
			desc: "Send (R) a pair of Yak-9s to patrol a point.",
			turret: "su_w_airfield"
		}),
		derive(G$2("teeth"), {
			kind: "hedgehog",
			name: "Czech Hedgehogs",
			short: "Hedgehogs",
			desc: "Welded steel rails: a cheap 1×1 wall against vehicles. Infantry climb over, slowly.",
			turret: null
		}),
		derive(G$2("wire"), {
			kind: "su_wire",
			name: "Barbed Wire",
			short: "Wire",
			desc: "Goes on the path. Infantry get tangled and crawl; vehicles drive through."
		}),
		derive(G$2("atmine"), {
			kind: "tm41",
			name: "TM-41 Mines",
			short: "AT Mine",
			desc: "Anti-tank mines on the path: only vehicles set them off.",
			lv: { cost: 20 }
		}),
		derive(G$2("apmine"), {
			kind: "pomz",
			name: "POMZ-2 Mines",
			short: "AP Mine",
			desc: "Stake mines with tripwires: only infantry set them off.",
			lv: { cost: 9 }
		}),
		derive(G$2("roadblock"), {
			kind: "su_roadblock",
			block: "roadblock",
			name: "Roadblock",
			short: "Roadblock",
			desc: "A barrier you can open and close (G) to reroute an attack mid-fight."
		}),
		derive(G$2("strike"), {
			kind: "il2strike",
			name: "Il-2 Regiment",
			short: "Il-2",
			desc: "Call in (R) four Shturmoviks: rockets and bombs that break tank columns.",
			turret: "su_w_il2field",
			sfx: "rs82",
			lv: {
				cost: 200,
				damage: 300,
				salvo: 4,
				pen: 60
			}
		}),
		derive(G$2("super"), {
			kind: "b4",
			name: "203 mm B-4 Howitzer",
			short: "B-4",
			desc: "\"Stalin's sledgehammer\": one enormous shell (R) on any point of the map.",
			turret: "su_w_b4",
			sfx: "arty",
			lv: {
				cost: 360,
				damage: 950,
				splash: 95,
				charge: 95,
				pen: 110
			}
		})
	]),
	units: [
		{
			kind: "su_squad",
			name: "Rifle Squad",
			short: "Riflemen",
			tex: "su_rifle",
			from: "barracks",
			cost: 28,
			manpower: 1,
			train: 5,
			hp: 65,
			speed: 44,
			radius: 6,
			inf: true,
			gun: {
				dmg: 5,
				range: 110,
				rate: 1.3,
				pen: 7,
				supp: .03,
				sfx: "mosin"
			},
			desc: "Riflemen with Mosin-Nagants: cheap, and many."
		},
		{
			kind: "su_maximteam",
			name: "Maxim Team",
			short: "Maxim",
			tex: "su_mgteam",
			from: "barracks",
			cost: 45,
			manpower: 1,
			train: 8,
			hp: 55,
			speed: 34,
			radius: 6,
			inf: true,
			gun: {
				dmg: 3.6,
				range: 120,
				rate: 7,
				pen: 8,
				supp: .07,
				still: true,
				sfx: "maxim"
			},
			desc: "A Maxim on wheels: it must stop and set up to fire."
		},
		{
			kind: "su_ptrdteam",
			name: "PTRD Team",
			short: "PTRD",
			tex: "su_ptrdteam",
			from: "barracks",
			cost: 40,
			manpower: 1,
			train: 8,
			hp: 50,
			speed: 40,
			radius: 6,
			inf: true,
			camo: true,
			gun: {
				dmg: 32,
				range: 115,
				rate: .8,
				pen: 38,
				still: true,
				sfx: "ptrd"
			},
			desc: "Anti-tank riflemen: they go through light armour and tank sides. Best in Ambush."
		},
		{
			kind: "su_sniperu",
			name: "Sniper",
			short: "Sniper",
			tex: "su_sniper",
			from: "barracks",
			cost: 50,
			manpower: 1,
			train: 9,
			hp: 35,
			speed: 40,
			radius: 6,
			inf: true,
			camo: true,
			gun: {
				dmg: 60,
				range: 270,
				rate: .4,
				pen: 10,
				sfx: "sniper"
			},
			desc: "A camouflaged marksman: the enemy only sees it when it fires."
		},
		{
			kind: "su_engineers",
			name: "Sappers",
			short: "Sappers",
			tex: "su_sapper",
			from: "barracks",
			cost: 40,
			manpower: 1,
			train: 8,
			hp: 60,
			speed: 46,
			radius: 6,
			inf: true,
			repair: 14,
			gun: {
				dmg: 4,
				range: 80,
				rate: 1.4,
				pen: 6,
				sfx: "ppsh"
			},
			desc: "Combat engineers: repair emplacements and raise rubble back up, free of charge."
		},
		{
			kind: "su_medicu",
			name: "Sanitarka",
			short: "Medic",
			tex: "su_medic",
			from: "barracks",
			cost: 35,
			manpower: 1,
			train: 7,
			hp: 45,
			speed: 46,
			radius: 6,
			inf: true,
			heal: 6,
			desc: "Patches up soldiers and the commander nearby."
		},
		{
			kind: "su_t3485u",
			name: "T-34/85",
			short: "T-34/85",
			tex: "su_t3485",
			from: "motorpool",
			cost: 190,
			manpower: 2,
			train: 14,
			hp: 330,
			speed: 50,
			radius: 13,
			arm: [
				90,
				60,
				45,
				20
			],
			gun: {
				dmg: 70,
				range: 190,
				rate: .3,
				pen: 100,
				splash: 12,
				still: true,
				sfx: "f34"
			},
			desc: "Fast and well armoured at the front: the tank that won the war."
		},
		{
			kind: "su_kv1u",
			name: "KV-1",
			short: "KV-1",
			tex: "su_kv1",
			from: "motorpool",
			cost: 260,
			manpower: 2,
			train: 18,
			hp: 480,
			speed: 30,
			radius: 14,
			arm: [
				110,
				80,
				70,
				30
			],
			gun: {
				dmg: 55,
				range: 180,
				rate: .28,
				pen: 75,
				splash: 14,
				still: true,
				sfx: "f34"
			},
			desc: "A heavy tank with armour all round; its 76 mm gun struggles with Panthers and Tigers."
		},
		{
			kind: "su_is2u",
			name: "IS-2",
			short: "IS-2",
			tex: "su_is2",
			from: "motorpool",
			cost: 420,
			manpower: 3,
			train: 25,
			hp: 600,
			speed: 34,
			radius: 16,
			arm: [
				160,
				90,
				60,
				30
			],
			gun: {
				dmg: 160,
				range: 220,
				rate: .12,
				pen: 160,
				splash: 24,
				still: true,
				sfx: "tiger"
			},
			desc: "The 122 mm gun goes through a Tiger's front; it reloads very slowly."
		},
		{
			kind: "su_yaku",
			name: "Yak-9",
			short: "Yak-9",
			tex: "su_yak",
			from: "airfield",
			cost: 0,
			manpower: 0,
			train: 0,
			hp: 120,
			speed: 200,
			radius: 12,
			air: true,
			gun: {
				dmg: 10,
				range: 110,
				rate: 5,
				pen: 20,
				hitsAir: true,
				sfx: "flak38"
			},
			desc: "Fighters on patrol: they hunt aircraft first, then strafe soft targets."
		}
	],
	combos: [
		{
			a: "maxim",
			b: "su_wire",
			name: "Kill Zone",
			desc: "+30% fire rate",
			rate: 1.3
		},
		{
			a: "zis3",
			b: "zis3",
			name: "Pakfront",
			desc: "+20% fire rate",
			rate: 1.2
		},
		{
			a: "m30",
			b: "su_observer",
			name: "Fire Mission",
			desc: "+30% fire rate",
			rate: 1.3
		},
		{
			a: "su_sniper",
			b: "su_observer",
			name: "Spotter",
			desc: "+40% damage",
			dmg: 1.4
		},
		{
			a: "52k",
			b: "61k",
			name: "Flak Battery",
			desc: "+30% vs air",
			air: 1.3
		},
		{
			a: "dot",
			b: "hedgehog",
			name: "Fortified",
			desc: "+25% damage",
			dmg: 1.25
		}
	],
	ranks: [
		"Krasnoarmeyets",
		"Yefreytor",
		"Ml. serzhant",
		"Serzhant",
		"Starshina",
		"Leytenant",
		"Kapitan",
		"Mayor",
		"Polkovnik",
		"General"
	],
	superName: "Air & heavy artillery",
	look: {
		base: "subase",
		hero: "su_officer",
		nuke: "shell"
	},
	help: {
		maxim: "The Maxim M1910 on its wheeled mount: slower than an MG-42 but tireless thanks to its water jacket. It cuts down and pins infantry; its bullets bounce off any armour.",
		"61k": "A 37 mm automatic gun: the best answer to aircraft, and it goes through armoured cars and the sides of light tanks.",
		ptrd: "Two men with a 2-metre anti-tank rifle. 38 mm of penetration: armoured cars, light tanks and the sides of a Panzer IV, nothing more. Cheap — hide them where light vehicles pass close.",
		su_sniper: "A sniper with a Mosin-Nagant: one shot, one dead soldier, from very far away. Useless against armour. Next to an observation post +40% damage.",
		roks: "Burns infantry and open vehicles at point-blank range; closed tanks are sealed against it.",
		zis3: "The ZiS-3: cheap, quick to load, 95 mm of penetration — it kills Panzer IVs from the front and Panthers from the side. Two side by side form a Pakfront.",
		"52k": "An 85 mm anti-aircraft gun: its 120 mm of penetration answers the Panther and the Tiger, and its shells burst among aircraft.",
		su_t34dug: "A T-34/85 dug in hull-down. Only the turret shows; its 85 mm gun outranges the Panzer IV.",
		dot: "A concrete pillbox with two Maxims, each firing at its own target. Short range: build it into the maze wall.",
		pm41: "An 82 mm mortar: bombs that burst among infantry and pin them down.",
		m30: "The 122 mm M-30 howitzer: a huge blast at long range, but it only sees 140px by itself — build observation posts.",
		bm13: "The Katyusha on a Studebaker truck: sixteen rockets per salvo, scattered over the target area with their famous howl. Devastating against infantry and soft vehicles.",
		su_depot: "Every gun has an ammunition stock that firing uses up (artillery and anti-tank guns fastest, machine guns slowest); empty guns fire at a third of their rate. Guns in the depot's radius are refilled from its store, and the headquarters sends a truck to refill the store when it runs low (the enemy shoots at the trucks). The headquarters also supplies the guns near it. Produces no damage. At every wave it pays a fixed income plus interest on the money you are holding.",
		su_observer: "An observation post: artillery fires at anything it sees, enemy snipers inside it are revealed, guns nearby get extra range.",
		su_hq: "A regimental headquarters: every emplacement in range fires faster.",
		su_workshop: "Engineers with spare parts: they patch up every emplacement in range. Rebuilding rubble (B) costs money.",
		su_barracks: "Trains infantry that fight outside the maze: riflemen, Maxim and PTRD teams, snipers, sappers (who repair emplacements for free) and medics. Select a unit and click the ground to send it; give it a stance. Manpower: each HQ adds 4, each depot 2.",
		su_motorpool: "Builds tanks: the T-34/85, the KV-1 and the IS-2. Tanks stop to fire and turn their front to the target.",
		su_airfield: "A fighter strip. Press R and click a point: two Yak-9s patrol there for 25 s, shooting down aircraft first.",
		hedgehog: "Czech hedgehogs: welded rails that no tank climbs. A cheap 1×1 obstacle; infantry clamber over at a third of their speed.",
		su_wire: "Barbed wire on the path: infantry get tangled and crawl, vehicles drive over it.",
		tm41: "Anti-tank mines: only a vehicle sets them off, and the blast tears through the belly armour.",
		pomz: "Stake mines with tripwires: only infantry set them off.",
		su_roadblock: "A barrier you can open and close (G) to switch the route mid-wave.",
		il2strike: "An Il-2 regiment. When ready, press R and click: four Shturmoviks dive on the target with rockets and bombs that hit the thin top armour.",
		b4: "The B-4 203 mm howitzer. When ready, press R and click anywhere: one 100 kg shell falls with a blast that wrecks even heavy tanks from above."
	}
};
//#endregion
//#region src/game/ww2_us.ts
var G$1 = (slot) => slotOf(GERMAN, slot);
var ALLIED_DEFENCE = {
	towers: growAll([
		derive(G$1("mg"), {
			kind: "m1919",
			name: ".30 cal M1919 Nest",
			short: ".30 cal",
			desc: "The Browning: steady fire that cuts down and pins infantry.",
			turret: "us_w_mg",
			sfx: "m1919",
			color: 9077856,
			lv: {
				cost: 14,
				damage: 3.4,
				rate: 7.5,
				range: 110
			}
		}),
		derive(G$1("lightaa"), {
			kind: "m45",
			name: "M45 Quadmount",
			short: "Quad .50",
			desc: "Four .50 calibre Brownings: shreds aircraft, trucks and infantry alike.",
			turret: "us_w_quad",
			sfx: "dt",
			lv: {
				cost: 40,
				damage: 6,
				rate: 8,
				range: 160,
				pen: 22,
				supp: .06
			}
		}),
		derive(G$1("at"), {
			kind: "bazooka",
			name: "Bazooka Team",
			short: "Bazooka",
			desc: "The M9 rocket launcher: short range, goes through a Panzer IV from the front.",
			turret: "us_w_bazooka",
			sfx: "bazooka",
			lv: {
				cost: 25,
				damage: 75,
				rate: .33,
				range: 80,
				pen: 100
			}
		}),
		derive(G$1("sniper"), {
			kind: "us_sniper",
			name: "Sniper",
			short: "Sniper",
			desc: "A Springfield M1903 with a scope: one shot, one soldier.",
			turret: "us_w_sniper"
		}),
		derive(G$1("flamer"), {
			kind: "us_flamer",
			name: "M2 Flamethrower",
			short: "Flamer",
			desc: "Burns infantry and soft vehicles at point-blank range.",
			turret: "us_w_flamer"
		}),
		derive(G$1("atgun"), {
			kind: "m1_57",
			name: "57 mm M1 Gun",
			short: "57 mm",
			desc: "The Allied anti-tank gun: kills the Panzer IV, needs the flank of a Panther.",
			turret: "us_w_57",
			sfx: "pak40",
			lv: {
				cost: 48,
				damage: 62,
				rate: .55,
				range: 170,
				pen: 95
			}
		}),
		derive(G$1("heavyaa"), {
			kind: "m2_90",
			name: "90 mm M2 Gun",
			short: "90 mm",
			desc: "Heavy anti-aircraft gun turned on tanks: long range, 150 mm of penetration.",
			turret: "us_w_90",
			sfx: "flak88",
			lv: {
				cost: 125,
				damage: 120,
				range: 240,
				pen: 150
			}
		}),
		derive(G$1("tank"), {
			kind: "us_shermandug",
			name: "Sherman 76 (dug in)",
			short: "Sherman",
			desc: "An M4A3 with the 76 mm gun, hull-down behind a berm.",
			turret: "us_w_sherman",
			sfx: "f34",
			lv: {
				cost: 150,
				damage: 85,
				rate: .32,
				range: 195,
				pen: 110,
				hp: 560,
				fort: 75
			}
		}),
		derive(G$1("bunker"), {
			kind: "us_bunker",
			name: "MG Bunker",
			short: "Bunker",
			desc: "A concrete pillbox with two .30 cals firing at two targets at once.",
			turret: "us_w_bunker",
			sfx: "m1919"
		}),
		derive(G$1("mortar"), {
			kind: "m1_81",
			name: "81 mm M1 Mortar",
			short: "Mortar",
			desc: "High-explosive bombs on infantry groups. Pins them down.",
			turret: "us_w_mortar"
		}),
		derive(G$1("howitzer"), {
			kind: "m2a1",
			name: "105 mm M2A1",
			short: "105 mm",
			desc: "The American way of war: a howitzer that fires fast and often. Needs an observer.",
			turret: "us_w_105",
			lv: {
				cost: 100,
				rate: .22
			}
		}),
		derive(G$1("rockets"), {
			kind: "calliope",
			name: "T34 Calliope",
			short: "Calliope",
			desc: "A Sherman with sixty rocket tubes over its turret: a storm on the target area.",
			turret: "us_calliope",
			sfx: "katyusha",
			lv: {
				cost: 140,
				damage: 34,
				rate: .09,
				splash: 32,
				salvo: 12
			}
		}),
		derive(G$1("depot"), {
			kind: "us_depot",
			name: "Supply Dump",
			short: "Depot",
			desc: "The richest supply chain of the war: keeps the guns in range in ammunition and pays out well at every wave.",
			turret: "us_w_depot",
			lv: {
				cost: 75,
				income: 16
			}
		}),
		derive(G$1("observer"), {
			kind: "us_observer",
			name: "Forward Observer",
			short: "Observer",
			desc: "Spots for artillery, reveals snipers and extends the range of guns nearby.",
			turret: "us_w_observer"
		}),
		derive(G$1("hq"), {
			kind: "us_hq",
			name: "Battalion HQ",
			short: "HQ",
			desc: "Radios and officers: emplacements in range fire faster.",
			turret: "us_w_hq"
		}),
		derive(G$1("workshop"), {
			kind: "us_workshop",
			name: "Ordnance Workshop",
			short: "Workshop",
			desc: "Ordnance men patch up damaged emplacements in range, even under fire.",
			turret: "us_w_workshop"
		}),
		derive(G$1("barracks"), {
			kind: "us_barracks",
			name: "Barracks",
			short: "Barracks",
			desc: "Trains rifle squads, .30 cal and bazooka teams, snipers, engineers and medics.",
			turret: "us_w_barracks"
		}),
		derive(G$1("motorpool"), {
			kind: "us_motorpool",
			name: "Motor Pool",
			short: "Motor Pool",
			desc: "Builds Shermans, Easy Eights and Pershings.",
			turret: "us_w_motorpool"
		}),
		derive(G$1("airfield"), {
			kind: "us_airfield",
			name: "Fighter Strip",
			short: "Airfield",
			desc: "Send (R) a pair of P-51 Mustangs to patrol a point.",
			turret: "us_w_airfield"
		}),
		derive(G$1("teeth"), {
			kind: "us_teeth",
			name: "Concrete Blocks",
			short: "Blocks",
			desc: "Concrete obstacles: a cheap 1×1 wall against vehicles. Infantry climb over, slowly.",
			block: "teeth"
		}),
		derive(G$1("wire"), {
			kind: "us_wire",
			name: "Concertina Wire",
			short: "Wire",
			desc: "Goes on the path. Infantry get tangled and crawl; vehicles drive through."
		}),
		derive(G$1("atmine"), {
			kind: "m1mine",
			name: "M1 AT Mines",
			short: "AT Mine",
			desc: "Anti-tank mines on the path: only vehicles set them off."
		}),
		derive(G$1("apmine"), {
			kind: "m2mine",
			name: "M2 Bounding Mines",
			short: "AP Mine",
			desc: "Bounding mines that burst at waist height: only infantry set them off."
		}),
		derive(G$1("roadblock"), {
			kind: "us_roadblock",
			name: "Roadblock",
			short: "Roadblock",
			desc: "A barrier you can open and close (G) to reroute an attack mid-fight.",
			block: "roadblock"
		}),
		derive(G$1("strike"), {
			kind: "p47",
			name: "P-47 Thunderbolts",
			short: "P-47",
			desc: "Call in (R) four Jugs: rockets and bombs on a point. Air superiority: they are back soon.",
			turret: "us_w_p47field",
			sfx: "rs82",
			lv: {
				cost: 210,
				damage: 260,
				salvo: 4,
				pen: 80,
				charge: 32
			}
		}),
		derive(G$1("super"), {
			kind: "littleboy",
			name: "Little Boy (B-29)",
			short: "Little Boy",
			desc: "The atomic bomb. A B-29 drops it (R) on any point: nothing survives the blast.",
			turret: "us_w_littleboy",
			sfx: "",
			lv: {
				cost: 900,
				damage: 4e3,
				splash: 230,
				charge: 240,
				pen: 400
			}
		})
	]),
	units: [
		{
			kind: "us_squad",
			name: "Rifle Squad",
			short: "GIs",
			tex: "us_rifle",
			from: "barracks",
			cost: 35,
			manpower: 1,
			train: 6,
			hp: 70,
			speed: 44,
			radius: 6,
			inf: true,
			gun: {
				dmg: 6,
				range: 110,
				rate: 1.5,
				pen: 8,
				supp: .03,
				sfx: "mosin"
			},
			desc: "GIs with M1 Garands: the semi-automatic rifle gives a squad heavy fire."
		},
		{
			kind: "us_30team",
			name: ".30 cal Team",
			short: ".30 cal",
			tex: "us_mg",
			from: "barracks",
			cost: 48,
			manpower: 1,
			train: 8,
			hp: 55,
			speed: 38,
			radius: 6,
			inf: true,
			gun: {
				dmg: 3.4,
				range: 120,
				rate: 7.5,
				pen: 8,
				supp: .06,
				still: true,
				sfx: "m1919"
			},
			desc: "A light machine gun team. Must stop to fire."
		},
		{
			kind: "us_bazteam",
			name: "Bazooka Team",
			short: "Bazooka",
			tex: "us_bazooka",
			from: "barracks",
			cost: 55,
			manpower: 1,
			train: 9,
			hp: 50,
			speed: 40,
			radius: 6,
			inf: true,
			camo: true,
			gun: {
				dmg: 75,
				range: 80,
				rate: .33,
				pen: 100,
				sfx: "bazooka"
			},
			desc: "Tank hunters with the M9. Best in Ambush where tanks pass close."
		},
		{
			kind: "us_snipu",
			name: "Sniper",
			short: "Sniper",
			tex: "us_sniper",
			from: "barracks",
			cost: 55,
			manpower: 1,
			train: 9,
			hp: 35,
			speed: 40,
			radius: 6,
			inf: true,
			camo: true,
			gun: {
				dmg: 60,
				range: 270,
				rate: .4,
				pen: 10,
				sfx: "sniper"
			},
			desc: "A camouflaged marksman: the enemy only sees it when it fires."
		},
		{
			kind: "us_engineers",
			name: "Combat Engineers",
			short: "Engineers",
			tex: "us_engineer",
			from: "barracks",
			cost: 45,
			manpower: 1,
			train: 8,
			hp: 60,
			speed: 44,
			radius: 6,
			inf: true,
			repair: 16,
			gun: {
				dmg: 5,
				range: 100,
				rate: 1.2,
				pen: 8,
				sfx: "mosin"
			},
			desc: "Repair emplacements and raise rubble back up, free of charge."
		},
		{
			kind: "us_medicu",
			name: "Medic",
			short: "Medic",
			tex: "us_medic",
			from: "barracks",
			cost: 40,
			manpower: 1,
			train: 7,
			hp: 45,
			speed: 46,
			radius: 6,
			inf: true,
			heal: 7,
			desc: "Patches up soldiers and the commander nearby."
		},
		{
			kind: "us_shermanu",
			name: "M4 Sherman",
			short: "Sherman",
			tex: "us_sherman",
			from: "motorpool",
			cost: 170,
			manpower: 2,
			train: 13,
			hp: 320,
			speed: 50,
			radius: 12,
			arm: [
				90,
				38,
				38,
				19
			],
			gun: {
				dmg: 50,
				range: 180,
				rate: .36,
				pen: 75,
				splash: 14,
				still: true,
				sfx: "f34"
			},
			desc: "Reliable and quick to fire (its gun is stabilised), but the 75 mm struggles with Panthers."
		},
		{
			kind: "us_easy8u",
			name: "M4A3E8 \"Easy Eight\"",
			short: "Easy Eight",
			tex: "us_easy8",
			from: "motorpool",
			cost: 240,
			manpower: 2,
			train: 16,
			hp: 360,
			speed: 52,
			radius: 13,
			arm: [
				100,
				38,
				38,
				19
			],
			gun: {
				dmg: 70,
				range: 195,
				rate: .34,
				pen: 115,
				splash: 12,
				still: true,
				sfx: "f34"
			},
			desc: "The 76 mm Sherman on new suspension: fast, and the gun goes through a Tiger's side."
		},
		{
			kind: "us_pershingu",
			name: "M26 Pershing",
			short: "Pershing",
			tex: "us_pershing",
			from: "motorpool",
			cost: 400,
			manpower: 3,
			train: 24,
			hp: 560,
			speed: 38,
			radius: 15,
			arm: [
				150,
				76,
				50,
				25
			],
			gun: {
				dmg: 115,
				range: 215,
				rate: .26,
				pen: 150,
				splash: 16,
				still: true,
				sfx: "tiger"
			},
			desc: "The heavy tank at last: thick front and a 90 mm gun."
		},
		{
			kind: "us_p51u",
			name: "P-51 Mustang",
			short: "P-51",
			tex: "us_p51",
			from: "airfield",
			cost: 0,
			manpower: 0,
			train: 0,
			hp: 140,
			speed: 210,
			radius: 12,
			air: true,
			gun: {
				dmg: 11,
				range: 115,
				rate: 5,
				pen: 22,
				hitsAir: true,
				sfx: "dt"
			},
			desc: "Fighters on patrol: they hunt aircraft first, then strafe soft targets."
		}
	],
	combos: [
		{
			a: "m1919",
			b: "us_wire",
			name: "Kill Zone",
			desc: "+30% fire rate",
			rate: 1.3
		},
		{
			a: "m1_57",
			b: "m1_57",
			name: "Gun Line",
			desc: "+20% fire rate",
			rate: 1.2
		},
		{
			a: "m2a1",
			b: "us_observer",
			name: "Time on Target",
			desc: "+30% fire rate",
			rate: 1.3
		},
		{
			a: "us_sniper",
			b: "us_observer",
			name: "Spotter",
			desc: "+40% damage",
			dmg: 1.4
		},
		{
			a: "m2_90",
			b: "m45",
			name: "AA Battery",
			desc: "+30% vs air",
			air: 1.3
		},
		{
			a: "us_bunker",
			b: "us_teeth",
			name: "Fortified",
			desc: "+25% damage",
			dmg: 1.25
		}
	],
	ranks: [
		"Private",
		"Private 1st Class",
		"Corporal",
		"Sergeant",
		"2nd Lieutenant",
		"1st Lieutenant",
		"Captain",
		"Major",
		"Colonel",
		"General"
	],
	superName: "Air power",
	look: {
		base: "usbase",
		hero: "us_officer",
		nuke: "littleboy"
	},
	help: {
		m1919: "The Browning M1919: slower than an MG-42 but steady. It cuts down and pins infantry; its bullets bounce off any armour. Wire in front of it makes a kill zone.",
		m45: "Four .50 calibre machine guns in a power turret. The best answer to aircraft, and 22 mm of penetration goes through half-tracks and armoured cars.",
		bazooka: "Two men with an M9 bazooka: short range, slow to reload, 100 mm of penetration — a Panzer IV from the front, a Panther or Tiger only from the side.",
		us_sniper: "A sniper with a Springfield: one shot, one dead soldier, from far away. Useless against armour. Next to an observer +40% damage.",
		us_flamer: "Burns infantry and open vehicles at point-blank range; closed tanks are sealed against it.",
		m1_57: "The 57 mm (a British 6-pounder built in America): 95 mm of penetration kills a Panzer IV from any side and a Panther from the flank. Two side by side form a gun line.",
		m2_90: "The 90 mm anti-aircraft gun: 150 mm of penetration answers the Panther's front and the Tiger, and its shells burst among aircraft.",
		us_shermandug: "A Sherman with the 76 mm gun dug in hull-down: 110 mm of penetration and a sloped front.",
		us_bunker: "A concrete pillbox with two .30 cals, each firing at its own target.",
		m1_81: "An 81 mm mortar: bombs that burst among infantry and pin them down.",
		m2a1: "The 105 mm howitzer. American artillery fired faster and more often than anyone's: a big blast at long range, but it needs observers to see.",
		calliope: "The T34 Calliope: a rocket frame over a Sherman. Twelve rockets per salvo scattered over the target area.",
		us_depot: "Every gun has an ammunition stock that firing uses up (artillery and anti-tank guns fastest, machine guns slowest); empty guns fire at a third of their rate. Guns in the depot's radius are refilled from its store, and the headquarters sends a truck to refill the store when it runs low (the enemy shoots at the trucks). The headquarters also supplies the guns near it. The supply chain: a larger income at every wave than any other side's depot, plus interest on the money you keep.",
		us_observer: "A forward observer: artillery fires at anything it sees, enemy snipers are revealed, guns nearby get extra range.",
		us_hq: "A battalion headquarters: every emplacement in range fires faster.",
		us_workshop: "Ordnance men with spare parts patch up every emplacement in range. Rebuilding rubble (B) costs money.",
		us_barracks: "Trains infantry that fight outside the maze: GIs, .30 cal and bazooka teams, snipers, engineers (who repair emplacements for free) and medics. Select a unit and click the ground to send it; give it a stance. Manpower: each HQ adds 4, each depot 2.",
		us_motorpool: "Builds tanks: the Sherman, the Easy Eight and the Pershing. Tanks stop to fire and turn their front to the target.",
		us_airfield: "A fighter strip. Press R and click a point: two P-51s patrol there for 25 s, shooting down aircraft first.",
		us_teeth: "Concrete blocks: a cheap 1×1 obstacle that stops every vehicle. Infantry can clamber over at a third of their speed.",
		us_wire: "Concertina wire on the path: infantry get tangled and crawl, vehicles drive over it.",
		m1mine: "Anti-tank mines: only a vehicle sets them off.",
		m2mine: "Bounding mines: only infantry set them off.",
		us_roadblock: "A barrier you can open and close (G) to switch the route mid-wave.",
		p47: "P-47 Thunderbolts. When ready, press R and click: four of them strike the target with rockets and bombs on the thin top armour. With air superiority they are back quickly.",
		littleboy: "Little Boy, the uranium bomb. When ready (it takes a long time), press R and click anywhere: a B-29 drops it and the blast destroys everything over a huge area, heavy tanks included."
	}
};
var US_ARMY = {
	enemies: [
		{
			name: "GI Rifle Squad",
			hp: 34,
			speed: 44,
			reward: 2,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "us_rifle",
			bio: 2,
			inf: true,
			gun: {
				dmg: 3,
				range: 110,
				rate: .8,
				pen: 7,
				supp: .03,
				fx: "rifle"
			}
		},
		{
			name: "Rangers",
			hp: 46,
			speed: 54,
			reward: 3,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "us_ranger",
			bio: 2,
			inf: true,
			gun: {
				dmg: 4.2,
				range: 70,
				rate: 1.2,
				pen: 6,
				supp: .05,
				fx: "smg"
			}
		},
		{
			name: "Sniper",
			hp: 26,
			speed: 46,
			reward: 4,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "us_sniper",
			bio: 2,
			inf: true,
			stealth: true,
			spot: 150,
			gun: {
				dmg: 14,
				range: 230,
				rate: .25,
				pen: 10,
				supp: .15,
				fx: "rifle"
			}
		},
		{
			name: "Medic",
			hp: 40,
			speed: 46,
			reward: 5,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "us_medic",
			bio: 2,
			inf: true,
			heal: .09
		},
		{
			name: "Jeep",
			hp: 50,
			speed: 100,
			reward: 3,
			armor: 0,
			air: false,
			radius: 8,
			lives: 1,
			tex: "us_jeep",
			bio: 1,
			spot: 220
		},
		{
			name: "M8 Greyhound",
			hp: 70,
			speed: 82,
			reward: 5,
			armor: 0,
			air: false,
			radius: 10,
			lives: 1,
			tex: "us_m8",
			bio: .6,
			arm: [
				12,
				8,
				8,
				6
			],
			spot: 200,
			gun: {
				dmg: 14,
				range: 150,
				rate: .6,
				pen: 45,
				supp: .1,
				halt: .25,
				fx: "tank"
			}
		},
		{
			name: "M5 Stuart",
			hp: 125,
			speed: 56,
			reward: 6,
			armor: 0,
			air: false,
			radius: 11,
			lives: 1,
			tex: "us_stuart",
			bio: .4,
			arm: [
				44,
				25,
				22,
				13
			],
			gun: {
				dmg: 18,
				range: 160,
				rate: .4,
				pen: 45,
				supp: .2,
				halt: .3,
				fx: "tank"
			}
		},
		{
			name: "M4 Sherman",
			hp: 185,
			speed: 42,
			reward: 8,
			armor: 0,
			air: false,
			radius: 12,
			lives: 2,
			tex: "us_sherman",
			bio: .35,
			arm: [
				90,
				38,
				38,
				19
			],
			gun: {
				dmg: 34,
				range: 180,
				rate: .24,
				pen: 70,
				supp: .3,
				halt: .5,
				splash: 16,
				fx: "tank"
			}
		},
		{
			name: "M4A3E8 Easy Eight",
			hp: 215,
			speed: 44,
			reward: 10,
			armor: 0,
			air: false,
			radius: 13,
			lives: 2,
			tex: "us_easy8",
			bio: .35,
			arm: [
				100,
				38,
				38,
				19
			],
			gun: {
				dmg: 42,
				range: 190,
				rate: .22,
				pen: 110,
				supp: .3,
				halt: .5,
				splash: 14,
				fx: "tank"
			}
		},
		{
			name: "M4A3E2 Jumbo",
			hp: 330,
			speed: 34,
			reward: 13,
			armor: 0,
			air: false,
			radius: 13,
			lives: 3,
			tex: "us_jumbo",
			bio: .3,
			arm: [
				150,
				76,
				38,
				25
			],
			gun: {
				dmg: 36,
				range: 180,
				rate: .26,
				pen: 70,
				supp: .3,
				halt: .4,
				splash: 16,
				fx: "tank"
			}
		},
		{
			name: "M26 Pershing",
			hp: 2e3,
			speed: 26,
			reward: 80,
			armor: 0,
			air: false,
			radius: 16,
			lives: 4,
			tex: "us_pershing",
			bio: .25,
			arm: [
				150,
				76,
				50,
				25
			],
			boss: true,
			gun: {
				dmg: 120,
				range: 220,
				rate: .12,
				pen: 150,
				supp: .6,
				halt: .6,
				splash: 26,
				fx: "tank"
			}
		},
		{
			name: "P-47 Thunderbolt",
			hp: 110,
			speed: 80,
			reward: 6,
			armor: 0,
			air: true,
			radius: 14,
			lives: 1,
			tex: "us_p47",
			bio: 0,
			arm: [
				12,
				12,
				8,
				8
			],
			gun: {
				dmg: 30,
				range: 70,
				rate: .35,
				pen: 60,
				supp: .3,
				splash: 24,
				fx: "rocket"
			}
		},
		{
			name: "P-51 Mustang",
			hp: 70,
			speed: 125,
			reward: 4,
			armor: 0,
			air: true,
			radius: 12,
			lives: 1,
			tex: "us_p51",
			bio: 0,
			gun: {
				dmg: 8,
				range: 120,
				rate: 3,
				pen: 18,
				supp: 0,
				fx: "mg",
				air: true
			}
		},
		{
			name: "T34 Calliope",
			hp: 170,
			speed: 40,
			reward: 10,
			armor: 0,
			air: false,
			radius: 12,
			lives: 1,
			tex: "us_calliope",
			bio: .35,
			arm: [
				90,
				38,
				38,
				19
			],
			gun: {
				dmg: 22,
				range: 320,
				rate: 1 / 14,
				pen: 30,
				supp: .5,
				halt: 1.2,
				splash: 30,
				salvo: 14,
				fx: "katyusha"
			}
		},
		{
			name: "Combat Engineers",
			hp: 46,
			speed: 46,
			reward: 5,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "us_engineer",
			bio: 2,
			inf: true,
			gun: {
				dmg: 260,
				range: 22,
				rate: .25,
				pen: 150,
				supp: .6,
				fx: "satchel"
			}
		},
		{
			name: "Lieutenant",
			hp: 40,
			speed: 44,
			reward: 8,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "us_officer",
			bio: 2,
			inf: true,
			officer: true,
			spot: 160,
			gun: {
				dmg: 3,
				range: 80,
				rate: .6,
				pen: 6,
				supp: .02,
				fx: "smg"
			}
		}
	],
	roster: {
		rifle: 0,
		assault: 1,
		sniper: 2,
		medic: 3,
		recon: 4,
		armcar: 5,
		light: 6,
		medium: 7,
		medium2: 8,
		heavy: 9,
		boss: 10,
		attack: 11,
		fighter: 12,
		rockets: 13,
		sapper: 14,
		officer: 15
	},
	doctrine: {
		inf: .9,
		armour: .9
	},
	help: [
		{
			text: "GIs with M1 Garands: semi-automatic rifles, so a squad pours out fire that pins your crews.",
			counter: "Machine guns, mortars, AP mines; wire slows them."
		},
		{
			text: "Rangers with Thompsons: fast, tough assault troops.",
			counter: "Machine guns and flamethrowers."
		},
		{
			text: "A camouflaged sniper: invisible unless spotted, and it hunts your commander.",
			counter: "Observation posts reveal snipers."
		},
		{
			text: "A medic who patches up everyone around.",
			counter: "Kill medics first (Strong targeting)."
		},
		{
			text: "A Jeep with scouts: they spot hidden guns from far away.",
			counter: "Anything kills it."
		},
		{
			text: "The M8 Greyhound armoured car: fast, with a 37 mm gun; its crew spots hidden guns.",
			counter: "Light flak and anything heavier."
		},
		{
			text: "The M5 Stuart: a fast light tank with thin armour.",
			counter: "Any anti-tank weapon from any side."
		},
		{
			text: "The M4 Sherman: 90 mm of sloped front, thin sides; it stops only briefly to fire. Costs 2 lives.",
			counter: "Anti-tank guns into its 38 mm sides; most guns from the front at short range."
		},
		{
			text: "The Easy Eight: a 76 mm Sherman that goes through a Panther's side and a Panzer IV's front.",
			counter: "Flank shots; it is no better armoured than the Sherman."
		},
		{
			text: "The Jumbo: an assault Sherman with 150 mm of front armour, made to lead columns. Costs 3 lives.",
			counter: "Heavy guns or flank shots — its rear is thin."
		},
		{
			text: "A boss: the M26 Pershing, with 150 mm of front armour and a 90 mm gun. Costs 4 lives.",
			counter: "Heavy guns into its 76 mm sides; mines and air strikes."
		},
		{
			text: "The P-47 Thunderbolt: a heavy fighter-bomber firing rockets at your positions. Armoured.",
			counter: "Light flak and heavy anti-aircraft guns."
		},
		{
			text: "The P-51 Mustang: a fighter that hunts your aircraft.",
			counter: "Anti-aircraft guns and machine guns."
		},
		{
			text: "The Calliope: a Sherman carrying a frame of rocket tubes, firing salvos from long range.",
			counter: "It is still a Sherman: anti-tank guns into its sides."
		},
		{
			text: "Combat engineers with Bangalore torpedoes and charges: they blow the weakest wall of a long maze, lift mines and cut wire.",
			counter: "Machine guns and AP mines before they reach the wall."
		},
		{
			text: "A platoon leader leading the infantry of the wave. While he lives his men press on; if he falls, the wave loses heart and more of it breaks and falls back.",
			counter: "Snipers pick officers off first; anything that reaches him early in the wave."
		}
	]
};
//#endregion
//#region src/game/ww2_jp.ts
var G = (slot) => slotOf(GERMAN, slot);
/** Japanese positions are better hidden than anyone's. */
var hid = (slot, extra = .15) => Math.min(.95, (G(slot).camo ?? .3) + extra);
var JAPANESE_DEFENCE = {
	towers: growAll([
		derive(G("mg"), {
			kind: "type92",
			name: "Type 92 HMG Nest",
			short: "Type 92",
			desc: "The \"woodpecker\": slow, heavy, accurate fire from a hidden nest.",
			turret: "jp_w_mg",
			sfx: "type92",
			color: 11049562,
			camo: hid("mg"),
			lv: {
				cost: 14,
				damage: 4.4,
				rate: 5,
				range: 120,
				pen: 9
			}
		}),
		derive(G("lightaa"), {
			kind: "type96",
			name: "25 mm Type 96",
			short: "Type 96",
			desc: "Twin 25 mm anti-aircraft cannon: deadly to aircraft and light vehicles.",
			turret: "jp_w_aa",
			sfx: "flak38",
			lv: {
				cost: 34,
				damage: 10,
				rate: 3,
				range: 165,
				pen: 30
			}
		}),
		derive(G("at"), {
			kind: "rodan",
			name: "Type 4 \"Ro-Dan\" Team",
			short: "Ro-Dan",
			desc: "A 70 mm anti-tank rocket launcher: a Sherman's side, or its front point-blank.",
			turret: "jp_w_at",
			sfx: "bazooka",
			camo: hid("at"),
			lv: {
				cost: 26,
				damage: 70,
				rate: .3,
				range: 75,
				pen: 85
			}
		}),
		derive(G("sniper"), {
			kind: "jp_sniper",
			name: "Tree Sniper",
			short: "Sniper",
			desc: "A sniper hidden in the canopy: the hardest to find of all.",
			turret: "jp_w_sniper",
			camo: .95
		}),
		derive(G("flamer"), {
			kind: "type100",
			name: "Type 100 Flamethrower",
			short: "Flamer",
			desc: "Burns infantry and soft vehicles at point-blank range.",
			turret: "jp_w_flamer"
		}),
		derive(G("atgun"), {
			kind: "type1_47",
			name: "47 mm Type 1",
			short: "Type 1",
			desc: "The best Japanese anti-tank gun: kills light tanks, needs a Sherman's side.",
			turret: "jp_w_47",
			sfx: "pak40",
			camo: hid("atgun"),
			lv: {
				cost: 40,
				damage: 55,
				rate: .6,
				range: 160,
				pen: 78
			}
		}),
		derive(G("heavyaa"), {
			kind: "type88",
			name: "75 mm Type 88",
			short: "Type 88",
			desc: "Heavy anti-aircraft gun, also fired at tanks: 90 mm of penetration.",
			turret: "jp_w_88",
			sfx: "flak88",
			lv: {
				cost: 100,
				damage: 95,
				range: 220,
				pen: 90
			}
		}),
		derive(G("tank"), {
			kind: "jp_chihadug",
			name: "Chi-Ha Kai (dug in)",
			short: "Chi-Ha",
			desc: "A Type 97 with the 47 mm gun, buried to the turret.",
			turret: "jp_w_chiha",
			sfx: "pak40",
			camo: hid("tank", .2),
			lv: {
				cost: 110,
				damage: 55,
				rate: .4,
				range: 170,
				pen: 70,
				hp: 420,
				fort: 40
			}
		}),
		derive(G("bunker"), {
			kind: "cave",
			name: "Cave Bunker",
			short: "Cave",
			desc: "Machine guns firing from a cave in the coral: very hard to find and to destroy.",
			turret: "jp_w_cave",
			sfx: "type92",
			camo: .6,
			lv: {
				cost: 55,
				damage: 4,
				rate: 6,
				hp: 640,
				fort: 100
			}
		}),
		derive(G("mortar"), {
			kind: "type97_81",
			name: "81 mm Type 97 Mortar",
			short: "Mortar",
			desc: "Bombs on infantry groups; pins them down.",
			turret: "jp_w_mortar",
			camo: hid("mortar"),
			lv: { cost: 32 }
		}),
		derive(G("howitzer"), {
			kind: "type91",
			name: "105 mm Type 91",
			short: "Type 91",
			desc: "A field howitzer: big blast at long range. It needs an observer.",
			turret: "jp_w_105",
			lv: { rate: .17 }
		}),
		derive(G("rockets"), {
			kind: "type4",
			name: "Type 4 Rocket Launcher",
			short: "Type 4",
			desc: "Six 20 cm rockets per salvo, each one a heavy blast.",
			turret: "jp_type4",
			sfx: "nebel",
			lv: {
				cost: 120,
				damage: 80,
				rate: .1,
				splash: 40,
				salvo: 6
			}
		}),
		derive(G("depot"), {
			kind: "jp_depot",
			name: "Supply Dump",
			short: "Depot",
			desc: "Keeps the guns in range supplied with ammunition (trucks from the HQ refill it), and pays out at every wave.",
			turret: "jp_w_depot"
		}),
		derive(G("observer"), {
			kind: "jp_observer",
			name: "Observation Post",
			short: "Observer",
			desc: "Spots for artillery, reveals snipers and extends the range of guns nearby.",
			turret: "jp_w_observer"
		}),
		derive(G("hq"), {
			kind: "jp_hq",
			name: "Regimental HQ",
			short: "HQ",
			desc: "Officers and runners: emplacements in range fire faster.",
			turret: "jp_w_hq"
		}),
		derive(G("workshop"), {
			kind: "jp_workshop",
			name: "Field Workshop",
			short: "Workshop",
			desc: "Engineers patch up damaged emplacements in range, even under fire.",
			turret: "jp_w_workshop"
		}),
		derive(G("barracks"), {
			kind: "jp_barracks",
			name: "Barracks",
			short: "Barracks",
			desc: "Trains rifle squads, LMG and lunge-mine teams, snipers, engineers and medics.",
			turret: "jp_w_barracks"
		}),
		derive(G("motorpool"), {
			kind: "jp_motorpool",
			name: "Tank Park",
			short: "Tank Park",
			desc: "Builds Ha-Go, Chi-Ha and Chi-Nu tanks.",
			turret: "jp_w_motorpool"
		}),
		derive(G("airfield"), {
			kind: "jp_airfield",
			name: "Fighter Strip",
			short: "Airfield",
			desc: "Send (R) a pair of Zeros to patrol a point.",
			turret: "jp_w_airfield"
		}),
		derive(G("teeth"), {
			kind: "jp_logs",
			name: "Log Barricade",
			short: "Logs",
			desc: "Coconut logs: a cheap 1×1 wall against vehicles. Infantry climb over, slowly."
		}),
		derive(G("wire"), {
			kind: "jp_wire",
			name: "Barbed Wire",
			short: "Wire",
			desc: "Goes on the path. Infantry get tangled and crawl; vehicles drive through."
		}),
		derive(G("atmine"), {
			kind: "type93",
			name: "Type 93 Mines",
			short: "AT Mine",
			desc: "Anti-tank mines on the path: only vehicles set them off."
		}),
		derive(G("apmine"), {
			kind: "type3mine",
			name: "Type 3 Mines",
			short: "AP Mine",
			desc: "Terracotta mines the detectors can't find: only infantry set them off."
		}),
		derive(G("roadblock"), {
			kind: "jp_roadblock",
			name: "Roadblock",
			short: "Roadblock",
			desc: "A barrier you can open and close (G) to reroute an attack mid-fight.",
			block: "roadblock"
		}),
		derive(G("strike"), {
			kind: "val",
			name: "Aichi D3A \"Val\"",
			short: "Val",
			desc: "Call in (R) three dive bombers on a point.",
			turret: "jp_w_valfield",
			sfx: "stuka",
			lv: {
				cost: 210,
				damage: 320,
				salvo: 3,
				pen: 60
			}
		}),
		derive(G("super"), {
			kind: "type98",
			name: "320 mm Type 98 Mortar",
			short: "Type 98",
			desc: "The spigot mortar of Iwo Jima: one 300 kg bomb (R) on any point.",
			turret: "jp_w_type98",
			sfx: "mortar",
			lv: {
				cost: 340,
				damage: 850,
				splash: 85,
				charge: 90,
				pen: 90
			}
		})
	]),
	units: [
		{
			kind: "jp_squad",
			name: "Rifle Squad",
			short: "Riflemen",
			tex: "jp_rifle",
			from: "barracks",
			cost: 30,
			manpower: 1,
			train: 5,
			hp: 65,
			speed: 44,
			radius: 6,
			inf: true,
			gun: {
				dmg: 5,
				range: 110,
				rate: 1.2,
				pen: 7,
				supp: .03,
				sfx: "mosin"
			},
			desc: "Riflemen with Arisakas: tough and stubborn in defence."
		},
		{
			kind: "jp_lmgteam",
			name: "Type 99 LMG Team",
			short: "LMG",
			tex: "jp_mg",
			from: "barracks",
			cost: 45,
			manpower: 1,
			train: 8,
			hp: 55,
			speed: 38,
			radius: 6,
			inf: true,
			camo: true,
			gun: {
				dmg: 3.4,
				range: 115,
				rate: 7,
				pen: 8,
				supp: .06,
				still: true,
				sfx: "type92"
			},
			desc: "A light machine gun team that hides well. Must stop to fire."
		},
		{
			kind: "jp_lungeteam",
			name: "Lunge-Mine Team",
			short: "Lunge Mine",
			tex: "jp_lunge",
			from: "barracks",
			cost: 40,
			manpower: 1,
			train: 7,
			hp: 45,
			speed: 46,
			radius: 6,
			inf: true,
			camo: true,
			gun: {
				dmg: 140,
				range: 26,
				rate: .2,
				pen: 150,
				sfx: "bazooka"
			},
			desc: "Men with shaped charges on poles: they must reach the tank, then it goes through any armour. Best in Ambush."
		},
		{
			kind: "jp_snipu",
			name: "Sniper",
			short: "Sniper",
			tex: "jp_sniper",
			from: "barracks",
			cost: 50,
			manpower: 1,
			train: 9,
			hp: 35,
			speed: 40,
			radius: 6,
			inf: true,
			camo: true,
			gun: {
				dmg: 60,
				range: 270,
				rate: .4,
				pen: 10,
				sfx: "sniper"
			},
			desc: "A camouflaged marksman: the enemy only sees it when it fires."
		},
		{
			kind: "jp_engineers",
			name: "Engineers",
			short: "Engineers",
			tex: "jp_engineer",
			from: "barracks",
			cost: 42,
			manpower: 1,
			train: 8,
			hp: 60,
			speed: 44,
			radius: 6,
			inf: true,
			repair: 14,
			gun: {
				dmg: 4,
				range: 90,
				rate: 1,
				pen: 7,
				sfx: "mosin"
			},
			desc: "Repair emplacements and raise rubble back up, free of charge."
		},
		{
			kind: "jp_medicu",
			name: "Medic",
			short: "Medic",
			tex: "jp_medic",
			from: "barracks",
			cost: 36,
			manpower: 1,
			train: 7,
			hp: 45,
			speed: 46,
			radius: 6,
			inf: true,
			heal: 6,
			desc: "Patches up soldiers and the commander nearby."
		},
		{
			kind: "jp_hagou",
			name: "Type 95 Ha-Go",
			short: "Ha-Go",
			tex: "jp_hago",
			from: "motorpool",
			cost: 110,
			manpower: 2,
			train: 10,
			hp: 180,
			speed: 58,
			radius: 10,
			arm: [
				12,
				12,
				10,
				6
			],
			gun: {
				dmg: 22,
				range: 160,
				rate: .5,
				pen: 35,
				still: true,
				sfx: "flak38"
			},
			desc: "A fast light tank: good against infantry and armoured cars, paper-thin armour."
		},
		{
			kind: "jp_chihau",
			name: "Type 97 Chi-Ha Kai",
			short: "Chi-Ha",
			tex: "jp_chiha",
			from: "motorpool",
			cost: 160,
			manpower: 2,
			train: 13,
			hp: 260,
			speed: 46,
			radius: 12,
			arm: [
				25,
				25,
				20,
				10
			],
			gun: {
				dmg: 45,
				range: 175,
				rate: .4,
				pen: 70,
				splash: 10,
				still: true,
				sfx: "pak40"
			},
			desc: "The medium tank with the new 47 mm gun: it goes through a Sherman's side."
		},
		{
			kind: "jp_chinuu",
			name: "Type 3 Chi-Nu",
			short: "Chi-Nu",
			tex: "jp_chinu",
			from: "motorpool",
			cost: 260,
			manpower: 3,
			train: 18,
			hp: 360,
			speed: 40,
			radius: 13,
			arm: [
				50,
				25,
				20,
				12
			],
			gun: {
				dmg: 65,
				range: 190,
				rate: .32,
				pen: 90,
				splash: 14,
				still: true,
				sfx: "f34"
			},
			desc: "The 75 mm gun at last: a Sherman from the front at close range."
		},
		{
			kind: "jp_zerou",
			name: "A6M Zero",
			short: "Zero",
			tex: "jp_zero",
			from: "airfield",
			cost: 0,
			manpower: 0,
			train: 0,
			hp: 110,
			speed: 215,
			radius: 12,
			air: true,
			gun: {
				dmg: 11,
				range: 115,
				rate: 4.5,
				pen: 22,
				hitsAir: true,
				sfx: "flak38"
			},
			desc: "Agile fighters on patrol: they hunt aircraft first, then strafe soft targets."
		}
	],
	combos: [
		{
			a: "type92",
			b: "jp_wire",
			name: "Kill Zone",
			desc: "+30% fire rate",
			rate: 1.3
		},
		{
			a: "cave",
			b: "cave",
			name: "Tunnel Network",
			desc: "+25% damage",
			dmg: 1.25
		},
		{
			a: "type91",
			b: "jp_observer",
			name: "Fire Mission",
			desc: "+30% fire rate",
			rate: 1.3
		},
		{
			a: "jp_sniper",
			b: "jp_observer",
			name: "Spotter",
			desc: "+40% damage",
			dmg: 1.4
		},
		{
			a: "type88",
			b: "type96",
			name: "AA Battery",
			desc: "+30% vs air",
			air: 1.3
		},
		{
			a: "type1_47",
			b: "jp_logs",
			name: "Ambush Pit",
			desc: "+25% damage",
			dmg: 1.25
		}
	],
	ranks: [
		"Nitōhei",
		"Ittōhei",
		"Jōtōhei",
		"Gochō",
		"Gunsō",
		"Shōi",
		"Tai-i",
		"Shōsa",
		"Taisa",
		"Taishō"
	],
	superName: "Air & heavy mortar",
	look: {
		base: "jpbase",
		hero: "jp_officer",
		nuke: "shell"
	},
	help: {
		type92: "The Type 92 heavy machine gun, the \"woodpecker\" for its slow knocking: fewer rounds than an MG-42 but heavier and accurate. Its nest is well hidden.",
		type96: "Twin 25 mm cannon: the answer to aircraft, and they go through half-tracks, armoured cars and light tanks.",
		rodan: "Two men with the Type 4 70 mm rocket launcher, a late-war copy of the bazooka: 85 mm of penetration — a Sherman from the side, or from the front point-blank. Short range, very well hidden: put it in Ambush.",
		jp_sniper: "A sniper tied into the treetops: the best camouflage of any position. One shot, one soldier; useless against armour.",
		type100: "Burns infantry and open vehicles at point-blank range; closed tanks are sealed against it.",
		type1_47: "The 47 mm Type 1 with its late-war rounds: 78 mm of penetration — a Stuart from any side, a Sherman only from its 38 mm sides. Hide it and wait for the flank.",
		type88: "The 75 mm anti-aircraft gun: 90 mm of penetration, enough for a Sherman's front at close range, and it bursts among aircraft.",
		jp_chihadug: "A Chi-Ha with the 47 mm gun dug in to the turret: well hidden, but its armour is thin.",
		cave: "A cave cut into a coral ridge, the heart of the Iwo Jima defence: 100 mm of rock over the guns, and the enemy only finds it when it fires or walks right up to it.",
		type97_81: "An 81 mm mortar: bombs that burst among infantry and pin them down.",
		type91: "The 105 mm howitzer: a big blast at long range, but it needs observers to see.",
		type4: "Type 4 rocket launchers: six 20 cm rockets per salvo, each warhead a heavy blast.",
		jp_depot: "Every gun has an ammunition stock that firing uses up (artillery and anti-tank guns fastest, machine guns slowest); empty guns fire at a third of their rate. Guns in the depot's radius are refilled from its store, and the headquarters sends a truck to refill the store when it runs low (the enemy shoots at the trucks). The headquarters also supplies the guns near it. Produces no damage. At every wave it pays a fixed income plus interest on the money you are holding.",
		jp_observer: "An observation post: artillery fires at anything it sees, enemy snipers are revealed, guns nearby get extra range.",
		jp_hq: "A regimental headquarters: every emplacement in range fires faster.",
		jp_workshop: "Engineers with spare parts patch up every emplacement in range. Rebuilding rubble (B) costs money.",
		jp_barracks: "Trains infantry that fight outside the maze: riflemen, LMG teams, lunge-mine teams (they must reach the tank), snipers, engineers and medics. Manpower: each HQ adds 4, each depot 2.",
		jp_motorpool: "Builds tanks: the Ha-Go, the Chi-Ha and the Chi-Nu. Japanese tanks are fast but thinly armoured.",
		jp_airfield: "A fighter strip. Press R and click a point: two Zeros patrol there for 25 s, shooting down aircraft first.",
		jp_logs: "A barricade of coconut logs: a cheap 1×1 obstacle that stops vehicles. Infantry clamber over at a third of their speed.",
		jp_wire: "Barbed wire on the path: infantry get tangled and crawl, vehicles drive over it.",
		type93: "Anti-tank mines: only a vehicle sets them off.",
		type3mine: "Terracotta anti-personnel mines: only infantry set them off.",
		jp_roadblock: "A barrier you can open and close (G) to switch the route mid-wave.",
		val: "Aichi D3A dive bombers. When ready, press R and click: three of them dive on the target; the bombs hit the thin top armour.",
		type98: "The Type 98 spigot mortar. When ready, press R and click anywhere: a 300 kg bomb tumbles down with a blast that wrecks everything near it."
	}
};
var JP_ARMY = {
	enemies: [
		{
			name: "Rifle Squad",
			hp: 32,
			speed: 44,
			reward: 2,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "jp_rifle",
			bio: 2,
			inf: true,
			gun: {
				dmg: 2.8,
				range: 110,
				rate: .75,
				pen: 7,
				supp: .03,
				fx: "rifle"
			}
		},
		{
			name: "Banzai Charge",
			hp: 44,
			speed: 70,
			reward: 3,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "jp_banzai",
			bio: 2,
			inf: true,
			banzai: true,
			gun: {
				dmg: 6,
				range: 26,
				rate: 1,
				pen: 6,
				supp: .02,
				fx: "smg"
			}
		},
		{
			name: "Sniper",
			hp: 26,
			speed: 46,
			reward: 4,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "jp_sniper",
			bio: 2,
			inf: true,
			stealth: true,
			spot: 160,
			gun: {
				dmg: 14,
				range: 230,
				rate: .25,
				pen: 10,
				supp: .15,
				fx: "rifle"
			}
		},
		{
			name: "Medic",
			hp: 40,
			speed: 44,
			reward: 5,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "jp_medic",
			bio: 2,
			inf: true,
			heal: .08
		},
		{
			name: "Kurogane Scout Car",
			hp: 45,
			speed: 92,
			reward: 3,
			armor: 0,
			air: false,
			radius: 8,
			lives: 1,
			tex: "jp_kurogane",
			bio: 1,
			spot: 220
		},
		{
			name: "Sumida Armoured Car",
			hp: 80,
			speed: 70,
			reward: 4,
			armor: 0,
			air: false,
			radius: 10,
			lives: 1,
			tex: "jp_sumida",
			bio: .6,
			arm: [
				11,
				6,
				6,
				6
			],
			spot: 190,
			gun: {
				dmg: 3,
				range: 110,
				rate: 2,
				pen: 8,
				supp: .04,
				fx: "mg"
			}
		},
		{
			name: "Type 95 Ha-Go",
			hp: 110,
			speed: 60,
			reward: 5,
			armor: 0,
			air: false,
			radius: 10,
			lives: 1,
			tex: "jp_hago",
			bio: .5,
			arm: [
				12,
				12,
				10,
				6
			],
			gun: {
				dmg: 16,
				range: 155,
				rate: .45,
				pen: 35,
				supp: .15,
				halt: .4,
				fx: "tank"
			}
		},
		{
			name: "Type 97 Chi-Ha",
			hp: 160,
			speed: 46,
			reward: 7,
			armor: 0,
			air: false,
			radius: 12,
			lives: 2,
			tex: "jp_chiha",
			bio: .4,
			arm: [
				25,
				25,
				20,
				10
			],
			gun: {
				dmg: 28,
				range: 165,
				rate: .3,
				pen: 45,
				supp: .25,
				halt: .5,
				splash: 14,
				fx: "tank"
			}
		},
		{
			name: "Type 1 Chi-He",
			hp: 190,
			speed: 48,
			reward: 8,
			armor: 0,
			air: false,
			radius: 12,
			lives: 2,
			tex: "jp_chihe",
			bio: .4,
			arm: [
				50,
				25,
				20,
				12
			],
			gun: {
				dmg: 32,
				range: 175,
				rate: .3,
				pen: 70,
				supp: .25,
				halt: .5,
				splash: 12,
				fx: "tank"
			}
		},
		{
			name: "Type 3 Chi-Nu",
			hp: 260,
			speed: 40,
			reward: 11,
			armor: 0,
			air: false,
			radius: 13,
			lives: 2,
			tex: "jp_chinu",
			bio: .35,
			arm: [
				50,
				25,
				20,
				12
			],
			gun: {
				dmg: 40,
				range: 185,
				rate: .26,
				pen: 85,
				supp: .3,
				halt: .6,
				splash: 14,
				fx: "tank"
			}
		},
		{
			name: "O-I Super-heavy Tank",
			hp: 2100,
			speed: 20,
			reward: 85,
			armor: 0,
			air: false,
			radius: 20,
			lives: 4,
			tex: "jp_oi",
			bio: .25,
			arm: [
				150,
				75,
				75,
				30
			],
			boss: true,
			gun: {
				dmg: 130,
				range: 215,
				rate: .12,
				pen: 120,
				supp: .6,
				halt: .9,
				splash: 28,
				fx: "tank"
			}
		},
		{
			name: "Kamikaze",
			hp: 75,
			speed: 105,
			reward: 6,
			armor: 0,
			air: true,
			radius: 12,
			lives: 1,
			tex: "jp_kamikaze",
			bio: 0,
			gun: {
				dmg: 240,
				range: 36,
				rate: 1,
				pen: 140,
				supp: .6,
				splash: 30,
				fx: "kamikaze"
			}
		},
		{
			name: "A6M Zero",
			hp: 62,
			speed: 120,
			reward: 4,
			armor: 0,
			air: true,
			radius: 12,
			lives: 1,
			tex: "jp_zero",
			bio: 0,
			gun: {
				dmg: 7,
				range: 120,
				rate: 3,
				pen: 15,
				supp: 0,
				fx: "mg",
				air: true
			}
		},
		{
			name: "Type 4 Rocket Truck",
			hp: 90,
			speed: 54,
			reward: 9,
			armor: 0,
			air: false,
			radius: 11,
			lives: 1,
			tex: "jp_type4",
			bio: 1,
			gun: {
				dmg: 60,
				range: 300,
				rate: 1 / 14,
				pen: 35,
				supp: .6,
				halt: 1.2,
				splash: 40,
				salvo: 4,
				fx: "katyusha"
			}
		},
		{
			name: "Engineers",
			hp: 45,
			speed: 46,
			reward: 5,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "jp_engineer",
			bio: 2,
			inf: true,
			gun: {
				dmg: 260,
				range: 22,
				rate: .25,
				pen: 150,
				supp: .6,
				fx: "satchel"
			}
		},
		{
			name: "Shōi",
			hp: 40,
			speed: 44,
			reward: 8,
			armor: 0,
			air: false,
			radius: 6,
			lives: 1,
			tex: "jp_officer",
			bio: 2,
			inf: true,
			officer: true,
			spot: 160,
			gun: {
				dmg: 3,
				range: 80,
				rate: .6,
				pen: 6,
				supp: .02,
				fx: "smg"
			}
		}
	],
	roster: {
		rifle: 0,
		assault: 1,
		sniper: 2,
		medic: 3,
		recon: 4,
		armcar: 5,
		light: 6,
		medium: 7,
		medium2: 8,
		heavy: 9,
		boss: 10,
		attack: 11,
		fighter: 12,
		rockets: 13,
		sapper: 14,
		officer: 15
	},
	doctrine: {
		inf: 1.4,
		armour: .6
	},
	help: [
		{
			text: "Riflemen with Arisakas, in great numbers.",
			counter: "Machine guns, mortars, AP mines; wire slows them."
		},
		{
			text: "A banzai charge: fast, shouting infantry that suppression can't slow down. They fight with the bayonet.",
			counter: "Mass machine guns and mines; wire still tangles them."
		},
		{
			text: "A camouflaged sniper: invisible unless spotted, and it hunts your commander.",
			counter: "Observation posts reveal snipers."
		},
		{
			text: "A medic who patches up everyone around.",
			counter: "Kill medics first (Strong targeting)."
		},
		{
			text: "A Kurogane scout car: its crew spots hidden guns from far away.",
			counter: "Anything kills it."
		},
		{
			text: "A six-wheeled armoured car with a machine gun; it spots hidden guns.",
			counter: "Light flak and anything heavier."
		},
		{
			text: "The Ha-Go light tank: fast, with 12 mm of armour that even heavy machine guns can pierce.",
			counter: ".50 calibres, any anti-tank weapon."
		},
		{
			text: "The Chi-Ha medium tank: 25 mm of armour and a short 57 mm gun. Costs 2 lives.",
			counter: "Any anti-tank gun or bazooka from any side."
		},
		{
			text: "The Chi-He: 50 mm in front and a 47 mm gun.",
			counter: "Any anti-tank gun; bazookas from any side."
		},
		{
			text: "The Chi-Nu: the 75 mm gun on a thinly armoured hull.",
			counter: "Any anti-tank weapon; its sides are only 25 mm."
		},
		{
			text: "A boss: the O-I super-heavy tank, a 120-tonne prototype with three turrets and 150 mm of front armour. Costs 4 lives.",
			counter: "Heavy guns into its 75 mm sides, mines and air strikes."
		},
		{
			text: "A kamikaze: a Zero carrying a bomb that dives into your most valuable emplacement.",
			counter: "Shoot it down before it arrives: anti-aircraft guns all along its path."
		},
		{
			text: "An A6M Zero fighter: it hunts your aircraft.",
			counter: "Anti-aircraft guns and machine guns."
		},
		{
			text: "A Type 4 rocket truck: four heavy rockets per salvo from long range.",
			counter: "An unarmoured truck: long-range guns or artillery with an observer."
		},
		{
			text: "Engineers with charges: they blow the weakest wall of a long maze, lift mines and cut wire.",
			counter: "Machine guns and AP mines before they reach the wall."
		},
		{
			text: "A sword-carrying second lieutenant leading the infantry of the wave. While he lives his men press on; if he falls, the wave loses heart (banzai troops less so).",
			counter: "Snipers pick officers off first; anything that reaches him early in the wave."
		}
	]
};
//#endregion
//#region src/game/ww2.ts
var FACTIONS = {
	de: {
		name: "Germany",
		adj: "German",
		foes: ["su", "us"]
	},
	su: {
		name: "Soviet Union",
		adj: "Soviet",
		foes: ["de"]
	},
	us: {
		name: "Western Allies",
		adj: "Allied",
		foes: ["de", "jp"]
	},
	jp: {
		name: "Japan",
		adj: "Japanese",
		foes: ["us"]
	}
};
/** Each side as the defender, and as the attacker (undefined until it is ready). */
var ARSENALS = {
	de: GERMANY,
	su: SOVIET_DEFENCE,
	us: ALLIED_DEFENCE,
	jp: JAPANESE_DEFENCE
};
var ARMIES = {
	su: RED_ARMY,
	de: WEHRMACHT_ARMY,
	us: US_ARMY,
	jp: JP_ARMY
};
function ww2Ruleset(side, foe, battle) {
	const a = ARSENALS[side];
	const b = battleById(battle);
	const base = ARMIES[foe];
	const army = base && b ? {
		...base,
		roster: {
			...base.roster,
			...b.roster
		},
		doctrine: b.doctrine ?? base.doctrine
	} : base;
	if (!a || !army) throw new Error(`no WW2 matchup ${side} vs ${foe}`);
	a.towers.forEach((t, i) => {
		if (t.slot !== SLOTS[i]) throw new Error(`${side} arsenal: ${t.kind} is in the ${SLOTS[i]} slot`);
	});
	return {
		id: "ww2",
		side,
		foe,
		towers: a.towers,
		enemies: [...army.enemies, ...garrison(foe)],
		units: [...a.units, supplyTruck(side)],
		combos: a.combos,
		categories: [
			{
				id: "basic",
				name: "Infantry"
			},
			{
				id: "precision",
				name: "Anti-tank"
			},
			{
				id: "fire",
				name: "Artillery"
			},
			{
				id: "support",
				name: "Support"
			},
			{
				id: "units",
				name: "Units"
			},
			{
				id: "maze",
				name: "Obstacles"
			},
			{
				id: "super",
				name: a.superName
			}
		],
		ranks: a.ranks,
		look: a.look,
		wave: (n) => assault(n, army)
	};
}
/**
* The attacker's base, built from its own arsenal: the headquarters (destroy it to win) and the
* machine-gun nests and anti-tank guns guarding it. Appended to the army's units in this order.
*/
function garrison(foe) {
	const a = ARSENALS[foe];
	const gun = (slot) => a.towers.find((t) => t.slot === slot);
	const base = (lv) => `${a.look.base}${lv}`;
	const adj = FACTIONS[foe].adj;
	return [
		{
			name: `${adj} Headquarters`,
			hp: 6e3,
			speed: 0,
			reward: 0,
			armor: 0,
			air: false,
			radius: 20,
			lives: 0,
			tex: gun("hq").turret,
			bio: 0,
			arm: [
				100,
				100,
				100,
				70
			],
			fixed: "hq",
			base: base(7),
			spot: 220,
			gun: {
				dmg: 3,
				range: 150,
				rate: 6,
				pen: 8,
				supp: .05,
				fx: "mg"
			}
		},
		{
			name: gun("mg").name,
			hp: 260,
			speed: 0,
			reward: 12,
			armor: 0,
			air: false,
			radius: 9,
			lives: 0,
			tex: gun("mg").turret,
			bio: .5,
			arm: [
				25,
				25,
				25,
				12
			],
			fixed: "mg",
			base: base(3),
			spot: 180,
			gun: {
				dmg: 3,
				range: 140,
				rate: 8,
				pen: 8,
				supp: .07,
				fx: "mg"
			}
		},
		{
			name: gun("atgun").name,
			hp: 320,
			speed: 0,
			reward: 18,
			armor: 0,
			air: false,
			radius: 11,
			lives: 0,
			tex: gun("atgun").turret,
			bio: .5,
			arm: [
				40,
				30,
				30,
				12
			],
			fixed: "at",
			base: base(3),
			spot: 200,
			gun: {
				dmg: 60,
				range: 220,
				rate: .3,
				pen: 110,
				supp: .3,
				halt: .6,
				splash: 10,
				fx: "tank"
			}
		},
		{
			name: `${adj} Supply Dump`,
			hp: 900,
			speed: 0,
			reward: 40,
			armor: 0,
			air: false,
			radius: 13,
			lives: 0,
			tex: gun("depot").turret,
			bio: .5,
			arm: [
				20,
				20,
				20,
				8
			],
			fixed: "depot",
			base: base(2),
			spot: 120
		},
		{
			name: `${TRUCKS[foe][0]} supply truck`,
			hp: 160,
			speed: 50,
			reward: 10,
			armor: 0,
			air: false,
			radius: 9,
			lives: 0,
			tex: TRUCKS[foe][1],
			bio: .6,
			supply: true
		},
		{
			name: `${gun("howitzer").name} battery`,
			hp: 420,
			speed: 0,
			reward: 30,
			armor: 0,
			air: false,
			radius: 11,
			lives: 0,
			tex: gun("howitzer").turret,
			bio: .5,
			arm: [
				25,
				20,
				20,
				10
			],
			fixed: "arty",
			base: base(3),
			spot: 120
		}
	];
}
/** Help for the positions of the enemy's base, in `garrison()` order. */
/** Each side's ammunition lorry: name and model. */
var TRUCKS = {
	de: ["Opel Blitz", "de_truck"],
	su: ["ZIS-5", "su_truck"],
	us: ["GMC CCKW", "us_truck"],
	jp: ["Isuzu Type 94", "jp_truck"]
};
/** Our supply truck: the headquarters sends it to refill the depots (see Sim.updateSupply). */
function supplyTruck(side) {
	const [name, tex] = TRUCKS[side];
	return {
		kind: `${side}_truck`,
		name: `${name} supply truck`,
		short: "Truck",
		tex,
		from: "supply",
		truck: true,
		cost: 0,
		manpower: 0,
		train: 0,
		hp: 90,
		speed: 55,
		radius: 9,
		desc: "Drives ammunition from the headquarters to a depot that is running low, then goes back. Unarmoured: the enemy shoots at it, and a depot whose truck is lost waits for the next one."
	};
}
//#endregion
//#region src/game/rules.ts
var cache = /* @__PURE__ */ new Map();
function rulesetFor(ww2) {
	if (!ww2) return CLASSIC;
	const key = `${ww2.side}:${ww2.foe}:${ww2.battle ?? ""}`;
	let r = cache.get(key);
	if (!r) cache.set(key, r = ww2Ruleset(ww2.side, ww2.foe, ww2.battle));
	return r;
}
var current = CLASSIC;
/** Installs the ruleset of a game config. Returns true if it changed. */
function setRuleset(cfg) {
	const r = rulesetFor(cfg.ww2);
	if (r === current && RULESET === r.id) return false;
	current = r;
	installRuleset(r);
	return true;
}
/** Ticks between fresh decisions when no placement is in progress. */
var DECIDE_EVERY = 20;
var IDX = (k) => towerIndex(k);
/** Spots given the full placement check (a path search each) per placement, and per think, so no
*  single tick spends more than a few milliseconds on the partner (each check searches every route). */
var MAX_CHECKS = 14;
var CHECKS_PER_THINK = 6;
/** Spots around a path cell for a 2×2 footprint (top-left corner offsets), nearest first. */
var RING = [
	[-2, -1],
	[1, -1],
	[-1, -2],
	[-1, 1],
	[-3, -1],
	[2, -1],
	[-1, -3],
	[-1, 2],
	[-3, -3],
	[2, 2],
	[-3, 2],
	[2, -3]
];
var Partner = class {
	share;
	/** Lines for the player; the UI drains this. */
	said = [];
	actions = 0;
	spoken = /* @__PURE__ */ new Set();
	greeted = false;
	plan = null;
	/** WW2: tick until which a position isn't asked for again (a rebuild fails while the enemy stands in the rubble). */
	repairWait = /* @__PURE__ */ new Map();
	constructor(share) {
		this.share = share;
	}
	say(key, text) {
		if (this.spoken.has(key)) return;
		this.spoken.add(key);
		this.said.push(text);
	}
	/** Money the partner may still spend: its share of everything invested plus the bank. */
	budget(sim) {
		let mine = 0;
		let theirs = 0;
		for (const t of sim.towers) if (t.owner === 1) mine += t.spent;
		else theirs += t.spent;
		return Math.min(sim.money, this.share * (mine + theirs + sim.money) - mine);
	}
	think(sim) {
		if (sim.gameOver || sim.victory) return null;
		if (!this.greeted) {
			this.greeted = true;
			this.said.push(`Ready when you are. I'll spend up to ${Math.round(this.share * 100)}% of the bank — my towers have a cyan ring.`);
		}
		const budget = this.budget(sim);
		if (this.plan && this.plan.version !== this.layout(sim)) this.plan = null;
		if (this.plan) {
			const cost = sim.cost(this.plan.type);
			if (cost > budget) return null;
			if (sim.ticks % DECIDE_EVERY === 0 && !WW2$1) {
				const own = sim.towers.filter((t) => t.owner === 1);
				const up = own.length >= 8 ? this.bestUpgrade(sim, own, budget - cost) : null;
				if (up) return {
					t: "upgrade",
					ids: [up.id]
				};
			}
			return this.continuePlan(sim);
		}
		if (budget < 8 || sim.ticks % DECIDE_EVERY) return null;
		const own = sim.towers.filter((t) => t.owner === 1);
		const threat = this.threat(sim);
		if (WW2$1) {
			const hurt = own.filter((t) => sim.repairCost(t) > 0 && (t.wreck || t.hp < sim.maxHp(t) * .4) && (this.repairWait.get(t.id) ?? 0) <= sim.ticks).sort((a, b) => Number(b.wreck) - Number(a.wreck) || b.spent - a.spent)[0];
			if (hurt && sim.repairCost(hurt) <= budget) {
				this.repairWait.set(hurt.id, sim.ticks + 240);
				if (hurt.wreck) this.say(`wreck${hurt.id}:${sim.wave}`, `Rebuilding my ${TOWERS[hurt.type].short}.`);
				return {
					t: "repair",
					ids: [hurt.id]
				};
			}
		}
		if (WW2$1 ? own.length >= 16 && this.actions % 5 === 4 : own.length >= 8 && this.actions % 3 === 2) {
			const up = this.bestUpgrade(sim, own, WW2$1 ? 90 : Infinity);
			if (up) {
				if (sim.upgradeCost(up) > budget) return null;
				this.actions++;
				if (up.level + 1 === 4 || up.level + 1 === 9) this.say(`up${up.id}:${up.level}`, `Upgraded my ${TOWERS[up.type].short} to level ${up.level + 2}.`);
				return {
					t: "upgrade",
					ids: [up.id]
				};
			}
		}
		const type = this.chooseType(sim, threat);
		if (type < 0) return null;
		if (sim.cost(type) > budget) return null;
		this.plan = this.startPlan(sim, type);
		if (this.plan) return null;
		const up = this.bestUpgrade(sim, own, budget);
		if (!up) return null;
		this.actions++;
		return {
			t: "upgrade",
			ids: [up.id]
		};
	}
	/** Changes when a tower is built or sold (not on upgrades), which is what invalidates a placement plan. */
	layout(sim) {
		return sim.towers.length * 1e6 + (sim.towers.length ? sim.towers[sim.towers.length - 1].id : 0);
	}
	/** Runs a few placement checks; places the tower once the best spot is known. */
	continuePlan(sim) {
		const p = this.plan;
		const def = TOWERS[p.type];
		const quick = def.kind === "radar" || def.hitsAir && !def.hitsGround || def.walkable;
		const checks = Math.max(1, Math.floor(CHECKS_PER_THINK / sim.map.routes.length));
		for (let n = 0; n < checks && p.k < p.cands.length && p.k < MAX_CHECKS && p.valid < 5; n++) {
			const cd = p.cands[p.k++];
			if (sim.placeStatus(p.type, cd.c, cd.r) !== "ok") continue;
			p.valid++;
			const prev = quick ? null : sim.preview(p.type, cd.c, cd.r);
			const gain = prev ? Math.max(0, this.routeLength(sim, prev) - p.before) : 0;
			const score = cd.cover + gain * 1.5;
			if (score > p.bestScore) {
				p.bestScore = score;
				p.best = cd;
			}
			if (quick) p.k = p.cands.length;
		}
		if (p.k < p.cands.length && p.k < MAX_CHECKS && p.valid < 5) return null;
		this.plan = null;
		this.actions++;
		if (p.best) return {
			t: "place",
			type: p.type,
			col: p.best.c,
			row: p.best.r,
			by: 1
		};
		const up = this.bestUpgrade(sim, sim.towers.filter((t) => t.owner === 1), this.budget(sim));
		return up ? {
			t: "upgrade",
			ids: [up.id]
		} : null;
	}
	/** What the next wave (and the one after) is made of, by share of hit points. */
	threat(sim) {
		const th = {
			air: 0,
			stealth: 0,
			shielded: 0,
			armored: 0,
			swarm: 0
		};
		let total = 0;
		for (const w of [sim.wave + 1, sim.wave + 2]) for (const g of sim.waveGroups(w)) {
			const e = ENEMIES[g.kind];
			const hp = e.hp * g.count * (w === sim.wave + 1 ? 1 : .6);
			total += hp;
			if (e.air) th.air += hp;
			if (e.stealth) th.stealth += hp;
			if (e.shield || e.heal) th.shielded += hp;
			if (WW2$1) {
				if (e.arm && e.arm[0] >= 20) th.armored += hp;
				if (e.inf) th.swarm += hp;
				continue;
			}
			if (e.armor >= 3) th.armored += hp;
			if (e.hp < 60 && g.count >= 10) th.swarm += hp;
		}
		if (total > 0) for (const k of Object.keys(th)) th[k] /= total;
		return th;
	}
	dps(t, air) {
		const def = TOWERS[t.type];
		if (air ? !def.hitsAir : !def.hitsGround) return 0;
		const lv = def.levels[t.level];
		return lv.damage * Math.max(lv.rate, 1) * (air ? def.airMult : 1);
	}
	count(sim, kind) {
		let n = 0;
		for (const t of sim.towers) if (t.kind === kind) n++;
		return n;
	}
	pick(sim, kinds) {
		const ok = kinds.map(IDX).filter((i) => i >= 0 && sim.allowed(i));
		return ok.length ? ok[this.actions % ok.length] : -1;
	}
	/** WW2: arsenal slots (the same for every side), rotating like pick(). */
	pickSlot(sim, slots) {
		const ok = slots.map((sl) => TOWERS.findIndex((t) => t.slot === sl)).filter((i) => i >= 0 && sim.allowed(i) && !sim.airLocked(i));
		return ok.length ? ok[this.actions % ok.length] : -1;
	}
	/** WW2: MGs as the backbone, anti-tank guns in step with the armour, flak with the aircraft, then artillery. */
	chooseWW2(sim, th) {
		const n = /* @__PURE__ */ new Map();
		let total = 0;
		for (const t of sim.towers) {
			const sl = TOWERS[t.type].slot ?? "";
			n.set(sl, (n.get(sl) ?? 0) + 1);
			if (TOWERS[t.type].cat !== "maze") total++;
		}
		const c = (sl) => n.get(sl) ?? 0;
		const first = (slots) => {
			for (const sl of slots) {
				const t = this.pickSlot(sim, [sl]);
				if (t >= 0) return t;
			}
			return -1;
		};
		if ((sim.wave >= 4 || th.air > .06) && c("lightaa") + 2 * c("heavyaa") < 1 + total / 7) {
			if (th.air > .06) this.say(`air${sim.wave}`, "Aircraft in the next waves. Setting up flak.");
			const t = first(["lightaa", "heavyaa"]);
			if (t >= 0) return t;
		}
		const at = c("atgun") + c("at") + 2 * c("tank") + 2 * c("heavyaa");
		if ((sim.wave >= 2 || th.armored > .15) && at < 1 + total * (th.armored > .35 ? .33 : .25)) {
			if (th.armored > .35) this.say(`armor${sim.wave}`, "Heavy armour coming. More anti-tank guns.");
			const t = sim.wave >= 10 && sim.money >= 200 ? first(this.actions % 2 ? ["tank", "atgun"] : ["heavyaa", "atgun"]) : first(this.actions % 3 === 0 ? ["at", "atgun"] : ["atgun", "at"]);
			if (t >= 0) return t;
		}
		if (c("howitzer") > c("observer")) {
			const t = first(["observer"]);
			if (t >= 0) return t;
		}
		let dry = 0;
		for (const t of sim.towers) if (t.ammo < .5 && sim.usesAmmo(t) && !t.wreck && !sim.supplied(t)) dry++;
		if (dry >= 3) {
			const t = first(["depot"]);
			if (t >= 0) {
				this.say(`supply${sim.wave}`, "Our guns are running out of ammunition. Setting up a supply depot.");
				return t;
			}
		}
		if (sim.wave >= 5 && c("workshop") < total / 12) {
			const t = first(["workshop"]);
			if (t >= 0) {
				this.say("workshop", "A repair workshop behind the line will keep our positions standing.");
				return t;
			}
		}
		if (sim.money >= 120 && total > 6) return this.pickSlot(sim, th.swarm > .6 ? [
			"mortar",
			"mg",
			"flamer",
			"bunker"
		] : [
			"mortar",
			"howitzer",
			"rockets",
			"mg",
			"bunker"
		]);
		if (sim.money >= 40 && this.actions % 3 === 2) {
			const t = first(["mortar"]);
			if (t >= 0) return t;
		}
		return first(["mg", "atgun"]);
	}
	chooseType(sim, th) {
		if (WW2$1) return this.chooseWW2(sim, th);
		let airDps = 0;
		let groundDps = 0;
		for (const t of sim.towers) {
			airDps += this.dps(t, true);
			groundDps += this.dps(t, false);
		}
		const allowed = (k) => IDX(k) >= 0 && sim.allowed(IDX(k));
		if (th.stealth > .05 && allowed("radar") && this.radarCover(sim) < .6 && this.count(sim, "radar") < 3 + 2 * sim.map.routes.length) {
			this.say(`stealth${sim.wave}`, "Stealth units coming. Putting up a Radar.");
			return IDX("radar");
		}
		if (th.air > .1 && airDps < (groundDps + airDps) * th.air * 1.1) {
			this.say(`air${sim.wave}`, "Helicopters inbound. Building anti-air.");
			if (sim.wave >= 3 && allowed("flak") && this.count(sim, "flak") <= this.count(sim, "missile")) return IDX("flak");
			const t = this.pick(sim, [
				"missile",
				"gun",
				"flak"
			]);
			if (t >= 0) return t;
		}
		if (th.shielded > .12 && allowed("jammer") && this.count(sim, "jammer") < sim.map.routes.length) {
			this.say(`jam${sim.wave}`, "Shielded units ahead. A Jammer will strip their shields.");
			return IDX("jammer");
		}
		const own = sim.towers.reduce((n, t) => n + (t.owner === 1 ? 1 : 0), 0);
		if (own < 5) return this.pick(sim, own % 3 === 2 ? ["cannon", "gun"] : ["gun"]);
		if (th.armored > .35) {
			this.say(`armor${sim.wave}`, "Heavy armour next. Bringing lasers and cannons.");
			return this.pick(sim, [
				"laser",
				"cannon",
				"sniper",
				"acid",
				"laser"
			]);
		}
		if (th.swarm > .4) return this.pick(sim, [
			"tesla",
			"napalm",
			"gas",
			"flame",
			"gun"
		]);
		if (own > 14 && this.count(sim, "command") < 1 && allowed("command")) return IDX("command");
		return this.pick(sim, [
			"gun",
			"cannon",
			"tesla",
			"laser",
			"napalm",
			"gun",
			"sniper",
			"cryo"
		]);
	}
	/** The own tower that has earned its keep the most per dollar, among the upgrades it can afford. */
	bestUpgrade(sim, own, budget) {
		let best = null;
		let score = -1;
		for (const t of own) {
			const cost = sim.upgradeCost(t);
			if (cost <= 0 || cost > budget) continue;
			const s = (t.damage + 50) / t.spent;
			if (s > score) {
				score = s;
				best = t;
			}
		}
		return best;
	}
	/** Ground path cells of every route, entry to exit. */
	pathCells(sim, routeOf) {
		const out = [];
		sim.map.routes.forEach((r, k) => {
			const f = sim.fields[k];
			let c = r.entry[r.entry.length >> 1];
			for (let g = 0; g < 4e3 && c >= 0 && f.dist[c] > 0; g++) {
				out.push(c);
				routeOf?.push(k);
				c = f.next[c];
			}
		});
		return out;
	}
	/** Cells under the air lanes (straight lines from where aircraft appear to where they leave). */
	airCells(sim, routeOf) {
		const out = [];
		for (const [k, r] of sim.map.routes.entries()) {
			const [x0, y0] = r.airFrom;
			const [x1, y1] = r.airTo;
			const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 20);
			for (let s = 0; s <= n; s++) {
				const c = Math.floor((x0 + (x1 - x0) * s / n) / 20);
				const row = Math.floor((y0 + (y1 - y0) * s / n) / 20);
				if (c >= 0 && row >= 0 && c < COLS && row * COLS + c < sim.blocked.length) {
					out.push(row * COLS + c);
					routeOf?.push(k);
				}
			}
		}
		return out;
	}
	/** Per route: 1 / (1 + towers that can hit some of its cells / 4). */
	routeWeights(sim, target, routeOf, air) {
		const n = sim.map.routes.length;
		if (n === 1) return [1];
		const guarded = new Array(n).fill(0);
		for (const t of sim.towers) {
			const def = TOWERS[t.type];
			if (air ? !def.hitsAir : !def.hitsGround) continue;
			const r2 = def.levels[t.level].range ** 2;
			const hit = new Array(n).fill(false);
			for (let q = 0; q < target.length; q += 3) {
				const k = routeOf[q];
				if (hit[k]) continue;
				const dx = (target[q] % COLS + .5) * 20 - t.x;
				const dy = ((target[q] / COLS | 0) + .5) * 20 - t.y;
				if (dx * dx + dy * dy <= r2) hit[k] = true;
			}
			hit.forEach((h, k) => h && guarded[k]++);
		}
		return guarded.map((g) => 1 / (1 + g / 4));
	}
	radarCover(sim) {
		const path = this.pathCells(sim);
		if (!path.length) return 1;
		let seen = 0;
		for (const c of path) seen += sim.radarGrid[c];
		return seen / path.length;
	}
	routeLength(sim, fields = sim.fields) {
		return sim.map.routes.reduce((a, r, k) => a + fields[k].dist[r.entry[r.entry.length >> 1]], 0);
	}
	/** Scores every free spot near the route by coverage (cheap); the path checks come in continuePlan. */
	startPlan(sim, type) {
		const def = TOWERS[type];
		const airOnly = def.hitsAir && !def.hitsGround;
		const routeOf = [];
		const target = airOnly ? this.airCells(sim, routeOf) : this.pathCells(sim, routeOf);
		if (!target.length) return null;
		const range = Math.max(60, def.levels[0].range);
		const r2 = range * range;
		const radar = def.kind === "radar";
		const half = def.size * 20 / 2;
		const weight = this.routeWeights(sim, target, routeOf, airOnly);
		const px = [];
		const py = [];
		const pw = [];
		target.forEach((p, q) => {
			if (radar && sim.radarGrid[p]) return;
			px.push((p % COLS + .5) * 20);
			py.push(((p / COLS | 0) + .5) * 20);
			pw.push(weight[routeOf[q]]);
		});
		const cands = [];
		const seen = /* @__PURE__ */ new Set();
		const step = target.length > 400 ? 3 : 2;
		for (let k = 0; k < target.length; k += step) {
			const pc = target[k] % COLS;
			const pr = target[k] / COLS | 0;
			for (const [dc, dr] of RING) {
				const c = pc + dc;
				const r = pr + dr;
				const key = r * COLS + c;
				if (seen.has(key)) continue;
				seen.add(key);
				if (!sim.footprintFree(type, c, r)) continue;
				const x = c * 20 + half;
				const y = r * 20 + half;
				let cover = 0;
				for (let q = 0; q < px.length; q++) {
					const dx = px[q] - x;
					const dy = py[q] - y;
					if (dx * dx + dy * dy <= r2) cover += pw[q];
				}
				if (radar && cover > 0) {
					for (const t of sim.towers) if (t.kind !== "radar" && TOWERS[t.type].hitsGround && (t.x - x) ** 2 + (t.y - y) ** 2 <= r2) cover += 4;
				}
				if (cover > 0) cands.push({
					c,
					r,
					cover
				});
			}
		}
		if (!cands.length) return null;
		cands.sort((a, b) => b.cover - a.cover || a.r - b.r || a.c - b.c);
		return {
			type,
			version: this.layout(sim),
			cands,
			k: 0,
			valid: 0,
			before: this.routeLength(sim),
			best: null,
			bestScore: -1
		};
	}
};
//#endregion
//#region src/game/config.ts
var DIFFICULTIES = {
	easy: {
		name: "Easy",
		hp: .75,
		money: 1.5,
		lives: 30,
		medals: 1,
		score: .6
	},
	normal: {
		name: "Normal",
		hp: 1,
		money: 1,
		lives: 20,
		medals: 2,
		score: 1
	},
	hard: {
		name: "Hard",
		hp: 1.3,
		money: .85,
		lives: 15,
		medals: 3,
		score: 1.5
	},
	brutal: {
		name: "Brutal",
		hp: 1.7,
		money: .7,
		lives: 10,
		medals: 5,
		score: 2.2
	}
};
var perk = (cfg, id) => cfg.perks[id] ?? 0;
//#endregion
//#region src/game/flow.ts
var SQRT2 = Math.SQRT2;
var NDX = [
	1,
	-1,
	0,
	0,
	1,
	1,
	-1,
	-1
];
var NDY = [
	0,
	0,
	1,
	-1,
	1,
	-1,
	1,
	-1
];
var NCOST = [
	1,
	1,
	1,
	1,
	SQRT2,
	SQRT2,
	SQRT2,
	SQRT2
];
/**
* Distance field towards a set of goal cells (Dijkstra, octile moves weighted by terrain, no corner cutting).
* Every walkable cell knows its remaining distance and the neighbour to step to,
* so moving thousands of units costs one array lookup each.
*/
var FlowField = class {
	goals;
	cost;
	dist = new Float32Array(COLS * ROWS);
	next = new Int32Array(COLS * ROWS);
	heap = new Int32Array(COLS * ROWS * 8);
	heapKey = new Float32Array(COLS * ROWS * 8);
	/** cost[i]: time to cross cell i relative to open ground (water is slower), so units take the quickest way. */
	constructor(goals, cost) {
		this.goals = goals;
		this.cost = cost;
	}
	/**
	* blocked[i] != 0 means impassable. Hot (every placement check runs it per route): heap inlined.
	* `corners` decides which diagonal squeezes are refused (the breach field passes through walls but
	* still can't slip between two that touch at a corner).
	*/
	compute(blocked, corners = blocked) {
		const dist = this.dist;
		const cost = this.cost;
		const next = this.next;
		dist.fill(Infinity);
		next.fill(-1);
		const heap = this.heap;
		const key = this.heapKey;
		let size = 0;
		const goals = this.goals;
		for (let g = 0; g < goals.length; g++) {
			const i = goals[g];
			if (blocked[i]) continue;
			dist[i] = 0;
			let p = size++;
			while (p > 0) {
				const parent = p - 1 >> 1;
				if (key[parent] <= 0) break;
				heap[p] = heap[parent];
				key[p] = key[parent];
				p = parent;
			}
			heap[p] = i;
			key[p] = 0;
		}
		while (size > 0) {
			const k = key[0];
			const i = heap[0];
			const li = heap[--size];
			const lk = key[size];
			let p = 0;
			for (;;) {
				let c = p * 2 + 1;
				if (c >= size) break;
				if (c + 1 < size && key[c + 1] < key[c]) c++;
				if (key[c] >= lk) break;
				heap[p] = heap[c];
				key[p] = key[c];
				p = c;
			}
			heap[p] = li;
			key[p] = lk;
			if (k > dist[i]) continue;
			const cx = i % COLS;
			const cy = i / COLS | 0;
			for (let n = 0; n < 8; n++) {
				const dx = NDX[n];
				const dy = NDY[n];
				const x = cx + dx;
				const y = cy + dy;
				if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
				const j = y * COLS + x;
				if (blocked[j]) continue;
				if (dx && dy && (corners[cy * COLS + x] || corners[y * COLS + cx])) continue;
				const nd = k + NCOST[n] * .5 * (cost[i] + cost[j]);
				if (nd < dist[j]) {
					dist[j] = nd;
					next[j] = i;
					let q = size++;
					while (q > 0) {
						const parent = q - 1 >> 1;
						if (key[parent] <= nd) break;
						heap[q] = heap[parent];
						key[q] = key[parent];
						q = parent;
					}
					heap[q] = j;
					key[q] = nd;
				}
			}
		}
	}
	copyFrom(o) {
		this.dist.set(o.dist);
		this.next.set(o.next);
	}
};
//#endregion
//#region src/game/spatial.ts
/**
* Uniform grid rebuilt every tick with a counting sort: O(n) build,
* zero allocations, cache-friendly queries.
*/
var SpatialHash = class {
	cell;
	cols;
	rows;
	start;
	count;
	items;
	cellOf;
	constructor(width, height, cell, maxItems) {
		this.cell = cell;
		this.cols = Math.ceil(width / cell);
		this.rows = Math.ceil(height / cell);
		const n = this.cols * this.rows;
		this.start = new Int32Array(n + 1);
		this.count = new Int32Array(n);
		this.items = new Int32Array(maxItems);
		this.cellOf = new Int32Array(maxItems);
	}
	cellIndex(x, y) {
		let cx = x / this.cell | 0;
		let cy = y / this.cell | 0;
		if (cx < 0) cx = 0;
		else if (cx >= this.cols) cx = this.cols - 1;
		if (cy < 0) cy = 0;
		else if (cy >= this.rows) cy = this.rows - 1;
		return cy * this.cols + cx;
	}
	/** ids[0..n) are live slot indices; xs/ys are indexed by slot. */
	build(ids, n, xs, ys) {
		const count = this.count;
		const start = this.start;
		count.fill(0);
		for (let k = 0; k < n; k++) {
			const i = ids[k];
			const c = this.cellIndex(xs[i], ys[i]);
			this.cellOf[k] = c;
			count[c]++;
		}
		let acc = 0;
		for (let c = 0; c < count.length; c++) {
			start[c] = acc;
			acc += count[c];
			count[c] = start[c];
		}
		start[count.length] = acc;
		for (let k = 0; k < n; k++) this.items[count[this.cellOf[k]]++] = ids[k];
	}
	/** Writes candidate slot indices whose cell overlaps the circle into out; returns count. */
	query(x, y, r, out) {
		const cs = this.cell;
		let x0 = (x - r) / cs | 0;
		let x1 = (x + r) / cs | 0;
		let y0 = (y - r) / cs | 0;
		let y1 = (y + r) / cs | 0;
		if (x0 < 0) x0 = 0;
		if (y0 < 0) y0 = 0;
		if (x1 >= this.cols) x1 = this.cols - 1;
		if (y1 >= this.rows) y1 = this.rows - 1;
		let n = 0;
		const start = this.start;
		const items = this.items;
		for (let cy = y0; cy <= y1; cy++) {
			const row = cy * this.cols;
			for (let cx = x0; cx <= x1; cx++) {
				const c = row + cx;
				for (let k = start[c], e = start[c + 1]; k < e; k++) out[n++] = items[k];
			}
		}
		return n;
	}
};
var HERO_ABILITIES = [
	{
		name: "Airstrike",
		key: "[",
		cd: 40,
		desc: "A jet carpet-bombs a line through the target."
	},
	{
		name: "Rally",
		key: "]",
		cd: 50,
		desc: "Towers near the hero fire 40% faster for 8s."
	},
	{
		name: "Stun Grenade",
		key: "\\",
		cd: 25,
		desc: "Stops every unit near the target for 2.5s."
	}
];
/** WW2: the commander calls in the guns, rallies the line and sends a spotter plane. */
var WW2_ABILITIES = [
	{
		name: "Fire Mission",
		key: "[",
		cd: 40,
		desc: "The divisional guns drop ten shells around the target."
	},
	{
		name: "Hold the Line",
		key: "]",
		cd: 50,
		desc: "Crews near the commander shake off suppression and fire 40% faster for 8s."
	},
	{
		name: "Recon Flight",
		key: "\\",
		cd: 30,
		desc: "A spotter plane marks every attacker near the target for 20s: snipers revealed, +20% damage taken."
	}
];
/** The commander's abilities in the running ruleset. */
function heroAbilities() {
	return WW2$1 ? WW2_ABILITIES : HERO_ABILITIES;
}
var TURN_RATE = 10;
/** WW2: penetration over armour below which crews hold fire (from 0.7 a hit only chips; see ballistics). */
var HURT_RATIO = .8;
/** WW2: penetration at a share `f` of the gun's range compared with its rated (mid-range) figure. */
function penFalloff(f) {
	return 1.1 - .25 * Math.min(1, f);
}
/** WW2: speed of infantry climbing over dragon's teeth. */
var TEETH_CLIMB = .35;
/** WW2: hand grenades thrown by infantry at an emplacement next to them. */
var GRENADE_DMG = 14;
var GRENADE_PEN = 40;
/** WW2: s to build an emplacement worth `cost` (rubble goes back up a little faster). */
function buildTime(cost) {
	return Math.min(20, 2 + cost / 25);
}
/** WW2 bases: the enemy's positions around its headquarters (slot 0 is the HQ itself). */
var MAX_GARRISON = 16;
/** WW2 bases: s before the enemy starts rebuilding a lost position, and s the work takes. */
var GARRISON_REBUILD = 40;
var GARRISON_BUILD = 20;
/** WW2 battles: s after the last wave is all in before the relief arrives and the battle is won. */
var RELIEF_T = 90;
/** WW2 bases: s without being hit before the enemy repairs a position, and the share of its hp per s. */
var GARRISON_QUIET = 12;
var GARRISON_REPAIR = .005;
/** WW2 bases: hit points of the player's headquarters compared with a Field HQ of its level. */
var BASE_HP = 9;
var BASE_FORT = 80;
var BASE_VALUE = 400;
/** WW2 bases: the headquarters' own machine guns, and its anti-tank gun (damage, penetration, reload). */
var BASE_GUN_RANGE = 150;
var BASE_AT = [
	90,
	110,
	3
];
/** WW2: penetration of the commander's submachine gun. */
var HERO_PEN = 8;
var TWO_PI = Math.PI * 2;
/** WW2: how the attackers' weapons sound (EV_ESHOT), indexed like EnemyGun.fx. */
var ENEMY_FX = [
	"rifle",
	"smg",
	"mg",
	"tank",
	"rocket",
	"katyusha",
	"satchel",
	"barrage",
	"kamikaze"
];
/** WW2: what a wrecked emplacement costs to rebuild, and what a repair costs, as a share of what went into it. */
var REPAIR_SHARE = .4;
/** s the wounded commander is out of action. */
var HERO_DOWN = 20;
/** How far a Guard leaves its post to chase, and how far a Hunt looks for prey (px). */
var GUARD_LEASH = 150;
var HUNT_RANGE = 420;
/** s to dig a foxhole or a hull-down scrape, and to bury a mine. */
var DIG_TIME = 4;
var LAY_TIME = 2.5;
/** Kills for each veterancy rank (1-3). */
var VET_KILLS = [
	3,
	8,
	15
];
/** Defender ids for units: -(UNIT_ID0 + slot). */
var UNIT_ID0 = 10;
/** s an emplacement or unit stays revealed after firing, and stays known after being spotted. */
var REVEAL_T = 3;
var KNOWN_T = 4;
/** WW2 supply: s of sustained fire in a full stock of ammunition, by role (artillery and AT guns run dry first). */
var AMMO_S = {
	gun: 100,
	bunker: 100,
	sniper: 80,
	flame: 40,
	at: 60,
	cannon: 60,
	arty: 50
};
/** Fire rate of a gun that has run dry: the crew scrounges what it can. */
var EMPTY_RATE = .4;
/**
* Share of a full stock a depot or headquarters hands each gun in reach per s; crews out of reach scrounge this
* much under fire, and LULL_SUPPLY times as much while no attacker is on the field (carried up by hand).
*/
var RESUPPLY = .12;
var SCROUNGE = .006;
var LULL_SUPPLY = 5;
/** Full stocks of ammunition a depot's store holds; a truck from the headquarters fills it again. */
var DEPOT_LOADS = 6;
/** A depot below this share of its store calls for a truck; s between trucks leaving; trucks at once. */
var DEPOT_CALL = .6;
var TRUCK_GAP = 2;
var MAX_TRUCKS = 8;
/** WW2: the enemy's supply column: s between trucks, the supply each brings, what a wave uses, s a starved wave waits. */
var CONVOY_EVERY = 12;
var CONVOY_LOAD = .2;
var WAVE_SUPPLY = .25;
var STARVED_WAIT = 30;
/** WW2 morale: below this the attacker breaks (falls back, or surrenders if pinned); losses that shake its neighbours and its wave. */
var BREAK = .3;
var LOSS_SHOCK = .07;
var OFFICER_SHOCK = .35;
/** WW2 morale, ours: suppression a knocked-out emplacement or a lost unit gives the crews round it, how far, s they stay shaken. */
var LOSS_SUPP = .45;
var SHAKEN_T = 8;
/** WW2 combined arms: escorts per tank, px within which a tank counts as escorted, damage bonus of infantry anti-tank
* weapons against an unescorted tank, and the infantry's close assault on one (satchels and grenades: damage, pen, reload). */
var ESCORTS = 3;
var ESCORT_R = 60;
var CLOSE_BONUS = 1.5;
var ASSAULT_DMG = 45;
var ASSAULT_PEN = 70;
var ASSAULT_CD = 7;
var ASSAULT_SLOTS = /* @__PURE__ */ new Set([
	"mg",
	"at",
	"flamer",
	"bunker",
	"sniper"
]);
/** WW2 counter-battery: shots of ours before the enemy has a fix on a gun, how fast the fix fades (per s), its answer (shells, damage). */
var FIX_SHOTS = 4;
var FIX_FADE = .01;
var CB_SHELLS = 5;
var CB_DMG = 46;
var HULK_T = 100;
var HULK_COVER = .6;
var CLEAR_WORK = 6;
/** An engineer's task clearing the hulk in cell c is -(HULK_TASK + c). */
var HULK_TASK = 1e3;
/** WW2 moving front: s our soldiers must hold a knocked-out position of theirs to take it, s before they counter-attack. */
var CAPTURE_T = 5;
var COUNTER_T = 20;
/** Their positions we can take, and the slot of ours they become. */
var CAPTURE_SLOT = {
	mg: "mg",
	at: "atgun",
	depot: "depot",
	arty: "howitzer"
};
/** WW2 day and night: s of game time in a day; how much night shortens direct fire and sight. */
var DAY_S = 720;
var NIGHT_RANGE = .25;
var NIGHT_SIGHT = .35;
var FLARE_T = 12;
var FLARE_CD = 9;
/** WW2 sight: how far our emplacements, units and commander see (at least), ticks between fog updates, s an attacker stays seen after firing. */
var TOWER_SIGHT = 140;
var UNIT_SIGHT = 130;
var AIR_SIGHT = 220;
var SIGHT_TICKS = 15;
var FLASH_SEEN = 2.5;
/** Ticks between supply rounds (depots, headquarters, trucks). */
var SUPPLY_TICKS = 30;
var SMOKE_T = 6;
/** WW2 skirmish weather, from the seed (without touching the game's random numbers). */
function skirmishWeather(seed) {
	const r = new Rng(seed ^ 739982445).next();
	return r < .55 ? "clear" : r < .72 ? "rain" : r < .86 ? "fog" : "snow";
}
function angleDiff(a, b) {
	let d = (b - a) % TWO_PI;
	if (d > Math.PI) d -= TWO_PI;
	else if (d < -Math.PI) d += TWO_PI;
	return d;
}
var Sim = class Sim {
	map;
	/** Gameplay randomness: must be consumed identically on every run (replays, co-op lockstep). */
	rng;
	/** Visual-only randomness (particles), so effect settings never change the outcome. */
	vr = new Rng(99);
	/** Per route: distance field towards its exit, over the current maze. */
	fields;
	scratch;
	/**
	* WW2: per route, the way through if walls can be broken: emplacement cells are passable at a cost
	* that grows with their strength. Rebuilt whenever the towers change (derived state, not saved).
	*/
	breach;
	breachCost = new Float32Array(COLS * ROWS);
	breachBlocked = new Uint8Array(COLS * ROWS);
	breachVersion = -1;
	/** WW2: infantry climb over dragon's teeth (slowly); their own flow fields, rebuilt with the breach fields. */
	foot;
	footCost = new Float32Array(COLS * ROWS);
	footBlocked = new Uint8Array(COLS * ROWS);
	hasTeeth = false;
	/** Speed factor of the bare ground (water slows ground units) and the matching path cost. Static per map. */
	groundSlow = new Float32Array(COLS * ROWS);
	moveCost = new Float32Array(COLS * ROWS);
	/** Impassable cells: rocks, mountains, forests and towers. */
	blocked = new Uint8Array(COLS * ROWS);
	/** WW2: cells that block sight and fire — forests, mountains, rocks and ruins (static per map). */
	sightBlock = new Uint8Array(COLS * ROWS);
	/** WW2: per tower id, the cells round it that it can see (a square of 2r+1 cells), derived from the terrain. */
	losMasks = /* @__PURE__ */ new Map();
	/** WW2 fog of war: cells something of ours sees now (towers' part rebuilt when they change; units' every SIGHT_TICKS). */
	seenGrid = new Uint8Array(COLS * ROWS);
	towerSight = new Uint8Array(COLS * ROWS);
	towerSightVersion = -1;
	/** Bumped when the fog changes (the renderer redraws it). */
	sightVersion = 0;
	spawnCount = 0;
	config;
	/** WW2 campaign: the historical battle being fought, if any. */
	battle;
	/** Waves to hold to win (a battle may be shorter than the standard 30). */
	totalWaves;
	/** The tower that must not fall (battle objective), 0 if none. */
	objectiveId = 0;
	/** WW2: the player's headquarters at the end of each route (tower ids; enemies march on them). */
	bases = /* @__PURE__ */ new Int32Array(8);
	/** WW2: the enemy's base positions: kind (-1 none), where, s until rebuilt (0 while it stands), its enemy slot. */
	gKind = new Int32Array(MAX_GARRISON).fill(-1);
	gX = new Float32Array(MAX_GARRISON);
	gY = new Float32Array(MAX_GARRISON);
	gAng = new Float32Array(MAX_GARRISON);
	gT = new Float32Array(MAX_GARRISON);
	gSlot = new Int32Array(MAX_GARRISON).fill(-1);
	/** WW2 moving front: s our soldiers have held a knocked-out position, the tower it became (0: theirs), what it was, s to their counter-attack. */
	gCap = new Float32Array(MAX_GARRISON);
	gOwn = new Int32Array(MAX_GARRISON);
	gOrig = new Int32Array(MAX_GARRISON).fill(-1);
	gCounter = new Float32Array(MAX_GARRISON);
	/** Bumped when the front moves (the minimap redraws it). */
	frontVersion = 0;
	/** WW2: placing a captured position (their ground doesn't forbid it). */
	capturing = false;
	/** Base positions standing (they count in liveCount but are not part of any wave). */
	garrisonAlive = 0;
	/** WW2 battles: s since the last wave was all in (relief arrives after RELIEF_T). */
	reliefT = 0;
	/** WW2: the weather of this game, and the hour it started at (the clock runs with the game time). */
	weather;
	startHour;
	/** WW2 flares in the sky (swap-remove) and the cells they light. */
	flX = /* @__PURE__ */ new Float32Array(16);
	flY = /* @__PURE__ */ new Float32Array(16);
	flT = /* @__PURE__ */ new Float32Array(16);
	flCount = 0;
	litGrid = new Uint8Array(COLS * ROWS);
	/** findTarget(): past this (squared) distance, only lit targets (night; 0 off). */
	dimR2 = 0;
	/** The sight multiplier the towers' part of the fog was built with. */
	sightStep = -1;
	/** WW2 supply: s until a headquarters can send the next truck; our trucks' unit kind (-1 none). */
	truckCd = 0;
	truckKind = UNITS.findIndex((u) => u.truck);
	/** WW2: the enemy's supply for its next waves 0..1, s to its next truck, its trucks on the road. */
	foeSupply = 1;
	convoyT = CONVOY_EVERY;
	convoyAlive = 0;
	money = 0;
	lives = 0;
	hpMult;
	routeFactor;
	bountyMult;
	events = [];
	/** Damage dealt by each tower since the last wave report (cosmetic: never read by the simulation). */
	waveDamage = /* @__PURE__ */ new Map();
	hero = null;
	items = [
		1,
		1,
		1
	];
	itemMax;
	strikes = [];
	leakedThisWave = 0;
	/** Fraction of cosmetic particles to keep (effects quality setting). */
	fxScale = 1;
	wave = 0;
	nextWaveTimer = 0;
	time = 0;
	ticks = 0;
	gameOver = false;
	victory = false;
	endless = false;
	totalKills = 0;
	eAlive = new Uint8Array(MAX_ENEMIES);
	eUid = new Int32Array(MAX_ENEMIES);
	eKind = new Uint8Array(MAX_ENEMIES);
	eAir = new Uint8Array(MAX_ENEMIES);
	eHp = new Float32Array(MAX_ENEMIES);
	eMaxHp = new Float32Array(MAX_ENEMIES);
	eRoute = new Uint8Array(MAX_ENEMIES);
	eRemain = new Float32Array(MAX_ENEMIES);
	eCell = new Int32Array(MAX_ENEMIES);
	eSpeed = new Float32Array(MAX_ENEMIES);
	eSlowT = new Float32Array(MAX_ENEMIES);
	eSlowF = new Float32Array(MAX_ENEMIES);
	eOx = new Float32Array(MAX_ENEMIES);
	eOy = new Float32Array(MAX_ENEMIES);
	eX = new Float32Array(MAX_ENEMIES);
	eY = new Float32Array(MAX_ENEMIES);
	ePx = new Float32Array(MAX_ENEMIES);
	ePy = new Float32Array(MAX_ENEMIES);
	eAng = new Float32Array(MAX_ENEMIES);
	ePang = new Float32Array(MAX_ENEMIES);
	eReward = new Float32Array(MAX_ENEMIES);
	eFlash = new Float32Array(MAX_ENEMIES);
	eGCell = new Int32Array(MAX_ENEMIES);
	eStealth = new Uint8Array(MAX_ENEMIES);
	eSeen = new Uint8Array(MAX_ENEMIES);
	eJam = new Float32Array(MAX_ENEMIES);
	eShield = new Float32Array(MAX_ENEMIES);
	eMaxShield = new Float32Array(MAX_ENEMIES);
	eShieldCd = new Float32Array(MAX_ENEMIES);
	eHealCd = new Float32Array(MAX_ENEMIES);
	eBurnT = new Float32Array(MAX_ENEMIES);
	eBurn = new Float32Array(MAX_ENEMIES);
	eBurnBy = new Array(MAX_ENEMIES).fill(null);
	eShred = new Float32Array(MAX_ENEMIES);
	eShredT = new Float32Array(MAX_ENEMIES);
	eChill = new Float32Array(MAX_ENEMIES);
	eFrozenT = new Float32Array(MAX_ENEMIES);
	eHackT = new Float32Array(MAX_ENEMIES);
	eStunT = new Float32Array(MAX_ENEMIES);
	/** WW2: suppression 0..1 — pinned infantry crawl and keep their heads down. */
	eSupp = new Float32Array(MAX_ENEMIES);
	/** WW2 morale: 1 steady … 0 broken; falling back to their lines; the wave it came with; s spent pinned down. */
	eMorale = new Float32Array(MAX_ENEMIES);
	eRetreat = new Uint8Array(MAX_ENEMIES);
	eWave = new Int16Array(MAX_ENEMIES);
	ePinT = new Float32Array(MAX_ENEMIES);
	/** WW2 moving front: the tower a counter-attacker is sent to retake (0: none). */
	eHunt = new Int32Array(MAX_ENEMIES);
	/** Per hunted tower id, the way to it (derived, rebuilt when the maze changes). */
	huntFields = /* @__PURE__ */ new Map();
	/** WW2 combined arms: the tank an infantry squad escorts (slot, -1 none, and its uid), escorts per tank, has infantry close by. */
	eLead = new Int32Array(MAX_ENEMIES).fill(-1);
	eLeadUid = new Int32Array(MAX_ENEMIES);
	eEscortN = new Uint8Array(MAX_ENEMIES);
	eEscort = new Uint8Array(MAX_ENEMIES);
	/** WW2: smoke screens a wave has laid ahead of its assault (w & 63). */
	smokeWave = /* @__PURE__ */ new Uint8Array(64);
	/** WW2: is the officer of wave w (w & 63) still alive? */
	officerAlive = /* @__PURE__ */ new Uint8Array(64);
	/** WW2: per route, the way back to the entry for attackers falling back (derived, rebuilt when the maze changes). */
	back = [];
	backVersion = -1;
	/** WW2: s an attacker stays seen after giving itself away by firing. */
	eSeenT = new Float32Array(MAX_ENEMIES);
	/** WW2: s left marked by the player's recon flight (seen everywhere, takes more damage). */
	eMarkT = new Float32Array(MAX_ENEMIES);
	/** WW2 bases: the garrison position this is (-1: a wave attacker), s of construction left; grenade reload. */
	eGar = new Int16Array(MAX_ENEMIES).fill(-1);
	eBuild = new Float32Array(MAX_ENEMIES);
	eNadeCd = new Float32Array(MAX_ENEMIES);
	/** WW2 intelligence: breaching a wall (0/1), the tower id it is breaking through, s spent stuck, smoke used, inside smoke, sapper work timer. */
	eBreach = new Uint8Array(MAX_ENEMIES);
	eWall = new Int32Array(MAX_ENEMIES);
	eBreachT = new Float32Array(MAX_ENEMIES);
	eSmokeUsed = new Uint8Array(MAX_ENEMIES);
	eSmoked = new Uint8Array(MAX_ENEMIES);
	eWork = new Float32Array(MAX_ENEMIES);
	/** WW2 return fire: the defender aimed at (0 none, -1 the commander, else a tower id), reload, s left of the halt to aim. */
	eTgt = new Int32Array(MAX_ENEMIES);
	eGunCd = new Float32Array(MAX_ENEMIES);
	eAimT = new Float32Array(MAX_ENEMIES);
	eHackDps = new Float32Array(MAX_ENEMIES);
	eFree = new Int32Array(MAX_ENEMIES);
	eFreeTop = 0;
	nextUid = 1;
	/** Dense list of live slots, valid after each tick. */
	live = new Int32Array(MAX_ENEMIES);
	liveCount = 0;
	pKind = new Uint8Array(MAX_PROJECTILES);
	pX = new Float32Array(MAX_PROJECTILES);
	pY = new Float32Array(MAX_PROJECTILES);
	pPx = new Float32Array(MAX_PROJECTILES);
	pPy = new Float32Array(MAX_PROJECTILES);
	pVx = new Float32Array(MAX_PROJECTILES);
	pVy = new Float32Array(MAX_PROJECTILES);
	pSpeed = new Float32Array(MAX_PROJECTILES);
	pDmg = new Float32Array(MAX_PROJECTILES);
	pSplash = new Float32Array(MAX_PROJECTILES);
	pAirMult = new Float32Array(MAX_PROJECTILES);
	pTarget = new Int32Array(MAX_PROJECTILES);
	pTuid = new Int32Array(MAX_PROJECTILES);
	pTtl = new Float32Array(MAX_PROJECTILES);
	pTtl0 = new Float32Array(MAX_PROJECTILES);
	pTx = new Float32Array(MAX_PROJECTILES);
	pTy = new Float32Array(MAX_PROJECTILES);
	pExtra = new Float32Array(MAX_PROJECTILES);
	pExtra2 = new Float32Array(MAX_PROJECTILES);
	pSrc = new Array(MAX_PROJECTILES).fill(null);
	pCount = 0;
	rkSx = /* @__PURE__ */ new Float32Array(512);
	rkSy = /* @__PURE__ */ new Float32Array(512);
	rkTx = /* @__PURE__ */ new Float32Array(512);
	rkTy = /* @__PURE__ */ new Float32Array(512);
	rkWait = /* @__PURE__ */ new Float32Array(512);
	rkT = /* @__PURE__ */ new Float32Array(512);
	rkT0 = /* @__PURE__ */ new Float32Array(512);
	rkDmg = /* @__PURE__ */ new Float32Array(512);
	rkCount = 0;
	smX = /* @__PURE__ */ new Float32Array(64);
	smY = /* @__PURE__ */ new Float32Array(64);
	smT = /* @__PURE__ */ new Float32Array(64);
	smCount = 0;
	rkShell = /* @__PURE__ */ new Uint8Array(512);
	hkCell = /* @__PURE__ */ new Int32Array(48);
	hkT = /* @__PURE__ */ new Float32Array(48);
	hkBlock = /* @__PURE__ */ new Uint8Array(48);
	hkKind = /* @__PURE__ */ new Int16Array(48);
	hkAng = /* @__PURE__ */ new Float32Array(48);
	hkWork = /* @__PURE__ */ new Float32Array(48);
	hkCount = 0;
	/** Per cell: 0 nothing, 1 a hulk, 2 in the cover of one (next to it). */
	hulkGrid = new Uint8Array(COLS * ROWS);
	/** The hulk test (a path search) runs at most once a tick. */
	hulkTick = -1;
	uAlive = /* @__PURE__ */ new Uint8Array(192);
	uUid = /* @__PURE__ */ new Int32Array(192);
	uKind = /* @__PURE__ */ new Uint8Array(192);
	uAir = /* @__PURE__ */ new Uint8Array(192);
	uX = /* @__PURE__ */ new Float32Array(192);
	uY = /* @__PURE__ */ new Float32Array(192);
	uPx = /* @__PURE__ */ new Float32Array(192);
	uPy = /* @__PURE__ */ new Float32Array(192);
	uAng = /* @__PURE__ */ new Float32Array(192);
	uPang = /* @__PURE__ */ new Float32Array(192);
	uHp = /* @__PURE__ */ new Float32Array(192);
	uCd = /* @__PURE__ */ new Float32Array(192);
	uTgt = (/* @__PURE__ */ new Int32Array(192)).fill(-1);
	uTuid = /* @__PURE__ */ new Int32Array(192);
	uStance = /* @__PURE__ */ new Uint8Array(192);
	uPostX = /* @__PURE__ */ new Float32Array(192);
	uPostY = /* @__PURE__ */ new Float32Array(192);
	uPath = /* @__PURE__ */ new Int32Array(30720);
	uPathLen = /* @__PURE__ */ new Uint16Array(192);
	uPathI = /* @__PURE__ */ new Uint16Array(192);
	uGoal = (/* @__PURE__ */ new Int32Array(192)).fill(-1);
	uOrder = /* @__PURE__ */ new Uint8Array(192);
	uSupp = /* @__PURE__ */ new Float32Array(192);
	/** WW2 combined arms: s until a soldier can close-assault a tank again. */
	uNadeCd = /* @__PURE__ */ new Float32Array(192);
	/** WW2 morale: s a unit stays shaken after losses round it. */
	uShakeT = /* @__PURE__ */ new Float32Array(192);
	uLife = /* @__PURE__ */ new Float32Array(192);
	uSeenT = /* @__PURE__ */ new Float32Array(192);
	uKnownT = /* @__PURE__ */ new Float32Array(192);
	uKills = /* @__PURE__ */ new Int32Array(192);
	uTask = (/* @__PURE__ */ new Int32Array(192)).fill(-1);
	/** Digging in: 0 in the open, rising to 1 (dug in: foxhole or hull-down) over DIG_TIME. */
	uDig = /* @__PURE__ */ new Float32Array(192);
	/** Engineers: the cell they are going to mine (-1 none), and s spent burying it. */
	uLay = (/* @__PURE__ */ new Int32Array(192)).fill(-1);
	uWork = /* @__PURE__ */ new Float32Array(192);
	nextUnitUid = 1;
	/** The tower whose line of sight findTarget() uses (sight 1). */
	sightTower = null;
	/** Stands in as the damage source for unit fire (id -2), and as the aim point of shots at a unit. */
	unitSrc = Sim.proxy(-2);
	aimProxy = Sim.proxy(-10);
	proxyRange = 0;
	proxySupp = 0;
	proxyInf = false;
	/** Bumped when units appear or die (UI resync). */
	unitVersion = 0;
	bfsPrev = new Int32Array(COLS * ROWS);
	bfsQ = new Int32Array(COLS * ROWS);
	fTex = new Uint8Array(MAX_FX);
	fAdd = new Uint8Array(MAX_FX);
	fX = new Float32Array(MAX_FX);
	fY = new Float32Array(MAX_FX);
	fZ = new Float32Array(MAX_FX);
	fPx = new Float32Array(MAX_FX);
	fPy = new Float32Array(MAX_FX);
	fVx = new Float32Array(MAX_FX);
	fVy = new Float32Array(MAX_FX);
	fDrag = new Float32Array(MAX_FX);
	fLife = new Float32Array(MAX_FX);
	fMax = new Float32Array(MAX_FX);
	fS0 = new Float32Array(MAX_FX);
	fS1 = new Float32Array(MAX_FX);
	fA0 = new Float32Array(MAX_FX);
	fRot = new Float32Array(MAX_FX);
	fColor = new Uint32Array(MAX_FX);
	fCount = 0;
	bLife = /* @__PURE__ */ new Float32Array(128);
	bN = /* @__PURE__ */ new Uint8Array(128);
	bPts = /* @__PURE__ */ new Float32Array(2048);
	bCount = 0;
	towers = [];
	towerAt = new Int32Array(COLS * ROWS).fill(-1);
	towerById = /* @__PURE__ */ new Map();
	nextTowerId = 1;
	/** Bumped when towers change so the renderer can resync lazily. */
	towerVersion = 0;
	auraVersion = -1;
	radarGrid = new Uint8Array(COLS * ROWS);
	jamGrid = new Float32Array(COLS * ROWS);
	salvageGrid = new Float32Array(COLS * ROWS);
	tarGrid = new Float32Array(COLS * ROWS);
	/** WW2: speed factor for infantry only (barbed wire). */
	wireGrid = new Float32Array(COLS * ROWS).fill(1);
	spikeGrid = new Float32Array(COLS * ROWS);
	spikeSrc = new Array(COLS * ROWS).fill(null);
	zones = [];
	drones = [];
	streaks = [];
	spawners = [];
	hash = new SpatialHash(MAP_W, MAP_H, 80, MAX_ENEMIES);
	qbuf = new Int32Array(MAX_ENEMIES);
	qpool = [];
	qdepth = 0;
	chainHit = /* @__PURE__ */ new Int32Array(16);
	static proxy(id) {
		return {
			id,
			type: 0,
			kind: "gun",
			level: 0,
			col: 0,
			row: 0,
			size: 1,
			x: 0,
			y: 0,
			cd: 0,
			angle: 0,
			prevAngle: 0,
			mode: 3,
			beam: -1,
			recoil: 0,
			spent: 0,
			kills: 0,
			damage: 0,
			open: false,
			charge: 0,
			spin: 0,
			heat: 0,
			firing: 0,
			rangeMult: 1,
			rateMult: 1,
			dmgMult: 1,
			airBonus: 1,
			combos: [],
			owner: 0,
			hp: 0,
			wreck: false,
			supp: 0,
			trainKind: -1,
			trainT: 0,
			seenT: 0,
			knownT: 0,
			buildT: 0,
			build0: 0,
			base: 0,
			ammo: 1,
			shakeT: 0,
			nadeCd: 0,
			fix: 0,
			fromG: -1
		};
	}
	/** Builds the map (which sets the live map size) before any grid-sized arrays exist. */
	static create(config) {
		setRuleset(config);
		return new Sim(buildMap(config.map), config);
	}
	constructor(map, config) {
		this.map = map;
		this.config = config;
		this.battle = battleById(config.ww2?.battle);
		this.totalWaves = this.battle?.waves ?? 30;
		this.rng = new Rng(config.seed);
		this.weather = WW2$1 ? this.battle?.weather ?? skirmishWeather(config.seed) : "clear";
		this.startHour = this.battle?.hour ?? 8;
		const diff = DIFFICULTIES[config.difficulty];
		this.routeFactor = 1 + .35 * (map.routes.length - 1);
		this.money = Math.round(250 * diff.money * this.routeFactor * (this.battle?.money ?? 1)) + 50 * perk(config, "logistics");
		this.lives = config.modifiers.includes("oneLife") ? 1 : diff.lives + 5 * perk(config, "fortify");
		this.hpMult = diff.hp;
		this.bountyMult = 1 + .1 * perk(config, "bounty");
		this.itemMax = 1 + perk(config, "airpower");
		this.items.fill(this.itemMax);
		for (let i = 0; i < map.grid.length; i++) {
			const t = map.grid[i];
			this.blocked[i] = t === 1 || t === 4 || t === 5 ? 1 : 0;
			this.groundSlow[i] = t === 3 ? WATER_SLOW : 1;
			this.sightBlock[i] = WW2$1 && (t === 1 || t === 4 || t === 5) ? 1 : 0;
			this.moveCost[i] = 1 / this.groundSlow[i];
		}
		this.tarGrid.set(this.groundSlow);
		this.fields = map.routes.map((r) => new FlowField(r.exit, this.moveCost));
		this.scratch = map.routes.map((r) => new FlowField(r.exit, this.moveCost));
		this.breach = map.routes.map((r) => new FlowField(r.exit, this.breachCost));
		this.foot = map.routes.map((r) => new FlowField(r.exit, this.footCost));
		for (const f of this.fields) f.compute(this.blocked);
		for (let i = 0; i < MAX_ENEMIES; i++) this.eFree[i] = MAX_ENEMIES - 1 - i;
		this.eFreeTop = MAX_ENEMIES;
		this.spawnHero(1 + 2 * perk(config, "veteran"));
		if (this.battle) this.setUpBattle(this.battle);
		if (WW2$1) this.setUpBases();
	}
	/** Places a tower free at the nearest spot to (col,row) where it fits. */
	placeNear(type, col, row, level = 0) {
		for (let ring = 0; ring < 8; ring++) for (let dr = -ring; dr <= ring; dr++) for (let dc = -ring; dc <= ring; dc++) {
			if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue;
			const t = this.place(type, col + dc, row + dr, true);
			if (t) {
				t.level = Math.min(level, TOWERS[type].levels.length - 1);
				t.hp = this.maxHp(t);
				return t;
			}
		}
		return null;
	}
	/** The positions already dug in, and the objective, placed free near where the battle wants them. */
	setUpBattle(b) {
		const slot = (name) => TOWERS.findIndex((d) => d.slot === name);
		for (const p of b.preset ?? []) this.placeNear(slot(p.slot), p.col, p.row, p.level ?? 0);
		if (b.objective) {
			const t = this.placeNear(slot(b.objective.slot), b.objective.col, b.objective.row, 2);
			if (t) this.objectiveId = t.id;
		}
		this.towerVersion++;
	}
	/** WW2 skirmish: the waves go on until one side's headquarters falls. A battle can also be won by holding out. */
	get siege() {
		return WW2$1 && !this.battle;
	}
	/**
	* WW2: both sides have a base. Ours is a headquarters near the end of every route (a battle's
	* objective if it has one): the attackers march on it and fight there instead of leaving the map.
	* Theirs is a headquarters with gun positions around it at the first entry, and guns at the others.
	*/
	setUpBases() {
		const hq = TOWERS.findIndex((d) => d.slot === "hq");
		const lifeScale = DIFFICULTIES[this.config.difficulty].lives / 20;
		const routes = this.map.routes;
		for (let k = 0; k < routes.length && k < this.bases.length; k++) {
			const r = routes[k];
			let t = this.objectiveId ? this.towerById.get(this.objectiveId) ?? null : null;
			if (!t) {
				const c = r.exit[r.exit.length >> 1];
				const col = c % COLS - r.outDir[0] * 5;
				const row = (c / COLS | 0) - r.outDir[1] * 5;
				t = this.towers.find((o) => o.base > 0 && Math.abs(o.col - col) + Math.abs(o.row - row) < 10) ?? this.placeNear(hq, col - 1, row - 1, 3);
			}
			if (!t) continue;
			if (!t.base) {
				t.base = BASE_HP * lifeScale;
				t.hp = this.maxHp(t);
				t.spent = BASE_VALUE;
			}
			this.bases[k] = t.id;
			const ring = [];
			for (let dy = -1; dy <= t.size; dy++) for (let dx = -1; dx <= t.size; dx++) {
				const c = t.col + dx;
				const rr = t.row + dy;
				if ((dx < 0 || dx >= t.size || dy < 0 || dy >= t.size) && c >= 0 && rr >= 0 && c < COLS && rr < ROWS) ring.push(rr * COLS + c);
			}
			r.exit.splice(0, r.exit.length, ...ring);
			r.airTo[0] = t.x;
			r.airTo[1] = t.y;
		}
		for (const f of this.fields) f.compute(this.blocked);
		this.towerVersion++;
		const kind = (f) => ENEMIES.findIndex((e) => e.fixed === f);
		const at = [];
		let g = 0;
		const post = (k, cx, cy, ix, iy, fwd, side) => {
			if (k < 0 || g >= MAX_GARRISON) return;
			this.gKind[g] = k;
			this.gX[g] = Math.min(MAP_W - 20, Math.max(20, cx + (ix * fwd - iy * side) * 20));
			this.gY[g] = Math.min(MAP_H - 20, Math.max(20, cy + (iy * fwd + ix * side) * 20));
			this.gAng[g] = Math.atan2(iy, ix);
			this.raiseGarrison(g++, 0);
		};
		for (const r of routes) {
			const c = r.entry[r.entry.length >> 1];
			const cx = (c % COLS + .5) * 20;
			const cy = ((c / COLS | 0) + .5) * 20;
			if (at.some(([x, y]) => Math.hypot(x - cx, y - cy) < 160)) continue;
			const [ix, iy] = r.inDir;
			if (!at.length) {
				post(kind("hq"), cx, cy, ix, iy, 3.5, 4.5);
				post(kind("mg"), cx, cy, ix, iy, 5, -3.5);
				post(kind("at"), cx, cy, ix, iy, 6.5, 7.5);
				post(kind("mg"), cx, cy, ix, iy, 7, 2);
				post(kind("depot"), cx, cy, ix, iy, 1.5, 8.5);
				post(kind("arty"), cx, cy, ix, iy, 1, -1);
			} else {
				post(kind("mg"), cx, cy, ix, iy, 4, 3);
				post(kind("at"), cx, cy, ix, iy, 5, -3.5);
			}
			at.push([cx, cy]);
		}
	}
	/** WW2: (re)builds position g of the enemy's base; it takes `build` s before it can fire. */
	raiseGarrison(g, build) {
		const i = this.spawnEnemy(this.gKind[g], Math.max(1, this.wave));
		if (i < 0) return;
		const def = ENEMIES[this.gKind[g]];
		this.eX[i] = this.ePx[i] = this.gX[g];
		this.eY[i] = this.ePy[i] = this.gY[g];
		this.eAng[i] = this.ePang[i] = this.gAng[g];
		this.eSpeed[i] = 0;
		this.eCell[i] = Math.floor(this.gY[g] / 20) * COLS + Math.floor(this.gX[g] / 20);
		if (def.fixed === "hq") this.eMaxHp[i] = def.hp * this.hpMult;
		this.eHp[i] = build > 0 ? this.eMaxHp[i] * .2 : this.eMaxHp[i];
		this.eBuild[i] = build;
		this.eGar[i] = g;
		this.gSlot[g] = i;
		this.gT[g] = 0;
		this.garrisonAlive++;
	}
	/** WW2: lost positions of the enemy's base go back up after a while. */
	updateGarrison() {
		for (let g = 0; g < MAX_GARRISON; g++) {
			if (this.gOwn[g] && this.gCounter[g] > 0 && (this.gCounter[g] -= .016666666666666666) <= 0) this.counterAttack(g);
			if (this.gKind[g] < 0 || this.gSlot[g] >= 0 || this.gT[g] <= 0) continue;
			if ((this.ticks + g) % 15 === 0) this.tryCapture(g);
			if (this.gKind[g] >= 0 && (this.gT[g] -= .016666666666666666) <= 0) this.raiseGarrison(g, GARRISON_BUILD);
		}
	}
	/**
	* A knocked-out position of theirs (not the headquarters): our soldiers standing on it with no
	* attacker close by take it in CAPTURE_T s — it becomes ours, and their ground shrinks.
	*/
	tryCapture(g) {
		const slot = CAPTURE_SLOT[ENEMIES[this.gKind[g]].fixed ?? ""];
		if (!slot) return;
		const x = this.gX[g];
		const y = this.gY[g];
		let ours = false;
		for (let u = 0; u < 192 && !ours; u++) if (this.uAlive[u] && !this.uAir[u] && !UNITS[this.uKind[u]].truck && (this.uX[u] - x) ** 2 + (this.uY[u] - y) ** 2 <= 1296) ours = true;
		let theirs = false;
		if (ours) {
			const n = this.hash.query(x, y, 70, this.qbuf);
			for (let k = 0; k < n && !theirs; k++) {
				const i = this.qbuf[k];
				if (this.eAlive[i] && !this.eAir[i] && this.eGar[i] < 0 && (this.eX[i] - x) ** 2 + (this.eY[i] - y) ** 2 <= 4900) theirs = true;
			}
		}
		if (!ours || theirs) {
			this.gCap[g] = Math.max(0, this.gCap[g] - 15 * DT);
			return;
		}
		if ((this.gCap[g] += .25) < CAPTURE_T) return;
		const type = TOWERS.findIndex((d) => d.slot === slot);
		if (type < 0) return;
		this.capturing = true;
		const t = this.placeNear(type, Math.floor(x / 20) - 1, Math.floor(y / 20) - 1, Math.min(9, Math.floor(this.wave / 6)));
		this.capturing = false;
		if (!t) return;
		t.fromG = g;
		this.gOwn[g] = t.id;
		this.gOrig[g] = this.gKind[g];
		this.gKind[g] = -1;
		this.gT[g] = 0;
		this.gCap[g] = 0;
		this.gCounter[g] = COUNTER_T;
		this.frontVersion++;
		this.ev(9, x, y, 11);
	}
	/** They want it back: a counter-attack from their headquarters, sent straight at the position we took. */
	counterAttack(g) {
		const t = this.towerById.get(this.gOwn[g]);
		if (!t || t.wreck || this.gSlot[0] < 0) return;
		const pick = (ok) => ENEMIES.findIndex((e) => !e.fixed && !e.supply && !e.officer && !e.air && !e.boss && ok(e));
		const rifle = pick((e) => !!e.inf && e.gun?.fx === "rifle" && !e.stealth);
		const smg = pick((e) => !!e.inf && e.gun?.fx === "smg");
		const tank = pick((e) => !!e.arm && e.gun?.fx === "tank");
		const force = [];
		for (let k = 0; k < 4 + Math.floor(this.wave / 3); k++) force.push(k % 3 === 2 && smg >= 0 ? smg : rifle);
		if (this.wave >= 8 && tank >= 0) force.push(tank, tank);
		for (const kind of force) {
			if (kind < 0) continue;
			const i = this.spawnEnemy(kind, this.wave);
			if (i < 0) break;
			this.eX[i] = this.ePx[i] = this.gX[0] + this.rng.range(-30, 30);
			this.eY[i] = this.ePy[i] = this.gY[0] + this.rng.range(-30, 30);
			this.eCell[i] = Math.floor(this.eY[i] / 20) * COLS + Math.floor(this.eX[i] / 20);
			this.eRoute[i] = 0;
			this.eHunt[i] = t.id;
		}
		this.ev(9, t.x, t.y, 12);
	}
	/** The way to the cells round tower id (for counter-attacks), rebuilt when the maze changes. */
	huntField(id) {
		const t = this.towerById.get(id);
		if (!t || t.wreck) return null;
		let h = this.huntFields.get(id);
		if (!h || h.v !== this.towerVersion) {
			const ring = [];
			for (let dy = -1; dy <= t.size; dy++) for (let dx = -1; dx <= t.size; dx++) {
				const c = t.col + dx;
				const r = t.row + dy;
				if ((dx < 0 || dx >= t.size || dy < 0 || dy >= t.size) && c >= 0 && r >= 0 && c < COLS && r < ROWS) ring.push(r * COLS + c);
			}
			const f = h?.f ?? new FlowField(ring, this.moveCost);
			if (h) f.goals.splice(0, f.goals.length, ...ring);
			f.compute(this.blocked);
			h = {
				v: this.towerVersion,
				f
			};
			this.huntFields.set(id, h);
		}
		return h.f;
	}
	/** A captured position is lost again (knocked out or given up): their ground grows back and they rebuild it. */
	loseCaptured(t) {
		const g = t.fromG;
		if (g < 0 || this.gOwn[g] !== t.id) return;
		this.gKind[g] = this.gOrig[g];
		this.gOwn[g] = 0;
		this.gCounter[g] = 0;
		this.gT[g] = GARRISON_REBUILD * .5;
		this.huntFields.delete(t.id);
		this.frontVersion++;
	}
	/** WW2: is (x, y) within the enemy's base, where we can't build? */
	enemyGround(x, y) {
		for (let g = 0; g < MAX_GARRISON; g++) if (this.gKind[g] >= 0 && (this.gX[g] - x) ** 2 + (this.gY[g] - y) ** 2 < 67600) return true;
		return false;
	}
	/** Attackers on the field, not counting the positions of the enemy's base and its supply trucks. */
	get attackers() {
		return this.liveCount - this.garrisonAlive - this.convoyAlive;
	}
	/** WW2: the headquarters in worst shape, 0..1 (1 when there is none). */
	get baseHealth() {
		let h = 1;
		for (const t of this.towers) if (t.base > 0) h = Math.min(h, t.wreck ? 0 : t.hp / this.maxHp(t));
		return h;
	}
	/** WW2: the enemy headquarters' hit points 0..1 (0 when destroyed or there is none). */
	get enemyHqHealth() {
		const i = this.gSlot[0];
		return i >= 0 && this.eAlive[i] ? this.eHp[i] / this.eMaxHp[i] : 0;
	}
	/** WW2 battles: air support and super-weapons are grounded until the weather clears. */
	airLocked(type) {
		const slot = TOWERS[type].slot;
		const air = slot === "strike" || slot === "super" || slot === "airfield";
		if (air && this.weather === "fog") return true;
		const b = this.battle;
		if (!b?.airFrom || this.wave >= b.airFrom) return false;
		return air;
	}
	ev(type, x, y, a = 0, b = 0) {
		if (this.events.length < 4e3) this.events.push(type, x, y, a, b);
	}
	/** Can this tower type be built in this game (challenge modifiers, limited arsenal)? */
	allowed(type) {
		const cfg = this.config;
		if (cfg.allowed && !cfg.allowed.includes(type)) return false;
		const role = TOWERS[type].role;
		return !(cfg.modifiers.includes("noBarricades") && (role === "barricade" || role === "gate"));
	}
	/** Build (level 0) or upgrade cost after perks. */
	cost(type, level = 0) {
		const base = TOWERS[type].levels[level].cost;
		const disc = TOWERS[type].cat === "maze" ? 1 - .1 * perk(this.config, "engineering") : 1;
		return Math.max(1, Math.round(base * disc));
	}
	get canSell() {
		return !this.config.modifiers.includes("ironman");
	}
	/** The spawn groups of wave n, after modifiers. */
	waveGroups(n) {
		let groups = WW2$1 ? this.adapt(n, buildWave(n)) : buildWave(n);
		if (WW2$1 && this.weather === "fog") groups = groups.filter((g) => !ENEMIES[g.kind].air);
		if (WW2$1 && this.foeSupply < 1) {
			const f = .5 + .5 * this.foeSupply;
			groups = groups.map((g) => ({
				...g,
				count: Math.max(1, Math.round(g.count * f))
			}));
		}
		if (!this.config.modifiers.includes("airRaid")) return groups;
		const air = ENEMIES.findIndex((e) => e.air);
		return groups.map((g) => ({
			...g,
			kind: air,
			count: Math.max(1, Math.round(g.count * Math.min(3, ENEMIES[g.kind].hp / ENEMIES[air].hp)))
		}));
	}
	/**
	* A structured-clone-friendly copy of the whole state (typed arrays stay typed). Object references
	* (towers as damage sources, drone hives…) are stored as tower ids.
	*/
	snapshot() {
		const SKIP = /* @__PURE__ */ new Set([
			"map",
			"groundSlow",
			"moveCost",
			"fields",
			"scratch",
			"hash",
			"qbuf",
			"qpool",
			"chainHit",
			"events",
			"towerById",
			"config",
			"rng",
			"vr",
			"bfsPrev",
			"bfsQ",
			"breach",
			"breachCost",
			"breachBlocked",
			"breachVersion",
			"foot",
			"footCost",
			"footBlocked",
			"hasTeeth",
			"back",
			"backVersion",
			"losMasks",
			"sightVersion",
			"huntFields",
			"capturing"
		]);
		const id = (t) => t ? t.id : null;
		const out = {};
		for (const [k, v] of Object.entries(this)) {
			if (SKIP.has(k)) continue;
			if (ArrayBuffer.isView(v)) out[k] = v.slice();
			else if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") out[k] = v;
		}
		out.config = this.config;
		out.rng = this.rng.s;
		out.vr = this.vr.s;
		out.towers = this.towers.map((t) => ({
			...t,
			combos: []
		}));
		out.zones = this.zones.map((z) => ({
			...z,
			src: id(z.src)
		}));
		out.drones = this.drones.map((d) => ({
			...d,
			hive: d.hive.id
		}));
		out.strikes = this.strikes.map((k) => ({
			...k,
			src: id(k.src)
		}));
		out.spawners = this.spawners.map((sp) => ({
			...sp,
			left: sp.left.slice(),
			timer: sp.timer.slice()
		}));
		out.hero = this.hero ? {
			...this.hero,
			path: [...this.hero.path],
			cd: [...this.hero.cd],
			src: null
		} : null;
		out.items = [...this.items];
		out.lastBuild = this.lastBuild;
		out.waveDamage = [...this.waveDamage];
		out.pSrc = this.pSrc.slice(0, this.pCount).map(id);
		out.eBurnBy = this.eBurnBy.map(id);
		return out;
	}
	static restore(snap) {
		const sim = Sim.create(snap.config);
		const any = sim;
		for (const [k, v] of Object.entries(snap)) {
			const cur = any[k];
			if (ArrayBuffer.isView(cur) && ArrayBuffer.isView(v)) cur.set(v);
			else if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") {
				if (k !== "rng" && k !== "vr") any[k] = v;
			}
		}
		sim.rng.s = snap.rng;
		sim.vr.s = snap.vr;
		sim.towers.length = 0;
		sim.towerById.clear();
		for (const t of snap.towers) {
			t.hp ??= 0;
			t.wreck ??= false;
			t.supp ??= 0;
			t.trainKind ??= -1;
			t.trainT ??= 0;
			t.seenT ??= 0;
			t.knownT ??= 0;
			t.buildT ??= 0;
			t.build0 ??= 0;
			t.base ??= 0;
			t.ammo ??= 1;
			t.shakeT ??= 0;
			t.nadeCd ??= 0;
			t.fix ??= 0;
			t.fromG ??= -1;
			sim.towers.push(t);
			sim.towerById.set(t.id, t);
		}
		const byId = (i) => i === null ? null : i === -1 ? sim.hero?.src ?? null : sim.towerById.get(i) ?? null;
		const hero = snap.hero;
		if (hero && sim.hero) Object.assign(sim.hero, {
			...hero,
			src: sim.hero.src
		});
		else sim.hero = null;
		if (sim.hero) {
			sim.hero.src.x = sim.hero.x;
			sim.hero.src.y = sim.hero.y;
		}
		for (const z of snap.zones) sim.zones.push({
			...z,
			src: byId(z.src)
		});
		for (const d of snap.drones) {
			const hive = byId(d.hive);
			if (hive) sim.drones.push({
				...d,
				hive
			});
		}
		for (const k of snap.strikes) sim.strikes.push({
			...k,
			src: byId(k.src)
		});
		sim.spawners = snap.spawners;
		snap.items.forEach((n, k) => sim.items[k] = n);
		sim.lastBuild = snap.lastBuild;
		sim.waveDamage = new Map(snap.waveDamage);
		snap.pSrc.forEach((i, p) => sim.pSrc[p] = byId(i));
		snap.eBurnBy.forEach((i, e) => sim.eBurnBy[e] = byId(i));
		for (const f of sim.fields) f.compute(sim.blocked);
		sim.auraVersion = -1;
		sim.breachVersion = -1;
		sim.backVersion = -1;
		sim.checkKey = "";
		return sim;
	}
	/** A cheap fingerprint of the gameplay state, to detect co-op desyncs. */
	stateHash() {
		let h = 2166136261;
		const mix = (n) => h = Math.imul(h ^ (Math.round(n * 16) | 0), 16777619);
		mix(this.ticks);
		mix(this.money);
		mix(this.lives);
		mix(this.liveCount);
		mix(this.towers.length);
		for (const t of this.towers) mix(t.hp);
		for (let u = 0; u < 192; u++) {
			if (!this.uAlive[u]) continue;
			mix(this.uX[u]);
			mix(this.uY[u]);
			mix(this.uHp[u]);
		}
		for (let n = 0; n < this.liveCount; n++) {
			const i = this.live[n];
			mix(this.eX[i]);
			mix(this.eY[i]);
			mix(this.eHp[i]);
		}
		return h >>> 0;
	}
	/** The most recent build, refundable in full for a few seconds (undo). */
	lastBuild = null;
	static UNDO_TICKS = 300;
	tower(id) {
		return this.towerById.get(id) ?? null;
	}
	/** Hands over the damage and leak tallies since the last report, and starts new ones. */
	takeReport() {
		const r = {
			damage: this.waveDamage,
			leaked: this.leakedThisWave
		};
		this.waveDamage = /* @__PURE__ */ new Map();
		this.leakedThisWave = 0;
		return r;
	}
	/** No units on the field and none still to come from the waves called so far. */
	get fieldClear() {
		return !this.spawning && this.attackers === 0;
	}
	get canUndo() {
		const b = this.lastBuild;
		return !!b && this.ticks - b.tick <= Sim.UNDO_TICKS && this.towerById.get(b.id)?.level === 0;
	}
	/** Applies one player command. Returns false if it had no effect. */
	exec(cmd) {
		switch (cmd.t) {
			case "place": {
				const t = this.place(cmd.type, cmd.col, cmd.row);
				if (t && cmd.by) t.owner = cmd.by;
				else if (t) this.lastBuild = {
					id: t.id,
					tick: this.ticks
				};
				return !!t;
			}
			case "sell": {
				if (!this.canSell) return false;
				let any = false;
				for (const id of cmd.ids) {
					const t = this.towerById.get(id);
					if (t && t.id !== this.objectiveId && !t.base) {
						this.sell(t);
						any = true;
					}
				}
				return any;
			}
			case "upgrade": {
				let any = false;
				for (const id of cmd.ids) {
					const t = this.towerById.get(id);
					if (t && this.upgrade(t)) any = true;
				}
				return any;
			}
			case "mode": {
				const t = this.towerById.get(cmd.id);
				if (!t || !TOWERS[t.type].targeted) return false;
				t.mode = cmd.mode;
				return true;
			}
			case "gate": {
				const t = this.towerById.get(cmd.id);
				return !!t && !t.wreck && this.toggleGate(t) === "ok";
			}
			case "train": {
				const t = this.towerById.get(cmd.id);
				return !!t && this.train(t, cmd.unit);
			}
			case "unitMove": return this.unitMove(cmd.ids, cmd.x, cmd.y);
			case "unitDig": return this.unitDig(cmd.ids);
			case "unitMines": return this.unitMines(cmd.ids, cmd.x, cmd.y);
			case "unitStance": {
				let any = false;
				for (const id of cmd.ids) {
					const u = this.unitSlot(id);
					if (u < 0 || UNITS[this.uKind[u]].air || UNITS[this.uKind[u]].truck) continue;
					this.uStance[u] = cmd.stance;
					this.uPostX[u] = this.uX[u];
					this.uPostY[u] = this.uY[u];
					any = true;
				}
				return any;
			}
			case "repair": {
				let any = false;
				for (const id of cmd.ids) {
					const t = this.towerById.get(id);
					if (t && this.repair(t)) any = true;
				}
				return any;
			}
			case "fire": {
				const t = this.towerById.get(cmd.id);
				return !!t && !t.wreck && this.fireSuper(t, cmd.x, cmd.y);
			}
			case "wave":
				if (!this.canCallWave) return false;
				this.startNextWave();
				return true;
			case "undo": {
				if (!this.canUndo) return false;
				const t = this.towerById.get(this.lastBuild.id);
				const refund = t.spent;
				this.sell(t);
				this.money += refund - this.sellValue(t);
				this.lastBuild = null;
				return true;
			}
			case "stress":
				this.stress(3e3);
				return true;
			case "item": return this.useItem(cmd.item, cmd.x, cmd.y);
			case "heroMove": return this.heroMove(cmd.x, cmd.y);
			case "heroAbility": return this.heroAbility(cmd.ability, cmd.x, cmd.y);
			default: return false;
		}
	}
	/** Cells covered by a `size`-cell building whose top-left cell is (col,row), or null if any is unbuildable. */
	footprint(col, row, size) {
		if (col < 0 || row < 0 || col + size > COLS || row + size > ROWS) return null;
		const cells = [];
		for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
			const i = (row + dy) * COLS + col + dx;
			if (this.map.grid[i] !== 0 || this.towerAt[i] >= 0) return null;
			cells.push(i);
		}
		return cells;
	}
	/** Cheap pre-check (no path search): is the ground free and buildable for this tower type? */
	footprintFree(type, col, row) {
		return this.footprint(col, row, TOWERS[type].size) !== null;
	}
	checkKey = "";
	checkResult = "invalid";
	checkReroutes = false;
	checkOpenGate = false;
	/**
	* Why tower `type` can or can't go at (col,row): the footprint must be free grass and, for walls,
	* have no ground unit on it, and every route (and every unit already walking) must still reach
	* its exit. On success the would-be flow fields are left in `scratch`. Cached per tick.
	*/
	placeStatus(type, col, row) {
		const key = `${type},${col},${row},${this.towerVersion},${this.ticks},${this.capturing}`;
		if (key === this.checkKey) return this.checkResult;
		this.checkKey = key;
		const def = TOWERS[type];
		const cells = this.footprint(col, row, def.size);
		this.checkReroutes = !!cells && !def.walkable;
		this.checkOpenGate = false;
		if (!cells) return this.checkResult = "invalid";
		if (WW2$1 && !this.capturing && this.enemyGround((col + def.size / 2) * 20, (row + def.size / 2) * 20)) return this.checkResult = "invalid";
		if (def.walkable) return this.checkResult = "ok";
		const status = this.wallStatus(cells);
		if (status !== "ok" && def.kind === "gate") {
			this.checkReroutes = false;
			this.checkOpenGate = true;
			return this.checkResult = "ok";
		}
		return this.checkResult = status;
	}
	/** Can these cells become impassable? Leaves the resulting fields in `scratch` when they can. */
	wallStatus(cells) {
		for (let n = 0; n < this.liveCount; n++) {
			const i = this.live[n];
			if (!this.eAlive[i] || this.eAir[i]) continue;
			const r = ENEMIES[this.eKind[i]].radius * .6;
			for (const c of cells) {
				const x0 = c % COLS * 20;
				const y0 = (c / COLS | 0) * 20;
				if (this.eX[i] > x0 - r && this.eX[i] < x0 + 20 + r && this.eY[i] > y0 - r && this.eY[i] < y0 + 20 + r) return "occupied";
			}
		}
		const was = cells.map((i) => this.blocked[i]);
		for (const i of cells) this.blocked[i] = 1;
		let ok = true;
		for (let k = 0; k < this.scratch.length && ok; k++) {
			const f = this.scratch[k];
			f.compute(this.blocked);
			for (const e of this.map.routes[k].entry) if (f.dist[e] === Infinity) ok = false;
		}
		for (let n = 0; n < this.liveCount && ok; n++) {
			const i = this.live[n];
			if (this.eAlive[i] && !this.eAir[i] && this.eGar[i] < 0 && this.scratch[this.eRoute[i]].dist[this.eCell[i]] === Infinity) ok = false;
		}
		cells.forEach((i, k) => this.blocked[i] = was[k]);
		return ok ? "ok" : "blocked";
	}
	/** Flow fields as they would be with tower `type` at (col,row); null if it can't go there or doesn't change the route. */
	preview(type, col, row) {
		return this.placeStatus(type, col, row) === "ok" && this.checkReroutes ? this.scratch : null;
	}
	canPlace(type, col, row) {
		return this.placeStatus(type, col, row) === "ok";
	}
	towerAtTile(col, row) {
		if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return null;
		const id = this.towerAt[row * COLS + col];
		return id < 0 ? null : this.towerById.get(id) ?? null;
	}
	place(type, col, row, free = false) {
		const def = TOWERS[type];
		const cost = this.cost(type);
		if (!free && (!this.allowed(type) || this.airLocked(type))) return null;
		if (!free && this.money < cost || !this.canPlace(type, col, row)) return null;
		if (!free) this.money -= cost;
		const size = def.size;
		const t = {
			id: this.nextTowerId++,
			type,
			kind: def.role,
			level: 0,
			col,
			row,
			size,
			x: (col + size / 2) * 20,
			y: (row + size / 2) * 20,
			cd: 0,
			angle: -Math.PI / 2,
			prevAngle: -Math.PI / 2,
			mode: def.role === "sniper" || def.role === "arty" ? 2 : 0,
			beam: -1,
			recoil: 0,
			spent: free ? 0 : cost,
			kills: 0,
			damage: 0,
			open: false,
			charge: def.levels[0].charge ?? 0,
			spin: 0,
			heat: 0,
			firing: 0,
			rangeMult: 1,
			rateMult: 1,
			dmgMult: 1,
			airBonus: 1,
			combos: [],
			owner: 0,
			hp: WW2$1 ? def.levels[0].hp ?? 0 : 0,
			wreck: false,
			supp: 0,
			trainKind: -1,
			trainT: 0,
			seenT: 0,
			knownT: 0,
			buildT: 0,
			build0: 0,
			base: 0,
			ammo: 1,
			shakeT: 0,
			nadeCd: 0,
			fix: 0,
			fromG: -1
		};
		const reroutes = this.checkReroutes;
		t.open = this.checkOpenGate;
		this.towers.push(t);
		this.towerById.set(t.id, t);
		this.setFootprint(t, t.id);
		if (reroutes) for (let k = 0; k < this.fields.length; k++) this.fields[k].copyFrom(this.scratch[k]);
		this.towerVersion++;
		this.burst(t.x, t.y, 10129272, size * 4, 1, 0);
		if (!free) this.ev(4, t.x, t.y, type);
		if (WW2$1 && !free) this.startBuilding(t, buildTime(cost));
		return t;
	}
	/** WW2: the crew digs in for `time` s before the position can fire; it starts weak. */
	startBuilding(t, time) {
		t.build0 = t.buildT = time;
		t.hp = Math.max(1, this.maxHp(t) * .2);
	}
	cellsOf(t) {
		const out = [];
		for (let dy = 0; dy < t.size; dy++) for (let dx = 0; dx < t.size; dx++) out.push((t.row + dy) * COLS + t.col + dx);
		return out;
	}
	setFootprint(t, id) {
		const wall = !TOWERS[t.type].walkable && !t.open && !t.wreck;
		for (const i of this.cellsOf(t)) {
			this.towerAt[i] = id;
			this.blocked[i] = id >= 0 && wall ? 1 : 0;
		}
	}
	upgradeCost(t) {
		return t.level + 1 < TOWERS[t.type].levels.length ? this.cost(t.type, t.level + 1) : 0;
	}
	upgrade(t) {
		const cost = this.upgradeCost(t);
		if (!cost || this.money < cost || t.wreck) return false;
		this.money -= cost;
		t.spent += cost;
		const was = this.maxHp(t);
		t.level++;
		if (t.hp > 0) t.hp += this.maxHp(t) - was;
		this.towerVersion++;
		this.burst(t.x, t.y, 16769674, 10, 2, 1);
		this.ev(6, t.x, t.y, t.level);
		return true;
	}
	sellValue(t) {
		return Math.floor(t.spent * (SELL_RATIO + .1 * perk(this.config, "salvage")) * (t.wreck ? .25 : 1));
	}
	/** Hit points of a tower at full strength (0: the enemy doesn't shoot at it). */
	maxHp(t) {
		return WW2$1 ? (TOWERS[t.type].levels[t.level].hp ?? 0) * (t.base || 1) : 0;
	}
	/** Fortification in mm of armour equivalent: sandbags, then timber and earth, then concrete. */
	fortOf(t) {
		const f = TOWERS[t.type].levels[t.level].fort ?? 0;
		return t.base ? Math.max(BASE_FORT, f) : f;
	}
	/** Camouflage 0..1: nets and scrub from level 4, more at level 7. */
	camoOf(t) {
		const c = TOWERS[t.type].camo ?? 0;
		const dark = .25 * this.night;
		if (!c) return dark > .12 && !t.base && TOWERS[t.type].levels[t.level].hp ? dark : 0;
		return Math.min(.95, c + (t.level >= 3 ? .1 : 0) + (t.level >= 6 ? .05 : 0) + dark);
	}
	/** Does the enemy not know this emplacement is there (camouflaged, not spotted, not just fired)? */
	towerHidden(t) {
		return WW2$1 && t.seenT <= 0 && t.knownT <= 0 && this.camoOf(t) > 0;
	}
	/** How far an attacker sees: infantry look around, buttoned-up tanks see little, recon sees far. */
	spotRange(k) {
		const e = ENEMIES[k];
		return e.spot ?? (e.inf ? 110 : e.air ? 170 : 75);
	}
	/**
	* WW2 spotting, a few times a second: any attacker close enough to a camouflaged emplacement or
	* hidden unit (nearer the better the camouflage) gives it away to the whole column for a while.
	*/
	updateSpotting() {
		for (const t of this.towers) {
			if (t.seenT > 0) t.seenT = Math.max(0, t.seenT - DT * 10);
			if (t.knownT > 0) t.knownT = Math.max(0, t.knownT - DT * 10);
			const camo = this.camoOf(t);
			if (!camo || t.wreck || t.knownT > 0) continue;
			const f = 1 - .7 * camo;
			const n = this.hash.query(t.x, t.y, 345 * f + t.size * 10, this.qbuf);
			for (let k = 0; k < n; k++) {
				const i = this.qbuf[k];
				if (!this.eAlive[i]) continue;
				const r = this.spotRange(this.eKind[i]) * f * (this.eEscort[i] ? 1.5 : 1) * this.sightMult + t.size * 10;
				if ((this.eX[i] - t.x) ** 2 + (this.eY[i] - t.y) ** 2 <= r * r) {
					t.knownT = KNOWN_T;
					break;
				}
			}
		}
		for (let u = 0; u < 192; u++) {
			if (!this.uAlive[u] || this.uAir[u] || !this.unitHidden(u)) continue;
			const n = this.hash.query(this.uX[u], this.uY[u], 80, this.qbuf);
			for (let k = 0; k < n; k++) {
				const i = this.qbuf[k];
				if (!this.eAlive[i]) continue;
				const r = this.spotRange(this.eKind[i]) * .3;
				if ((this.eX[i] - this.uX[u]) ** 2 + (this.eY[i] - this.uY[u]) ** 2 <= r * r) {
					this.uKnownT[u] = KNOWN_T * .5;
					break;
				}
			}
		}
	}
	/** Riflemen and assault squads go with the tanks (not snipers, medics, sappers or officers). */
	escortKind(def) {
		return !!def.inf && !def.stealth && !def.heal && !def.officer && !def.fixed && (def.gun?.fx === "rifle" || def.gun?.fx === "smg");
	}
	/** Infantry squad i joins the nearest tank of its wave and route that still needs escorts. */
	findLeader(i) {
		let best = -1;
		let bestD = Infinity;
		for (let n = 0; n < this.liveCount; n++) {
			const j = this.live[n];
			const e = ENEMIES[this.eKind[j]];
			if (!this.eAlive[j] || !e.arm || e.air || e.fixed || this.eRetreat[j] || this.eWave[j] !== this.eWave[i] || this.eRoute[j] !== this.eRoute[i] || this.eEscortN[j] >= ESCORTS) continue;
			const d = Math.abs(this.eRemain[j] - this.eRemain[i]);
			if (d < bestD) {
				bestD = d;
				best = j;
			}
		}
		if (best < 0) return;
		this.eLead[i] = best;
		this.eLeadUid[i] = this.eUid[best];
		this.eEscortN[best]++;
	}
	/** Speed factor that keeps an escort with its tank: it waits when ahead, hurries when behind. */
	escortPace(i) {
		const j = this.eLead[i];
		if (!this.eAlive[j] || this.eUid[j] !== this.eLeadUid[i]) {
			this.eLead[i] = -1;
			return 1;
		}
		const behind = this.eRemain[i] - this.eRemain[j];
		return behind > 50 ? 1.35 : behind < -30 ? .45 : 1;
	}
	/**
	* A tank every few ticks: is infantry close round it (else our infantry can close-assault it), and,
	* leading an assault on a strongpoint, does the wave lay smoke ahead of it?
	*/
	checkEscort(i, def) {
		const x = this.eX[i];
		const y = this.eY[i];
		let n = 0;
		this.forEachInRange(x, y, ESCORT_R, false, true, (j) => {
			if (j !== i && ENEMIES[this.eKind[j]].inf) n++;
		});
		this.eEscort[i] = n > 0 ? 1 : 0;
		if (def.fixed || this.eRetreat[i] || this.smokeWave[this.eWave[i] & 63] >= 2 || this.smCount >= 64) return;
		for (const t of this.towers) {
			if (t.wreck || !t.base && this.fortOf(t) < 25 || this.towerHidden(t)) continue;
			const d2 = (t.x - x) ** 2 + (t.y - y) ** 2;
			if (d2 > 52900 || d2 < 8100) continue;
			const k = this.smCount++;
			this.smX[k] = x + (t.x - x) * .65;
			this.smY[k] = y + (t.y - y) * .65;
			this.smT[k] = SMOKE_T * 1.5;
			this.smokeWave[this.eWave[i] & 63]++;
			for (let s = 0; s < 8; s++) this.fx(1, 0, this.smX[k], this.smY[k], this.vr.range(-60, 60), this.vr.range(-60, 60), 1.8, 12, 44, .8, 15263968, 1.2, 6);
			this.ev(1, this.smX[k], this.smY[k], .5);
			return;
		}
	}
	/** Is this an infantry anti-tank weapon (a team with a rocket launcher, a soldier) that profits from a lone tank? */
	closeAssaulter(src) {
		if (src === this.unitSrc) return this.proxyInf;
		if (src.id < 0) return false;
		return TOWERS[src.type].slot === "at";
	}
	/** Our infantry close-assaults an unescorted tank next to it: satchel charges and grenades on its deck. */
	closeAssault(x, y, reach, src) {
		let best = -1;
		let bestD = reach * reach;
		const n = this.hash.query(x, y, reach, this.qbuf);
		for (let k = 0; k < n; k++) {
			const i = this.qbuf[k];
			const e = ENEMIES[this.eKind[i]];
			if (!this.eAlive[i] || !e.arm || e.air || e.fixed || this.eEscort[i]) continue;
			const d2 = (this.eX[i] - x) ** 2 + (this.eY[i] - y) ** 2;
			if (d2 < bestD) {
				bestD = d2;
				best = i;
			}
		}
		if (best < 0) return false;
		const ex = this.eX[best];
		const ey = this.eY[best];
		this.damage(best, ASSAULT_DMG * (1 + .05 * this.wave), false, src, false, ASSAULT_PEN, true);
		this.explosion(ex, ey, .8, 6);
		return true;
	}
	/**
	* A knocked-out tank stays where it died as a hulk: it blocks its cell if no route (and nobody on
	* the way) depends on it — else it only slows the way, like rubble. Either way it blocks the line
	* of fire and gives cover to infantry next to it.
	*/
	addHulk(i) {
		if (this.hkCount >= 48) return;
		const c = this.eCell[i];
		if (c < 0 || this.hulkGrid[c] === 1 || this.towerAt[c] >= 0 || this.blocked[c] || this.map.grid[c] !== 0) return;
		for (const r of this.map.routes) if (r.entry.includes(c) || r.exit.includes(c)) return;
		let block = 0;
		if (this.hulkTick !== this.ticks) {
			this.hulkTick = this.ticks;
			this.blocked[c] = 1;
			let ok = true;
			for (let k = 0; k < this.scratch.length && ok; k++) {
				const f = this.scratch[k];
				f.compute(this.blocked);
				for (const e of this.map.routes[k].entry) if (f.dist[e] === Infinity) ok = false;
			}
			for (let n = 0; n < this.liveCount && ok; n++) {
				const j = this.live[n];
				if (j !== i && this.eAlive[j] && !this.eAir[j] && this.eGar[j] < 0 && this.eCell[j] !== c && this.scratch[this.eRoute[j]].dist[this.eCell[j]] === Infinity) ok = false;
			}
			if (ok) {
				block = 1;
				for (let k = 0; k < this.fields.length; k++) this.fields[k].copyFrom(this.scratch[k]);
			} else this.blocked[c] = 0;
		}
		const h = this.hkCount++;
		this.hkCell[h] = c;
		this.hkT[h] = HULK_T;
		this.hkBlock[h] = block;
		this.hkKind[h] = this.eKind[i];
		this.hkAng[h] = this.eAng[i];
		this.hkWork[h] = 0;
		this.hulksChanged(c);
	}
	/** Hulks burn out and are towed away in time (or cleared sooner by engineers and sappers). */
	updateHulks() {
		for (let h = this.hkCount - 1; h >= 0; h--) {
			const c = this.hkCell[h];
			if ((this.ticks + h * 11) % 50 === 0 && this.hkT[h] > HULK_T * .6) this.fx(1, 0, (c % COLS + .5) * 20, ((c / COLS | 0) + .5) * 20, this.vr.range(-6, 6), -16, 2.6, 8, 30, .45, 3814962, .8, 10);
			if ((this.hkT[h] -= .016666666666666666) <= 0 || this.hkWork[h] >= CLEAR_WORK) this.removeHulk(h);
		}
	}
	removeHulk(h) {
		const c = this.hkCell[h];
		const blocking = this.hkBlock[h] === 1;
		const last = --this.hkCount;
		this.hkCell[h] = this.hkCell[last];
		this.hkT[h] = this.hkT[last];
		this.hkBlock[h] = this.hkBlock[last];
		this.hkKind[h] = this.hkKind[last];
		this.hkAng[h] = this.hkAng[last];
		this.hkWork[h] = this.hkWork[last];
		if (blocking && this.towerAt[c] < 0) {
			this.blocked[c] = 0;
			for (const f of this.fields) f.compute(this.blocked);
		}
		this.burst((c % COLS + .5) * 20, ((c / COLS | 0) + .5) * 20, 6971480, 6, 1, 0);
		this.hulksChanged(c);
	}
	/**
	* The hulks changed round cell c: cover and sight-blocking cells, the guns whose line of fire it
	* may cross (their sight is worked out again), and the maze signal for everything derived from it.
	*/
	hulksChanged(c) {
		this.hulkGrid.fill(0);
		for (let h = 0; h < this.hkCount; h++) {
			const k = this.hkCell[h];
			const col = k % COLS;
			const row = k / COLS | 0;
			for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
				const cc = col + dx;
				const rr = row + dy;
				if (cc >= 0 && rr >= 0 && cc < COLS && rr < ROWS && !this.hulkGrid[rr * COLS + cc]) this.hulkGrid[rr * COLS + cc] = 2;
			}
		}
		for (let h = 0; h < this.hkCount; h++) this.hulkGrid[this.hkCell[h]] = 1;
		const t = this.map.grid[c];
		this.sightBlock[c] = this.hulkGrid[c] === 1 || t === 1 || t === 4 || t === 5 ? 1 : 0;
		const x = (c % COLS + .5) * 20;
		const y = ((c / COLS | 0) + .5) * 20;
		for (const [id, m] of this.losMasks) if (Math.abs(m.x - x) <= (m.r + 1) * 20 && Math.abs(m.y - y) <= (m.r + 1) * 20) this.losMasks.delete(id);
		this.towerVersion++;
	}
	/** Engineers (ours) or sappers (theirs) at work on the hulk in cell c; true while there is one. */
	clearHulk(c, work) {
		for (let h = 0; h < this.hkCount; h++) {
			if (this.hkCell[h] !== c) continue;
			this.hkWork[h] += work;
			return true;
		}
		return false;
	}
	/**
	* The enemy has a fix on gun t: its battery (if it stands and is ready) answers with a few shells
	* on that position, and its muzzle flashes give it away for a moment.
	*/
	counterBattery(t) {
		let g = -1;
		for (let k = 0; k < MAX_GARRISON; k++) if (this.gKind[k] >= 0 && ENEMIES[this.gKind[k]].fixed === "arty" && this.gSlot[k] >= 0 && this.eBuild[this.gSlot[k]] <= 0) g = k;
		if (g < 0) return;
		t.fix = 0;
		const i = this.gSlot[g];
		this.eSeenT[i] = 6;
		const dmg = CB_DMG * (.6 + .4 * this.hpMult);
		for (let k = 0; k < CB_SHELLS && this.rkCount < 512; k++) {
			const r = this.rkCount++;
			const a = this.rng.next() * TWO_PI;
			const d = Math.sqrt(this.rng.next()) * 26;
			this.rkSx[r] = this.gX[g];
			this.rkSy[r] = this.gY[g];
			this.rkTx[r] = t.x + Math.cos(a) * d;
			this.rkTy[r] = t.y + Math.sin(a) * d;
			this.rkWait[r] = 1.5 + k * .5;
			this.rkT[r] = this.rkT0[r] = 1.4 + Math.hypot(t.x - this.gX[g], t.y - this.gY[g]) / 900;
			this.rkDmg[r] = dmg;
			this.rkShell[r] = 1;
		}
		for (let k = 0; k < 6; k++) this.fx(1, 0, this.gX[g], this.gY[g], this.vr.range(-40, 40), this.vr.range(-40, 40), 1.4, 8, 30, .6, 12103840, 1.5, 8);
		this.ev(15, this.gX[g], this.gY[g], ENEMY_FX.indexOf("barrage"));
	}
	/** The hour of the day (0-24): it runs with the game, a day in DAY_S s. */
	get clock() {
		return (this.startHour + this.time * 24 / DAY_S) % 24;
	}
	/** 0 in daylight … 1 at night (dusk 19-21 h, dawn 4-6 h). */
	get night() {
		if (!WW2$1) return 0;
		const h = this.clock;
		if (h >= 6 && h < 19) return 0;
		if (h >= 21 || h < 4) return 1;
		return h >= 19 ? (h - 19) / 2 : 1 - (h - 4) / 2;
	}
	/** How far everyone sees compared with a clear day: night and weather. */
	get sightMult() {
		return (1 - NIGHT_SIGHT * this.night) * (this.weather === "fog" ? .55 : this.weather === "rain" ? .85 : 1);
	}
	/** Direct fire reaches this share of its range (night: as far as the crews can see). */
	get dimMult() {
		return 1 - NIGHT_RANGE * this.night;
	}
	/** Ground speed in this weather: mud for vehicles, snow for everyone. */
	weatherSpeed(inf) {
		return this.weather === "rain" ? inf ? .95 : .8 : this.weather === "snow" ? .85 : 1;
	}
	/** A mortar in flare mode lights the attackers it hears in the dark. */
	fireFlare(t, range) {
		let best = -1;
		let bestD = range * range;
		const n = this.hash.query(t.x, t.y, range, this.qbuf);
		for (let k = 0; k < n; k++) {
			const i = this.qbuf[k];
			if (!this.eAlive[i] || this.eAir[i] || this.litGrid[this.eGCell[i]] || this.eGar[i] >= 0) continue;
			const d2 = (this.eX[i] - t.x) ** 2 + (this.eY[i] - t.y) ** 2;
			if (d2 < bestD) {
				bestD = d2;
				best = i;
			}
		}
		if (best < 0 || this.flCount >= 16) return false;
		const f = this.flCount++;
		this.flX[f] = this.eX[best] + Math.cos(this.eAng[best]) * 40;
		this.flY[f] = this.eY[best] + Math.sin(this.eAng[best]) * 40;
		this.flT[f] = FLARE_T;
		this.lightFlares();
		this.aim(t, this.eX[best], this.eY[best]);
		this.muzzleFlash(t.x, t.y, 10, 16777215);
		this.ev(0, t.x, t.y, t.type);
		return true;
	}
	/** Flares burn down; the cells they light are worked out again when they change. */
	updateFlares() {
		let gone = false;
		for (let f = this.flCount - 1; f >= 0; f--) {
			if ((this.flT[f] -= .016666666666666666) > 0) continue;
			const last = --this.flCount;
			this.flX[f] = this.flX[last];
			this.flY[f] = this.flY[last];
			this.flT[f] = this.flT[last];
			gone = true;
		}
		if (gone) this.lightFlares();
	}
	lightFlares() {
		this.litGrid.fill(0);
		const r = Math.ceil(170 / 20);
		for (let f = 0; f < this.flCount; f++) {
			const c0 = Math.floor(this.flX[f] / 20);
			const r0 = Math.floor(this.flY[f] / 20);
			for (let dy = -9; dy <= r; dy++) for (let dx = -9; dx <= r; dx++) {
				const c = c0 + dx;
				const row = r0 + dy;
				if (c >= 0 && row >= 0 && c < COLS && row < ROWS && dx * dx + dy * dy <= 81) this.litGrid[row * COLS + c] = 1;
			}
		}
	}
	/** Does a straight line from (x0, y0) to (x1, y1) stay clear of forests, mountains and ruins? */
	clearLine(x0, y0, x1, y1) {
		const dx = x1 - x0;
		const dy = y1 - y0;
		const n = Math.ceil(Math.hypot(dx, dy) / 10);
		for (let k = 1; k < n; k++) {
			const c = (x0 + dx * k / n) / 20 | 0;
			const r = (y0 + dy * k / n) / 20 | 0;
			if (c >= 0 && r >= 0 && c < COLS && r < ROWS && this.sightBlock[r * COLS + c]) return false;
		}
		return true;
	}
	/** Which cells within `range` px tower t can see, cached per tower (the terrain doesn't change). */
	losMask(t, range) {
		const r = Math.ceil(range / 20) + 1;
		const m = this.losMasks.get(t.id);
		if (m && m.r >= r && m.x === t.x && m.y === t.y) return m;
		const side = 2 * r + 1;
		const mask = new Uint8Array(side * side);
		const c0 = Math.floor(t.x / 20);
		const r0 = Math.floor(t.y / 20);
		for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
			if (dx * dx + dy * dy > (r + .5) * (r + .5)) continue;
			const c = c0 + dx;
			const row = r0 + dy;
			if (c < 0 || row < 0 || c >= COLS || row >= ROWS) continue;
			if (this.clearLine(t.x, t.y, (c + .5) * 20, (row + .5) * 20)) mask[(dy + r) * side + dx + r] = 1;
		}
		const out = {
			r,
			x: t.x,
			y: t.y,
			mask
		};
		this.losMasks.set(t.id, out);
		return out;
	}
	/** Can tower t see cell c (within `range`)? */
	towerSeesCell(t, c, range) {
		const m = this.losMask(t, range);
		const dx = c % COLS - Math.floor(t.x / 20);
		const dy = (c / COLS | 0) - Math.floor(t.y / 20);
		if (dx < -m.r || dx > m.r || dy < -m.r || dy > m.r) return false;
		return m.mask[(dy + m.r) * (2 * m.r + 1) + dx + m.r] === 1;
	}
	/** Can tower t (with a gun of `range`) see the cell under unit i? Aircraft are always in sight. */
	towerSees(t, i, range) {
		if (this.eAir[i]) return true;
		const m = this.losMask(t, range);
		const dx = (this.eX[i] / 20 | 0) - Math.floor(t.x / 20);
		const dy = (this.eY[i] / 20 | 0) - Math.floor(t.y / 20);
		if (dx < -m.r || dx > m.r || dy < -m.r || dy > m.r) return false;
		return m.mask[(dy + m.r) * (2 * m.r + 1) + dx + m.r] === 1;
	}
	/** WW2 fog of war: is attacker i seen by anything of ours (or marked, or just gave itself away by firing)? Always in classic games. */
	seen(i) {
		return !WW2$1 || this.eAir[i] === 1 || this.eGar[i] >= 0 && ENEMIES[this.eKind[i]].fixed !== "arty" || this.eMarkT[i] > 0 || this.eSeenT[i] > 0 || this.seenGrid[this.eGCell[i]] === 1;
	}
	/**
	* The fog of war: what our emplacements see (rebuilt when they change), plus what our units and the
	* commander see now (raycast round each). Gameplay: the guns fire at what can be seen.
	*/
	updateSight() {
		const mult = this.sightMult;
		const step = Math.round(mult * 20);
		if (step !== this.sightStep) {
			this.sightStep = step;
			this.towerSightVersion = -1;
		}
		if (this.towerSightVersion !== this.towerVersion) {
			this.towerSightVersion = this.towerVersion;
			this.towerSight.fill(0);
			for (const t of this.towers) {
				if (t.wreck) continue;
				const range = Math.max(TOWERS[t.type].levels[t.level].range * t.rangeMult, TOWER_SIGHT) * mult;
				const m = this.losMask(t, range);
				const side = 2 * m.r + 1;
				const c0 = Math.floor(t.x / 20);
				const r0 = Math.floor(t.y / 20);
				const rc = range / 20 + .5;
				for (let dy = -m.r; dy <= m.r; dy++) {
					const row = r0 + dy;
					if (row < 0 || row >= ROWS) continue;
					for (let dx = -m.r; dx <= m.r; dx++) {
						const c = c0 + dx;
						if (c >= 0 && c < COLS && dx * dx + dy * dy <= rc * rc && m.mask[(dy + m.r) * side + dx + m.r]) this.towerSight[row * COLS + c] = 1;
					}
				}
			}
		}
		this.seenGrid.set(this.towerSight);
		const look = (x, y, range, ray) => {
			const r = Math.ceil(range / 20);
			const c0 = Math.floor(x / 20);
			const r0 = Math.floor(y / 20);
			for (let dy = -r; dy <= r; dy++) {
				const row = r0 + dy;
				if (row < 0 || row >= ROWS) continue;
				for (let dx = -r; dx <= r; dx++) {
					const c = c0 + dx;
					const i = row * COLS + c;
					if (c < 0 || c >= COLS || this.seenGrid[i] || dx * dx + dy * dy > r * r) continue;
					if (!ray || this.clearLine(x, y, (c + .5) * 20, (row + .5) * 20)) this.seenGrid[i] = 1;
				}
			}
		};
		for (let u = 0; u < 192; u++) {
			if (!this.uAlive[u]) continue;
			if (this.uAir[u]) look(this.uX[u], this.uY[u], AIR_SIGHT * mult, false);
			else look(this.uX[u], this.uY[u], Math.max(UNIT_SIGHT, UNITS[this.uKind[u]].gun?.range ?? 0) * mult, true);
		}
		const h = this.hero;
		if (h && h.downT <= 0) look(h.x, h.y, UNIT_SIGHT * mult, true);
		if (this.flCount) {
			for (let c = 0; c < COLS * ROWS; c++) if (this.litGrid[c]) this.seenGrid[c] = 1;
		}
		this.sightVersion++;
	}
	/**
	* An attacker's nerve, a few times a second: heavy losses (low hp) and being pinned down for long
	* wear it down, quiet moments and a living officer bring it back. Broken, it falls back or surrenders.
	*/
	updateMorale(i, def) {
		if (this.eRetreat[i] || def.fixed) return;
		const dt = 10 * DT;
		const h = this.eHp[i] / this.eMaxHp[i];
		const led = !def.officer && this.officerAlive[this.eWave[i] & 63] === 1;
		let loss = h < .4 ? (.4 - h) * 1.2 : 0;
		if (this.eSupp[i] > .8) {
			if ((this.ePinT[i] += dt) > 3) loss += .12;
		} else this.ePinT[i] = Math.max(0, this.ePinT[i] - dt);
		let m = this.eMorale[i] - loss * (def.banzai ? .35 : 1) * (led ? .6 : 1) * dt;
		if (this.eSupp[i] < .2) m += (.04 + (led ? .05 : 0)) * dt;
		this.eMorale[i] = Math.min(1, m);
		if (m < BREAK) this.breakUnit(i);
	}
	/** Broken: pinned down (or cut off), it surrenders and the bounty is paid; otherwise it falls back to its lines. */
	breakUnit(i) {
		const x = this.eX[i];
		const y = this.eY[i];
		if (this.eSupp[i] > .6 || this.backField(this.eRoute[i]).dist[this.eCell[i]] === Infinity) {
			this.money += this.eReward[i];
			this.totalKills++;
			this.ev(9, x, y, 8);
			this.freeEnemy(i);
			return;
		}
		this.eRetreat[i] = 1;
		this.eBreach[i] = 0;
		this.eWall[i] = 0;
		this.eTgt[i] = 0;
		this.eAimT[i] = 0;
		this.ev(9, x, y, 9);
	}
	/** A man down shakes the infantry round him; the officer's fall shakes his whole wave. */
	lossShock(i) {
		const def = ENEMIES[this.eKind[i]];
		if (!def.inf || def.fixed) return;
		const x = this.eX[i];
		const y = this.eY[i];
		if (def.officer) {
			const w = this.eWave[i];
			for (let n = 0; n < this.liveCount; n++) {
				const j = this.live[n];
				const e = ENEMIES[this.eKind[j]];
				if (j !== i && this.eAlive[j] && this.eWave[j] === w && e.inf && !e.fixed) this.eMorale[j] -= OFFICER_SHOCK * (e.banzai ? .4 : 1);
			}
			this.ev(9, x, y, 10);
		}
		this.forEachInRange(x, y, 70, false, true, (j) => {
			const e = ENEMIES[this.eKind[j]];
			if (j !== i && e.inf && !e.fixed) this.eMorale[j] -= LOSS_SHOCK * (e.banzai ? .4 : 1);
		});
	}
	/** The way back to the entry of route r, for attackers falling back (rebuilt when the maze changes). */
	backField(r) {
		if (this.backVersion !== this.towerVersion) {
			if (!this.back.length) this.back = this.map.routes.map((rt) => new FlowField(rt.entry, this.moveCost));
			for (const f of this.back) f.compute(this.blocked);
			this.backVersion = this.towerVersion;
		}
		return this.back[r];
	}
	/** Our losses: a position knocked out or a unit lost shakes the crews and soldiers round it (seasoned ones less). */
	shakeDefence(x, y, f) {
		for (const t of this.towers) {
			if (t.wreck || !this.maxHp(t) || (t.x - x) ** 2 + (t.y - y) ** 2 > 25600) continue;
			t.supp = Math.min(1, t.supp + LOSS_SUPP * f * (1 - .05 * t.level));
			t.shakeT = SHAKEN_T;
		}
		for (let u = 0; u < 192; u++) {
			if (!this.uAlive[u] || this.uAir[u] || (this.uX[u] - x) ** 2 + (this.uY[u] - y) ** 2 > 25600) continue;
			const steady = 1 - .25 * this.unitVet(u);
			if (UNITS[this.uKind[u]].inf) this.uSupp[u] = Math.min(1, this.uSupp[u] + LOSS_SUPP * f * steady);
			this.uShakeT[u] = SHAKEN_T * steady;
		}
	}
	/** Does this emplacement fire ammunition that runs out? */
	usesAmmo(t) {
		return WW2$1 && !t.base && AMMO_S[t.kind] !== void 0 && TOWERS[t.type].targeted;
	}
	/** A shot (or `n` s of a flamethrower's spray) out of tower t's stock. */
	spend(t, rate, n = 1) {
		const s = AMMO_S[t.kind];
		if (s && !t.base) t.ammo = Math.max(0, t.ammo - n / (s * Math.max(.05, rate)));
	}
	/** How far depot or headquarters t supplies the guns round it (0: it doesn't). */
	supplyRange(t) {
		if (!WW2$1 || t.wreck || t.buildT > 0) return 0;
		if (t.base) return 200;
		return t.kind === "depot" ? TOWERS[t.type].levels[t.level].range : 0;
	}
	/** Is gun t within reach of a depot (whatever its store holds: a truck refills it) or of a headquarters? */
	supplied(t) {
		for (const s of this.towers) {
			const r = this.supplyRange(s);
			if (r && (s.x - t.x) ** 2 + (s.y - t.y) ** 2 <= r * r) return true;
		}
		return false;
	}
	/** Our trucks on the road to (or back from) depot `id`, or all of them (id 0). */
	trucksFor(id) {
		let n = 0;
		for (let u = 0; u < 192; u++) if (this.uAlive[u] && this.uKind[u] === this.truckKind && (!id || this.uTask[u] === id)) n++;
		return n;
	}
	/**
	* WW2 supply, a couple of times a second: depots hand ammunition from their store to the guns in
	* reach, our headquarters (an endless store) to the guns round it, crews out of reach scrounge a
	* little; a depot running low calls a truck from the nearest headquarters.
	*/
	updateSupply() {
		const dt = SUPPLY_TICKS * DT;
		for (const t of this.towers) if (t.fix > 0) t.fix = Math.max(0, t.fix - FIX_FADE * dt);
		const scrounge = SCROUNGE * dt * (this.attackers > 0 ? 1 : LULL_SUPPLY);
		for (const t of this.towers) if (t.ammo < 1 && !t.wreck && this.usesAmmo(t)) t.ammo = Math.min(1, t.ammo + scrounge);
		for (const s of this.towers) {
			const r = this.supplyRange(s);
			if (!r) continue;
			const depot = !s.base;
			for (const t of this.towers) {
				if (t.ammo >= 1 || t.wreck || !this.usesAmmo(t) || (t.x - s.x) ** 2 + (t.y - s.y) ** 2 > r * r) continue;
				let give = Math.min(1 - t.ammo, RESUPPLY * dt);
				if (depot) {
					give = Math.min(give, s.ammo * DEPOT_LOADS);
					s.ammo -= give / DEPOT_LOADS;
				}
				t.ammo += give;
				if (depot && s.ammo <= 0) break;
			}
		}
		if (this.truckKind < 0) return;
		if (this.truckCd > 0) {
			this.truckCd -= dt;
			return;
		}
		if (this.trucksFor(0) >= MAX_TRUCKS) return;
		for (const d of this.towers) {
			if (d.kind !== "depot" || d.ammo >= DEPOT_CALL || !this.supplyRange(d) || this.trucksFor(d.id)) continue;
			let hq = null;
			let best = Infinity;
			for (const h of this.towers) {
				const d2 = (h.x - d.x) ** 2 + (h.y - d.y) ** 2;
				if (h.base && !h.wreck && d2 < best) {
					best = d2;
					hq = h;
				}
			}
			if (!hq) return;
			const u = this.spawnUnit(this.truckKind, hq.x, hq.y + hq.size * 20 * .5 + 6, -1);
			if (u < 0) return;
			this.uTask[u] = d.id;
			this.uWork[u] = 0;
			this.uStance[u] = 0;
			if (!this.towardsTower(u, d)) {
				this.uAlive[u] = 0;
				continue;
			}
			this.truckCd = TRUCK_GAP;
			return;
		}
	}
	/** Path for unit u to the cells round tower t. */
	towardsTower(u, t) {
		return this.unitPathTo(u, t.col - 1, t.row - 1, t.col + t.size, t.row + t.size, t.col, t.row, t.col + t.size - 1, t.row + t.size - 1);
	}
	/** A supply truck: to its depot, unload (the store is full again), back to the headquarters, gone. */
	truckWork(u) {
		if (this.uPathI[u] < this.uPathLen[u]) return;
		const x = this.uX[u];
		const y = this.uY[u];
		if (this.uWork[u] === 0) {
			const d = this.towerById.get(this.uTask[u]);
			if (d && !d.wreck && (d.x - x) ** 2 + (d.y - y) ** 2 <= (d.size * 20 * .5 + 24) ** 2) {
				d.ammo = 1;
				this.burst(d.x, d.y, 16767050, 6, 0, 1);
			} else if (d && !d.wreck && this.towardsTower(u, d)) return;
			this.uWork[u] = 1;
			let hq = null;
			for (const h of this.towers) if (h.base && !h.wreck && (!hq || (h.x - x) ** 2 + (h.y - y) ** 2 < (hq.x - x) ** 2 + (hq.y - y) ** 2)) hq = h;
			if (hq && this.towardsTower(u, hq)) return;
		}
		this.uAlive[u] = 0;
		this.unitVersion++;
	}
	/**
	* WW2: the enemy's supply column. A truck sets off from behind their headquarters every so often
	* and drives to their supply dump; each one that gets there tops up the stocks for the next waves.
	*/
	updateConvoy() {
		if (this.wave < 1 || this.gSlot[0] < 0) return;
		if ((this.convoyT -= .016666666666666666) > 0) return;
		this.convoyT = CONVOY_EVERY * this.rng.range(.8, 1.2);
		const kind = ENEMIES.findIndex((e) => e.supply);
		if (kind < 0) return;
		const i = this.spawnEnemy(kind, this.wave);
		if (i < 0) return;
		const [ix, iy] = this.map.routes[0].inDir;
		this.eX[i] = this.ePx[i] = Math.min(MAP_W - 4, Math.max(4, this.gX[0] - ix * 20 * 7 + this.rng.range(-20, 20)));
		this.eY[i] = this.ePy[i] = Math.min(MAP_H - 4, Math.max(4, this.gY[0] - iy * 20 * 7 + this.rng.range(-20, 20)));
		this.eAng[i] = this.ePang[i] = Math.atan2(iy, ix);
		this.eRoute[i] = 0;
	}
	/** An enemy supply truck drives to their dump (or their headquarters if the dump is down) and unloads. */
	driveConvoy(i, sp) {
		let g = -1;
		for (let k = 0; k < MAX_GARRISON; k++) if (this.gKind[k] >= 0 && ENEMIES[this.gKind[k]].fixed === "depot" && this.gSlot[k] >= 0) g = k;
		const tx = g >= 0 ? this.gX[g] : this.gX[0];
		const ty = g >= 0 ? this.gY[g] : this.gY[0];
		const dx = tx - this.eX[i];
		const dy = ty - this.eY[i];
		const d = Math.hypot(dx, dy);
		if (d < 18) {
			this.foeSupply = Math.min(1, this.foeSupply + CONVOY_LOAD * (g >= 0 ? 1 : .5));
			this.freeEnemy(i);
			return;
		}
		this.eAng[i] += Math.max(-3 * DT, Math.min(3 * DT, angleDiff(this.eAng[i], Math.atan2(dy, dx))));
		this.eX[i] += dx / d * sp * DT;
		this.eY[i] += dy / d * sp * DT;
		this.eRemain[i] = 1e6;
	}
	/** What patching it up (or rebuilding the rubble) costs right now; 0 if it needs nothing. */
	repairCost(t) {
		const max = this.maxHp(t);
		if (!max || t.hp >= max) return 0;
		return Math.max(1, Math.ceil(t.spent * REPAIR_SHARE * (1 - t.hp / max)));
	}
	/** Repairs a damaged emplacement, or rebuilds a destroyed one if nothing stands in the rubble. */
	repair(t) {
		const cost = this.repairCost(t);
		if (!cost || this.money < cost) return false;
		const rebuild = t.wreck;
		if (t.wreck) {
			const reroutes = !TOWERS[t.type].walkable && !t.open;
			if (reroutes && this.wallStatus(this.cellsOf(t)) !== "ok") return false;
			t.wreck = false;
			this.setFootprint(t, t.id);
			if (reroutes) for (let k = 0; k < this.fields.length; k++) this.fields[k].copyFrom(this.scratch[k]);
			t.charge = TOWERS[t.type].levels[t.level].charge ?? 0;
			this.towerVersion++;
			this.burst(t.x, t.y, 10129272, t.size * 4, 1, 0);
			this.ev(4, t.x, t.y, t.type);
		} else {
			this.burst(t.x, t.y, 16769674, 8, 2, 1);
			this.ev(6, t.x, t.y, t.level);
		}
		this.money -= cost;
		t.supp = 0;
		if (rebuild) this.startBuilding(t, buildTime(t.spent) * .6);
		else t.hp = this.maxHp(t);
		return true;
	}
	/** The emplacement is knocked out: it becomes rubble that units can climb through (slowly). */
	wreckTower(t) {
		if (t.fromG >= 0) {
			this.loseCaptured(t);
			this.explosion(t.x, t.y, 1.2 + t.size * .5, 4);
			this.ev(16, t.x, t.y, t.type);
			this.shakeDefence(t.x, t.y, 1);
			this.demolish(t);
			return;
		}
		t.hp = 0;
		t.fix = 0;
		t.wreck = true;
		t.supp = 0;
		t.beam = -1;
		t.firing = 0;
		this.setFootprint(t, t.id);
		for (let d = this.drones.length - 1; d >= 0; d--) if (this.drones[d].hive === t) this.drones.splice(d, 1);
		for (const f of this.fields) f.compute(this.blocked);
		this.towerVersion++;
		this.explosion(t.x, t.y, 1.2 + t.size * .5, 4);
		for (let k = 0; k < 10; k++) this.fx(4, 0, t.x, t.y, this.vr.range(-110, 110), this.vr.range(-110, 110), .9, 4, 3, 1, 8022608, 3, 8);
		this.ev(16, t.x, t.y, t.type);
		this.shakeDefence(t.x, t.y, 1);
		if (t.id === this.objectiveId || t.base > 0) {
			this.lives = 0;
			this.gameOver = true;
		}
	}
	/**
	* A shot from the attackers lands on a defender: the same rule as our guns against their armour
	* (penetration against fortification; blasts and bombs from above find the open top). The crew is
	* suppressed either way; concrete keeps most of that off.
	*/
	hitDefender(id, dmg, pen, supp, top, sx = 0, sy = 0) {
		if (id <= -10) {
			this.hitUnit(-id - UNIT_ID0, dmg, pen, supp, top, sx, sy);
			return;
		}
		if (id === -1) {
			const h = this.hero;
			if (!h || h.downT > 0) return;
			h.hp -= dmg;
			if (h.hp <= 0) {
				h.hp = 0;
				h.downT = HERO_DOWN;
				h.path = [];
				h.rallyT = 0;
				this.burst(h.x, h.y, 13650490, 8, 0, 1);
				this.ev(17, h.x, h.y);
			}
			return;
		}
		const t = this.towerById.get(id);
		if (!t || t.wreck || t.hp <= 0) return;
		let fort = this.fortOf(t);
		if (top) fort *= .5;
		const r = fort > 0 ? pen / fort : 9;
		const a = r >= 1 ? dmg : r < .7 ? 0 : dmg * .25 * ((r - .7) / .3);
		t.supp = Math.min(1, t.supp + supp * (fort >= 60 ? .25 : 1));
		if (a <= 0) return;
		t.hp -= a;
		if (t.hp <= 0) this.wreckTower(t);
	}
	/** Where defender `id` stands (the commander or a tower), or null if it's gone or can't be shot at. */
	defenderAt(id) {
		if (id === -1) return this.hero && this.hero.downT <= 0 ? this.hero.src : null;
		if (id <= -10) {
			const u = -id - UNIT_ID0;
			if (u >= 192 || !this.uAlive[u]) return null;
			const a = this.aimProxy;
			a.id = id;
			a.x = this.uX[u];
			a.y = this.uY[u];
			return a;
		}
		const t = this.towerById.get(id);
		return t && !t.wreck && t.hp > 0 ? t : null;
	}
	/**
	* The defender attacker `i` shoots at: within range, the most threatening. Tanks go for the guns
	* that can kill them, infantry for the machine guns pinning them down, snipers for the officer.
	*/
	pickDefender(i, def, g) {
		const x = this.eX[i];
		const y = this.eY[i];
		const r2 = g.range * g.range;
		let best = 0;
		let bestScore = -Infinity;
		for (const t of this.towers) {
			if (t.wreck || t.hp <= 0 || g.air || this.towerHidden(t)) continue;
			const d2 = (t.x - x) ** 2 + (t.y - y) ** 2;
			const reach = g.range + t.size * 20 * .5;
			if (d2 > reach * reach) continue;
			const lv = TOWERS[t.type].levels[t.level];
			let s = -Math.sqrt(d2);
			if (t.base) s += 60;
			if (g.fx === "tank") s += (lv.pen ?? 0) >= 40 ? 90 : 0;
			else if (def.inf) s += lv.supp ? 50 : 0;
			if (g.fx === "rocket") s += t.size * 20;
			else if (g.fx === "kamikaze") s += t.spent / 6;
			if (s > bestScore) {
				bestScore = s;
				best = t.id;
			}
		}
		for (let u = 0; u < 192; u++) {
			if (!this.uAlive[u] || this.uAir[u] === 1 !== !!g.air || this.unitHidden(u)) continue;
			const d2 = (this.uX[u] - x) ** 2 + (this.uY[u] - y) ** 2;
			if (d2 > r2) continue;
			const ud = UNITS[this.uKind[u]];
			let s = -Math.sqrt(d2);
			if (g.fx === "tank") s += ud.arm ? 110 : 0;
			else if (def.inf) s += ud.inf ? 40 : 0;
			if (s > bestScore) {
				bestScore = s;
				best = -u - UNIT_ID0;
			}
		}
		const h = this.hero;
		if (h && h.downT <= 0 && !g.air) {
			const d2 = (h.x - x) ** 2 + (h.y - y) ** 2;
			if (d2 <= r2) {
				if (-Math.sqrt(d2) + (def.stealth ? 200 : def.inf ? 30 : 0) > bestScore) best = -1;
			}
		}
		return best;
	}
	/**
	* WW2: attacker i fires back. It picks a defender every few ticks; tanks halt to aim (returns true
	* while halted), infantry fire on the move and less often while suppressed.
	*/
	enemyFire(i, def, g) {
		if (this.eNadeCd[i] > 0) this.eNadeCd[i] -= DT;
		if (this.eGunCd[i] > 0) this.eGunCd[i] -= DT * (def.inf ? 1 - .6 * this.eSupp[i] : 1);
		if (this.eSmoked[i] && this.eWall[i] <= 0) {
			this.eAimT[i] = 0;
			return false;
		}
		if (this.eWall[i] > 0 && this.eAimT[i] <= 0) this.eTgt[i] = this.eWall[i];
		else if ((this.ticks + i) % 12 === 0 && this.eAimT[i] <= 0) this.eTgt[i] = this.pickDefender(i, def, g);
		const id = this.eTgt[i];
		if (!id) return false;
		const t = this.defenderAt(id);
		if (!t) {
			this.eTgt[i] = 0;
			this.eAimT[i] = 0;
			return false;
		}
		if (this.eAimT[i] > 0) {
			if (def.arm) this.eAng[i] += Math.max(-1.4 * DT, Math.min(1.4 * DT, angleDiff(this.eAng[i], Math.atan2(t.y - this.eY[i], t.x - this.eX[i]))));
			if ((this.eAimT[i] -= .016666666666666666) <= 0) this.enemyShot(i, def, g, t);
			return true;
		}
		if (this.eGunCd[i] > 0) return false;
		const reach = g.range + t.size * 20 * .5 + 8;
		if ((t.x - this.eX[i]) ** 2 + (t.y - this.eY[i]) ** 2 > reach * reach) {
			this.eTgt[i] = 0;
			return false;
		}
		if (g.halt && !this.eAir[i]) {
			this.eAimT[i] = g.halt;
			return true;
		}
		this.enemyShot(i, def, g, t);
		return false;
	}
	enemyShot(i, def, g, t) {
		this.eGunCd[i] = 1 / g.rate * this.rng.range(.85, 1.15);
		this.eSeenT[i] = FLASH_SEEN;
		const air = this.eAir[i] === 1;
		const x = this.eX[i];
		const y = this.eY[i];
		const z = air ? 34 : def.inf ? 6 : 10;
		const spread = t.size * 20 * .3;
		const tx = t.x + this.rng.range(-spread, spread);
		const ty = t.y + this.rng.range(-spread, spread);
		const dmg = g.dmg * (.6 + .4 * this.hpMult);
		if (g.salvo) {
			for (let k = 0; k < g.salvo && this.rkCount < 512; k++) {
				const r = this.rkCount++;
				const a = this.rng.next() * TWO_PI;
				const d = Math.sqrt(this.rng.next()) * 75;
				this.rkSx[r] = x;
				this.rkSy[r] = y;
				this.rkTx[r] = tx + Math.cos(a) * d;
				this.rkTy[r] = ty + Math.sin(a) * d;
				this.rkWait[r] = k * .16;
				this.rkT[r] = this.rkT0[r] = 1.4 + Math.hypot(tx - x, ty - y) / 400;
				this.rkDmg[r] = dmg;
				this.rkShell[r] = 0;
			}
			for (let k = 0; k < 10; k++) this.fx(1, 0, x, y, this.vr.range(-50, 50), this.vr.range(-50, 50), 2, 8, 30, .5, 12103840, 1.5, 6);
			this.ev(15, x, y, ENEMY_FX.indexOf(g.fx));
			return;
		}
		if (def.inf && !def.stealth && t.id > 0 && this.eNadeCd[i] <= 0) {
			const reach = t.size * 20 * .5 + 36;
			if ((t.x - x) ** 2 + (t.y - y) ** 2 < reach * reach) {
				this.eNadeCd[i] = this.rng.range(6, 9);
				this.hitDefender(t.id, GRENADE_DMG * (.6 + .4 * this.hpMult), GRENADE_PEN, .3, true, x, y);
				this.explosion(tx, ty, .45, 2);
			}
		}
		const top = air;
		this.hitDefender(t.id, dmg, g.pen, g.supp, top, x, y);
		if (g.splash) {
			for (let u = 0; u < 192; u++) {
				if (!this.uAlive[u] || this.uAir[u] || -u - UNIT_ID0 === t.id) continue;
				if ((this.uX[u] - tx) ** 2 + (this.uY[u] - ty) ** 2 <= g.splash * g.splash) this.hitUnit(u, dmg * .5, g.pen * .6, g.supp * .5, true, x, y);
			}
			for (const o of this.towers) {
				if (o === t || o.wreck || o.hp <= 0) continue;
				const r = g.splash + o.size * 20 * .5;
				if ((o.x - tx) ** 2 + (o.y - ty) ** 2 <= r * r) this.hitDefender(o.id, dmg * .5, g.pen * .6, g.supp * .5, true);
			}
			const h = this.hero;
			if (t.id !== -1 && h && (h.x - tx) ** 2 + (h.y - ty) ** 2 <= g.splash * g.splash * 2) this.hitDefender(-1, dmg * .5, 0, 0, true);
		}
		const ang = Math.atan2(ty - y, tx - x);
		const ca = Math.cos(ang);
		const sa = Math.sin(ang);
		const big = g.fx === "tank";
		if (g.fx === "satchel") {
			this.explosion(tx, ty, 1.3, 4);
			return;
		}
		if (g.fx === "kamikaze") {
			this.explosion(tx, ty, 1.8, 4);
			this.ev(15, tx, ty, ENEMY_FX.indexOf("kamikaze"));
			this.freeEnemy(i);
			return;
		}
		this.fx(0, 1, x + ca * 8, y + sa * 8, 0, 0, .07, big ? 16 : 6, big ? 6 : 2, .9, 16767120, 0, z);
		if (g.fx === "rifle") this.streak(x, y, z, tx, ty, 8, .1, 16773312, .8);
		else if (g.fx === "rocket") this.streak(x, y, z, tx, ty, 4, .3, 16756832, 1.6);
		else this.streak(x, y, z, tx, ty, 8, big ? .12 : .06, big ? 16769184 : 16765040, big ? 2 : 1);
		if (big || g.fx === "rocket") {
			this.explosion(tx, ty, g.splash ? .5 + g.splash / 60 : .4, 4);
			for (let k = 0; k < 4; k++) this.fx(1, 0, x + ca * 12, y + sa * 12, this.vr.range(-30, 30), this.vr.range(-30, 30), .8, 6, 18, .45, 11052186, 3, z);
		} else if (this.vr.next() < .5) this.fx(2, 1, tx, ty, this.vr.range(-60, 60), this.vr.range(-60, 60), .15, 3, 1, 1, 16769184, 4, 8);
		this.ev(15, x, y, ENEMY_FX.indexOf(g.fx));
	}
	sell(t) {
		this.loseCaptured(t);
		this.money += this.sellValue(t);
		const i = this.towers.indexOf(t);
		if (i >= 0) this.towers.splice(i, 1);
		this.towerById.delete(t.id);
		this.setFootprint(t, -1);
		for (let d = this.drones.length - 1; d >= 0; d--) if (this.drones[d].hive === t) this.drones.splice(d, 1);
		for (const f of this.fields) f.compute(this.blocked);
		this.towerVersion++;
		this.burst(t.x, t.y, 9077104, 12, 1, 0);
		this.ev(5, t.x, t.y);
	}
	/** Opens or closes a gate. Closing is refused if it would trap units or seal a route. */
	toggleGate(t) {
		if (t.kind !== "gate") return "invalid";
		const cells = this.cellsOf(t);
		if (t.open) {
			for (const i of cells) this.blocked[i] = 0;
			const status = this.wallStatus(cells);
			if (status !== "ok") return status;
			t.open = false;
			for (const i of cells) this.blocked[i] = 1;
			for (let k = 0; k < this.fields.length; k++) this.fields[k].copyFrom(this.scratch[k]);
		} else {
			t.open = true;
			for (const i of cells) this.blocked[i] = 0;
			for (const f of this.fields) f.compute(this.blocked);
		}
		this.towerVersion++;
		this.burst(t.x, t.y, 14725184, 6, 2, 1);
		return "ok";
	}
	/** Superweapon readiness, 0..1. */
	chargeLevel(t) {
		const total = TOWERS[t.type].levels[t.level].charge ?? 0;
		return total ? 1 - t.charge / total : 1;
	}
	/** Fires a charged orbital laser or nuke at a world point. */
	fireSuper(t, x, y) {
		const lv = TOWERS[t.type].levels[t.level];
		if (!TOWERS[t.type].manual || t.charge > 0 || this.airLocked(t.type)) return false;
		x = Math.min(MAP_W, Math.max(0, x));
		y = Math.min(MAP_H, Math.max(0, y));
		t.charge = lv.charge ?? 0;
		this.ev(0, t.x, t.y, t.type);
		if (t.kind === "airfield") {
			const kind = UNITS.findIndex((d) => d.from === "airfield");
			for (let k = 0; k < 2; k++) {
				const u = this.spawnUnit(kind, t.x + (k ? 12 : -12), t.y, -1);
				if (u < 0) break;
				this.uPostX[u] = x;
				this.uPostY[u] = y;
				this.uLife[u] = 25;
				this.uAng[u] = Math.atan2(y - t.y, x - t.x);
			}
			return true;
		}
		if (t.kind === "stuka") {
			const d = Math.hypot(x - t.x, y - t.y) || 1;
			const ux = (x - t.x) / d;
			const uy = (y - t.y) / d;
			const n = lv.salvo ?? 3;
			for (let k = 0; k < n; k++) {
				const off = (k - (n - 1) / 2) * 22;
				const bx = x + ux * off - uy * this.rng.range(-12, 12);
				const by = y + uy * off + ux * this.rng.range(-12, 12);
				this.strikes.push({
					x: bx,
					y: by,
					t: 1.6 + k * .45,
					dmg: lv.damage * t.dmgMult,
					r: lv.splash ?? 48,
					src: t,
					pen: lv.pen ?? 70
				});
			}
			this.streak(x - ux * 500, y - uy * 500, 260, x + ux * 300, y + uy * 300, 40, 2.6, 13159632, 2);
			return true;
		}
		if (t.kind === "orbital") this.addZone(3, x, y, lv.splash ?? 30, lv.duration ?? 4, lv.damage * t.dmgMult, 0, false, t);
		else {
			const d = Math.hypot(x - t.x, y - t.y);
			const p = this.spawnProjectile(9, t.x, t.y, (x - t.x) / (d || 1), (y - t.y) / (d || 1), Math.max(d / 1.4, 260), lv.damage * t.dmgMult, lv.splash ?? 150, 1, -1, t, Math.max(1.4, d / 260));
			if (p >= 0) {
				this.pTx[p] = x;
				this.pTy[p] = y;
				this.pVx[p] = (x - t.x) / this.pTtl[p];
				this.pVy[p] = (y - t.y) / this.pTtl[p];
			}
			for (let k = 0; k < 10; k++) this.fx(1, 0, t.x, t.y, this.vr.range(-60, 60), this.vr.range(-60, 60), 1.2, 10, 40, .6, 11578528, 2, 6);
		}
		return true;
	}
	/** Damage, range and rate after auras and combos. */
	stats(t) {
		this.refreshAuras();
		const lv = TOWERS[t.type].levels[t.level];
		return {
			damage: lv.damage * t.dmgMult,
			range: lv.range * t.rangeMult,
			rate: lv.rate * t.rateMult
		};
	}
	/** Rebuilds aura grids, tower buffs and combos after the set of towers changed. */
	refreshAuras() {
		if (this.auraVersion === this.towerVersion) return;
		this.auraVersion = this.towerVersion;
		this.radarGrid.fill(0);
		this.jamGrid.fill(0);
		this.salvageGrid.fill(0);
		this.tarGrid.set(this.groundSlow);
		this.wireGrid.fill(1);
		this.spikeGrid.fill(0);
		this.spikeSrc.fill(null);
		const ballistics = 1 + .05 * perk(this.config, "ballistics");
		for (const t of this.towers) {
			t.rangeMult = t.rateMult = t.airBonus = 1;
			t.dmgMult = ballistics;
			t.combos.length = 0;
		}
		const cover = (t, r, fn) => {
			const c0 = Math.max(0, Math.floor((t.x - r) / 20));
			const c1 = Math.min(COLS - 1, Math.floor((t.x + r) / 20));
			const r0 = Math.max(0, Math.floor((t.y - r) / 20));
			const r1 = Math.min(ROWS - 1, Math.floor((t.y + r) / 20));
			for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) {
				const dx = (col + .5) * 20 - t.x;
				const dy = (row + .5) * 20 - t.y;
				if (dx * dx + dy * dy <= r * r) fn(row * COLS + col);
			}
		};
		for (let h = 0; h < this.hkCount; h++) if (!this.hkBlock[h]) this.tarGrid[this.hkCell[h]] = Math.min(this.tarGrid[this.hkCell[h]], .5);
		for (const t of this.towers) {
			const lv = TOWERS[t.type].levels[t.level];
			const buff = lv.buff ?? 0;
			if (t.wreck) {
				for (const c of this.cellsOf(t)) this.tarGrid[c] = Math.min(this.tarGrid[c], .55);
				continue;
			}
			switch (t.kind) {
				case "radar":
					cover(t, lv.range, (c) => {
						if (!WW2$1 || this.towerSeesCell(t, c, lv.range)) this.radarGrid[c] = 1;
					});
					for (const o of this.towers) if (Math.hypot(o.x - t.x, o.y - t.y) <= lv.range) o.rangeMult = Math.max(o.rangeMult, 1 + buff);
					break;
				case "command":
					for (const o of this.towers) if (o !== t && Math.hypot(o.x - t.x, o.y - t.y) <= lv.range) o.rateMult = Math.max(o.rateMult, 1 + buff);
					break;
				case "jammer":
					cover(t, lv.range, (c) => this.jamGrid[c] = Math.max(this.jamGrid[c], buff));
					break;
				case "salvage":
					cover(t, lv.range, (c) => this.salvageGrid[c] = Math.max(this.salvageGrid[c], buff));
					break;
				case "tar":
					for (const c of this.cellsOf(t)) this.tarGrid[c] = Math.min(this.tarGrid[c], lv.slow ?? 1);
					break;
				case "wire":
					for (const c of this.cellsOf(t)) this.wireGrid[c] = Math.min(this.wireGrid[c], lv.slow ?? 1);
					break;
				case "spikes": for (const c of this.cellsOf(t)) {
					this.spikeGrid[c] = lv.damage;
					this.spikeSrc[c] = t;
				}
			}
		}
		for (const t of this.towers) {
			const seen = /* @__PURE__ */ new Set();
			for (let row = t.row - 1; row <= t.row + t.size; row++) for (let col = t.col - 1; col <= t.col + t.size; col++) {
				if (col < 0 || row < 0 || col >= COLS || row >= ROWS) continue;
				const id = this.towerAt[row * COLS + col];
				if (id < 0 || id === t.id || seen.has(id)) continue;
				seen.add(id);
				const o = this.towerById.get(id);
				if (t.wreck || o.wreck) continue;
				const tk = TOWERS[t.type].kind;
				const ok = TOWERS[o.type].kind;
				for (const c of COMBOS) {
					if (!(c.a === tk && c.b === ok || c.b === tk && c.a === ok)) continue;
					if (t.combos.includes(c.name)) continue;
					t.combos.push(c.name);
					t.dmgMult *= c.dmg ?? 1;
					t.rateMult *= c.rate ?? 1;
					t.rangeMult *= c.range ?? 1;
					t.airBonus *= c.air ?? 1;
				}
			}
		}
	}
	get spawning() {
		return this.spawners.length > 0;
	}
	get canCallWave() {
		return !this.gameOver && (this.endless || this.siege || this.wave < this.totalWaves);
	}
	/** Money awarded for calling the next wave now. */
	get earlyBonus() {
		return this.wave === 0 ? 0 : Math.floor(this.nextWaveTimer * 2);
	}
	/** What the supply depots will pay at the next wave start. */
	get depotIncome() {
		let sum = 0;
		for (const t of this.towers) {
			if (t.kind !== "depot" || t.wreck) continue;
			const lv = TOWERS[t.type].levels[t.level];
			sum += (lv.income ?? 0) + Math.min(lv.cap ?? 0, Math.floor(this.money * (lv.interest ?? 0)));
		}
		return sum;
	}
	startNextWave() {
		if (!this.canCallWave) return;
		this.money += this.earlyBonus;
		for (let k = 0; k < 3; k++) this.items[k] = Math.min(this.itemMax, this.items[k] + (this.wave > 0 ? 1 : 0));
		if (this.wave > 0) {
			this.money += Math.round((WAVE_BONUS[0] + WAVE_BONUS[1] * this.wave) * this.routeFactor) + this.depotIncome;
			for (const t of this.towers) if (t.kind === "depot" && !t.wreck) this.burst(t.x, t.y, 16767050, 10, 0, 1);
		}
		this.wave++;
		this.smokeWave[this.wave & 63] = 0;
		this.officerAlive[this.wave & 63] = 0;
		this.ev(7, 0, 0, this.wave);
		if (WW2$1 && this.wave >= 6 && (this.wave % 4 === 3 || this.wave % 10 === 0)) this.barrage(this.wave);
		const groups = this.waveGroups(this.wave);
		let dur = 0;
		for (const g of groups) dur = Math.max(dur, g.delay + g.count * g.interval);
		this.spawners.push({
			wave: this.wave,
			groups,
			left: new Int32Array(groups.map((g) => g.count)),
			timer: new Float32Array(groups.length),
			t: 0
		});
		this.nextWaveTimer = dur + 18;
		if (WW2$1) {
			this.nextWaveTimer += STARVED_WAIT * Math.max(0, .5 - this.foeSupply) * 2;
			this.foeSupply = Math.max(0, this.foeSupply - WAVE_SUPPLY);
		}
	}
	/** Sandbox: build a serpentine maze of maxed towers and flood it with enemies. */
	stress(count) {
		const pool = TOWERS.map((d, i) => d.size === 2 && !d.walkable && !d.manual && d.role !== "gate" ? i : -1).filter((i) => i >= 0);
		let wall = 0;
		for (let c = 5; c + 2 < COLS - 3; c += 4, wall++) {
			const gapTop = wall % 2 === 0;
			for (let r = 0; r + 2 <= ROWS; r += 2) {
				if (gapTop ? r < 4 : r >= ROWS - 4) continue;
				const t = this.place(pool[this.rng.int(pool.length)], c, r, true);
				if (t) t.level = Math.min(2, TOWERS[t.type].levels.length - 1);
			}
		}
		this.towerVersion++;
		const kinds = ENEMIES.map((e, k) => e.boss || e.fixed || e.supply ? -1 : k).filter((k) => k >= 0);
		const groups = kinds.map((kind) => ({
			kind,
			count: Math.floor(count / kinds.length),
			interval: 6 / (count / kinds.length),
			delay: 0
		}));
		this.spawners.push({
			wave: Math.max(this.wave, 1) + 12,
			groups,
			left: new Int32Array(groups.map((g) => g.count)),
			timer: new Float32Array(groups.length),
			t: 0
		});
	}
	spawnHero(level) {
		const route = this.map.routes[0];
		const f = this.fields[0];
		const ex = route.airTo[0];
		const ey = route.airTo[1];
		let cell = route.exit[route.exit.length >> 1];
		let bestD = Infinity;
		for (let i = 0; i < f.dist.length; i++) {
			if (this.blocked[i] || f.dist[i] < 5 || f.dist[i] >= 7) continue;
			const d = ((i % COLS + .5) * 20 - ex) ** 2 + (((i / COLS | 0) + .5) * 20 - ey) ** 2;
			if (d < bestD) {
				bestD = d;
				cell = i;
			}
		}
		const x = (cell % COLS + .5) * 20;
		const y = ((cell / COLS | 0) + .5) * 20;
		const src = {
			id: -1,
			type: 0,
			kind: "gun",
			level: 0,
			col: 0,
			row: 0,
			size: 1,
			x,
			y,
			cd: 0,
			angle: 0,
			prevAngle: 0,
			mode: 3,
			beam: -1,
			recoil: 0,
			spent: 0,
			kills: 0,
			damage: 0,
			open: false,
			charge: 0,
			spin: 0,
			heat: 0,
			firing: 0,
			rangeMult: 1,
			rateMult: 1,
			dmgMult: 1,
			airBonus: 1,
			combos: [],
			owner: 0,
			hp: 0,
			wreck: false,
			supp: 0,
			trainKind: -1,
			trainT: 0,
			seenT: 0,
			knownT: 0,
			buildT: 0,
			build0: 0,
			base: 0,
			ammo: 1,
			shakeT: 0,
			nadeCd: 0,
			fix: 0,
			fromG: -1
		};
		level = Math.min(10, level);
		this.hero = {
			x,
			y,
			px: x,
			py: y,
			ang: 0,
			pang: 0,
			path: [],
			level,
			xp: 0,
			cd: [
				0,
				0,
				0
			],
			fireCd: 0,
			rallyT: 0,
			hp: this.heroMaxHp(level),
			downT: 0,
			homeX: x,
			homeY: y,
			src
		};
	}
	/** WW2: the commander's hit points at a level. */
	heroMaxHp(level = this.hero?.level ?? 1) {
		return 90 + 15 * (level - 1);
	}
	/** XP needed to reach the next level. */
	heroNextXp(level) {
		return Math.round(40 * Math.pow(level, 1.5));
	}
	heroRange() {
		return 110 + 4 * (this.hero?.level ?? 1);
	}
	heroDamage() {
		return 10 * (1 + .2 * ((this.hero?.level ?? 1) - 1));
	}
	/** Walk to a point: shortest path over walkable cells (4-way BFS). */
	heroMove(x, y) {
		const h = this.hero;
		if (!h || h.downT > 0) return false;
		const goal = Math.floor(y / 20) * COLS + Math.floor(x / 20);
		const start = Math.floor(h.y / 20) * COLS + Math.floor(h.x / 20);
		if (goal < 0 || goal >= this.blocked.length || this.blocked[goal]) return false;
		const prev = new Int32Array(COLS * ROWS).fill(-1);
		const queue = new Int32Array(COLS * ROWS);
		let head = 0;
		let tail = 0;
		queue[tail++] = start;
		prev[start] = start;
		while (head < tail && prev[goal] < 0) {
			const i = queue[head++];
			const c = i % COLS;
			for (const j of [
				c > 0 ? i - 1 : -1,
				c < COLS - 1 ? i + 1 : -1,
				i - COLS,
				i + COLS
			]) {
				if (j < 0 || j >= prev.length || prev[j] >= 0 || this.blocked[j]) continue;
				prev[j] = i;
				queue[tail++] = j;
			}
		}
		if (prev[goal] < 0) return false;
		const path = [];
		for (let i = goal; i !== start; i = prev[i]) path.push(i);
		h.path = path.reverse();
		return true;
	}
	heroAbility(a, x, y) {
		const h = this.hero;
		if (!h || h.downT > 0 || a < 0 || a > 2 || h.cd[a] > 0) return false;
		const power = 1 + .15 * (h.level - 1);
		if (WW2$1) {
			if (!this.ww2Ability(a, x, y, power)) return false;
		} else if (a === 0) {
			const dx = x - h.x;
			const dy = y - h.y;
			const d = Math.hypot(dx, dy) || 1;
			const px = -dy / d;
			const py = dx / d;
			for (let k = -3; k <= 3; k++) this.strikes.push({
				x: x + px * k * 26,
				y: y + py * k * 26,
				t: .9 + (k + 3) * .08,
				dmg: 140 * power * (1 + .1 * this.wave),
				r: 40,
				src: h.src,
				pen: 60
			});
			this.streak(x - px * 400, y - py * 400, 120, x + px * 400, y + py * 400, 120, 1.2, 12634320, 2);
		} else if (a === 1) {
			h.rallyT = 8;
			this.fx(3, 1, h.x, h.y, 0, 0, .6, 10, 320, .8, 16767050, 0, 0);
		} else {
			if (Math.hypot(x - h.x, y - h.y) > 260) return false;
			this.forEachInRange(x, y, 70, false, true, (i) => {
				this.eStunT[i] = 2.5;
			});
			this.explosion(x, y, .6, 4);
			this.fx(3, 1, x, y, 0, 0, .4, 10, 140, 1, 16773280, 0, 0);
			this.ev(9, x, y, 3);
		}
		h.cd[a] = heroAbilities()[a].cd;
		this.ev(13, x, y, a);
		return true;
	}
	/** WW2 abilities: a fire mission, holding the line (rally), a recon flight. */
	ww2Ability(a, x, y, power) {
		const h = this.hero;
		x = Math.min(MAP_W, Math.max(0, x));
		y = Math.min(MAP_H, Math.max(0, y));
		if (a === 0) {
			const dmg = 120 * power * (1 + .1 * this.wave);
			for (let k = 0; k < 10; k++) {
				const ang = this.rng.next() * TWO_PI;
				const r = Math.sqrt(this.rng.next()) * 85;
				this.strikes.push({
					x: x + Math.cos(ang) * r,
					y: y + Math.sin(ang) * r,
					t: 1.4 + k * .16,
					dmg,
					r: 42,
					src: h.src,
					pen: 45
				});
			}
		} else if (a === 1) {
			h.rallyT = 8;
			for (const t of this.towers) if ((t.x - h.x) ** 2 + (t.y - h.y) ** 2 < 25600) t.supp = 0;
			this.fx(3, 1, h.x, h.y, 0, 0, .6, 10, 320, .8, 16767050, 0, 0);
		} else {
			const from = x < MAP_W / 2 ? -200 : MAP_W + 200;
			this.streak(from, y - 120, 140, 2 * x - from, y + 120, 140, 1.4, 15265524, 1.5);
			this.forEachInRange(x, y, 180, true, true, (i) => {
				this.eMarkT[i] = 20 + 2 * (h.level - 1);
			});
			this.fx(3, 1, x, y, 0, 0, .8, 20, 360, .7, 10475775, 0, 0);
		}
		return true;
	}
	updateHero() {
		const h = this.hero;
		if (!h) return;
		h.px = h.x;
		h.py = h.y;
		h.pang = h.ang;
		for (let k = 0; k < 3; k++) if (h.cd[k] > 0) h.cd[k] = Math.max(0, h.cd[k] - DT);
		if (h.rallyT > 0) h.rallyT -= DT;
		if (h.downT > 0) {
			if ((h.downT -= .016666666666666666) > 0) return;
			h.downT = 0;
			h.x = h.px = h.src.x = h.homeX;
			h.y = h.py = h.src.y = h.homeY;
			h.hp = this.heroMaxHp();
			this.fx(3, 1, h.x, h.y, 0, 0, .5, 6, 60, 1, 16767050, 0, 0);
		}
		if (WW2$1) h.hp = Math.min(this.heroMaxHp(), h.hp + 1.5 * DT);
		if (h.path.length) {
			const next = h.path[0];
			if (this.blocked[next]) {
				const goal = h.path[h.path.length - 1];
				h.path = [];
				this.heroMove((goal % COLS + .5) * 20, ((goal / COLS | 0) + .5) * 20);
			} else {
				const tx = (next % COLS + .5) * 20;
				const ty = ((next / COLS | 0) + .5) * 20;
				const dx = tx - h.x;
				const dy = ty - h.y;
				const d = Math.hypot(dx, dy);
				const step = 95 * DT;
				if (d <= step) {
					h.x = tx;
					h.y = ty;
					h.path.shift();
				} else {
					h.x += dx / d * step;
					h.y += dy / d * step;
				}
				h.ang += angleDiff(h.ang, Math.atan2(dy, dx)) * Math.min(1, 12 * DT);
			}
		}
		h.src.x = h.x;
		h.src.y = h.y;
		h.fireCd -= DT;
		const tgt = this.findTarget(h.x, h.y, this.heroRange(), true, true, 0, -1, 0, WW2$1 ? HERO_PEN : 0, false, this.heroRange(), WW2$1 ? 2 : 0);
		if (tgt < 0) return;
		if (!h.path.length) h.ang += angleDiff(h.ang, Math.atan2(this.eY[tgt] - h.y, this.eX[tgt] - h.x)) * Math.min(1, 14 * DT);
		if (h.fireCd > 0) return;
		h.fireCd = 1 / 3;
		const ca = Math.cos(h.ang);
		const sa = Math.sin(h.ang);
		this.spawnProjectile(0, h.x + ca * 8, h.y + sa * 8, ca, sa, 900, this.heroDamage(), 0, 1, tgt, h.src, 1);
		this.fx(0, 1, h.x + ca * 9, h.y + sa * 9, 0, 0, .06, 8, 3, .9, 16770976, 0, 10);
		this.ev(0, h.x, h.y, 0);
	}
	gainHeroXp(xp) {
		const h = this.hero;
		if (h.level >= 10) return;
		h.xp += xp;
		while (h.level < 10 && h.xp >= this.heroNextXp(h.level)) {
			h.xp -= this.heroNextXp(h.level);
			h.level++;
			h.hp += 15;
			this.ev(11, h.x, h.y, h.level);
			this.fx(3, 1, h.x, h.y, 0, 0, .5, 6, 60, 1, 16767050, 0, 0);
		}
	}
	useItem(item, x, y) {
		if (item < 0 || item > 2 || this.items[item] <= 0) return false;
		x = Math.min(MAP_W, Math.max(0, x));
		y = Math.min(MAP_H, Math.max(0, y));
		if (item === 0) {
			const dmg = 120 * (1 + .12 * this.wave);
			for (let k = 0; k < 8; k++) {
				const a = this.rng.next() * TWO_PI;
				const r = Math.sqrt(this.rng.next()) * 90;
				this.strikes.push({
					x: x + Math.cos(a) * r,
					y: y + Math.sin(a) * r,
					t: .6 + k * .18,
					dmg,
					r: 45,
					src: null,
					pen: 30
				});
			}
		} else if (item === 1) {
			const mine = towerIndex("mine");
			let placed = 0;
			for (let tries = 0; tries < 40 && placed < 6; tries++) {
				const a = this.rng.next() * TWO_PI;
				const r = Math.sqrt(this.rng.next()) * 70;
				if (this.place(mine, Math.floor((x + Math.cos(a) * r) / 20), Math.floor((y + Math.sin(a) * r) / 20), true)) placed++;
			}
			if (!placed) return false;
		} else {
			this.money += 40 + 15 * this.wave;
			this.burst(x, y, 16767050, 14, 0, 1);
		}
		this.items[item]--;
		this.ev(12, x, y, item);
		return true;
	}
	updateStrikes() {
		for (let k = this.strikes.length - 1; k >= 0; k--) {
			const st = this.strikes[k];
			if ((st.t -= .016666666666666666) > 0) continue;
			this.splash(st.x, st.y, st.r, st.dmg, 1, 0, st.src, true, st.pen ?? -1);
			this.explosion(st.x, st.y, 1.4, 0);
			this.strikes.splice(k, 1);
		}
	}
	/** Rebuilds the breach fields: emplacements cost their strength to break through; obstacles without HP stay solid. */
	refreshBreach() {
		this.breachVersion = this.towerVersion;
		for (let i = 0; i < this.blocked.length; i++) {
			this.breachBlocked[i] = this.blocked[i];
			this.breachCost[i] = this.moveCost[i];
		}
		for (const t of this.towers) {
			const max = this.maxHp(t);
			if (!max || t.wreck || TOWERS[t.type].walkable) continue;
			const k = max * (1 + this.fortOf(t) / 25) / t.size;
			for (const c of this.cellsOf(t)) {
				this.breachBlocked[c] = 0;
				this.breachCost[c] = this.moveCost[c] + k;
			}
		}
		for (const f of this.breach) f.compute(this.breachBlocked, this.blocked);
		this.footBlocked.set(this.blocked);
		this.footCost.set(this.moveCost);
		this.hasTeeth = false;
		for (const t of this.towers) {
			if (TOWERS[t.type].slot !== "teeth" || t.wreck) continue;
			this.hasTeeth = true;
			for (const c of this.cellsOf(t)) {
				this.footBlocked[c] = 0;
				this.footCost[c] = this.moveCost[c] / TEETH_CLIMB;
			}
		}
		if (this.hasTeeth) for (const f of this.foot) f.compute(this.footBlocked);
	}
	/** Attackers that can break a wall: tanks with HE, sappers with satchel charges. */
	canBreach(def) {
		if (this.hpMult < .9) return false;
		return !def.air && !!def.gun && (def.gun.fx === "tank" || def.gun.fx === "satchel");
	}
	/**
	* The assault decision: when the maze makes the way round much longer than smashing through the
	* cheapest wall, a tank or sapper goes for the wall (and drops the idea if it gets stuck too long).
	*/
	thinkBreach(i, def, cell) {
		const r = this.eRoute[i];
		const around = this.fields[r].dist[cell];
		const through = this.breach[r].dist[cell];
		if (through === Infinity) {
			this.eBreach[i] = 0;
			return;
		}
		const slack = (def.gun.fx === "satchel" ? 10 : 50) / this.hpMult ** 2;
		if (!this.eBreach[i]) {
			if (around - through > slack) {
				this.eBreach[i] = 1;
				this.eBreachT[i] = 0;
			}
		} else if (around <= through + 2 || this.eBreachT[i] > 25) {
			this.eBreach[i] = 0;
			this.eWall[i] = 0;
		}
	}
	/** Removes a tower without paying for it (sappers lifting mines and cutting wire). */
	demolish(t) {
		this.loseCaptured(t);
		const i = this.towers.indexOf(t);
		if (i >= 0) this.towers.splice(i, 1);
		this.towerById.delete(t.id);
		this.setFootprint(t, -1);
		for (const f of this.fields) f.compute(this.blocked);
		this.towerVersion++;
		this.burst(t.x, t.y, 9077104, 8, 1, 0);
	}
	/** Sappers clear mines and wire they walk over, a second or so each. */
	sapperWork(i) {
		const c = Math.floor(this.eX[i] / 20);
		const r = Math.floor(this.eY[i] / 20);
		if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
		if (this.hulkGrid[r * COLS + c]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
			const k = (r + dy) * COLS + c + dx;
			if (c + dx >= 0 && c + dx < COLS && r + dy >= 0 && r + dy < ROWS && this.hulkGrid[k] === 1 && this.clearHulk(k, .1)) return;
		}
		const id = this.towerAt[r * COLS + c];
		const t = id >= 0 ? this.towerById.get(id) : void 0;
		if (!t || t.kind !== "mine" && t.kind !== "wire") {
			this.eWork[i] = 0;
			return;
		}
		if ((this.eWork[i] += .016666666666666666) >= 1.4) {
			this.eWork[i] = 0;
			this.demolish(t);
		}
	}
	/** A tank under anti-tank fire screens itself with smoke: guns can't pick targets inside it except point-blank. */
	popSmoke(i) {
		this.eSmokeUsed[i] = 1;
		if (this.smCount >= 64) return;
		const k = this.smCount++;
		this.smX[k] = this.eX[i] + Math.cos(this.eAng[i]) * 14;
		this.smY[k] = this.eY[i] + Math.sin(this.eAng[i]) * 14;
		this.smT[k] = SMOKE_T;
		for (let n = 0; n < 6; n++) this.fx(1, 0, this.smX[k], this.smY[k], this.vr.range(-50, 50), this.vr.range(-50, 50), 1.6, 10, 40, .8, 15263968, 1.2, 6);
	}
	updateSmoke() {
		for (let k = this.smCount - 1; k >= 0; k--) {
			if ((this.smT[k] -= .016666666666666666) <= 0) {
				const last = --this.smCount;
				this.smX[k] = this.smX[last];
				this.smY[k] = this.smY[last];
				this.smT[k] = this.smT[last];
				continue;
			}
			if ((this.ticks + k * 5) % 8 === 0) {
				const a = this.vr.next() * TWO_PI;
				const r = this.vr.next() * 40 * .8;
				this.fx(1, 0, this.smX[k] + Math.cos(a) * r, this.smY[k] + Math.sin(a) * r, this.vr.range(-8, 8), this.vr.range(-8, 8), 2.4, 18, 44, .55, 14474452, .6, 8);
			}
		}
		for (let n = 0; n < this.liveCount; n++) {
			const i = this.live[n];
			let inside = 0;
			for (let k = 0; k < this.smCount && !inside; k++) if ((this.eX[i] - this.smX[k]) ** 2 + (this.eY[i] - this.smY[k]) ** 2 <= 1600) inside = 1;
			this.eSmoked[i] = inside;
		}
	}
	/**
	* Artillery preparation before an armoured assault: shells on the positions the enemy already
	* knows about (anything not hidden), the most valuable first.
	*/
	barrage(n) {
		const known = this.towers.filter((t) => !t.wreck && t.hp > 0 && !this.towerHidden(t)).sort((a, b) => b.spent - a.spent || a.id - b.id);
		if (!known.length) return;
		const shells = Math.min(512 - this.rkCount, 6 + Math.floor(n / 3));
		const from = this.map.routes[0].airFrom;
		const dmg = 38 * (.6 + .4 * this.hpMult);
		for (let k = 0; k < shells; k++) {
			const t = known[Math.min(known.length - 1, Math.floor(this.rng.next() * this.rng.next() * known.length))];
			const r = this.rkCount++;
			const a = this.rng.next() * TWO_PI;
			const d = Math.sqrt(this.rng.next()) * 34;
			this.rkSx[r] = from[0];
			this.rkSy[r] = from[1];
			this.rkTx[r] = t.x + Math.cos(a) * d;
			this.rkTy[r] = t.y + Math.sin(a) * d;
			this.rkWait[r] = 2 + k * .35;
			this.rkT[r] = this.rkT0[r] = 1.6;
			this.rkDmg[r] = dmg;
			this.rkShell[r] = 1;
		}
		this.ev(15, from[0], from[1], ENEMY_FX.indexOf("barrage"));
	}
	/**
	* Adaptive waves: the attacker brings what counters the defence it has seen. Many anti-tank guns
	* mean more infantry; many machine guns, more armour; no flak, aircraft.
	*/
	adapt(n, groups) {
		let at = 0;
		let mg = 0;
		let aa = 0;
		let total = 0;
		for (const t of this.towers) {
			const d = TOWERS[t.type];
			if (t.wreck || !d.hitsGround && !d.hitsAir) continue;
			total++;
			const lv = d.levels[t.level];
			if (d.role === "at") at++;
			else if (lv.supp && (d.role === "gun" || d.role === "bunker")) mg++;
			if (d.hitsAir && d.airMult >= 1) aa++;
		}
		if (total < 6) return groups;
		const lean = (mg - at) / total;
		const arm = Math.min(1.4, Math.max(.7, 1 + .6 * lean));
		const inf = Math.min(1.4, Math.max(.7, 1 - .6 * lean));
		const out = groups.map((g) => {
			const e = ENEMIES[g.kind];
			const f = e.inf ? inf : !e.air && e.arm && e.arm[0] >= 40 ? arm : 1;
			return f === 1 ? g : {
				...g,
				count: Math.max(1, Math.round(g.count * f))
			};
		});
		if (n >= 6 && aa === 0) {
			const il2 = ENEMIES.findIndex((e) => e.air && e.gun && !e.gun.air);
			if (il2 >= 0) out.push({
				kind: il2,
				count: 1 + Math.round(n * .15),
				interval: 1.5,
				delay: 4
			});
		}
		return out;
	}
	/** Slot of the unit with this uid, or -1. */
	unitSlot(uid) {
		for (let u = 0; u < 192; u++) if (this.uAlive[u] && this.uUid[u] === uid) return u;
		return -1;
	}
	/** Manpower: what the HQs and depots can field, and what is in use or in training. */
	get manpowerCap() {
		let n = 6;
		for (const t of this.towers) if (!t.wreck) n += t.kind === "command" ? 4 : t.kind === "depot" ? 2 : 0;
		return n;
	}
	get manpowerUsed() {
		let n = 0;
		for (let u = 0; u < 192; u++) if (this.uAlive[u]) n += UNITS[this.uKind[u]].manpower;
		for (const t of this.towers) if (t.trainKind >= 0) n += UNITS[t.trainKind].manpower;
		return n;
	}
	/** Why unit `kind` can't be trained at tower t right now ('' if it can). */
	trainBlock(t, kind) {
		const d = UNITS[kind];
		if (!d || d.from !== t.kind || t.wreck) return "invalid";
		if (t.trainKind >= 0) return "busy";
		if (this.manpowerUsed + d.manpower > this.manpowerCap) return "manpower";
		if (this.money < d.cost) return "money";
		return "";
	}
	train(t, kind) {
		if (this.trainBlock(t, kind)) return false;
		const d = UNITS[kind];
		this.money -= d.cost;
		t.trainKind = kind;
		t.trainT = d.train;
		return true;
	}
	/** Is unit u hidden from the enemy: camouflaged or in ambush, standing still and not just fired? */
	unitHidden(u) {
		return (!!UNITS[this.uKind[u]].camo || this.uStance[u] === 3 || this.uDig[u] >= 1) && this.uSeenT[u] <= 0 && this.uKnownT[u] <= 0 && this.uPathI[u] >= this.uPathLen[u];
	}
	spawnUnit(kind, x, y, cell) {
		let u = 0;
		while (u < 192 && this.uAlive[u]) u++;
		if (u === 192) return -1;
		const d = UNITS[kind];
		this.uAlive[u] = 1;
		this.uUid[u] = this.nextUnitUid++;
		this.uKind[u] = kind;
		this.uAir[u] = d.air ? 1 : 0;
		this.uX[u] = this.uPx[u] = this.uPostX[u] = x;
		this.uY[u] = this.uPy[u] = this.uPostY[u] = y;
		this.uAng[u] = this.uPang[u] = -Math.PI / 2;
		this.uHp[u] = d.hp;
		this.uCd[u] = 0;
		this.uTgt[u] = -1;
		this.uStance[u] = 1;
		this.uPathLen[u] = this.uPathI[u] = 0;
		this.uGoal[u] = d.air ? -1 : cell;
		this.uOrder[u] = 0;
		this.uSupp[u] = 0;
		this.uShakeT[u] = 0;
		this.uNadeCd[u] = 0;
		this.uLife[u] = 0;
		this.uSeenT[u] = 0;
		this.uKnownT[u] = 0;
		this.uKills[u] = 0;
		this.uTask[u] = -1;
		this.uDig[u] = 0;
		this.uLay[u] = -1;
		this.uWork[u] = 0;
		this.unitVersion++;
		return u;
	}
	killUnit(u) {
		const d = UNITS[this.uKind[u]];
		this.uAlive[u] = 0;
		this.unitVersion++;
		this.shakeDefence(this.uX[u], this.uY[u], d.truck ? .3 : .6);
		if (d.arm || d.air || d.truck) this.explosion(this.uX[u], this.uY[u], 1.4, d.air ? 34 : 4);
		else this.burst(this.uX[u], this.uY[u], 9058858, 5, 1, 0);
	}
	/** A shot at unit u from (sx, sy): armour by the side facing the shooter, as for our guns against theirs. */
	hitUnit(u, dmg, pen, supp, top, sx, sy) {
		if (!this.uAlive[u]) return;
		const d = UNITS[this.uKind[u]];
		let a = dmg;
		if (d.arm) {
			let armour;
			if (top) armour = d.arm[3];
			else if (this.uDig[u] >= 1) armour = d.arm[0];
			else {
				const rel = Math.abs(angleDiff(this.uAng[u], Math.atan2(sy - this.uY[u], sx - this.uX[u])));
				armour = rel < Math.PI / 4 ? d.arm[0] : rel > Math.PI * 3 / 4 ? d.arm[2] : d.arm[1];
			}
			const r = armour > 0 ? pen / armour : 9;
			a = r >= 1 ? dmg : r < .7 ? 0 : dmg * .25 * ((r - .7) / .3);
			if (a <= 0 && dmg >= 20 && !top) this.fx(2, 1, this.uX[u], this.uY[u], this.vr.range(-120, 120), this.vr.range(-120, 120), .25, 6, 1, 1, 16769184, 4, 8);
		} else if (d.inf) {
			const dug = this.uDig[u] >= 1;
			this.uSupp[u] = Math.min(1, this.uSupp[u] + supp * (dug ? .5 : 1) * (1 - .2 * this.unitVet(u)));
			a *= (1 - .35 * this.uSupp[u]) * (dug ? .5 : 1);
			const c = Math.floor(this.uY[u] / 20) * COLS + Math.floor(this.uX[u] / 20);
			if (c >= 0 && c < COLS * ROWS && this.hulkGrid[c]) a *= HULK_COVER;
		}
		a *= 1 - .08 * this.unitVet(u);
		if (a <= 0) return;
		this.uHp[u] -= a;
		if (this.uHp[u] <= 0) this.killUnit(u);
	}
	/**
	* Breadth-first path (4-way) from unit u to the first walkable cell inside the rectangle
	* [c0..c1]×[r0..r1] that is not inside the excluded one (a tower's own footprint). Writes the
	* path into the unit's buffer; returns false if no cell can be reached.
	*/
	unitPathTo(u, c0, r0, c1, r1, ex0 = -1, ey0 = -1, ex1 = -2, ey1 = -2) {
		const start = Math.floor(this.uY[u] / 20) * COLS + Math.floor(this.uX[u] / 20);
		if (start < 0 || start >= COLS * ROWS) return false;
		const prev = this.bfsPrev;
		const q = this.bfsQ;
		prev.fill(-1);
		let head = 0;
		let tail = 0;
		q[tail++] = start;
		prev[start] = start;
		let goal = -1;
		const isGoal = (i) => {
			const c = i % COLS;
			const r = i / COLS | 0;
			return c >= c0 && c <= c1 && r >= r0 && r <= r1 && !(c >= ex0 && c <= ex1 && r >= ey0 && r <= ey1);
		};
		while (head < tail) {
			const i = q[head++];
			if (isGoal(i) && !this.blocked[i]) {
				goal = i;
				break;
			}
			const c = i % COLS;
			const n0 = c > 0 ? i - 1 : -1;
			const n1 = c < COLS - 1 ? i + 1 : -1;
			const n2 = i - COLS;
			const n3 = i + COLS;
			if (n0 >= 0 && prev[n0] < 0 && !this.blocked[n0]) {
				prev[n0] = i;
				q[tail++] = n0;
			}
			if (n1 >= 0 && prev[n1] < 0 && !this.blocked[n1]) {
				prev[n1] = i;
				q[tail++] = n1;
			}
			if (n2 >= 0 && prev[n2] < 0 && !this.blocked[n2]) {
				prev[n2] = i;
				q[tail++] = n2;
			}
			if (n3 < COLS * ROWS && prev[n3] < 0 && !this.blocked[n3]) {
				prev[n3] = i;
				q[tail++] = n3;
			}
		}
		if (goal < 0) return false;
		let len = 0;
		for (let i = goal; i !== start; i = prev[i]) len++;
		const n = Math.min(len, 160);
		const base = u * 160;
		let k = len;
		for (let i = goal; i !== start; i = prev[i]) {
			k--;
			if (k < n) this.uPath[base + k] = i;
		}
		this.uPathLen[u] = n;
		this.uPathI[u] = 0;
		this.uGoal[u] = goal;
		return true;
	}
	/** Walk to the cell under (x, y), or as near as it gets. */
	unitGoto(u, x, y, near = 0) {
		const c = Math.floor(x / 20);
		const r = Math.floor(y / 20);
		return this.unitPathTo(u, c - near, r - near, c + near, r + near);
	}
	/** Player order: the selected units walk to (x, y) in a loose formation, and guard there. */
	unitMove(ids, x, y) {
		x = Math.min(MAP_W - 1, Math.max(0, x));
		y = Math.min(MAP_H - 1, Math.max(0, y));
		let k = 0;
		for (const id of ids) {
			const u = this.unitSlot(id);
			if (u < 0 || UNITS[this.uKind[u]].truck) continue;
			const side = Math.ceil(Math.sqrt(ids.length));
			const ox = (k % side - (side - 1) / 2) * 16;
			const oy = (Math.floor(k / side) - (side - 1) / 2) * 16;
			k++;
			this.uPostX[u] = x + ox;
			this.uPostY[u] = y + oy;
			if (this.uAir[u]) continue;
			if (this.unitGoto(u, x + ox, y + oy, 1)) {
				this.uOrder[u] = 1;
				this.uTask[u] = -1;
			}
		}
		return k > 0;
	}
	updateUnits() {
		for (let u = 0; u < 192; u++) {
			if (!this.uAlive[u]) continue;
			this.uPx[u] = this.uX[u];
			this.uPy[u] = this.uY[u];
			this.uPang[u] = this.uAng[u];
			if (this.uSeenT[u] > 0) this.uSeenT[u] -= DT;
			if (this.uKnownT[u] > 0) this.uKnownT[u] -= DT;
			if (this.uSupp[u] > 0) this.uSupp[u] = Math.max(0, this.uSupp[u] - (this.uShakeT[u] > 0 ? .2 : .45) * DT);
			if (this.uShakeT[u] > 0) this.uShakeT[u] -= DT;
			if (this.uCd[u] > 0) this.uCd[u] -= DT * (1 - .5 * this.uSupp[u]);
			if (this.uAir[u]) this.updatePlane(u);
			else this.updateGroundUnit(u);
		}
	}
	/** Fw 190s: fly to the patrol point, circle it, dive on aircraft first, then soft ground targets. */
	updatePlane(u) {
		const d = UNITS[this.uKind[u]];
		const g = d.gun;
		if ((this.uLife[u] -= .016666666666666666) <= 0) {
			this.uAlive[u] = 0;
			this.unitVersion++;
			return;
		}
		const px = this.uPostX[u];
		const py = this.uPostY[u];
		let t = this.uTgt[u];
		if (t >= 0 && (!this.eAlive[t] || this.eUid[t] !== this.uTuid[u])) t = -1;
		if ((this.ticks + u) % 10 === 0) {
			t = this.findTarget(px, py, 200, true, false, 3);
			if (t < 0) {
				t = this.findTarget(px, py, 160, false, true, 3);
				if (t >= 0 && ENEMIES[this.eKind[t]].arm && ENEMIES[this.eKind[t]].arm[3] > g.pen) t = -1;
			}
			this.uTgt[u] = t;
			if (t >= 0) this.uTuid[u] = this.eUid[t];
		}
		const x = this.uX[u];
		const y = this.uY[u];
		let wx;
		let wy;
		if (t >= 0) {
			wx = this.eX[t];
			wy = this.eY[t];
		} else {
			const a = this.time * 1.4 + u;
			wx = px + Math.cos(a) * 70;
			wy = py + Math.sin(a) * 70;
		}
		const want = Math.atan2(wy - y, wx - x);
		const da = angleDiff(this.uAng[u], want);
		this.uAng[u] += Math.max(-3 * DT, Math.min(3 * DT, da));
		this.uX[u] = x + Math.cos(this.uAng[u]) * d.speed * DT;
		this.uY[u] = y + Math.sin(this.uAng[u]) * d.speed * DT;
		if (t >= 0 && this.uCd[u] <= 0 && Math.abs(da) < .35 && (wx - x) ** 2 + (wy - y) ** 2 <= g.range * g.range) this.unitFire(u, t, 1);
	}
	updateGroundUnit(u) {
		const d = UNITS[this.uKind[u]];
		const g = d.gun;
		const think = (this.ticks + u * 7) % 15 === 0;
		let moving = this.uPathI[u] < this.uPathLen[u];
		const x = this.uX[u];
		const y = this.uY[u];
		const stance = this.uStance[u];
		if (moving && this.uDig[u] > 0) this.uDig[u] = 0;
		else if (this.uDig[u] > 0 && this.uDig[u] < 1) this.uDig[u] = Math.min(1, this.uDig[u] + DT / DIG_TIME);
		const dug = this.uDig[u] > 0;
		if (d.truck) {
			this.truckWork(u);
			if (!this.uAlive[u]) return;
			moving = this.uPathI[u] < this.uPathLen[u];
		}
		if (this.uLay[u] >= 0) this.layMine(u, moving);
		else if ((d.repair || d.heal) && !this.uOrder[u] && think) this.supportTask(u, d.repair ? "repair" : "heal");
		if (d.repair && this.uTask[u] >= 0) this.doRepair(u, d.repair);
		else if (d.repair && this.uTask[u] <= -1e3) this.doClear(u);
		if (d.heal) this.doHeal(u, d.heal);
		let t = this.uTgt[u];
		if (t >= 0 && (!this.eAlive[t] || this.eUid[t] !== this.uTuid[u])) t = this.uTgt[u] = -1;
		if (g && think) {
			const look = (stance === 2 ? HUNT_RANGE : stance === 1 ? g.range + GUARD_LEASH * .6 : g.range) * this.dimMult;
			t = this.findTarget(x, y, look, !!g.hitsAir, true, 3, -1, 0, g.pen, false, g.range, 2);
			this.uTgt[u] = t;
			if (t >= 0) this.uTuid[u] = this.eUid[t];
			if (!this.uOrder[u] && this.uTask[u] < 0 && this.uLay[u] < 0 && !dug) {
				const tx = t >= 0 ? this.eX[t] : 0;
				const ty = t >= 0 ? this.eY[t] : 0;
				const d2 = t >= 0 ? (tx - x) ** 2 + (ty - y) ** 2 : 0;
				const leash = (tx - this.uPostX[u]) ** 2 + (ty - this.uPostY[u]) ** 2 <= (GUARD_LEASH + g.range * .5) ** 2;
				if (t >= 0 && d2 > (g.range * .85) ** 2 && (stance === 2 || stance === 1 && leash)) this.unitGoto(u, tx, ty, Math.max(1, Math.floor(g.range * .6 / 20)));
				else if (t >= 0 && d2 <= g.range * g.range && g.still) this.uPathLen[u] = this.uPathI[u];
				else if (t < 0 && stance === 1 && (x - this.uPostX[u]) ** 2 + (y - this.uPostY[u]) ** 2 > 196 && !moving) this.unitGoto(u, this.uPostX[u], this.uPostY[u]);
			}
			moving = this.uPathI[u] < this.uPathLen[u];
		}
		if (moving) {
			const base = u * 160;
			const next = this.uPath[base + this.uPathI[u]];
			if (this.blocked[next]) {
				const goal = this.uGoal[u];
				this.uPathLen[u] = 0;
				if (goal >= 0) this.unitPathTo(u, goal % COLS, goal / COLS | 0, goal % COLS, goal / COLS | 0);
			} else {
				const jx = this.uUid[u] * 37 % 9 - 4;
				const jy = this.uUid[u] * 53 % 9 - 4;
				const tx = (next % COLS + .5) * 20 + jx;
				const ty = ((next / COLS | 0) + .5) * 20 + jy;
				const dx = tx - x;
				const dy = ty - y;
				const dist = Math.hypot(dx, dy);
				let sp = d.speed * this.groundSlow[Math.min(COLS * ROWS - 1, Math.max(0, Math.floor(y / 20) * COLS + Math.floor(x / 20)))] * this.weatherSpeed(!!d.inf);
				if (d.inf) sp *= 1 - .5 * this.uSupp[u];
				const step = sp * DT;
				if (dist <= step) {
					this.uX[u] = tx;
					this.uY[u] = ty;
					if (++this.uPathI[u] >= this.uPathLen[u]) {
						const goal = this.uGoal[u];
						const here = Math.floor(ty / 20) * COLS + Math.floor(tx / 20);
						if (goal >= 0 && goal !== here && this.uPathLen[u] === 160) this.unitPathTo(u, goal % COLS, goal / COLS | 0, goal % COLS, goal / COLS | 0);
						else this.uOrder[u] = 0;
					}
				} else {
					this.uX[u] = x + dx / dist * step;
					this.uY[u] = y + dy / dist * step;
				}
				const turn = d.arm ? 3 : 10;
				this.uAng[u] += Math.max(-turn * DT, Math.min(turn * DT, angleDiff(this.uAng[u], Math.atan2(dy, dx))));
				moving = this.uPathI[u] < this.uPathLen[u];
			}
		}
		if (d.inf && g) {
			if (this.uNadeCd[u] > 0) this.uNadeCd[u] -= DT;
			else if ((this.ticks + u) % 15 === 0) {
				const src = this.unitSrc;
				src.x = this.uX[u];
				src.y = this.uY[u];
				this.proxyRange = g.range;
				this.proxySupp = 0;
				this.proxyInf = true;
				if (this.closeAssault(src.x, src.y, 32, src)) this.uNadeCd[u] = ASSAULT_CD;
			}
		}
		if (!g || t < 0) return;
		const tx = this.eX[t];
		const ty = this.eY[t];
		const d2 = (tx - x) ** 2 + (ty - y) ** 2;
		if (d2 > (g.range * this.dimMult) ** 2) return;
		if (g.still && moving) return;
		const want = Math.atan2(ty - y, tx - x);
		if (!moving) {
			const turn = d.arm ? 1.6 : 10;
			this.uAng[u] += Math.max(-turn * DT, Math.min(turn * DT, angleDiff(this.uAng[u], want)));
			if (d.arm && Math.abs(angleDiff(this.uAng[u], want)) > .25) return;
		}
		if (this.uCd[u] > 0) return;
		let bonus = 1;
		if (this.unitHidden(u)) {
			const flank = !!ENEMIES[this.eKind[t]].arm && Math.abs(angleDiff(this.eAng[t], Math.atan2(y - ty, x - tx))) > Math.PI / 4;
			if (stance === 3 && !flank && d2 > (g.range * .6) ** 2) return;
			bonus = 1.5;
		}
		this.unitFire(u, t, bonus);
	}
	unitFire(u, t, bonus) {
		const d = UNITS[this.uKind[u]];
		const g = d.gun;
		const x = this.uX[u];
		const y = this.uY[u];
		const tx = this.eX[t];
		const ty = this.eY[t];
		const vet = this.unitVet(u);
		this.uCd[u] = 1 / (g.rate * (1 + .1 * vet));
		this.uSeenT[u] = d.camo ? 2.5 : 1.5;
		const src = this.unitSrc;
		src.x = x;
		src.y = y;
		this.proxyRange = g.range;
		this.proxySupp = g.supp ?? 0;
		this.proxyInf = !!d.inf;
		const airMult = this.eAir[t] ? g.hitsAir ? 1 : 0 : 1;
		if (airMult > 0 && this.damage(t, g.dmg * bonus * airMult * (1 + .15 * vet), false, src, false, g.pen, false)) {
			if (++this.uKills[u] === VET_KILLS[vet]) this.ev(11, x, y, -1);
		}
		const z = this.uAir[u] ? 34 : d.inf ? 6 : 10;
		const tz = this.eAir[t] ? 40 : 6;
		const big = g.dmg >= 50;
		const ca = Math.cos(this.uAng[u]);
		const sa = Math.sin(this.uAng[u]);
		const r = d.radius;
		this.fx(0, 1, x + ca * r, y + sa * r, 0, 0, .07, big ? 16 : 6, big ? 6 : 2, .9, 16770976, 0, z);
		this.streak(x + ca * r, y + sa * r, z, tx, ty, tz, big ? .12 : .07, 16769184, big ? 2 : .9);
		if (big) for (let k = 0; k < 3; k++) this.fx(1, 0, x + ca * r, y + sa * r, ca * 40 + this.vr.range(-20, 20), sa * 40 + this.vr.range(-20, 20), .8, 6, 18, .45, 11052186, 3, z);
		this.ev(18, x, y, this.uKind[u]);
	}
	/** Veterancy rank 0-3 from kills: hits harder, reloads faster, takes less damage. */
	unitVet(u) {
		const k = this.uKills[u];
		return k >= VET_KILLS[2] ? 3 : k >= VET_KILLS[1] ? 2 : k >= VET_KILLS[0] ? 1 : 0;
	}
	/** Player order: dig in (foxholes for soldiers, hull-down for tanks), or climb out if all are dug in already. */
	unitDig(ids) {
		const us = ids.map((id) => this.unitSlot(id)).filter((u) => u >= 0 && !this.uAir[u] && UNITS[this.uKind[u]].gun);
		if (!us.length) return false;
		const out = us.every((u) => this.uDig[u] > 0);
		for (const u of us) if (out) this.uDig[u] = 0;
		else if (this.uDig[u] <= 0) {
			this.uDig[u] = .001;
			this.uPathLen[u] = this.uPathI[u];
			this.uOrder[u] = 0;
			this.uPostX[u] = this.uX[u];
			this.uPostY[u] = this.uY[u];
		}
		return true;
	}
	/** Player order: the selected engineers each bury an anti-tank mine around (x, y), paid as one built there. */
	unitMines(ids, x, y) {
		let k = 0;
		for (const id of ids) {
			const u = this.unitSlot(id);
			if (u < 0 || !UNITS[this.uKind[u]].repair) continue;
			const side = 3;
			const c = Math.floor(x / 20) + (k % side - 1);
			const r = Math.floor(y / 20) + Math.floor(k / side) % side - 1;
			k++;
			if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
			if (!this.unitPathTo(u, c, r, c, r)) continue;
			this.uLay[u] = r * COLS + c;
			this.uWork[u] = 0;
			this.uTask[u] = -1;
			this.uOrder[u] = 1;
			this.uDig[u] = 0;
		}
		return k > 0;
	}
	/** An engineer on a mine-laying order: walk to the cell, dig for a while, place the mine. */
	layMine(u, moving) {
		const cell = this.uLay[u];
		const c = cell % COLS;
		const r = cell / COLS | 0;
		const cx = (c + .5) * 20;
		const cy = (r + .5) * 20;
		if (moving) return;
		if ((this.uX[u] - cx) ** 2 + (this.uY[u] - cy) ** 2 > 324) {
			this.uLay[u] = -1;
			return;
		}
		this.uWork[u] += DT;
		if ((this.ticks + u) % 15 === 0) this.fx(1, 0, cx + this.vr.range(-5, 5), cy + this.vr.range(-5, 5), 0, -10, .6, 4, 8, .5, 9073752, 0, 2);
		if (this.uWork[u] < LAY_TIME) return;
		this.uLay[u] = -1;
		this.uOrder[u] = 0;
		this.uPostX[u] = this.uX[u];
		this.uPostY[u] = this.uY[u];
		const mine = TOWERS.findIndex((d) => d.slot === "atmine");
		if (mine < 0 || !this.place(mine, c, r)) this.ev(14, cx, cy, 0);
	}
	/** Engineers and medics look for work near their post (Hold: only within reach). */
	supportTask(u, what) {
		const reach = this.uStance[u] === 0 ? 40 : this.uStance[u] === 2 ? HUNT_RANGE : 210;
		const ox = this.uStance[u] === 2 ? this.uX[u] : this.uPostX[u];
		const oy = this.uStance[u] === 2 ? this.uY[u] : this.uPostY[u];
		let best = -1;
		let bestD = reach * reach;
		if (what === "repair") {
			if (this.uTask[u] >= 0) {
				const cur = this.towerById.get(this.uTask[u]);
				if (cur && cur.hp < this.maxHp(cur)) return;
			}
			let pick = null;
			for (const t of this.towers) {
				const max = this.maxHp(t);
				if (!max || t.hp >= max) continue;
				const d2 = (t.x - ox) ** 2 + (t.y - oy) ** 2;
				if (d2 < bestD) {
					bestD = d2;
					pick = t;
				}
			}
			this.uTask[u] = pick ? pick.id : -1;
			if (pick) this.unitPathTo(u, pick.col - 1, pick.row - 1, pick.col + pick.size, pick.row + pick.size, pick.col, pick.row, pick.col + pick.size - 1, pick.row + pick.size - 1);
			else if (this.uTask[u] <= -1e3 && this.hulkGrid[-this.uTask[u] - HULK_TASK] === 1) return;
			else if (this.pickHulk(u, ox, oy, bestD)) return;
			else if (this.uStance[u] !== 2 && (this.uX[u] - this.uPostX[u]) ** 2 + (this.uY[u] - this.uPostY[u]) ** 2 > 196 && this.uPathI[u] >= this.uPathLen[u]) this.unitGoto(u, this.uPostX[u], this.uPostY[u]);
			return;
		}
		for (let v = 0; v < 192; v++) {
			if (v === u || !this.uAlive[v] || !UNITS[this.uKind[v]].inf || this.uHp[v] >= UNITS[this.uKind[v]].hp) continue;
			const d2 = (this.uX[v] - ox) ** 2 + (this.uY[v] - oy) ** 2;
			if (d2 < bestD) {
				bestD = d2;
				best = v;
			}
		}
		const h = this.hero;
		if (h && h.downT <= 0 && h.hp < this.heroMaxHp() && (h.x - ox) ** 2 + (h.y - oy) ** 2 < bestD) best = -2;
		this.uTask[u] = best;
		if (best === -2) this.unitGoto(u, h.x, h.y, 1);
		else if (best >= 0) this.unitGoto(u, this.uX[best], this.uY[best], 1);
	}
	/** Engineers with nothing to repair go for the nearest hulk within reach of their post, to clear it. */
	pickHulk(u, ox, oy, reach2) {
		let best = -1;
		for (let h = 0; h < this.hkCount; h++) {
			const c = this.hkCell[h];
			const d2 = ((c % COLS + .5) * 20 - ox) ** 2 + (((c / COLS | 0) + .5) * 20 - oy) ** 2;
			if (d2 < reach2) {
				reach2 = d2;
				best = c;
			}
		}
		if (best < 0) return false;
		const col = best % COLS;
		const row = best / COLS | 0;
		if (!this.unitPathTo(u, col - 1, row - 1, col + 1, row + 1, col, row, col, row)) return false;
		this.uTask[u] = -1e3 - best;
		return true;
	}
	/** Engineers clearing a hulk they stand next to. */
	doClear(u) {
		const c = -this.uTask[u] - HULK_TASK;
		const x = (c % COLS + .5) * 20;
		const y = ((c / COLS | 0) + .5) * 20;
		if ((x - this.uX[u]) ** 2 + (y - this.uY[u]) ** 2 > 1024) return;
		if (!this.clearHulk(c, .016666666666666666)) this.uTask[u] = -1;
		else if ((this.ticks + u) % 12 === 0) this.fx(2, 1, x + this.vr.range(-6, 6), y + this.vr.range(-6, 6), this.vr.range(-40, 40), -40, .3, 3, 1, 1, 16765040, 4, 8);
	}
	/** Engineers at work: hit points back, and rubble raised again once it is a third rebuilt. */
	doRepair(u, rate) {
		const t = this.towerById.get(this.uTask[u]);
		if (!t) {
			this.uTask[u] = -1;
			return;
		}
		const reach = t.size * 20 * .5 + 16;
		if ((t.x - this.uX[u]) ** 2 + (t.y - this.uY[u]) ** 2 > reach * reach) return;
		const max = this.maxHp(t);
		t.hp = Math.min(max, t.hp + rate * DT);
		if ((this.ticks + u) % 12 === 0) this.fx(2, 1, t.x + this.vr.range(-8, 8), t.y + this.vr.range(-8, 8), this.vr.range(-40, 40), -40, .3, 3, 1, 1, 16765040, 4, 8);
		if (t.wreck && t.hp >= max * .35) {
			const wall = !TOWERS[t.type].walkable && !t.open;
			if (wall && this.wallStatus(this.cellsOf(t)) !== "ok") return;
			t.wreck = false;
			this.setFootprint(t, t.id);
			if (wall) for (let k = 0; k < this.fields.length; k++) this.fields[k].copyFrom(this.scratch[k]);
			this.towerVersion++;
			this.burst(t.x, t.y, 10129272, t.size * 4, 1, 0);
			this.ev(4, t.x, t.y, t.type);
		}
		if (t.hp >= max) this.uTask[u] = -1;
	}
	/** Medics patch up every soldier (and the commander) close by. */
	doHeal(u, rate) {
		const x = this.uX[u];
		const y = this.uY[u];
		let any = false;
		for (let v = 0; v < 192; v++) {
			if (!this.uAlive[v] || !UNITS[this.uKind[v]].inf) continue;
			const max = UNITS[this.uKind[v]].hp;
			if (this.uHp[v] >= max || (this.uX[v] - x) ** 2 + (this.uY[v] - y) ** 2 > 900) continue;
			this.uHp[v] = Math.min(max, this.uHp[v] + rate * DT);
			any = true;
		}
		const h = this.hero;
		if (h && h.downT <= 0 && h.hp < this.heroMaxHp() && (h.x - x) ** 2 + (h.y - y) ** 2 <= 900) {
			h.hp = Math.min(this.heroMaxHp(), h.hp + rate * DT);
			any = true;
		}
		if (any && (this.ticks + u) % 20 === 0) this.fx(0, 1, x, y, 0, -20, .4, 8, 4, .8, 7012218, 0, 10);
	}
	/** A barracks or motor pool finishing a unit: it walks out next to the building. */
	finishTraining(t) {
		if ((t.trainT -= .016666666666666666) > 0) return;
		const kind = t.trainKind;
		let cell = -1;
		for (let ring = 1; ring < 4 && cell < 0; ring++) for (let r = t.row - ring; r <= t.row + t.size - 1 + ring && cell < 0; r++) for (let c = t.col - ring; c <= t.col + t.size - 1 + ring; c++) {
			if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
			const i = r * COLS + c;
			if (!this.blocked[i] && this.map.grid[i] !== 3) {
				cell = i;
				break;
			}
		}
		const u = cell < 0 ? -1 : this.spawnUnit(kind, (cell % COLS + .5) * 20, ((cell / COLS | 0) + .5) * 20, cell);
		if (u < 0) {
			t.trainT = 1;
			return;
		}
		t.trainKind = -1;
		t.trainT = 0;
		this.burst(this.uX[u], this.uY[u], 10129272, 6, 1, 0);
		this.ev(4, this.uX[u], this.uY[u], t.type);
	}
	/** WW2: Katyusha rockets come down on whatever stands around the impact (from above: open tops). */
	updateRockets() {
		for (let r = this.rkCount - 1; r >= 0; r--) {
			if (this.rkWait[r] > 0) {
				if ((this.rkWait[r] -= .016666666666666666) <= 0) this.fx(0, 1, this.rkSx[r], this.rkSy[r], 0, 0, .1, 14, 6, .9, 16756832, 0, 14);
				continue;
			}
			if ((this.rkT[r] -= .016666666666666666) > 0) continue;
			const x = this.rkTx[r];
			const y = this.rkTy[r];
			const dmg = this.rkDmg[r];
			for (const t of this.towers) {
				if (t.wreck || t.hp <= 0) continue;
				const rr = 30 + t.size * 20 * .5;
				if ((t.x - x) ** 2 + (t.y - y) ** 2 <= rr * rr) this.hitDefender(t.id, dmg, 30, .35, true);
			}
			const h = this.hero;
			if (h && (h.x - x) ** 2 + (h.y - y) ** 2 <= 900) this.hitDefender(-1, dmg, 0, 0, true);
			for (let u = 0; u < 192; u++) if (this.uAlive[u] && !this.uAir[u] && (this.uX[u] - x) ** 2 + (this.uY[u] - y) ** 2 <= 900) this.hitUnit(u, dmg, 30, .35, true, x, y);
			this.explosion(x, y, .8, 0);
			const last = --this.rkCount;
			if (r !== last) {
				this.rkSx[r] = this.rkSx[last];
				this.rkSy[r] = this.rkSy[last];
				this.rkTx[r] = this.rkTx[last];
				this.rkTy[r] = this.rkTy[last];
				this.rkWait[r] = this.rkWait[last];
				this.rkT[r] = this.rkT[last];
				this.rkT0[r] = this.rkT0[last];
				this.rkDmg[r] = this.rkDmg[last];
				this.rkShell[r] = this.rkShell[last];
			}
		}
	}
	/** Strikes still on their way, for the renderer (incoming markers). */
	get pendingStrikes() {
		return this.strikes;
	}
	step() {
		if (this.gameOver) return;
		this.time += DT;
		this.ticks++;
		this.refreshAuras();
		this.updateSpawners();
		if (WW2$1 && this.breachVersion !== this.towerVersion) this.refreshBreach();
		this.updateEnemies();
		this.hash.build(this.live, this.liveCount, this.eX, this.eY);
		this.updateTowers();
		if (WW2$1) {
			if (this.smCount) this.updateSmoke();
			this.updateUnits();
			if (this.ticks % 10 === 0) this.updateSpotting();
			if (this.ticks % SUPPLY_TICKS === 0) this.updateSupply();
			if (this.ticks % SIGHT_TICKS === 0 || this.towerSightVersion !== this.towerVersion) this.updateSight();
		}
		this.updateHero();
		this.updateStrikes();
		if (this.rkCount) this.updateRockets();
		this.updateZones();
		this.updateDrones();
		this.updateProjectiles();
		this.updateFx();
		this.updateBolts();
		this.updateStreaks();
		this.compactLive();
		if (!this.spawning && this.canCallWave && this.wave > 0) {
			this.nextWaveTimer -= DT;
			if (this.nextWaveTimer <= 0) {
				this.nextWaveTimer = 0;
				this.startNextWave();
			}
		}
		if (WW2$1) {
			if (this.hkCount) this.updateHulks();
			if (this.flCount) this.updateFlares();
			this.updateGarrison();
			this.updateConvoy();
			this.lives = Math.ceil(100 * this.baseHealth);
		}
		if (WW2$1 && !this.siege && this.wave >= this.totalWaves && !this.spawning) this.reliefT += DT;
		if (!this.endless && !this.siege && this.wave >= this.totalWaves && !this.spawning && (this.attackers === 0 || this.reliefT >= RELIEF_T) && !this.victory) this.victory = true;
	}
	updateSpawners() {
		for (let s = this.spawners.length - 1; s >= 0; s--) {
			const sp = this.spawners[s];
			sp.t += DT;
			let pending = 0;
			for (let g = 0; g < sp.groups.length; g++) {
				if (sp.left[g] <= 0) continue;
				pending++;
				const grp = sp.groups[g];
				if (sp.t < grp.delay) continue;
				sp.timer[g] -= DT;
				while (sp.timer[g] <= 0 && sp.left[g] > 0) {
					this.spawnEnemy(grp.kind, sp.wave);
					sp.left[g]--;
					sp.timer[g] += grp.interval;
				}
			}
			if (pending === 0) this.spawners.splice(s, 1);
		}
	}
	spawnEnemy(kind, wave) {
		if (this.eFreeTop === 0) return -1;
		const i = this.eFree[--this.eFreeTop];
		const def = ENEMIES[kind];
		const routeIdx = this.spawnCount++ % this.map.routes.length;
		const route = this.map.routes[routeIdx];
		this.eAlive[i] = 1;
		this.eUid[i] = this.nextUid++;
		this.eKind[i] = kind;
		this.eAir[i] = def.air ? 1 : 0;
		this.eRoute[i] = routeIdx;
		this.eMaxHp[i] = this.eHp[i] = def.hp * hpScale(wave) * this.hpMult;
		this.eMaxShield[i] = this.eShield[i] = (def.shield ?? 0) * this.eMaxHp[i];
		this.eShieldCd[i] = 0;
		this.eHealCd[i] = 1;
		this.eStealth[i] = def.stealth ? 1 : 0;
		this.eSeen[i] = 0;
		this.eJam[i] = 0;
		this.eBurnT[i] = this.eBurn[i] = 0;
		this.eBurnBy[i] = null;
		this.eShred[i] = this.eShredT[i] = 0;
		this.eChill[i] = this.eFrozenT[i] = 0;
		this.eHackT[i] = 0;
		this.eStunT[i] = 0;
		this.eSupp[i] = 0;
		this.eMarkT[i] = 0;
		this.eSeenT[i] = 0;
		this.eMorale[i] = 1;
		this.eRetreat[i] = 0;
		this.eLead[i] = -1;
		this.eHunt[i] = 0;
		this.eEscortN[i] = 0;
		this.eEscort[i] = 0;
		this.eWave[i] = wave;
		this.ePinT[i] = 0;
		if (def.officer) this.officerAlive[wave & 63] = 1;
		this.eGar[i] = -1;
		this.eBuild[i] = 0;
		this.eNadeCd[i] = 0;
		this.eTgt[i] = 0;
		this.eAimT[i] = 0;
		this.eBreach[i] = 0;
		this.eWall[i] = 0;
		this.eBreachT[i] = 0;
		this.eSmokeUsed[i] = 0;
		this.eSmoked[i] = 0;
		this.eWork[i] = 0;
		this.eGunCd[i] = def.gun ? this.rng.range(.3, 1) / def.gun.rate : 0;
		this.eSpeed[i] = def.speed * this.rng.range(.94, 1.06) * (this.battle?.foeSpeed ?? 1);
		this.eReward[i] = Math.round(def.reward * rewardScale(wave) * this.bountyMult);
		this.eSlowT[i] = 0;
		this.eSlowF[i] = 1;
		this.eFlash[i] = 0;
		const [ix, iy] = route.inDir;
		const jitter = def.boss ? 0 : 6;
		this.eOx[i] = this.rng.range(-jitter, jitter);
		this.eOy[i] = this.rng.range(-jitter, jitter);
		let x;
		let y;
		if (def.air) {
			const side = this.rng.range(-30, 30);
			x = route.airFrom[0] - iy * side;
			y = route.airFrom[1] + ix * side;
		} else {
			const cell = route.entry[this.rng.int(route.entry.length)];
			this.eCell[i] = cell;
			x = (cell % COLS + .5) * 20 - ix * 20 * 1.5 + this.eOx[i];
			y = ((cell / COLS | 0) + .5) * 20 - iy * 20 * 1.5 + this.eOy[i];
		}
		this.eX[i] = this.ePx[i] = x;
		this.eY[i] = this.ePy[i] = y;
		this.eAng[i] = this.ePang[i] = Math.atan2(iy, ix);
		this.eRemain[i] = 1e6;
		this.live[this.liveCount++] = i;
		if (def.supply) this.convoyAlive++;
		return i;
	}
	freeEnemy(i) {
		const g = this.eGar[i];
		if (g >= 0) {
			this.eGar[i] = -1;
			this.gSlot[g] = -1;
			this.garrisonAlive--;
			const fixed = ENEMIES[this.gKind[g]].fixed;
			if (fixed === "hq") this.victory = true;
			else this.gT[g] = GARRISON_REBUILD;
			if (fixed === "depot") this.foeSupply = Math.max(0, this.foeSupply - .4);
		}
		if (ENEMIES[this.eKind[i]].supply) this.convoyAlive--;
		if (ENEMIES[this.eKind[i]].officer) this.officerAlive[this.eWave[i] & 63] = 0;
		const lead = this.eLead[i];
		if (lead >= 0 && this.eAlive[lead] && this.eUid[lead] === this.eLeadUid[i] && this.eEscortN[lead] > 0) this.eEscortN[lead]--;
		this.eLead[i] = -1;
		this.eAlive[i] = 0;
		this.eBurnBy[i] = null;
		this.eFree[this.eFreeTop++] = i;
	}
	/** WW2: an aircraft over our headquarters drops what it carries on it and flies home. */
	overBase(i, def) {
		const t = this.towerById.get(this.bases[this.eRoute[i]]);
		if (t && !t.wreck && def.gun && !def.gun.air) {
			this.hitDefender(t.id, def.gun.dmg * 2 * (.6 + .4 * this.hpMult), def.gun.pen, def.gun.supp, true, this.eX[i], this.eY[i]);
			this.explosion(t.x + this.vr.range(-10, 10), t.y + this.vr.range(-10, 10), 1.3, 4);
		}
		this.freeEnemy(i);
	}
	leak(i) {
		this.lives -= ENEMIES[this.eKind[i]].lives;
		this.leakedThisWave++;
		this.ev(3, this.eX[i], this.eY[i], this.eKind[i]);
		this.burst(Math.min(MAP_W, Math.max(0, this.eX[i])), Math.min(MAP_H, Math.max(0, this.eY[i])), 16734778, 6, 0, 1);
		this.freeEnemy(i);
		if (this.lives <= 0) {
			this.lives = 0;
			this.gameOver = true;
		}
	}
	/** Units that towers may pick: alive, not hacked, and visible. */
	targetable(i) {
		return this.eAlive[i] === 1 && this.eHackT[i] <= 0 && (this.eStealth[i] === 0 || this.eSeen[i] === 1);
	}
	/** Is a stealth unit hidden from the player right now (render)? */
	hidden(i) {
		return this.eStealth[i] === 1 && this.eSeen[i] === 0;
	}
	setSlow(i, f, time) {
		if (f < this.eSlowF[i] || this.eSlowT[i] <= 0) this.eSlowF[i] = f;
		this.eSlowT[i] = Math.max(this.eSlowT[i], time);
	}
	ignite(i, dps, time, src) {
		if (this.eAir[i]) return;
		const arm = ENEMIES[this.eKind[i]].arm;
		if (WW2$1 && arm && arm[3] > 8) return;
		if (dps >= this.eBurn[i] || this.eBurnT[i] <= 0) {
			this.eBurn[i] = dps;
			this.eBurnBy[i] = src;
		}
		this.eBurnT[i] = Math.max(this.eBurnT[i], time);
	}
	chill(i, amount) {
		if (this.eFrozenT[i] > 0) return;
		const boss = ENEMIES[this.eKind[i]].boss;
		this.eChill[i] = Math.min(boss ? .6 : 1, this.eChill[i] + (boss ? amount * .4 : amount));
		if (this.eChill[i] >= 1) {
			this.eChill[i] = 0;
			this.eFrozenT[i] = 1.6;
			this.ev(9, this.eX[i], this.eY[i], 0);
			this.fx(3, 1, this.eX[i], this.eY[i], 0, 0, .3, 6, 30, .8, 12580095, 0, 0);
		}
	}
	/** Moves a ground unit by (dx,dy) unless that would put it inside a wall. */
	shove(i, dx, dy) {
		const steps = Math.ceil(Math.hypot(dx, dy) / 4) || 1;
		for (let s = 0; s < steps; s++) {
			const nx = this.eX[i] + dx / steps;
			const ny = this.eY[i] + dy / steps;
			const c = Math.floor(nx / 20);
			const r = Math.floor(ny / 20);
			if (c < 0 || r < 0 || c >= COLS || r >= ROWS || this.blocked[r * COLS + c]) return;
			this.eX[i] = nx;
			this.eY[i] = ny;
		}
	}
	updateEnemies() {
		const margin = 30;
		for (let n = 0; n < this.liveCount; n++) {
			const i = this.live[n];
			if (!this.eAlive[i]) continue;
			const x = this.ePx[i] = this.eX[i];
			const y = this.ePy[i] = this.eY[i];
			this.ePang[i] = this.eAng[i];
			if (this.eFlash[i] > 0) this.eFlash[i] -= DT * 6;
			let gc = Math.floor(x / 20);
			let gr = Math.floor(y / 20);
			gc = gc < 0 ? 0 : gc >= COLS ? COLS - 1 : gc;
			gr = gr < 0 ? 0 : gr >= ROWS ? ROWS - 1 : gr;
			const g = this.eGCell[i] = gr * COLS + gc;
			this.eSeen[i] = this.radarGrid[g];
			if (this.eSeenT[i] > 0) this.eSeenT[i] -= DT;
			if (this.eMarkT[i] > 0) {
				this.eMarkT[i] -= DT;
				this.eSeen[i] = 1;
			}
			const jam = this.eJam[i] = this.jamGrid[g];
			const air = this.eAir[i] === 1;
			const def = ENEMIES[this.eKind[i]];
			if (this.eMaxShield[i] > 0) {
				if (jam > 0) this.eShield[i] = 0;
				else if ((this.eShieldCd[i] += .016666666666666666) > 2) this.eShield[i] = Math.min(this.eMaxShield[i], this.eShield[i] + this.eMaxShield[i] * .25 * DT);
			}
			if (def.heal && jam === 0 && (this.eHealCd[i] -= .016666666666666666) <= 0) {
				this.eHealCd[i] = 2;
				const m = this.hash.query(x, y, 70, this.qbuf);
				for (let k = 0; k < m; k++) {
					const j = this.qbuf[k];
					if (!this.eAlive[j] || this.eHp[j] >= this.eMaxHp[j]) continue;
					if ((this.eX[j] - x) ** 2 + (this.eY[j] - y) ** 2 > 4900) continue;
					this.eHp[j] = Math.min(this.eMaxHp[j], this.eHp[j] + this.eMaxHp[j] * def.heal);
					this.fx(0, 1, this.eX[j], this.eY[j], 0, -20, .4, 10, 4, .8, 7012218, 0, 10);
				}
				this.fx(3, 1, x, y, 0, 0, .4, 8, 140, .5, 7012218, 0, 0);
			}
			if (this.eBurnT[i] > 0) {
				this.eBurnT[i] -= DT;
				if ((this.ticks + i & 7) === 0) this.fx(0, 1, x + this.vr.range(-4, 4), y + this.vr.range(-4, 4), this.vr.range(-8, 8), -10, .35, 8, 3, .9, this.vr.next() < .5 ? 16742938 : 16760896, 1, 8);
				if (this.damage(i, this.eBurn[i] * .016666666666666666, true, this.eBurnBy[i], false, 999, true)) continue;
			}
			if (!air && this.spikeGrid[g] > 0 && this.damage(i, this.spikeGrid[g] * .016666666666666666, true, this.spikeSrc[g])) continue;
			if (this.eShredT[i] > 0 && (this.eShredT[i] -= .016666666666666666) <= 0) this.eShred[i] = 0;
			if (this.eChill[i] > 0) this.eChill[i] = Math.max(0, this.eChill[i] - .1 * DT);
			if (this.eFrozenT[i] > 0) this.eFrozenT[i] -= DT;
			if (def.fixed) {
				if (this.eBuild[i] > 0) {
					this.eBuild[i] -= DT;
					this.eHp[i] = Math.min(this.eMaxHp[i], this.eHp[i] + this.eMaxHp[i] * .8 * DT / GARRISON_BUILD);
				} else if (def.gun) this.enemyFire(i, def, def.gun);
				if ((this.eWork[i] += .016666666666666666) > GARRISON_QUIET) this.eHp[i] = Math.min(this.eMaxHp[i], this.eHp[i] + this.eMaxHp[i] * GARRISON_REPAIR * DT);
				continue;
			}
			if (def.supply) {
				this.driveConvoy(i, this.eSpeed[i] * (this.eSlowT[i] > 0 ? this.eSlowF[i] : 1) * (this.eStunT[i] > 0 ? 0 : 1));
				if (this.eStunT[i] > 0) this.eStunT[i] -= DT;
				if (this.eSlowT[i] > 0) this.eSlowT[i] -= DT;
				continue;
			}
			if (WW2$1 && def.inf && (this.ticks + i) % 10 === 0) {
				this.updateMorale(i, def);
				if (!this.eAlive[i]) continue;
			}
			if (this.eHackT[i] > 0) {
				this.eHackT[i] -= DT;
				if ((this.ticks + i) % 6 === 0) {
					const v = this.findTarget(x, y, 80, false, true, 3, i);
					if (v >= 0) {
						this.damage(v, this.eHackDps[i] * 6 * DT, false, null);
						this.streak(x, y, 8, this.eX[v], this.eY[v], 6, .08, 5963658, 1.2);
					}
				}
				continue;
			}
			let sp = this.eSpeed[i];
			if (WW2$1 && !air) {
				if (def.arm && (this.ticks + i) % 15 === 0) this.checkEscort(i, def);
				if (def.inf && !this.eRetreat[i]) {
					if (this.eLead[i] < 0 && (this.ticks + i) % 60 === 0 && this.escortKind(def)) this.findLeader(i);
					if (this.eLead[i] >= 0) sp *= this.escortPace(i);
				}
			}
			if (this.eSlowT[i] > 0) {
				sp *= this.eSlowF[i];
				this.eSlowT[i] -= DT;
				if (this.eSlowT[i] <= 0) this.eSlowF[i] = 1;
			}
			sp *= 1 - .5 * this.eChill[i];
			if (this.eFrozenT[i] > 0) sp = 0;
			if (this.eStunT[i] > 0) {
				this.eStunT[i] -= DT;
				sp = 0;
			}
			if (!air) sp *= this.tarGrid[g] * (WW2$1 ? this.weatherSpeed(!!def.inf) : 1);
			if (WW2$1 && def.gun && !this.eRetreat[i] && this.enemyFire(i, def, def.gun)) sp = 0;
			if (!this.eAlive[i]) continue;
			if (def.inf) {
				sp *= this.wireGrid[g];
				if (this.eSupp[i] > 0) {
					if (!def.banzai) sp *= 1 - .55 * this.eSupp[i];
					this.eSupp[i] = Math.max(0, this.eSupp[i] - .45 * DT);
				}
			}
			const route = this.map.routes[this.eRoute[i]];
			let tx;
			let ty;
			if (air) {
				tx = route.airTo[0];
				ty = route.airTo[1];
				const d = Math.hypot(tx - x, ty - y);
				this.eRemain[i] = d;
				if (d < sp * .016666666666666666 + 2) {
					if (WW2$1) this.overBase(i, def);
					else this.leak(i);
					continue;
				}
			} else {
				let cx = x / 20 | 0;
				let cy = y / 20 | 0;
				if (x < 0) cx = 0;
				else if (cx >= COLS) cx = COLS - 1;
				if (y < 0) cy = 0;
				else if (cy >= ROWS) cy = ROWS - 1;
				const retreat = this.eRetreat[i] === 1;
				let hunt = !retreat && this.eHunt[i] ? this.huntField(this.eHunt[i]) : null;
				if (hunt && hunt.dist[this.eCell[i]] === Infinity) hunt = null;
				if (this.eHunt[i] && !hunt) this.eHunt[i] = 0;
				const breaching = !retreat && !hunt && this.eBreach[i] === 1;
				const onFoot = this.hasTeeth && def.inf && !breaching && !retreat && !hunt;
				const field = retreat ? this.backField(this.eRoute[i]) : hunt ?? (breaching ? this.breach[this.eRoute[i]] : onFoot ? this.foot[this.eRoute[i]] : this.fields[this.eRoute[i]]);
				let cell = cy * COLS + cx;
				if ((onFoot ? this.footBlocked : this.blocked)[cell] || field.dist[cell] === Infinity) cell = this.eCell[i];
				else this.eCell[i] = cell;
				if (onFoot && this.blocked[cell]) sp *= TEETH_CLIMB;
				if (WW2$1 && !retreat && (this.ticks + i) % 60 === 0 && this.canBreach(def)) this.thinkBreach(i, def, cell);
				if (def.gun?.fx === "satchel" && (this.ticks + i) % 6 === 0) this.sapperWork(i);
				const dist = field.dist[cell];
				this.eRemain[i] = dist * 20;
				if (retreat) {
					this.eRemain[i] += 1e5;
					sp *= 1.15;
					if (dist === 0) {
						this.freeEnemy(i);
						continue;
					}
				}
				let wall = 0;
				if (breaching && dist > 0) {
					const nx = field.next[cell];
					if (nx >= 0 && this.blocked[nx]) {
						wall = this.towerAt[nx] >= 0 ? this.towerAt[nx] : 0;
						sp = 0;
						this.eBreachT[i] += DT;
					}
				}
				this.eWall[i] = wall;
				if (dist === 0 && WW2$1) {
					tx = x;
					ty = y;
				} else if (dist === 0) {
					tx = x + route.outDir[0] * 20 * 4;
					ty = y + route.outDir[1] * 20 * 4;
					if (x < -30 || y < -30 || x > MAP_W + margin || y > MAP_H + margin) {
						this.leak(i);
						continue;
					}
				} else {
					const nx = field.next[cell];
					tx = (nx % COLS + .5) * 20 + this.eOx[i];
					ty = ((nx / COLS | 0) + .5) * 20 + this.eOy[i];
				}
			}
			const dx = tx - x;
			const dy = ty - y;
			const len = Math.hypot(dx, dy) || 1;
			const step = Math.min(len, sp * DT);
			this.eX[i] = x + dx / len * step;
			this.eY[i] = y + dy / len * step;
			if (sp > 0) this.eAng[i] += angleDiff(this.eAng[i], Math.atan2(dy, dx)) * Math.min(1, 10 * DT);
		}
		if (this.ticks % 10 === 0) for (let n = 0; n < this.liveCount; n++) {
			const i = this.live[n];
			if (!this.eAlive[i] || this.eBurnT[i] <= .3) continue;
			const m = this.hash.query(this.eX[i], this.eY[i], 16, this.qbuf);
			for (let k = 0; k < m; k++) {
				const j = this.qbuf[k];
				if (j !== i && this.eAlive[j] && this.eBurnT[j] <= 0 && this.rng.next() < .35) this.ignite(j, this.eBurn[i] * .6, 2, this.eBurnBy[i]);
			}
		}
	}
	compactLive() {
		let w = 0;
		for (let n = 0; n < this.liveCount; n++) {
			const i = this.live[n];
			if (this.eAlive[i]) this.live[w++] = i;
		}
		this.liveCount = w;
	}
	/**
	* Applies damage; returns true if the enemy died. Shields soak first; armour (minus acid shred)
	* reduces non-piercing hits; jammed and frozen units take extra, and frozen ones shatter under splash.
	*/
	damage(i, amount, pierce, src, shatter = false, pen = -1, top = false) {
		if (!this.eAlive[i]) return false;
		let a = amount * (1 + this.eJam[i]);
		if (WW2$1) {
			if (this.eMarkT[i] > 0) a *= 1.2;
			a = this.ballistics(i, a, src, pen, top);
			if (a <= 0) return false;
			if (src && this.eEscort[i] === 0 && this.closeAssaulter(src) && ENEMIES[this.eKind[i]].arm && !this.eAir[i] && !ENEMIES[this.eKind[i]].fixed) a *= CLOSE_BONUS;
			pierce = true;
		}
		if (this.eFrozenT[i] > 0) a *= shatter ? 2.5 : 1.25;
		this.eFlash[i] = 1;
		if (this.eGar[i] >= 0) this.eWork[i] = 0;
		if (this.eShield[i] > 0) {
			const soak = Math.min(this.eShield[i], a);
			this.eShield[i] -= soak;
			this.eShieldCd[i] = 0;
			a -= soak;
			if (src) src.damage += soak;
			if (a <= 0) return false;
		}
		const armor = ENEMIES[this.eKind[i]].armor - this.eShred[i];
		const dmg = pierce ? a : Math.max(a - armor, a * .25);
		const dealt = Math.min(dmg, this.eHp[i]);
		this.eHp[i] -= dmg;
		if (src) {
			src.damage += dealt;
			this.waveDamage.set(src.id, (this.waveDamage.get(src.id) ?? 0) + dealt);
		}
		if (dmg >= 60 && dmg < 1e8) this.ev(8, this.eX[i], this.eY[i], dmg, shatter && this.eFrozenT[i] > 0 ? 1 : 0);
		if (this.eHp[i] > 0) return false;
		if (src) src.kills++;
		this.totalKills++;
		if (WW2$1) this.lossShock(i);
		const reward = Math.round(this.eReward[i] * (1 + this.salvageGrid[this.eGCell[i]]));
		this.money += reward;
		if (src && this.hero && src === this.hero.src) this.gainHeroXp(reward);
		this.ev(2, this.eX[i], this.eY[i], this.eKind[i], reward);
		const kind = this.eKind[i];
		if (WW2$1 && ENEMIES[kind].arm && !this.eAir[i] && !ENEMIES[kind].fixed) this.addHulk(i);
		const big = ENEMIES[kind].boss ? 3 : ENEMIES[kind].radius >= 10 ? 1.6 : ENEMIES[kind].inf ? .6 : 1.1;
		this.explosion(this.eX[i], this.eY[i], big, this.eAir[i] ? 34 : 4);
		this.freeEnemy(i);
		return true;
	}
	/** Level stats of a damage source (the commander stands in as a tower with id -1). */
	levelOf(src) {
		return src.id < 0 ? null : TOWERS[src.type].levels[src.level];
	}
	/**
	* WW2 rules for one hit: penetration against the armour of the side that was hit (front, side or
	* rear from the shooter's bearing to the hull's heading; top for blasts and bombs), falling off
	* with range. A shot that doesn't get through bounces off; a blast may still break a track.
	* Infantry are suppressed and, once pinned, harder to hit. Returns the damage that gets through.
	*/
	ballistics(i, a, src, pen, top) {
		const def = ENEMIES[this.eKind[i]];
		const lv = src ? this.levelOf(src) : null;
		if (def.arm) {
			if (pen < 0) pen = src ? lv?.pen ?? HERO_PEN : 0;
			if (def.fixed) {
				const r = pen / (top || !src ? def.arm[3] : def.arm[0]);
				return r >= 1 ? a : r >= .3 ? a * r * r : 0;
			}
			const range = !src ? 0 : lv ? lv.range * src.rangeMult : src === this.unitSrc ? this.proxyRange : this.heroRange();
			const r = this.penRatio(i, pen, top || !src, src?.x ?? 0, src?.y ?? 0, range);
			if (!top && pen >= 40 && def.arm[0] >= 40 && !this.eSmokeUsed[i] && this.rng.next() < .35) this.popSmoke(i);
			if (r < 1) {
				const big = a >= 20;
				if (top && big && this.eStunT[i] <= 0 && this.rng.next() < .12) {
					this.eStunT[i] = 1.5;
					this.ev(9, this.eX[i], this.eY[i], 6);
				}
				if (!top && big) {
					this.ev(9, this.eX[i], this.eY[i], 5);
					this.fx(2, 1, this.eX[i], this.eY[i], this.vr.range(-120, 120), this.vr.range(-120, 120), .25, 6, 1, 1, 16769184, 4, 8);
				}
				return r < .7 ? 0 : a * .25 * ((r - .7) / .3);
			}
			if (r >= 1.5 && a >= 20 && this.rng.next() < .12) {
				this.ev(9, this.eX[i], this.eY[i], 7);
				return a * 2.5;
			}
			return a;
		}
		if (def.inf) {
			if (this.hulkGrid[this.eGCell[i]]) a *= HULK_COVER;
			const supp = lv ? lv.supp ?? 0 : src === this.unitSrc ? this.proxySupp : 0;
			if (supp > 0) this.eSupp[i] = Math.min(1, this.eSupp[i] + supp);
			a *= 1 - .35 * this.eSupp[i];
		}
		return a;
	}
	/**
	* WW2: how a shot of `pen` mm fired from (sx, sy) by a gun of `range` px meets unit i's armour:
	* penetration (falling off with distance) over the armour of the side it hits — front, side or rear
	* from the bearing to the hull's heading, the top for blasts and bombs. 9 for soft targets.
	*/
	penRatio(i, pen, top, sx, sy, range) {
		const arm = ENEMIES[this.eKind[i]].arm;
		if (!arm) return 9;
		const armour = arm[top ? 3 : this.facing(i, sx, sy)];
		if (!top && range > 0) pen *= penFalloff(Math.hypot(sx - this.eX[i], sy - this.eY[i]) / range);
		return armour > 0 ? pen / armour : 9;
	}
	/** Which side of unit i faces (sx, sy): 0 front, 1 side, 2 rear (indexes into EnemyDef.arm). */
	facing(i, sx, sy) {
		const rel = Math.abs(angleDiff(this.eAng[i], Math.atan2(sy - this.eY[i], sx - this.eX[i])));
		return rel < Math.PI / 4 ? 0 : rel > Math.PI * 3 / 4 ? 2 : 1;
	}
	/**
	* WW2 targeting: can a weapon of this penetration, fired from (sx, sy), hurt unit i where it stands
	* now (the side it shows, at this distance)? The same rule as ballistics(), so crews don't fire
	* rounds that would bounce.
	*/
	canHurt(i, pen, top, sx, sy, range) {
		const def = ENEMIES[this.eKind[i]];
		const arm = def.arm;
		if (!arm) return true;
		if (def.fixed) return pen >= (top ? arm[3] : arm[0]) * .3;
		return this.penRatio(i, pen, top, sx, sy, range) >= HURT_RATIO;
	}
	/**
	* For the panel: why tower t isn't firing at something inside its circle, or '' if it is (or has
	* nothing there). Read-only: it runs the same tests as the targeting, between ticks.
	*/
	fireStatus(t) {
		const def = TOWERS[t.type];
		if (!def.targeted || def.manual || t.wreck || t.buildT > 0) return "";
		if (WW2$1 && t.mode === 5) return this.night > .3 ? "Firing flares over the attackers it hears coming: they light up the night for every gun." : "Flares at night; by day it fires as usual (First).";
		const lv = def.levels[t.level];
		const range = lv.range * t.rangeMult;
		const pen = WW2$1 ? lv.pen ?? 0 : 0;
		const top = !!lv.splash && t.kind !== "at";
		const spot = t.kind === "arty" ? 140 : 0;
		let inRange = 0;
		let unseen = 0;
		let blind = 0;
		let fog = 0;
		let dark = 0;
		let smoke = 0;
		const sight = !WW2$1 ? 0 : t.kind === "arty" || t.kind === "cannon" ? 3 : 1;
		const dim2 = sight === 1 ? (range * this.dimMult) ** 2 : Infinity;
		let armoured = -1;
		let armD = Infinity;
		for (let n = 0; n < this.liveCount; n++) {
			const i = this.live[n];
			if (!this.eAlive[i] || (this.eAir[i] ? !def.hitsAir : !def.hitsGround)) continue;
			const d2 = (this.eX[i] - t.x) ** 2 + (this.eY[i] - t.y) ** 2;
			if (d2 > range * range) continue;
			if (this.eStealth[i] && !this.eSeen[i] && d2 > 2025) continue;
			inRange++;
			if (d2 > dim2 && !this.eAir[i] && !this.litGrid[this.eGCell[i]]) dark++;
			else if (sight === 1 && !this.towerSees(t, i, range)) blind++;
			else if (sight === 3 && !this.seen(i)) fog++;
			else if (spot && d2 > spot * spot && !this.radarGrid[this.eGCell[i]] && this.eMarkT[i] <= 0) unseen++;
			else if (this.eSmoked[i] && d2 > 2500) smoke++;
			else if (pen > 0 && !this.canHurt(i, pen, top, t.x, t.y, range)) {
				if (d2 < armD) {
					armD = d2;
					armoured = i;
				}
			} else return t.mode === 4 && this.towerHidden(t) ? `Ambush: holding fire until a tank shows its flank or something comes within ${Math.round(range * .6)} px.` : "";
		}
		if (!inRange) return "";
		if (dark && dark === inRange) return `Too dark to see that far: ${dark} in range beyond ${Math.round(Math.sqrt(dim2))} px. A mortar firing flares would light them up.`;
		if (blind && blind === inRange) return `No line of sight: ${blind} in range behind trees, hills or ruins.`;
		if (fog && fog === inRange) return `Can't see them: ${fog} in range that nothing of ours has in sight (behind cover, or in the fog).`;
		if (unseen) return `Needs a spotter: ${unseen} in range that nobody sees. It fires at what an observation post sees, or within ${spot} px of itself.`;
		if (armoured >= 0) {
			const e = ENEMIES[this.eKind[armoured]];
			const side = top ? 3 : this.facing(armoured, t.x, t.y);
			const here = top ? pen : pen * penFalloff(Math.sqrt(armD) / range);
			return `Holding fire: the ${e.name}'s ${[
				"front",
				"side",
				"rear",
				"top"
			][side]} armour is too thick from here (${Math.round(here)} mm against ${e.arm[side]} mm). It waits for it to come closer or turn.`;
		}
		if (smoke) return "Holding fire: the targets in range are in smoke.";
		return "";
	}
	/**
	* Best target in range by targeting mode. `skip` excludes one slot; `spot` > 0 means the unit must
	* be within `spot` px or under radar cover (artillery). WW2: with `pen`, only what it can get
	* through from here (`gunRange`: the range its penetration falls off over, if not `range`). `sight`: WW2
	* line of sight — 1 what `sightTower` sees, 2 a clear line from (x, y), 3 anything we see (indirect fire).
	*/
	findTarget(x, y, range, air, ground, mode, skip = -1, spot = 0, pen = 0, top = false, gunRange = range, sight = 0) {
		const n = this.hash.query(x, y, range, this.qbuf);
		const r2 = range * range;
		let best = -1;
		let bestScore = -Infinity;
		for (let k = 0; k < n; k++) {
			const i = this.qbuf[k];
			if (i === skip || !this.eAlive[i] || this.eHackT[i] > 0) continue;
			if (this.eAir[i] ? !air : !ground) continue;
			const dx = this.eX[i] - x;
			const dy = this.eY[i] - y;
			const d2 = dx * dx + dy * dy;
			if (d2 > r2) continue;
			if (this.eStealth[i] && !this.eSeen[i] && d2 > 2025) continue;
			if (spot > 0 && d2 > spot * spot && !this.radarGrid[this.eGCell[i]] && this.eMarkT[i] <= 0) continue;
			if (this.eSmoked[i] && d2 > 2500) continue;
			if (pen > 0 && !this.canHurt(i, pen, top, x, y, gunRange)) continue;
			if (this.dimR2 && d2 > this.dimR2 && !this.litGrid[this.eGCell[i]] && !this.eAir[i]) continue;
			if (sight === 1 ? !this.towerSees(this.sightTower, i, range) : sight === 2 ? !this.eAir[i] && !this.clearLine(x, y, this.eX[i], this.eY[i]) : sight === 3 && !this.seen(i)) continue;
			let s;
			switch (mode) {
				case 0:
					s = -this.eRemain[i];
					break;
				case 1:
					s = this.eRemain[i];
					break;
				case 2:
					s = this.eHp[i] + this.eShield[i];
					break;
				default: s = -d2;
			}
			if (s > bestScore) {
				bestScore = s;
				best = i;
			}
		}
		return best;
	}
	aim(t, tx, ty) {
		const want = Math.atan2(ty - t.y, tx - t.x);
		const d = angleDiff(t.angle, want);
		const maxTurn = TURN_RATE * DT;
		t.angle += Math.abs(d) <= maxTurn ? d : Math.sign(d) * maxTurn;
		return Math.abs(d) < .3;
	}
	/** Point a moving target will be at when a projectile of `speed` arrives (one-step lead). */
	lead(i, fx, fy, speed) {
		const tt = Math.hypot(this.eX[i] - fx, this.eY[i] - fy) / speed;
		return [this.eX[i] + (this.eX[i] - this.ePx[i]) / DT * tt, this.eY[i] + (this.eY[i] - this.ePy[i]) / DT * tt];
	}
	/** Like lob(), but returns the projectile (or -1). */
	lobAt(kind, t, i, fx, fy, speed, dmg, splash) {
		const [ax, ay] = this.lead(i, fx, fy, speed);
		const d = Math.hypot(ax - fx, ay - fy) || 1;
		const p = this.spawnProjectile(kind, fx, fy, (ax - fx) / d, (ay - fy) / d, speed, dmg, splash, 0, i, t, d / speed);
		if (p >= 0) {
			this.pTx[p] = ax;
			this.pTy[p] = ay;
		}
		return p;
	}
	/** Fires a ballistic round at where target `i` will be. */
	lob(kind, t, i, fx, fy, speed, dmg, splash, extra = 0, extra2 = 0) {
		const [ax, ay] = this.lead(i, fx, fy, speed);
		const d = Math.hypot(ax - fx, ay - fy) || 1;
		const p = this.spawnProjectile(kind, fx, fy, (ax - fx) / d, (ay - fy) / d, speed, dmg, splash, 0, i, t, d / speed);
		if (p < 0) return;
		this.pTx[p] = ax;
		this.pTy[p] = ay;
		this.pExtra[p] = extra;
		this.pExtra2[p] = extra2;
	}
	muzzleFlash(x, y, size, color) {
		this.fx(0, 1, x, y, 0, 0, .07, size, size * .4, .9, color, 0, 16);
	}
	updateTowers() {
		for (const t of this.towers) {
			t.prevAngle = t.angle;
			if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - DT * 8);
			if (t.firing > 0) t.firing -= DT;
			t.beam = -1;
			if (t.wreck) {
				if ((this.ticks + t.id * 7) % 40 === 0) this.fx(1, 0, t.x + this.vr.range(-6, 6), t.y + this.vr.range(-6, 6), this.vr.range(-6, 6), -18, 2.2, 6, 26, .4, 4867648, 1, 6);
				continue;
			}
			if (t.buildT > 0) {
				const max = this.maxHp(t);
				t.hp = Math.min(max, t.hp + max * .8 * DT / t.build0);
				if ((t.buildT -= .016666666666666666) <= 0) {
					t.buildT = 0;
					this.ev(4, t.x, t.y, t.type);
				}
				continue;
			}
			if (t.supp > 0) t.supp = Math.max(0, t.supp - (t.shakeT > 0 ? .15 : .35) * DT);
			if (t.shakeT > 0) t.shakeT -= DT;
			t.cd -= DT * (1 - .5 * t.supp);
			if (WW2$1) {
				if (t.nadeCd > 0) t.nadeCd -= DT;
				else if ((this.ticks + t.id) % 15 === 0 && ASSAULT_SLOTS.has(TOWERS[t.type].slot ?? "") && this.closeAssault(t.x, t.y, t.size * 20 * .5 + 36, t)) t.nadeCd = ASSAULT_CD;
			}
			this.updateTower(t);
		}
	}
	/** WW2: our headquarters' garrison fires its machine guns at whatever comes close. */
	baseGuns(t) {
		this.sightTower = t;
		if ((t.charge -= .016666666666666666) <= 0) {
			const tank = this.findTarget(t.x, t.y, 180, false, true, 0, -1, 0, BASE_AT[1], false, TOWERS[t.type].levels[t.level].range * t.rangeMult, 1);
			if (tank >= 0 && ENEMIES[this.eKind[tank]].arm) {
				t.charge = BASE_AT[2];
				this.streak(t.x, t.y, 10, this.eX[tank], this.eY[tank], 8, .12, 16765056, 2);
				this.muzzleFlash(t.x, t.y, 16, 16756832);
				this.ev(0, t.x, t.y, TOWERS.findIndex((d) => d.slot === "atgun"));
				this.damage(tank, BASE_AT[0] * (1 + .04 * this.wave), false, t, false, BASE_AT[1]);
			} else t.charge = .5;
		}
		if (t.cd > 0) return;
		const tgt = this.findTarget(t.x, t.y, BASE_GUN_RANGE, false, true, 0, -1, 0, 0, false, BASE_GUN_RANGE, 1);
		if (tgt < 0) return;
		const a = Math.atan2(this.eY[tgt] - t.y, this.eX[tgt] - t.x);
		const ca = Math.cos(a);
		const sa = Math.sin(a);
		this.spawnProjectile(0, t.x + ca * 14, t.y + sa * 14, ca, sa, 900, 4, 0, 1, tgt, t, 1);
		this.muzzleFlash(t.x + ca * 14, t.y + sa * 14, 9, 16770976);
		if (this.ticks % 4 === 0) this.ev(0, t.x, t.y, 0);
		t.cd = .12;
	}
	updateTower(t) {
		const def = TOWERS[t.type];
		const lv = def.levels[t.level];
		const range = lv.range * t.rangeMult;
		const h = this.hero;
		const rallied = h !== null && h.rallyT > 0 && (t.x - h.x) ** 2 + (t.y - h.y) ** 2 < 25600;
		if (rallied && WW2$1) t.supp = 0;
		if (t.base) this.baseGuns(t);
		const dry = WW2$1 && t.ammo <= 0 && this.usesAmmo(t);
		const rate = lv.rate * t.rateMult * (rallied ? 1.4 : 1) * (dry ? EMPTY_RATE : 1);
		let dmg = lv.damage * t.dmgMult;
		const airMult = def.airMult * t.airBonus;
		const ca = Math.cos(t.angle);
		const sa = Math.sin(t.angle);
		switch (t.kind) {
			case "jammer":
			case "depot":
			case "radar":
			case "command":
			case "salvage":
			case "barricade":
			case "gate":
			case "tar":
			case "spikes":
			case "wire": return;
			case "barracks":
			case "motorpool":
				if (t.trainKind >= 0) this.finishTraining(t);
				return;
			case "airfield":
				if (t.charge > 0) t.charge = Math.max(0, t.charge - DT);
				return;
			case "workshop":
				if (t.cd > 0) return;
				t.cd = .5;
				for (const o of this.towers) {
					if (o === t || o.wreck || o.hp <= 0) continue;
					const max = this.maxHp(o);
					if (o.hp >= max || (o.x - t.x) ** 2 + (o.y - t.y) ** 2 > range * range) continue;
					o.hp = Math.min(max, o.hp + max * (lv.buff ?? 0) * .5);
					if (this.vr.next() < .5) this.fx(2, 1, o.x + this.vr.range(-8, 8), o.y + this.vr.range(-8, 8), this.vr.range(-40, 40), -40, .3, 3, 1, 1, 16765040, 4, 10);
				}
				return;
			case "orbital":
			case "nuke":
			case "stuka":
				if (t.charge > 0) t.charge = Math.max(0, t.charge - DT);
				return;
			case "emp":
				if (t.cd > 0 || this.findTarget(t.x, t.y, range, true, true, 3) < 0) return;
				this.forEachInRange(t.x, t.y, range, true, true, (i) => {
					this.setSlow(i, lv.slow, lv.slowTime);
					this.damage(i, dmg, true, t);
				});
				this.fx(3, 1, t.x, t.y, 0, 0, .45, 8, range * 2, .8, 9236648, 0, 0);
				this.ev(0, t.x, t.y, t.type);
				t.cd = 1 / rate;
				return;
			case "mine": {
				if (t.cd > 0) return;
				let v = -1;
				if (def.trigger) {
					const veh = def.trigger === "vehicle";
					this.forEachInRange(t.x, t.y, lv.range, false, true, (i) => {
						if (v < 0 && !ENEMIES[this.eKind[i]].inf === veh && this.eHackT[i] <= 0) v = i;
					});
				} else v = this.findTarget(t.x, t.y, lv.range, false, true, 3);
				if (v < 0) return;
				this.splash(t.x, t.y, lv.splash, dmg, 1, 0, t, true);
				this.explosion(t.x, t.y, 1.1, 2);
				t.cd = 1 / rate;
				return;
			}
			case "gravity": {
				const pull = lv.pull * (t.rangeMult > 1 ? 1.2 : 1);
				this.forEachInRange(t.x, t.y, range, false, true, (i) => {
					const dx = t.x - this.eX[i];
					const dy = t.y - this.eY[i];
					const d = Math.hypot(dx, dy);
					if (d > 10) this.shove(i, dx / d * pull * DT, dy / d * pull * DT);
					this.setSlow(i, lv.slow, .2);
					this.damage(i, dmg * DT, true, t);
				});
				if (this.ticks % 3 === 0) {
					const a = this.vr.next() * TWO_PI;
					const r = range * this.vr.range(.5, 1);
					this.fx(2, 1, t.x + Math.cos(a) * r, t.y + Math.sin(a) * r, -Math.sin(a) * 60 - Math.cos(a) * 50, Math.cos(a) * 60 - Math.sin(a) * 50, .6, 5, 2, .8, 11567359, 0, 3);
				}
				return;
			}
			case "repulsor":
				if (t.cd > 0 || this.findTarget(t.x, t.y, range, false, true, 3) < 0) return;
				this.forEachInRange(t.x, t.y, range, false, true, (i) => {
					const back = ENEMIES[this.eKind[i]].boss ? .25 : 1;
					this.shove(i, -Math.cos(this.eAng[i]) * lv.knock * back, -Math.sin(this.eAng[i]) * lv.knock * back);
					this.damage(i, dmg, false, t);
				});
				this.fx(3, 1, t.x, t.y, 0, 0, .35, 10, range * 2, .9, 5949672, 0, 0);
				this.ev(0, t.x, t.y, t.type);
				t.cd = 1 / rate;
				return;
			case "hive": {
				let n = 0;
				for (const d of this.drones) if (d.hive === t) n++;
				if (n < lv.drones && t.cd <= 0) {
					this.drones.push({
						hive: t,
						x: t.x,
						y: t.y,
						px: t.x,
						py: t.y,
						ang: 0,
						pang: 0,
						cd: 0,
						tgt: -1,
						orbit: this.rng.next() * TWO_PI
					});
					t.cd = 2;
				}
				return;
			}
			case "blackhole": {
				if (t.cd > 0) return;
				const v = this.findTarget(t.x, t.y, range, false, true, t.mode);
				if (v < 0) return;
				this.addZone(2, this.eX[v], this.eY[v], lv.splash, lv.duration, dmg, lv.pull, false, t);
				this.ev(0, t.x, t.y, t.type);
				t.cd = 1 / rate;
				return;
			}
			case "hacker": {
				if (t.cd > 0) return;
				let best = -1;
				let hp = 0;
				this.forEachInRange(t.x, t.y, range, false, true, (i) => {
					if (ENEMIES[this.eKind[i]].boss || !this.targetable(i) || ENEMIES[this.eKind[i]].inf) return;
					if (this.eHp[i] > hp) {
						hp = this.eHp[i];
						best = i;
					}
				});
				if (best < 0) return;
				this.aim(t, this.eX[best], this.eY[best]);
				this.eHackT[best] = lv.duration;
				this.ev(9, this.eX[best], this.eY[best], 1);
				this.eHackDps[best] = dmg;
				this.streak(t.x, t.y, 22, this.eX[best], this.eY[best], 8, .5, 3866506, 2);
				this.fx(3, 1, this.eX[best], this.eY[best], 0, 0, .4, 6, 40, .9, 3866506, 0, 0);
				t.cd = 1 / rate;
				return;
			}
		}
		const spot = t.kind === "arty" ? 140 : 0;
		const pen = WW2$1 ? lv.pen ?? 0 : 0;
		const ambush = t.mode === 4;
		const indirect = t.kind === "arty" || t.kind === "cannon";
		const sight = !WW2$1 ? 0 : indirect ? 3 : 1;
		if (WW2$1 && t.mode === 5 && this.night > .3) {
			if (t.cd <= 0 && this.fireFlare(t, range)) {
				t.cd = FLARE_CD;
				this.spend(t, lv.rate);
			}
			return;
		}
		const dim = WW2$1 && !indirect ? this.dimMult : 1;
		if (dim < 1 && this.flCount) this.dimR2 = (range * dim) ** 2;
		this.sightTower = t;
		const tgt = this.findTarget(t.x, t.y, this.dimR2 ? range : range * dim, def.hitsAir, def.hitsGround, ambush || t.mode === 5 ? 0 : t.mode, -1, spot, pen, !!lv.splash && t.kind !== "at", range, sight);
		this.dimR2 = 0;
		if (tgt < 0) {
			if (t.kind === "gatling") t.spin = Math.max(0, t.spin - DT * .5);
			if (t.kind === "gatling") t.heat = Math.max(0, t.heat - DT * .4);
			return;
		}
		const tx = this.eX[tgt];
		const ty = this.eY[tgt];
		const tz = this.eAir[tgt] ? 40 : 6;
		if (t.kind === "tesla") {
			if (t.cd > 0) return;
			this.ev(0, t.x, t.y, t.type);
			this.tesla(t, tgt, dmg, lv.chain);
			t.cd = 1 / rate;
			return;
		}
		if (!this.aim(t, tx, ty)) return;
		if (t.kind === "laser") {
			if (t.cd <= 0) {
				this.ev(0, t.x, t.y, t.type);
				t.cd = .5;
			}
			t.beam = tgt;
			this.damage(tgt, dmg * (this.eAir[tgt] ? airMult : 1) * DT, true, t);
			if ((this.ticks & 3) === 0 && this.eAlive[tgt]) this.fx(2, 1, tx, ty, this.vr.range(-80, 80), this.vr.range(-80, 80), .2, 3, 1, 1, 16747146, 4, tz);
			return;
		}
		if (t.kind === "flame") {
			if (dry && this.ticks % 30 >= 10) return;
			if (WW2$1) this.spend(t, 1, DT);
			if (t.firing <= 0) this.ev(0, t.x, t.y, t.type);
			if (WW2$1) t.seenT = REVEAL_T;
			t.firing = .12;
			const mx = t.x + ca * 16;
			const my = t.y + sa * 16;
			for (let k = 0; k < 2; k++) {
				const a = t.angle + this.vr.range(-.28, .28);
				const s = this.vr.range(150, 230);
				this.fx(0, 1, mx, my, Math.cos(a) * s, Math.sin(a) * s, range / s * 1.1, 5, 22, .75, k ? 16751146 : 16765024, 1.5, 12);
			}
			if (this.ticks % 4 === 0) {
				if (this.vr.next() < .5) this.fx(1, 0, mx + ca * range * .7, my + sa * range * .7, ca * 30, sa * 30, .8, 8, 22, .3, 3814448, 1, 10);
				this.forEachInRange(t.x, t.y, range, false, true, (i) => {
					const a = Math.atan2(this.eY[i] - t.y, this.eX[i] - t.x);
					if (Math.abs(angleDiff(t.angle, a)) > .42) return;
					this.ignite(i, lv.burn * t.dmgMult, 2.5, t);
					this.damage(i, dmg * 4 * DT, true, t);
				});
			}
			return;
		}
		if (t.kind === "gatling") {
			t.spin = Math.min(1, t.spin + DT * .4);
			if (t.cd > 0) return;
		} else if (t.cd > 0) return;
		if (this.towerHidden(t)) {
			if (ambush) {
				if (!(!!ENEMIES[this.eKind[tgt]].arm && Math.abs(angleDiff(this.eAng[tgt], Math.atan2(t.y - ty, t.x - tx))) > Math.PI / 4) && (tx - t.x) ** 2 + (ty - t.y) ** 2 > (range * .6) ** 2) return;
			}
			dmg *= ambush ? 1.5 : 1.25;
		}
		t.recoil = 1;
		const mx = t.x + ca * 17;
		const my = t.y + sa * 17;
		let cd = 1 / rate;
		switch (t.kind) {
			case "gun":
				this.spawnProjectile(0, mx, my, ca, sa, 900, dmg, 0, airMult, tgt, t, 1);
				this.muzzleFlash(mx, my, 10, 16770976);
				break;
			case "bunker": {
				this.spawnProjectile(0, t.x + ca * 12 - sa * 5, t.y + sa * 12 + ca * 5, ca, sa, 900, dmg, 0, 1, tgt, t, 1);
				const second = this.findTarget(t.x, t.y, range, false, true, t.mode, tgt, 0, pen, false, range, sight);
				this.spawnProjectile(0, t.x + ca * 12 + sa * 5, t.y + sa * 12 - ca * 5, ca, sa, 900, dmg, 0, 1, second >= 0 ? second : tgt, t, 1);
				this.muzzleFlash(mx, my, 9, 16770976);
				break;
			}
			case "gatling": {
				const side = this.ticks & 1 ? 2 : -2;
				this.spawnProjectile(0, mx - sa * side, my + ca * side, ca, sa, 950, dmg, 0, airMult, tgt, t, 1);
				this.muzzleFlash(mx, my, 8, 16770976);
				cd = 1 / (rate * (1 + t.spin * 4));
				t.heat += .012;
				if (t.heat >= 1) {
					t.heat = 0;
					t.spin = 0;
					cd = 2.5;
					for (let k = 0; k < 6; k++) this.fx(1, 0, mx, my, this.vr.range(-30, 30), this.vr.range(-40, -10), 1, 6, 18, .5, 13684944, 2, 16);
				}
				break;
			}
			case "cannon":
				if (lv.salvo) {
					for (let k = 0; k < lv.salvo; k++) {
						const a = this.rng.next() * TWO_PI;
						const r = Math.sqrt(this.rng.next()) * lv.splash * .9;
						const p = this.lobAt(1, t, tgt, mx, my, 300 + k * 18, dmg, lv.splash);
						if (p >= 0) {
							this.pTx[p] += Math.cos(a) * r;
							this.pTy[p] += Math.sin(a) * r;
							this.pVx[p] = (this.pTx[p] - mx) / this.pTtl[p];
							this.pVy[p] = (this.pTy[p] - my) / this.pTtl[p];
						}
					}
					for (let s = 0; s < 8; s++) this.fx(1, 0, mx, my, -ca * 50 + this.vr.range(-30, 30), -sa * 50 + this.vr.range(-30, 30), 1.2, 8, 26, .55, 11578528, 2, 16);
					this.muzzleFlash(mx, my, 18, 16751184);
					break;
				}
				this.lob(1, t, tgt, mx, my, 420, dmg, lv.splash);
				this.muzzleFlash(mx, my, 16, 16760944);
				for (let s = 0; s < 3; s++) this.fx(1, 0, mx, my, ca * 40 + this.vr.range(-20, 20), sa * 40 + this.vr.range(-20, 20), .6, 6, 16, .5, 10130570, 3, 16);
				break;
			case "at": {
				if (this.eAir[tgt]) {
					const [ax, ay] = this.lead(tgt, mx, my, 620);
					const d = Math.hypot(ax - mx, ay - my) || 1;
					const p = this.spawnProjectile(6, mx, my, (ax - mx) / d, (ay - my) / d, 620, dmg * airMult, lv.splash ?? 30, 1, tgt, t, d / 620);
					if (p >= 0) {
						this.pTx[p] = ax;
						this.pTy[p] = ay;
					}
				} else this.spawnProjectile(10, mx, my, ca, sa, 1100, dmg, 0, 1, tgt, t, 1);
				const big = dmg >= 100 ? 1.3 : 1;
				this.muzzleFlash(mx, my, 18 * big, 16765056);
				for (let s = 0; s < 5; s++) this.fx(1, 0, mx, my, ca * 50 + this.vr.range(-25, 25), sa * 50 + this.vr.range(-25, 25), .9, 7 * big, 22 * big, .5, 11052186, 3, 16);
				for (let s = 0; s < 3; s++) this.fx(1, 0, t.x, t.y, this.vr.range(-40, 40), this.vr.range(-40, 40), .8, 8, 20, .3, 10127978, 3, 2);
				break;
			}
			case "napalm":
				this.lob(3, t, tgt, mx, my, 260, dmg, lv.splash, lv.duration);
				this.muzzleFlash(mx, my, 12, 16744512);
				break;
			case "gas":
				this.lob(5, t, tgt, mx, my, 240, dmg, lv.splash, lv.duration, t.combos.includes("Firestorm") ? 1 : 0);
				this.fx(1, 0, mx, my, ca * 30, sa * 30, .6, 5, 14, .5, 10211674, 3, 16);
				break;
			case "arty":
				this.lob(7, t, tgt, mx, my, 300, dmg, lv.splash);
				this.muzzleFlash(mx, my, 22, 16760944);
				for (let s = 0; s < 6; s++) this.fx(1, 0, mx, my, ca * 60 + this.vr.range(-30, 30), sa * 60 + this.vr.range(-30, 30), 1, 8, 26, .55, 10130570, 3, 16);
				break;
			case "missile": {
				const side = t.kills + this.ticks & 1 ? 5 : -5;
				this.spawnProjectile(2, t.x + ca * 8 - sa * side, t.y + sa * 8 + ca * side, ca, sa, 160, dmg, lv.splash, airMult, tgt, t, 4);
				break;
			}
			case "acid": {
				const p = this.spawnProjectile(4, mx, my, ca, sa, 380, dmg, lv.splash, 1, tgt, t, 2);
				if (p >= 0) {
					this.pExtra[p] = lv.shred;
					this.pExtra2[p] = lv.duration;
				}
				break;
			}
			case "cryo": {
				const p = this.spawnProjectile(8, mx, my, ca, sa, 420, dmg, lv.splash, 1, tgt, t, 2);
				if (p >= 0) this.pExtra[p] = lv.chill;
				this.muzzleFlash(mx, my, 9, 12580095);
				break;
			}
			case "flak": {
				const [ax, ay] = this.lead(tgt, mx, my, 520);
				const d = Math.hypot(ax - mx, ay - my) || 1;
				const p = this.spawnProjectile(6, mx, my, (ax - mx) / d, (ay - my) / d, 520, dmg * airMult, lv.splash, 1, tgt, t, d / 520);
				if (p >= 0) {
					this.pTx[p] = ax;
					this.pTy[p] = ay;
				}
				this.muzzleFlash(mx, my, 12, 16765072);
				break;
			}
			case "sniper":
				this.damage(tgt, dmg, true, t);
				this.streak(mx, my, 16, tx, ty, tz, .18, 16773824, 1.2);
				this.muzzleFlash(mx, my, 14, 16773824);
				this.fx(2, 1, tx, ty, ca * 120, sa * 120, .2, 6, 1, 1, 16769184, 4, tz);
				break;
			case "rail": {
				t.angle = Math.atan2(ty - t.y, tx - t.x);
				const ca = Math.cos(t.angle);
				const sa = Math.sin(t.angle);
				const ex = t.x + ca * range;
				const ey = t.y + sa * range;
				const mxp = (t.x + ex) / 2;
				const myp = (t.y + ey) / 2;
				const n = this.hash.query(mxp, myp, range / 2 + 20, this.qbuf);
				const hits = [];
				for (let k = 0; k < n; k++) {
					const i = this.qbuf[k];
					if (!this.eAlive[i] || this.eHackT[i] > 0) continue;
					const rx = this.eX[i] - t.x;
					const ry = this.eY[i] - t.y;
					const along = rx * ca + ry * sa;
					if (along < 0 || along > range) continue;
					if (Math.abs(rx * sa - ry * ca) <= ENEMIES[this.eKind[i]].radius + 4) hits.push(i);
				}
				for (const i of hits) this.damage(i, dmg, true, t);
				this.streak(mx, my, 16, ex, ey, 9.6, .35, 9098495, 3);
				this.muzzleFlash(mx, my, 20, 11067647);
				for (let k = 0; k < 8; k++) this.fx(2, 1, mx + ca * k * range / 8, my + sa * k * range / 8, this.vr.range(-40, 40), this.vr.range(-40, 40), .3, 4, 1, .9, 9098495, 3, 16);
				break;
			}
		}
		t.cd = cd;
		if (WW2$1) {
			this.spend(t, lv.rate);
			if ((t.kind === "arty" || t.kind === "cannon") && (t.fix += (1 - .7 * this.camoOf(t)) / FIX_SHOTS) >= 1) this.counterBattery(t);
		}
		this.ev(0, t.x, t.y, t.type);
		if (WW2$1) t.seenT = Math.max(t.seenT, t.kind === "sniper" ? 1.2 : REVEAL_T);
	}
	/** Calls fn for every unit within r. Callbacks may query again: each nesting level gets its own buffer. */
	forEachInRange(x, y, r, air, ground, fn) {
		const ids = this.qpool[this.qdepth] ??= new Int32Array(MAX_ENEMIES);
		this.qdepth++;
		const n = this.hash.query(x, y, r, ids);
		const r2 = r * r;
		for (let k = 0; k < n; k++) {
			const i = ids[k];
			if (!this.eAlive[i]) continue;
			if (this.eAir[i] ? !air : !ground) continue;
			const dx = this.eX[i] - x;
			const dy = this.eY[i] - y;
			if (dx * dx + dy * dy <= r2) fn(i);
		}
		this.qdepth--;
	}
	tesla(t, first, dmg, jumps) {
		if (this.bCount >= 128) return;
		const b = this.bCount++;
		const base = b * 8 * 2;
		this.bLife[b] = .16;
		const pts = this.bPts;
		pts[base] = t.x;
		pts[base + 1] = t.y;
		let nodes = 1;
		let cur = first;
		let hits = 0;
		let d = dmg;
		while (cur >= 0 && nodes < 8) {
			const cx = this.eX[cur];
			const cy = this.eY[cur];
			pts[base + nodes * 2] = cx;
			pts[base + nodes * 2 + 1] = cy;
			nodes++;
			this.chainHit[hits++] = cur;
			this.fx(0, 1, cx, cy, 0, 0, .15, 14, 6, .9, 10476799, 0, this.eAir[cur] ? 40 : 6);
			this.damage(cur, d, false, t);
			d *= .82;
			if (hits > jumps) break;
			const n = this.hash.query(cx, cy, 90, this.qbuf);
			let best = -1;
			let bd = 8100;
			for (let k = 0; k < n; k++) {
				const i = this.qbuf[k];
				if (!this.targetable(i)) continue;
				let seen = false;
				for (let h = 0; h < hits; h++) if (this.chainHit[h] === i) {
					seen = true;
					break;
				}
				if (seen) continue;
				const dx = this.eX[i] - cx;
				const dy = this.eY[i] - cy;
				const dd = dx * dx + dy * dy;
				if (dd < bd) {
					bd = dd;
					best = i;
				}
			}
			cur = best;
		}
		this.bN[b] = nodes;
	}
	updateBolts() {
		for (let b = this.bCount - 1; b >= 0; b--) {
			this.bLife[b] -= DT;
			if (this.bLife[b] > 0) continue;
			const last = --this.bCount;
			if (b !== last) {
				this.bLife[b] = this.bLife[last];
				this.bN[b] = this.bN[last];
				this.bPts.copyWithin(b * 8 * 2, last * 8 * 2, (last + 1) * 8 * 2);
			}
		}
	}
	addZone(kind, x, y, r, t, dps, pull, burn, src) {
		if (this.zones.length >= 256) return;
		const drift = kind === 1 ? 10 : 0;
		const a = this.rng.next() * TWO_PI;
		this.zones.push({
			kind,
			x,
			y,
			px: x,
			py: y,
			vx: Math.cos(a) * drift,
			vy: Math.sin(a) * drift,
			r,
			t,
			t0: t,
			dps,
			pull,
			burn,
			src
		});
	}
	updateZones() {
		for (let z = this.zones.length - 1; z >= 0; z--) {
			const zn = this.zones[z];
			zn.px = zn.x;
			zn.py = zn.y;
			zn.t -= DT;
			if (zn.t <= 0) {
				if (zn.kind === 2) {
					this.fx(3, 1, zn.x, zn.y, 0, 0, .4, zn.r * 2, 8, .9, 12620031, 0, 0);
					this.fx(0, 1, zn.x, zn.y, 0, 0, .25, 50, 4, 1, 13676799, 0, 8);
				}
				this.zones.splice(z, 1);
				continue;
			}
			if (zn.kind === 3) {
				const v = this.findTarget(zn.x, zn.y, 200, true, true, 2);
				if (v >= 0) {
					const dx = this.eX[v] - zn.x;
					const dy = this.eY[v] - zn.y;
					const d = Math.hypot(dx, dy) || 1;
					const sp = Math.min(d / DT, 110);
					zn.vx = dx / d * sp;
					zn.vy = dy / d * sp;
				} else {
					zn.vx *= .9;
					zn.vy *= .9;
				}
			}
			zn.x += zn.vx * DT;
			zn.y += zn.vy * DT;
			const air = zn.kind === 3;
			this.forEachInRange(zn.x, zn.y, zn.r, air, true, (i) => {
				switch (zn.kind) {
					case 0:
						this.ignite(i, zn.dps, 1, zn.src);
						break;
					case 1:
						this.damage(i, zn.dps * ENEMIES[this.eKind[i]].bio * DT, true, zn.src);
						if (zn.burn && this.eAlive[i]) this.ignite(i, zn.dps * .5, 1, zn.src);
						break;
					case 2: {
						const dx = zn.x - this.eX[i];
						const dy = zn.y - this.eY[i];
						const d = Math.hypot(dx, dy);
						if (d < 16 && !ENEMIES[this.eKind[i]].boss && this.eHp[i] < this.eMaxHp[i] * .25) {
							this.ev(9, this.eX[i], this.eY[i], 4);
							this.damage(i, 1e9, true, zn.src);
							return;
						}
						if (d > 4) this.shove(i, dx / d * zn.pull * DT, dy / d * zn.pull * DT);
						this.damage(i, zn.dps * DT, true, zn.src);
						break;
					}
					case 3: this.damage(i, zn.dps * DT, true, zn.src);
				}
			});
			const life = zn.t / zn.t0;
			if (zn.kind === 0 && (this.ticks & 1) === 0) {
				const a = this.vr.next() * TWO_PI;
				const r = Math.sqrt(this.vr.next()) * zn.r * .85;
				this.fx(0, 1, zn.x + Math.cos(a) * r, zn.y + Math.sin(a) * r, 0, -12, .5, 10 * life + 4, 3, .85, this.vr.next() < .5 ? 16738842 : 16756800, 1, 4);
				if (this.vr.next() < .2) this.fx(1, 0, zn.x + Math.cos(a) * r, zn.y + Math.sin(a) * r, 0, -10, 1.2, 8, 24, .3, 2761760, 1, 12);
			} else if (zn.kind === 1 && this.ticks % 3 === 0) {
				const a = this.vr.next() * TWO_PI;
				const r = Math.sqrt(this.vr.next()) * zn.r * .8;
				this.fx(1, 0, zn.x + Math.cos(a) * r, zn.y + Math.sin(a) * r, zn.vx, zn.vy, 1.4, zn.r * .5, zn.r * .9, .35 * Math.min(1, life * 3), zn.burn ? 11575360 : 9095242, .5, 4);
			} else if (zn.kind === 2 && (this.ticks & 1) === 0) {
				const a = this.vr.next() * TWO_PI;
				const r = zn.r * this.vr.range(.6, 1.1);
				this.fx(2, 1, zn.x + Math.cos(a) * r, zn.y + Math.sin(a) * r, -Math.cos(a) * r * 2 - Math.sin(a) * 90, -Math.sin(a) * r * 2 + Math.cos(a) * 90, .45, 6, 1, .9, this.vr.next() < .5 ? 10510591 : 14729471, 0, 6);
			} else if (zn.kind === 3) {
				if ((this.ticks & 1) === 0) this.streak(zn.x, zn.y, 600, zn.x, zn.y, 0, .05, 16730746, zn.r * .7);
				const a = this.vr.next() * TWO_PI;
				this.fx(2, 1, zn.x, zn.y, Math.cos(a) * 160, Math.sin(a) * 160, .3, 6, 1, 1, 16752832, 3, 2);
				if (this.ticks % 4 === 0) this.fx(1, 0, zn.x, zn.y, this.vr.range(-20, 20), this.vr.range(-20, 20), 1, 10, 30, .4, 2761252, 1, 4);
			}
		}
	}
	updateDrones() {
		const DRONE_SPEED = 150;
		for (const d of this.drones) {
			d.px = d.x;
			d.py = d.y;
			d.pang = d.ang;
			d.cd -= DT;
			const hive = d.hive;
			const lv = TOWERS[hive.type].levels[hive.level];
			const leash = lv.range * hive.rangeMult;
			if (d.tgt >= 0 && (!this.targetable(d.tgt) || Math.hypot(this.eX[d.tgt] - hive.x, this.eY[d.tgt] - hive.y) > leash)) d.tgt = -1;
			if (d.tgt < 0 && (this.ticks + (d.orbit * 10 | 0)) % 15 === 0) {
				const v = this.findTarget(d.x, d.y, 220, true, true, 3);
				if (v >= 0 && Math.hypot(this.eX[v] - hive.x, this.eY[v] - hive.y) <= leash) d.tgt = v;
			}
			d.orbit += DT * 2.2;
			let gx;
			let gy;
			if (d.tgt >= 0) {
				gx = this.eX[d.tgt] + Math.cos(d.orbit) * 34;
				gy = this.eY[d.tgt] + Math.sin(d.orbit) * 34;
			} else {
				gx = hive.x + Math.cos(d.orbit) * 26;
				gy = hive.y + Math.sin(d.orbit) * 26;
			}
			const dx = gx - d.x;
			const dy = gy - d.y;
			const dist = Math.hypot(dx, dy) || 1;
			const step = Math.min(dist, DRONE_SPEED * DT);
			d.x += dx / dist * step;
			d.y += dy / dist * step;
			if (d.tgt >= 0) {
				const ax = this.eX[d.tgt] - d.x;
				const ay = this.eY[d.tgt] - d.y;
				d.ang += angleDiff(d.ang, Math.atan2(ay, ax)) * Math.min(1, 12 * DT);
				if (d.cd <= 0 && ax * ax + ay * ay < 4900) {
					const a = Math.hypot(ax, ay) || 1;
					this.spawnProjectile(0, d.x, d.y, ax / a, ay / a, 800, lv.damage * hive.dmgMult, 0, 1, d.tgt, hive, 1);
					d.cd = 1 / (lv.rate * hive.rateMult);
				}
			} else if (step > .1) d.ang += angleDiff(d.ang, Math.atan2(dy, dx)) * Math.min(1, 8 * DT);
		}
	}
	streak(x0, y0, z0, x1, y1, z1, life, color, width) {
		if (this.streaks.length >= 512) return;
		this.streaks.push({
			x0,
			y0,
			z0,
			x1,
			y1,
			z1,
			life,
			life0: life,
			color,
			width
		});
	}
	updateStreaks() {
		for (let k = this.streaks.length - 1; k >= 0; k--) if ((this.streaks[k].life -= .016666666666666666) <= 0) {
			this.streaks[k] = this.streaks[this.streaks.length - 1];
			this.streaks.pop();
		}
	}
	spawnProjectile(kind, x, y, dx, dy, speed, dmg, splash, airMult, target, src, ttl) {
		if (this.pCount >= 8192) return -1;
		const p = this.pCount++;
		this.pKind[p] = kind;
		this.pX[p] = this.pPx[p] = x;
		this.pY[p] = this.pPy[p] = y;
		this.pVx[p] = dx * speed;
		this.pVy[p] = dy * speed;
		this.pSpeed[p] = speed;
		this.pDmg[p] = dmg;
		this.pSplash[p] = splash;
		this.pAirMult[p] = airMult;
		this.pTarget[p] = target;
		this.pTuid[p] = target >= 0 ? this.eUid[target] : -1;
		this.pTtl[p] = this.pTtl0[p] = ttl;
		this.pTx[p] = target >= 0 ? this.eX[target] : x;
		this.pTy[p] = target >= 0 ? this.eY[target] : y;
		this.pExtra[p] = this.pExtra2[p] = 0;
		this.pSrc[p] = src;
		return p;
	}
	removeProjectile(p) {
		const last = --this.pCount;
		if (p === last) return;
		this.pKind[p] = this.pKind[last];
		this.pX[p] = this.pX[last];
		this.pY[p] = this.pY[last];
		this.pPx[p] = this.pPx[last];
		this.pPy[p] = this.pPy[last];
		this.pVx[p] = this.pVx[last];
		this.pVy[p] = this.pVy[last];
		this.pSpeed[p] = this.pSpeed[last];
		this.pDmg[p] = this.pDmg[last];
		this.pSplash[p] = this.pSplash[last];
		this.pAirMult[p] = this.pAirMult[last];
		this.pTarget[p] = this.pTarget[last];
		this.pTuid[p] = this.pTuid[last];
		this.pTtl[p] = this.pTtl[last];
		this.pTtl0[p] = this.pTtl0[last];
		this.pTx[p] = this.pTx[last];
		this.pTy[p] = this.pTy[last];
		this.pExtra[p] = this.pExtra[last];
		this.pExtra2[p] = this.pExtra2[last];
		this.pSrc[p] = this.pSrc[last];
		this.pSrc[last] = null;
	}
	/** Render height of a projectile chasing its target: climbs toward flying targets. */
	missileZ(p) {
		if (this.pKind[p] === 6) return 34 * Math.min(1, 1.3 - this.pTtl[p] / this.pTtl0[p]);
		return this.targetValid(p) && this.eAir[this.pTarget[p]] ? 38 : 10;
	}
	targetValid(p) {
		const t = this.pTarget[p];
		return t >= 0 && this.eAlive[t] === 1 && this.eUid[t] === this.pTuid[p];
	}
	/** Area damage falling off to half at the edge. mask: 1 ground, 2 air, 3 both. */
	splash(x, y, r, dmg, mask, airMult, src, shatter = false, pen = -1) {
		this.forEachInRange(x, y, r, (mask & 2) !== 0, (mask & 1) !== 0, (i) => {
			const d2 = (this.eX[i] - x) ** 2 + (this.eY[i] - y) ** 2;
			const fall = 1 - .5 * Math.sqrt(d2 / (r * r));
			this.damage(i, dmg * fall * (this.eAir[i] ? airMult : 1), false, src, shatter, pen, true);
		});
	}
	/** A projectile reached its target point or unit. */
	impact(p, kind, x, y) {
		const src = this.pSrc[p];
		const dmg = this.pDmg[p];
		const r = this.pSplash[p];
		switch (kind) {
			case 1:
				this.splash(x, y, r, dmg, 1, 0, src, true);
				this.explosion(x, y, 1.2, 0);
				break;
			case 7:
				this.splash(x, y, r, dmg, 1, 0, src, true);
				this.explosion(x, y, 2.2, 0);
				this.fx(3, 1, x, y, 0, 0, .4, 10, r * 2, .7, 16760960, 0, 0);
				break;
			case 3:
				this.addZone(0, x, y, r, this.pExtra[p], dmg, 0, false, src);
				this.explosion(x, y, .8, 0);
				break;
			case 5:
				this.addZone(1, x, y, r, this.pExtra[p], dmg, 0, this.pExtra2[p] > 0, src);
				for (let k = 0; k < 6; k++) this.fx(1, 0, x, y, this.vr.range(-40, 40), this.vr.range(-40, 40), 1, 10, r, .5, 10211674, 3, 4);
				break;
			case 9:
				this.ev(10, x, y);
				this.splash(x, y, r, dmg, 3, 1, src, true);
				this.explosion(x, y, 6, 0);
				this.fx(3, 1, x, y, 0, 0, .8, 20, r * 2.4, 1, 16773312, 0, 0);
				this.fx(3, 1, x, y, 0, 0, 1.3, 10, r * 3.2, .6, 16752736, 0, 0);
				for (let k = 0; k < 24; k++) {
					const a = k / 24 * TWO_PI;
					this.fx(1, 0, x, y, Math.cos(a) * 160, Math.sin(a) * 160, 2.2, 30, 70, .6, 5918792, 1.5, 10);
				}
				break;
			case 6:
				this.splash(x, y, r, dmg, 2, 1, src);
				this.fx(0, 1, x, y, 0, 0, .15, 12, 30, .9, 16765072, 0, 38);
				for (let k = 0; k < 4; k++) this.fx(1, 0, x, y, this.vr.range(-25, 25), this.vr.range(-25, 25), .9, 8, 22, .6, 2762790, 2, 38);
				break;
			case 4:
				this.forEachInRange(x, y, r, true, true, (i) => {
					this.eShred[i] = Math.max(this.eShred[i], this.pExtra[p]);
					this.eShredT[i] = this.pExtra2[p];
					this.damage(i, dmg, false, src);
				});
				for (let k = 0; k < 6; k++) this.fx(0, 1, x, y, this.vr.range(-50, 50), this.vr.range(-50, 50), .4, 6, 2, .8, 10936878, 4, 4);
				break;
			case 8:
				this.forEachInRange(x, y, r, true, true, (i) => {
					this.chill(i, this.pExtra[p]);
					this.damage(i, dmg, false, src);
				});
				this.fx(0, 1, x, y, 0, 0, .25, 8, r * 1.6, .7, 12580095, 0, 6);
		}
	}
	updateProjectiles() {
		for (let p = this.pCount - 1; p >= 0; p--) {
			this.pPx[p] = this.pX[p];
			this.pPy[p] = this.pY[p];
			const kind = this.pKind[p];
			if (kind === 0 || kind === 10 || kind === 4 || kind === 8) {
				const valid = this.targetValid(p);
				if (valid) {
					this.pTx[p] = this.eX[this.pTarget[p]];
					this.pTy[p] = this.eY[this.pTarget[p]];
				}
				const dx = this.pTx[p] - this.pX[p];
				const dy = this.pTy[p] - this.pY[p];
				const d = Math.hypot(dx, dy);
				if (d <= this.pSpeed[p] * .016666666666666666 + 4) {
					if (kind === 10) {
						if (valid) this.damage(this.pTarget[p], this.pDmg[p], false, this.pSrc[p]);
						this.fx(0, 1, this.pTx[p], this.pTy[p], 0, 0, .1, 6, 18, .9, 16769184, 0, 8);
						for (let k = 0; k < 3; k++) this.fx(1, 0, this.pTx[p], this.pTy[p], this.vr.range(-30, 30), this.vr.range(-30, 30), .7, 5, 16, .45, 9077880, 3, 6);
					} else if (kind !== 0) this.impact(p, kind, this.pTx[p], this.pTy[p]);
					else if (valid) {
						const t = this.pTarget[p];
						this.damage(t, this.pDmg[p] * (this.eAir[t] ? this.pAirMult[p] : 1), false, this.pSrc[p]);
						this.fx(2, 1, this.pTx[p], this.pTy[p], -dx / d * 60, -dy / d * 60, .12, 4, 1, 1, 16765562, 6, this.eAir[t] ? 40 : 6);
					}
					this.removeProjectile(p);
					continue;
				}
				this.pVx[p] = dx / d * this.pSpeed[p];
				this.pVy[p] = dy / d * this.pSpeed[p];
				this.pX[p] += this.pVx[p] * DT;
				this.pY[p] += this.pVy[p] * DT;
			} else if (kind !== 2) {
				this.pX[p] += this.pVx[p] * DT;
				this.pY[p] += this.pVy[p] * DT;
				this.pTtl[p] -= DT;
				if (kind === 9 && (this.ticks & 1) === 0) this.fx(1, 0, this.pX[p], this.pY[p], 0, 0, .8, 6, 16, .5, 13683908, 2, 20);
				if (this.pTtl[p] <= 0) {
					this.impact(p, kind, this.pTx[p], this.pTy[p]);
					this.removeProjectile(p);
				}
			} else {
				this.pTtl[p] -= DT;
				if (!this.targetValid(p)) {
					const n = this.findTarget(this.pX[p], this.pY[p], 220, true, true, 3);
					if (n >= 0) {
						this.pTarget[p] = n;
						this.pTuid[p] = this.eUid[n];
					}
				}
				const valid = this.targetValid(p);
				if (valid) {
					this.pTx[p] = this.eX[this.pTarget[p]];
					this.pTy[p] = this.eY[this.pTarget[p]];
				}
				const spd = this.pSpeed[p] = Math.min(560, this.pSpeed[p] + 900 * DT);
				let ang = Math.atan2(this.pVy[p], this.pVx[p]);
				const want = Math.atan2(this.pTy[p] - this.pY[p], this.pTx[p] - this.pX[p]);
				const diff = angleDiff(ang, want);
				const turn = 7 * DT;
				ang += Math.abs(diff) < turn ? diff : Math.sign(diff) * turn;
				this.pVx[p] = Math.cos(ang) * spd;
				this.pVy[p] = Math.sin(ang) * spd;
				this.pX[p] += this.pVx[p] * DT;
				this.pY[p] += this.pVy[p] * DT;
				if ((this.ticks & 1) === 0) this.fx(1, 0, this.pX[p], this.pY[p], this.vr.range(-8, 8), this.vr.range(-8, 8), .5, 3, 9, .45, 13157564, 2, this.missileZ(p));
				const dx = this.pTx[p] - this.pX[p];
				const dy = this.pTy[p] - this.pY[p];
				const hitR = valid ? ENEMIES[this.eKind[this.pTarget[p]]].radius + 4 : 6;
				if (dx * dx + dy * dy < hitR * hitR || this.pTtl[p] <= 0) {
					const x = this.pX[p];
					const y = this.pY[p];
					if (valid) this.damage(this.pTarget[p], this.pDmg[p] * .5 * (this.eAir[this.pTarget[p]] ? this.pAirMult[p] : 1), false, this.pSrc[p]);
					this.splash(x, y, this.pSplash[p], this.pDmg[p] * .5, 3, this.pAirMult[p], this.pSrc[p]);
					this.explosion(x, y, .8, this.missileZ(p));
					this.removeProjectile(p);
				}
			}
		}
	}
	/** Spawns one effect particle. Silently drops when the pool is full. */
	fx(tex, add, x, y, vx, vy, life, s0, s1, a0, color, drag, z = 4) {
		if (this.fCount >= 6144 || this.fxScale < 1 && this.vr.next() > this.fxScale) return;
		const f = this.fCount++;
		this.fTex[f] = tex;
		this.fAdd[f] = add;
		this.fX[f] = this.fPx[f] = x;
		this.fY[f] = this.fPy[f] = y;
		this.fZ[f] = z;
		this.fVx[f] = vx;
		this.fVy[f] = vy;
		this.fLife[f] = this.fMax[f] = life;
		this.fS0[f] = s0;
		this.fS1[f] = s1;
		this.fA0[f] = a0;
		this.fRot[f] = tex === 2 ? Math.atan2(vy, vx) : this.vr.next() * TWO_PI;
		this.fColor[f] = color;
		this.fDrag[f] = drag;
	}
	burst(x, y, color, n, tex, add) {
		for (let k = 0; k < n; k++) {
			const a = this.vr.next() * TWO_PI;
			const s = this.vr.range(30, 90);
			this.fx(tex, add, x, y, Math.cos(a) * s, Math.sin(a) * s, this.vr.range(.3, .6), tex === 1 ? 8 : 4, tex === 1 ? 18 : 1, .8, color, 4);
		}
	}
	explosion(x, y, size, z = 4) {
		this.ev(1, x, y, size);
		const load = this.fCount / MAX_FX;
		const q = load > .8 ? .25 : load > .5 ? .6 : 1;
		const rng = this.vr;
		this.fx(0, 1, x, y, 0, 0, .18, 10 * size, 46 * size, 1, 16773312, 0, z);
		const fire = Math.ceil(5 * size * q);
		for (let k = 0; k < fire; k++) {
			const a = rng.next() * TWO_PI;
			const s = rng.range(10, 60) * size;
			this.fx(0, 1, x, y, Math.cos(a) * s, Math.sin(a) * s, rng.range(.25, .45), 14 * size, 4, .9, k & 1 ? 16747050 : 16760906, 3, z);
		}
		const smoke = Math.ceil(4 * size * q);
		for (let k = 0; k < smoke; k++) {
			const a = rng.next() * TWO_PI;
			const s = rng.range(8, 40) * size;
			this.fx(1, 0, x, y, Math.cos(a) * s, Math.sin(a) * s - 10, rng.range(.8, 1.4), 10 * size, 34 * size, .55, 4867647, 2, z);
		}
		const debris = Math.ceil(6 * size * q);
		for (let k = 0; k < debris; k++) {
			const a = rng.next() * TWO_PI;
			const s = rng.range(80, 220) * Math.sqrt(size);
			this.fx(2, 1, x, y, Math.cos(a) * s, Math.sin(a) * s, rng.range(.2, .4), 5, 2, 1, 16765056, 5, z);
		}
	}
	updateFx() {
		for (let f = this.fCount - 1; f >= 0; f--) {
			this.fLife[f] -= DT;
			if (this.fLife[f] <= 0) {
				const l = --this.fCount;
				if (f !== l) {
					this.fTex[f] = this.fTex[l];
					this.fAdd[f] = this.fAdd[l];
					this.fX[f] = this.fX[l];
					this.fY[f] = this.fY[l];
					this.fZ[f] = this.fZ[l];
					this.fPx[f] = this.fPx[l];
					this.fPy[f] = this.fPy[l];
					this.fVx[f] = this.fVx[l];
					this.fVy[f] = this.fVy[l];
					this.fDrag[f] = this.fDrag[l];
					this.fLife[f] = this.fLife[l];
					this.fMax[f] = this.fMax[l];
					this.fS0[f] = this.fS0[l];
					this.fS1[f] = this.fS1[l];
					this.fA0[f] = this.fA0[l];
					this.fRot[f] = this.fRot[l];
					this.fColor[f] = this.fColor[l];
				}
				continue;
			}
			this.fPx[f] = this.fX[f];
			this.fPy[f] = this.fY[f];
			const drag = 1 - Math.min(1, this.fDrag[f] * DT);
			this.fVx[f] *= drag;
			this.fVy[f] *= drag;
			this.fX[f] += this.fVx[f] * DT;
			this.fY[f] += this.fVy[f] * DT;
		}
	}
};
//#endregion
//#region scripts/bot.ts
var WW2 = !!process.env.WW2 || !!process.env.BATTLE;
/** WW2 matchup: SIDE=de|su|us|jp defends against FOE. */
var SIDE = process.env.SIDE ?? "de";
var FOE = process.env.FOE ?? (SIDE === "de" ? "su" : SIDE === "jp" ? "us" : "de");
/** The bot's build order names German towers; they stand for the arsenal slots every side fills. */
var SLOT_OF = {
	mg42: "mg",
	flak38: "lightaa",
	schreck: "at",
	sniper: "sniper",
	flamer: "flamer",
	pak40: "atgun",
	flak88: "heavyaa",
	tiger: "tank",
	bunker: "bunker",
	mortar: "mortar",
	lefh18: "howitzer",
	nebel: "rockets",
	depot: "depot",
	observer: "observer",
	hq: "hq",
	workshop: "workshop"
};
var slot = (k) => TOWERS.findIndex((t) => t.slot === SLOT_OF[k]);
var T = {
	gun: towerIndex("gun"),
	cannon: towerIndex("cannon"),
	missile: towerIndex("missile"),
	tesla: towerIndex("tesla"),
	laser: towerIndex("laser"),
	flak: towerIndex("flak"),
	radar: towerIndex("radar"),
	jammer: towerIndex("jammer"),
	napalm: towerIndex("napalm"),
	sniper: towerIndex("sniper")
};
/** Cells on each route's current path, entry to exit. */
function pathCells(sim) {
	const out = [];
	sim.map.routes.forEach((r, k) => {
		const f = sim.fields[k];
		let c = r.entry[r.entry.length >> 1];
		for (let g = 0; g < 4e3 && c >= 0 && f.dist[c] > 0; g++) {
			out.push(c);
			c = f.next[c];
		}
	});
	return out;
}
/** Cells under the straight lines aircraft fly, entry to exit. */
function airCells(sim) {
	const out = [];
	for (const r of sim.map.routes) {
		const [x0, y0] = r.airFrom;
		const [x1, y1] = r.airTo;
		const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 20);
		for (let k = 0; k <= n; k++) {
			const c = Math.floor((x0 + (x1 - x0) * k / n) / 20);
			const row = Math.floor((y0 + (y1 - y0) * k / n) / 20);
			if (c >= 0 && row >= 0 && c < COLS && row < sim.map.def.rows) out.push(row * COLS + c);
		}
	}
	return out;
}
function routeLength(sim, fields = sim.fields) {
	return sim.map.routes.reduce((a, r, k) => a + fields[k].dist[r.entry[r.entry.length >> 1]], 0);
}
/** WW2 build order: MG-42s as the backbone, anti-tank guns against armour, flak against aircraft. */
function chooseWW2(sim, built) {
	const W = (k) => slot(k);
	const n = (k) => built.get(W(k)) ?? 0;
	const total = [...built.values()].reduce((a, b) => a + b, 0);
	if (sim.wave >= 4 && n("flak38") + 2 * n("flak88") < 1 + total / 7) return W("flak38");
	if (sim.wave >= 2 && n("pak40") + 2 * n("tiger") + 2 * n("flak88") + n("schreck") < 1 + total / 4) {
		if (sim.wave >= 10 && sim.money >= 200) return total % 2 ? W("tiger") : W("flak88");
		return total % 3 === 0 ? W("schreck") : W("pak40");
	}
	if (n("lefh18") > n("observer")) return W("observer");
	if (sim.wave >= 5 && n("workshop") < total / 12) return W("workshop");
	if (sim.money >= 120 && total > 6) {
		const opts = [
			"mortar",
			"lefh18",
			"nebel",
			"mg42",
			"bunker"
		];
		return W(opts[total % opts.length]);
	}
	if (sim.money >= 40 && total % 3 === 2) return W("mortar");
	return W("mg42");
}
function chooseType(sim, built) {
	if (WW2) {
		const t = chooseWW2(sim, built);
		if (sim.allowed(t) && !sim.airLocked(t)) return t;
		return sim.allowed(slot("pak40")) && sim.wave >= 2 ? slot("pak40") : slot("mg42");
	}
	const n = (t) => built.get(t) ?? 0;
	const total = [...built.values()].reduce((a, b) => a + b, 0);
	if (sim.wave >= 4 && n(T.missile) + n(T.flak) < 1 + total / 8) return sim.money >= sim.cost(T.flak) && n(T.flak) <= n(T.missile) ? T.flak : T.missile;
	if (sim.wave >= 6 && n(T.radar) < 1 + sim.map.routes.length - 1) return T.radar;
	if (sim.wave >= 9 && n(T.jammer) < 1) return T.jammer;
	if (sim.money >= 120 && total > 6) {
		const opts = [
			T.tesla,
			T.cannon,
			T.napalm,
			T.laser,
			T.sniper
		];
		return opts[total % opts.length];
	}
	if (sim.money >= 40 && total % 3 === 2) return T.cannon;
	return T.gun;
}
function decide(sim, built) {
	if (WW2) {
		const mortars = sim.towers.filter((t) => t.type === slot("mortar") && !t.wreck);
		for (let k = 0; k < mortars.length; k += 2) if (mortars[k].mode !== 5) sim.exec({
			t: "mode",
			id: mortars[k].id,
			mode: 5
		});
		const hurt = sim.towers.filter((t) => sim.repairCost(t) > 0 && (t.wreck || t.hp < sim.maxHp(t) * .5)).sort((a, b) => Number(b.wreck) - Number(a.wreck) || b.spent - a.spent);
		let fixed = false;
		for (const t of hurt) if (sim.money >= sim.repairCost(t) && sim.exec({
			t: "repair",
			ids: [t.id]
		})) fixed = true;
		if (process.env.DBG && sim.wave >= 13 && sim.wave <= 14 && sim.ticks % 120 === 0) console.log("repair", fixed, hurt.length, sim.money);
		if (fixed) return;
		const dry = sim.towers.filter((t) => sim.usesAmmo(t) && !t.wreck && !sim.supplied(t));
		if (dry.length >= 3) {
			const dep = slot("depot");
			const r = TOWERS[dep].levels[0].range * .8;
			const around = (t) => dry.filter((o) => Math.hypot(o.x - t.x, o.y - t.y) < r).length;
			const at = dry.reduce((a, t) => around(t) > around(a) ? t : a);
			if (around(at) >= 3) {
				if (process.env.DBG && sim.wave >= 13 && sim.wave <= 14 && sim.ticks % 120 === 0) console.log("dry", sim.money, around(at));
				if (sim.money < sim.cost(dep)) return;
				for (const d of [
					30,
					50,
					70,
					90
				]) if (placeAround(sim, dep, at.x, at.y, d, built)) return;
			}
		}
		const shops = built.get(slot("workshop")) ?? 0;
		if (sim.wave >= 5 && shops < sim.towers.length / 12 && sim.money < sim.cost(slot("workshop"))) return;
	}
	const best = [...sim.towers].filter((t) => sim.upgradeCost(t) > 0).sort((a, b) => b.damage - a.damage)[0];
	const needs = WW2 && chooseWW2(sim, built) !== slot("mg42") && chooseWW2(sim, built) !== slot("mortar");
	if (best && !needs && sim.towers.length > 12 && sim.money >= sim.upgradeCost(best) && sim.upgradeCost(best) < 120) {
		sim.exec({
			t: "upgrade",
			ids: [best.id]
		});
		return;
	}
	const type = chooseType(sim, built);
	if (process.env.DBG && sim.wave >= 13 && sim.wave <= 14 && sim.ticks % 120 === 0) console.log("dbg", sim.wave, sim.money, TOWERS[type].kind, sim.cost(type));
	if (sim.money < sim.cost(type)) return;
	const path = WW2 && (type === slot("flak38") || type === slot("flak88")) && sim.wave >= 4 ? airCells(sim) : pathCells(sim);
	if (!path.length) return;
	const r = Math.max(60, TOWERS[type].levels[0].range);
	const before = routeLength(sim);
	let bestScore = -1;
	let bestPos = null;
	const seen = /* @__PURE__ */ new Set();
	for (let k = 0; k < path.length; k += 2) {
		const pc = path[k] % COLS;
		const pr = path[k] / COLS | 0;
		for (const [dc, dr] of [
			[-2, -1],
			[1, -1],
			[-1, -2],
			[-1, 1],
			[-3, -1],
			[2, -1],
			[-1, -3],
			[-1, 2]
		]) {
			const c = pc + dc;
			const row = pr + dr;
			const key = row * COLS + c;
			if (seen.has(key)) continue;
			seen.add(key);
			if (sim.placeStatus(type, c, row) !== "ok") continue;
			const x = (c + 1) * 20;
			const y = (row + 1) * 20;
			let cover = 0;
			for (const p of path) {
				const dx = (p % COLS + .5) * 20 - x;
				const dy = ((p / COLS | 0) + .5) * 20 - y;
				if (dx * dx + dy * dy <= r * r) cover++;
			}
			const prev = sim.preview(type, c, row);
			const gain = prev ? routeLength(sim, prev) - before : 0;
			const score = cover + gain * 1.5;
			if (score > bestScore) {
				bestScore = score;
				bestPos = [c, row];
			}
		}
	}
	if (process.env.DBG && sim.wave >= 13 && sim.wave <= 14) console.log("place", TOWERS[type].kind, bestPos, bestScore, path.length);
	if (bestPos && sim.exec({
		t: "place",
		type,
		col: bestPos[0],
		row: bestPos[1]
	})) built.set(type, (built.get(type) ?? 0) + 1);
}
/** Tries `type` on cells around (x, y) at distance `d`; true if it was built. */
function placeAround(sim, type, x, y, d, built) {
	for (let k = 0; k < 24; k++) {
		const a = k * 2 * Math.PI / 24 + .13 * sim.wave;
		const c = Math.floor((x + Math.cos(a) * d) / 20) - 1;
		const row = Math.floor((y + Math.sin(a) * d) / 20) - 1;
		if (sim.placeStatus(type, c, row) !== "ok") continue;
		if (sim.exec({
			t: "place",
			type,
			col: c,
			row
		})) {
			built.set(type, (built.get(type) ?? 0) + 1);
			return true;
		}
	}
	return false;
}
/**
* WW2: the waves only stop when a headquarters falls, so the bot takes the enemy's: Fire Missions
* and the super-weapon on it, and a few howitzers within reach once the defence can spare them.
*/
function offensive(sim, built) {
	if (sim.gSlot[0] < 0) return;
	const hx = sim.gX[0];
	const hy = sim.gY[0];
	const h = sim.hero;
	if (sim.wave >= 6 && h && h.downT <= 0 && h.cd[0] <= 0) sim.exec({
		t: "heroAbility",
		ability: 0,
		x: hx,
		y: hy
	});
	for (const t of sim.towers) if (TOWERS[t.type].manual && !t.wreck && t.buildT <= 0 && sim.chargeLevel(t) >= 1) sim.exec({
		t: "fire",
		id: t.id,
		x: hx,
		y: hy
	});
	if (sim.wave < 8) return;
	const how = slot("lefh18");
	const range = TOWERS[how].levels[0].range;
	if (sim.towers.filter((t) => t.type === how && Math.hypot(t.x - hx, t.y - hy) < range).length < Math.min(5, 1 + (sim.wave - 8) / 3) && sim.money >= sim.cost(how) + 60 && placeAround(sim, how, hx, hy, range * .85, built)) return;
	const sup = TOWERS.findIndex((t) => t.slot === "super");
	if (sim.wave >= 12 && sim.allowed(sup) && !sim.airLocked(sup) && !sim.towers.some((t) => t.type === sup) && sim.money >= sim.cost(sup) + 100) {
		const base = sim.towers.find((t) => t.base);
		if (base) placeAround(sim, sup, base.x, base.y, 120, built);
	}
}
function play(map, difficulty, seed, battle) {
	const ww2 = battle ? {
		side: battle.side,
		foe: battle.foe,
		battle: battle.id
	} : WW2 ? {
		side: SIDE,
		foe: FOE
	} : void 0;
	const allowed = battle?.banned ? rulesetFor(ww2).towers.map((t, i) => battle.banned.includes(t.slot) ? -1 : i).filter((i) => i >= 0) : void 0;
	const sim = Sim.create({
		map,
		difficulty,
		modifiers: [],
		perks: {},
		seed,
		ww2,
		allowed
	});
	const built = /* @__PURE__ */ new Map();
	const share = Number(process.env.PARTNER ?? 0);
	const solo = !!process.env.SOLO;
	const partner = share || solo ? new Partner(solo ? 1 : share) : null;
	let thinkMs = 0;
	let thinkMax = 0;
	let thinks = 0;
	let slow = 0;
	const leaks = /* @__PURE__ */ new Map();
	sim.exec({ t: "wave" });
	let lastWave = 0;
	for (let tick = 0; tick < 144e3 && !sim.gameOver && !sim.victory; tick++) {
		if (process.env.VERBOSE && sim.wave !== lastWave) {
			lastWave = sim.wave;
			const kinds = /* @__PURE__ */ new Map();
			for (const t of sim.towers) kinds.set(TOWERS[t.type].kind, (kinds.get(TOWERS[t.type].kind) ?? 0) + 1);
			console.log(`  w${sim.wave} t${sim.time | 0}s lives ${sim.lives} money ${sim.money | 0} wrecks ${sim.towers.filter((t) => t.wreck).length} hurt ${sim.towers.filter((t) => t.hp < sim.maxHp(t)).length} towers ${[...kinds].map(([k, n]) => k + n).join(" ")} leaks ${JSON.stringify([...leaks])}`);
		}
		if (tick % 30 === 0 && !solo) decide(sim, built);
		if (WW2 && tick % 30 === 15 && !solo) offensive(sim, built);
		if (partner && tick % 5 === 0) {
			const t0 = performance.now();
			const cmd = partner.think(sim);
			const ms = performance.now() - t0;
			thinkMs += ms;
			thinkMax = Math.max(thinkMax, ms);
			if (ms > 16) slow++;
			thinks++;
			if (cmd) sim.exec(cmd);
		}
		if (tick % 120 === 0 && sim.liveCount > 25 && sim.items[0] > 0) {
			const i = sim.live[0];
			sim.exec({
				t: "item",
				item: 0,
				x: sim.eX[i],
				y: sim.eY[i]
			});
		}
		sim.step();
		for (let k = 0; k < sim.events.length; k += 5) if (sim.events[k] === 3) leaks.set(sim.events[k + 3], (leaks.get(sim.events[k + 3]) ?? 0) + 1);
		sim.events.length = 0;
	}
	if (thinks && process.env.VERBOSE) console.log(`  partner think: avg ${(thinkMs / thinks).toFixed(2)} ms, max ${thinkMax.toFixed(1)} ms, ${slow} over 16 ms, of ${thinks}`);
	if (process.env.VERBOSE) console.log("  leaks by kind", JSON.stringify([...leaks].map(([k, n]) => `${k}:${n}`)));
	if (process.env.VERBOSE && WW2) console.log(`  enemy HQ ${Math.round(100 * sim.enemyHqHealth)}% at ${sim.time | 0}s`);
	return {
		wave: sim.wave,
		win: sim.victory,
		lives: sim.lives,
		towers: sim.towers.length
	};
}
if (process.env.BATTLE) {
	const list = process.env.BATTLE === "all" ? BATTLES : BATTLES.filter((b) => b.id === process.env.BATTLE);
	for (const b of list) for (const d of (process.env.DIFF ?? "easy,normal").split(",")) {
		const t0 = Date.now();
		const r = play(b.map, d, 42, b);
		console.log(`${b.name.padEnd(16)} ${d.padEnd(7)} ${r.win ? "WIN " : "lost"} wave ${String(r.wave).padStart(2)}/${b.waves} lives ${String(r.lives).padStart(2)} towers ${r.towers}  (${((Date.now() - t0) / 1e3).toFixed(1)}s)`);
	}
	process.exit(0);
}
var diffs = (process.env.DIFF ?? "easy,normal,hard").split(",");
var maps = (process.env.MAPS ?? "0,1,2,3,4").split(",").map(Number);
var seeds = Number(process.env.SEEDS ?? 1);
for (const m of maps) for (const d of diffs) for (let k = 0; k < seeds; k++) {
	const t0 = Date.now();
	const r = play(MAPS[m], d, 42 + k);
	console.log(`${MAPS[m].name.padEnd(14)} ${d.padEnd(7)} ${r.win ? "WIN " : "lost"} wave ${String(r.wave).padStart(2)}/30 lives ${String(r.lives).padStart(2)} towers ${r.towers}  (${((Date.now() - t0) / 1e3).toFixed(1)}s)`);
}
//#endregion
export {};
