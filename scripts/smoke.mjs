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
    const cfg = { ...session.config, seed: 5, difficulty: 'easy' };
    // ballistics: an MG-42 can't hurt a T-34; a Panzerschreck goes through from any side
    const s = Sim.create(cfg);
    const mg = s.place(0, 10, 10, true);
    const schreck = s.place(2, 14, 10, true);
    const t34 = s.spawnEnemy(7, 1);
    s.eX[t34] = 300; s.eY[t34] = 230;
    const hp = s.eHp[t34];
    s.damage(t34, 50, false, mg);
    const mgHurt = hp - s.eHp[t34];
    s.damage(t34, 50, false, schreck);
    const atHurt = hp - mgHurt - s.eHp[t34];
    // return fire: a T-34 in range shells an MG nest; a repair restores it
    const f = Sim.create(cfg);
    const nest = f.place(0, 20, 20, true);
    const tank = f.spawnEnemy(7, 1);
    f.eX[tank] = nest.x + 120; f.eY[tank] = nest.y; f.eSpeed[tank] = 0;
    for (let n = 0; n < 900 && !nest.wreck; n++) f.step();
    const shelled = nest.hp < f.maxHp(nest);
    f.money = 1000;
    f.freeEnemy?.(tank);
    const repaired = f.exec({ t: 'repair', ids: [nest.id] }) && nest.hp === f.maxHp(nest) && !nest.wreck;
    // replay and restore through tanks, aircraft and suppression
    const a = new Session(cfg);
    a.speed = 4;
    const plan = [[0, { t: 'place', type: 0, col: 20, row: 30 }], [2, { t: 'place', type: 5, col: 24, row: 30 }], [4, { t: 'place', type: 9, col: 20, row: 34 }], [6, { t: 'place', type: 17, col: 28, row: 31 }]];
    for (let w = 0; w < 6; w++) plan.push([10 + w * 700, { t: 'wave' }]);
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
    return { shelled, repaired, mgHurt, atHurt, wave: a.sim.wave, kills: a.sim.totalKills, replay, restore: a.sim.stateHash() === c.stateHash() };
  });
  check(ww2.mgHurt === 0 && ww2.atHurt > 0, `WW2 armour: MG-42 bounces off a T-34 (${ww2.mgHurt}), Panzerschreck goes through (${Math.round(ww2.atHurt)})`);
  check(ww2.shelled && ww2.repaired, `WW2 return fire: a T-34 shells an MG nest (${ww2.shelled}), repair restores it (${ww2.repaired})`);
  check(ww2.wave >= 6 && ww2.kills > 0, `WW2 waves run (wave ${ww2.wave}, ${ww2.kills} kills)`);
  check(ww2.replay && ww2.restore, 'WW2 games replay and restore exactly');

  check(errors.length === 0, `no page errors${errors.length ? ':\n  ' + errors.join('\n  ') : ''}`);
} catch (e) {
  check(false, `exception: ${e.message}`);
} finally {
  await browser.close();
  await server.close();
}
process.exit(fail.length ? 1 : 0);
