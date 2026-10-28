import { useContext, useEffect, useState } from 'react';
import type { AreaContentProps } from '../AreaSlot.tsx';
import { SandboxedArtifactFrame } from './SandboxedArtifactFrame.tsx';
import { artifactSelection } from './state.ts';
import { ArtifactViewerFallback } from './ArtifactNavigation.ts';
import { MarkdownBody } from '../MarkdownBody.tsx';
import s from './Artifacts.module.css';

const MAX_INLINE_IMAGE_BYTES = 10 * 1024 * 1024;
const INLINE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

type Content = { url: string; name: string; type: 'page' | 'text' | 'markdown' | 'image' | 'download'; text?: string; size?: number; imageFailed?: boolean };
export function ArtifactViewer({ connection, selected }: AreaContentProps) {
  const fallback = useContext(ArtifactViewerFallback);
  const selection = artifactSelection(connection.artifacts, selected) ?? artifactSelection(fallback ? [fallback] : undefined, selected);
  const artifact = selection?.artifact;
  const file = selection?.file;
  const [content, setContent] = useState<Content>();
  const [error, setError] = useState('');
  const [source, setSource] = useState(false);
  const command = connection.command;
  useEffect(() => {
    if (!artifact || artifact.fileDeleted || !connection.live || !command) return;
    let current = true;
    const controller = new AbortController();
    void (async () => {
      const minted = await command<{ url: string }>({ type: 'artifact.url', artifact: artifact.id });
      const url = new URL(minted.url);
      if (file) url.pathname = `${url.pathname.split('/').slice(0, 3).join('/')}/${file.split('/').map(encodeURIComponent).join('/')}`;
      const name = decodeURIComponent(url.pathname.split('/').at(-1)!);
      const response = await fetch(url, { method: 'HEAD', signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error(response.status === 404 ? 'Artifact file not found' : `Artifact request failed (${response.status})`);
      const mime = response.headers.get('Content-Type')?.split(';')[0] ?? '';
      const length = response.headers.get('Content-Length');
      const size = length !== null && /^\d+$/.test(length) ? Number(length) : undefined;
      const inlineImage = INLINE_IMAGE_TYPES.has(mime) && size !== undefined && Number.isSafeInteger(size) && size <= MAX_INLINE_IMAGE_BYTES;
      if (/\.mmd$/i.test(name)) url.search = '?render=mermaid';
      const type = /\.mmd$/i.test(name) || mime === 'text/html' || mime === 'image/svg+xml' ? 'page'
        : inlineImage ? 'image'
        : (artifact.kind === 'note' || artifact.kind === 'prompt') && /\.(md|markdown)$/i.test(name) ? 'markdown'
          : mime.startsWith('text/') || mime === 'application/json' || /\.(mmd|markdown)$/i.test(name) ? 'text' : 'download';
      let text: string | undefined;
      if (type === 'text' || type === 'markdown') {
        const body = await fetch(url, { signal: controller.signal, credentials: 'omit' });
        if (!body.ok) throw new Error(body.status === 404 ? 'Artifact file not found' : `Artifact request failed (${body.status})`);
        text = await body.text();
      }
      if (current) { setError(''); setContent({ url: url.href, name, type, ...(INLINE_IMAGE_TYPES.has(mime) && size !== undefined ? { size } : {}), ...(text === undefined ? {} : { text }) }); }
    })().catch((error: unknown) => { if (current) { setContent(undefined); setError(error instanceof Error ? error.message : String(error)); } });
    return () => { current = false; controller.abort(); };
  }, [artifact, file, connection.live, command]);
  return <div className={s.viewer} data-artifact-viewer data-artifact-selection={selected}>
    <div className={s.identity}>{selected}</div>
    {(artifact?.fileDeleted || error) && <p role="alert">{artifact?.fileDeleted ? 'Artifact file not found' : error}</p>}
    {!artifact?.fileDeleted && content?.type === 'page' && <SandboxedArtifactFrame url={content.url} title={selection?.title ?? content.name} />}
    {!artifact?.fileDeleted && content?.type === 'markdown' && <>
      <button className={s.toggle} type="button" aria-pressed={source} onClick={() => setSource(value => !value)}>{source ? 'Show rendered' : 'Show source'}</button>
      {source ? <pre className={s.text} role="region" aria-label="File text">{content.text}</pre>
        : <div className={s.markdown} role="region" aria-label="Rendered Markdown"><MarkdownBody text={content.text ?? ''} /></div>}
    </>}
    {!artifact?.fileDeleted && content?.type === 'image' && <img key={content.url} className={s.image} src={content.url} alt={artifact?.title ?? content.name} referrerPolicy="no-referrer" onError={() => setContent(value => value?.url === content.url ? { ...value, type: 'download', imageFailed: true } : value)} />}
    {!artifact?.fileDeleted && content?.imageFailed && <p className={s.meta}>Image could not be loaded.</p>}
    {!artifact?.fileDeleted && content?.type === 'download' && content.size !== undefined && <p className={s.meta}>{content.size.toLocaleString()} bytes</p>}
    {!artifact?.fileDeleted && content?.type === 'text' && <pre className={s.text} role="region" aria-label="File text">{content.text}</pre>}
    {!artifact?.fileDeleted && content && (content.type !== 'page' || /\.mmd$/i.test(content.name)) && <a className={s.download} href={content.url.split('?')[0]} download={content.name}>Download {content.name}</a>}
  </div>;
}
