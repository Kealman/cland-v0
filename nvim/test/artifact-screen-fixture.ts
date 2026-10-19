// T2: artifact screens use owned files and scripted, recorded protocol frames.
import type { TestContext } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Scenario } from './stub-hub.ts';
import { startClient, nvimOrSkip } from './stub-client.ts';
import { stubControl } from './stub-control.ts';
import { createScenarioArtifact, changeScenarioArtifact } from './artifact-scenario.ts';
import { STUB_NOW } from './fixtures/clock.ts';
export const nvim = await nvimOrSkip();
export const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
export async function artifactScreen(t: TestContext, root: string) {
  await mkdir(join(root, '.cland'), { recursive: true });
  const scenario: Scenario = { topics: ['general', 'agents'].map(id => ({ id, title: id === 'agents' ? 'Agents' : 'General', status: 'open', standing: true, createdAt: STUB_NOW, updatedAt: STUB_NOW })), messages: {}, artifacts: [] };
  const path = join(root, 'artifact-scenario.json'), ctl = join(root, 'artifact-stub.sock');
  let started = false, connected = true;
  const save = () => writeFile(path, JSON.stringify(scenario));
  const publish = async (events: Record<string, unknown>[] = []) => {
    await save();
    if (started && connected) await stubControl(ctl, { set: scenario, emits: events });
  };
  const create = async (request: Record<string, unknown>, actor?: { name: string; role: string; kind: string }) => {
    const result = createScenarioArtifact(scenario, root, request, actor);
    await publish(result.events); return result.artifact as { id: string; path: string };
  };
  const change = async (request: Record<string, unknown>) => {
    const result = changeScenarioArtifact(scenario, root, request); await publish(result.events); return result;
  };
  const start = async (env: Record<string, string> = {}) => {
    await save();
    const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO: path, CLAND_STUB_CONTROL: ctl, ...env });
    started = true; return c;
  };
  return { scenario, create, change, start, publish, emit: (events: Record<string, unknown>[]) => stubControl(ctl, { emits: events }), disconnect: () => { connected = false; }, reconnect: async () => { connected = true; await save(); } };
}
