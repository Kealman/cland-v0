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
export function waitTimeoutMs(ms:number,loadFactor?:number):number {
  const configured=loadFactor??Number(process.env.CLAND_TEST_LOAD_FACTOR??(process.env.CLAND_SUITE_EXECUTOR==='droplet'?2:1));
  const factor=Number.isFinite(configured)&&configured>=1?configured:1;
  const timeoutMs=ms*factor;
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new Error('until needs a positive finite deadline');
  return timeoutMs;
}
