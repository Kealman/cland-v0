import { openArtifactFile } from '../hub/artifact-file.ts';
import { realpath } from 'node:fs/promises';
import { lstatSync } from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import type { Artifact, Message } from '../protocol.ts';

export type ArtifactLimits = { photo: number; document: number; caption: number; images: readonly string[] };
export const telegramArtifactLimits: ArtifactLimits = { photo: 10 * 1024 * 1024, document: 50 * 1024 * 1024, caption: 1024, images: ['.png', '.jpg', '.jpeg', '.gif', '.webp'] };
export type ArtifactPart = { type: 'text'; text: string } | { type: 'photo' | 'document'; artifact: string; caption: string };

/** Resolve again at delivery. Neither a parent nor the final file may be a link. */
export function artifactFile(root: string, artifact: Artifact): { path: string; filename: string; mime: string; size: number; display: string } | null {
  const base = resolve(root, '.cland/artifacts');
  const path = resolve(artifact.path);
  const local = relative(base, path);
  if (!local || local.startsWith(`..${sep}`) || local === '..' || local.startsWith(sep) || artifact.folder || artifact.fileDeleted) return null;
  try {
    for (const parent of [join(root, '.cland'), base, ...local.split(sep).map((_, i, parts) => join(base, ...parts.slice(0, i + 1)))])
      if (lstatSync(parent).isSymbolicLink()) return null;
    const stat = lstatSync(path);
    if (!stat.isFile()) return null;
    const mime = ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' } as Record<string, string>)[extname(path).toLowerCase()] ?? 'application/octet-stream';
    return { path, filename: basename(path), mime, size: stat.size, display: `.cland/artifacts/${local.split(sep).join('/')}` };
  } catch { return null; }
}

/** Messenger-neutral ordered text/file plan; native transport and once keys live outside. */
export function artifactPlan(root: string, message: Message, header: string, limits: ArtifactLimits): ArtifactPart[] {
  const artifacts = [...new Map([...(message.artifact ? [message.artifact] : []), ...message.artifacts ?? []].map(a => [a.id, a])).values()];
  const caption = message.text ? `${header}\n${message.text}` : header;
  const single = artifacts.length === 1 && [...caption.replace(/\n/g, '\r\n')].length <= limits.caption && artifactFile(root, artifacts[0]!) !== null
    && artifactFile(root, artifacts[0]!)!.size <= limits.document;
  const parts: ArtifactPart[] = single ? [] : [{ type: 'text', text: message.text }];
  for (const a of artifacts) {
    const file = artifactFile(root, a);
    if (file && file.size <= limits.document) parts.push({ type: file.size <= limits.photo && limits.images.includes(extname(file.path).toLowerCase()) ? 'photo' : 'document', artifact: a.id, caption: single ? caption : header });
    else {
      const local = relative(resolve(root, '.cland/artifacts'), resolve(a.path));
      const display = local && !local.startsWith('..') && !local.startsWith(sep) ? `.cland/artifacts/${local.split(sep).join('/')}` : '.cland/artifacts/(unavailable)';
      parts.push({ type: 'text', text: `▣ ${a.id} ${a.title} · ${file ? `${file.size} bytes` : 'unavailable'} · ${display}` });
    }
  }
  return parts;
}

/** Cap and type belong to the opened descriptor, never to a later pathname reopen. */
export async function artifactBody(root: string, path: string, mime: string, cap: number, signal: AbortSignal): Promise<Blob> {
  const file = await openArtifactFile(path, { path: resolve(root), realPath: await realpath(root) });
  try {
    signal.throwIfAborted();
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > cap) throw new Error('artifact file unavailable');
    const chunks: Buffer<ArrayBuffer>[] = [];
    let total = 0;
    while (total <= cap) {
      signal.throwIfAborted();
      const chunk = Buffer.alloc(Math.min(65_536, cap + 1 - total));
      const { bytesRead } = await file.read(chunk);
      if (!bytesRead) return new Blob(chunks, { type: mime });
      total += bytesRead;
      if (total > cap) throw new Error('artifact file exceeds byte cap');
      chunks.push(chunk.subarray(0, bytesRead));
    }
    throw new Error('artifact file exceeds byte cap');
  } finally { await file.close(); }
}
