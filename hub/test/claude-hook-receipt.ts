export type ClaudeHookClose = {
  job: string; promptId: string; event: string;
  pid: number | undefined; code: number | null; signal: string | null;
  spawnError: string | null;
};

export const claudeHookReceiptPath = (prefix: string, event: string, promptId: string) => `${prefix}.${event}.${promptId}.json`;

/** Native close and production interpretation are independent required receipts. */
export function assertClaudeHookProcessed(value: ClaudeHookClose, expected: { job: string; promptId: string; event: string }, processed: boolean): void {
  if (value.job !== expected.job || value.promptId !== expected.promptId || value.event !== expected.event
    || !value.pid || value.code !== 0 || value.signal !== null || value.spawnError !== null || !processed) {
    throw new Error('incomplete Claude hook: '+JSON.stringify({ expected, close: value, processed }));
  }
}
