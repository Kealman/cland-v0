import type { ApprovalSubject } from '../protocol.ts';

/** The entire public subject, JSON encoded, is at most 64 KiB, including multibyte text. */
export function approvalSubject(input: ApprovalSubject): ApprovalSubject {
  const subject: ApprovalSubject = {};
  const limit = 64 * 1024;
  const size = () => Buffer.byteLength(JSON.stringify(subject));
  for (const key of ['command', 'cwd', 'reason', 'change'] as const) {
    const value = input[key];
    if (typeof value !== 'string') continue;
    subject[key] = value;
    if (size() <= limit) continue;
    let low = 0, high = value.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      subject[key] = value.slice(0, mid);
      if (size() <= limit) low = mid;
      else high = mid - 1;
    }
    // Never cut a UTF-16 surrogate pair in half.
    const end = low > 0 && /[\uD800-\uDBFF]/.test(value[low - 1]!) ? low - 1 : low;
    subject[key] = value.slice(0, end);
    if (size() > limit) delete subject[key];
  }
  if (Array.isArray(input.files)) {
    subject.files = [];
    for (const file of input.files) {
      if (typeof file !== 'string') continue;
      subject.files.push(file);
      if (size() > limit) { subject.files.pop(); break; }
    }
    if (size() > limit) delete subject.files;
  }
  return subject;
}
