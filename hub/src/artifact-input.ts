/** Inline artifacts must fit even after worst-case JSON escaping within the wire cap. */
export const INLINE_ARTIFACT_BYTES = 65_536;
export function validateInlineArtifact(content: unknown): void {
  if (typeof content === 'string' && Buffer.byteLength(content, 'utf8') > INLINE_ARTIFACT_BYTES) {
    throw Object.assign(new Error(`inline artifact content exceeds ${INLINE_ARTIFACT_BYTES} UTF-8 bytes; use path to publish a file`), { code: 'invalid_argument' });
  }
}
