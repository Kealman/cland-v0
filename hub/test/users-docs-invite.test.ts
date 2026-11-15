// T2: the published CLI walkthrough against projectHub and its loopback web edge.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, projectHub, cland } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { defaultConfig, renderConfig, parseConfig } from '../src/init/config.ts';
import { inviteSteps, source, usersPath } from '../../site/test/users-docs-source.ts';
import { captureStep, scanCapture } from '../../site/scripts/capture-safety.ts';

test('published users commands switch a single project and renew the second user invite privately', async t => captureStep('capture', async () => {
  const steps = inviteSteps(source(usersPath));
  assert.equal(steps.length, 4);
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Users docs');
  config.verification.lockPath = join(root, 'suite.lock');
  const path = join(root, '.cland/config.toml');
  await writeFile(path, renderConfig(config));
  const logs: unknown[] = [];
  const hub = await projectHub(t, root, {}, { clock: new FakeClock(Date.now()), git: async args => args.includes('user.name') ? 'Docs Admin\n' : '', log: entry => { logs.push(entry); } });
  // The scanner must reject a planted one-use link before it can clear evidence.
  assert.throws(() => scanCapture('/invite?' + 'token=' + 'a'.repeat(64), 'unused-control'));
  const privateLinks: string[] = [];
  const capture: string[] = [];
  for (const step of steps) {
    const result = await cland(root, ...step.slice(6).split(/\s+/));
    // Never attach raw stdout/stderr or a URL to an assertion diagnostic.
    assert.equal(result.code === 0, true, 'published command completes');
    capture.push(result.stdout.replace(/https?:\/\/\S+/g, '<private link>'), result.stderr.replace(/https?:\/\/\S+/g, '<private link>'));
    if (step === 'cland user list') {
      assert.equal(/docs-admin.*admin.*active/.test(result.stdout), true);
      assert.equal(/teammate.*admin.*invited/.test(result.stdout), true);
    } else {
      const line = result.stdout.trim().split('\n').at(-1)!;
      assert.equal(/^http:\/\/127\.0\.0\.1:\d+\/invite\?token=[a-f0-9]{64}$/.test(line), true, 'loopback invite emitted');
      privateLinks.push(line);
    }
  }
  assert.equal(parseConfig(await readFile(path, 'utf8'), 'Users docs', {}).auth.mode, 'users');
  assert.equal(privateLinks.length, 3);
  assert.equal(privateLinks[1] !== privateLinks[2], true, 'renewal replaces the previous invite');
  // Check the durable invite through its public edge without printing its bytes.
  for (const [index, expected] of [[1, 400], [2, 200]] as const) {
    const url = new URL(privateLinks[index]!); url.pathname = '/invite/details';
    const reply = await fetch(url, { method: 'POST', headers: { Origin: url.origin } });
    assert.equal(reply.status, expected);
    await reply.arrayBuffer();
  }
  const exported = capture.join('\n') + JSON.stringify(logs);
  for (const link of privateLinks) {
    const secret = new URL(link).searchParams.get('token')!;
    assert.equal(exported.includes(secret), false, 'capture and hub logs exclude private material');
    scanCapture(exported, secret);
  }
  await hub.stop();
}));
