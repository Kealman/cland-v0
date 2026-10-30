import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/** Explicit native-launch identity for supplemental hooks, bridges and spokes.
 * Never infer it inside transport helpers: old/missing-generation controls must
 * continue to send exactly the fields their caller supplied. */
export async function claudeLaunchIdentity(fake: { calls: () => Promise<Array<{ args: string[] }>> }, name: string) {
  const call = (await fake.calls()).findLast(call => call.args[0] === '--bg' && call.args[call.args.indexOf('--name') + 1] === name);
  assert.ok(call, `native launch arguments captured for ${name}`);
  const settingsIndex = call.args.indexOf('--settings');
  assert.ok(settingsIndex >= 0, 'native launch includes --settings');
  const path = call.args[settingsIndex + 1];
  assert.ok(path, 'native launch names its immutable settings file');
  const settings = JSON.parse(await readFile(path, 'utf8')) as { env: Record<string, string> };
  assert.equal(settings.env.CLAND_SESSION_NAME, name);
  assert.equal(typeof settings.env.CLAND_LAUNCH_ID, 'string');
  assert.ok(settings.env.CLAND_LAUNCH_ID);
  return { launchId: settings.env.CLAND_LAUNCH_ID, ...(settings.env.CLAND_LAUNCH_TOKEN ? { launchToken: settings.env.CLAND_LAUNCH_TOKEN } : {}) };
}
