/** Independent backstop for test barriers, including a dead fixture owner. */
export function pollerDeadline(timeoutMs?: number): string {
  // The snippet is cached in module-level command strings. Load the shared
  // policy in the producer when it actually arms its timer, not during generation.
  // Percent encoding keeps this JS literal safe inside callers' shell double quotes.
  const timer = (budget: string) => `setTimeout(()=>{console.error('finish barrier expired');process.exit(124)},${budget}).unref();`;
  if (timeoutMs !== undefined) return timer(String(timeoutMs));
  const policy = encodeURIComponent(new URL('../until.ts', import.meta.url).href).replaceAll("'", '%27');
  // Dynamic import is valid in CJS and ESM, including a host with top-level await.
  return `import(decodeURIComponent('${policy}')).then(policy=>{${timer('policy.testDeadlineMs(300000)')}}).catch(error=>{console.error('finish barrier policy setup incomplete '+(error&&typeof error.code==='string'?error.code:'unknown').slice(0,80));if(!process.exitCode)process.exitCode=125;process.exit();});`;
}
