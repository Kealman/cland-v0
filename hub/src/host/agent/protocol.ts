/** Agent wire version is independent of the shipped cland code version. */
export const AGENT_PROTOCOL = 1;
export const MAX_LINE_BYTES = 1024 * 1024;
export type AgentRequest = { id: string; op: string; args: Record<string, unknown> };
export type AgentReply = { id: string | null; ok: true; result: unknown } | { id: string | null; ok: false; error: string };
export type AgentHello = { protocol: number; version: string; pid: number; bootId: string };
export type AgentEvent = { event: 'process-exited'; authority?: 'owned' | 'unknown' | 'closed'; ended?: boolean; pid: number; identity: string; code: number | null; signal: string | null }
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
