import os from 'node:os';

/** Setup headroom includes runnable work and the phase about to start. */
export function suiteLoadFactor(options: {
  load: number; workers: number; parallelism: number; executor?: string; override?: string;
}): number {
  const override = Number(options.override);
  if (Number.isFinite(override) && override >= 1) return override;
  return Math.max(options.executor === 'droplet' ? 2 : 1,
    (options.load + options.workers) / options.parallelism);
}

/** Shared deadline arithmetic for condition waits and their outer phase envelopes. */
export function waitTimeoutMs(ms:number,loadFactor?:number,env:NodeJS.ProcessEnv=process.env):number {
  // An explicit factor is an override, including fake-clock behaviour controls.
  // Otherwise sample at admission of this wait, rather than at tier launch.
  const configured=loadFactor??(env.CLAND_TEST_LOAD_FACTOR !== undefined
    ? Number(env.CLAND_TEST_LOAD_FACTOR)
    : Math.max(env.CLAND_SUITE_EXECUTOR==='droplet'?2:1,
      1 + os.loadavg()[0]! / os.availableParallelism()));
  const factor=Number.isFinite(configured)&&configured>=1?configured:1;
  const timeoutMs=ms*factor;
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new Error('until needs a positive finite deadline');
  return Math.ceil(timeoutMs);
}

/** Node reads its per-test backstop once per runner launch. Inner setup waits
 * resample per operation; this CLI default cannot change after Node starts.
 * An explicit configured bound is exact, including one equal to the default. */
export function runnerTestTimeoutArgument(ms: number, isDefault = true): string {
  return `--test-timeout=${isDefault ? waitTimeoutMs(ms) : ms}`;
}
