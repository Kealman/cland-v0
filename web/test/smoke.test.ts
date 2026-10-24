// Web: browser-only facts through the production web edge; no development bridge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { webFixture, pageUntil } from './harness.ts';

test('the web shell uses a one-time edge link, strict CSP and isolated browser fixtures', async t => {
  const fixture = await webFixture(t);
  await t.test('the rail has seven areas and every request stays on the origin', async t => {
    await fixture.pageCase(t, async (page, origin, requests) => {
      assert.deepEqual(await page.locator('nav[aria-label="Areas"] > *').allTextContents(), ['Inbox', 'Items', 'Sessions', 'Topics', 'Events', 'Artifacts', 'Accounts']);
      await page.evaluate(() => document.fonts.ready);
      assert.ok(requests.some(url => url.endsWith('.woff2')), 'self-hosted fonts loaded');
      assert.deepEqual(requests.filter(url => new URL(url).origin !== origin), []);
      assert.equal(await page.evaluate(() => Notification.permission), 'granted');
      await page.evaluate(() => localStorage.setItem('context-proof', 'first'));
    });
  });
  await t.test('a fresh context keeps CSP enabled and rejects an inline script', async t => {
    await fixture.pageCase(t, async page => {
      assert.equal(await page.evaluate(() => localStorage.getItem('context-proof')), null);
      await page.evaluate(() => {
        document.addEventListener('securitypolicyviolation', event => {
          if (event.blockedURI === 'inline' && event.effectiveDirective === 'script-src-elem') document.documentElement.dataset.cspBlocked = 'yes';
        });
        const script = document.createElement('script');
        script.textContent = 'document.documentElement.dataset.inlineRan = "yes"';
        document.head.append(script);
      });
      await pageUntil(page, () => document.documentElement.dataset.cspBlocked === 'yes', 'inline script CSP violation observed');
      assert.equal(await page.evaluate(() => document.documentElement.dataset.inlineRan), undefined);
    });
  });
  await t.test('two failing fixtures retain distinct traces named in their diagnostics', async t => {
    const diagnostics: string[] = [];
    const diagnostic = t.diagnostic.bind(t);
    t.mock.method(t, 'diagnostic', (message: string) => { diagnostics.push(message); diagnostic(message); });
    await assert.rejects(fixture.pageCase(t, async () => { throw new Error('planted fixture failure'); }), /planted fixture failure/);
    assert.equal(fixture.tracePaths.length, 1);
    const path = fixture.tracePaths[0]!;
    const original = await readFile(path);
    assert.equal(original.subarray(0, 2).toString(), 'PK', 'first failure trace is a ZIP');
    assert.equal(fixture.browser.contexts().length, 0);

    const second = await webFixture(t);
    await assert.rejects(second.pageCase(t, async () => { throw new Error('second planted fixture failure'); }), /second planted fixture failure/);
    assert.equal(second.tracePaths.length, 1);
    const secondPath = second.tracePaths[0]!;
    assert.notEqual(secondPath, path, 'fixtures in one worker retain different trace files');
    assert.deepEqual(diagnostics, [`Web failure trace: ${path}`, `Web failure trace: ${secondPath}`]);
    assert.equal((await readFile(secondPath)).subarray(0, 2).toString(), 'PK', 'second failure trace is a ZIP');
    assert.deepEqual(await readFile(path), original, 'second failure preserves the first trace contents');
    assert.equal(second.browser.contexts().length, 0);
    await second.close();
    await rm(path);
    await rm(secondPath);
  });
  await fixture.close();
  assert.equal(fixture.browser.isConnected(), false, 'browser disconnected after explicit cleanup');
  assert.equal(fixture.server.process().exitCode, 0, 'Headless Shell process reaped');
});
