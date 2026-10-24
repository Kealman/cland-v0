// Manual image capture, outside suite discovery. Reuse sealed Web ownership and
// admission; never attach to the live hub or a user's browser/profile.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { webFixture, pageUntil } from '../../web/test/harness.ts';
import { seedItem } from '../../web/test/items-fixture.ts';
import { inProcessSpoke } from '../../hub/test/harness.ts';
import { askHubFrame } from '../../hub/src/cli/socket-client.ts';
import { captureStep, scanCapture } from './capture-safety.ts';

const output = fileURLToPath(new URL('../../.tmp/workbench-capture/', import.meta.url));
const desc = '## Summary\n\nA fast, accessible checkout, from basket to confirmation.\n\n## Acceptance criteria\n\n- [ ] C1. Customers can complete a purchase\n- [ ] C2. Payment errors preserve the basket';
const plan = '\n\n## Plan\n\n```yaml\nstages:\n  - name: Basket and delivery\n    qa: { scope: none, when: after-stage }\n    lanes:\n      - [T-43, T-44]\n  - name: Payment and confirmation\n    qa: { scope: affected, when: after-stage }\n    lanes:\n      - [T-45, T-46]\n```\n';

// A positive control must fail before any candidate is scanned. Scan the visible
// DOM before writing pixels; URLs, cookies, storage, traces and HOME are never
// exported. All fixture strings below are invented public demonstration data.
test('capture synthetic desktop and phone workbenches', { timeout: 60_000 }, async t => captureStep('capture', async () => {
  // Fixture after-hooks run outside this callback, so protect their failure
  // diagnostics too. Cleanup still rejects; no original error is attached.
  const after = t.after.bind(t);
  t.after = (hook, options) => after(context => captureStep('cleanup', async () => {
    if (!hook) return;
    await new Promise<void>((resolve, reject) => {
      const result = hook(context, error => error ? reject(error) : resolve());
      void Promise.resolve(result).then(() => { if (hook.length < 2) resolve(); }, reject);
    });
  }), options);
  const fixture = await webFixture(t, { timezoneId: 'UTC', prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), '[project]\nname = "Storefront"\n');
    await seedItem(root, 'R-1', 'release', 'Storefront 1.0', { version: '1.0.0' });
    await seedItem(root, 'E-42', 'epic', 'Checkout flow', { parent: 'R-1' }, desc + plan, [
      { author: 'reviewer', at: '2026-10-24T12:00:00Z', text: 'Basket and delivery are ready for payment work.', verdict: { verdict: 'review', result: 'clear', by: 'reviewer', run: 'checkout-review', scope: 'full' } },
    ]);
    for (const [id, title, status] of [
      ['T-43', 'Basket totals and discounts', 'done'],
      ['T-44', 'Delivery address and shipping', 'done'],
      ['T-45', 'Payment and error recovery', 'in progress'],
      ['T-46', 'Order confirmation', 'planned'],
    ] as const) await seedItem(root, id, 'task', title, { parent: 'E-42', status, ...(status === 'done' ? { state: 'closed', closed: '2026-10-24T12:00:00Z' } : {}) });
    for (const [id, title, task, taskTitle] of [
      ['E-47', 'Product discovery', 'T-48', 'Search and category filters'],
      ['E-49', 'Customer accounts', 'T-50', 'Order history'],
      ['E-51', 'Launch readiness', 'T-52', 'Accessibility and performance'],
    ]) {
      await seedItem(root, id!, 'epic', title!, { parent: 'R-1' });
      await seedItem(root, task!, 'task', taskTitle!, { parent: id!, status: 'planned' });
    }
  } });
  const sender = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'storefront-coordinator' });
  await sender.waitForPresence(['coord']);
  const ask = await sender.call<{ ok: boolean; ask: string }>('ask', {
    topic: 'general', question: 'Start epic Checkout flow?', options: ['Approve', 'Review the plan first'], free: true,
  });
  assert.equal(ask.ok, true);
  assert.equal((await sender.call<{ ok: boolean }>('send', {
    topic: 'general', kind: 'decision', text: 'Basket and delivery are ready. The checkout plan is waiting for your decision.',
  })).ok, true);
  assert.throws(() => scanCapture('Bearer planted-capture-secret', 'scratch-control'));
  assert.throws(() => scanCapture('scratch-control', 'scratch-control'));
  const images: Array<{ file: string; width: number; height: number; sha256: string }> = [];
  for (const phone of [false, true]) {
    const context = await fixture.browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1600, height: 1000 },
      deviceScaleFactor: phone ? 3 : 1.5, isMobile: phone, hasTouch: phone,
      colorScheme: 'dark', timezoneId: 'UTC', serviceWorkers: 'block',
    });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      // Mint solely through this fixture's own hub. Never print the one-use URL.
      const { url } = await askHubFrame(fixture.hub.discovery, { type: 'web.link' }, 3000, {}) as { url: string };
      await captureStep('sign-in', () => page.goto(url, { waitUntil: 'load' }));
      await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'scratch hub live');
      if (phone) {
        const row = page.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-object-id="${ask.ask}"]`);
        await row.tap();
        const sheet = page.getByRole('dialog', { name: 'Answer ask', exact: true });
        await sheet.getByRole('heading', { name: 'Start epic Checkout flow?', exact: true }).waitFor();
        assert.equal(await sheet.getByRole('button', { name: 'Decline', exact: true }).isVisible(), true);
      } else {
        await page.getByRole('button', { name: 'Items', exact: true }).click();
        const tree = page.getByRole('tree', { name: 'Items tree' });
        const epic = tree.locator('[data-object-id="E-42"]');
        await epic.click();
        await page.keyboard.press('l');
        await tree.locator('[data-object-id="T-45"]').waitFor();
        await epic.click();
        const card = page.locator('[aria-label="Item card"][data-item-id="E-42"]');
        await card.getByText('Basket and delivery are ready for payment work.', { exact: true }).waitFor();
        assert.match(await card.innerText(), /Payment and confirmation/);
        assert.equal(await page.locator('nav[aria-label="Areas"] [data-area="Inbox"] [data-count]').innerText(), '2');
      }
      await page.evaluate(() => document.fonts.ready);
      scanCapture(await page.locator('body').innerText(), fixture.hub.discovery.secret);
      const file = phone ? 'phone.png' : 'web.png';
      // Write only after the text scan; screenshot contains no browser chrome.
      const pixels = await page.screenshot({ animations: 'disabled' });
      scanCapture(pixels.toString('latin1'), fixture.hub.discovery.secret);
      const width = pixels.readUInt32BE(16), height = pixels.readUInt32BE(20);
      assert.equal(width, phone ? 1170 : 2400);
      assert.equal(height, phone ? 2532 : 1500);
      await mkdir(output, { recursive: true });
      await writeFile(join(output, file), pixels);
      images.push({ file, width, height, sha256: createHash('sha256').update(pixels).digest('hex') });
    } finally { await context.close(); }
  }
  const receipt = { platform: `${process.platform}/${process.arch}`, browser: relative(fileURLToPath(new URL('../../', import.meta.url)), fixture.server.process().spawnfile), browserVersion: fixture.browser.version(), images, content: 'Synthetic Storefront project; mobile viewport emulation; no physical installation claim', scan: 'Positive controls rejected; rendered text and PNG bytes passed; visual review still required' };
  scanCapture(JSON.stringify(receipt), fixture.hub.discovery.secret);
  await writeFile(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  await captureStep('cleanup', () => fixture.close());
}));
