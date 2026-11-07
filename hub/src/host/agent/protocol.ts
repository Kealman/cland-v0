export const HOST_ORIGIN = 'git://cland/territory.git';
/** Agent wire version is independent of the shipped cland code version. */
export const AGENT_PROTOCOL = 1;
export const PREPARED_HOST_CAPABILITY = 'host-prepared-v1';
export const MAX_LINE_BYTES = 1024 * 1024;
export type AgentRequest = { id: string; op: string; args: Record<string, unknown> };
export type AgentReply = { id: string | null; ok: true; result: unknown } | { id: string | null; ok: false; error: string; code?: string; availableBytes?: number; floorBytes?: number };
export type AgentHello = { protocol: number; version: string; pid: number; bootId: string; capabilities?: string[] };
export type AgentEvent = { event: 'process-exited'; authority?: 'owned' | 'unknown' | 'closed'; ended?: boolean; pid: number; identity: string; code: number | null; signal: string | null }
  | { event: 'ref-watch-status'; watches: Array<{path:string;branch:string;state:string;cause?:string}> }
  | { event: 'ref-moved'; path: string; branch: string; head: string; result: {code:number|null;stdout:string;stderr:string;error?:string} }
  | { event: 'memory'; totalBytes: number; availableBytes: number };
export function parseRequest(line: string): AgentRequest {
  let value: unknown;
  try { value = JSON.parse(line); } catch { throw new Error('malformed request'); }
  if (!value || typeof value !== 'object') throw new Error('malformed request');
  const r = value as Partial<AgentRequest>;
  if (typeof r.id !== 'string' || !r.id || typeof r.op !== 'string' || !r.args || typeof r.args !== 'object' || Array.isArray(r.args)) throw new Error('malformed request');
  return r as AgentRequest;
}

/** One byte policy for both directions, independent of TCP/Unix chunk boundaries. */
export class LineDecoder {
  #tail = Buffer.alloc(0);
  push(chunk: Buffer): string[] {
    const bytes = this.#tail.length ? Buffer.concat([this.#tail, chunk]) : chunk;
    const lines: string[] = [];
    let start = 0, end: number;
    while ((end = bytes.indexOf(10, start)) !== -1) {
      if (end - start > MAX_LINE_BYTES) throw new Error('agent frame too large');
      lines.push(bytes.subarray(start, end).toString('utf8')); start = end + 1;
    }
    if (bytes.length - start > MAX_LINE_BYTES) throw new Error('agent frame too large');
    this.#tail = Buffer.from(bytes.subarray(start)); return lines;
  }
}
