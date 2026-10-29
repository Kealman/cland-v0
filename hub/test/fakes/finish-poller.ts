/** Independent backstop for test barriers, including a dead fixture owner. */
export function pollerDeadline(timeoutMs = 300_000): string {
  return `setTimeout(()=>{console.error('finish barrier expired');process.exit(124)},${timeoutMs}).unref();`;
}
