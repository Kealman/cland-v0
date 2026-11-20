import { assertPublishable } from '../../.agents/skills/qa/qa-demo-policy.ts';

/** Keep raw credentials in memory; emit only complete, scanned lines. */
export function privateInviteCapture() {
  const values = new Set<string>();
  let pending = '', text = '', links = 0, bytesRead = 0;
  const pattern = /https?:\/\/[^\s<>"']+[?&]token=[^\s<>"']+/g;
  const control = ['http://127.0.0.1:1/auth?', 'token=', 'b'.repeat(64)].join('');
  let refused = false;
  try { assertPublishable(control); } catch { refused = true; }
  if (!refused) throw Error('invite positive control was not refused');
  const redact = (line: string) => {
    const safe = line.replace(pattern, value => { values.add(value); links++; return '<one-time invite link withheld>'; });
    assertPublishable(safe);
    return safe;
  };
  const assertAbsent = (captures: string[]) => {
    for (const value of values) for (const capture of captures) {
      if (capture.includes(value) || capture.includes(new URL(value).searchParams.get('token')!)) throw Error('capture contains private invite');
    }
    for (const capture of captures) assertPublishable(capture);
  };
  return {
    write(chunk: string) {
      bytesRead += Buffer.byteLength(chunk);
      if (bytesRead > 1024 * 1024) throw Error('private capture byte budget exceeded');
      pending += chunk;
      // Bound retained output while reading; a missing newline cannot grow forever.
      if (Buffer.byteLength(pending) + Buffer.byteLength(text) > 1024 * 1024) throw Error('private capture byte budget exceeded');
      let end: number;
      while ((end = pending.indexOf('\n')) >= 0) {
        text += redact(pending.slice(0, end)) + '\n'; pending = pending.slice(end + 1);
      }
    },
    finish() {
      text += redact(pending); pending = '';
      // Plant an actual observed credential, or the synthetic control on empty captures.
      const planted = values.values().next().value ?? control;
      let found = false;
      try { assertAbsent([planted]); } catch { found = true; }
      if (!found) throw Error('invite scan positive control failed');
      assertAbsent([text]);
      return { text, links, positiveControl: found };
    },
    assertAbsent,
  };
}
