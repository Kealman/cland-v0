import type { DropletDependencies } from '../src/executor/droplet/dependencies.ts';
import { FakeClock } from './fake-clock.ts';
import { scriptedMachine, type MachineScript } from './fakes/digitalocean/scripted-machine.ts';
import { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { parseArgs, promisify } from 'node:util';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { cland, clandWithEnv, connectUi, eventually, inProcessSpoke, spawnSpoke, projectHub, startDaemon, tempProject } from './harness.ts';
import { beforeDirectories, cleanupProcesses, ownProcess, onCleanup } from './process-cleanup.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { prepareKey, keyHash } from '../src/executor/droplet/prepare.ts';
import { fixtureGuard } from './fixture-guard.ts';

const exec = promisify(execFile);
const token = 'sentinel-remote-suite-token';
/** Scripted machines share the supplied hub clock; process machines keep real time. */
export async function fixture(t: TestContext, options: { machine?: 'scripted' | 'process'; clock?: FakeClock; script?: MachineScript; territory?: boolean; hub?: typeof projectHub | typeof startDaemon; typecheck?: string | undefined; test?: string | undefined; executor?: 'local' | 'droplet'; config?: string; env?: Record<string, string>; name?: string; api?: Awaited<ReturnType<typeof fakeDigitalOcean>> } = {}) {
  const scripted = options.machine === 'scripted';
  const root = await tempProject(t, 'remote-run-');
  // Scripted fixtures own no detached writers and need no reaper process.
  const guard = scripted ? { pid: 0, register: async (_path: string) => {} } : await fixtureGuard(t, root);
  const territory = await tempProject(t, 'remote-territory-');
  await guard.register(territory);
  const clock = options.clock ?? new FakeClock();
  const api = options.api ?? await fakeDigitalOcean(token, scripted ? { machine: 'scripted', clock } : {});
  if (scripted) api.faults.activeAfter = 0;
  let stopHub = async () => {};
  beforeDirectories(t, async () => {
    await stopHub();
    // Stop and observe detached watchdogs too, before deleting their lease files.
    if (!scripted) await cleanupProcesses(root, [], undefined, undefined, []);
    if (!options.api) {
      if (!scripted) await cleanupProcesses(api.stateRoot, [], undefined, undefined, []);
      await api.close();
    }
  });
  if (!options.api) await guard.register(api.stateRoot);
  const git = async (...args: string[]) => (await exec('git', args, { cwd: root })).stdout.trim();
  await git('init', '-q', '-b', 'dev');
  await git('config', 'user.name', 'Test'); await git('config', 'user.email', 'test@example.com'); await git('config', 'commit.gpgsign', 'false');
  await mkdir(join(root, 'nvim')); await mkdir(join(root, 'hub/src/tracker'), { recursive: true });
  await writeFile(join(root, '.gitignore'), '.cland/\nnode_modules/\n');
  await writeFile(join(root, 'nvim/NVIM_VERSION'), 'v0.12.5\n');
  await writeFile(join(root, 'nvim/NVIM_SHA256SUMS'), `${'a'.repeat(64)}  nvim-linux-x86_64.tar.gz\n`);
  const typecheck = options.typecheck ?? 'node -e "process.exit(0)"';
  const script = options.test ?? `node -e "console.log('SELECTION='+process.env.CLAND_SUITE_SELECTION);console.log('COLORS='+process.env.FORCE_COLOR+','+process.env.NO_COLOR);console.log('# tests 1');console.log('# pass 1')"`;
  await writeFile(join(root, 'package.json'), JSON.stringify({ private: true, workspaces: ['hub'], scripts: { typecheck, test: script } }));
  await writeFile(join(root, 'hub/package.json'), JSON.stringify({ name: 'fixture-hub', scripts: { test: script } }));
  await writeFile(join(root, 'package-lock.json'), JSON.stringify({ name: 'remote-fixture', lockfileVersion: 3, packages: { '': { name: 'remote-fixture', workspaces: ['hub'] }, hub: { name: 'fixture-hub' }, 'node_modules/fixture-hub': { resolved: 'hub', link: true } } }));
  await git('add', '.'); await git('commit', '-qm', 'Base');
  await exec('git', ['init', '--bare', '-q', territory]);
  await git('remote', 'add', 'origin', territory); await git('push', '-qu', 'origin', 'dev');
  const key = scripted ? { node: process.version, nvim: { tag: 'v0.12.5', digest: 'a'.repeat(64) }, lock: createHash('sha256').update(await readFile(join(root, 'package-lock.json'))).digest('hex'), base: await git('rev-parse', 'origin/dev') } : await prepareKey(root);
  const image = { id: 900 + api.images.length, name: 'suite-snapshot', regions: ['lon1'], size_gigabytes: 1, min_disk_size: 10, created_at: (scripted ? clock.now() : new Date()).toISOString() };
  await api.seedSnapshot(image, key);
  if (!scripted) {
    const imageHome = join(api.imageDirs.get(image.id)!, 'home/runner');
    await exec('git', ['clone', '-q', '--no-hardlinks', root, join(imageHome, 'cland')]);
    await exec('git', ['remote', 'remove', 'origin'], { cwd: join(imageHome, 'cland') });
  }
  await mkdir(join(root, '.cland/run/executor'), { recursive: true });
  await writeFile(join(root, '.cland/run/executor/snapshot.json'), JSON.stringify({ image: image.id, name: image.name, key, keyHash: keyHash(key), regions: image.regions, sizeGb: 1, minDiskSize: 10, created: image.created_at }));
  await writeFile(join(root, '.cland/config.toml'), `[project]\nname=${JSON.stringify(options.name ?? root.split('/').at(-1))}\n[verification]\nexecutor = "${options.executor ?? 'droplet'}"\nlock_path = ${JSON.stringify(join(root, '.cland/host.lock'))}\n${options.config ?? 'lifetime = "15m"\nrun_timeout = "5m"\n'}`);
  // The fake machine executes the real delivered shell on either macOS or Linux.
  if (!scripted) {
    const bin = join(api.stateRoot, 'bin'); await mkdir(bin, { recursive: true });
    await writeFile(join(bin, 'setsid'), '#!/usr/bin/env python3\nimport os,sys\nos.setsid()\nos.execvp(sys.argv[1],sys.argv[1:])\n');
    await writeFile(join(bin, 'timeout'), '#!/usr/bin/env python3\nimport subprocess,sys\na=sys.argv[1:]\na=a[1:] if a[0].startswith("--kill-after") else a\nseconds=float(a.pop(0).rstrip("s"))\np=subprocess.Popen(a)\ntry: sys.exit(p.wait(timeout=seconds))\nexcept subprocess.TimeoutExpired:\n p.terminate()\n try: p.wait(timeout=1)\n except subprocess.TimeoutExpired: p.kill();p.wait()\n sys.exit(124)\n');
    await writeFile(join(bin, 'sha256sum'), `#!${process.execPath}\nconst fs=require('fs'),crypto=require('crypto');console.log(crypto.createHash('sha256').update(fs.readFileSync(process.argv[2])).digest('hex')+'  '+process.argv[2]);\n`);
    await writeFile(join(bin, 'flock'), '#!/usr/bin/env python3\nimport fcntl,sys\ntry: fcntl.flock(int(sys.argv[-1]),fcntl.LOCK_EX|fcntl.LOCK_NB)\nexcept BlockingIOError: sys.exit(1)\n');
    for (const file of ['setsid', 'timeout', 'sha256sum', 'flock']) await chmod(join(bin, file), 0o700);
  }
  const bin = join(api.stateRoot, 'bin');
  const env = { CLAND_EXECUTOR_STATE: join(root, '.cland/executor-state'), DIGITALOCEAN_TOKEN: token, CLAND_DIGITALOCEAN_API: api.url, CLAND_SSH_BIN: resolve('hub/test/fakes/digitalocean/ssh'), CLAND_SCP_BIN: resolve('hub/test/fakes/digitalocean/scp'), CLAND_TEST_FAKE_MACHINE_ROOT: api.stateRoot, PATH: `${bin}:${process.env.PATH}`, CLAND_TEST_DROPLET_POLL_MS: '20', CLAND_TEST_DROPLET_MACHINE_MS: '2000', CLAND_TEST_DROPLET_RUN_POLL_MS: '50', CLAND_TEST_DROPLET_CANCEL_MS: '500', CLAND_TEST_DROPLET_RELEASE_MS: '500', CLAND_TEST_EXECUTOR_SWEEP_MS: '200', CLAND_TEST_DROPLET_WATCHDOG_POLL_MS: '50', ...options.env };
  if (options.territory) {
    const initialized = await cland(root, 'init');
    assert.equal(initialized.code, 0, initialized.stderr);
  }
  await git('checkout', '-qb', 'task-candidate');
  await writeFile(join(root, 'hub/src/tracker/change.ts'), 'export const candidate = true;\n'); await git('add', 'hub/src/tracker/change.ts'); await git('commit', '-qm', 'Hub change');
  const machine = scriptedMachine(root, clock, key, options.script);
  const dependencies: DropletDependencies = { ...machine.dependencies, api: api.provider, hostGate: async run => ({ tree: run.tree ?? null, command: ['run', 'typecheck'], code: 0 }) };
  const daemon = scripted ? await projectHub(t, root, env, { clock, droplet: dependencies, harnesses: 'fake' }) : await (options.hub ?? startDaemon)(t, root, env);
  if ('stop' in daemon) stopHub = daemon.stop;
  const ui = await connectUi(t, daemon.discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  const spoke = scripted ? await inProcessSpoke(t, { discover: true, assignRole: false, cwd: root, name: 'impl', sessionId: 'remote-impl', role: 'implementer' }) : await spawnSpoke({ discover: true, assignRole: false, cwd: root, name: 'impl', sessionId: 'remote-impl', role: 'implementer' });
  onCleanup(t, () => spoke.close()); await spoke.waitForPresence(['impl']);
  const actor = { CLAND_SESSION_NAME: 'impl', CLAND_SESSION_ID: 'remote-impl', CLAND_ROLE: 'implementer' };
  const item = scripted ? ((await ui.request({ type: 'task.create', size: 'M', title: 'Remote fixture', assignee: 'impl' })).value as { item: { id: string } }).item.id : JSON.parse((await cland(root, 'task', 'create', '--size', 'M', 'Remote fixture', '--assignee', 'impl', '--json')).stdout).item.id as string;
  const topic = ((await ui.request({ type: 'topic.create', item, title: 'Remote run' })).value as { topic: { id: string } }).topic.id;
  const launch = async (...args: string[]) => {
    if (scripted) {
      const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { fresh: { type: 'boolean' }, all: { type: 'boolean' }, executor: { type: 'string' }, workers: { type: 'string' }, size: { type: 'string' }, occasion: { type: 'string' } } });
      const submitted = await ui.request({ type: 'suite.start', as: { name: 'impl', sessionId: 'remote-impl', shell: true }, cwd: root, mode: values.all ? 'all' : positionals[0] ?? 'auto', report: topic, to: ['impl'], fresh: values.fresh ?? false, ...(values.executor ? { executor: values.executor } : {}), ...(values.workers ? { workers: Number(values.workers) } : {}), ...(values.size ? { size: values.size } : {}), ...(values.occasion ? { occasion: values.occasion } : {}) });
      assert.equal(submitted.ok, true, submitted.error);
      return submitted.value as { id: string; pid: number | null; cached?: { run: string } };
    }
    const submitted = await clandWithEnv(root, actor, 'verify', '--report', topic, '--to', 'impl', '--json', ...args);
    assert.equal(submitted.code, 0, submitted.stderr);
    return JSON.parse(submitted.stdout) as { id: string; pid: number | null; cached?: { run: string } };
  };
  const messages = async (id: string, client = ui) => ((await client.request({ type: 'topic.history', topic })).value as { messages: { id: string; text: string }[] }).messages.filter(m => m.id === `suite:${id}`);
  const result = async (id: string, client = ui) => eventually('remote result', async () => (await messages(id, client))[0], 20000);
  const remote = async (id: string, client = ui) => eventually('remote group started', async () => {
    for (const directory of api.machineDirs.values()) {
      const home = join(directory, 'home/runner');
      const pgid = await readFile(join(home, 'runs', id, 'pgid'), 'utf8').catch(() => '');
      if (!pgid) continue;
      ownProcess(t, Number(pgid));
      return { home, run: join(home, 'runs', id) };
    }
    const failure = (await messages(id, client))[0]; if (failure) throw new Error(failure.text);
    return;
  }, 15000);
  return { clock, waits: machine.waits, machine, dependencies, stop: 'stop' in daemon ? daemon.stop : () => cland(root, 'hub', 'stop'), root, territory, guard, api, git, key, ui, spoke, discovery: daemon.discovery, env, actor, item, topic, launch, messages, result, remote };
}
