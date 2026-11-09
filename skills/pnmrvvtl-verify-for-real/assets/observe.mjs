#!/usr/bin/env node
// Walks every interactive element in a scope, in a real browser, under two profiles, and records what each click really
// does: URL, scroll, nodes rebuilt, console errors, failed requests. Then opens each resulting URL fresh. The caller does
// not choose what to watch, so the URL cannot be forgotten. This is the floor: add task-specific checks on top of it.
//
//   node observe.mjs --base http://localhost:3000 --path /blog/x --scope "#content a"
//   node observe.mjs --base ... --path ... --scope "#menu a" --open ".menuButton" --profile bad --reopen 8
//
// Run from the project, so Playwright resolves from its node_modules. Exit code 1 means a violation was found.
// Flags: --base --path --scope (required); --open selector clicked before every action; --profile fast|bad|both (both);
// --settle ms to watch after a click (2500); --reopen how many distinct URLs to open fresh (5); --limit (no limit);
// --skip regex of labels never to click, added to the built-in list; --width --height; --out json report file.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).join('\u0000').split(/\u0000?--/).filter(Boolean).map((part) => {
  const [key, ...rest] = part.split('\u0000');
  return [key, rest.join(' ') || 'true'];
}));
for (const required of ['base', 'path', 'scope']) {
  if (!args[required]) {
    console.error(`missing --${required}`);
    process.exit(2);
  }
}
const SETTLE = +(args.settle ?? 2500);
const REOPEN = +(args.reopen ?? 5);
const LIMIT = +(args.limit ?? Infinity);
const VIEWPORT = { width: +(args.width ?? 1440), height: +(args.height ?? 900) };
// Never clicked: anything that could change data or leave a trace outside the page.
const DANGEROUS = /delete|remove|pay|buy|checkout|submit|send|publish|log ?out|sign ?out|unsubscribe|видал|оплат|надісл/i;
const SKIP = args.skip ? new RegExp(args.skip, 'i') : null;
const PROFILES = {
  // Warm cache after the first load, fast images, overlay scrollbars. Catches races where something ends too early.
  fast: { repeat: 1, classicScrollbars: false, imageDelay: 0, cpu: 1, network: null },
  // Cold, slow images, slow network and CPU, classic scrollbars, several runs: what a real first visit gets.
  bad: { repeat: 3, classicScrollbars: true, imageDelay: 800, cpu: 4, network: { latency: 150, downloadThroughput: 187500, uploadThroughput: 93750 } },
};
const names = !args.profile || args.profile === 'both' ? ['fast', 'bad'] : [args.profile];

const { chromium } = createRequire(join(process.cwd(), 'package.json'))('playwright');
const violations = [];
const stats = {};
const report = (profile, label, rule, detail) => {
  violations.push({ profile, label, rule, detail });
  console.log(`  ${rule} [${profile}] ${label}: ${detail}`);
};

// Installed before the code of the page runs, so each frame is read after the page's own callbacks: what gets painted.
const recorder = () => {
  const nativeFrame = window.requestAnimationFrame.bind(window);
  // Keyed by frame time: the last read of a frame wins, the one after every callback of that frame, so what gets painted.
  const rec = { frames: new Map(), on: false, armed: false, nodes: [], shift: 0 };
  window.__observe = rec;
  const sample = (time) => {
    if (!rec.on) return;
    // With a target, its place on screen is what the reader sees: the page may correct itself under a target that stands.
    const target = rec.target && document.getElementById(rec.target);
    rec.frames.set(time, { href: location.href, y: Math.round(target ? -target.getBoundingClientRect().top : window.scrollY) });
  };
  window.requestAnimationFrame = (callback) => nativeFrame((time) => {
    callback(time);
    sample(time);
  });
  const tick = (time) => {
    sample(time);
    nativeFrame(tick);
  };
  nativeFrame(tick);
  document.addEventListener('click', () => {
    if (rec.armed) {
      rec.armed = false;
      rec.on = true;
    }
  }, true);
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (rec.on && !entry.hadRecentInput) rec.shift += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: false });
  } catch { /* not in every browser */ }
};

// Taken before --open, so a menu closing after the click is not counted as the page being rebuilt.
const snapshotNodes = (page) => page.evaluate(() => {
  window.__observe.nodes = [...document.querySelectorAll('h1, h2, h3, h4, img, p')].slice(0, 400);
});

