// T3: native Neovim terminal jobs traverse fake SSH and survive editor restart.
// Lifecycle: projectHub owns fake sessions; Neovim owns attach children, joined before roots.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectHub, tempProject } from '../../hub/test/harness.ts';
import { sessionUi } from '../../hub/test/session-credential-fixture.ts';
import { fixtureEnvironment } from '../../hub/test/fixture-environment.ts';
import { createFakeHost } from '../../shared/fake-host-machine.ts';
import { localHost } from '../../hub/src/host/local.ts';
import { terminalAttachCommand } from '../../hub/src/host/attach.ts';
import { hostPaths } from '../../hub/src/host/records.ts';
import { remoteHostLayout } from '../../hub/src/host/remote-layout.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';

test('Enter attaches through pinned SSH, names the host, reattaches after restart and shows revocation', { skip }, async t => {
  const root = await tempProject(t, 'cland-h-');
  const fake = await createFakeHost(root, 'f1');
  const paths = hostPaths(root, 'f1');
  await mkdir(paths.directory, { recursive: true });
  await writeFile(paths.clientKeyPath, join(fake.directory, 'client-key'));
  await writeFile(paths.knownHosts, `f1 ${fake.key}\n`);
  const tools = join(root, 'bin');
  await mkdir(tools);
  await symlink(fileURLToPath(new URL('../../hub/test/fakes/fake-ssh.ts', import.meta.url)), join(tools, 'ssh'));
  // Fake remote CLI validates the exact host-attach argv and publishes a terminal receipt.
  const cli = join(fake.home, 'attach.mjs');
  await writeFile(cli, `import assert from 'node:assert/strict';
assert.deepEqual(process.argv.slice(2), ['host','attach','worker']);
assert.equal(process.env.CLAND_HOST_RUN_DIR, ${JSON.stringify(fake.run)});
console.log('fake host f1 attached worker');
process.stdin.resume();
`);
  const layout = { ...remoteHostLayout(fake.home), node: process.execPath, cli, runDirectory: fake.run };
  const record = { id: 'f1', transport: 'ssh' as const, address: 'f1', user: 'agent', state: 'registered' as const };
  const command = terminalAttachCommand(root, record, layout, 'worker');
  let revoked = false;
  const env = fixtureEnvironment(root, process.env, { PATH: `${tools}:${process.env.PATH}`, CLAND_FAKE_HOSTS: 'f1', CLAND_FAKE_HOST_ROOT: root });
  const host = { ...localHost(env), name: 'f1', terminalAttachCommand: () => {
    if (revoked) throw new Error('host is revoked');
    return command;
  } };
  const hub = await projectHub(t, root, {}, { hosts: [host] });
  const ui = await sessionUi(t, hub.discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'worker', harness: 'codex', host: 'f1', cwd: root });
  assert.equal(launched.ok, true, launched.error);
  const c = await startClient(t, bin, root, env as Record<string, string>);
  await waitInitialSnapshots(c);
  await c.input('<Esc>');
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').win.right)");
  await c.input('gg/worker<CR><CR>');
  await c.waitScreen(s => s.includes('fake host f1 attached worker'), 'fake host attach terminal');
  assert.equal(await c.lua("return require('cland.sessions').terms.worker.command"), command);
  assert.ok(command.includes("'-t'"));
  assert.deepEqual(await c.lua("return vim.api.nvim_buf_get_lines(require('cland.sessions').notes.worker,0,-1,false)"), ['', ' attaching to worker on f1…']);
  const moved = c.restarted();
  await c.input('<C-\\><C-n>:restart<CR>');
  await moved;
  await c.waitScreen(s => s.includes('fake host f1 attached worker'), 'fake host attached after restart');
  assert.equal(await c.lua("return require('cland.sessions').terms.worker.command"), command);
  // Close the owned attachment before requesting again; the hub refusal must be visible.
  await c.lua("vim.fn.jobstop(require('cland.sessions').terms.worker.job); assert(vim.wait(5000,function() return require('cland.sessions').terms.worker == nil end))");
  revoked = true;
  await c.input('<C-\\><C-n>:Cland view session worker<CR>');
  await c.waitScreen(s => s.includes('cannot attach worker: host is revoked'), 'hub refusal in attach note');
});
