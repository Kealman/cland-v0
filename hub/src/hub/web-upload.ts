import type { IncomingMessage } from 'node:http';

export class UploadFailure extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/** Consume multipart incrementally: bound headers, every part and the entire wire body. */
export async function readUpload(req: IncomingMessage, max: number, allocate: (size: number) => Buffer = Buffer.allocUnsafe) {
  const fail = (status: number, message: string): never => { throw new UploadFailure(status, message); };
  const boundary = /^multipart\/form-data;\s*boundary=(?:"([^"\r\n]{1,200})"|([^;\s]{1,200}))$/i.exec(req.headers['content-type'] ?? '');
  if (!boundary) fail(400, 'Expected multipart/form-data');
  const delimiter = Buffer.from(`\r\n--${boundary![1] ?? boundary![2]}`);
  const initial = delimiter.subarray(2);
  const cap = 10 * max;
  const declared = Number(req.headers['content-length']);
  // One owned wire buffer; parsed file views share it rather than duplicating payloads.
  const storage = allocate(Number.isSafeInteger(declared) && declared > 0 ? Math.min(declared, cap) : cap);
  let cursor = 0, available = 0, partStart = 0;
  let buffer = storage.subarray(0, 0), total = 0, state: 'initial' | 'headers' | 'body' | 'suffix' | 'done' = 'initial';
  let part: { name: string; filename?: string; mime: string; size: number } | undefined;
  const fields = new Map<string, string>();
  const files: { name: string; mime: string }[] = [], bytes: Buffer[] = [];
  const append = (data: Buffer) => {
    part!.size += data.length;
    if (part!.size > (part!.filename === undefined ? Math.min(max, 64 * 1024) : max)) fail(413, 'Upload part exceeds limit');
  };
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    total += chunk.length;
    if (total > 10 * max) fail(413, 'Upload body exceeds limit');
    if (available + chunk.length > storage.length) fail(413, 'Upload body exceeds limit');
    chunk.copy(storage, available); available += chunk.length;
    buffer = storage.subarray(cursor, available);
    for (;;) {
      if (state === 'initial') {
        if (buffer.length < initial.length + 2) break;
        if (!buffer.subarray(0, initial.length).equals(initial)) fail(400, 'Malformed multipart');
        buffer = buffer.subarray(initial.length); state = 'suffix';
      } else if (state === 'suffix') {
        if (buffer.length < 2) break;
        if (buffer.subarray(0, 2).toString() === '--') { state = 'done'; buffer = Buffer.alloc(0); break; }
        if (buffer.subarray(0, 2).toString() !== '\r\n') fail(400, 'Malformed multipart');
        buffer = buffer.subarray(2); state = 'headers';
      } else if (state === 'headers') {
        const end = buffer.indexOf('\r\n\r\n');
        if (end < 0) { if (buffer.length > 8192) fail(400, 'Multipart headers too large'); break; }
        if (end > 8192) fail(400, 'Multipart headers too large');
        const header = buffer.subarray(0, end).toString();
        const disposition = /^content-disposition: form-data; name="([^"\r\n]+)"(?:; filename="([^"\r\n]*)")?$/im.exec(header);
        if (!disposition) fail(400, 'Malformed multipart disposition');
        part = { name: disposition![1]!, ...(disposition![2] !== undefined ? { filename: disposition![2] } : {}), mime: /^content-type: ([^\r\n]+)$/im.exec(header)?.[1] ?? 'application/octet-stream', size: 0 };
        if (part.filename === undefined && (!['topic', 'text', 'kind', 'to', 'replyTo', 'artifacts'].includes(part.name) || fields.has(part.name))) fail(400, 'Unknown or duplicate upload field');
        if (part.filename !== undefined && files.length >= 10) fail(400, 'Give 1 to 10 files');
        buffer = buffer.subarray(end + 4); partStart = available - buffer.length; state = 'body';
      } else if (state === 'body') {
        let end = buffer.indexOf(delimiter);
        while (end >= 0) {
          if (end + delimiter.length + 2 > buffer.length) { end = -1; break; }
          const suffix = buffer.subarray(end + delimiter.length, end + delimiter.length + 2).toString();
          if (suffix === '--' || suffix === '\r\n') break;
          end = buffer.indexOf(delimiter, end + 1);
        }
        if (end < 0) {
          const safe = Math.max(0, buffer.length - delimiter.length - 2);
          append(buffer.subarray(0, safe)); buffer = buffer.subarray(safe); break;
        }
        append(buffer.subarray(0, end));
        const body = storage.subarray(partStart, available - buffer.length + end);
        if (part!.filename !== undefined) { files.push({ name: part!.filename, mime: part!.mime }); bytes.push(body); }
        else { if (fields.has(part!.name)) fail(400, 'Duplicate upload field'); fields.set(part!.name, body.toString()); }
        part = undefined; buffer = buffer.subarray(end + delimiter.length); state = 'suffix';
      } else { buffer = Buffer.alloc(0); break; }
    }
    cursor = available - buffer.length;
  }
  if (state !== 'done' || !files.length) fail(400, 'Incomplete multipart upload');
  const topic = fields.get('topic') ?? '', caption = fields.get('text') ?? '', kind = fields.get('kind') ?? 'message';
  if (!topic || !['message', 'decision', 'question'].includes(kind)) fail(400, 'Invalid upload fields');
  let to: unknown;
  try { to = fields.has('to') ? JSON.parse(fields.get('to')!) : undefined; } catch { fail(400, 'Invalid recipients'); }
  if (to !== undefined && (!Array.isArray(to) || !to.every(value => typeof value === 'string'))) fail(400, 'Invalid recipients');
  if (to !== undefined && fields.has('replyTo')) fail(400, 'Choose recipients or replyTo');
  let artifacts: unknown;
  try { artifacts = fields.has('artifacts') ? JSON.parse(fields.get('artifacts')!) : undefined; } catch { fail(400, 'Invalid artifacts'); }
  if (artifacts !== undefined && (!Array.isArray(artifacts) || !artifacts.every(value => typeof value === 'string'))) fail(400, 'Invalid artifacts');
  return { frame: { type: 'artifact.upload', id: 'upload', topic, caption, kind, files, ...(artifacts === undefined ? {} : { artifacts }), ...(to === undefined ? {} : { to }), ...(fields.has('replyTo') ? { replyTo: fields.get('replyTo') } : {}) }, bytes };
}
