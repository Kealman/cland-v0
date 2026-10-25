/** A crew verifier request: `review request T-<n>` or `qa request T-<n>` at the start of a message.
 *
 * Text after the item on the first line is detail — the branch, head, criteria or brief a sender puts
 * there — so `review request T-12 — branch and scope` routes exactly like the bare form. The item id
 * ends at its last digit: a letter right after it (`review request T-12abc`) is no request at all,
 * because that is not a form any lead writes. One matcher serves delivery acceptance (pending work),
 * verifier resolution and queueing, and the Lead's subtree refusal, so those four cannot disagree
 * about whether a first line is a request.
 */
export type VerifierRequest = { kind: 'review' | 'qa'; item: string };

const REQUEST = /^(review|qa) request ((?:[A-Za-z]-)?[1-9]\d*)(?![0-9A-Za-z])/;

export function verifierRequest(text: string): VerifierRequest | null {
  const match = REQUEST.exec(text);
  if (!match) return null;
  return { kind: match[1] === 'review' ? 'review' : 'qa', item: match[2]! };
}
