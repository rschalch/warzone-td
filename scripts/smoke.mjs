// End-to-end smoke test: starts a Vite dev server, drives the game in headless Chrome through the
// real UI, and checks determinism (replay + save/restore). Exits non-zero on any failure.
//   npm run smoke            (needs Google Chrome installed; uses it via playwright-core)

import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5288, strictPort: true }, logLevel: 'error' });
await server.listen();
const url = 'http://localhost:5288/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(`console: ${m.text()}`);
});
const fail = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) fail.push(what);
};

try {
  // boot and start a campaign game through the menus
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForSelector('[data-go="maps"]', { timeout: 30000 });
  check(true, `menu up in ${Date.now() - t0} ms`);
  await page.click('[data-go="maps"]');
  await page.click('[data-map="0"]');
  await page.click('[data-start]');
  await page.waitForFunction(() => window.game.sim);

  // build with real clicks, then select the tower by clicking it
  const box = await page.locator('#stage > canvas').first().boundingBox();
  await page.keyboard.press('1');
  await page.mouse.click(box.x + 600, box.y + 400);
  await page.mouse.click(box.x + 600, box.y + 400);
  await page.waitForTimeout(100);
  check(await page.evaluate(() => window.game.sim.towers.length) === 1, 'click builds a tower');
  check((await page.locator('#info .title').innerText()).includes('Lv 1/10'), 'clicking the tower selects it');

  // sound controls in the top bar: next track, mute (the button and K), music volume shared with the settings
  const track0 = await page.locator('#trackname').innerText();
  await page.click('#nexttrack');
  await page.waitForTimeout(100);
  const track1 = await page.locator('#trackname').innerText();
  await page.click('#mute');
  await page.waitForTimeout(50);
  const mutedBtn = await page.locator('#mute').evaluate((b) => b.classList.contains('off'));
  await page.keyboard.press('k');
  await page.waitForTimeout(50);
  const unmuted = !(await page.locator('#mute').evaluate((b) => b.classList.contains('off')));
  await page.locator('#musicvol').fill('0.3');
  const vol = await page.evaluate(() => JSON.parse(localStorage.getItem('wztd.settings') ?? '{}').music);
  check(track0 !== track1 && mutedBtn && unmuted && vol === 0.3, `top bar sound: next track (${track0} → ${track1}), mute and K, music volume saved (${vol})`);

  // play a couple of waves at 4x
  await page.keyboard.press('n');
  await page.click('[data-speed="4"]');
  await page.waitForTimeout(5000);
  const st = await page.evaluate(() => ({ wave: window.game.sim.wave, ticks: window.game.sim.ticks }));
  check(st.wave >= 1 && st.ticks > 600, `game runs (wave ${st.wave}, ${st.ticks} ticks)`);

  // determinism: replay the command log and restore a snapshot, compare state hashes
  const det = await page.evaluate(() => {
    const { Session, Sim, session } = window.game;
    const cfg = { ...session.config, seed: 99 };
    const a = new Session(cfg);
    a.speed = 4;
    const plan = [[0, { t: 'place', type: 0, col: 20, row: 30 }], [5, { t: 'place', type: 1, col: 24, row: 30 }], [10, { t: 'wave' }], [900, { t: 'upgrade', ids: [1] }]];
    let k = 0;
    while (a.sim.ticks < 2400) {
      while (k < plan.length && plan[k][0] <= a.sim.ticks) a.issue(plan[k++][1]);
      a.advance(1 / 240);
    }
    const hashA = a.sim.stateHash();
    const b = new Session(cfg, { replay: a.log });
    b.speed = 4;
    while (b.sim.ticks < a.sim.ticks) b.advance(1 / 240);
    const replayOk = a.log.length > 0 && b.sim.ticks === a.sim.ticks && b.sim.stateHash() === hashA;
    const c = Sim.restore(structuredClone(a.sim.snapshot()));
    for (let n = 0; n < 600; n++) {
      a.sim.step();
      c.step();
    }
    return { replay: replayOk, restore: a.sim.stateHash() === c.stateHash() };
  });
  check(det.replay, 'replaying the command log reproduces the game exactly');
  check(det.restore, 'save/restore stays identical to the original');

  // co-op with AI: the partner builds on its own, and its commands replay exactly
  const ai = await page.evaluate(() => {
    const { Session, Sim, session } = window.game;
    const cfg = { ...session.config, seed: 7, partner: 0.5 };
    const a = new Session(cfg);
    a.speed = 4;
    a.issue({ t: 'wave' });
    while (a.sim.ticks < 3600) a.advance(1 / 240);
    const owned = (s) => s.towers.filter((t) => t.owner === 1).map((t) => t.id).join(',');
    const b = new Session(cfg, { replay: a.log });
    b.speed = 4;
    while (b.sim.ticks < a.sim.ticks) b.advance(1 / 240);
    const c = Sim.restore(structuredClone(a.sim.snapshot()));
    return {
      built: a.sim.towers.filter((t) => t.owner === 1).length,
      replay: b.partner === null && b.sim.stateHash() === a.sim.stateHash() && owned(b.sim) === owned(a.sim),
      restore: owned(c) === owned(a.sim),
    };
  });
  check(ai.built >= 3, `AI partner builds on its own (${ai.built} towers)`);
  check(ai.replay && ai.restore, 'AI partner games replay and restore exactly');

  // WW2 mode: its own arsenal, armour penetration, and the same determinism guarantees
  await page.evaluate(() => window.game.quick(0, 'normal', true));
  await page.waitForFunction(() => window.game.sim?.config.ww2 && document.querySelector('#build .tb .n')?.textContent === 'MG-42', null, { timeout: 30000 });
  check(true, 'WW2 game starts with the German arsenal');
  // the sidebar: every button label fits (palette tiles, the PaK's five targeting modes, the barracks' training)
  const fits = await page.evaluate(async () => {
    const g = window.game;
    const s = g.sim;
    const spot = (type) => {
      for (let k = 0; k < 600; k++) {
        const t = s.place(type, 20 + (k % 30), 20 + Math.floor(k / 30), true);
        if (t) return t;
      }
      return null;
    };
    const cut = [];
    const scan = (sel) => document.querySelectorAll(sel).forEach((b) => {
      for (const el of [b, ...b.querySelectorAll('b, small')]) if (el.scrollWidth > el.clientWidth + 1) cut.push(b.textContent.trim());
    });
    for (const kind of ['pak40', 'barracks']) {
      g.select(spot(g.towerIndex(kind)));
      await new Promise((r) => setTimeout(r, 150));
      scan('#info .row button');
    }
    g.select(null);
    const tiles = document.querySelectorAll('#build .tb').length;
    return { cut, tiles };
  });
  check(fits.cut.length === 0 && fits.tiles >= 26, `sidebar: ${fits.tiles} tower tiles, every panel button fits${fits.cut.length ? ' — cut: ' + fits.cut.join(', ') : ''}`);
  const ww2 = await page.evaluate(() => {
    const { Session, Sim, session } = window.game;
    const cfg = { ...session.config, seed: 5, difficulty: 'normal' }; // Normal: the enemy also breaches walls
    // ballistics: an MG-42 can't hurt a T-34; a Panzerschreck goes through from any side
    const s = Sim.create(cfg);
    const mg = s.place(window.game.towerIndex('mg42'), 10, 10, true);
    const schreck = s.place(window.game.towerIndex('schreck'), 14, 10, true);
    const t34 = s.spawnEnemy(7, 1);
    s.eX[t34] = 300; s.eY[t34] = 230;
    const hp = s.eHp[t34];
    s.damage(t34, 50, false, mg);
    const mgHurt = hp - s.eHp[t34];
    s.damage(t34, 50, false, schreck);
    const atHurt = hp - mgHurt - s.eHp[t34];
    // return fire: a T-34 in range shells an MG nest; a repair restores it
    const f = Sim.create(cfg);
    const nest = f.place(window.game.towerIndex('mg42'), 20, 20, true);
    const tank = f.spawnEnemy(7, 1);
    f.eX[tank] = nest.x + 60; f.eY[tank] = nest.y; f.eSpeed[tank] = 0; // close enough to spot the camouflaged nest
    for (let n = 0; n < 900 && !nest.wreck; n++) f.step();
    const shelled = nest.hp < f.maxHp(nest);
    // camouflage: a tank doesn't see a sniper 100 px away; a recon jeep does
    const h = Sim.create(cfg);
    const sn = h.place(window.game.towerIndex('sniper'), 20, 20, true);
    const tk = h.spawnEnemy(7, 1);
    h.eX[tk] = sn.x + 100; h.eY[tk] = sn.y; h.eSpeed[tk] = 0;
    for (let n = 0; n < 300; n++) h.step();
    const unseen = h.towerHidden(sn) && sn.hp === h.maxHp(sn);
    const jeep = h.spawnEnemy(4, 1);
    h.eX[jeep] = sn.x + 70; h.eY[jeep] = sn.y; h.eSpeed[jeep] = 0;
    for (let n = 0; n < 30; n++) h.step();
    const spotted = !h.towerHidden(sn);
    f.money = 1000;
    f.freeEnemy?.(tank);
    const repaired = f.exec({ t: 'repair', ids: [nest.id] }) && nest.hp === f.maxHp(nest) && !nest.wreck;
    // replay and restore through tanks, aircraft and suppression
    const a = new Session(cfg);
    a.speed = 4;
    const T = window.game.towerIndex;
    const plan = [[0, { t: 'place', type: T('mg42'), col: 20, row: 30 }], [2, { t: 'place', type: T('pak40'), col: 24, row: 30 }], [4, { t: 'place', type: T('mortar'), col: 20, row: 34 }], [6, { t: 'place', type: T('wire'), col: 28, row: 31 }]];
    // units: a barracks, a grenadier squad sent forward, then set to hunt
    const barracks = window.game.towerIndex('barracks');
    let bc = 32, br = 22;
    for (let k = 0; k < 400 && !s.canPlace(barracks, bc, br); k++) { bc = 30 + (k % 20); br = 18 + Math.floor(k / 20); }
    plan.unshift([0, { t: 'place', type: barracks, col: bc, row: br }]);
    // the headquarters stand already (ids from 1): the barracks is the next tower
    const B = a.sim.towers.length + 1;
    plan.push([12, { t: 'train', id: B, unit: window.game.unitIndex('grenadier') }]);
    plan.push([900, { t: 'unitMove', ids: [1], x: 500, y: 600 }], [1300, { t: 'unitStance', ids: [1], stance: 2 }]);
    // and the newer orders: pioneers laying mines, digging in, a recon flight
    plan.push([1000, { t: 'train', id: B, unit: window.game.unitIndex('pioneer') }], [1700, { t: 'unitMines', ids: [2], x: 520, y: 640 }]);
    plan.push([2000, { t: 'unitDig', ids: [1] }], [2600, { t: 'heroAbility', ability: 2, x: 600, y: 500 }], [2700, { t: 'heroAbility', ability: 0, x: 600, y: 500 }]);
    for (let w = 0; w < 6; w++) plan.push([10 + w * 700, { t: 'wave' }]);
    plan.sort((p, q) => p[0] - q[0]);
    plan.push([1500, { t: 'upgrade', ids: [B + 1] }]);
    let k = 0;
    while (a.sim.ticks < 4800 && !a.sim.gameOver) {
      while (k < plan.length && plan[k][0] <= a.sim.ticks) a.issue(plan[k++][1]);
      a.advance(1 / 240);
    }
    const b = new Session(cfg, { replay: a.log });
    b.speed = 4;
    while (b.sim.ticks < a.sim.ticks) b.advance(1 / 240);
    const replay = b.sim.ticks === a.sim.ticks && b.sim.stateHash() === a.sim.stateHash();
    const c = Sim.restore(structuredClone(a.sim.snapshot()));
    for (let n = 0; n < 600; n++) {
      a.sim.step();
      c.step();
    }
    const units = a.sim.nextUnitUid - 1;
    // dig-in, veterancy, mine-laying, the recon flight, infantry over dragon's teeth
    const d = Sim.create(cfg);
    const UI = window.game.unitIndex;
    const gren = d.spawnUnit(UI('grenadier'), 400, 400, 10 * 60);
    d.exec({ t: 'unitDig', ids: [d.uUid[gren]] });
    for (let n = 0; n < 300; n++) d.step();
    const dug = d.uDig[gren] >= 1;
    d.uKills[gren] = 8;
    const vet = d.unitVet(gren);
    const pio = d.spawnUnit(UI('pioneer'), 300, 300, 9 * 60);
    d.money = 1000;
    const mineSlot = (t) => window.game.towerDef(t.type).slot === 'atmine';
    d.exec({ t: 'unitMines', ids: [d.uUid[pio]], x: 340, y: 300 });
    for (let n = 0; n < 900; n++) d.step();
    const mines = d.towers.filter(mineSlot).length;
    const foe = d.spawnEnemy(0, 1);
    d.eX[foe] = 700; d.eY[foe] = 700; d.eSpeed[foe] = 0;
    d.step(); // into the spatial hash
    d.hero.cd[2] = 0;
    d.exec({ t: 'heroAbility', ability: 2, x: 700, y: 700 });
    const marked = d.eMarkT[foe] > 0;
    const teeth = d.place(window.game.towerIndex('teeth'), 25, 25, true);
    d.step();
    const cell = 25 * window.game.COLS + 25;
    const climb = !!teeth && d.fields[0].dist[cell] === Infinity && d.foot[0].dist[cell] < Infinity;
    return { dug, vet, mines, marked, climb, unseen, spotted, units, shelled, repaired, mgHurt, atHurt, wave: a.sim.wave, kills: a.sim.totalKills, replay, restore: a.sim.stateHash() === c.stateHash() };
  });
  check(ww2.mgHurt === 0 && ww2.atHurt > 0, `WW2 armour: MG-42 bounces off a T-34 (${ww2.mgHurt}), Panzerschreck goes through (${Math.round(ww2.atHurt)})`);
  check(ww2.shelled && ww2.repaired, `WW2 return fire: a T-34 shells an MG nest (${ww2.shelled}), repair restores it (${ww2.repaired})`);
  check(ww2.wave >= 6 && ww2.kills > 0, `WW2 waves run (wave ${ww2.wave}, ${ww2.kills} kills)`);
  // every playable matchup: a full arsenal, and waves that run without errors
  const matchups = await page.evaluate(() => {
    const { Sim, session } = window.game;
    const out = [];
    for (const [side, foe] of [['de', 'su'], ['su', 'de'], ['de', 'us'], ['us', 'de'], ['us', 'jp'], ['jp', 'us']]) {
      try {
        const s = Sim.create({ ...session.config, seed: 9, difficulty: 'normal', ww2: { side, foe } });
        s.money = 5000;
        const types = window.game.towerDef ? [...Array(30).keys()].filter((t) => window.game.towerDef(t)).length : 0;
        for (let t = 0; t < 8; t++) s.place(t, 8 + t * 3, 10, true);
        s.exec({ t: 'wave' });
        for (let n = 0; n < 2400; n++) {
          if (n % 600 === 599) s.exec({ t: 'wave' });
          s.step();
        }
        out.push(`${side}-${foe}:${types}:${s.wave}:${s.totalKills}`);
      } catch (e) {
        out.push(`${side}-${foe}:error ${e.message}`);
      }
    }
    Sim.create(session.config); // the running game's ruleset back
    return out;
  });
  check(matchups.every((m) => /:26:\d+:\d+$/.test(m)), `WW2 matchups run (${matchups.join(' ')})`);
  // a campaign battle: pre-built positions, the objective, and exact replays and restores with them
  const battle = await page.evaluate(() => {
    const { Session, Sim, session } = window.game;
    const omaha = { ...session.config, map: window.game.BATTLES.find((b) => b.id === 'omaha').map, seed: 3, difficulty: 'normal', ww2: { side: 'de', foe: 'us', battle: 'omaha' } };
    const a = new Session(omaha);
    const preset = a.sim.towers.length;
    a.speed = 4;
    a.issue({ t: 'wave' });
    while (a.sim.ticks < 2400 && !a.sim.gameOver) a.advance(1 / 240);
    const b = new Session(omaha, { replay: a.log });
    b.speed = 4;
    while (b.sim.ticks < a.sim.ticks) b.advance(1 / 240);
    const replay = b.sim.ticks === a.sim.ticks && b.sim.stateHash() === a.sim.stateHash();
    const c = Sim.restore(structuredClone(a.sim.snapshot()));
    const towers = c.towers.length === a.sim.towers.length;
    for (let n = 0; n < 300; n++) {
      a.sim.step();
      c.step();
    }
    const st = window.game.BATTLES.find((b) => b.id === 'stalingrad');
    const s2 = Sim.create({ ...session.config, map: st.map, seed: 4, difficulty: 'normal', ww2: { side: 'su', foe: 'de', battle: 'stalingrad' } });
    const objective = s2.objectiveId > 0 && s2.totalWaves === 25;
    Sim.create(session.config);
    return { preset, objective, replay, restore: towers && a.sim.stateHash() === c.stateHash() };
  });
  check(battle.preset >= 10 && battle.objective, `WW2 campaign: Omaha's bunkers are dug in (${battle.preset}), Stalingrad has its objective (${battle.objective})`);
  check(battle.replay && battle.restore, `WW2 battles replay (${battle.replay}) and restore (${battle.restore}) exactly`);
  check(ww2.unseen && ww2.spotted, `WW2 camouflage: a tank misses a hidden sniper (${ww2.unseen}), a recon jeep spots it (${ww2.spotted})`);
  check(ww2.units >= 2, `WW2 units: the barracks trains squads (${ww2.units})`);
  check(ww2.dug && ww2.vet === 2 && ww2.mines >= 1, `WW2 units dig in (${ww2.dug}), gain veterancy (${ww2.vet}), pioneers lay mines (${ww2.mines})`);
  check(ww2.marked && ww2.climb, `WW2 recon flight marks attackers (${ww2.marked}); infantry climb dragon's teeth, tanks can't (${ww2.climb})`);
  // the AI partner in WW2: builds from the arsenal, and replays exactly
  const ai2 = await page.evaluate(() => {
    const { Session, Sim, session } = window.game;
    const cfg = { ...session.config, seed: 8, partner: 0.5 };
    const a = new Session(cfg);
    a.speed = 4;
    a.issue({ t: 'wave' });
    while (a.sim.ticks < 3600) a.advance(1 / 240);
    const owned = (s) => s.towers.filter((t) => t.owner === 1).map((t) => t.id).join(',');
    const b = new Session(cfg, { replay: a.log });
    b.speed = 4;
    while (b.sim.ticks < a.sim.ticks) b.advance(1 / 240);
    const c = Sim.restore(structuredClone(a.sim.snapshot()));
    Sim.create(session.config);
    return { built: a.sim.towers.filter((t) => t.owner === 1).length, replay: b.sim.stateHash() === a.sim.stateHash() && owned(b.sim) === owned(a.sim), restore: owned(c) === owned(a.sim) };
  });
  check(ai2.built >= 3 && ai2.replay && ai2.restore, `WW2 AI partner builds (${ai2.built} positions), replays (${ai2.replay}) and restores (${ai2.restore})`);
  check(ww2.replay && ww2.restore, 'WW2 games replay and restore exactly (with units)');

  // WW2 bases: both headquarters stand, the attackers march on ours and stay, building takes time, theirs falls for a win
  const bases = await page.evaluate(() => {
    const { Sim, session } = window.game;
    const s = Sim.create({ ...session.config, seed: 5, difficulty: 'normal', ww2: { side: 'de', foe: 'su' } });
    const hq = s.towers.find((t) => t.base > 0);
    const theirs = s.gSlot[0] >= 0 && s.garrisonAlive >= 3;
    s.money = 5000;
    let mg = null;
    for (let k = 0; k < 400 && !mg; k++) mg = s.place(0, 30 + (k % 20), 10 + Math.floor(k / 20));
    const building = !!mg && mg.buildT > 0;
    const zone = !s.canPlace(0, Math.floor(s.gX[0] / 20), Math.floor(s.gY[0] / 20) + 2);
    s.exec({ t: 'wave' });
    let leaked = 0;
    let reached = false;
    for (let n = 0; n < 60 * 90; n++) {
      s.step();
      for (let k = 0; k < s.events.length; k += 5) if (s.events[k] === 3) leaked++;
      s.events.length = 0;
      for (let m = 0; m < s.liveCount; m++) {
        const i = s.live[m];
        if (s.eGar[i] < 0 && Math.hypot(s.eX[i] - hq.x, s.eY[i] - hq.y) < 70) reached = true;
      }
    }
    // they got to it and fought (its own guns may cut them down before they do it any harm)
    const hurt = hq.hp < s.maxHp(hq) || reached;
    const fieldOk = s.attackers === s.liveCount - s.garrisonAlive - s.convoyAlive;
    const i = s.gSlot[0];
    s.damage(i, 1e9, true, null, false, 999);
    s.step();
    return { hq: !!hq, theirs, building, built: !!mg && mg.buildT === 0, zone, leaked, hurt, fieldOk, won: s.victory };
  });
  check(bases.hq && bases.theirs, `WW2 bases: our headquarters (${bases.hq}) and theirs with its guns (${bases.theirs})`);
  check(bases.leaked === 0 && bases.hurt && bases.fieldOk, `WW2 bases: attackers march on the HQ and fight it (hurt ${bases.hurt}, ${bases.leaked} leaked)`);
  check(bases.building && bases.built && bases.zone, `WW2 bases: emplacements take time to build (${bases.building} → ${bases.built}), none on the enemy's ground (${bases.zone})`);
  check(bases.won, 'WW2 bases: destroying the enemy headquarters wins');

  // supply: a gun out of reach runs dry, a depot refills it, the depot calls a truck from the HQ; the enemy's dump and convoy
  const supply = await page.evaluate(() => {
    const { Sim, session, towerIndex, enemyDef } = window.game;
    const cfg = { ...session.config, seed: 5, difficulty: 'normal', ww2: { side: 'de', foe: 'su' }, map: { ...session.config.map, rocks: 0, rivers: 0, mountains: 0, forests: 0 } };
    const s = Sim.create(cfg);
    s.hero = null;
    const hq = s.towers.find((t) => t.base);
    let mortar = null;
    for (let k = 0; k < 2000 && !mortar; k++) {
      const c = 10 + (k % 60);
      const r = 8 + Math.floor(k / 60);
      if (Math.hypot((c + 1) * 20 - hq.x, (r + 1) * 20 - hq.y) > 500) mortar = s.place(towerIndex('mortar'), c, r, true);
    }
    const e = s.spawnEnemy(0, 5);
    let shots = 0;
    for (let n = 0; n < 60 * 120 && mortar.ammo > 0; n++) {
      s.eX[e] = mortar.x + 120; s.eY[e] = mortar.y; s.eHp[e] = s.eMaxHp[e]; s.eSpeed[e] = 0;
      mortar.fix = 0; // (no counter-battery fire in this test)
      s.step();
      for (let k = 0; k < s.events.length; k += 5) if (s.events[k] === 0 && s.events[k + 1] === mortar.x) shots++;
      s.events.length = 0;
    }
    const dry = mortar.ammo <= 0 && !s.supplied(mortar);
    s.eHp[e] = 0; s.damage(e, 1e9, true, null);
    let depot = null;
    for (let k = 0; k < 200 && !depot; k++) depot = s.place(towerIndex('depot'), mortar.col + 3 + (k % 10), mortar.row - 4 + Math.floor(k / 10), true);
    for (let n = 0; n < 600; n++) s.step();
    const refilled = mortar.ammo > 0.5;
    depot.ammo = 0.3;
    let truck = false;
    for (let n = 0; n < 60 * 150 && depot.ammo < 1; n++) {
      s.step();
      for (let u = 0; u < 192; u++) if (s.uAlive[u] && s.uTask[u] === depot.id) truck = true;
    }
    // the enemy: burning their dump cuts their supply, and a starved wave is smaller
    const f = Sim.create(cfg);
    let dump = -1;
    for (let g = 0; g < 16; g++) if (f.gKind[g] >= 0 && enemyDef(f.gKind[g]).fixed === 'depot') dump = g;
    const size = () => f.waveGroups(8).reduce((a, g) => a + g.count, 0);
    const full = size();
    f.damage(f.gSlot[dump], 1e9, true, null, false, 999);
    f.step();
    f.foeSupply = 0;
    const starved = size();
    f.exec({ t: 'wave' });
    let convoy = 0;
    for (let n = 0; n < 60 * 40; n++) {
      f.step();
      convoy = Math.max(convoy, f.convoyAlive);
    }
    return { shots, dry, refilled, truck, store: depot.ammo, dump: dump >= 0, full, starved, convoy, cleared: f.attackers === f.liveCount - f.garrisonAlive - f.convoyAlive };
  });
  check(supply.dry && supply.shots > 5 && supply.refilled, `WW2 supply: a mortar out of reach runs dry (${supply.shots} rounds), a depot refills it (${supply.refilled})`);
  check(supply.truck && supply.store >= 1, `WW2 supply: the depot calls a truck from the HQ and is refilled (${supply.truck}, store ${supply.store.toFixed(2)})`);
  check(supply.dump && supply.starved < supply.full && supply.convoy > 0 && supply.cleared, `WW2 supply: their dump stands, a starved wave is smaller (${supply.full} → ${supply.starved}), their trucks drive (${supply.convoy})`);

  // morale: a shattered squad falls back and leaves, a pinned one surrenders, the officer's fall shakes his wave, our losses shake our crews
  const morale = await page.evaluate(() => {
    const { Sim, session, towerIndex, enemyDef } = window.game;
    const cfg = { ...session.config, seed: 5, difficulty: 'normal', ww2: { side: 'de', foe: 'su' } };
    const s = Sim.create(cfg);
    s.hero = null;
    const officer = Array.from({ length: 40 }, (_, k) => k).find((k) => enemyDef(k)?.officer);
    const a = s.spawnEnemy(0, 5);
    for (let n = 0; n < 60; n++) s.step();
    s.eHp[a] = s.eMaxHp[a] * 0.1;
    let fell = false;
    const lives = s.lives;
    for (let n = 0; n < 60 * 120 && s.eAlive[a]; n++) {
      s.eSupp[a] = 0;
      s.step();
      if (s.eRetreat[a]) fell = true;
    }
    const gone = !s.eAlive[a] && s.lives === lives;
    const b = s.spawnEnemy(0, 5);
    for (let n = 0; n < 60; n++) s.step();
    const money = s.money;
    s.eHp[b] = s.eMaxHp[b] * 0.1;
    for (let n = 0; n < 60 * 20 && s.eAlive[b]; n++) {
      s.eSupp[b] = 1;
      s.step();
    }
    const surrendered = !s.eAlive[b] && s.money > money;
    const o = s.spawnEnemy(officer, 7);
    const men = [s.spawnEnemy(0, 7), s.spawnEnemy(0, 7)];
    s.step();
    const before = s.eMorale[men[0]];
    s.damage(o, 1e9, true, null);
    const shaken = before - s.eMorale[men[0]] >= 0.3;
    const t1 = s.place(towerIndex('mg42'), 30, 30, true);
    const t2 = s.place(towerIndex('mg42'), 33, 30, true);
    s.exec({ t: 'sell', ids: [] });
    t1.hp = 1;
    s.hitDefender?.(t1.id, 100, 99, 0, false);
    s.step();
    return { officer: officer >= 0, fell, gone, surrendered, shaken, crew: t2.supp > 0.2 && t2.shakeT > 0 };
  });
  check(morale.fell && morale.gone && morale.surrendered, `WW2 morale: a shattered squad falls back and leaves (${morale.fell}, ${morale.gone}), a pinned one surrenders (${morale.surrendered})`);
  check(morale.officer && morale.shaken && morale.crew, `WW2 morale: the officer's fall shakes his wave (${morale.shaken}), a lost position shakes the crews nearby (${morale.crew})`);

  // line of sight and fog: an MG holds fire at a soldier behind trees and fires at one in the open; out of sight, they're in the fog
  const los = await page.evaluate(() => {
    const { Sim, session, towerIndex } = window.game;
    const cfg = { ...session.config, seed: 5, difficulty: 'normal', ww2: { side: 'de', foe: 'su' } };
    const s = Sim.create(cfg);
    s.hero = null;
    const cols = window.game.COLS;
    let mg = null;
    let hid = null;
    let open = null;
    for (let k = 0; k < 4000 && !(mg && hid && open); k++) {
      const c = 4 + (k % (cols - 8));
      const r = 4 + Math.floor(k / (cols - 8));
      mg = s.place(towerIndex('mg42'), c, r, true);
      if (!mg) continue;
      hid = open = null;
      const range = s.stats(mg).range;
      for (let a = 0; a < 64 && !(hid && open); a++) {
        const x = mg.x + Math.cos(a / 10) * range * 0.8;
        const y = mg.y + Math.sin(a / 10) * range * 0.8;
        const cell = Math.floor(y / 20) * cols + Math.floor(x / 20);
        if (s.blocked[cell] || s.sightBlock[cell]) continue;
        if (s.clearLine(mg.x, mg.y, x, y)) open ??= [x, y];
        else hid ??= [x, y];
      }
      if (!(hid && open)) {
        s.exec({ t: 'sell', ids: [mg.id] });
        mg = null;
      }
    }
    if (!mg) return { found: false };
    const fire = (at) => {
      const e = s.spawnEnemy(0, 3);
      let shots = 0;
      let why = '';
      for (let n = 0; n < 120; n++) {
        s.eX[e] = s.ePx[e] = at[0]; s.eY[e] = s.ePy[e] = at[1]; s.eSpeed[e] = 0; s.eHp[e] = s.eMaxHp[e]; s.eSeenT[e] = 0;
        s.step();
        for (let k = 0; k < s.events.length; k += 5) if (s.events[k] === 0 && s.events[k + 1] === mg.x) shots++;
        s.events.length = 0;
        if (n === 60) why = s.fireStatus(mg);
      }
      const seen = s.seen(e);
      s.damage(e, 1e9, true, null);
      return { shots, why, seen };
    };
    const a = fire(hid);
    const b = fire(open);
    return { found: true, blindShots: a.shots, why: a.why, openShots: b.shots, openSeen: b.seen };
  });
  check(los.found && los.blindShots === 0 && los.openShots > 0 && los.why.startsWith('No line of sight') && los.openSeen,
    `WW2 line of sight: an MG holds fire at a soldier behind trees (${los.blindShots} shots: ${los.why?.slice(0, 18)}…) and fires in the open (${los.openShots})`);

  // combined arms: riflemen pair up with a tank; a lone tank gets close-assaulted by an MG nest; smoke ahead of an assault on a bunker
  const arms = await page.evaluate(() => {
    const { Sim, session, towerIndex } = window.game;
    const cfg = { ...session.config, seed: 5, difficulty: 'normal', ww2: { side: 'de', foe: 'su' }, map: { ...session.config.map, rocks: 0, rivers: 0, mountains: 0, forests: 0 } };
    const s = Sim.create(cfg);
    s.hero = null;
    const tank = s.spawnEnemy(7, 6);
    const men = [s.spawnEnemy(0, 6), s.spawnEnemy(1, 6), s.spawnEnemy(0, 6)];
    for (let n = 0; n < 60 * 6; n++) s.step();
    const paired = men.filter((m) => s.eLead[m] === tank).length;
    const escorted = s.eEscort[tank] === 1;
    const f = Sim.create(cfg);
    f.hero = null;
    const mg = f.place(towerIndex('mg42'), 30, 30, true);
    const t = f.spawnEnemy(7, 6);
    const hp = f.eHp[t];
    for (let n = 0; n < 120; n++) {
      f.eX[t] = mg.x + 30; f.eY[t] = mg.y; f.eSpeed[t] = 0;
      f.step();
    }
    const assaulted = f.eHp[t] < hp;
    const g = Sim.create(cfg);
    g.hero = null;
    const bunker = g.place(towerIndex('bunker'), 30, 30, true);
    bunker.knownT = 99; bunker.seenT = 99;
    const k = g.spawnEnemy(7, 6);
    for (let n = 0; n < 30; n++) {
      g.eX[k] = bunker.x + 160; g.eY[k] = bunker.y; g.eSpeed[k] = 0;
      g.step();
    }
    return { paired, escorted, assaulted, smoke: g.smCount > 0 };
  });
  check(arms.paired >= 2 && arms.escorted, `WW2 combined arms: riflemen escort the tank (${arms.paired} paired, escorted ${arms.escorted})`);
  check(arms.assaulted && arms.smoke, `WW2 combined arms: an MG nest close-assaults a lone tank (${arms.assaulted}), smoke ahead of an assault on a bunker (${arms.smoke})`);

  // counter-battery: their battery is hidden; after a few salvos of our mortar it answers on it and gives itself away
  const cb = await page.evaluate(() => {
    const { Sim, session, towerIndex, enemyDef } = window.game;
    const cfg = { ...session.config, seed: 5, difficulty: 'normal', ww2: { side: 'de', foe: 'su' }, map: { ...session.config.map, rocks: 0, rivers: 0, mountains: 0, forests: 0 } };
    const s = Sim.create(cfg);
    s.hero = null;
    let g = -1;
    for (let k = 0; k < 16; k++) if (s.gKind[k] >= 0 && enemyDef(s.gKind[k]).fixed === 'arty') g = k;
    const battery = s.gSlot[g];
    const hidden = !s.seen(battery);
    const mortar = s.place(towerIndex('mortar'), 30, 30, true);
    const e = s.spawnEnemy(0, 3);
    let answered = false;
    for (let n = 0; n < 60 * 30 && !answered; n++) {
      s.eX[e] = mortar.x + 100; s.eY[e] = mortar.y; s.eHp[e] = s.eMaxHp[e]; s.eSpeed[e] = 0;
      s.step();
      for (let r = 0; r < s.rkCount; r++) if (Math.hypot(s.rkTx[r] - mortar.x, s.rkTy[r] - mortar.y) < 40) answered = true;
    }
    return { battery: g >= 0, hidden, answered, revealed: s.seen(battery) };
  });
  check(cb.battery && cb.hidden && cb.answered && cb.revealed, `WW2 counter-battery: their hidden battery (${cb.hidden}) answers our mortar (${cb.answered}) and gives itself away (${cb.revealed})`);

  // hulks: a knocked-out tank stays (blocking or slowing its cell), shelters infantry, blocks fire, is cleared by engineers; saves and restores
  const hulk = await page.evaluate(() => {
    const { Sim, session, towerIndex, unitIndex } = window.game;
    const cfg = { ...session.config, seed: 5, difficulty: 'normal', ww2: { side: 'de', foe: 'su' }, map: { ...session.config.map, rocks: 0, rivers: 0, mountains: 0, forests: 0 } };
    const s = Sim.create(cfg);
    s.hero = null;
    const tank = s.spawnEnemy(7, 6);
    for (let n = 0; n < 60 * 8; n++) s.step();
    const x = s.eX[tank];
    const y = s.eY[tank];
    s.damage(tank, 1e9, true, null, false, 999);
    const made = s.hkCount === 1;
    const c = s.hkCell[0];
    const cx = (c % s.map.def.cols + 0.5) * 20;
    const cy = (Math.floor(c / s.map.def.cols) + 0.5) * 20;
    // a rifle squad next to it takes less from the same burst than one in the open
    const a = s.spawnEnemy(0, 3);
    const b = s.spawnEnemy(0, 3);
    s.eX[a] = cx + 20; s.eY[a] = cy; s.eX[b] = cx + 200; s.eY[b] = cy + 200;
    s.step();
    const ha = s.eHp[a];
    const hb = s.eHp[b];
    s.damage(a, 5, true, null);
    s.damage(b, 5, true, null);
    const covered = ha - s.eHp[a] < hb - s.eHp[b];
    const blocksFire = !s.clearLine(cx - 60, cy, cx + 60, cy);
    // save and restore with it, the same game afterwards
    const r = Sim.restore(structuredClone(s.snapshot()));
    for (let n = 0; n < 300; n++) {
      s.step();
      r.step();
    }
    const same = s.stateHash() === r.stateHash() && r.hkCount === s.hkCount;
    // an engineer clears it
    s.money = 5000;
    let bar = null;
    for (let k = 0; k < 900 && !bar; k++) bar = s.place(towerIndex('barracks'), Math.floor(cx / 20) + (k % 30) - 15, Math.floor(cy / 20) + Math.floor(k / 30) - 15, true);
    let cleared = false;
    if (bar) {
      s.exec({ t: 'train', id: bar.id, unit: unitIndex('pioneer') });
      let sent = false;
      for (let n = 0; n < 60 * 70 && !cleared; n++) { // (well before it would burn out by itself)
        s.step();
        if (!sent && s.unitVersion > 0) {
          for (let u = 0; u < 192; u++) if (s.uAlive[u]) sent = s.exec({ t: 'unitMove', ids: [s.uUid[u]], x: cx + 30, y: cy });
        }
        cleared = s.hkCount === 0;
      }
    }
    return { made, blocks: s.hkBlock[0], covered, blocksFire, same, cleared, x, y };
  });
  check(hulk.made && hulk.covered && hulk.blocksFire, `WW2 hulks: a knocked-out tank stays (${hulk.made}), shelters infantry (${hulk.covered}) and blocks fire (${hulk.blocksFire})`);
  check(hulk.same && hulk.cleared, `WW2 hulks: restore exactly with them (${hulk.same}); engineers clear them (${hulk.cleared})`);

  // night and weather: an MG reaches less far at night, a mortar's flares light the target up again; fog grounds the aircraft
  const dark = await page.evaluate(() => {
    const { Sim, session, towerIndex } = window.game;
    const map = { ...session.config.map, rocks: 0, rivers: 0, mountains: 0, forests: 0 };
    const cfg = { ...session.config, seed: 5, difficulty: 'normal', ww2: { side: 'de', foe: 'su' }, map };
    const shots = (night, flare) => {
      const s = Sim.create(cfg);
      s.hero = null;
      if (night) s.time = 15 * 30; // 23:00
      const mg = s.place(towerIndex('mg42'), 30, 30, true);
      let mortar = null;
      if (flare) {
        mortar = s.place(towerIndex('mortar'), 32, 34, true);
        s.exec({ t: 'mode', id: mortar.id, mode: 5 });
      }
      const e = s.spawnEnemy(0, 3);
      let n = 0;
      for (let k = 0; k < 60 * 6; k++) {
        s.eX[e] = s.ePx[e] = mg.x + s.stats(mg).range * 0.9; s.eY[e] = s.ePy[e] = mg.y; s.eSpeed[e] = 0; s.eHp[e] = s.eMaxHp[e];
        s.step();
        for (let j = 0; j < s.events.length; j += 5) if (s.events[j] === 0 && s.events[j + 1] === mg.x) n++;
        s.events.length = 0;
      }
      return { n, night: s.night, flares: s.flCount };
    };
    const day = shots(false, false);
    const night = shots(true, false);
    const lit = shots(true, true);
    const arnhem = window.game.BATTLES.find((b) => b.id === 'arnhem');
    const f = Sim.create({ ...cfg, ww2: { side: 'us', foe: 'de', battle: 'arnhem' }, map: arnhem.map });
    const strike = window.game.towerDef ? Array.from({ length: 30 }, (_, k) => k).find((k) => window.game.towerDef(k)?.slot === 'strike') : -1;
    return { day: day.n, night: night.n, nightLevel: night.night, lit: lit.n, flares: lit.flares, fog: f.weather === 'fog', grounded: strike >= 0 && f.airLocked(strike), noAir: f.waveGroups(5).every((g) => !window.game.enemyDef(g.kind).air) };
  });
  check(dark.day > 0 && dark.night === 0 && dark.nightLevel === 1 && dark.lit > 0 && dark.flares > 0, `WW2 night: an MG fires at 90% of its range by day (${dark.day}), not at night (${dark.night}), again under a mortar's flares (${dark.lit})`);
  check(dark.fog && dark.grounded && dark.noAir, `WW2 weather: fog at Arnhem grounds our aircraft (${dark.grounded}) and theirs (${dark.noAir})`);

  // a moving front: our soldiers take a knocked-out MG nest of theirs; their ground shrinks; they counter-attack; losing it gives it back
  const front = await page.evaluate(() => {
    const { Sim, session, unitIndex, enemyDef } = window.game;
    const cfg = { ...session.config, seed: 5, difficulty: 'normal', ww2: { side: 'de', foe: 'su' }, map: { ...session.config.map, rocks: 0, rivers: 0, mountains: 0, forests: 0 } };
    const s = Sim.create(cfg);
    s.hero = null;
    let g = -1;
    for (let k = 0; k < 16; k++) if (s.gKind[k] >= 0 && enemyDef(s.gKind[k]).fixed === 'mg') g = k;
    const x = s.gX[g];
    const y = s.gY[g];
    const zoneBefore = s.enemyGround(x, y);
    s.damage(s.gSlot[g], 1e9, true, null, false, 999);
    // keep the field round it clear of attackers for the test
    for (let n = 0; n < s.liveCount; n++) { const i = s.live[n]; if (s.eGar[i] < 0) s.eX[i] = s.eY[i] = 5; }
    const u = s.spawnUnit(unitIndex('grenadier') >= 0 ? unitIndex('grenadier') : 0, x, y, Math.floor(y / 20) * window.game.COLS + Math.floor(x / 20));
    let t = null;
    for (let n = 0; n < 60 * 8 && !t; n++) {
      s.uX[u] = x; s.uY[u] = y; s.uHp[u] = 999;
      for (let m = 0; m < s.liveCount; m++) { const i = s.live[m]; if (s.eGar[i] < 0 && Math.hypot(s.eX[i] - x, s.eY[i] - y) < 90) s.eX[i] = s.eY[i] = 5; }
      s.step();
      if (s.gOwn[g]) t = s.tower(s.gOwn[g]);
    }
    if (!t) return { taken: false };
    const zoneAfter = s.enemyGround(x, y);
    let hunters = 0;
    for (let n = 0; n < 60 * 25 && !hunters; n++) {
      t.hp = s.maxHp(t); // (their base's guns would otherwise knock it out first)
      s.step();
      for (let m = 0; m < s.liveCount; m++) if (s.eHunt[s.live[m]] === t.id) hunters++;
    }
    s.hitDefender(t.id, 1e9, 999, 0, true);
    s.step();
    return { taken: true, from: t.fromG === g, zoneBefore, zoneAfter, hunters, back: s.gKind[g] >= 0 && !s.gOwn[g] && !s.tower(t.id) };
  });
  check(front.taken && front.from && front.zoneBefore, `WW2 front: our soldiers take a knocked-out MG nest of theirs (${front.taken})`);
  check(front.hunters > 0 && front.back, `WW2 front: they counter-attack it (${front.hunters}) and get it back when it falls (${front.back})`);

  // weapon ranges: one gun per role fires at a soldier at 95% of the range it shows; an MG holds fire at a tank's front and says why
  const ranges = await page.evaluate(() => {
    const { Sim, session, towerIndex } = window.game;
    const cfg = { ...session.config, seed: 5, difficulty: 'normal', ww2: { side: 'de', foe: 'su' }, map: { ...session.config.map, rocks: 0, rivers: 0, mountains: 0, forests: 0 } };
    const roles = new Map();
    const silent = [];
    for (const kind of ['mg42', 'schreck', 'sniper', 'flamer', 'pak40', 'flak88', 'bunker', 'mortar', 'lefh18', 'nebel']) {
      const s = Sim.create(cfg);
      s.hero = null;
      const t = s.place(towerIndex(kind), 30, 30, true);
      if (!t) { silent.push(`${kind}:unplaced`); continue; }
      roles.set(t.kind, kind);
      const r = s.stats(t).range;
      const x = t.x + r * 0.95;
      if (t.kind === 'arty') s.place(towerIndex('observer'), Math.floor(x / 20) - 1, 34, true);
      const e = s.spawnEnemy(0, 5);
      let fired = false;
      for (let n = 0; n < 600 && !fired; n++) {
        s.eX[e] = s.ePx[e] = x; s.eY[e] = s.ePy[e] = t.y; s.eSpeed[e] = 0; s.eHp[e] = s.eMaxHp[e];
        s.step();
        for (let k = 0; k < s.events.length; k += 5) if (s.events[k] === 0 && s.events[k + 1] === t.x && s.events[k + 2] === t.y) fired = true;
        s.events.length = 0;
      }
      if (!fired) silent.push(kind);
    }
    const s = Sim.create(cfg);
    const mg = s.place(towerIndex('mg42'), 30, 30, true);
    const tank = s.spawnEnemy(7, 1);
    s.eX[tank] = mg.x + s.stats(mg).range * 0.9; s.eY[tank] = mg.y; s.eAng[tank] = Math.PI; s.eSpeed[tank] = 0;
    s.step();
    s.eX[tank] = mg.x + s.stats(mg).range * 0.9; s.eY[tank] = mg.y;
    return { silent, roles: roles.size, why: s.fireStatus(mg) };
  });
  check(ranges.silent.length === 0 && ranges.roles >= 7, `WW2 ranges: every role fires at 95% of its range (${ranges.roles} roles${ranges.silent.length ? ', silent: ' + ranges.silent.join(' ') : ''})`);
  check(ranges.why.startsWith('Holding fire'), `WW2 ranges: an MG explains why it holds fire at a tank (${ranges.why.slice(0, 40)}…)`);

  // October 2026 fixes: the HQ compound, scouts, crew ranks and accuracy
  const late = await page.evaluate(() => {
    const { Sim, session, towerIndex, unitIndex } = window.game;
    const cfg = { ...session.config, seed: 5, difficulty: 'normal', ww2: { side: 'de', foe: 'su' } };
    const s = Sim.create(cfg);
    const hq = s.towers.find((t) => t.base > 0);
    // a scout roams by itself, unseen, and uncovers ground no tower sees
    const k = unitIndex('de_scout');
    const u = s.spawnUnit(k, hq.x - 80, hq.y + 80, -1);
    const seen0 = s.seenGrid.reduce((a, v) => a + v, 0);
    let maxSeen = seen0;
    for (let n = 0; n < 60 * 25; n++) {
      s.step();
      if (n % 60 === 0) maxSeen = Math.max(maxSeen, s.seenGrid.reduce((a, v) => a + v, 0));
    }
    const moved = Math.hypot(s.uX[u] - (hq.x - 80), s.uY[u] - (hq.y + 80));
    // crews: kills make ranks; a seasoned crew at level 10 hits more often
    const c = Sim.create(cfg);
    const mg = c.place(towerIndex('pak40'), 30, 30, true);
    const r = c.stats(mg).range;
    const green = c.hitChance(mg, r, r, false);
    mg.level = 9;
    mg.kills = 60;
    return { size: hq.size, scoutHidden: s.unitHidden(u), moved, uncovered: maxSeen - seen0, green, elite: c.hitChance(mg, r, r, false), rank: c.crewRank(mg) };
  });
  check(late.size === 5, `WW2 HQ: our headquarters is a 5×5 compound (${late.size})`);
  // the two headquarters stand across the map from each other, on every map (random ones too)
  const apart = await page.evaluate(() => {
    const { Sim, session, MAPS, randomMap } = window.game;
    const maps = [...MAPS, ...[1, 5, 9, 11].map((seed) => randomMap({ seed: seed * 7, size: 'S', routes: 3, density: 1, terrain: 1 }))];
    let worst = 9;
    for (const map of maps) {
      const s = Sim.create({ ...session.config, map, seed: 3, difficulty: 'normal', ww2: { side: 'de', foe: 'su' } });
      const hq = s.towers.find((t) => t.base);
      worst = Math.min(worst, Math.hypot(hq.x - s.gX[0], hq.y - s.gY[0]) / Math.hypot(s.map.def.cols, s.map.def.rows) / 20);
    }
    return worst;
  });
  check(apart > 0.6, `WW2 HQ: ours stands across the map from theirs (at least ${Math.round(apart * 100)}% of the diagonal apart)`);
  // a panel button still takes a click when the panel is rebuilt while it is held down
  const tid = await page.evaluate(() => {
    const { sim, towerIndex, select } = window.game;
    sim.money += 5000;
    let t = null;
    for (let r = 10; !t && r < 50; r++) for (let c = 20; !t && c < 70; c++) t = sim.place(towerIndex('mg42'), c, r, true);
    select(t);
    window.__bump = setInterval(() => (t.damage += 60), 30);
    return t.id;
  });
  await page.waitForTimeout(200);
  const up = await page.evaluate(() => { const b = document.querySelector('#info [data-act="up"]').getBoundingClientRect(); return [b.left + 4, b.top + 4]; });
  const lv0 = await page.evaluate((id) => window.game.sim.towerById.get(id).level, tid);
  await page.mouse.move(up[0], up[1]); await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up();
  await page.waitForTimeout(250);
  const lv1 = await page.evaluate((id) => { clearInterval(window.__bump); return window.game.sim.towerById.get(id).level; }, tid);
  check(lv1 === lv0 + 1, `UI: a held panel button isn't rebuilt under the pointer (upgrade by its edge: ${lv0} → ${lv1})`);
  check(late.scoutHidden && late.moved > 100 && late.uncovered > 100, `WW2 scouts: stay hidden (${late.scoutHidden}), roam (${Math.round(late.moved)} px) and uncover ground (${late.uncovered} cells)`);
  check(late.rank === 3 && late.elite > late.green, `WW2 crews: kills make an Elite crew (${late.rank}), which hits more (${Math.round(late.green * 100)}% → ${Math.round(late.elite * 100)}%)`);

  check(errors.length === 0, `no page errors${errors.length ? ':\n  ' + errors.join('\n  ') : ''}`);
} catch (e) {
  check(false, `exception: ${e.message}`);
} finally {
  await browser.close();
  await server.close();
}
process.exit(fail.length ? 1 : 0);