const arm = (page, target) => page.evaluate((id) => {
  const rec = window.__observe;
  rec.frames = new Map();
  rec.shift = 0;
  rec.target = id;
  rec.armed = true;
}, target);

const collect = (page) => page.evaluate(() => {
  const rec = window.__observe;
  rec.on = false;
  return { frames: [...rec.frames.values()], shift: rec.shift, lost: rec.nodes.filter((node) => !node.isConnected).length, total: rec.nodes.length };
});

const enumerate = (page, scope) => page.evaluate(({ scope: selector, dangerous, skip }) => {
  const danger = new RegExp(dangerous, 'i');
  const skipped = skip ? new RegExp(skip, 'i') : null;
  return [...document.querySelectorAll(selector)].map((element, index) => {
    const label = (element.getAttribute('href') || element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 60);
    const href = element.getAttribute('href') ?? '';
    let reason = null;
    if (!element.getClientRects().length) reason = 'hidden';
    else if (element.matches('[disabled], [aria-disabled="true"]')) reason = 'disabled';
    else if (element.matches('[type="submit"], form button:not([type="button"])')) reason = 'submits a form';
    else if (danger.test(`${label} ${element.textContent}`)) reason = 'could change data';
    else if (skipped?.test(label)) reason = '--skip';
    else if (/^(https?:)?\/\//.test(href) && !href.startsWith(location.origin)) reason = 'external link';
    else if (element.target === '_blank') reason = 'new tab';
    return { index, label, reason };
  });
}, { scope, dangerous: DANGEROUS.source, skip: SKIP?.source ?? null });

const stops = (frames) => {
  const moves = frames.map((frame, i) => (i ? frame.y - frames[i - 1].y : 0));
  const first = moves.findIndex(Boolean);
  if (first < 0) return { passes: 0, back: 0 };
  let last = moves.length - 1;
  while (!moves[last]) last--;
  const direction = Math.sign(frames[last].y - frames[first].y);
  let passes = 1;
  let still = 0;
  for (const move of moves.slice(first, last + 1)) {
    if (move) {
      if (still >= 4) passes++;
      still = 0;
    } else still++;
  }
  return { passes, back: moves.slice(first, last + 1).filter((move) => Math.sign(move) === -direction && Math.abs(move) > 1).length };
};

for (const name of names) {
  const profile = PROFILES[name];
  const browser = await chromium.launch(profile.classicScrollbars ? { ignoreDefaultArgs: ['--hide-scrollbars'] } : {});
  const newPage = async () => {
    const context = await browser.newContext({ viewport: VIEWPORT });
    await context.addCookies([{ name: 'cookie-consent', value: 'true', url: args.base }]);
    const page = await context.newPage();
    await page.addInitScript(recorder);
    const session = await context.newCDPSession(page);
    if (profile.cpu > 1) await session.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
    if (profile.network) {
      await session.send('Network.enable');
      await session.send('Network.emulateNetworkConditions', { offline: false, ...profile.network });
    }
    if (profile.imageDelay) {
      await page.route(/\.(png|jpe?g|webp|avif)(\?|$)|_next\/image/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, profile.imageDelay));
        await route.continue();
      });
    }
    page.problems = [];
    page.on('pageerror', (error) => page.problems.push(`pageerror ${error.message.slice(0, 120)}`));
    page.on('console', (message) => {
      if (message.type() === 'error') page.problems.push(`console ${message.text().slice(0, 120)}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 500) page.problems.push(`HTTP ${response.status()} ${response.url().slice(0, 100)}`);
    });
    return page;
  };
  const load = async (page) => {
    await page.goto(args.base + args.path, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
  };
  const openScope = async (page) => {
    if (!args.open) return;
    await page.mouse.move(5, 5);
    await page.locator(args.open).first().click({ force: true });
    await page.waitForTimeout(700);
  };

  const stat = { elements: 0, clicked: 0, skipped: {}, reopened: 0 };
  stats[name] = stat;
  const urls = new Map();
  console.log(`profile ${name}`);
  for (let run = 0; run < profile.repeat; run++) {
    const page = await newPage();
    await load(page);
    const startPath = new URL(page.url()).pathname;
    await openScope(page);
    const elements = await enumerate(page, args.scope);
    if (args.open) {
      await page.keyboard.press('Escape');
      await page.mouse.click(5, 300);
      await page.waitForTimeout(500);
    }
    if (!elements.length) report(name, args.scope, 'SCOPE', 'found no elements: the selector is wrong or the page did not render');
    if (run === 0) {
      stat.elements = elements.length;
      for (const { reason } of elements) if (reason) stat.skipped[reason] = (stat.skipped[reason] ?? 0) + 1;
    }
    let done = 0;
    for (const { index, label, reason } of elements) {
      if (reason || done >= LIMIT) continue;
      done++;
      // A wheel is how a reader takes over, so anything still animating or holding from the last click lets go.
      await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
      await page.mouse.wheel(0, 1);
      await snapshotNodes(page);
      await openScope(page);
      const target = page.locator(args.scope).nth(index);
      await target.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
      await arm(page, label.startsWith('#') ? decodeURIComponent(label.slice(1)) : null);
      page.problems.length = 0;
      const before = page.url();
      try {
        await target.click({ force: true, timeout: 5000 });
      } catch (error) {
        report(name, label, 'CLICK', error.message.split('\n')[0].slice(0, 120));
        continue;
      }
      await page.waitForTimeout(SETTLE);
      const { frames, shift, lost, total } = await collect(page);
      if (run === 0) stat.clicked++;
      const after = page.url();
      const hrefs = [...new Set(frames.map((frame) => frame.href))];
      const samePage = new URL(after).pathname === startPath;
      // F12: one click gives one URL. Passing through others means the address bar was wrong for a while.
      if (hrefs.length > 1) report(name, label, 'F12', `URL changed ${hrefs.length - 1} times after the click: ${hrefs.slice(0, 4).map((h) => new URL(h).pathname + new URL(h).hash).join(' > ')}`);
      const declared = label.startsWith('#') ? label : null;
      if (declared && new URL(after).hash !== declared) report(name, label, 'F12', `link says ${declared}, the URL says ${new URL(after).hash || '(no hash)'}`);
      if (after !== before || declared) urls.set(after, label);
      // F13: a click on this page must update the page, not rebuild it.
      if (samePage && lost) report(name, label, 'F13', `${lost} of ${total} sampled nodes were rebuilt`);
      // F14: one continuous movement.
      const { passes, back } = stops(frames);
      if (passes > 1) report(name, label, 'F14', `the page moved in ${passes} separate passes`);
      if (back) report(name, label, 'F14', `${back} frames moved against the direction of travel`);
      if (shift > 0.1) report(name, label, 'F9', `layout shift ${shift.toFixed(3)} after the click`);
      // F10: no errors the UI did not expect.
      for (const problem of [...new Set(page.problems)]) report(name, label, 'F10', problem);
      if (!samePage) {
        await load(page);
      }
    }
    await page.context().close();
  }
  // F12, second half: the URL is a promise. Opened fresh it must stay the same and show what it names.
  for (const [url, label] of [...urls].slice(0, REOPEN)) {
    const page = await newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(SETTLE + 1500);
    stat.reopened++;
    if (page.url() !== url) report(name, label, 'F12', `opened ${url}, it became ${page.url()}`);
    const hash = new URL(url).hash.slice(1);
    if (hash) {
      const place = await page.evaluate((id) => {
        const element = document.getElementById(decodeURIComponent(id));
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { inView: rect.top >= -2 && rect.top < window.innerHeight, top: Math.round(rect.top) };
      }, hash);
      if (!place) report(name, label, 'F12', `opened fresh, #${hash} has no element on the page`);
      else if (!place.inView) report(name, label, 'F12', `opened fresh, #${hash} is at ${place.top}px, outside the screen`);
    }
    await page.context().close();
  }
  await browser.close();
  console.log(`  elements ${stat.elements}, clicked ${stat.clicked} of ${stat.elements}, skipped ${JSON.stringify(stat.skipped)}, opened fresh ${stat.reopened}, runs ${profile.repeat}`);
}

console.log(`violations ${violations.length}`);
if (args.out) writeFileSync(args.out, JSON.stringify({ args, stats, violations }, null, 2));
process.exit(violations.length ? 1 : 0);
