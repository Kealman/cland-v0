// Web: real invite form in isolated Headless Shell and disposable projectHub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, renderConfig } from '../../hub/src/init/config.ts';
import { askHubFrame } from '../../hub/src/cli/socket-client.ts';
import { webFixture } from './harness.ts';

test('invite view shows the user and signs in with a password POST without sending a password frame', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    const config = defaultConfig('Sign in'); config.verification.lockPath = join(root, 'suite.lock');
    await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  } });
  await askHubFrame(fixture.hub.discovery, { type: 'auth.mode', mode: 'users' }, 3000, {});
  const created = await askHubFrame(fixture.hub.discovery, { type: 'user.add', name: 'alex', displayName: 'Alex Smith' }, 3000, {}) as { url: string };
  await fixture.pageCase(t, async page => {
    const frames: string[] = [];
    page.on('websocket', socket => socket.on('framesent', event => frames.push(String(event.payload))));
    await page.goto(created.url);
    await page.getByRole('heading', { name: 'Alex Smith' }).waitFor();
    assert.equal(await page.getByText('alex', { exact: true }).count(), 1);
    await page.getByLabel('Set password').fill('private browser password');
    const response = page.waitForResponse(r => r.url().endsWith('/invite/register') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    assert.equal((await response).status(), 200);
    await page.getByRole('button', { name: 'Accounts', exact: true }).click();
    await page.getByRole('region', { name: 'Profile', exact: true }).getByText('Alex Smith', { exact: true }).waitFor();
    assert.equal(frames.join('\n').includes('private browser password'), false);
  });
});
