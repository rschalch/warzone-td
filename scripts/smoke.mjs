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

  check(errors.length === 0, `no page errors${errors.length ? ':\n  ' + errors.join('\n  ') : ''}`);
} catch (e) {
  check(false, `exception: ${e.message}`);
} finally {
  await browser.close();
  await server.close();
}
process.exit(fail.length ? 1 : 0);
