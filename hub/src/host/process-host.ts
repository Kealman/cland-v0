import type { Host, HostProcess } from './host.ts';

export const isLinuxIdentity = (value: string | null | undefined): boolean => typeof value === 'string' && /^linux:[^:\s]+:\d+$/.test(value);

/** Remote process authority requires Linux boot/start proof, never a legacy timestamp. */
export function processHost(host: Host): Host {
  if (host.name === 'local') return host;
  const matches = async (row: HostProcess): Promise<boolean> => {
    if (row.pid === null || !Number.isSafeInteger(row.pid) || row.pid <= 0 || !isLinuxIdentity(row.pidIdentity)) return false;
    const observed = await host.identity(row.pid);
    return observed?.pid === row.pid && observed.pidIdentity === row.pidIdentity;
  };
  // Preserve methods/getters and their receiver; only process authority is narrowed.
  return new Proxy(host, {
    get(target, key) {
      if (key === 'alive') return async (row: HostProcess) => await matches(row) && await target.alive(row);
      if (key === 'stop') return async (row: HostProcess, options?: Parameters<Host['stop']>[1]) => {
        if(row.pid===null||!Number.isSafeInteger(row.pid)||row.pid<=0||!isLinuxIdentity(row.pidIdentity))return false;
        const observed=await target.identity(row.pid);
        if(observed&&observed.pidIdentity!==row.pidIdentity)return false;
        // A missing root may still own retained descendants on the agent.
        return target.stop(row,options);
      };
      const value: unknown = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
