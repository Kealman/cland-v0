import type { ProvisionRecord } from './provision-records.ts';

/** Only a confirmed, still-live machine contributes to unsettled live spend. */
export function liveHostAccrual(row: ProvisionRecord, priceHourly: number | null, at: number, periodStart: number): number | null {
  if (!row.machine || row.machineDeletionRead) return 0;
  if (priceHourly === null) return null;
  return Math.max(0, at - Math.max(Date.parse(row.machine.created), periodStart)) / 3600000 * priceHourly;
}
