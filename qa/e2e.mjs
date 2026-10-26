import { chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const extensionPath = join(projectRoot, '.output', 'chrome-mv3');
const profile = await mkdtemp(join(tmpdir(), 'x-ad-hider-e2e-'));
const mark = 'data-x-ad-hider-hidden';
const fixture = `<!doctype html><html><meta charset="utf-8"><body>
  <main id="timeline">
    <div id="advert" data-testid="cellInnerDiv"><article><span>広告</span><div data-testid="tweetText">広告の本文</div></article></div>
    <div id="ordinary" data-testid="cellInnerDiv"><article><div data-testid="tweetText"><span>広告</span>について考える</div></article></div>
    <div id="username" data-testid="cellInnerDiv"><article><div data-testid="User-Name"><span>広告</span></div><div data-testid="tweetText">普通の投稿</div></article></div>
    <div id="video" data-testid="cellInnerDiv"><article><div data-testid="tweetText">普通の動画</div><div data-testid="tweetPhoto"><div data-testid="videoPlayer"><div data-testid="placementTracking"></div></div></div></article></div>
    <div id="quote" data-testid="cellInnerDiv"><article><div data-testid="tweetText">引用</div><article><span data-testid="promotedIndicator"></span></article></article></div>
    <div id="marker" data-testid="cellInnerDiv"><article><div data-testid="promotedIndicator"></div></article></div>
  </main>
</body></html>`;

const options = {
  executablePath: process.env.CHROME_BIN || undefined,
  channel: process.env.CHROME_BIN ? undefined : 'chromium',
  headless: true,
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--no-first-run', '--no-default-browser-check',
  ],
  viewport: { width: 1200, height: 900 },
};

let context;
try {
  context = await chromium.launchPersistentContext(profile, options);
  await context.route('https://x.com/**', route => route.fulfill({
    status: 200, contentType: 'text/html; charset=utf-8', body: fixture,
  }));
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
  await page.locator(`#advert[${mark}]`).waitFor({ state: 'attached' });
  const display = async id => page.locator(`#${id}`).evaluate(el => getComputedStyle(el).display);
  assert.equal(await display('advert'), 'none');
  for (const id of ['ordinary', 'username', 'video', 'quote']) assert.notEqual(await display(id), 'none', id);
  assert.equal(await display('marker'), 'none', 'marker-only ads must hide');

  // React dynamically appends posts, then changes the same article into a
  // different organic post without replacing the virtualized timeline cell.
  await page.evaluate(() => {
    document.getElementById('timeline').insertAdjacentHTML('beforeend',
      '<div id="dynamic" data-testid="cellInnerDiv"><article><span>Promoted</span></article></div>');
  });
  await page.locator(`#dynamic[${mark}]`).waitFor({ state: 'attached' });
  await page.evaluate(() => { document.querySelector('#dynamic span').textContent = 'Not an ad'; });
  await page.waitForFunction(key => !document.querySelector('#dynamic').hasAttribute(key), mark);
  assert.notEqual(await display('dynamic'), 'none');
  await page.evaluate(() => { document.querySelector('#dynamic span').textContent = '広告'; });
  await page.locator(`#dynamic[${mark}]`).waitFor({ state: 'attached' });

  // An SPA navigation can replace the complete timeline.
  await page.evaluate(() => {
    history.pushState({}, '', '/search?q=test');
    document.getElementById('timeline').innerHTML =
      '<div id="after-nav" data-testid="cellInnerDiv"><article><span>Sponsored</span></article></div>' +
      '<div id="after-nav-normal" data-testid="cellInnerDiv"><article><div data-testid="tweetText">広告ではない</div></article></div>';
  });
  await page.locator(`#after-nav[${mark}]`).waitFor({ state: 'attached' });
  assert.notEqual(await display('after-nav-normal'), 'none');
  await page.evaluate(() => { document.querySelector('#after-nav article').replaceChildren(); });
  await page.waitForFunction(key => !document.getElementById('after-nav').hasAttribute(key), mark);
  assert.notEqual(await display('after-nav'), 'none');

  // Content CSS from extensions is isolated from document.styleSheets. Verify
  // the computed effect and the absence of inline style changes instead.
  const injectedCssWorks = await page.evaluate(key => {
    const cell = document.getElementById('after-nav');
    cell.setAttribute(key, '');
    const applied = getComputedStyle(cell).display === 'none' && !cell.style.display;
    cell.removeAttribute(key);
    return applied;
  }, mark);
  assert.equal(injectedCssWorks, true, 'content CSS must apply without inline styles');
  console.log('X Ad Hider Chrome extension E2E: PASS');
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
}
