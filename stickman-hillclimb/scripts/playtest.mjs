/**
 * Stickman hillclimb playtest — Home + Work only.
 * Requires: playwright-core + Chrome. Outputs JSON to stdout and optional --out dir.
 *
 *   node scripts/playtest.mjs [--out artifacts/run-001]
 */
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const OUT = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome =
  process.env.CHROME_PATH ||
  ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) =>
    fs.existsSync(p),
  );

async function shot(page, name) {
  if (!OUT) return null;
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function stickState(page) {
  return page.evaluate(() => {
    const fig = document.querySelector('.sm-figure');
    if (!fig) return { found: false };
    const svg = fig.querySelector('svg.sm-stickman');
    const pose = [...(svg?.classList || [])].find((c) => c.startsWith('pose-')) || null;
    const rect = fig.getBoundingClientRect();
    const dpad = [...document.querySelectorAll('button[aria-label]')].map((b) =>
      b.getAttribute('aria-label'),
    );
    return {
      found: true,
      pose,
      playing: fig.classList.contains('sm-playing'),
      paused: fig.classList.contains('sm-paused'),
      hint: document.querySelector('.sm-play-hint')?.textContent || null,
      grab: document.querySelector('.sm-grab-hint')?.textContent || null,
      rect: { x: +rect.x.toFixed(1), y: +rect.y.toFixed(1), w: +rect.width.toFixed(1), h: +rect.height.toFixed(1) },
      controls: dpad.filter((l) =>
        /left|right|jump|fly|play|pause|character|diagram|follow/i.test(l || ''),
      ),
      anchors: [...document.querySelectorAll('[data-sm-anchor]')].map((e) =>
        e.getAttribute('data-sm-anchor'),
      ),
    };
  });
}

async function enterPlay(page) {
  const play = page.getByRole('button', { name: /Play with the diagram character/i });
  if (await play.count()) {
    await play.click();
    await sleep(600);
    return 'gamepad';
  }
  const box = await page.locator('.sm-figure').boundingBox();
  if (box) {
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height * 0.35);
    await sleep(600);
    return 'dblclick';
  }
  return null;
}

async function exercisePlay(page, tag) {
  const log = [];
  const push = async (msg) => {
    const state = await stickState(page);
    log.push({ msg, ...state });
  };

  await push(`${tag}:before-play`);
  const how = await enterPlay(page);
  await push(`${tag}:entered:${how}`);
  await shot(page, `${tag}-01-play`);

  await page.keyboard.down('ArrowRight');
  await sleep(900);
  await page.keyboard.up('ArrowRight');
  await push(`${tag}:walk-right`);
  await shot(page, `${tag}-02-walk`);

  await page.keyboard.press(' ');
  await sleep(280);
  await push(`${tag}:jump`);
  await shot(page, `${tag}-03-jump`);

  await page.keyboard.press('ArrowUp');
  await sleep(110);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.down('ArrowUp');
  await sleep(1400);
  await push(`${tag}:fly`);
  await shot(page, `${tag}-04-fly`);
  await page.keyboard.down('ArrowLeft');
  await sleep(800);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('ArrowUp');
  await sleep(700);
  await push(`${tag}:after-fly`);

  // D-pad persistence check (~8s into play)
  await sleep(5000);
  await push(`${tag}:dpad-after-8s`);

  await page.keyboard.press('Escape');
  await sleep(400);
  await push(`${tag}:escape`);

  // idle timeout probe
  await enterPlay(page);
  await page.keyboard.down('ArrowRight');
  await sleep(200);
  await page.keyboard.up('ArrowRight');
  await sleep(3500);
  const early = await stickState(page);
  await sleep(5500);
  const late = await stickState(page);
  log.push({
    msg: `${tag}:idle-probe`,
    playingAt3_5s: early.playing,
    playingAt9s: late.playing,
  });

  return log;
}

async function scrollTour(page, tag) {
  const stops = [];
  const heights = await page.evaluate(() => document.documentElement.scrollHeight);
  for (const y of [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((f) => Math.round(heights * f))) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await sleep(900);
    const s = await stickState(page);
    stops.push({ scrollY: y, pose: s.pose, y: s.rect?.y, playing: s.playing });
    await shot(page, `${tag}-scroll-${y}`);
  }
  return stops;
}

const report = { startedAt: new Date().toISOString(), pages: {}, notes: [] };

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,900'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'no-preference',
});
const page = await context.newPage();

try {
  for (const route of ['/', '/work']) {
    await page.goto(`https://smartfunction.io${route}`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    await sleep(2000);
    const mount = await stickState(page);
    const tour = await scrollTour(page, route === '/' ? 'home' : 'work');
    const play = mount.found ? await exercisePlay(page, route === '/' ? 'home' : 'work') : [];
    report.pages[route] = { mount, tour, play };
  }

  // Heuristic flags for the agent
  const homePlay = report.pages['/']?.play || [];
  const dpadLate = homePlay.find((e) => e.msg?.includes('dpad-after-8s'));
  const idle = homePlay.find((e) => e.msg?.includes('idle-probe'));
  report.flags = {
    mountedHome: !!report.pages['/']?.mount?.found,
    mountedWork: !!report.pages['/work']?.mount?.found,
    dpadPersists8s: !!(dpadLate?.controls || []).some((c) => /Step left|Jump|Step right/i.test(c)),
    idleStillPlayingAt3_5s: idle?.playingAt3_5s === true,
    idleStillPlayingAt9s: idle?.playingAt9s === true,
    flyObserved: homePlay.some((e) => e.pose === 'pose-fly'),
  };

  const json = JSON.stringify(report, null, 2);
  console.log(json);
  if (OUT) fs.writeFileSync(path.join(OUT, 'report.json'), json);
} finally {
  await browser.close();
}
