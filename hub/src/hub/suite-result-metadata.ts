/** Every terminal/recovery materializer preserves positive captured authority. */
export function terminalDeadlineMetadata(job: { timedOut?: boolean; shardWait?: object }, source?: { deadlineExpired?: unknown }): { deadlineExpired?: true; shardWait?: object } {
  return { ...(job.timedOut === true || source?.deadlineExpired === true ? { deadlineExpired: true as const } : {}), ...(job.shardWait ? { shardWait: job.shardWait } : {}) };
}
