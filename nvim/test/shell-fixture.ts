// Shared T2 shell fixture: recorded stub frames and owned headless Neovim only.
import type { TestContext } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nvimOrSkip, startClient, type Client } from './stub-client.ts';
import { waitInitialSnapshots } from './readiness.ts';
import type { Scenario } from './stub-hub.ts';
import { eventually, tempProject } from './fixture.ts';
import { stubControl } from './stub-control.ts';

const nvim = await nvimOrSkip();

export const skip = 'skip' in nvim ? nvim.skip : false;

const bin = 'bin' in nvim ? nvim.bin : '';

const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

const KEYLOG = fileURLToPath(new URL('./fakes/keylog.ts', import.meta.url));

export const ts = (min: number) => new Date(Date.UTC(2026, 9, 8, 10, min)).toISOString();

const CAPS = {
  history: 'none',
  usage: 'reliable',
  setModel: 'none',
  approvalRelay: 'none',
  states: { busy: 'reliable', idle: 'reliable', 'waiting for approval': 'reliable', 'waiting for human': 'heuristic' },
};

export const proc = (name: string, role: string, state: string, model = 'opus') => ({
  name,
  harness: 'claude-code',
  role,
  model,
  cwd: '/tmp',
  pid: 1,
  harnessId: `${name}-bg`,
  sessionId: `${name}-id`,
  harnessSessionId: null,
  startedAt: ts(0),
  status: 'running',
  state,
  attach: `claude attach ${name}-bg`,
});

export function baseScenario(keylog: string): Scenario {
  return {
    inbox: {},
    messages: {
      general: [
        { id: 'm1', from: 'coord-1', fromKind: 'agent', fromRole: 'coordinator', via: 'spoke', to: ['human'], text: 'Starting T-12 with impl-1; the log is in Agents.', ts: ts(1), topic: 'general' },
      ],
      agents: [{ id: 'm2', from: 'impl-1', fromKind: 'agent', fromRole: 'implementer', via: 'spoke', to: ['coord-1'], text: 'T-12 claimed.', ts: ts(2), topic: 'agents' }],
    },
    processes: [proc('coord-1', 'coordinator', 'busy'), proc('impl-1', 'implementer', 'waiting for human', 'sonnet')],
    adapters: { 'claude-code': CAPS },
    items: [
      { id: 'T-12', kind: 'task', title: 'Hub daemon and spoke hello', status: 'in progress', state: 'open', labels: [], assignee: null, parent: null, blocked_by: [], topic: null, branch: null, created: ts(0), updated: ts(0), file: '.cland/tasks/T-12-hub.md', claim: { session: 'impl-1', sessionId: 'impl-1-id', role: 'implementer', claimedAt: ts(1) } },
      { id: 'T-13', kind: 'task', title: 'Codex adapter', status: 'backlog', state: 'open', labels: [], assignee: null, parent: null, blocked_by: [], topic: null, branch: null, created: ts(0), updated: ts(0), file: '.cland/tasks/T-13-codex.md', claim: null },
    ],
    attach: {
      'coord-1': `${JSON.stringify(process.execPath)} ${JSON.stringify(KEYLOG)} ${JSON.stringify(keylog)}`,
      'impl-1': `printf 'attached impl-1\\n'; sleep 600`,
    },
  };
}

export type Shell = Client & {
  root: string;
  keylog: string;
  control: (cmd: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Change the scenario file: what the next stub hub reads when the client spawns it again. */
  rewrite: (edit: (s: Scenario) => void) => Promise<void>;
  /** The stub hub dies after `rewrite`; the client reconnects to a new one, which reads the file again. */
  reconnect: (edit?: (s: Scenario) => void) => Promise<void>;
};

export async function startShell(t: TestContext, edit: (s: Scenario) => void = () => {}, env: Record<string, string> = {}, initialSnapshots = true): Promise<Shell> {
  const dir = await tempProject(t, 'cland-sh-');
  const root = join(dir, 'proj-shell');
  await mkdir(join(root, '.git'), { recursive: true });
  const keylog = join(dir, 'keylog.txt');
  const scenario = baseScenario(keylog);
  edit(scenario);
  const scenarioFile = join(dir, 'scenario.json');
  await writeFile(scenarioFile, JSON.stringify(scenario));
  const controlPath = join(dir, 'ctl.sock');
  const c = await startClient(t, bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio',
    CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_SCENARIO: scenarioFile,
    CLAND_STUB_CONTROL: controlPath,
    CLAND_REFRESH_MS: '300',
    ...env,
  });
  const control = async (cmd: Record<string, unknown>) => {
    await eventually('the stub hub opens its control socket', () => existsSync(controlPath) || undefined, 10_000);
    return stubControl(controlPath, cmd);
  };
  const rewrite = async (change: (s: Scenario) => void) => {
    const now = JSON.parse(await readFile(scenarioFile, 'utf8')) as Scenario;
    change(now);
    await writeFile(scenarioFile, JSON.stringify(now));
  };
  const reconnect = async (change: (s: Scenario) => void = () => {}) => {
    await rewrite(change);
    await control({ exit: true });
    // the new stub listens again once it runs: a control round trip proves it
    await eventually('the replacement stub answers control', async () => {
      await control({});
      return true;
    }, 10_000);
  };
  await c.waitScreen((s) => s.includes('Starting T-12') && s.includes('coord-1'), 'the workbench on General');
  if (initialSnapshots) await waitInitialSnapshots(c);
  return Object.assign(c, { root, keylog, control, rewrite, reconnect });
}

export const statusLine = (s: string) => s.split('\n')[43] ?? '';

type Req = Record<string, unknown> & { type: string };

export const requestsOf = async (c: Shell, type: string): Promise<Req[]> => ((await c.control({ requests: true })).requests as Req[]).filter((f) => f.type === type);

/** Bound setup independently of the post-release view/form observation. */
export async function waitHeldSnapshot(c: Shell, type: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      c.control({ waitSnapshot: type }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`stub did not capture ${type} within 5000 ms`)), 5000); }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function onSessionRow(c: Shell, name: string) {
  await c.input('<Esc><Space>s<Space>s');
  await c.waitScreen((s) => s.includes('SESSIONS') && statusLine(s).includes('NORMAL'), 'the sessions panel, focused');
  await c.rpc.request('nvim_exec_lua', `
    local name=...; local panels=require('cland.panels')
    for _,win in ipairs(vim.api.nvim_tabpage_list_wins(0)) do
      local b=vim.api.nvim_win_get_buf(win)
      if vim.b[b].cland_role=='sessions' then
        for line,row in pairs(panels.rows[b] or {}) do
          if row.session==name and not row.detail then
            vim.api.nvim_set_current_win(win)
            vim.api.nvim_win_set_cursor(win,{line,0})
            return
          end
        end
      end
    end
    error('no session row for '..name)
  `, [name]);
}

