// Lifecycle tests start with an already prepared provider image. The prepare tests
// exercise its creation through the real hub, spoke and CLI separately.
import { fixtureEnvironment } from './fixture-environment.ts';
import { verificationFixture, type FixtureStack } from './verification-fixture.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { keyHash, prepareKey } from '../src/executor/droplet/prepare.ts';

const exec = promisify(execFile);
export async function preparedDropletFixture(root: string, api: Awaited<ReturnType<typeof fakeDigitalOcean>>, stack: FixtureStack = {}): Promise<void> {
  const git = async (...args: string[]) => exec('git', args, { env: fixtureEnvironment(root, process.env), cwd: root });
  await git('init', '-q', '-b', 'dev');
  await git('config', 'user.name', 'Test'); await git('config', 'user.email', 'test@example.com');
  await git('config', 'commit.gpgsign', 'false');
  await mkdir(join(root, 'nvim'), { recursive: true });
  await writeFile(join(root, 'nvim/NVIM_VERSION'), 'v0.12.5\n');
  await writeFile(join(root, 'nvim/NVIM_SHA256SUMS'), 'bce0f56eda1f1b1db6eee8f4133d7a38813ea07933837dd1777411ca384c6875  nvim-linux-x86_64.tar.gz\n');
  await writeFile(join(root, 'package-lock.json'), '{}\n');
  await writeFile(join(root, '.gitignore'), '.cland/\n');
  const commands = await verificationFixture(root, stack);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), `[verification]\n${commands}`);
  await git('add', 'nvim', 'package-lock.json', '.gitignore', ...(stack.stack === 'other' ? [] : ['package.json', 'hub/test/run-suite.ts'])); await git('commit', '-qm', 'Prepared base');
  await git('remote', 'add', 'origin', root);
  const key = await prepareKey(root);
  const image = { id: 900, name: 'fixture-snapshot', regions: ['lon1', 'nyc1'], size_gigabytes: 1, min_disk_size: 10, created_at: new Date().toISOString() };
  await api.seedSnapshot(image, key);
  await mkdir(join(root, '.cland/run/executor'), { recursive: true });
  await writeFile(join(root, '.cland/run/executor/snapshot.json'), JSON.stringify({ image: image.id, name: image.name, key, keyHash: keyHash(key), regions: image.regions, sizeGb: image.size_gigabytes, minDiskSize: image.min_disk_size, created: image.created_at }));
}
