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
    plan.push([12, { t: 'train', id: 1, unit: window.game.unitIndex('grenadier') }]);
    plan.push([900, { t: 'unitMove', ids: [1], x: 500, y: 600 }], [1300, { t: 'unitStance', ids: [1], stance: 2 }]);
    // and the newer orders: pioneers laying mines, digging in, a recon flight
    plan.push([1000, { t: 'train', id: 1, unit: window.game.unitIndex('pioneer') }], [1700, { t: 'unitMines', ids: [2], x: 520, y: 640 }]);
    plan.push([2000, { t: 'unitDig', ids: [1] }], [2600, { t: 'heroAbility', ability: 2, x: 600, y: 500 }], [2700, { t: 'heroAbility', ability: 0, x: 600, y: 500 }]);
    for (let w = 0; w < 6; w++) plan.push([10 + w * 700, { t: 'wave' }]);
    plan.sort((p, q) => p[0] - q[0]);
    plan.push([1500, { t: 'upgrade', ids: [2] }]);
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

  check(errors.length === 0, `no page errors${errors.length ? ':\n  ' + errors.join('\n  ') : ''}`);
} catch (e) {
  check(false, `exception: ${e.message}`);
} finally {
  await browser.close();
  await server.close();
}
process.exit(fail.length ? 1 : 0);
