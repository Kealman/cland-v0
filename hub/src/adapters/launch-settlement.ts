/** A launch keeps one settlement producer even after its caller's deadline expires. */
export type LaunchSettled = () => void | Promise<void>;
export const LAUNCH_SETTLEMENT_MS = 5000;

export function boundedSettlement(callback: LaunchSettled, timeoutMs = LAUNCH_SETTLEMENT_MS): LaunchSettled {
  let flight: Promise<void> | undefined;
  let complete = false;
  return () => {
    if (complete) return;
    if (!flight) {
      const result = callback();
      if (!result) { complete = true; return; }
      flight = result.then(() => { complete = true; }, error => { flight = undefined; throw error; });
    }
    const current = flight;
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`cleanup-incomplete: launch settlement exceeded ${timeoutMs} ms`)), timeoutMs);
      current.then(() => { clearTimeout(timer); resolve(); }, error => { clearTimeout(timer); reject(error); });
    });
  };
}
