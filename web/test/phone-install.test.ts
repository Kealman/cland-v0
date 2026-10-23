// Web: installed entry and badge through the sealed phone context and public edge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { webFixture, pageUntil } from './harness.ts';

declare global { interface Window { badgeCalls: Array<number | 'clear'> } }

test('the installed start URL opens Inbox over a saved Sessions area and leaves a plain root URL', async t => {
  const fixture = await webFixture(t);
  await fixture.pageCase(t, async (page, origin) => {
    const sessions = page.getByRole('navigation', { name: 'Phone areas', exact: true }).getByRole('button', { name: 'Sessions', exact: true });
    await sessions.tap();
    await pageUntil(page, () => JSON.parse(localStorage.getItem('cland.ui.shell.v1')!).area === 'Sessions', 'Sessions preference persisted');
    await page.reload();
    await pageUntil(page, () => document.querySelector('main')?.getAttribute('aria-label') === 'Sessions', 'ordinary reload retains Sessions');
    const response = await page.request.get(`${origin}/manifest.webmanifest`);
    assert.equal(response.status(), 200);
    const manifest = await response.json();
    await page.goto(new URL(manifest.start_url, origin).href);
    await pageUntil(page, () => document.querySelector('main')?.getAttribute('aria-label') === 'Inbox', 'installed entry opens Inbox');
    assert.equal(await page.locator('main').getAttribute('aria-label'), 'Inbox');
    assert.equal(page.url(), `${origin}/`);
    await page.reload();
    await pageUntil(page, () => document.querySelector('main')?.getAttribute('aria-label') === 'Inbox', 'Inbox persists after launch parameter is consumed');
    assert.equal(page.url(), `${origin}/`);
  }, undefined, { phone: true });
});

test('web --qr signs a fresh phone into Inbox with a thirty-day cookie', async t => {
  const fixture = await webFixture(t, { cliLink: 'qr', prepare: async root => {
    await mkdir(join(root, '.cland'));
    await writeFile(join(root, '.cland/config.toml'), '[web]\norigin = "https://phone.example"\n');
  } });
  let authHeader: Promise<string | null> | undefined;
  let started = 0;
  await fixture.pageCase(t, async (page, origin) => {
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'cookie authenticates the phone WebSocket');
    assert.equal(await page.locator('main').getAttribute('aria-label'), 'Inbox');
    assert.equal(page.url(), `${origin}/`);
    assert.deepEqual(page.viewportSize(), { width: 390, height: 844 });
    assert.equal(await page.evaluate(() => navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches), true);
    assert.ok(authHeader, 'observed the auth response before navigation');
    assert.match((await authHeader)!, /; Path=\/; HttpOnly; SameSite=Strict; Max-Age=2592000$/);
    const cookies = await page.context().cookies();
    assert.equal(cookies.length, 1);
    const cookie = cookies[0]!;
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, 'Strict');
    assert.ok(cookie.expires >= started / 1000 + 2_592_000 - 1);
    assert.ok(cookie.expires <= Date.now() / 1000 + 2_592_000 + 1);
  }, async page => {
    assert.deepEqual(await page.context().cookies(), [], 'phone starts signed out');
    started = Date.now();
    page.on('response', response => { if (new URL(response.url()).pathname === '/auth') authHeader = response.headerValue('set-cookie'); });
  }, { phone: true });
});

test('the app badge follows needs-you counts and clears when the last ask is answered', async t => {
  const clock = new FakeClock();
  const fixture = await webFixture(t, { clock });
  const ui = await connectUi(t, fixture.hub.discovery);
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'install-badge-coord' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  await fixture.pageCase(t, async page => {
    await pageUntil(page, () => window.badgeCalls.at(-1) === 'clear', 'initial zero clears the badge');
    const first = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'First badge ask?', options: ['Yes', 'No'] });
    assert.equal(first.ok, true);
    await clock.advance(250);
    await pageUntil(page, () => window.badgeCalls.at(-1) === 1, 'first ask sets badge to one');
    const second = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Second badge ask?', options: ['Yes', 'No'] });
    assert.equal(second.ok, true);
    await clock.advance(250);
    await pageUntil(page, () => window.badgeCalls.at(-1) === 2, 'second ask sets badge to two');
    assert.equal((await ui.request({ type: 'topic.answer', ask: first.ask, option: 1 })).ok, true);
    await clock.advance(250);
    await pageUntil(page, () => window.badgeCalls.at(-1) === 1, 'answer reduces badge to one');
    assert.equal((await ui.request({ type: 'topic.answer', ask: second.ask, option: 2 })).ok, true);
    await clock.advance(250);
    await pageUntil(page, () => window.badgeCalls.at(-1) === 'clear', 'last answer clears the badge');
    assert.deepEqual((await page.evaluate(() => window.badgeCalls)).filter(value => value !== 'clear'), [1, 2, 1]);
    assert.equal(await page.locator('[data-area="Inbox"] [data-count]').textContent(), '0');
  }, async page => { await page.addInitScript(() => {
    window.badgeCalls = [];
    Object.defineProperties(navigator, {
      setAppBadge: { configurable: true, value: async (count: number) => { window.badgeCalls.push(count); } },
      clearAppBadge: { configurable: true, value: async () => { window.badgeCalls.push('clear'); } },
    });
  }); }, { phone: true });
});

test('phones without the Badging API keep live attention counts', async t => {
  const fixture = await webFixture(t);
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'install-no-badge-coord' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const errors: string[] = [];
  const asked = await coord.call<{ ok: boolean }>('ask', { topic: 'general', question: 'No badge API?', options: ['Yes', 'No'] });
  assert.equal(asked.ok, true);
  await fixture.pageCase(t, async page => {
    await pageUntil(page, () => document.querySelector('[data-area="Inbox"] [data-count]')?.textContent === '1', 'attention remains live without badges');
    assert.equal(await page.evaluate(() => typeof navigator.setAppBadge), 'undefined');
    assert.deepEqual(errors, []);
  }, async page => {
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => Object.defineProperties(navigator, {
      setAppBadge: { configurable: true, value: undefined },
      clearAppBadge: { configurable: true, value: () => { throw new Error('clear called without badge support'); } },
    }));
  }, { phone: true });
});
