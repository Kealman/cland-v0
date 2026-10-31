import { layout, readDiscovery } from '../project.ts';
import { askHubFrame } from '../cli/socket-client.ts';
import { startProjectHub } from '../cli/hub.ts';
import type { HarnessProcessView, HubStatus, Inbox, InboxPairing, RemoteStatusResult, RemoteVia } from '../protocol.ts';
import type { Pairing } from '../remote/state.ts';
import type { HarnessId } from '../doctor/ranges.ts';

export type SetupHub = {
  /** Optional read budget; old injected clients may ignore it and are still joined. */
  remotes?(timeoutMs?: number): Promise<RemoteStatusResult>;
  pairings?(): Promise<InboxPairing[]>;
  approve?(messenger: RemoteVia, code: string): Promise<Pairing>;
  configure?(key: string, value: unknown): Promise<void>;
  reload?(): Promise<void>;
  running(): Promise<{ pid: number } | null>;
  start(): Promise<{ pid: number }>;
  session(name: string): Promise<Pick<HarnessProcessView, 'status'> | null>;
  launch(request: { name: string; role: 'aide'; harness: HarnessId; brief: string }): Promise<void>;
  resume(name: string): Promise<void>;
  attach(name: string): Promise<string>;
};

/** Setup uses the normal project daemon and session protocol, with its updated installer PATH. */
export function setupHub(root: string, env: NodeJS.ProcessEnv): SetupHub {
  const discovery = () => {
    const found = readDiscovery(layout(root).discovery);
    if (!found) throw new Error('no hub running; run cland hub start');
    return found;
  };
  const request = (frame: { type: string } & Record<string, unknown>, timeout = 3000) => askHubFrame(discovery(), frame, timeout, env);
  const running = async () => {
    if (!readDiscovery(layout(root).discovery)) return null;
    try { return await request({ type: 'hub.status' }) as HubStatus; }
    catch { return null; }
  };
  return {
    running,
    remotes: async timeoutMs => await request({ type: 'remote.status' }, timeoutMs ?? 3000) as RemoteStatusResult,
    pairings: async () => (await request({ type: 'inbox.list' }) as Inbox).pairings ?? [],
    approve: async (messenger, code) => (await request({ type: 'pairing.approve', messenger, code }) as { pairing: Pairing }).pairing,
    async configure(key, value) {
      const result = await request({ type: 'config.set', key, value }, 60_000) as { applies: string };
      if (result.applies !== 'now') throw new Error('configuration saved but not applied; run cland hub reload');
    },
    async reload() { await request({ type: 'hub.reload' }, 60_000); },
    async start() {
      let said = '';
      const write = (text: string) => { said += text; };
      const code = await startProjectHub(root, { out: write, err: write }, { client: 'cli', parentPid: process.ppid, cwd: root }, false, env);
      if (code !== 0) throw new Error(said.trim());
      const found = await running();
      if (!found) throw new Error(`hub did not answer after startup; ${said.trim()}`);
      return { pid: found.pid };
    },
    async session(name) {
      const result = await request({ type: 'session.list' }) as { processes: HarnessProcessView[] };
      return result.processes.find(process => process.name === name) ?? null;
    },
    async launch(input) { await request({ type: 'session.launch', ...input }, 60_000); },
    async resume(name) {
      const result = await request({ type: 'session.resume', session: name, relaunch: true }, 60_000) as { found: boolean; reason?: string };
      if (!result.found) throw new Error(result.reason ?? 'could not resume aide-1');
    },
    async attach(name) {
      const result = await request({ type: 'session.attach', session: name }) as { command: string };
      return result.command;
    },
  };
}
