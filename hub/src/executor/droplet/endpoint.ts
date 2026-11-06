/** Endpoint declaration shared by clients, provider adapters and the test fake. */
export const digitalOceanBase = 'https://api.digitalocean.com/v2';
export const digitalOceanRequestsPerMinute = 250;
const rateField = 'requests-per-minute';
export type DigitalOceanEndpoint = { base: string; requestsPerMinute: number };

export function parseDigitalOceanEndpoint(source = digitalOceanBase): DigitalOceanEndpoint {
  const url = new URL(source);
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.username || url.password) throw new Error('DigitalOcean endpoint must be an HTTP(S) base without query or credentials');
  const fragment = url.hash.slice(1);
  url.hash = '';
  const base = url.href.replace(/\/+$/, '');
  if (base === digitalOceanBase) return { base, requestsPerMinute: digitalOceanRequestsPerMinute };
  const declaration = new URLSearchParams(fragment);
  const values = declaration.getAll(rateField);
  if ([...declaration.keys()].some(key => key !== rateField) || values.length > 1) throw new Error('invalid DigitalOcean endpoint declaration');
  const raw = values[0];
  const requestsPerMinute = raw === undefined ? digitalOceanRequestsPerMinute : Number(raw);
  if ((raw !== undefined && !/^[1-9][0-9]*$/.test(raw)) || !Number.isSafeInteger(requestsPerMinute) || requestsPerMinute <= 0) throw new Error('DigitalOcean requests-per-minute must be a positive safe integer');
  return { base, requestsPerMinute };
}

export function declareDigitalOceanEndpoint(base: string, requestsPerMinute: number): string {
  const value = `${parseDigitalOceanEndpoint(base).base}#${rateField}=${requestsPerMinute}`;
  const endpoint = parseDigitalOceanEndpoint(value);
  return `${endpoint.base}#${rateField}=${endpoint.requestsPerMinute}`;
}
