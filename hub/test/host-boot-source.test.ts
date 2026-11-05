// T2: real private boot files and an in-process agent admission; no native child.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentBootId } from '../src/host/agent/native.ts';
import { serveAgent } from '../src/host/agent/server.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

test('fake host boot source requires its file before agent recovery and never falls back to the kernel', async () => {
  const root = await mkdtemp(join(tmpdir(), 'host-boot-source-'));
  let unexpected: Awaited<ReturnType<typeof serveAgent>> | undefined;
  try {
    const env = fixtureEnvironment(root, process.env, { CLAND_FAKE_HOSTS: 'one', CLAND_HOST_BOOT_ID_FILE: undefined });
    const runDir = join(root, 'run');
    await assert.rejects(async () => { unexpected = await serveAgent({ runDir, secret: 'synthetic', version: 'test', env }); }, /boot-id file/);
    await assert.rejects(access(runDir), { code: 'ENOENT' }, 'invalid boot source starts no recovery or file preparation');
    await assert.rejects(agentBootId(env), /fake host requires boot-id file/);
    const boot = join(root, 'boot'); env.CLAND_HOST_BOOT_ID_FILE = boot;
    await assert.rejects(agentBootId(env), { code: 'ENOENT' });
    await writeFile(boot, 'invalid'); await assert.rejects(agentBootId(env), /invalid fake boot id/);
    await writeFile(boot, '11111111-1111-1111-1111-111111111111\n');
    assert.equal(await agentBootId(env), '11111111-1111-1111-1111-111111111111');
    await writeFile(boot, '22222222-2222-2222-2222-222222222222');
    assert.equal(await agentBootId(env), '22222222-2222-2222-2222-222222222222', 'each observation reads the current host boot');
    const real = fixtureEnvironment(root, env, { CLAND_FAKE_HOSTS: undefined, CLAND_HOST_BOOT_ID_FILE: boot });
    assert.equal(real.CLAND_HOST_BOOT_ID_FILE, boot, 'the stray boot file is present after final sealing');
    assert.equal(real.CLAND_FAKE_HOSTS, undefined);
    if (process.platform === 'linux') {
      assert.equal(await agentBootId(real), (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim(), 'a boot-file variable alone cannot override a real host');
    }
  } finally { await unexpected?.close(); await rm(root, { recursive: true, force: true }); }
});
