// Dispatcher duplicates use real handlers without paying for another CLI process.
import assert from 'node:assert/strict';
import type { FrameClient } from './harness.ts';

export async function value<T>(ui: FrameClient, frame: { type: string } & Record<string, unknown>): Promise<T> {
  const result = await ui.request(frame, 30_000);
  assert.equal(result.ok, true, result.error);
  return result.value as T;
}

/** Match the MCP result shape while keeping the dispatcher frame as the oracle. */
export async function call<T>(ui: FrameClient, name: string, sessionId: string | undefined, tool: string, args: Record<string, unknown> = {}): Promise<T> {
  const { id, ...rest } = args;
  const result = await ui.request({ type: tool === 'subscribe' ? 'event.subscribe' : tool, ...rest,
    ...(id === undefined ? {} : { item: id }), as: { name, ...(sessionId ? { sessionId } : {}), shell: true } });
  return (result.ok ? { ok: true, ...result.value as object } : result) as T;
}

/** Table rows enter the real spoke dispatcher directly. No socket or MCP transport is involved. */
export async function dispatcherSpoke(t: import('node:test').TestContext, dispatcher: Pick<import('../src/hub/dispatch.ts').Dispatcher, 'open'>, root: string, name: string, sessionId: string) {
  const pending = new Map<string, (frame: Record<string, unknown>) => void>();
  const welcomed = Promise.withResolvers<void>();
  let open = true, sequence = 0;
  const conversation = dispatcher.open({
    isOpen: () => open,
    close: () => { open = false; },
    send: frame => {
      if (frame.type === 'welcome') welcomed.resolve();
      if (frame.type === 'error') welcomed.reject(new Error(JSON.stringify(frame)));
      if (frame.type === 'deliver' || frame.type === 'role') {
        queueMicrotask(() => { if (open) conversation.receive(JSON.stringify({ type: 'ack', id: frame.id })); });
      }
      if (frame.type === 'result') pending.get(frame.id)?.(frame as unknown as Record<string, unknown>);
    },
  }, { authenticated: true, edge: 'ws' });
  t.after(() => { if (open) { open = false; conversation.closed(); } });
  conversation.receive(JSON.stringify({ type: 'hello', protocol: 2, name, sessionId, cwd: root }));
  await receiptBy(welcomed.promise, 'dispatcher welcome');
  return {
    async call<T>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
      const { id: item, ...rest } = args;
      if (tool === 'task.comment' && typeof rest.verdict === 'string') {
        const { verdict, result, run, scope, verified, failed, commit } = rest;
        for (const key of ['result', 'run', 'scope', 'verified', 'failed', 'commit']) delete rest[key];
        rest.verdict = { verdict, result, run, ...(scope === undefined ? {} : { scope }), ...(verified === undefined ? {} : { verified }), ...(failed === undefined ? {} : { failed }), ...(commit === undefined ? {} : { commit }) };
      }
      const id = `direct-${++sequence}`;
      const receipt = Promise.withResolvers<Record<string, unknown>>();
      pending.set(id, receipt.resolve);
      conversation.receive(JSON.stringify({ type: tool, ...rest, ...(item === undefined ? {} : { item }), id }));
      try {
        const result = await receiptBy(receipt.promise, `${tool} result`);
        return (result.ok ? { ok: true, ...result.value as object } : result) as T;
      } finally { pending.delete(id); }
    },
  };
}

async function receiptBy<T>(receipt: Promise<T>, label: string): Promise<T> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([receipt, new Promise<never>((_resolve, reject) => {
      deadline = setTimeout(() => reject(new Error(`no ${label} receipt`)), 5000);
      deadline.unref();
    })]);
  } finally { clearTimeout(deadline); }
}
