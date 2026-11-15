// Web: setup waits for a real passkey ceremony in an isolated Headless Shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, renderConfig } from '../../hub/src/init/config.ts';
import { signin } from '../../hub/src/setup/steps/signin.ts';
import { setupHub } from '../../hub/src/setup/hub.ts';
import { scriptedPrompter } from '../../hub/test/setup-prompter.ts';
import { askHubFrame } from '../../hub/src/cli/socket-client.ts';
import { webFixture } from './harness.ts';
import { until, testWaitMs } from '../../hub/test/until.ts';
import { remoteRedactor } from '../../hub/src/remote/redact.ts';
import { loadDiagnostic } from '../../hub/src/suite-load-diagnostics.ts';

test('C3 setup completes after the first user registers a passkey on the invite page', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    const config = defaultConfig('Setup'); config.verification.lockPath = join(root, 'suite.lock');
    await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  } });
  // No authenticated shell may survive the mode switch and redirect this page.
  // This private ceremony also creates no credential-bearing trace archive.
  const context = await fixture.browser.newContext();
  t.after(() => context.close());
  const redact = remoteRedactor();
  const privateFailure = (error: unknown) => new Error(redact.text(error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)));
  try {
    const page = await context.newPage();
    await fixture.syncPageClock(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    let invite: string | undefined;
    let stopped = false;
    const stop = new AbortController();
    const pending = signin({ root: fixture.root, env: {}, interactive: true, yes: false, signal: stop.signal,
      hub: setupHub(fixture.root, {}), narrate: text => {
        invite = text.match(/https?:\/\/[^\s]+/)?.[0];
        if (invite) redact.register([invite, new URL(invite).searchParams.get('token')!]);
      },
      prompter: {
        ...scriptedPrompter([
          { kind: 'confirm', question: /Let several people/, answer: true },
          { kind: 'confirm', question: /signs out.*cland auth reset/, answer: true },
        ]),
        pause: async (_message, signal) => {
          await new Promise<void>(resolve => { if (signal?.aborted) resolve(); else signal?.addEventListener('abort', () => resolve(), { once: true }); });
          stopped = true;
        },
      }, machine: {
        read: async () => null, write: async () => { throw Error('unexpected write'); }, run: async () => { throw Error('unexpected process'); },
        projectExists: async () => true, requiredHarnesses: async () => [], onPath: async () => false,
        harness: async id => ({ id, bin: null, version: null, checks: [] }),
      },
    });
    // Arm cleanup before navigation: a failed ceremony must join setup's observer.
    try {
      await until(() => Boolean(invite), { what: 'terminal invite available', timeoutMs: testWaitMs() });
      // Prove a native failure carries the planted credential, then ensure the
      // exact reporter serialization receives only the sanitized Error.
      const planted = new Error(`page.goto: Navigation to ${invite}`);
      assert.equal(JSON.stringify(loadDiagnostic(planted)).includes(invite!), true);
      const cleaned = JSON.stringify(loadDiagnostic(privateFailure(planted)));
      assert.equal(cleaned.includes(invite!), false);
      assert.equal(cleaned.includes(new URL(invite!).searchParams.get('token')!), false);
      await page.goto(invite!);
      await page.getByRole('button', { name: 'Create passkey', exact: true }).click();
      await page.getByRole('button', { name: 'Accounts', exact: true }).waitFor();
      let completed = false;
      void pending.then(() => { completed = true; }, () => { completed = true; });
      await until(() => completed, { what: 'setup passkey completion', timeoutMs: testWaitMs() });
      const lines = await pending;
      assert.equal(lines[0]?.verdict, 'done');
      assert.equal(stopped, true, 'terminal reader joined');
      const listed = await askHubFrame(fixture.hub.discovery, { type: 'user.list' }, 3000, {}) as { users: Array<{ state: string }> };
      assert.equal(listed.users.length, 1);
      assert.equal(listed.users[0]?.state, 'active');
    } finally { stop.abort(); await pending.catch(() => {}); }
  } catch (error) {
    // Drop cause/expected/actual properties before any native reporter sees it.
    throw privateFailure(error);
  } finally {
    await context.close();
  }
});
