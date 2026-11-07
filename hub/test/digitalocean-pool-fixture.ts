import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { poolImageKey } from '../src/host/provider/pool-image.ts';
import { keyHash } from '../src/executor/droplet/prepare.ts';

/** Existing machine/volume scenarios start after image preparation. */
export async function seedPoolImages(root: string): Promise<void> {
  await mkdir(join(root, '.cland/run/hosts'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hosts]\n' + ['agents', 'other', 'second', 'third', 'actual', 'agents-host-x'].map(pool => `[hosts.${pool}]\nprovider="digitalocean"\nsize="c-8"\nregion="lon1"\n`).join(''));
  const key = await poolImageKey(root, {}, 'digitalocean');
  for (const pool of ['agents', 'other', 'second', 'third', 'actual', 'agents-host-x']) await writeFile(join(root, '.cland/run/hosts', pool + '-image.json'), JSON.stringify({ image: 9001, name: 'prepared-fixture', key, keyHash: keyHash(key), regions: ['lon1', 'fra1', 'ams3'], sizeGb: 1, minDiskSize: 1, created: new Date().toISOString() }));
}
