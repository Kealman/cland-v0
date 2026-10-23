import s from './Artifacts.module.css';

/** Artifact scripts run in an opaque origin, with the hub's sandbox policy too. */
export function SandboxedArtifactFrame({ url, title, className }: { url: string; title: string; className?: string | undefined }) {
  return <iframe className={[s.frame, className].filter(Boolean).join(' ')} title={title} src={url} sandbox="allow-scripts" />;
}
