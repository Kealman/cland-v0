import { useContext, useEffect, useState } from 'react';
import type { Artifact } from '../../../shared/wire/index.ts';
import type { ConnectionState } from '../connection.ts';
import { ArtifactNavigation } from './ArtifactNavigation.ts';
import { SandboxedArtifactFrame } from './SandboxedArtifactFrame.tsx';
import s from './InlineArtifact.module.css';
import { usePhone } from '../phone.ts';

export function InlineArtifact({ artifact, connection }: { artifact: Artifact; connection: ConnectionState }) {
  const phone = usePhone();
  const open = useContext(ArtifactNavigation);
  const [preview, setPreview] = useState<{ url?: string; error?: string }>({});
  const command = connection.command;
  const page = artifact.kind === 'page' && !artifact.folder;
  useEffect(() => {
    if (!page || artifact.fileDeleted || !connection.live || !command) return;
    let current = true;
    const controller = new AbortController();
    void (async () => {
      const { url } = await command<{ url: string }>({ type: 'artifact.url', artifact: artifact.id });
      const response = await fetch(url, { method: 'HEAD', signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error(response.status === 404 ? 'Artifact file not found' : `Artifact request failed (${response.status})`);
      if (response.headers.get('Content-Type')?.split(';')[0] !== 'text/html') throw new Error('Artifact is not HTML');
      if (current) setPreview({ url });
    })().catch((error: unknown) => { if (current) setPreview({ error: error instanceof Error ? error.message : String(error) }); });
    return () => { current = false; controller.abort(); };
  }, [artifact.id, artifact.fileDeleted, page, connection.live, command]);
  const reason = artifact.fileDeleted ? 'Artifact file not found' : !connection.live ? 'Disconnected' : preview.error;
  if (phone && page && !reason) return <button data-artifact-id={artifact.id} className={s.chip} onClick={event => open(artifact, event.currentTarget)}>
    <span className={s.id}>{artifact.id} {artifact.kind}</span><span>{artifact.title}</span>
  </button>;
  if (!page || reason || !preview.url) return <span data-artifact-id={artifact.id} className={s.chip} title={reason}>
    <span className={s.id}>{artifact.id} {artifact.kind}{artifact.folder ? ' · folder' : ''}</span><span>{artifact.title}</span>
  </span>;
  return <section data-artifact-id={artifact.id} className={s.preview}>
    <header className={s.header}><span className={s.id}>{artifact.id} {artifact.kind}</span><strong>{artifact.title}</strong>
      <a href={preview.url} target="_blank" rel="noopener noreferrer">Open full</a>
      <button onClick={event => open(artifact, event.currentTarget)}>Open in a pane</button>
    </header>
    <SandboxedArtifactFrame url={preview.url} title={artifact.title} className={s.frame} />
  </section>;
}
