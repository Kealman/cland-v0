// Pure startup budget policy shared by the T2 protocol fixture and Neovim smoke.
import assert from 'node:assert/strict';

export const STARTUP_MS = 3000;
export const FIRST_PAYLOAD_BYTES = 128 * 1024;
export const STARTUP_REPLY_BYTES = 256 * 1024;
export const STARTUP_TOTAL_BYTES = 1024 * 1024;
export const STARTUP_REQUESTS = ['hub.status', 'rule.list', 'topic.history', 'artifact.list', 'task.list', 'events.list', 'session.list', 'account.list'] as const;

export type StartupMeasurement = { startupMs: number; payloadBytes: number; total: number; open: number; replies: Record<string, number> };
export type StartupItem = { id: string; kind: string; state: string };

/** Check both sides of the probe's first open-summary response. */
export function assertStartupItems(items: readonly StartupItem[], payloadIds: readonly string[], installedIds: readonly string[]): void {
  const expected = items.filter(item => item.state === 'open' || item.kind !== 'task').map(item => item.id).sort();
  assert.deepEqual([...payloadIds].sort(), expected, 'first wire payload contains open items plus every container');
  assert.deepEqual([...installedIds].sort(), expected, 'all startup summaries are installed');
}

export function enforceStartupBudget(result: StartupMeasurement): void {
  assert.ok(result.startupMs <= STARTUP_MS, `startup budget: ${result.startupMs.toFixed(1)} ms > ${STARTUP_MS} ms`);
  assert.ok(result.payloadBytes <= FIRST_PAYLOAD_BYTES, `first item payload budget: ${result.payloadBytes} bytes > ${FIRST_PAYLOAD_BYTES} bytes`);
  for (const [type, bytes] of Object.entries(result.replies)) {
    assert.ok(bytes <= STARTUP_REPLY_BYTES, `startup reply budget: ${type} ${bytes} bytes > ${STARTUP_REPLY_BYTES} bytes`);
  }
  for (const type of STARTUP_REQUESTS) assert.ok(typeof result.replies[type] === 'number', `missing startup reply: ${type}`);
  const total = STARTUP_REQUESTS.reduce((sum, type) => sum + result.replies[type]!, 0);
  assert.ok(total <= STARTUP_TOTAL_BYTES, `startup total payload budget: ${total} bytes > ${STARTUP_TOTAL_BYTES} bytes`);
}

