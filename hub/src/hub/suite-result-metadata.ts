/** Every terminal/recovery materializer preserves positive captured authority. */
export function terminalDeadlineMetadata(job: { timedOut?: boolean }, source?: { deadlineExpired?: unknown }): { deadlineExpired?: true } {
  return job.timedOut === true || source?.deadlineExpired === true ? { deadlineExpired: true } : {};
}
