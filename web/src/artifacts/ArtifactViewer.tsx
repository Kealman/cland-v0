import { useContext, useEffect, useState } from 'react';
import type { AreaContentProps } from '../AreaSlot.tsx';
import { SandboxedArtifactFrame } from './SandboxedArtifactFrame.tsx';
import { artifactSelection } from './state.ts';
import { ArtifactViewerFallback } from './ArtifactNavigation.ts';
import s from './Artifacts.module.css';

type Content = { url: string; name: string; type: 'page' | 'text' | 'download'; text?: string };
export function ArtifactViewer({ connection, selected }: AreaContentProps) {
  const fallback = useContext(ArtifactViewerFallback);
  const selection = artifactSelection(connection.artifacts, selected) ?? artifactSelection(fallback ? [fallback] : undefined, selected);
  const artifact = selection?.artifact;
  const file = selection?.file;
  const [content, setContent] = useState<Content>();
  const [error, setError] = useState('');
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
      const type = mime === 'text/html' || (artifact.kind === 'diagram' && mime === 'image/svg+xml') ? 'page'
        : mime.startsWith('text/') || mime === 'application/json' || /\.(mmd|markdown)$/i.test(name) ? 'text' : 'download';
      let text: string | undefined;
      if (type === 'text') {
        const body = await fetch(url, { signal: controller.signal, credentials: 'omit' });
        if (!body.ok) throw new Error(body.status === 404 ? 'Artifact file not found' : `Artifact request failed (${body.status})`);
        text = await body.text();
      }
      if (current) { setError(''); setContent({ url: url.href, name, type, ...(text === undefined ? {} : { text }) }); }
    })().catch((error: unknown) => { if (current) { setContent(undefined); setError(error instanceof Error ? error.message : String(error)); } });
    return () => { current = false; controller.abort(); };
  }, [artifact, file, connection.live, command]);
  return <div className={s.viewer} data-artifact-viewer data-artifact-selection={selected}>
    <div className={s.identity}>{selected}</div>
    {(artifact?.fileDeleted || error) && <p role="alert">{artifact?.fileDeleted ? 'Artifact file not found' : error}</p>}
    {!artifact?.fileDeleted && content?.type === 'page' && <SandboxedArtifactFrame url={content.url} title={selection?.title ?? content.name} />}
    {!artifact?.fileDeleted && content?.type === 'text' && <pre className={s.text} role="region" aria-label="File text">{content.text}</pre>}
    {!artifact?.fileDeleted && content && content.type !== 'page' && <a className={s.download} href={content.url} download={content.name}>Download {content.name}</a>}
  </div>;
}
