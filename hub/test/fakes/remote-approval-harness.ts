// Scripted native command boundary; lifecycle stays in-process, adapters stay production.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { CodexAdapter } from '../../src/adapters/codex.ts';
import { OpenCodeAdapter } from '../../src/adapters/opencode.ts';
import { OpenCodeClient } from '../../src/adapters/opencode/client.ts';
import type { AdapterHost } from '../../src/adapters/contract.ts';
import type { Clock } from '../../src/hub/clock.ts';
import { fakeHarness } from './harness.ts';
import { ScriptedCodex } from './scripted-codex.ts';
import { ScriptedOpenCode } from './scripted-opencode.ts';

export function remoteApprovalHarness(t: TestContext, root: string, clock: Clock, harness: 'codex' | 'opencode') {
  const codex = new ScriptedCodex(), opencode = new ScriptedOpenCode();
  const commands: Array<{ id: string; outcome: 'ran' | 'denied' }> = [];
  const complete = async (id: string, allowed: boolean) => {
    if (allowed) await writeFile(join(root, 'approved-command'), 'command ran');
    commands.push({ id, outcome: allowed ? 'ran' : 'denied' });
  };
  codex.onResponse = async (id, result) => {
    await complete(String(id), result.decision === 'accept' || result.decision === 'acceptForSession');
  };
  if (harness === 'opencode') {
    t.mock.method(OpenCodeClient.prototype, 'events', opencode.events.bind(opencode));
    t.mock.method(OpenCodeClient.prototype, 'request', async (method: string, path: string, body?: unknown) => {
      const before = opencode.replies.length;
      const response = await opencode.request(method, path, body);
      const reply = opencode.replies[before];
      if (reply) await complete(reply.request, reply.decision === 'once' || reply.decision === 'always');
      return response;
    });
  }
  const factory = (host: AdapterHost) => {
    const lifecycle = fakeHarness(harness, { host, clock });
    const adapter = harness === 'codex' ? new CodexAdapter(host, { clock, connect: async () => codex })
      : new OpenCodeAdapter(host, { clock, env: {}, roleInstructions: false });
    const spawn = lifecycle.spawn.bind(lifecycle);
    lifecycle.spawn = async (...args) => {
      let process = await spawn(...args);
      codex.thread = process.harnessSessionId!;
      opencode.session = process.harnessSessionId!;
      if (harness === 'opencode') {
        process = { ...process, pid: null, harnessId: 'http://scripted-opencode' };
        await mkdir(join(root, '.cland/opencode', process.name), { recursive: true });
        await writeFile(join(root, '.cland/opencode', process.name, 'password'), 'synthetic-password');
      }
      return process;
    };
    lifecycle.watch = adapter.watch.bind(adapter);
    lifecycle.unwatch = adapter.unwatch.bind(adapter);
    lifecycle.answerApproval = adapter.answerApproval!.bind(adapter);
    const close = lifecycle.close.bind(lifecycle);
    lifecycle.close = () => { adapter.close(); close(); };
    return lifecycle;
  };
  return { factory, codex, opencode, commands,
    ready: () => harness === 'codex' ? codex.count('thread/resume') > 0 : opencode.opens > 0,
    raise: (command: string) => {
      if (harness === 'codex') codex.emit('serverRequest', { id: 'approval', method: 'item/commandExecution/requestApproval',
        params: { threadId: codex.thread, turnId: 'turn-command', itemId: 'command', command, cwd: root } });
      else { opencode.shellCommand = command; opencode.ask('approval', 'shell'); }
    },
  };
}
